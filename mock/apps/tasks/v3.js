const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const clone = value => JSON.parse(JSON.stringify(value));
const PRESETS = [
  { id: 'preset:brief', name: 'Project brief', title: 'Prepare project brief', priority: 'medium', labels: ['planning'] },
  { id: 'preset:review', name: 'Review', title: 'Review deliverable', priority: 'high', labels: ['review'] },
  { id: 'preset:weekly', name: 'Weekly check-in', title: 'Weekly check-in', priority: 'medium', recurrence: 'weekly', labels: ['team'] },
];
function create({ getDb, identity, nowIso, canSeeProject, isPM, isViewerOnly, sectionForStatus, richTask, fullTask, projectCard, placeTask, setStatus, canComplete, logActivity, pushNotification, taskNotifData, me, ok, DEFAULT_SECTIONS }) {
  const db = () => getDb(), projectById = id => db().projects.find(row => row.id === Number(id)), taskById = id => db().tasks.find(row => row.id === Number(id));
  function writable(project, actor, admin = false) {
    if (!actor || !project || !canSeeProject(project, actor)) throw fail(404, 'project_not_found', 'This project was not found.');
    if (project.archivedAt || project.custodyReadOnly) throw fail(423, 'project_read_only', 'Restore the project before making changes.');
    if (isViewerOnly(actor) || admin && !isPM(actor)) throw fail(403, 'task_permission_required', 'Your role cannot make this change.');
  }
  function metadata(task) { return { labels: clone(task.labels || []), watcherIds: clone(task.watcherIds || []), reminder: clone(task.reminder || { enabled: false }), recurrence: task.recurrence || 'none', customFields: clone(task.customFields || {}), timeEntries: clone(task.timeEntries || []), ...(task.source ? { source: clone(task.source) } : {}), nextOccurrenceId: task.nextOccurrenceId || null }; }
  function patch(task, body) {
    if (body.labels !== undefined) { if (!Array.isArray(body.labels) || body.labels.length > 20 || body.labels.some(value => typeof value !== 'string' || !value.trim() || value.length > 60)) throw fail(422, 'invalid_labels', 'Use up to twenty short labels.'); task.labels = [...new Set(body.labels.map(value => value.trim()))]; }
    if (body.watcherIds !== undefined) { if (!Array.isArray(body.watcherIds) || body.watcherIds.length > 100 || body.watcherIds.some(id => !identity.findUser(id))) throw fail(422, 'invalid_watchers', 'Choose current workspace people.'); task.watcherIds = [...new Set(body.watcherIds.map(Number))]; }
    if (body.recurrence !== undefined) { if (!['none', 'weekly', 'monthly'].includes(body.recurrence)) throw fail(422, 'invalid_recurrence', 'Choose a supported repeat interval.'); task.recurrence = body.recurrence; }
    if (body.reminder !== undefined) { const reminder = body.reminder; if (!reminder || typeof reminder.enabled !== 'boolean' || Object.keys(reminder).some(key => !['enabled', 'at', 'offset'].includes(key)) || reminder.at && !Number.isFinite(Date.parse(reminder.at)) || reminder.offset !== undefined && (!Number.isFinite(reminder.offset) || reminder.offset < 0 || reminder.offset > 10080)) throw fail(422, 'invalid_reminder', 'Choose a valid reminder time.'); task.reminder = clone(reminder); }
    if (body.customFields !== undefined) { const values = body.customFields, definitions = projectById(task.projectId)?.v3Config?.customFields || []; if (!values || typeof values !== 'object' || Array.isArray(values) || JSON.stringify(values).length > 10000 || Object.entries(values).some(([id, value]) => !definitions.some(field => field.id === id && (field.type === 'number' ? typeof value === 'number' && Number.isFinite(value) : field.type === 'boolean' ? typeof value === 'boolean' : typeof value === 'string' && value.length <= 2000)))) throw fail(422, 'invalid_custom_fields', 'Use the project’s defined fields and value types.'); task.customFields = clone(values); }
  }
  function createTask(project, section, body, actor) {
    writable(project, actor);
    if (!section || section.projectId !== project.id || section.flag === 'archive') throw fail(422, 'invalid_section', 'Choose an active project section.');
    const title = String(body.title || '').trim();
    if (title.length < 2 || title.length > 500) throw fail(422, 'invalid_title', 'Enter a title of 2–500 characters.');
    for (const key of ['startDate', 'dueDate']) if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      const value = body[key], match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
      if (!match || !Number.isFinite(Date.parse(value))) throw fail(422, 'invalid_date', 'Use a valid date or leave it empty.');
      const civil = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
      if (civil.getUTCFullYear() !== Number(match[1]) || civil.getUTCMonth() + 1 !== Number(match[2]) || civil.getUTCDate() !== Number(match[3])) throw fail(422, 'invalid_date', 'Use a valid calendar date.');
    }
    const at = nowIso(), task = { id: db().nextId('task'), projectId: project.id, sectionId: section.id, order: db().tasks.filter(row => row.sectionId === section.id).length + 1, title, description: String(body.description || '').slice(0, 20000), priority: ['low', 'medium', 'high', 'urgent'].includes(body.priority) ? body.priority : 'medium', status: section.flag, baseProgress: null, startDate: body.startDate && Number.isFinite(Date.parse(body.startDate)) ? new Date(body.startDate).toISOString() : at, dueDate: body.dueDate && Number.isFinite(Date.parse(body.dueDate)) ? new Date(body.dueDate).toISOString() : null, createdById: actor.id, createdAt: at, updatedAt: at, completedAt: null, assignments: [], movedAt: null, dependsOn: [] };
    patch(task, body);
    const users = body.assignedUserIds || [];
    if (!Array.isArray(users) || users.some(id => !identity.findUser(id))) throw fail(422, 'invalid_assignees', 'Choose workspace people.');
    task.assignments = [...new Set(users)].map(id => ({ id: db().nextId('assignment'), assigneeType: 'user', assigneeId: Number(id), assignedById: actor.id, assignedAt: at }));
    db().tasks.push(task); logActivity(task, 'created', actor.id);
    return task;
  }
  function complete(task, actor) {
    if (!['weekly', 'monthly'].includes(task.recurrence) || task.nextOccurrenceId) return;
    const section = sectionForStatus(task.projectId, 'todo'); if (!section) return;
    const date = new Date(task.dueDate || nowIso());
    if (task.recurrence === 'weekly') date.setUTCDate(date.getUTCDate() + 7);
    else { const day = date.getUTCDate(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + 1); const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(); date.setUTCDate(Math.min(day, last)); }
    const next = createTask(projectById(task.projectId), section, { ...metadata(task), title: task.title, description: task.description, priority: task.priority, dueDate: date.toISOString(), assignedUserIds: task.assignments.filter(row => row.assigneeType === 'user').map(row => row.assigneeId), reminder: { enabled: false } }, actor);
    task.nextOccurrenceId = next.id; next.previousOccurrenceId = task.id;
    logActivity(task, 'recurrence_created', actor.id, { nextTaskId: next.id });
  }
  function routes(app) {
    const route = fn => (req, res, next) => { try { const actor = me(req, res); if (!actor) return; const result = fn(req, actor); ok(res, result, 'Tasks updated'); } catch (error) { next(error); } };
    const visible = actor => db().projects.filter(project => canSeeProject(project, actor));
    app.get('/api/task-templates', route((_req, actor) => [...clone(PRESETS), ...visible(actor).flatMap(project => (project.v3Templates || []).map(row => ({ ...row, projectId: project.id })))]));
    app.post('/api/task-templates', route((req, actor) => {
      const project = projectById(req.body.projectId); writable(project, actor, true);
      const name = String(req.body.name || '').trim(); if (!name || name.length > 100) throw fail(422, 'invalid_template', 'Name the template.');
      project.v3Templates ??= []; if (project.v3Templates.length >= 100) throw fail(422, 'template_limit', 'This project has one hundred templates.');
      const row = { id: `template:${project.id}:${db().nextId('activity')}`, name, title: String(req.body.title || name).slice(0, 500), description: String(req.body.description || '').slice(0, 20000), priority: req.body.priority || 'medium', labels: req.body.labels || [], recurrence: req.body.recurrence || 'none', watcherIds: req.body.watcherIds || [], reminder: req.body.reminder || { enabled: false }, customFields: req.body.customFields || {} };
      patch({ projectId: project.id }, row);
      for (const key of ['dueDate', 'startDate']) if (req.body[key] !== undefined) { if (req.body[key] !== null && !Number.isFinite(Date.parse(req.body[key]))) throw fail(422, 'invalid_template_date', 'Choose valid template dates.'); row[key] = req.body[key] === null ? null : new Date(req.body[key]).toISOString(); }
      project.v3Templates.push(row); return clone(row);
    }));
    const reminders = (actor, taskId, force = false) => {
      const result = { delivery: 'in_app_mock', notifiedTaskIds: [], notificationIds: [] };
      for (const task of db().tasks.filter(row => taskId === undefined || row.id === Number(taskId))) {
        const project = projectById(task.projectId);
        if (!canSeeProject(project, actor) || project.archivedAt || project.custodyReadOnly || task.status === 'done' || !task.reminder?.enabled) continue;
        const at = task.reminder.at ? Date.parse(task.reminder.at) : task.dueDate ? Date.parse(task.dueDate) - (task.reminder.offset || 0) * 60000 : null;
        if (!force && (at === null || at > Date.parse(nowIso()))) continue;
        task.reminderReceipts ??= {};
        const recipients = [...new Set([task.createdById, ...(task.watcherIds || []), ...task.assignments.filter(row => row.assigneeType === 'user').map(row => row.assigneeId)])];
        for (const id of recipients) {
          const person = identity.findUser(id), receipt = `${force ? 'preview' : 'due'}:${at ?? nowIso()}:${id}`;
          if (!person || !identity.userScopes(person).some(scope => scope.scope === 'task_manager' && scope.roles.length) || !canSeeProject(project, person) || task.reminderReceipts[receipt]) continue;
          const notification = pushNotification(id, { type: 'task_reminder', group: 'assigned', title: task.title, message: 'Task reminder · in-app mock', data: { ...taskNotifData(task), delivery: 'in_app_mock' } });
          if (notification) { task.reminderReceipts[receipt] = notification.id; result.notificationIds.push(notification.id); if (!result.notifiedTaskIds.includes(task.id)) result.notifiedTaskIds.push(task.id); }
        }
      }
      return result;
    };
    app.post('/api/tasks/reminders/run', route((_req, actor) => reminders(actor)));
    app.post('/api/tasks/:id/reminder/send', route((req, actor) => { const task = taskById(req.params.id); writable(task && projectById(task.projectId), actor); if (!task.reminder?.enabled) throw fail(409, 'reminder_disabled', 'Enable a reminder before previewing delivery.'); return reminders(actor, task.id, true); }));
    app.delete('/api/task-templates/:id', route((req, actor) => { const project = visible(actor).find(row => row.v3Templates?.some(template => template.id === req.params.id)); writable(project, actor, true); project.v3Templates = project.v3Templates.filter(row => row.id !== req.params.id); return { deleted: true }; }));
    app.get('/api/projects/:id/config', route((req, actor) => { const project = projectById(req.params.id); if (!project || !canSeeProject(project, actor)) throw fail(404, 'project_not_found', 'This project was not found.'); return clone(project.v3Config || { customFields: [], automations: [], runs: [] }); }));
    app.put('/api/projects/:id/config', route((req, actor) => {
      const project = projectById(req.params.id); writable(project, actor, true); const { customFields = [], automations = [] } = req.body;
      if (!Array.isArray(customFields) || customFields.length > 20 || customFields.some(row => !/^[\w-]{1,60}$/.test(row.id) || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 100 || !['text', 'number', 'boolean'].includes(row.type)) || new Set(customFields.map(row => row.id)).size !== customFields.length) throw fail(422, 'invalid_fields', 'Define unique text, number or checkbox fields.');
      if (!Array.isArray(automations) || automations.length > 20 || automations.some(row => !/^[\w-]{1,60}$/.test(row.id) || typeof row.enabled !== 'boolean' || !['overdue', 'status'].includes(row.when) || row.when === 'status' && !['backlog', 'todo', 'in_progress', 'in_review', 'done'].includes(row.status) || !['priority', 'label'].includes(row.action) || typeof row.value !== 'string' || !row.value.trim() || row.value.length > 60 || row.action === 'priority' && !['low', 'medium', 'high', 'urgent'].includes(row.value)) || new Set(automations.map(row => row.id)).size !== automations.length) throw fail(422, 'invalid_automations', 'Choose supported automation conditions and actions.');
      project.v3Config = { customFields: clone(customFields), automations: clone(automations), runs: project.v3Config?.runs || [] }; return clone(project.v3Config);
    }));
    app.post('/api/projects/:id/automations/run', route((req, actor) => { const project = projectById(req.params.id); writable(project, actor, true); const updatedIds = []; for (const rule of project.v3Config?.automations || []) if (rule.enabled) for (const task of db().tasks.filter(row => row.projectId === project.id && (rule.when === 'status' ? row.status === rule.status : row.status !== 'done' && row.dueDate && Date.parse(row.dueDate) < Date.parse(nowIso())))) { if (rule.action === 'priority') task.priority = rule.value; else task.labels = [...new Set([...(task.labels || []), rule.value])]; task.updatedAt = nowIso(); updatedIds.push(task.id); logActivity(task, 'automation_applied', actor.id, { ruleId: rule.id }); } project.v3Config ??= { customFields: [], automations: [], runs: [] }; const result = { id: `run:${db().nextId('activity')}`, at: nowIso(), updatedIds: [...new Set(updatedIds)] }; project.v3Config.runs.unshift(result); project.v3Config.runs = project.v3Config.runs.slice(0, 100); return result; }));
    for (const action of ['archive', 'restore']) app.post(`/api/projects/:id/${action}`, route((req, actor) => { const project = projectById(req.params.id); if (!project || !canSeeProject(project, actor) || !isPM(actor)) throw fail(403, 'project_manager_required', 'Ask a project manager.'); if (project.custodyReadOnly) throw fail(423, 'custody_read_only', 'This project awaits ownership review.'); project.archivedAt = action === 'archive' ? project.archivedAt || nowIso() : null; project.updatedAt = nowIso(); return projectCard(project); }));
    app.post('/api/projects/sample', route((_req, actor) => { const prior = db().projects.find(row => row.v3Sample); if (prior && canSeeProject(prior, actor)) return projectCard(prior); if (db().projects.length) throw fail(409, 'workspace_not_empty', 'A sample project is offered only in an empty workspace.'); if (!isPM(actor)) throw fail(403, 'project_manager_required', 'Ask a project manager.'); const at = nowIso(), project = { id: db().nextId('project'), title: 'Your first project', description: 'Sample workspace project', priority: 'medium', status: 'todo', isPrivate: true, memberIds: [actor.id], teamIds: [], createdById: actor.id, createdAt: at, updatedAt: at, v3Sample: true }; db().projects.push(project); for (const source of [...DEFAULT_SECTIONS, { title: 'ARCHIVE', flag: 'archive', order: 99, color: '#6B7280' }]) db().sections.push({ ...source, id: db().nextId('section'), projectId: project.id, createdAt: at, updatedAt: at }); for (const template of PRESETS) createTask(project, sectionForStatus(project.id, 'todo'), { ...template, assignedUserIds: [actor.id] }, actor); return projectCard(project); }));
    app.post('/api/tasks/:id/time-entries', route((req, actor) => { const task = taskById(req.params.id); writable(task && projectById(task.projectId), actor); const minutes = req.body.minutes; if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440 || String(req.body.note || '').length > 1000) throw fail(422, 'invalid_time', 'Enter 1–1440 minutes and a short note.'); task.timeEntries ??= []; const entry = { id: `time:${db().nextId('activity')}`, userId: actor.id, minutes, note: String(req.body.note || ''), at: nowIso() }; task.timeEntries.push(entry); logActivity(task, 'time_logged', actor.id, { minutes }); return clone(entry); }));
    app.get('/api/tasks/:id/reminder-preview', route((req, actor) => { const task = taskById(req.params.id); if (!task || !canSeeProject(projectById(task.projectId), actor)) throw fail(404, 'task_not_found', 'This task was not found.'); const ids = [...new Set([actor.id, ...(task.watcherIds || []), ...task.assignments.filter(row => row.assigneeType === 'user').map(row => row.assigneeId)])]; return { reminder: metadata(task).reminder, recipients: ids.map(id => identity.findUser(id)).filter(Boolean).map(person => ({ id: person.id, name: identity.fullName(person) })), delivery: 'in_app_mock' }; }));
    app.post('/api/tasks/bulk', route((req, actor) => {
      const ids = req.body.ids, body = req.body.patch;
      if (!Array.isArray(ids) || !ids.length || ids.length > 200 || !body || typeof body !== 'object' || Object.keys(body).some(key => !['status', 'priority', 'assignedUserIds', 'labels'].includes(key))) throw fail(422, 'invalid_bulk', 'Select up to two hundred tasks and a supported change.');
      const result = { updatedIds: [], failed: [] };
      for (const id of [...new Set(ids)]) { const task = taskById(id); try { writable(task && projectById(task.projectId), actor); if (body.status !== undefined && !['backlog', 'todo', 'in_progress', 'in_review', 'done'].includes(body.status) || body.priority !== undefined && !['low', 'medium', 'high', 'urgent'].includes(body.priority)) throw fail(422, 'invalid_change', 'Choose a supported status or priority.'); if (body.status === 'done' && !canComplete(task)) throw fail(409, 'dependency_blocked', 'Complete dependencies first.'); const candidate = clone(task); patch(candidate, body); if (body.assignedUserIds !== undefined) { if (!Array.isArray(body.assignedUserIds) || body.assignedUserIds.some(userId => !identity.findUser(userId))) throw fail(422, 'invalid_assignees', 'Choose workspace people.'); candidate.assignments = [...new Set(body.assignedUserIds)].map(userId => ({ id: db().nextId('assignment'), assigneeType: 'user', assigneeId: Number(userId), assignedById: actor.id, assignedAt: nowIso() })); } Object.assign(task, candidate, body.priority ? { priority: body.priority } : {}); if (body.status && body.status !== task.status) { const section = sectionForStatus(task.projectId, body.status); if (section) placeTask(task, section, null, actor); else setStatus(task, body.status, actor); } task.updatedAt = nowIso(); logActivity(task, 'bulk_updated', actor.id); result.updatedIds.push(task.id); } catch (error) { result.failed.push({ id, code: error.code || 'change_failed' }); } }
      return result;
    }));
    app.post('/api/tasks/import', route((req, actor) => { const project = projectById(req.body.projectId); writable(project, actor); const section = db().sections.find(row => row.id === Number(req.body.sectionId)), rows = req.body.rows; if (!Array.isArray(rows) || rows.length > 200 || JSON.stringify(rows).length > 100000 || !section || section.projectId !== project.id || section.flag === 'archive') throw fail(422, 'invalid_import', 'Map up to two hundred rows to an active project section.'); const result = { importedIds: [], failed: [] }; rows.forEach((row, index) => { try { result.importedIds.push(createTask(project, section, row, actor).id); } catch (error) { result.failed.push({ row: index + 1, code: error.code || 'invalid_row' }); } }); return result; }));
  }
  return { metadata, patch, complete, routes, createTask };
}
module.exports = { create, PRESETS };
