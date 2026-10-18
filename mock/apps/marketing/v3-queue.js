module.exports = function queue({ getDb, views, project, handler, fail, nowIso }) {
  const rows = p => getDb().posts.filter(row => row.projectId === p.id)
    .sort((a, b) => (a.v3Order ?? 0) - (b.v3Order ?? 0) || a.createdAt.localeCompare(b.createdAt));
  const dto = row => ({ id: row.id, projectId: row.projectId, title: row.title, status: row.status,
    scheduledAt: views.effectiveScheduledAt(row), approvalStatus: row.approvalStatus,
    queueOrder: row.v3Order ?? 0, canMove: !row.custodyReadOnly && ['DRAFT', 'SCHEDULED'].includes(row.status) });
  function routes(app) {
    app.get('/v3/queue', handler((req, user) => rows(project(req, user)).map(dto)));
    app.patch('/v3/queue/:id', handler((req, user) => {
      const p = project(req, user, 'editPosts'), all = rows(p), row = all.find(r => r.id === req.params.id);
      if (!row) throw fail(404, 'post_not_found', 'This current project post was not found.');
      if (!dto(row).canMove) throw fail(409, 'post_state_locked', 'Review or published posts cannot move through the queue.');
      const nextStatus = req.body.status ?? row.status;
      if (!['DRAFT', 'SCHEDULED'].includes(nextStatus)) throw fail(422, 'queue_state_invalid', 'Choose draft or scheduled.');
      const scheduledAt = req.body.scheduledAt === undefined ? views.effectiveScheduledAt(row) : req.body.scheduledAt;
      if (nextStatus === 'SCHEDULED') {
        if (!['APPROVED', 'NOT_REQUIRED'].includes(row.approvalStatus)) throw fail(409, 'approval_required', 'Complete the current post approval first.');
        if (typeof scheduledAt !== 'string' || !Number.isFinite(Date.parse(scheduledAt)) || Date.parse(scheduledAt) <= Date.parse(nowIso())) throw fail(422, 'future_schedule_required', 'Choose a future time in the project time zone.');
      }
      const peers = all.filter(r => r.id !== row.id && r.status === nextStatus);
      const before = req.body.beforeId, after = req.body.afterId;
      for (const id of [before, after]) if (id != null && !peers.some(r => r.id === id)) throw fail(409, 'queue_changed', 'Refresh this queue before moving the post.');
      const index = before != null ? peers.findIndex(r => r.id === before) : after != null ? peers.findIndex(r => r.id === after) + 1 : peers.length;
      peers.splice(index, 0, row);
      row.status = nextStatus; row.publishMode = nextStatus === 'SCHEDULED' ? 'SCHEDULED' : 'DRAFT';
      row.workflowState = nextStatus === 'SCHEDULED' ? 'SCHEDULED_APPROVED' : 'DRAFT';
      row.scheduledAt = nextStatus === 'SCHEDULED' ? new Date(scheduledAt).toISOString() : null;
      row.targets.forEach(target => { if (!target.publishedAt) { target.status = nextStatus; target.scheduledAt = row.scheduledAt; } });
      peers.forEach((peer, position) => { peer.v3Order = position; });
      row.updatedAt = nowIso();
      return dto(row);
    }));
  }
  return { routes };
};
