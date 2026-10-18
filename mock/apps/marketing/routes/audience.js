// Company audiences, segments, CSV contact imports, and messaging senders/templates (Email, SMS, WhatsApp).
const { send, error, newId, nowIso, paginate, textMatch, listParam, slugify } = require("../lib");

// Minimal RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF, ; or , delimiters, BOM).
function parseCsv(text) {
  const src = String(text || "").replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/)[0] || "";
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter((r) => r.some((x) => String(x).trim() !== ""));
  const headers = (clean.shift() || []).map((h, i) => String(h).trim() || `Column ${i + 1}`);
  const records = clean.map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? "").trim()])));
  return { headers, records };
}

module.exports = function audienceRoutes(app, { ctx, getDb, views, h }) {
  // ---------------------------------------------------------------- audiences
  app.get("/audiences", h.handle((req, res, u, project) => {
    const list = getDb().audiences.filter((a) => a.projectId === project.id && textMatch(req.query.q || req.query.search, a.name, a.description))
      .sort((a, b) => b.contactsCount - a.contactsCount);
    const { items, meta } = paginate(list, req.query, 50);
    send(res, { items: items.map(views.audienceView), meta }, "Audiences fetched successfully");
  }));

  // ---------------------------------------------------------------- segments
  app.get("/audiences/segments", h.handle((req, res, u, project) => {
    const audienceId = req.query.audienceId || null;
    const list = getDb().segments.filter((s) => s.projectId === project.id && (!audienceId || !s.audienceId || s.audienceId === audienceId) && textMatch(req.query.q || req.query.search, s.name, s.description))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const { items, meta } = paginate(list, req.query, 50);
    send(res, { items: items.map((s) => views.segmentView(s, audienceId)), meta }, "Segments fetched successfully");
  }));

  const cleanRules = (r = {}) => ({
    ...(r.source ? { source: String(r.source).trim() } : {}), ...(r.type ? { type: String(r.type).trim() } : {}),
    ...(r.interest ? { interest: String(r.interest).trim() } : {}), ...(r.qualifiedOnly ? { qualifiedOnly: true } : {}),
  });

  app.post("/audiences/segments", h.handle((req, res, u, project) => {
    const name = String(req.body?.name || "").trim();
    if (!name) return error(res, 422, "Segment name is required", { errors: { name: ["Segment name is required"] } });
    const s = { id: newId(), projectId: project.id, audienceId: req.body?.audienceId || null, name, description: req.body?.description?.trim() || null, rules: cleanRules(req.body?.rules), createdAt: nowIso(), updatedAt: nowIso() };
    getDb().segments.push(s);
    send(res, views.segmentView(s), "Segment created successfully", 201);
  }));

  app.patch("/audiences/segments/:id", h.handle((req, res, u, project) => {
    const s = getDb().segments.find((x) => x.id === req.params.id && x.projectId === project.id);
    if (!s) return h.notFound(res, "Segment");
    if (req.body?.name !== undefined) s.name = String(req.body.name).trim() || s.name;
    if (req.body?.description !== undefined) s.description = String(req.body.description || "").trim() || null;
    if (req.body?.rules !== undefined) s.rules = cleanRules(req.body.rules);
    s.updatedAt = nowIso();
    send(res, views.segmentView(s), "Segment updated successfully");
  }));

  app.delete("/audiences/segments/:id", h.handle((req, res, u, project) => {
    const db = getDb();
    const s = db.segments.find((x) => x.id === req.params.id && x.projectId === project.id);
    if (!s) return h.notFound(res, "Segment");
    db.segments = db.segments.filter((x) => x.id !== s.id);
    send(res, { id: s.id }, "Segment deleted successfully");
  }));

  // Historical imports remain readable; current master contacts are owned by CRM.
  app.post("/audiences/imports", h.handle((_req,res)=>res.status(410).json({success:false,code:"managed_in_crm",path:"/our-audience/contacts",message:"Choose canonical CRM contact references."}),{needsProject:false}));
  app.post("/audiences/imports/:id/commit", h.handle((_req,res)=>res.status(410).json({success:false,code:"managed_in_crm",path:"/our-audience/contacts",message:"Choose canonical CRM contact references."}),{needsProject:false}));
  // ---------------------------------------------------------------- CSV imports
  app.get("/audiences/imports/:id", h.handle((req, res, u, project) => {
    const imp = getDb().imports.find((x) => x.id === req.params.id && x.projectId === project.id);
    if (!imp) return h.notFound(res, "Import");
    send(res, { id: imp.id, fileName: imp.fileName, headers: imp.headers, preview: (imp.rows || []).slice(0, 5), totalRows: imp.totalRows, status: imp.status, savedAudienceId: imp.savedAudienceId }, "Import fetched successfully");
  }));

  app.get("/audiences/:id", h.handle((req, res, u, project) => {
    const a = getDb().audiences.find((x) => x.id === req.params.id && x.projectId === project.id);
    if (!a) return h.notFound(res, "Audience");
    send(res, views.audienceView(a), "Audience fetched successfully");
  }));

  // ---------------------------------------------------------------- messaging senders & templates
  const inScope = (x, project) => !x.projectId || x.projectId === project.id;

  app.get("/messaging/sender-configs", h.handle((req, res, u, project) => {
    const channel = req.query.channel ? String(req.query.channel).toUpperCase() : null;
    const list = getDb().senders.filter((s) => inScope(s, project) && (!channel || s.channel === channel) && textMatch(req.query.q, s.name, JSON.stringify(s.configuration)));
    const { items, meta } = paginate(list, req.query, 50);
    send(res, { items: items.map(views.senderView), meta }, "Sender configurations fetched successfully");
  }));

  app.get("/messaging/templates", h.handle((req, res, u, project) => {
    const channel = req.query.channel ? String(req.query.channel).toUpperCase() : null;
    const list = getDb().templates.filter((t) => inScope(t, project) && (!channel || t.channel === channel) && textMatch(req.query.q, t.name, t.subject, t.body))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const { items, meta } = paginate(list, req.query, 50);
    send(res, { items: items.map(views.templateView), meta }, "Templates fetched successfully");
  }));

  app.post("/messaging/templates", h.handle((req, res, u, project) => {
    const b = req.body || {};
    const db = getDb();
    const channel = String(b.channel || "").toUpperCase();
    if (!["EMAIL", "SMS", "WHATSAPP"].includes(channel)) return error(res, 422, "channel must be EMAIL, SMS or WHATSAPP");
    const name = String(b.name || "").trim();
    const body = String(b.body || "").trim();
    if (!name || !body) return error(res, 422, "Template name and body are required");
    const sender = b.senderConfigId ? db.senders.find((s) => s.id === b.senderConfigId && inScope(s, project)) : db.senders.find((s) => s.channel === channel && inScope(s, project) && s.isActive);
    if (!sender) return error(res, 422, "Choose a sender for this template");
    if (sender.channel !== channel) return error(res, 422, `The selected sender is not a ${channel} sender`);
    if (channel === "SMS" && body.length > 612) return error(res, 422, "SMS templates are limited to 612 characters (4 segments)");
    const found = (`${b.subject || ""} ${body}`.match(/\{\{\s*([\w.-]+)\s*\}\}/g) || []).map((m) => m.replace(/[{}\s]/g, ""));
    const t = {
      id: newId(), projectId: project.id, channel, senderConfigId: sender.id, name, subject: channel === "EMAIL" ? String(b.subject || "").trim() || null : null, body,
      variables: [...new Set([...(listParam(b.variables)), ...found])],
      providerData: channel === "WHATSAPP" ? { status: "APPROVED", category: "MARKETING", language: /[؀-ۿ]/.test(body) ? "ar" : "en", templateName: slugify(name).replace(/-/g, "_"), ...(b.providerData || {}) } : { ...(b.providerData || {}) },
      isActive: true, createdByUserId: u.id, createdAt: nowIso(), updatedAt: nowIso(),
    };
    db.templates.push(t);
    send(res, views.templateView(t), "Template created successfully", 201);
  }));
};

module.exports.parseCsv = parseCsv;
