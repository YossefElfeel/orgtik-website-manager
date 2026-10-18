// Configuration (company profile, attendance schedule, public holidays) and notifications.
module.exports = function miscRoutes(app, h) {
  const { db, V, C, L, ctx } = h;
  const { send, err } = L;

  // ---------------- settings ----------------
  app.get("/api/settings", (req, res) => send(res, db.settings, "Settings fetched"));

  app.put("/api/settings", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const b = h.body(req);
    const cp = b.companyProfile || {};
    const att = b.attendance || {};
    const sch = att.schedule || {};
    const next = {
      ...(db.settings.careers ? { careers: db.settings.careers } : {}),
      ...(db.settings.leavePolicy ? { leavePolicy: db.settings.leavePolicy } : {}),
      companyProfile: { ...db.settings.companyProfile, ...Object.fromEntries(Object.entries(cp).filter(([k]) => k !== "avatar")) },
      attendance: {
        schedule: { ...db.settings.attendance.schedule, ...sch },
        publicHolidays: Array.isArray(att.publicHolidays) ? att.publicHolidays : db.settings.attendance.publicHolidays,
      },
    };
    const s = next.attendance.schedule;
    if (!Array.isArray(s.workingDays) || !s.workingDays.length) return err(res, 400, "Select at least one working day.");
    s.workingDays = [...new Set(s.workingDays.map(Number).filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b);
    s.gracePeriodMinutes = Math.max(0, Number(s.gracePeriodMinutes) || 0);
    if (s.effectiveFrom && L.normDate(s.effectiveFrom)) s.effectiveFrom = L.toDmy(L.normDate(s.effectiveFrom));
    const holidays = [];
    for (const [i, hday] of next.attendance.publicHolidays.entries()) {
      const date = L.normDate(hday?.date);
      if (!hday?.name || !date) return err(res, 400, `Public holiday #${i + 1} needs a name and a valid date.`);
      holidays.push({ name: String(hday.name).trim(), date: L.toDmy(date), ...(hday.country ? { country: String(hday.country).toUpperCase().slice(0,3) } : {}) });
    }
    next.attendance.publicHolidays = holidays.sort((a, b) => (L.normDate(a.date) < L.normDate(b.date) ? -1 : 1));
    if (cp.companyName !== undefined) db.company.name = cp.companyName || db.company.name;
    if (cp.location !== undefined) db.company.address = cp.location || db.company.address;
    db.settings = next;
    C.reindex();
    h.log("updated", "Settings", 1, req.user.id, {});
    send(res, db.settings, "Settings updated successfully");
  });

  app.post("/api/settings/company-profile/avatar", ctx.upload.any(), (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const f = (req.files || [])[0];
    if (!f) return err(res, 400, "No logo file was uploaded (field name: avatar).");
    db.settings.companyProfile.avatar = ctx.fileUrl(f.filename);
    send(res, { url: db.settings.companyProfile.avatar, avatar: db.settings.companyProfile.avatar }, "Company logo uploaded successfully");
  });

  app.delete("/api/settings/company-profile/avatar", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    db.settings.companyProfile.avatar = null;
    send(res, null, "Company logo removed");
  });

  // ---------------- notifications ----------------
  const mine = (req) => db.notifications.rows.filter((n) => n.recipientUserId === req.user.id);
  app.get("/api/notifications", (req, res) => {
    const q = req.query;
    let list = mine(req);
    if (q.read !== undefined && q.read !== "") list = list.filter((n) => (L.bool(q.read) ? !!n.readAt : !n.readAt));
    if (q.priority) list = list.filter((n) => n.priority === q.priority);
    if (q.action) list = list.filter((n) => n.action === q.action);
    list = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id));
    const { items, meta } = L.pageOf(list, q, 20);
    send(res, { items: items.map(V.notificationView), meta }, "Notifications fetched");
  });
  app.get("/api/notifications/unread-count", (req, res) => send(res, { count: mine(req).filter((n) => !n.readAt).length }, "Unread count fetched"));
  app.patch("/api/notifications/read-all", (req, res) => {
    const now = L.nowIso();
    let updated = 0;
    for (const n of mine(req)) if (!n.readAt) { n.readAt = now; updated++; }
    send(res, { updated }, "All notifications marked as read");
  });
  app.patch("/api/notifications/:id/read", (req, res) => {
    const n = db.notifications.find(req.params.id);
    if (!n || n.recipientUserId !== req.user.id) return err(res, 404, "Notification not found");
    if (!n.readAt) n.readAt = L.nowIso();
    send(res, V.notificationView(n), "Notification marked as read");
  });
};
