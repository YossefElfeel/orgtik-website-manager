// HR tickets: support queue, "my tickets", threaded messages with attachments, assignment, status and activity.
module.exports = function ticketRoutes(app, h) {
  const { db, V, L } = h;
  const { send, err } = L;
  const STATUSES = ["open", "in-progress", "closed"];
  let attSeq = 900000;
  const toAttachment = (f) => ({ id: ++attSeq, ...h.fileMeta(f), uploadedAt: L.nowIso() });

  const parseIds = (v) => {
    if (v == null || v === "") return [];
    if (Array.isArray(v)) return v.flatMap(parseIds);
    const s = String(v).trim();
    if (s.startsWith("[")) { try { return JSON.parse(s).map(Number).filter(Boolean); } catch { return []; } }
    return s.split(",").map((x) => Number(x.trim())).filter(Boolean);
  };
  const canSee = (req, t) => V.has(req.user, "hr") || t.createdByUserId === req.user.id || (t.assignedUserIds || []).includes(req.user.id);
  const findTicket = (req, res) => {
    const t = db.tickets.find(req.params.id);
    if (!t || t.deletedAt) { err(res, 404, "Ticket not found"); return null; }
    if (!canSee(req, t)) { err(res, 403, "You don't have access to this ticket."); return null; }
    return t;
  };
  const filterList = (list, q) => {
    if (q.status && q.status !== "all") list = list.filter((t) => t.status === q.status);
    if (q.search) { const s = String(q.search).toLowerCase(); list = list.filter((t) => `${t.id} ${t.subject} ${V.fullName(V.empAny(t.createdByUserId))}`.toLowerCase().includes(s)); }
    return L.sortBy(list, q.sortBy || "createdAt", q.order || "DESC");
  };
  const live = () => db.tickets.rows.filter((t) => !t.deletedAt);

  app.get("/api/tickets/stats", (req, res) => {
    const list = V.has(req.user, "hr") ? live() : live().filter((t) => canSee(req, t));
    const now = Date.now();
    const inWeek = (iso, k) => { const t = new Date(iso).getTime(); return t > now - (k + 1) * 7 * 864e5 && t <= now - k * 7 * 864e5; };
    const closedAt = (t) => db.logs.rows.filter((l) => l.entityType === "Ticket" && l.entityId === String(t.id) && l.action === "TICKET_STATUS_UPDATED" && l.metadata?.newStatus === "closed").map((l) => l.createdAt).pop();
    const card = (key, label, value, prev, subtitleWord) => {
      const delta = value - prev;
      return { key, label, value, valueLabel: String(value), previousValue: prev, delta, deltaPercentage: prev ? Math.round((delta / prev) * 100) : value ? 100 : 0, trend: delta > 0 ? "up" : delta < 0 ? "down" : "flat", subtitle: `${delta >= 0 ? "+" : ""}${delta} ${subtitleWord} from last week` };
    };
    const created = (k) => list.filter((t) => inWeek(t.createdAt, k)).length;
    const solved = (k) => list.filter((t) => t.status === "closed" && closedAt(t) && inWeek(closedAt(t), k)).length;
    const open = list.filter((t) => t.status !== "closed").length;
    const openPrev = list.filter((t) => new Date(t.createdAt).getTime() <= now - 7 * 864e5 && (t.status !== "closed" || (closedAt(t) && new Date(closedAt(t)).getTime() > now - 7 * 864e5))).length;
    send(res, {
      cards: [
        card("newTickets", "New Tickets", created(0), created(1), "new"),
        card("openTickets", "Open Tickets", open, openPrev, "open"),
        card("solvedTickets", "Solved Tickets", list.filter((t) => t.status === "closed").length, list.filter((t) => t.status === "closed").length - solved(0), "solved"),
        card("totalTickets", "Total Tickets", list.length, list.length - created(0), "total"),
      ],
    }, "Ticket stats fetched");
  });

  // Support queue: HR sees everything, others see what is assigned to them.
  app.get("/api/tickets", (req, res) => {
    const list = V.has(req.user, "hr") ? live() : live().filter((t) => (t.assignedUserIds || []).includes(req.user.id));
    const { items, meta } = L.pageOf(filterList(list, req.query), req.query);
    send(res, { items: items.map(V.ticketItem), meta }, "Tickets fetched");
  });

  app.get("/api/tickets/my", (req, res) => {
    const list = live().filter((t) => t.createdByUserId === req.user.id);
    const { items, meta } = L.pageOf(filterList(list, req.query), req.query);
    send(res, { items: items.map(V.ticketItem), meta }, "My tickets fetched");
  });

  app.post("/api/tickets", h.anyFiles, (req, res) => {
    const b = h.body(req);
    const subject = String(b.subject || "").trim();
    if (!subject) return err(res, 400, "Subject is required.");
    const description = String(b.description || "").trim();
    if (!description) return err(res, 400, "Description is required.");
    const assigned = parseIds(b.assignedUserIds ?? b.assignTo).filter((id) => V.user(id));
    if (!assigned.length) return err(res, 400, "Assign the ticket to at least one person.");
    const attachments = (req.files || []).map(toAttachment);
    const t = db.tickets.insert({ subject, description, departmentId: b.departmentId ? Number(b.departmentId) : null, status: "open", createdByUserId: req.user.id, assignedUserIds: assigned, attachments, deletedAt: null });
    db.messages.insert({ ticketId: t.id, senderUserId: req.user.id, content: description, attachments });
    h.log("TICKET_CREATED", "Ticket", t.id, req.user.id, { departmentId: t.departmentId, status: "open" });
    h.log("TICKET_USERS_ASSIGNED", "Ticket", t.id, req.user.id, { assignedUserIds: assigned });
    h.notify({ to: assigned, actor: req.user.id, action: "ticket.assigned", title: "Ticket assigned to you", body: `#${t.id} ${subject}`, entityType: "Ticket", entityId: t.id });
    const e = V.empAny(req.user.id);
    if (e) e.lastMessaged = t.createdAt;
    send(res, V.ticketItem(t), `Ticket #${t.id} created successfully`, 201);
  });

  app.get("/api/tickets/:id", (req, res) => {
    const t = findTicket(req, res);
    if (t) send(res, V.ticketDetail(t), "Ticket fetched");
  });

  app.delete("/api/tickets/:id", (req, res) => {
    const t = findTicket(req, res);
    if (!t) return;
    if (!V.has(req.user, "hr") && t.createdByUserId !== req.user.id) return err(res, 403, "Only HR or the ticket creator can delete it.");
    t.deletedAt = L.nowIso();
    send(res, null, `Ticket #${t.id} deleted`);
  });

  app.patch("/api/tickets/:id/assign", (req, res) => {
    const t = findTicket(req, res);
    if (!t) return;
    const ids = parseIds(h.body(req).assignedUserIds).filter((id) => V.user(id));
    const before = new Set(t.assignedUserIds || []);
    const same = ids.length === before.size && ids.every((id) => before.has(id));
    if (!same) {
      t.assignedUserIds = ids;
      t.updatedAt = L.nowIso();
      h.log("TICKET_USERS_ASSIGNED", "Ticket", t.id, req.user.id, { assignedUserIds: ids });
      h.notify({ to: ids.filter((id) => !before.has(id)), actor: req.user.id, action: "ticket.assigned", title: "Ticket assigned to you", body: `#${t.id} ${t.subject}`, entityType: "Ticket", entityId: t.id });
    }
    send(res, V.ticketItem(t), same ? "Assignees unchanged" : "Ticket assignees updated");
  });

  app.patch("/api/tickets/:id/status", (req, res) => {
    const t = findTicket(req, res);
    if (!t) return;
    const status = h.body(req).status;
    if (!STATUSES.includes(status)) return err(res, 400, `Status must be one of ${STATUSES.join(", ")}`);
    if (status !== t.status) {
      const prev = t.status;
      t.status = status;
      t.updatedAt = L.nowIso();
      h.log("TICKET_STATUS_UPDATED", "Ticket", t.id, req.user.id, { previousStatus: prev, newStatus: status });
      h.notify({ to: [t.createdByUserId, ...(t.assignedUserIds || [])], actor: req.user.id, action: "ticket.status_updated", title: `Ticket #${t.id} is now ${status.replace("-", " ")}`, body: t.subject, entityType: "Ticket", entityId: t.id });
    }
    send(res, V.ticketItem(t), `Ticket status set to ${status.replace("-", " ")}`);
  });

  app.get("/api/tickets/:id/messages", (req, res) => {
    const t = findTicket(req, res);
    if (!t) return;
    const q = req.query;
    const list = L.sortBy(db.messages.rows.filter((m) => m.ticketId === t.id), "createdAt", String(q.order || "desc").toUpperCase());
    const { items, meta } = L.pageOf(list, q);
    send(res, { items: items.map(V.messageView), meta }, "Messages fetched");
  });

  app.post("/api/tickets/:id/messages", h.anyFiles, (req, res) => {
    const t = findTicket(req, res);
    if (!t) return;
    const content = String(h.body(req).content || "").trim();
    const attachments = (req.files || []).map(toAttachment);
    if (!content.replace(/<[^>]*>/g, "").trim() && !attachments.length) return err(res, 400, "Message content is required.");
    const m = db.messages.insert({ ticketId: t.id, senderUserId: req.user.id, content, attachments });
    t.updatedAt = m.createdAt;
    h.log("TICKET_MESSAGE_ADDED", "Ticket", t.id, req.user.id, { messageId: m.id, attachmentCount: attachments.length });
    h.notify({ to: [t.createdByUserId, ...(t.assignedUserIds || [])], actor: req.user.id, action: "ticket.replied", title: `Ticket #${t.id} updated`, body: `${req.user.firstName} ${req.user.lastName}: ${content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)}`, entityType: "Ticket", entityId: t.id });
    const e = V.empAny(req.user.id);
    if (e) e.lastMessaged = m.createdAt;
    send(res, V.messageView(m), "Message sent", 201);
  });

  app.get("/api/tickets/:id/activity-logs", (req, res) => {
    const t = findTicket(req, res);
    if (!t) return;
    const list = db.logs.rows.filter((l) => l.entityType === "Ticket" && l.entityId === String(t.id)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id));
    send(res, list.map((l) => V.activityView(l)), "Ticket activity fetched");
  });
};
