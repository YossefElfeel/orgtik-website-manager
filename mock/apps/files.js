// Local mock backend for file-manager-dashboard-main (web :3002, API :4002).
// Frontend base URL: NEXT_PUBLIC_API_URL + "/api". All state is in memory (reset on restart);
// uploaded bytes go to local-dev/uploads/files, seeded bytes come from ./files/assets.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const lib = require("./files/lib");
const { buildSeed } = require("./files/seed");
const commands = require('./files/commands');
const { createFileAccess } = require('./files/access');
const whiteboards = require('../lib/whiteboard-scene');

const SCOPE = "file_manager";
const ASSET_DIR = path.join(__dirname, "files", "assets");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ASSET_DIR, "manifest.json"), "utf8"));
const BUCKETS = ["documents", "images", "videos", "other"];
const PREVIEW_DELAY_MS = 4000; // uploads show "processing" on the public page for a few seconds

const staffGrants = {};
for (const k of ["manager", "employee", "sales", "finance", "u7", "u8", "u9", "u10", "u11", "u12", "u13", "u14", "u15", "u16"]) staffGrants[k] = ["file_editor"];

module.exports = {
  scopes: [{
    name: SCOPE,
    displayName: "File Manager",
    description: "Store, preview and share company files and folders.",
    metadata: { icon: "solar:folder-with-files-bold", color: "#F59E0B" },
  }],
  // The app only checks roles.includes("super_admin") (or userType "admin") and non-empty roles;
  // everything else comes from per-item `capabilities`. Role names are file-manager specific on purpose.
  grants: { [SCOPE]: { admin: ["super_admin"], customer: ["file_guest"], ...staffGrants } },

  routes(app, ctx, options = {}) {
    const { identity, util } = ctx;
    const state = options.state || buildSeed({ identity, manifest: MANIFEST, seedAt: options.seedAt });
    state.previewPages ||= new Map();
    const F = state.folders;
    const FL = state.files;
    const apiBase = () => `${ctx.apiUrl("files")}/api`;
    const nowIso = () => new Date().toISOString();

    for (const [key, a] of Object.entries(MANIFEST)) {
      if (!fs.existsSync(path.join(ASSET_DIR, a.file))) ctx.log(`WARNING: seed asset missing on disk: ${key} (${a.file})`);
    }

    // ------------------------------------------------------------ responses & auth
    const ok = (res, data, message, status = 200) => util.ok(res, data, message, status);
    const fail = (res, status, message, extra = {}) => util.fail(res, status, message, { error: message, ...extra });
    const { toolRoles, isAdmin, isStaff, parentOf, chain, folderAccess, fileAccess, folderCaps, fileCaps, authorizeBoard, boardAccess, activeFile: activeSharedFile } = createFileAccess({ state, identity, boardAuthority: ctx.boardAuthority });
    const truthy = (v) => v === true || v === "true" || v === "1";
    if (identity.workspaceMode) app.use((req, res, next) => {
      const ownProfile = req.method === 'PUT' && req.path === '/api/auth/profile' || req.method === 'DELETE' && req.path === '/api/auth/avatar';
      if (!['GET', 'HEAD'].includes(req.method) && !/^\/api\/v1\/public\/shares\//.test(req.path)) {
        const user = identity.requireUser(req, res); if (!user) return;
        if (!ownProfile && !toolRoles(user).some(role => role === 'super_admin' || role === 'file_editor')) return fail(res, 403, "This Files role is read-only.");
        if (!ownProfile && typeof identity.canWrite === 'function' && !identity.canWrite(user)) return fail(res, 423, "This Files workspace is read-only.");
      }
      if (req.method === 'POST' && req.path === '/api/auth/avatar') return fail(res, 501, 'sample_assets_only');
      if (!['GET', 'HEAD'].includes(req.method) && /^\/api\/auth\//.test(req.path) && !ownProfile) return fail(res, 501, "workspace_command_required");
      return next();
    });

    function member(req, res) {
      const u = identity.requireUser(req, res);
      if (!u) return null;
      if (!isAdmin(u) && !identity.userScopes(u).some((s) => s.scope === SCOPE)) {
        fail(res, 403, "You don't have access to the File Manager.");
        return null;
      }
      return u;
    }

    // ------------------------------------------------------------ tree helpers
    const pathOf = (f) => "/" + chain(f).reverse().map((x) => x.name).join("/");
    const depthOf = (f) => chain(f).length - 1;
    const within = (f, ancestorId) => Boolean(f) && chain(f).some((x) => x.id === ancestorId); // includes self
    const subtreeFolders = (root) => [...F.values()].filter((f) => within(f, root.id));
    const byNewest = (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);
    const byName = (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    const activeFolders = () => [...F.values()].filter((f) => !f.deletedAt);
    const activeFiles = () => [...FL.values()].filter((f) => !f.deletedAt && (!f.whiteboard || activeSharedFile(f)));
    const cleanName = (s) => String(s ?? "").replace(/[\\/]/g, "-").replace(/\s+/g, " ").trim().slice(0, 255);

    // ------------------------------------------------------------ access model
    // admin: everything. owner: owns the folder or an ancestor. collab: the folder is shared with the user
    // ("everyone" = all staff, customers excluded; "specific_people" = listed users). Child folders copy
    // their parent's access; changing a folder's access re-applies it to the whole subtree.

    // Archived items: visible to admins, their owner, whoever archived them, and owners of the tree above.
    function archiveVisible(u, item, container) {
      if (isAdmin(u) || item.ownerId === u.id || item.archivedBy === u.id) return true;
      return chain(container).some((x) => x.ownerId === u.id);
    }
    const archiveVisibleFolder = (u, f) => archiveVisible(u, f, f);
    const archiveVisibleFile = (u, file) => boardAccess(u, file) && archiveVisible(u, file, file.folderId ? F.get(file.folderId) : null);

    // ------------------------------------------------------------ serializers
    function userLite(id) {
      const u = identity.findUser(id);
      if (!u) return null;
      return { id: u.id, avatar: u.avatar, email: u.email, firstName: u.firstName, lastName: u.lastName, username: u.username, isActive: u.isActive };
    }
    const ownerOut = (id) => userLite(id) || { id, avatar: null, email: "", firstName: "Former", lastName: "member", username: "former.member", isActive: false };

    function folderLite(f, u) {
      return {
        id: f.id, name: f.name, ownerId: String(f.ownerId), parentId: f.parentId, path: pathOf(f), depth: depthOf(f),
        isSystemArchive: false, isSystemRoot: false, visibility: f.visibility, isPinned: Boolean(state.pins.get(u.id)?.has(f.id)),
        createdAt: f.createdAt, updatedAt: f.updatedAt, deletedAt: f.deletedAt, owner: ownerOut(f.ownerId),
      };
    }

    function folderOut(f, u, { archive = false } = {}) {
      const acc = folderAccess(u, f);
      const manager = acc && acc.level !== "collab";
      const parent = parentOf(f);
      return {
        ...folderLite(f, u),
        accessGrants: f.visibility === "specific_people"
          ? f.allowedUserIds.map((id) => ({ id: lib.seedId(`grant:${f.id}:${id}`), folderId: f.id, userId: String(id), grantedBy: String(f.grantedBy || f.ownerId), createdAt: f.grantsAt || f.createdAt }))
          : [],
        accessUsers: manager && f.visibility === "specific_people" ? f.allowedUserIds.map(userLite).filter(Boolean) : [],
        capabilities: folderCaps(u, f),
        ...(archive ? { parentName: parent ? parent.name : null } : {}),
      };
    }

    function fileOut(file, u, selected) {
      if (!boardAccess(u, file)) throw Object.assign(new Error('This file is unavailable.'), { status: 404, code: 'file_not_found' });
      const folder = file.folderId ? F.get(file.folderId) : null;
      const versionId = selected?.id || file.currentVersionId;
      const url = `${apiBase()}/v1/files/${file.id}${selected ? `/versions/${selected.id}` : ''}/download`;
      const access = file.accessOverride || (folder ? { visibility: folder.visibility, allowedUserIds: folder.allowedUserIds } : { visibility: "only_me", allowedUserIds: [] });
      return {
        id: file.id, name: file.name, displayName: file.name, originalName: file.originalName, ownerId: String(file.ownerId),
        size: selected?.binary.size ?? file.size, mimeType: selected?.binary.mimetype || file.mimeType, url, path: url, relativePath: url, depth: folder ? depthOf(folder) + 1 : 0,
        isUsed: file.isUsed, usedNote: file.usedNote, usedAt: file.usedAt, usedBy: file.usedBy != null ? String(file.usedBy) : null,
        folderId: file.folderId, folder: folder ? folderLite(folder, u) : null,
        visibility: access.visibility, allowedUserIds: access.visibility === "specific_people" ? access.allowedUserIds.map(String) : [],
        createdAt: file.createdAt, updatedAt: file.updatedAt, deletedAt: file.deletedAt,
        owner: ownerOut(file.ownerId), capabilities: fileCaps(u, file),
        ...(file.whiteboard ? { whiteboard: { boardId: file.whiteboard.boardId, versionId, currentVersionId: file.currentVersionId, version: selected?.number || file.versions.find(row => row.id === versionId).number, preview: { kind: 'sample', url: `${apiBase()}/v1/files/${file.id}/versions/${versionId}/preview` } } } : {}),
      };
    }

    const actOut = (a) => ({ ...a, actor: ownerOut(Number(a.actorId)) });

    function logAct(req, u, action, entityType, entityId, metadata) {
      const boardId = entityType === 'file' && FL.get(entityId)?.whiteboard?.boardId;
      if (boardId) metadata = { ...metadata, boardId };
      const ip = String(req.ip || "127.0.0.1").replace(/^::ffff:/, "").replace(/^::1$/, "127.0.0.1");
      state.activities.unshift({
        id: lib.newId(), scope: SCOPE, actorId: String(u.id), action, entityType, entityId, metadata,
        ip, userAgent: req.headers["user-agent"] || "", createdAt: nowIso(),
      });
    }

    const page = (list, q, map, defaultLimit = 10) => {
      const { items, meta } = util.paginate(list, q, { defaultLimit });
      return { items: items.map(map), meta };
    };

    // ------------------------------------------------------------ mutations (shared by several routes)
    function normVisibility(v) {
      if (v === "everyone") return "everyone";
      if (v === "specific_people" || v === "specific") return "specific_people";
      return "only_me";
    }
    function normUserIds(list, ownerId) {
      const ids = [].concat(list || []).map(Number).filter((id) => Number.isFinite(id) && id !== ownerId && identity.findUser(id));
      return [...new Set(ids)];
    }
    function nameTaken(parentId, name, exceptId, rootOwnerId) {
      const lower = name.toLowerCase();
      return activeFolders().some((f) => f.id !== exceptId && f.parentId === parentId && (parentId !== null || f.ownerId === rootOwnerId) && f.name.toLowerCase() === lower);
    }
    function applyAccess(folder, visibility, allowedUserIds, grantedBy, inherited) {
      const at = nowIso();
      for (const f of subtreeFolders(folder)) {
        Object.assign(f, { visibility, allowedUserIds: [...allowedUserIds], grantedBy, grantsAt: at });
        if (f !== folder) f.inheritedAccess = true;
      }
      folder.inheritedAccess = inherited;
    }
    function createFolder(req, u, { name, parent, visibility, allowedUserIds }) {
      const at = nowIso();
      const folder = {
        id: lib.newId(), name, ownerId: u.id, parentId: parent ? parent.id : null,
        visibility: parent ? parent.visibility : visibility, allowedUserIds: parent ? [...parent.allowedUserIds] : allowedUserIds,
        grantedBy: parent ? parent.grantedBy : u.id, grantsAt: at, inheritedAccess: Boolean(parent),
        createdAt: at, updatedAt: at, deletedAt: null, archivedBy: null, archiveBatch: null,
      };
      F.set(folder.id, folder);
      logAct(req, u, "created", "folder", folder.id, {
        name, path: pathOf(folder), depth: depthOf(folder), parentId: folder.parentId, visibility: folder.visibility, inheritedAccess: folder.inheritedAccess,
      });
      return folder;
    }
    // find-or-create a sub-folder (used by folder uploads)
    function ensureChild(parent, name, req, u) {
      const lower = name.toLowerCase();
      const found = activeFolders().find((f) => f.parentId === (parent ? parent.id : null) && (parent || f.ownerId === u.id) && f.name.toLowerCase() === lower);
      return found || createFolder(req, u, { name, parent, visibility: "only_me", allowedUserIds: [] });
    }

    function archiveFolderTree(folder, u) {
      preflightFolderBoards(u, [folder]);
      const at = nowIso();
      const batch = lib.newId();
      const walk = (f) => {
        Object.assign(f, { deletedAt: at, archivedBy: u.id, archiveBatch: batch, updatedAt: at });
        for (const file of FL.values()) if (file.folderId === f.id && !file.deletedAt) Object.assign(file, { deletedAt: at, archivedBy: u.id, archiveBatch: batch });
        for (const c of F.values()) if (c.parentId === f.id && !c.deletedAt) walk(c);
      };
      walk(folder);
    }
    function archiveFile(file, u) {
      Object.assign(file, { deletedAt: nowIso(), archivedBy: u.id, archiveBatch: lib.newId(), updatedAt: nowIso() });
    }
    function restoreFolderTree(folder, u) {
      preflightFolderBoards(u, [folder]);
      const batch = folder.archiveBatch;
      const at = nowIso();
      const walk = (f) => {
        Object.assign(f, { deletedAt: null, archivedBy: null, archiveBatch: null, updatedAt: at });
        for (const file of FL.values()) if (file.folderId === f.id && file.deletedAt && file.archiveBatch === batch) Object.assign(file, { deletedAt: null, archivedBy: null, archiveBatch: null });
        for (const c of F.values()) if (c.parentId === f.id && c.deletedAt && c.archiveBatch === batch) walk(c);
      };
      walk(folder);
      const parent = parentOf(folder);
      if (folder.parentId && (!parent || parent.deletedAt)) folder.parentId = null; // original location is gone -> restore to root
    }
    function restoreFile(file, u) {
      preflightBoards(u, [file]);
      Object.assign(file, { deletedAt: null, archivedBy: null, archiveBatch: null, updatedAt: nowIso() });
      const folder = file.folderId ? F.get(file.folderId) : null;
      if (file.folderId && (!folder || folder.deletedAt)) file.folderId = null;
    }
    function purgeFile(file) {
      FL.delete(file.id);
      for (const [id, s] of state.shares) if (s.resourceType === "file" && s.resourceId === file.id) state.shares.delete(id);
      if (file.storage.kind === "upload") fs.unlink(file.storage.path, () => {});
    }
    function purgeFolder(folder) {
      const ids = new Set(subtreeFolders(folder).map((f) => f.id));
      for (const file of [...FL.values()]) if (file.folderId && ids.has(file.folderId)) purgeFile(file);
      for (const id of ids) F.delete(id);
      for (const [id, s] of state.shares) if (s.resourceType === "folder" && ids.has(s.resourceId)) state.shares.delete(id);
      for (const pins of state.pins.values()) for (const id of ids) pins.delete(id);
    }
    function checkPassword(res, u, password) {
      if (!password) return fail(res, 400, "Please enter your password to confirm."), false;
      if (identity.workspaceMode) {
        const verifier = ctx.workspaceServices?.verifyActorPassword;
        if (typeof verifier !== "function") return fail(res, 503, "Password verification is unavailable."), false;
        const verified = verifier(String(password));
        if (typeof verified !== "boolean") return fail(res, 503, "Password verification is unavailable."), false;
        return verified || (fail(res, 400, "Incorrect password. Nothing was deleted."), false);
      }
      if (String(password) !== u.password) return fail(res, 400, "Incorrect password. Nothing was deleted."), false;
      return true;
    }
    const canPurge = (u, item) => !item.custodyReadOnly && (!item.whiteboard || boardAccess(u, item, true)) && (isAdmin(u) || item.ownerId === u.id || item.archivedBy === u.id);
    function preflightBoards(u, files) {
      const affected = [...new Map(files.filter(file => file.whiteboard).map(file => [file.id, file])).values()];
      if (affected.length > 10000) throw Object.assign(new Error('This folder has too many whiteboards for one operation.'), { status: 422, code: 'whiteboard_action_limit' });
      for (const file of affected) {
        if (file.custodyReadOnly || chain(F.get(file.folderId)).some(folder => folder.custodyReadOnly)) throw Object.assign(new Error('This whiteboard awaits ownership review.'), { status: 423, code: 'whiteboard_custody_read_only' });
        authorizeBoard(u, file, true);
      }
    }
    function preflightFolderBoards(u, folders) {
      const ids = new Set(folders.flatMap(folder => subtreeFolders(folder).map(row => row.id)));
      preflightBoards(u, [...FL.values()].filter(file => ids.has(file.folderId)));
    }

    // bytes of a stored file: { path } for sendFile
    function storedPath(file) {
      if (file.storage.kind === 'whiteboard') throw Object.assign(new Error('A structured board does not have an uploaded path.'), { status: 503, code: 'invalid_whiteboard_content' });
      if (file.storage.kind === "upload") return file.storage.path;
      return path.join(ASSET_DIR, MANIFEST[file.storage.key].file);
    }
    const readBytes = (file) => file.storage.kind === 'whiteboard' ? Buffer.from(whiteboards.readWhiteboardStorage(file.storage).json, 'utf8') : fs.readFileSync(storedPath(file));

    function sendStored(res, file, disposition = "inline", name = file.name) {
      if (file.storage.kind === 'whiteboard') {
        res.setHeader('Content-Type', whiteboards.MIME);
        res.setHeader('Content-Disposition', lib.contentDisposition('attachment', name));
        res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(readBytes(file));
      }
      const p = storedPath(file);
      if (!fs.existsSync(p)) return fail(res, 410, "The file content is no longer available.");
      res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", lib.contentDisposition(disposition, name));
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.sendFile(p, { dotfiles: "allow" });
    }

    function zipFolder(root, canSee) {
      const entries = [];
      const used = new Map();
      const unique = (p) => {
        const n = used.get(p) || 0;
        used.set(p, n + 1);
        if (!n) return p;
        const dot = p.lastIndexOf(".");
        return dot > p.lastIndexOf("/") ? `${p.slice(0, dot)} (${n})${p.slice(dot)}` : `${p} (${n})`;
      };
      const walk = (folder, prefix) => {
        entries.push({ name: `${prefix}/`, date: folder.updatedAt });
        for (const file of activeFiles().filter((x) => x.folderId === folder.id && canSee(x)).sort(byName)) {
          try {
            entries.push({ name: unique(`${prefix}/${file.name}`), data: readBytes(file), date: file.updatedAt });
          } catch (error) { if (file.whiteboard) throw error; /* preserve legacy unreadable-asset behavior */ }
        }
        for (const c of activeFolders().filter((x) => x.parentId === folder.id).sort(byName)) walk(c, `${prefix}/${c.name}`);
      };
      walk(root, root.name);
      return lib.zipBuffer(entries);
    }

    // ============================================================ folders
    function topLevelFor(u) {
      if (isAdmin(u)) return activeFolders().filter((f) => !f.parentId);
      return activeFolders().filter((f) => folderAccess(u, f) && (!f.parentId || !folderAccess(u, parentOf(f))));
    }

    function listFolders(req, res, u, parentIdRaw) {
      const q = req.query;
      const parentId = parentIdRaw && parentIdRaw !== "null" && parentIdRaw !== "undefined" ? String(parentIdRaw) : null;
      let list;
      if (parentId) {
        const parent = F.get(parentId);
        if (!parent || parent.deletedAt) return fail(res, 404, "Folder not found.");
        if (!folderAccess(u, parent)) return fail(res, 403, "You don't have access to this folder.");
        list = activeFolders().filter((f) => (truthy(q.includeDescendants) ? f.id !== parent.id && within(f, parent.id) : f.parentId === parent.id) && folderAccess(u, f));
      } else if (q.search) {
        list = activeFolders().filter((f) => folderAccess(u, f));
      } else {
        list = topLevelFor(u);
      }
      if (q.visibility) list = list.filter((f) => f.visibility === normVisibility(q.visibility));
      list = util.search(list, q.search, ["name"]).sort(byNewest);
      return ok(res, page(list, q, (f) => folderOut(f, u)), "Folders fetched successfully");
    }

    app.get("/api/v1/folders", (req, res) => {
      const u = member(req, res);
      if (u) listFolders(req, res, u, req.query.parentId);
    });

    app.get("/api/v1/folders/pinned", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const pins = state.pins.get(u.id) || new Map();
      const list = [...pins.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1)).map(([id]) => F.get(id)).filter((f) => f && !f.deletedAt && folderAccess(u, f));
      ok(res, list.map((f) => ({ ...folderOut(f, u), isPinned: true })), "Pinned folders fetched successfully");
    });

    app.post("/api/v1/folders", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const b = req.body || {};
      const name = cleanName(b.name);
      if (!name) return fail(res, 400, "Folder name is required.");
      let parent = null;
      if (b.parentId) {
        parent = F.get(String(b.parentId));
        if (!parent || parent.deletedAt) return fail(res, 404, "Parent folder not found.");
        if (!folderCaps(u, parent).canWrite) return fail(res, 403, "You can't create folders here.");
      }
      if (nameTaken(parent ? parent.id : null, name, null, u.id)) return fail(res, 409, `A folder named "${name}" already exists here.`);
      const visibility = normVisibility(b.visibility);
      const folder = createFolder(req, u, { name, parent, visibility, allowedUserIds: visibility === "specific_people" ? normUserIds(b.allowedUserIds, u.id) : [] });
      ok(res, folderOut(folder, u), "Folder created successfully", 201);
    });

    app.get("/api/v1/folders/:id/children", (req, res) => {
      const u = member(req, res);
      if (u) listFolders(req, res, u, req.params.id);
    });

    app.get("/api/v1/folders/:id/download", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const f = F.get(req.params.id);
      if (!f || f.deletedAt) return fail(res, 404, "Folder not found.");
      if (!folderAccess(u, f)) return fail(res, 403, "You don't have access to this folder.");
      const buf = zipFolder(f, (file) => Boolean(fileAccess(u, file)));
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", lib.contentDisposition("attachment", `${f.name}.zip`));
      res.setHeader("Cache-Control", "private, no-store");
      res.send(buf);
    });

    const activeFolderFor = (req, res, u) => {
      const f = F.get(req.params.id);
      if (!f || f.deletedAt) return fail(res, 404, "Folder not found."), null;
      if (!folderAccess(u, f)) return fail(res, 403, "You don't have access to this folder."), null;
      return f;
    };

    app.get("/api/v1/folders/:id", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const f = activeFolderFor(req, res, u);
      if (f) ok(res, folderOut(f, u), "Folder fetched successfully");
    });

    app.patch("/api/v1/folders/:id", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const f = activeFolderFor(req, res, u);
      if (!f) return;
      const c = folderCaps(u, f);
      const b = req.body || {};
      if (b.visibility !== undefined || b.allowedUserIds !== undefined) {
        if (!c.canManageAccess) return fail(res, 403, "Only the folder owner can change who has access.");
        preflightFolderBoards(u, [f]);
      }
      const events = [];
      if (b.name !== undefined) {
        if (!c.canWrite) return fail(res, 403, "You can't rename this folder.");
        const name = cleanName(b.name);
        if (!name) return fail(res, 400, "Folder name is required.");
        if (name !== f.name) {
          if (nameTaken(f.parentId, name, f.id, f.ownerId)) return fail(res, 409, `A folder named "${name}" already exists here.`);
          events.push(["renamed", { name, oldName: f.name, parentId: f.parentId }]);
          f.name = name;
        }
      }
      if (b.visibility !== undefined || b.allowedUserIds !== undefined) {
        if (!c.canManageAccess) return fail(res, 403, "Only the folder owner can change who has access.");
        const visibility = b.visibility !== undefined ? normVisibility(b.visibility) : f.visibility;
        const allowed = visibility === "specific_people" ? normUserIds(b.allowedUserIds ?? f.allowedUserIds, f.ownerId) : [];
        applyAccess(f, visibility, allowed, u.id, false);
        events.push(["updated", { name: f.name, visibility, sharedWith: allowed.length, parentId: f.parentId }]);
      }
      f.updatedAt = nowIso();
      for (const [action, meta] of events) logAct(req, u, action, "folder", f.id, meta);
      const renamedOnly = events.length === 1 && events[0][0] === "renamed";
      ok(res, folderOut(f, u), renamedOnly ? "Folder renamed successfully" : events.length ? "Folder access updated successfully" : "No changes");
    });

    function archiveFolderRoute(req, res) {
      const u = member(req, res);
      if (!u) return;
      const f = activeFolderFor(req, res, u);
      if (!f) return;
      if (!folderCaps(u, f).canArchive) return fail(res, 403, "You can't archive this folder.");
      archiveFolderTree(f, u);
      logAct(req, u, "deleted", "folder", f.id, { name: f.name, archived: true, parentId: f.parentId });
      ok(res, null, `"${f.name}" was moved to the archive`);
    }
    app.patch("/api/v1/folders/:id/archive", archiveFolderRoute);
    app.delete("/api/v1/folders/:id", archiveFolderRoute);

    app.post("/api/v1/folders/:id/pin", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const f = activeFolderFor(req, res, u);
      if (!f) return;
      if (!state.pins.has(u.id)) state.pins.set(u.id, new Map());
      state.pins.get(u.id).set(f.id, nowIso());
      ok(res, { ...folderOut(f, u), isPinned: true }, "Folder pinned to your dashboard");
    });
    app.delete("/api/v1/folders/:id/pin", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const f = activeFolderFor(req, res, u);
      if (!f) return;
      state.pins.get(u.id)?.delete(f.id);
      ok(res, { ...folderOut(f, u), isPinned: false }, "Folder unpinned");
    });

    app.patch("/api/v1/folders/:id/move", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const f = activeFolderFor(req, res, u);
      if (!f) return;
      const c = folderCaps(u, f);
      if (!c.canMove) return fail(res, 403, "You can't move this folder.");
      const b = req.body || {};
      const target = b.targetParentId ? F.get(String(b.targetParentId)) : null;
      if (b.targetParentId && (!target || target.deletedAt)) return fail(res, 404, "Destination folder not found.");
      if (target && within(target, f.id)) return fail(res, 400, "You can't move a folder into itself or one of its sub-folders.");
      if (target && !folderCaps(u, target).canWrite) return fail(res, 403, "You can't move items into that folder.");
      if (c.sharedRootId && (!target || !within(target, c.sharedRootId))) return fail(res, 403, "Items in a shared folder can only be moved within that shared folder.");
      const name = b.name ? cleanName(b.name) : f.name;
      if ((target ? target.id : null) === f.parentId && name === f.name) return fail(res, 400, "The folder is already in this location.");
      if (nameTaken(target ? target.id : null, name, f.id, f.ownerId)) return fail(res, 409, `A folder named "${name}" already exists in the destination.`);
      const fromParentId = f.parentId;
      preflightFolderBoards(u, [f]);
      Object.assign(f, { parentId: target ? target.id : null, name, updatedAt: nowIso() });
      if (target) applyAccess(f, target.visibility, target.allowedUserIds, target.grantedBy, true);
      logAct(req, u, "moved", "folder", f.id, { name, parentId: f.parentId, fromParentId, path: pathOf(f) });
      ok(res, folderOut(f, u), "Folder moved successfully");
    });

    // ============================================================ files
    app.post("/api/v1/files/upload", (req, res, next) => {
      const u = member(req, res);
      if (!u) return;
      if (identity.workspaceMode) return fail(res, 501, "sample_assets_only");
      ctx.upload.any()(req, res, (err) => {
        if (err) return fail(res, 400, `Upload failed: ${err.message}`);
        try {
          handleUpload(req, res, u);
        } catch (e) {
          next(e);
        }
      });
    });

    function handleUpload(req, res, u) {
      const uploaded = (req.files || []).filter((f) => ["files", "files[]", "file"].includes(f.fieldname));
      const discard = () => uploaded.forEach((f) => fs.unlink(f.path, () => {}));
      if (!uploaded.length) return fail(res, 400, "No files were uploaded.");
      let rel = [];
      try {
        rel = JSON.parse(req.body.relativePaths || "[]");
      } catch {
        rel = [].concat(req.body.relativePaths || []);
      }
      let target = null;
      const folderId = req.body.folderId;
      if (folderId && folderId !== "null" && folderId !== "undefined") {
        target = F.get(String(folderId));
        if (!target || target.deletedAt) return discard(), fail(res, 404, "Destination folder not found.");
        if (!folderCaps(u, target).canWrite) return discard(), fail(res, 403, "You can't upload into this folder.");
      }
      if (req.body.folderName && cleanName(req.body.folderName)) target = ensureChild(target, cleanName(req.body.folderName), req, u);
      const created = uploaded.map((mf, i) => {
        const original = lib.fixUploadName(mf.originalname);
        const segs = String(Array.isArray(rel) && rel[i] ? rel[i] : original).replace(/\\/g, "/").split("/").map(cleanName).filter(Boolean);
        const name = segs.pop() || cleanName(original) || "file";
        let dest = target;
        for (const seg of segs) dest = ensureChild(dest, seg, req, u);
        const at = nowIso();
        const file = {
          id: lib.newId(), name, originalName: name, ownerId: u.id, size: mf.size, mimeType: lib.mimeFor(name, mf.mimetype),
          folderId: dest ? dest.id : null, isUsed: false, usedNote: null, usedAt: null, usedBy: null,
          createdAt: at, updatedAt: at, deletedAt: null, archivedBy: null, archiveBatch: null,
          storage: { kind: "upload", path: mf.path }, accessOverride: null, previewReadyAt: Date.now() + PREVIEW_DELAY_MS,
        };
        FL.set(file.id, file);
        logAct(req, u, "uploaded", "file", file.id, { name, size: file.size, mimeType: file.mimeType, folderId: file.folderId });
        return file;
      });
      ok(res, {
        files: created.map((f) => fileOut(f, u)), count: created.length,
        folderId: target ? target.id : null, folder: target ? folderOut(target, u) : null,
      }, created.length === 1 ? "File uploaded successfully" : `${created.length} files uploaded successfully`, 201);
    }

    app.get("/api/v1/files", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const q = req.query;
      const raw = q.folderId;
      let list;
      if (raw && raw !== "null" && raw !== "undefined") {
        const folder = F.get(String(raw));
        if (!folder || folder.deletedAt) return fail(res, 404, "Folder not found.");
        if (!folderAccess(u, folder)) return fail(res, 403, "You don't have access to this folder.");
        list = activeFiles().filter((f) => (truthy(q.includeDescendants) ? f.folderId && within(F.get(f.folderId), folder.id) : f.folderId === folder.id));
      } else if (raw === "null") {
        list = activeFiles().filter((f) => !f.folderId);
      } else {
        list = activeFiles();
      }
      list = list.filter((f) => fileAccess(u, f));
      if (q.filter === "my_files") list = list.filter((f) => f.ownerId === u.id);
      if (q.filter === "shared_with_me") list = list.filter((f) => f.ownerId !== u.id);
      if (q.isUsed === "true" || q.isUsed === "false") list = list.filter((f) => f.isUsed === (q.isUsed === "true"));
      list = util.search(list, q.search, ["name", "originalName"]).sort(byNewest);
      ok(res, page(list, q, (f) => fileOut(f, u)), "Files fetched successfully");
    });

    app.delete("/api/v1/files", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const ids = [].concat(req.body?.ids || []).map(String);
      if (!ids.length) return fail(res, 400, "No files selected.");
      let n = 0;
      for (const id of ids) {
        const f = FL.get(id);
        if (f && !f.deletedAt && fileCaps(u, f).canArchive) {
          archiveFile(f, u);
          logAct(req, u, "deleted", "file", f.id, { name: f.name, archived: true, folderId: f.folderId });
          n++;
        }
      }
      if (!n) return fail(res, 403, "None of the selected files could be archived.");
      ok(res, { archived: n }, `${n} file${n === 1 ? "" : "s"} moved to the archive`);
    });

    app.get("/api/v1/files/dashboard-overview", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const files = activeFiles().filter((f) => fileAccess(u, f));
      const grouped = BUCKETS.map((key) => {
        const inBucket = files.filter((f) => lib.category(f.mimeType, f.name) === key);
        const last = inBucket.reduce((m, f) => (!m || f.updatedAt > m ? f.updatedAt : m), null);
        return { key, totalFiles: inBucket.length, totalStorage: inBucket.reduce((s, f) => s + Number(f.size || 0), 0), lastFileUpdatedAt: last };
      });
      const recentAddedFiles = [...files].sort(byNewest).slice(0, 8).map((f) => fileOut(f, u));
      const myLastActivity = state.activities.filter((a) => a.actorId === String(u.id) && activityVisible(u, a)).slice(0, 6).map(actOut);
      ok(res, { grouped, recentAddedFiles, myLastActivity }, "Dashboard overview fetched successfully");
    });

    const activeFileFor = (req, res, u) => {
      const f = FL.get(req.params.id);
      if (!f || f.deletedAt || f.whiteboard && !activeSharedFile(f)) return fail(res, 404, "File not found."), null;
      if (!fileAccess(u, f)) return fail(res, 403, "You don't have access to this file."), null;
      return f;
    };

    app.get("/api/v1/files/:id", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const f = activeFileFor(req, res, u);
      if (f) ok(res, fileOut(f, u), "File fetched successfully");
    });

    // Protected binary (images/video/pdf/docx previews + downloads). Bearer header or ?token=.
    app.get("/api/v1/files/:id/download", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const f = FL.get(req.params.id);
      if (!f) return fail(res, 404, "File not found.");
      if (f.whiteboard && !activeSharedFile(f)) return fail(res, 404, 'This whiteboard file is unavailable.');
      if (f.deletedAt ? !archiveVisibleFile(u, f) : !fileAccess(u, f)) return fail(res, 403, "You don't have access to this file.");
      sendStored(res, f, truthy(req.query.download) ? "attachment" : "inline");
    });

    app.patch("/api/v1/files/:id/move", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const f = activeFileFor(req, res, u);
      if (!f) return;
      const c = fileCaps(u, f);
      if (!c.canMove) return fail(res, 403, "You can't move this file.");
      const tid = req.body?.targetFolderId;
      const target = tid ? F.get(String(tid)) : null;
      if (tid && (!target || target.deletedAt)) return fail(res, 404, "Destination folder not found.");
      if (target && !folderCaps(u, target).canWrite) return fail(res, 403, "You can't move files into that folder.");
      if (c.sharedRootId && (!target || !within(target, c.sharedRootId))) return fail(res, 403, "Items in a shared folder can only be moved within that shared folder.");
      if ((target ? target.id : null) === f.folderId) return fail(res, 400, "The file is already in this folder.");
      const fromFolderId = f.folderId;
      Object.assign(f, { folderId: target ? target.id : null, updatedAt: nowIso() });
      logAct(req, u, "moved", "file", f.id, { name: f.name, folderId: f.folderId, fromFolderId });
      ok(res, fileOut(f, u), "File moved successfully");
    });

    app.patch("/api/v1/files/:id/used", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const f = activeFileFor(req, res, u);
      if (!f) return;
      if (!fileCaps(u, f).canWrite) return fail(res, 403, "You can't change this file.");
      const b = req.body || {};
      const isUsed = b.isUsed === true || b.isUsed === "true";
      const note = String(b.note ?? "").trim();
      if (isUsed && !note) return fail(res, 400, "Please add a note describing where the file was used.");
      if (note.length > 1000) return fail(res, 400, "The note can be at most 1000 characters.");
      const at = nowIso();
      if (isUsed) Object.assign(f, { isUsed: true, usedNote: note, usedAt: at, usedBy: u.id, updatedAt: at });
      else Object.assign(f, { isUsed: false, usedNote: null, usedAt: null, usedBy: null, updatedAt: at });
      logAct(req, u, "updated", "file", f.id, { name: f.name, isUsed, ...(isUsed ? { note } : {}), folderId: f.folderId });
      ok(res, fileOut(f, u), isUsed ? "File marked as used" : "File marked as not used");
    });

    app.patch("/api/v1/files/:id/archive", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const f = activeFileFor(req, res, u);
      if (!f) return;
      if (!fileCaps(u, f).canArchive) return fail(res, 403, "You can't archive this file.");
      archiveFile(f, u);
      logAct(req, u, "deleted", "file", f.id, { name: f.name, archived: true, folderId: f.folderId });
      ok(res, null, `"${f.name}" was moved to the archive`);
    });

    function restoreFileRoute(req, res) {
      const u = member(req, res);
      if (!u) return;
      const f = FL.get(req.params.id);
      if (!f || !f.deletedAt) return fail(res, 404, "Archived file not found.");
      if (!archiveVisibleFile(u, f)) return fail(res, 403, "You can't restore this file.");
      restoreFile(f, u);
      logAct(req, u, "updated", "file", f.id, { name: f.name, restored: true, folderId: f.folderId });
      ok(res, fileOut(f, u), `"${f.name}" was restored`);
    }
    app.delete("/api/v1/files/:id/archive", restoreFileRoute);

    app.patch("/api/v1/files/:id", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const f = activeFileFor(req, res, u);
      if (!f) return;
      if (!fileCaps(u, f).canWrite) return fail(res, 403, "You can't rename this file.");
      const b = req.body || {};
      let message = "No changes";
      if (b.name !== undefined) {
        let name = cleanName(b.name);
        if (!name) return fail(res, 400, "File name is required.");
        const oldExt = lib.extOf(f.name);
        if (!/\.[^.\s]+$/.test(name) && f.name.includes(".") && oldExt) name = `${name}.${oldExt}`; // keep the extension
        if (name !== f.name) {
          logAct(req, u, "renamed", "file", f.id, { name, oldName: f.name, folderId: f.folderId });
          f.name = name;
          message = "File renamed successfully";
        }
      }
      if (b.note !== undefined && f.isUsed) {
        f.usedNote = String(b.note).slice(0, 1000);
        message = message === "No changes" ? "File updated successfully" : message;
      }
      f.updatedAt = nowIso();
      ok(res, fileOut(f, u), message);
    });

    app.put("/api/v1/files/:id/access", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const f = activeFileFor(req, res, u);
      if (!f) return;
      if (!fileCaps(u, f).canManageAccess) return fail(res, 403, "Only the owner can change who can see this file.");
      const visibility = normVisibility(req.body?.access || req.body?.visibility);
      f.accessOverride = { visibility, allowedUserIds: visibility === "specific_people" ? normUserIds(req.body?.allowedUserIds, f.ownerId) : [] };
      f.updatedAt = nowIso();
      logAct(req, u, "updated", "file", f.id, { name: f.name, visibility, folderId: f.folderId });
      ok(res, fileOut(f, u), "File access updated successfully");
    });

    // ============================================================ archive
    function archivedRoots(u) {
      const folders = [...F.values()].filter((f) => f.deletedAt && (!f.parentId || !parentOf(f)?.deletedAt) && archiveVisibleFolder(u, f));
      const files = [...FL.values()].filter((f) => f.deletedAt && (!f.folderId || !F.get(f.folderId)?.deletedAt) && archiveVisibleFile(u, f));
      return { folders, files };
    }
    const byDeleted = (a, b) => (a.deletedAt < b.deletedAt ? 1 : -1);
    const usageFilter = (list, usage) => (usage === "used" ? list.filter((f) => f.isUsed) : usage === "non_used" ? list.filter((f) => !f.isUsed) : list);

    app.get("/api/v1/archive/navigation/root", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const { folders, files } = archivedRoots(u);
      ok(res, {
        folders: page(folders.sort(byDeleted), req.query, (f) => folderOut(f, u, { archive: true })),
        files: page(usageFilter(files, req.query.fileUsage).sort(byDeleted), req.query, (f) => fileOut(f, u)),
      }, "Archive fetched successfully");
    });

    app.get("/api/v1/archive/navigation/folders/:id/contents", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const folder = F.get(req.params.id);
      if (!folder || !folder.deletedAt) return fail(res, 404, "Archived folder not found.");
      if (!archiveVisibleFolder(u, folder)) return fail(res, 403, "You don't have access to this folder.");
      const folders = [...F.values()].filter((f) => f.parentId === folder.id && f.deletedAt).sort(byName);
      const files = usageFilter([...FL.values()].filter((f) => f.folderId === folder.id && f.deletedAt), req.query.fileUsage).sort(byName);
      ok(res, {
        folder: folderOut(folder, u, { archive: true }),
        folders: page(folders, req.query, (f) => folderOut(f, u, { archive: true })),
        files: page(files, req.query, (f) => fileOut(f, u)),
      }, "Archived folder contents fetched successfully");
    });

    app.get("/api/v1/archive/folders", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      ok(res, page(archivedRoots(u).folders.sort(byDeleted), req.query, (f) => folderOut(f, u, { archive: true })), "Archived folders fetched successfully");
    });

    app.get("/api/v1/archive/files", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      ok(res, page(usageFilter(archivedRoots(u).files, req.query.fileUsage).sort(byDeleted), req.query, (f) => fileOut(f, u)), "Archived files fetched successfully");
    });

    function restoreFolderOne(req, u, f) {
      restoreFolderTree(f, u);
      logAct(req, u, "updated", "folder", f.id, { name: f.name, restored: true, parentId: f.parentId });
    }

    app.patch("/api/v1/archive/files/restore", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const files = [].concat(req.body?.ids || []).map((id) => FL.get(String(id))).filter((f) => f && f.deletedAt && archiveVisibleFile(u, f));
      if (!files.length) return fail(res, 404, "No archived files to restore.");
      preflightBoards(u, files);
      for (const f of files) {
        restoreFile(f, u);
        logAct(req, u, "updated", "file", f.id, { name: f.name, restored: true, folderId: f.folderId });
      }
      ok(res, { restored: files.length }, `${files.length} file${files.length === 1 ? "" : "s"} restored`);
    });

    app.patch("/api/v1/archive/folders/restore", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const folders = [].concat(req.body?.ids || []).map((id) => F.get(String(id))).filter((f) => f && f.deletedAt && archiveVisibleFolder(u, f));
      if (!folders.length) return fail(res, 404, "No archived folders to restore.");
      preflightFolderBoards(u, folders);
      for (const f of folders) if (f.deletedAt) restoreFolderOne(req, u, f);
      ok(res, { restored: folders.length }, `${folders.length} folder${folders.length === 1 ? "" : "s"} restored`);
    });

    app.patch("/api/v1/archive/files/:id/restore", restoreFileRoute);

    app.patch("/api/v1/archive/folders/:id/restore", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const f = F.get(req.params.id);
      if (!f || !f.deletedAt) return fail(res, 404, "Archived folder not found.");
      if (!archiveVisibleFolder(u, f)) return fail(res, 403, "You can't restore this folder.");
      restoreFolderOne(req, u, f);
      ok(res, folderOut(f, u), `"${f.name}" was restored`);
    });

    function purgeFiles(req, res, u, files) {
      preflightBoards(u, files);
      for (const f of files) {
        logAct(req, u, "deleted", "file", f.id, { name: f.name, permanent: true, folderId: f.folderId });
        purgeFile(f);
      }
    }
    function purgeFolders(req, res, u, folders) {
      preflightFolderBoards(u, folders);
      for (const f of folders) {
        if (!F.has(f.id)) continue;
        logAct(req, u, "deleted", "folder", f.id, { name: f.name, permanent: true, parentId: f.parentId });
        purgeFolder(f);
      }
    }

    app.delete("/api/v1/archive/files", (req, res) => {
      const u = member(req, res);
      if (!u || !checkPassword(res, u, req.body?.password)) return;
      const files = [].concat(req.body?.ids || []).map((id) => FL.get(String(id))).filter((f) => f && f.deletedAt && canPurge(u, f));
      if (!files.length) return fail(res, 404, "No archived files to delete.");
      purgeFiles(req, res, u, files);
      ok(res, { deleted: files.length }, `${files.length} file${files.length === 1 ? "" : "s"} permanently deleted`);
    });

    app.delete("/api/v1/archive/folders/all", (req, res) => {
      const u = member(req, res);
      if (!u || !checkPassword(res, u, req.body?.password)) return;
      const { folders, files } = archivedRoots(u);
      const f1 = folders.filter((f) => canPurge(u, f));
      const f2 = files.filter((f) => canPurge(u, f));
      purgeFolders(req, res, u, f1);
      purgeFiles(req, res, u, f2.filter((f) => FL.has(f.id)));
      ok(res, { folders: f1.length, files: f2.length }, f1.length + f2.length ? `Archive emptied - ${f1.length + f2.length} item${f1.length + f2.length === 1 ? "" : "s"} permanently deleted` : "The archive is already empty");
    });

    app.delete("/api/v1/archive/folders", (req, res) => {
      const u = member(req, res);
      if (!u || !checkPassword(res, u, req.body?.password)) return;
      const folders = [].concat(req.body?.ids || []).map((id) => F.get(String(id))).filter((f) => f && f.deletedAt && canPurge(u, f));
      if (!folders.length) return fail(res, 404, "No archived folders to delete.");
      purgeFolders(req, res, u, folders);
      ok(res, { deleted: folders.length }, `${folders.length} folder${folders.length === 1 ? "" : "s"} permanently deleted`);
    });

    app.delete("/api/v1/archive/files/:id", (req, res) => {
      const u = member(req, res);
      if (!u || !checkPassword(res, u, req.body?.password)) return;
      const f = FL.get(req.params.id);
      if (!f || !f.deletedAt) return fail(res, 404, "Archived file not found.");
      if (!canPurge(u, f)) return fail(res, 403, "You can't delete this file.");
      purgeFiles(req, res, u, [f]);
      ok(res, null, `"${f.name}" was permanently deleted`);
    });

    app.delete("/api/v1/archive/folders/:id", (req, res) => {
      const u = member(req, res);
      if (!u || !checkPassword(res, u, req.body?.password)) return;
      const f = F.get(req.params.id);
      if (!f || !f.deletedAt) return fail(res, 404, "Archived folder not found.");
      if (!canPurge(u, f)) return fail(res, 403, "You can't delete this folder.");
      purgeFolders(req, res, u, [f]);
      ok(res, null, `"${f.name}" was permanently deleted`);
    });

    // ============================================================ activity & users
    function activityVisible(u, a) {
      if (a.entityType === 'file') {
        const file = FL.get(a.entityId);
        if (file?.whiteboard) return Boolean(file.deletedAt ? archiveVisibleFile(u, file) : fileAccess(u, file));
        if (a.metadata?.boardId) return false;
      }
      if (a.actorId === String(u.id)) return true;
      if (a.entityType === "file") {
        const f = FL.get(a.entityId);
        return Boolean(f && (f.deletedAt ? archiveVisibleFile(u, f) : fileAccess(u, f)));
      }
      const f = F.get(a.entityId);
      return Boolean(f && (f.deletedAt ? archiveVisibleFolder(u, f) : folderAccess(u, f)));
    }

    app.get("/api/v1/activity-logs", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const q = req.query;
      let list = state.activities.filter(a => a.metadata?.boardId || FL.get(a.entityId)?.whiteboard ? activityVisible(u, a) : isAdmin(u) || activityVisible(u, a));
      if (q.actorId && q.actorId !== "all") list = list.filter((a) => a.actorId === String(q.actorId));
      if (q.from) {
        const from = Date.parse(q.from);
        if (!Number.isNaN(from)) list = list.filter((a) => Date.parse(a.createdAt) >= from);
      }
      if (q.to) {
        let to = Date.parse(q.to);
        if (!Number.isNaN(to)) {
          if (/T00:00:00(\.000)?Z$/.test(q.to) || /^\d{4}-\d{2}-\d{2}$/.test(q.to)) to += 864e5 - 1; // a picked date includes the whole day
          list = list.filter((a) => Date.parse(a.createdAt) <= to);
        }
      }
      ok(res, page(list, q, actOut), "Activity logs fetched successfully");
    });

    app.get("/api/users", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      ok(res, identity.users.filter((x) => x.isActive).map(identity.publicUser), "Users fetched successfully");
    });

    // authApi.ts endpoints (defined in the app, not used by any screen) - minimal but functional.
    app.get('/api/auth/profile', (req, res) => {
      const user = member(req, res); if (!user) return;
      return ok(res, identity.publicUser(user), 'Profile fetched successfully');
    });
    app.put("/api/auth/profile", async (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const b = req.body || {};
      if (identity.workspaceMode) {
        try { await commands.execute(ctx, identity, req, u, 'profile.self_update', { patch: commands.profilePatch(b) }); return ok(res, identity.publicUser(identity.findUser(u.id)), 'Profile updated successfully'); }
        catch (error) { return commands.failure(res, error); }
      }
      for (const k of ["firstName", "lastName", "username", "avatar"]) if (typeof b[k] === "string" && b[k].trim()) u[k] = b[k].trim();
      for (const k of ["jobTitle", "department", "about", "language", "timeZone", "weekStartDay", "dateFormat", "timeFormat", "flyoutToastMessage", "timezoneChangeNotification"]) {
        if (b[k] !== undefined) u.profile[k] = b[k];
      }
      u.updatedAt = nowIso();
      ok(res, identity.publicUser(u), "Profile updated successfully");
    });
    app.post("/api/auth/avatar", (req, res, next) => {
      const u = member(req, res);
      if (!u) return;
      ctx.upload.any()(req, res, (err) => {
        if (err) return next(err);
        const f = (req.files || [])[0];
        if (!f) return fail(res, 400, "No image uploaded.");
        u.avatar = ctx.fileUrl(path.basename(f.path));
        res.json({ success: true, message: "Avatar updated", avatar: u.avatar });
      });
    });
    app.delete("/api/auth/avatar", async (req, res) => {
      const u = member(req, res);
      if (!u) return;
      if (identity.workspaceMode) {
        try { await commands.execute(ctx, identity, req, u, 'profile.self_update', { patch: { avatar: null } }); return res.json({ success: true, message: 'Avatar removed' }); }
        catch (error) { return commands.failure(res, error); }
      }
      u.avatar = null;
      res.json({ success: true, message: "Avatar removed" });
    });
    app.post("/api/auth/forgot-password", (req, res) => ok(res, { message: "If the email exists, a reset code was sent." }, "If the email exists, a reset code was sent."));
    app.post("/api/auth/reset-password", (req, res) => ok(res, { message: `Local accounts use the shared password (${identity.LOCAL_PASSWORD}).` }, "Password reset is not needed locally."));

    // ============================================================ shares (owner side)
    const resourceFor = (type, id) => (type === "file" ? FL.get(String(id)) : type === "folder" ? F.get(String(id)) : null);
    function shareStatus(s) {
      if (s.revokedAt) return "revoked";
      if (Date.parse(s.expiresAt) <= Date.now()) return "expired";
      if (s.maxDownloads != null && s.downloadCount >= s.maxDownloads) return "expired";
      return "active";
    }
    // No language in the link: whoever opens it gets the share page in their browser's language
    // (the app redirects /share/… by Accept-Language). It was /en/, so every guest got English.
    const shareUrl = (s, secret = s.secret) => `${ctx.webUrl("files")}/share/${s.id}?secret=${encodeURIComponent(secret)}`;
    function shareOut(s, withUrl = false, secret) {
      return {
        id: s.id, ownerId: String(s.ownerId), resourceType: s.resourceType, resourceId: s.resourceId, label: s.label, permission: s.permission,
        hasPassword: Boolean(s.passwordHash), expiresAt: s.expiresAt, revokedAt: s.revokedAt, maxDownloads: s.maxDownloads,
        downloadCount: s.downloadCount, version: s.version, lastAccessedAt: s.lastAccessedAt, createdAt: s.createdAt, status: shareStatus(s),
        ...(withUrl ? { shareUrl: shareUrl(s, secret) } : {}),
      };
    }
    const hashPw = (p) => crypto.createHash("sha256").update(String(p)).digest("hex");
    const newSecret = lib.newSecret;
    if (identity.workspaceMode) for (const share of state.shares.values()) {
      if (share.secret) share.secretHash = hashPw(share.secret);
      delete share.secret; delete share.seedPassword;
    }
    function canManageShares(u, type, r) {
      if (!r || r.deletedAt) return false;
      return (type === "file" ? fileCaps(u, r) : folderCaps(u, r)).canManageExternalShares;
    }
    const dropSessions = (shareId) => {
      for (const [t, s] of state.sessions) if (s.shareId === shareId) state.sessions.delete(t);
    };

    app.post("/api/v1/shares", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const b = req.body || {};
      if (!["file", "folder"].includes(b.resourceType)) return fail(res, 400, "resourceType must be 'file' or 'folder'.");
      const r = resourceFor(b.resourceType, b.resourceId);
      if (!r || r.deletedAt) return fail(res, 404, `${b.resourceType === "file" ? "File" : "Folder"} not found.`);
      if (r.whiteboard) {
        if (!fileAccess(u, r)) return fail(res, 403, "You can't create external links for this item.");
        return fail(res, 422, 'Structured whiteboards are unavailable in public shares.', { code: 'whiteboard_public_sharing_unavailable' });
      }
      if (!canManageShares(u, b.resourceType, r)) return fail(res, 403, "You can't create external links for this item.");
      const permission = b.permission || "view_only";
      if (!["view_only", "download"].includes(permission)) return fail(res, 400, "permission must be 'view_only' or 'download'.");
      const expires = b.expiresAt ? Date.parse(b.expiresAt) : Date.now() + 7 * 864e5;
      if (Number.isNaN(expires)) return fail(res, 400, "expiresAt must be a valid date.");
      if (expires <= Date.now() + 60e3) return fail(res, 400, "The expiry date must be in the future.");
      if (expires > Date.now() + 366 * 864e5) return fail(res, 400, "Links can be valid for at most one year.");
      if (b.password != null && String(b.password).length > 0 && String(b.password).length < 4) return fail(res, 400, "The link password must have at least 4 characters.");
      let maxDownloads = null;
      if (permission === "download" && b.maxDownloads != null && b.maxDownloads !== "") {
        maxDownloads = Number(b.maxDownloads);
        if (!Number.isInteger(maxDownloads) || maxDownloads < 1 || maxDownloads > 10000) return fail(res, 400, "maxDownloads must be between 1 and 10000.");
      }
      const secret = newSecret();
      const s = {
        id: lib.newId(), ownerId: u.id, resourceType: b.resourceType, resourceId: r.id, label: b.label ? String(b.label).slice(0, 120) : null,
        permission, passwordHash: b.password ? hashPw(b.password) : null, expiresAt: new Date(expires).toISOString(), revokedAt: null,
        maxDownloads, downloadCount: 0, version: 1, ...(identity.workspaceMode ? { secretHash: hashPw(secret) } : { secret }), lastAccessedAt: null, createdAt: nowIso(),
      };
      state.shares.set(s.id, s);
      ok(res, shareOut(s, true, secret), "Share link created", 201);
    });

    app.get("/api/v1/shares", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const { resourceType, resourceId } = req.query;
      const r = resourceFor(resourceType, resourceId);
      if (!r) return fail(res, 404, "Item not found.");
      if (!canManageShares(u, resourceType, r)) return fail(res, 403, "You can't manage external links for this item.");
      const list = [...state.shares.values()].filter((s) => s.resourceType === resourceType && s.resourceId === r.id).sort(byNewest);
      ok(res, list.map((s) => shareOut(s)), "Share links fetched successfully");
    });

    const shareForOwner = (req, res, u) => {
      const s = state.shares.get(req.params.id);
      if (!s) return fail(res, 404, "Share link not found."), null;
      if (!isAdmin(u) && s.ownerId !== u.id && !canManageShares(u, s.resourceType, resourceFor(s.resourceType, s.resourceId))) return fail(res, 403, "You can't manage this link."), null;
      return s;
    };

    app.post("/api/v1/shares/:id/rotate", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const s = shareForOwner(req, res, u);
      if (!s) return;
      if (shareStatus(s) !== "active") return fail(res, 400, "Only active links can be rotated.");
      const secret = newSecret();
      if (identity.workspaceMode) s.secretHash = hashPw(secret); else s.secret = secret;
      s.version += 1;
      dropSessions(s.id);
      ok(res, shareOut(s, true, secret), "New link generated - the previous URL no longer works");
    });

    app.delete("/api/v1/shares/:id", (req, res) => {
      const u = member(req, res);
      if (!u) return;
      const s = shareForOwner(req, res, u);
      if (!s) return;
      if (!s.revokedAt) s.revokedAt = nowIso();
      dropSessions(s.id);
      res.status(204).end();
    });

    // ============================================================ public share (guest, cookie session)
    const cookieName = (shareId) => `fm_share_${shareId}`;
    const publicApi = new URL(apiBase());
    const cookiePath = (shareId) => `${publicApi.pathname.replace(/\/$/, '')}/v1/public/shares/${shareId}`;

    function publicShare(req, res, { session = true } = {}) {
      const s = state.shares.get(req.params.shareId);
      if (!s) return fail(res, 404, "This link is not available."), null;
      const status = shareStatus(s);
      if (status !== "active") return fail(res, 410, status === "revoked" ? "This link has been turned off by its owner." : "This link has expired."), null;
      const r = resourceFor(s.resourceType, s.resourceId);
      if (!r || r.deletedAt || r.whiteboard) return fail(res, 404, "This link is not available."), null;
      if (session) {
        const token = lib.parseCookies(req.headers.cookie)[cookieName(s.id)];
        const sess = token && state.sessions.get(identity.workspaceMode ? hashPw(token) : token);
        if (!sess || sess.shareId !== s.id || sess.version !== s.version || sess.expiresAt < Date.now()) return fail(res, 401, "Open the link you received to view this share."), null;
      }
      return { share: s, resource: r };
    }
    const canDownload = (s) => s.permission === "download" && (s.maxDownloads == null || s.downloadCount < s.maxDownloads);
    const pubFolder = (f) => ({ type: "folder", id: f.id, name: f.name, parentId: f.parentId, createdAt: f.createdAt, updatedAt: f.updatedAt });
    const pubFile = (f) => ({
      type: "file", id: f.id, name: f.name, originalName: f.name, mimeType: f.mimeType, size: Number(f.size), createdAt: f.createdAt, updatedAt: f.updatedAt,
      previewStatus: previewManifest(f).status,
    });
    function shareFile(res, share, resource, fileId) {
      const f = FL.get(fileId);
      const inside = f && !f.deletedAt && !f.whiteboard && (share.resourceType === "file" ? f.id === resource.id : f.folderId && within(F.get(f.folderId), resource.id));
      if (!inside) return fail(res, 404, "File not found in this share."), null;
      return f;
    }

    // failed-attempt limiter (per share + ip)
    function limited(key) {
      const e = state.failures.get(key);
      if (!e) return false;
      if (Date.now() - e.first > 10 * 60e3) {
        state.failures.delete(key);
        return false;
      }
      return e.count >= 8;
    }
    function recordFailure(key) {
      const e = state.failures.get(key);
      if (!e || Date.now() - e.first > 10 * 60e3) state.failures.set(key, { count: 1, first: Date.now() });
      else e.count += 1;
    }

    app.post("/api/v1/public/shares/:shareId/session", (req, res) => {
      const found = publicShare(req, res, { session: false });
      if (!found) return;
      const { share } = found;
      const key = `${share.id}|${req.ip}`;
      if (limited(key)) return fail(res, 429, "Too many attempts. Please wait a few minutes and try again.");
      const { secret, password } = req.body || {};
      const a = Buffer.from(identity.workspaceMode ? hashPw(secret || "") : String(secret || ""));
      const b = Buffer.from(identity.workspaceMode ? share.secretHash : share.secret);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        recordFailure(key);
        return fail(res, 404, "This link is not available.");
      }
      if (share.passwordHash) {
        if (!password) return fail(res, 401, "This link is protected with a password.", { passwordRequired: true });
        if (hashPw(password) !== share.passwordHash) {
          recordFailure(key);
          return fail(res, 401, "Incorrect password.", { passwordRequired: true });
        }
      }
      const token = newSecret();
      const expiresAt = Math.min(Date.parse(share.expiresAt), Date.now() + 12 * 3600e3);
      state.sessions.set(identity.workspaceMode ? hashPw(token) : token, { shareId: share.id, version: share.version, expiresAt });
      share.lastAccessedAt = nowIso();
      res.cookie(cookieName(share.id), token, { httpOnly: true, sameSite: publicApi.protocol === 'https:' ? 'none' : 'lax', secure: publicApi.protocol === 'https:', path: cookiePath(share.id), maxAge: expiresAt - Date.now() });
      res.status(204).end();
    });

    app.get("/api/v1/public/shares/:shareId", (req, res) => {
      const found = publicShare(req, res);
      if (!found) return;
      const { share, resource } = found;
      ok(res, {
        shareId: share.id, permission: share.permission, expiresAt: share.expiresAt,
        resource: share.resourceType === "file" ? pubFile(resource) : pubFolder(resource),
        capabilities: { canPreview: true, canDownload: canDownload(share) },
      }, "Share fetched successfully");
    });

    app.get("/api/v1/public/shares/:shareId/items", (req, res) => {
      const found = publicShare(req, res);
      if (!found) return;
      const { share, resource } = found;
      if (share.resourceType !== "folder") return fail(res, 400, "This link points to a single file.");
      const parent = req.query.parentFolderId ? F.get(String(req.query.parentFolderId)) : resource;
      if (!parent || parent.deletedAt || !within(parent, resource.id)) return fail(res, 404, "Folder not found in this share.");
      const items = [
        ...activeFolders().filter((f) => f.parentId === parent.id).sort(byName).map(pubFolder),
        ...activeFiles().filter((f) => f.folderId === parent.id && !f.whiteboard).sort(byName).map(pubFile),
      ];
      const { items: pageItems, meta } = util.paginate(items, req.query, { defaultLimit: 50 });
      ok(res, { parent: pubFolder(parent), rootId: resource.id, items: pageItems, meta }, "Share items fetched successfully");
    });

    // ---- previews: seeded assets come pre-rendered (page PNGs / HLS); uploads are rendered on demand
    const uploadPages = state.previewPages; // fileId -> [svg]
    function uploadPreview(f) {
      if (f.mimeType.startsWith("image/")) return { kind: "image" };
      const ext = lib.extOf(f.name);
      let pages = uploadPages.get(f.id);
      if (!pages) {
        try {
          if (f.mimeType === "text/csv" || ext === "csv") pages = lib.csvPreviewPages(f.name, readBytes(f).toString("utf8"));
          else if (f.mimeType.startsWith("text/") || ["txt", "md", "json", "log"].includes(ext)) pages = lib.textPreviewPages(f.name, readBytes(f).toString("utf8"), ext === "json" || ext === "log");
          else if (ext === "docx") pages = lib.docxPreviewPages(f.name, readBytes(f));
          else return { kind: "unsupported" };
        } catch {
          return { kind: "failed" };
        }
        if (!pages) return { kind: "failed" };
        uploadPages.set(f.id, pages);
      }
      return { kind: "pages", pages };
    }
    function previewManifest(f) {
      if (f.whiteboard) return { status: 'ready', kind: 'sample', sample: true, mimeType: 'image/svg+xml' };
      if (f.storage.kind === "asset") {
        const m = MANIFEST[f.storage.key];
        const p = m.preview;
        if (p.kind === "image") return { status: "ready", kind: "image", entryKey: "original", assets: [{ key: "original", mimeType: f.mimeType, size: m.size }] };
        if (p.kind === "pages") return { status: "ready", kind: "pages", pageCount: p.pageCount, assets: p.assets.map(({ key, mimeType, size }) => ({ key, mimeType, size })) };
        if (p.kind === "hls_video") return { status: "ready", kind: "hls_video", entryKey: p.entryKey, assets: p.assets.map(({ key, mimeType, size }) => ({ key, mimeType, size })) };
        return { status: "unsupported" };
      }
      if (f.previewReadyAt && Date.now() < f.previewReadyAt) return { status: "processing" };
      const p = uploadPreview(f);
      if (p.kind === "image") return { status: "ready", kind: "image", entryKey: "original", assets: [{ key: "original", mimeType: f.mimeType, size: Number(f.size) }] };
      if (p.kind === "pages") return { status: "ready", kind: "pages", pageCount: p.pages.length, assets: p.pages.map((svg, i) => ({ key: `page-${i + 1}.svg`, mimeType: "image/svg+xml", size: Buffer.byteLength(svg) })) };
      return { status: p.kind === "failed" ? "failed" : "unsupported" };
    }

    app.get("/api/v1/public/shares/:shareId/files/:fileId/preview", (req, res) => {
      const found = publicShare(req, res);
      if (!found) return;
      const f = shareFile(res, found.share, found.resource, req.params.fileId);
      if (f) ok(res, previewManifest(f), "Preview fetched successfully");
    });

    app.get("/api/v1/public/shares/:shareId/files/:fileId/preview/assets/:assetKey", (req, res) => {
      const found = publicShare(req, res);
      if (!found) return;
      const f = shareFile(res, found.share, found.resource, req.params.fileId);
      if (!f) return;
      const key = req.params.assetKey;
      res.setHeader("Cache-Control", "private, max-age=300");
      if (key === "original" && f.mimeType.startsWith("image/")) {
        res.setHeader("Content-Type", f.mimeType);
        return res.sendFile(storedPath(f), { dotfiles: "allow" });
      }
      if (f.storage.kind === "asset") {
        const asset = (MANIFEST[f.storage.key].preview.assets || []).find((a) => a.key === key);
        if (!asset) return fail(res, 404, "Preview asset not found.");
        res.setHeader("Content-Type", asset.mimeType);
        return res.sendFile(path.join(ASSET_DIR, asset.file), { dotfiles: "allow" });
      }
      const m = /^page-(\d+)\.svg$/.exec(key);
      const pages = uploadPreview(f).pages;
      if (!m || !pages || !pages[Number(m[1]) - 1]) return fail(res, 404, "Preview asset not found.");
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.send(pages[Number(m[1]) - 1]);
    });

    app.get("/api/v1/public/shares/:shareId/download", (req, res) => {
      const found = publicShare(req, res);
      if (!found) return;
      const { share, resource } = found;
      if (!canDownload(share)) return fail(res, 403, "Downloading is turned off for this link.");
      share.downloadCount += 1;
      share.lastAccessedAt = nowIso();
      if (share.resourceType === "file") return sendStored(res, resource, "attachment");
      const buf = zipFolder(resource, file => !file.whiteboard);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", lib.contentDisposition("attachment", `${resource.name}.zip`));
      res.setHeader("Cache-Control", "private, no-store");
      res.send(buf);
    });

    app.get("/api/v1/public/shares/:shareId/files/:fileId/download", (req, res) => {
      const found = publicShare(req, res);
      if (!found) return;
      const { share, resource } = found;
      if (!canDownload(share)) return fail(res, 403, "Downloading is turned off for this link.");
      const f = shareFile(res, share, resource, req.params.fileId);
      if (!f) return;
      share.downloadCount += 1;
      share.lastAccessedAt = nowIso();
      sendStored(res, f, "attachment");
    });

    // Handy for QA: the seeded external links (their secrets are deterministic).
    if (!identity.workspaceMode) for (const s of state.shares.values()) {
      if (shareStatus(s) === "active") ctx.log(`seeded share "${s.label}"${s.seedPassword ? ` (password: ${s.seedPassword})` : ""}: ${shareUrl(s)}`);
    }
    return {
      serializeFile: fileOut,
      serializeFolder: folderOut, publicShare, shareOut, shareStatus, logActivity: logAct,
      exportState: () => ({ data: require("./files/runtime-state").encode(state), sequences: lib.exportCounters() }),
      bootstrap: user => ({ folders: activeFolders().filter(folder => folderAccess(user, folder)).map(folder => folderOut(folder, user)), files: activeFiles().filter(file => fileAccess(user, file)).map(file => fileOut(file, user)) }),
      usage: () => [{ key: "files.storage_gb", used: [...FL.values()].reduce((total, file) => total + Number(file.size || 0), 0) / 1024 ** 3 }],
      transferOwnership: command => {
        const { fromUserId, target, operationId } = command;
        if (!Number.isSafeInteger(fromUserId) || !operationId || !target || !['member', 'archive'].includes(target.kind)) throw Object.assign(new Error("Invalid Files custody command."), { status: 422 });
        const recipient = target.kind === 'member' && identity.findUser(target.userId);
        if (target.kind === 'member' && (!recipient || recipient.id === fromUserId || recipient.isActive === false || !toolRoles(recipient).some(role => role === 'super_admin' || role === 'file_editor'))) throw Object.assign(new Error("The Files custody recipient is not eligible."), { status: 409 });
        const result = { transferred: [], archived: [] };
        const boardTargets = new Map();
        if (recipient) for (const file of FL.values()) {
          if (file.ownerId !== fromUserId || !file.whiteboard) continue;
          if (typeof ctx.boardAuthority?.custodyTarget !== 'function') throw Object.assign(new Error('Whiteboard custody authority is unavailable.'), { status: 503, code: 'whiteboard_authority_unavailable' });
          const eligible = ctx.boardAuthority.custodyTarget({ boardId: file.whiteboard.boardId, fromUserId, targetUserId: recipient.id });
          if (typeof eligible !== 'boolean') throw Object.assign(new Error('Whiteboard custody authority is unavailable.'), { status: 503, code: 'whiteboard_authority_unavailable' });
          boardTargets.set(file.id, eligible);
        }
        for (const [kind, records] of [['folder', F], ['file', FL]]) for (const row of records.values()) {
          if (row.ownerId !== fromUserId) continue;
          const inherit = recipient && (!row.whiteboard || boardTargets.get(row.id));
          row.ownerId = inherit ? recipient.id : null; row.updatedAt = nowIso(); row.custodyOperationId = operationId;
          if (inherit) { row.allowedUserIds = (row.allowedUserIds || []).filter(id => id !== recipient.id); result.transferred.push(`${kind}:${row.id}`); }
          else { row.custodyReadOnly = true; row.deletedAt ||= nowIso(); row.archiveBatch = `custody:${operationId}`; result.archived.push(`${kind}:${row.id}`); }
        }
        for (const share of state.shares.values()) if (share.ownerId === fromUserId) { share.revokedAt ||= nowIso(); dropSessions(share.id); }
        for (const row of [...F.values(), ...FL.values()]) {
          row.allowedUserIds = (row.allowedUserIds || []).filter(id => id !== fromUserId);
          if (row.accessOverride) {
            row.accessOverride.allowedUserIds = row.accessOverride.allowedUserIds.filter(id => id !== fromUserId);
            if (row.accessOverride.permissions) row.accessOverride.permissions = row.accessOverride.permissions.filter(grant => grant.userId !== fromUserId && grant.userId !== row.ownerId);
          }
        }
        state.pins.delete(fromUserId);
        return result;
      },
      close: () => {},
    };
  },
  createWorkspaceRuntime: input => require("../lib/tool-adapters/files").createWorkspaceRuntime(input, module.exports, MANIFEST),
};
