// Hiring: job openings, applications (candidates) by stage, interviews, notes, overview & interview calendar.
module.exports = function recruitmentRoutes(app, h) {
  const { db, V, L } = h;
  const { send, err } = L;
  const STAGES = ["applying", "screening", "interview", "hiring", "accepted", "rejected", "offer", "hired"];
  const JOB_STATUSES = ["opened", "on_hold", "closed", "cancelled"];
  const activeJobs = () => db.jobs.rows.filter((j) => !j.deletedAt);
  const activeApps = () => db.applications.rows.filter((a) => !a.deletedAt && db.jobs.find(a.jobId) && !db.jobs.find(a.jobId).deletedAt);
  const findJob = (req, res) => { const j = db.jobs.find(req.params.id); if (!j || j.deletedAt) { err(res, 404, "Job not found"); return null; } return j; };
  const findApp = (req, res, key = "id") => { const a = db.applications.find(req.params[key]); if (!a || a.deletedAt) { err(res, 404, "Application not found"); return null; } return a; };

  const periodDays = (p) => (p === "day" ? 1 : p === "month" ? 30 : 7);
  function overview(period) {
    const n = periodDays(period);
    const now = Date.now();
    const inWin = (iso, k) => { if (!iso) return false; const t = new Date(iso).getTime(); return t > now - (k + 1) * n * 864e5 && t <= now - k * n * 864e5; };
    const change = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : cur ? 100 : 0);
    const apps = activeApps();
    const stageAt = (st, k) => db.stages.rows.filter((s) => s.stage === st && inWin(s.stageAt, k) && apps.some((a) => a.id === s.applicationId)).length;
    const appts = (k) => db.appointments.rows.filter((a) => !a.deletedAt && inWin(a.startAt, k)).length;
    const posted = (k) => activeJobs().filter((j) => inWin(j.createdAt, k)).length;
    const applied = (k) => apps.filter((a) => inWin(a.appliedAt, k)).length;
    const open = activeJobs().filter((j) => j.status === "opened").length;
    return {
      openJobs: { count: open, percentageChange: change(posted(0), posted(1)) },
      totalApplications: { count: applied(0), percentageChange: change(applied(0), applied(1)) },
      totalInterviews: { count: appts(0), percentageChange: change(appts(0), appts(1)) },
      rejected: { count: stageAt("rejected", 0), percentageChange: change(stageAt("rejected", 0), stageAt("rejected", 1)) },
      accepted: { count: stageAt("accepted", 0) + stageAt("hired", 0), percentageChange: change(stageAt("accepted", 0) + stageAt("hired", 0), stageAt("accepted", 1) + stageAt("hired", 1)) },
      period: period || "week",
    };
  }

  // ---------------- jobs ----------------
  app.get("/api/recruitment/jobs/overview", (req, res) => send(res, overview(req.query.period || "week"), "Hiring overview fetched"));

  app.get("/api/recruitment/jobs/applications", (req, res) => {
    const q = req.query;
    let list = activeApps();
    const stage = q.currentStage || q.status || q.stage;
    if (stage && stage !== "all") list = list.filter((a) => a.currentStage === stage);
    if (q.jobId) list = list.filter((a) => String(a.jobId) === String(q.jobId));
    if (q.search) { const s = String(q.search).toLowerCase(); list = list.filter((a) => `${a.fullName} ${a.email}`.toLowerCase().includes(s)); }
    list = L.sortBy(list, q.sortBy || "appliedAt", q.order || "DESC");
    const { items, meta } = L.pageOf(list, q);
    send(res, { items: items.map(V.applicationView), meta }, "Applications fetched");
  });

  app.get("/api/recruitment/jobs", (req, res) => {
    const q = req.query;
    let list = activeJobs();
    if (q.status && q.status !== "all") list = list.filter((j) => j.status === q.status);
    if (q.departmentId) list = list.filter((j) => String(j.departmentId) === String(q.departmentId));
    if (q.search) { const s = String(q.search).toLowerCase(); list = list.filter((j) => j.title.toLowerCase().includes(s)); }
    list = L.sortBy(list, q.sortBy || "createdAt", q.order || "DESC");
    const { items, meta } = L.pageOf(list, q);
    send(res, { items: items.map(V.jobView), meta }, "Jobs fetched");
  });

  function jobFields(b, prev = {}) {
    const out = {};
    const set = (k, v) => { if (v !== undefined) out[k] = v; };
    set("title", b.title != null ? String(b.title).trim() : undefined);
    set("jobType", b.jobType);
    set("jobMode", b.jobMode);
    if (b.status !== undefined) { if (!JOB_STATUSES.includes(b.status)) throw new Error(`Status must be one of ${JOB_STATUSES.join(", ")}`); out.status = b.status; }
    if (b.departmentId !== undefined) { if (!V.dept(Number(b.departmentId))) throw new Error("Department not found"); out.departmentId = Number(b.departmentId); }
    set("location", b.location);
    set("experienceLevel", b.experienceLevel);
    set("requiredExperience", b.requiredExperience);
    set("jobPostDate", b.jobPostDate ? L.normDate(b.jobPostDate) : undefined);
    set("startDate", b.startDate ? L.normDate(b.startDate) : undefined);
    if (b.untilClosed !== undefined) out.untilClosed = !!b.untilClosed;
    if (b.endDate !== undefined || out.untilClosed) out.endDate = out.untilClosed ? null : b.endDate ? L.normDate(b.endDate) : prev.endDate ?? null;
    set("currencyType", b.currencyType);
    if (b.salaryMin !== undefined) out.salaryMin = Number(b.salaryMin).toFixed(2);
    if (b.salaryMax !== undefined) out.salaryMax = Number(b.salaryMax).toFixed(2);
    for (const k of ["bonusAvailability", "healthInsurance", "paidTimeOff"]) if (b[k] !== undefined) out[k] = !!b[k];
    set("aboutCompanyDescription", b.aboutCompanyDescription);
    set("jobRequirements", b.jobRequirements);
    if (b.jobSkills !== undefined) out.jobSkills = [].concat(b.jobSkills);
    return out;
  }

  app.post("/api/recruitment/jobs", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const b = h.body(req);
    if (!b.title || !b.departmentId) return err(res, 400, "Job title and department are required.");
    let fields;
    try { fields = jobFields({ status: "opened", jobPostDate: L.todayStr(), currencyType: "EGP", jobSkills: [], ...b }); } catch (e) { return err(res, 400, e.message); }
    if (Number(fields.salaryMin) > Number(fields.salaryMax)) return err(res, 400, "Minimum salary can't be greater than the maximum salary.");
    const j = db.jobs.insert({ untilClosed: false, endDate: null, bonusAvailability: false, healthInsurance: false, paidTimeOff: false, ...fields, createdBy: String(req.user.id), updatedBy: String(req.user.id), deletedAt: null });
    h.log("posted", "Job", j.id, req.user.id, { title: j.title });
    send(res, V.jobView(j), `Job "${j.title}" created successfully`, 201);
  });

  app.get("/api/recruitment/jobs/:id", (req, res) => {
    const j = findJob(req, res);
    if (j) send(res, V.jobView(j), "Job fetched");
  });

  app.put("/api/recruitment/jobs/:id", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const j = findJob(req, res);
    if (!j) return;
    let fields;
    try { fields = jobFields(h.body(req), j); } catch (e) { return err(res, 400, e.message); }
    db.jobs.update(j.id, { ...fields, updatedBy: String(req.user.id) });
    h.log(fields.status ? `changed status to ${fields.status} on` : "updated", "Job", j.id, req.user.id, {});
    send(res, V.jobView(j), fields.status && Object.keys(fields).length === 1 ? `Job status changed to ${fields.status.replace("_", " ")}` : "Job updated successfully");
  });

  app.delete("/api/recruitment/jobs/:id", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const j = findJob(req, res);
    if (!j) return;
    j.deletedAt = L.nowIso();
    h.log("deleted", "Job", j.id, req.user.id, {});
    send(res, null, "Job offer deleted successfully");
  });

  app.get("/api/recruitment/jobs/:id/applications", (req, res) => {
    const j = findJob(req, res);
    if (!j) return;
    const q = req.query;
    let list = activeApps().filter((a) => a.jobId === j.id);
    if (q.currentStage) list = list.filter((a) => a.currentStage === q.currentStage);
    list = L.sortBy(list, "appliedAt", "DESC");
    const { items, meta } = L.pageOf(list, q);
    send(res, { items: items.map(V.applicationView), meta }, "Applications fetched");
  });

  // Public-style apply endpoint (multipart: resume/cv/file + fields) so CV uploads can be exercised.
  const apply = (req,res) => { try {const a=require('../application').createApplication(h,req.params.id,h.body(req),{file:(req.files||[])[0]||null});send(res,V.applicationView(a),'Application submitted successfully',201);}catch(error){res.status(error.status||500).json({success:false,code:error.code||'application_unavailable',message:error.message});} };
  app.post("/api/recruitment/jobs/:id/applications", h.anyFiles, apply);
  app.post("/api/recruitment/jobs/:id/apply", h.anyFiles, apply);

  // ---------------- applications ----------------
  app.get("/api/recruitment/applications/:id", (req, res) => {
    const a = findApp(req, res);
    if (a) send(res, V.applicationView(a), "Application fetched");
  });

  app.get("/api/recruitment/applications/:id/notes", (req, res) => {
    const a = findApp(req, res);
    if (!a) return;
    send(res, db.appNotes.rows.filter((n) => n.applicationId === a.id && !n.deletedAt).sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1)).map(V.appNoteView), "Notes fetched");
  });

  app.post("/api/recruitment/applications/:id/notes", (req, res) => {
    if (!h.guard(req, res, "hr", "manager")) return;
    const a = findApp(req, res);
    if (!a) return;
    const note = String(h.body(req).note || "").trim();
    if (!note) return err(res, 400, "Note is required.");
    const n = db.appNotes.insert({ applicationId: a.id, authorUserId: String(req.user.id), authorName: `${req.user.firstName} ${req.user.lastName}`, note, deletedAt: null });
    send(res, V.appNoteView(n), "Note added", 201);
  });

  app.post("/api/recruitment/applications/:id/interviews", (req, res) => {
    if (!h.guard(req, res, "hr", "manager")) return;
    const a = findApp(req, res);
    if (!a) return;
    const b = h.body(req);
    const start = new Date(b.startAt), end = new Date(b.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return err(res, 400, "Start and end time are required.");
    if (end <= start) return err(res, 400, "End time must be after the start time.");
    if (!b.interviewWith) return err(res, 400, "Interviewer is required.");
    const appt = db.appointments.insert({ applicationId: a.id, startAt: start.toISOString(), endAt: end.toISOString(), interviewWith: b.interviewWith, interviewLink: b.interviewLink || "", note: b.note || "", createdBy: String(req.user.id), deletedAt: null });
    if (["applying", "screening"].includes(a.currentStage)) {
      const now = L.nowIso();
      db.stages.insert({ applicationId: a.id, stage: "interview", stageAt: now, note: "Interview scheduled", updatedBy: String(req.user.id) });
      Object.assign(a, { currentStage: "interview", stageUpdatedAt: now, updatedAt: now });
    }
    const job = db.jobs.find(a.jobId);
    h.log("scheduled an interview for", "JobApplication", a.id, req.user.id, { startAt: appt.startAt });
    h.notify({ to: h.usersWithRole("hr"), actor: req.user.id, action: "interview.scheduled", title: "Interview scheduled", body: `${a.fullName} - ${job?.title || "job"} on ${L.dateOf(appt.startAt)} at ${L.hhmm(appt.startAt)} with ${appt.interviewWith}.`, entityType: "InterviewAppointment", entityId: appt.id });
    send(res, { id: appt.id, applicationId: a.id, startAt: appt.startAt, endAt: appt.endAt, interviewWith: appt.interviewWith, interviewLink: appt.interviewLink, note: appt.note, createdBy: Number(appt.createdBy), createdAt: appt.createdAt }, "Interview scheduled successfully", 201);
  });

  app.patch("/api/recruitment/applications/:id/stage", (req, res) => {
    if (!h.guard(req, res, "hr", "manager")) return;
    const a = findApp(req, res);
    if (!a) return;
    const b = h.body(req);
    if (!STAGES.includes(b.stage)) return err(res, 400, `Stage must be one of ${STAGES.join(", ")}`);
    if (b.stage === a.currentStage) return err(res, 400, `The candidate is already in the ${b.stage} stage.`);
    const when = b.stageAt && !Number.isNaN(new Date(b.stageAt).getTime()) ? new Date(b.stageAt).toISOString() : L.nowIso();
    db.stages.insert({ applicationId: a.id, stage: b.stage, stageAt: when, note: b.note || "", updatedBy: String(req.user.id) });
    Object.assign(a, { currentStage: b.stage, stageUpdatedAt: when, updatedAt: L.nowIso() });
    h.log(`moved to ${b.stage}`, "JobApplication", a.id, req.user.id, { stage: b.stage });
    send(res, V.applicationView(a), `${a.fullName} moved to ${b.stage}`);
  });

  app.get("/api/recruitment/interviews/calendar", (req, res) => {
    const period = req.query.period || "week";
    const today = L.todayStr();
    let from = today, to = today;
    if (period === "week") { from = L.weekStartSun(today); to = L.addDays(from, 6); }
    if (period === "month") { from = L.weekStartSun(L.monthStart(today)); to = L.addDays(L.weekStartSun(L.monthEnd(today)), 6); }
    const list = db.appointments.rows.filter((a) => !a.deletedAt && db.applications.find(a.applicationId) && !db.applications.find(a.applicationId).deletedAt).filter((a) => { const d = L.dateOf(a.startAt); return d >= from && d <= to; }).sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
    send(res, list.map((a) => ({ id: a.id, applicationId: a.applicationId, startAt: a.startAt, endAt: a.endAt, interviewWith: a.interviewWith, interviewLink: a.interviewLink, note: a.note, createdBy: Number(a.createdBy), createdAt: a.createdAt, candidate: { fullName: db.applications.find(a.applicationId).fullName } })), "Interview calendar fetched");
  });
};
