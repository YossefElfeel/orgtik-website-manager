// Seed data for the Orgtik File Manager mock (fictional). Dates are relative to server start.
// `days` = how long ago (fractions allowed). `size` = nominal size shown in the UI (the bytes served are
// the small generated asset in ./assets). People are identity user keys (see local-dev/lib/identity.js).
const crypto = require("crypto");
const { seedId, parseSize, newId } = require("./lib");

const TREE = [
  {
    key: "contracts", name: "Contracts", owner: "manager", visibility: "specific_people", people: ["admin", "finance", "sales", "u13"],
    days: 221, pinnedBy: ["admin", "manager"],
    files: [{ asset: "xlsx_contract_tracker", name: "Contract Tracker 2026.xlsx", owner: "manager", size: "212 KB", days: 3 }],
    children: [
      {
        key: "contracts-clients", name: "Client Agreements", days: 205,
        files: [
          { asset: "pdf_msa_nilefoods", name: "Nile Foods - Master Service Agreement 2026.pdf", owner: "sales", size: "1.8 MB", days: 47,
            used: { by: "sales", days: 45, note: "Signed by both parties on 14 Aug 2026 - original filed with Legal." } },
          { asset: "pdf_sla_gulf", name: "Gulf Retail Co - SLA Addendum.pdf", owner: "u13", size: "640 KB", days: 21 },
          { asset: "pdf_delta_ar", name: "عقد توريد - شركة الدلتا.pdf", owner: "manager", size: "1.1 MB", days: 9 },
        ],
      },
      {
        key: "contracts-vendors", name: "Vendor Contracts", days: 190,
        files: [{ asset: "pdf_lease", name: "Office Lease - New Cairo HQ.pdf", owner: "manager", size: "2.6 MB", days: 118,
          used: { by: "manager", days: 110, note: "Lease registered at the real estate registry office." } }],
      },
      {
        key: "contracts-ndas", name: "NDAs", days: 150,
        files: [{ asset: "docx_nda_riyadh", name: "NDA - Riyadh Logistics.docx", owner: "sales", size: "86 KB", days: 12,
          history: [{ action: "renamed", days: 11.8, by: "sales", from: "Riyadh Logistics NDA v2.docx" }] }],
      },
    ],
  },
  {
    key: "marketing", name: "Marketing Assets", owner: "u12", visibility: "everyone", days: 410, pinnedBy: ["admin", "u12", "u14"],
    children: [
      {
        key: "mkt-brand", name: "Brand Kit", days: 236,
        files: [
          { asset: "svg_logo_full", name: "Orgtik Logo - Full.svg", owner: "u12", days: 236 },
          { asset: "png_logo_icon", name: "Orgtik Icon.png", owner: "u12", days: 236 },
          { asset: "pdf_brand_guidelines", name: "Brand Guidelines 2026.pdf", owner: "u12", size: "4.8 MB", days: 62,
            used: { by: "u12", days: 60, note: "Shared with the print vendor and the web agency." } },
          { asset: "png_old_logo", name: "Old Logo Concept.png", owner: "u12", size: "310 KB", days: 200, archived: { days: 18, by: "u12" } },
        ],
      },
      {
        key: "mkt-social", name: "Social Media", days: 181,
        files: [
          { asset: "xlsx_campaign_calendar", name: "Q4 Campaign Calendar.xlsx", owner: "u12", size: "146 KB", days: 6 },
          { asset: "png_insta_post", name: "Product Launch - Instagram Post.png", owner: "u12", size: "1.2 MB", days: 8,
            used: { by: "u12", days: 7, note: "Published on Instagram and Facebook on 22 Sep." },
            history: [{ action: "renamed", days: 7.9, by: "u12", from: "IG post final FINAL.png" }] },
          { asset: "png_linkedin_banner", name: "LinkedIn Cover - Orgtik.png", owner: "u14", size: "890 KB", days: 15 },
          { asset: "mp4_ramadan_teaser", name: "Ramadan 2027 Teaser.mp4", owner: "u12", size: "38.4 MB", days: 1 },
        ],
      },
      {
        key: "mkt-campaigns", name: "Campaigns", days: 160,
        children: [{
          key: "mkt-expo", name: "Riyadh Expo 2026", days: 92,
          files: [
            { asset: "png_booth", name: "Booth Design - Final.png", owner: "u8", size: "2.3 MB", days: 26,
              history: [{ action: "moved", days: 25, by: "u8", fromName: "Product Designs" }] },
            { asset: "pdf_expo_brochure", name: "Expo Brochure.pdf", owner: "u12", size: "3.1 MB", days: 24 },
          ],
        }],
      },
      {
        key: "mkt-old", name: "Old Campaigns 2025", days: 400, archived: { days: 12, by: "u12" },
        files: [
          { asset: "png_summer_banner", name: "Summer Sale 2025 - Banner.png", owner: "u12", size: "1.4 MB", days: 395 },
          { asset: "xlsx_campaign_results_2025", name: "Campaign Results 2025.xlsx", owner: "u12", size: "98 KB", days: 270 },
        ],
      },
    ],
  },
  {
    key: "invoices", name: "Invoices 2026", owner: "finance", visibility: "specific_people", people: ["admin", "u16", "manager"],
    days: 272, pinnedBy: ["finance", "u16", "admin"],
    files: [{ asset: "csv_invoice_register", name: "Invoice Register 2026.csv", owner: "u16", size: "38 KB", days: 0.2 }],
    children: [
      { key: "inv-q1", name: "Q1", days: 272 },
      {
        key: "inv-q2", name: "Q2", days: 181,
        files: [
          { asset: "pdf_inv_0098", name: "INV-2026-0098 - Nile Foods.pdf", owner: "finance", size: "412 KB", days: 124,
            used: { by: "finance", days: 95, note: "Paid in full - bank ref TRX-86120." } },
          { asset: "pdf_vat_q2", name: "VAT Return Q2 2026.pdf", owner: "u16", size: "520 KB", days: 66 },
        ],
      },
      {
        key: "inv-q3", name: "Q3", days: 90,
        files: [
          { asset: "pdf_inv_0142", name: "INV-2026-0142 - Nile Foods.pdf", owner: "finance", size: "418 KB", days: 57,
            used: { by: "finance", days: 27, note: "Paid on 3 Aug - reconciled." } },
          { asset: "pdf_inv_0157", name: "INV-2026-0157 - Riyadh Logistics.pdf", owner: "u16", size: "402 KB", days: 28 },
          { asset: "xlsx_reconciliation", name: "Payment Reconciliation - Aug 2026.xlsx", owner: "u16", size: "164 KB", days: 26 },
        ],
      },
      {
        key: "inv-drafts", name: "Drafts", days: 40, archived: { days: 5, by: "finance" },
        files: [{ asset: "pdf_inv_draft", name: "INV-2026-0160 - DRAFT.pdf", owner: "finance", size: "396 KB", days: 11 }],
      },
    ],
  },
  {
    key: "hr", name: "HR Documents", owner: "u10", visibility: "specific_people", people: ["admin", "manager"], days: 420, pinnedBy: ["u10", "manager"],
    children: [
      {
        key: "hr-policies", name: "Policies", days: 420,
        files: [
          { asset: "pdf_handbook", name: "Employee Handbook 2026.pdf", owner: "u10", size: "3.4 MB", days: 272,
            used: { by: "u10", days: 270, note: "Sent to all staff with the January payroll." } },
          { asset: "docx_leave_policy_ar", name: "سياسة الإجازات 2026.docx", owner: "u10", size: "74 KB", days: 38 },
          { asset: "pdf_handbook_old", name: "Employee Handbook 2025.pdf", owner: "u10", size: "2.9 MB", days: 400, archived: { days: 20, by: "u10" } },
        ],
      },
      {
        key: "hr-onboarding", name: "Onboarding", days: 210,
        files: [
          { asset: "docx_onboarding", name: "Onboarding Checklist.docx", owner: "u10", size: "58 KB", days: 34 },
          { asset: "pptx_welcome", name: "Welcome to Orgtik.pptx", owner: "u10", size: "6.2 MB", days: 33 },
        ],
      },
      {
        key: "hr-payroll", name: "Payroll", days: 180,
        files: [{ asset: "xlsx_payroll", name: "Payroll Summary - Sep 2026.xlsx", owner: "u10", size: "118 KB", days: 2 }],
      },
    ],
  },
  {
    key: "designs", name: "Product Designs", owner: "u8", visibility: "specific_people", people: ["employee", "u7", "u9", "u15", "admin"],
    days: 150, pinnedBy: ["u8", "employee", "admin"],
    files: [{ asset: "zip_icons", name: "Icon Set v2.zip", owner: "employee", size: "4.6 MB", days: 19 }],
    children: [
      {
        key: "designs-mobile", name: "Mobile App v3", days: 122,
        files: [
          { asset: "png_app_home", name: "Home Screen.png", owner: "u8", size: "1.6 MB", days: 16 },
          { asset: "png_app_checkout", name: "Checkout Flow.png", owner: "u8", size: "1.9 MB", days: 14 },
          { asset: "mp4_app_walkthrough", name: "App Prototype Walkthrough.mp4", owner: "u8", size: "24.7 MB", days: 10 },
          { asset: "pdf_handoff", name: "Design Handoff Notes.pdf", owner: "u8", size: "780 KB", days: 13,
            used: { by: "employee", days: 9, note: "Implemented in release 3.2." } },
        ],
      },
      {
        key: "designs-dashboard", name: "Dashboard Redesign", days: 72,
        files: [
          { asset: "png_dashboard_dark", name: "Dashboard - Dark Mode.png", owner: "u8", size: "2.1 MB", days: 5 },
          { asset: "fig_components", name: "Components Library.fig", owner: "u8", size: "48.2 MB", days: 4 },
        ],
      },
    ],
  },
  {
    key: "nilefoods", name: "Client — Nile Foods", owner: "sales", visibility: "specific_people", people: ["customer", "u13", "u12", "admin"],
    days: 260, pinnedBy: ["sales", "customer", "u13"],
    files: [
      { asset: "pdf_proposal_nilefoods", name: "Proposal - Nile Foods Digital Growth.pdf", owner: "sales", size: "2.2 MB", days: 19,
        used: { by: "sales", days: 18.9, note: "Sent to Nour Khaled on 10 Sep for review." } },
      { asset: "docx_campaign_brief", name: "Campaign Brief - Q4 2026.docx", owner: "u12", size: "92 KB", days: 13 },
      { asset: "txt_meeting_notes", name: "Meeting Notes - 2026-09-14.txt", owner: "u13", size: "4 KB", days: 15 },
      { asset: "csv_ad_performance", name: "Ad Performance - September.csv", owner: "u12", size: "22 KB", days: 3 },
      { asset: "zip_nile_logo", name: "Nile Foods Logo Pack.zip", owner: "customer", size: "3.8 MB", days: 30 },
    ],
    children: [{
      key: "nilefoods-photos", name: "Product Photos", days: 40,
      files: [
        { asset: "jpg_mango", name: "Mango Juice 1L.jpg", owner: "customer", size: "2.7 MB", days: 6 },
        { asset: "jpg_family_pack", name: "Family Pack 4x1L.jpg", owner: "customer", size: "3.1 MB", days: 6 },
      ],
    }],
  },
  {
    key: "engineering", name: "Engineering", owner: "u15", visibility: "specific_people", people: ["employee", "u7", "u9", "u11", "admin"],
    days: 380, pinnedBy: ["u15", "employee", "u7"],
    files: [
      { asset: "pdf_architecture", name: "Architecture Overview.pdf", owner: "u7", size: "1.3 MB", days: 44 },
      { asset: "txt_release_notes", name: "Release Notes v3.2.txt", owner: "employee", size: "3 KB", days: 14 },
      { asset: "xlsx_infra_costs", name: "Infrastructure Costs 2026.xlsx", owner: "u11", size: "88 KB", days: 7 },
    ],
    children: [
      { key: "eng-sprints", name: "Sprint Reports", days: 280, files: [{ asset: "docx_sprint18", name: "Sprint 18 Report.docx", owner: "u15", size: "64 KB", days: 15 }] },
      { key: "eng-runbooks", name: "Runbooks", days: 200, files: [{ asset: "docx_runbook", name: "Deployment Runbook.docx", owner: "u11", size: "71 KB", days: 22 }] },
    ],
  },
  {
    key: "sales", name: "Sales & Proposals", owner: "sales", visibility: "everyone", days: 390, pinnedBy: ["sales", "u13"],
    files: [
      { asset: "pdf_company_profile", name: "Orgtik Company Profile 2026.pdf", owner: "sales", size: "5.6 MB", days: 80,
        used: { by: "sales", days: 70, note: "Approved for the website and the Riyadh Expo booth." } },
      { asset: "xlsx_pricing", name: "Pricing Sheet - GCC 2026.xlsx", owner: "sales", size: "132 KB", days: 40 },
      { asset: "csv_pipeline", name: "Sales Pipeline Q3.csv", owner: "u13", size: "12 KB", days: 2 },
      { asset: "pptx_sales_kickoff", name: "Sales Kickoff 2026.pptx", owner: "sales", size: "12.4 MB", days: 250 },
      { asset: "mp4_product_demo", name: "Product Demo - Orgtik Analytics.mp4", owner: "sales", size: "31.9 MB", days: 17 },
      { asset: "xlsx_pricing_draft", name: "Pricing v1 - Draft.xlsx", owner: "sales", size: "54 KB", days: 60, archived: { days: 30, by: "sales" } },
    ],
  },
  {
    key: "board", name: "Board Meetings", owner: "admin", visibility: "specific_people", people: ["manager", "finance"], days: 300, pinnedBy: ["admin"],
    files: [
      { asset: "pdf_board_deck", name: "Board Deck - Q3 2026.pdf", owner: "admin", size: "8.7 MB", days: 4 },
      { asset: "docx_minutes_aug", name: "Minutes - August 2026.docx", owner: "admin", size: "48 KB", days: 31,
        history: [{ action: "renamed", days: 30.9, by: "admin", from: "Board minutes 27-08.docx" }] },
    ],
  },
  {
    key: "salma", name: "Salma's Workspace", owner: "employee", visibility: "only_me", days: 95, pinnedBy: ["employee"],
    files: [
      { asset: "txt_personal_notes", name: "Personal Notes.txt", owner: "employee", size: "2 KB", days: 0.1 },
      { asset: "png_screenshot", name: "Screenshot 2026-09-20 at 10.14.png", owner: "employee", size: "684 KB", days: 9 },
    ],
  },
  {
    key: "archive-2024", name: "Archive - 2024 Contracts", owner: "manager", visibility: "specific_people", people: ["admin", "finance"],
    days: 500, archived: { days: 45, by: "manager" },
    files: [{ asset: "pdf_old_vendor", name: "Cleaning Services Agreement 2024.pdf", owner: "manager", size: "350 KB", days: 480 }],
  },
];

const ROOT_FILES = [
  { asset: "pdf_exec_summary", name: "Q3 2026 Executive Summary.pdf", owner: "admin", size: "1.2 MB", days: 0.3 },
  { asset: "jpg_team_iftar", name: "Team Iftar 2026.jpg", owner: "u10", size: "3.3 MB", days: 190 },
];

// External share links. Secrets are deterministic so the URLs below always work (printed on start).
const SHARES = [
  { id: "5f1c7a52-9d0e-4b6a-8e1f-2a9c3b7d4e01", file: "pdf_proposal_nilefoods", owner: "sales", label: "Client review - proposal",
    permission: "view_only", expiresInDays: 5, createdDays: 9, lastAccessDays: 1 },
  { id: "8c2e4f61-3b7a-4d19-9a0c-6e5f1d2b3a04", folder: "nilefoods", owner: "sales", label: "Nile Foods marketing team",
    permission: "download", password: "Nile2026", maxDownloads: 10, downloadCount: 3, expiresInDays: 14, createdDays: 12, lastAccessDays: 2 },
  { id: "b3d9e0a7-6c21-4f58-8b4e-9f0a1c2d3e05", file: "mp4_ramadan_teaser", owner: "u12", label: "Teaser preview - agency",
    permission: "download", expiresInDays: 7, createdDays: 0.8 },
  { id: "d41e8b3c-7a90-4c6f-b2d5-0e1f2a3b4c06", folder: "mkt-brand", owner: "u12", label: "Brand kit for printers",
    permission: "download", expiresInDays: -3, createdDays: 40, lastAccessDays: 20, downloadCount: 2 },
  { id: "e7f2a1b9-0c3d-4e5f-8a6b-7c8d9e0f1a07", file: "pdf_company_profile", owner: "sales", label: "Website download",
    permission: "view_only", expiresInDays: 30, createdDays: 60, revokedDays: 2, lastAccessDays: 3 },
];

const shareSecret = (id) => crypto.createHash("sha256").update(`orgtik-local-share:${id}`).digest("base64url").slice(0, 32);

const IPS = ["196.221.14.23", "41.33.187.9", "10.20.0.14", "156.197.42.110", "10.20.0.31", "197.35.8.201"];
const UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
];

function hashNum(s) {
  return parseInt(crypto.createHash("md5").update(String(s)).digest("hex").slice(0, 8), 16);
}

// Returns the initial in-memory state.
function buildSeed({ identity, manifest, seedAt }) {
  const now = seedAt ? Date.parse(seedAt) : Date.now();
  const uid = (key) => identity.findByKey(key).id;
  // days ago -> ISO. Whole days land on a stable pseudo-random time within Cairo working hours
  // (09:00-18:00, UTC+3); fractions of a day (< 1) are simply "that many hours ago".
  const ago = (days, salt = "") => {
    if (days < 1) return new Date(now - days * 864e5).toISOString();
    const d = new Date(now - Math.floor(days) * 864e5);
    d.setUTCHours(6, hashNum(salt) % 540, 0, 0);
    return d.toISOString();
  };

  const state = {
    folders: new Map(),
    files: new Map(),
    pins: new Map(), // userId -> Map(folderId -> pinnedAt)
    shares: new Map(),
    sessions: new Map(),
    failures: new Map(),
    previewPages: new Map(),
    activities: [],
  };
  const folderByKey = {};
  const fileByAsset = {};
  const acts = [];
  let actN = 0;
  const act = (actorKey, action, entityType, entityId, metadata, at) => {
    const n = actN++;
    acts.push({
      id: seedId(`act-${n}-${entityId}-${action}`), scope: "file_manager", actorId: String(uid(actorKey)), action, entityType, entityId,
      metadata, ip: IPS[hashNum(entityId + action) % IPS.length], userAgent: UAS[hashNum(actorKey) % UAS.length], createdAt: at,
    });
  };
  const pin = (userKey, folderId, at) => {
    const id = uid(userKey);
    if (!state.pins.has(id)) state.pins.set(id, new Map());
    state.pins.get(id).set(folderId, at);
  };

  function addFile(spec, folder) {
    const asset = manifest[spec.asset];
    if (!asset) throw new Error(`seed asset missing from manifest: ${spec.asset}`);
    const id = seedId(`file:${spec.asset}`);
    const createdAt = ago(spec.days, spec.asset);
    const file = {
      id, name: spec.name, originalName: (spec.history?.find((h) => h.action === "renamed")?.from) || spec.name,
      ownerId: uid(spec.owner), size: spec.size ? parseSize(spec.size) : asset.size, mimeType: asset.mimeType,
      folderId: folder ? folder.id : null, isUsed: false, usedNote: null, usedAt: null, usedBy: null,
      createdAt, updatedAt: createdAt, deletedAt: null, archivedBy: null, archiveBatch: null,
      storage: { kind: "asset", key: spec.asset }, accessOverride: null,
    };
    state.files.set(id, file);
    fileByAsset[spec.asset] = file;
    act(spec.owner, "uploaded", "file", id, { name: file.originalName, size: file.size, mimeType: file.mimeType, folderId: file.folderId }, createdAt);
    for (const h of spec.history || []) {
      const at = ago(h.days, spec.asset + h.action);
      if (h.action === "renamed") act(h.by, "renamed", "file", id, { name: spec.name, oldName: h.from, folderId: file.folderId }, at);
      if (h.action === "moved") act(h.by, "moved", "file", id, { name: spec.name, folderId: file.folderId, fromFolderName: h.fromName }, at);
      file.updatedAt = at > file.updatedAt ? at : file.updatedAt;
    }
    if (spec.used) {
      const at = ago(spec.used.days, spec.asset + "used");
      Object.assign(file, { isUsed: true, usedNote: spec.used.note, usedAt: at, usedBy: uid(spec.used.by), updatedAt: at > file.updatedAt ? at : file.updatedAt });
      act(spec.used.by, "updated", "file", id, { name: spec.name, isUsed: true, note: spec.used.note, folderId: file.folderId }, at);
    }
    if (spec.archived) {
      const at = ago(spec.archived.days, spec.asset + "archived");
      Object.assign(file, { deletedAt: at, archivedBy: uid(spec.archived.by), archiveBatch: `seed-${id}` });
      act(spec.archived.by, "deleted", "file", id, { name: spec.name, archived: true, folderId: file.folderId }, at);
    }
    return file;
  }

  function archiveSubtree(folder, at, by, batch) {
    folder.deletedAt = at;
    folder.archivedBy = by;
    folder.archiveBatch = batch;
    for (const f of state.files.values()) if (f.folderId === folder.id && !f.deletedAt) Object.assign(f, { deletedAt: at, archivedBy: by, archiveBatch: batch });
    for (const c of state.folders.values()) if (c.parentId === folder.id && !c.deletedAt) archiveSubtree(c, at, by, batch);
  }

  function addFolder(spec, parent, root) {
    const id = seedId(`folder:${spec.key}`);
    const createdAt = ago(spec.days, spec.key);
    const ownerKey = spec.owner || root.owner;
    const folder = {
      id, name: spec.name, ownerId: uid(ownerKey), parentId: parent ? parent.id : null,
      visibility: parent ? parent.visibility : spec.visibility || "only_me",
      allowedUserIds: parent ? [...parent.allowedUserIds] : (spec.people || []).map(uid),
      grantedBy: parent ? parent.grantedBy : uid(ownerKey), grantsAt: parent ? parent.grantsAt : createdAt,
      inheritedAccess: Boolean(parent), createdAt, updatedAt: createdAt, deletedAt: null, archivedBy: null, archiveBatch: null,
    };
    state.folders.set(id, folder);
    folderByKey[spec.key] = folder;
    act(ownerKey, "created", "folder", id, {
      name: spec.name, depth: parent ? (parent.depth || 0) + 1 : 0, parentId: folder.parentId, visibility: folder.visibility, inheritedAccess: folder.inheritedAccess,
    }, createdAt);
    folder.depth = parent ? (parent.depth || 0) + 1 : 0; // seed-time helper only
    for (const who of spec.pinnedBy || []) pin(who, id, ago(Math.max(0.5, spec.days / 3), spec.key + who));
    for (const f of spec.files || []) addFile(f, folder);
    for (const c of spec.children || []) addFolder(c, folder, root);
    if (spec.archived) {
      const at = ago(spec.archived.days, spec.key + "archived");
      archiveSubtree(folder, at, uid(spec.archived.by), `seed-${id}`);
      act(spec.archived.by, "deleted", "folder", id, { name: spec.name, archived: true, parentId: folder.parentId }, at);
    }
    delete folder.depth;
    return folder;
  }

  for (const root of TREE) addFolder(root, null, root);
  for (const f of ROOT_FILES) addFile(f, null);

  for (const s of SHARES) {
    const res = s.file ? fileByAsset[s.file] : folderByKey[s.folder];
    const createdAt = ago(s.createdDays, s.id);
    state.shares.set(s.id, {
      id: s.id, ownerId: uid(s.owner), resourceType: s.file ? "file" : "folder", resourceId: res.id, label: s.label, permission: s.permission,
      passwordHash: s.password ? crypto.createHash("sha256").update(s.password).digest("hex") : null,
      expiresAt: new Date(now + s.expiresInDays * 864e5).toISOString(), revokedAt: s.revokedDays != null ? ago(s.revokedDays, s.id + "r") : null,
      maxDownloads: s.maxDownloads ?? null, downloadCount: s.downloadCount || 0, version: 1, secret: shareSecret(s.id),
      lastAccessedAt: s.lastAccessDays != null ? ago(s.lastAccessDays, s.id + "a") : null, createdAt,
      seedPassword: s.password || null,
    });
  }

  state.activities = acts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return state;
}

module.exports = { buildSeed, shareSecret, SHARES, newId };
