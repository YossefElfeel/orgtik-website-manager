// Ordinary Files features. Every record belongs to the existing Files graph;
// public requests use the existing secret/cookie capability, never a fake user.
const express = require("express");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const lib = require("./lib");
const { createFileAccess } = require("./access");
const clone = (value) => JSON.parse(JSON.stringify(value));
const problem = (status, code, message) =>
  Object.assign(new Error(message), { status, code });
const DEFAULTS = {
  safetyBytes: null,
  defaultExpiryDays: 7,
  requestLinks: true,
  trashDays: 30,
  versionPolicy: "retain_all",
};
function create({
  state,
  identity,
  ctx,
  manifest,
  hooks,
  shared,
  workspaceId,
}) {
  state.workspaceFeatures ||= new Map();
  const store = state.workspaceFeatures,
    files = state.files,
    folders = state.folders;
  const access = createFileAccess({
    state,
    identity,
    boardAuthority: ctx.boardAuthority,
  });
  const at = () => new Date().toISOString(),
    actorName = (id) => {
      const user = identity.findUser(id);
      return user ? identity.fullName(user) : "Former member";
    };
  const settings = () => ({ ...DEFAULTS, ...store.get("settings") });
  const rows = (prefix) =>
    [...store].filter(([key]) => key.startsWith(prefix)).map(([, row]) => row);
  const retainedBytes = () =>
    [...files.values()].reduce(
      (total, file) =>
        total +
        (file.versions?.length
          ? file.versions.reduce((sum, row) => sum + Number(row.size || 0), 0)
          : Number(file.size || 0)),
      0,
    );
  const purgeDue = () =>
    [...files.values()].filter(
      (file) =>
        file.deletedAt &&
        Date.parse(file.deletedAt) <=
          Date.now() - settings().trashDays * 864e5 &&
        !file.custodyReadOnly &&
        !file.whiteboard &&
        !access
          .chain(folders.get(file.folderId))
          .some((row) => row.custodyReadOnly),
    );
  const policy = () => {
    if (typeof ctx.filesPolicy !== "function")
      throw problem(
        503,
        "files_policy_unavailable",
        "The current Files subscription policy is unavailable.",
      );
    const current = ctx.filesPolicy();
    const safety = settings().safetyBytes;
    return {
      ...current,
      usedBytes: retainedBytes(),
      purgeDueCount: purgeDue().length,
      effectiveBytes:
        current.storageBytes == null
          ? null
          : safety == null
            ? current.storageBytes
            : Math.min(current.storageBytes, safety),
      settings: settings(),
    };
  };
  function writable(user) {
    if (
      !policy().canWrite ||
      typeof identity.canWrite !== "function" ||
      !identity.canWrite(user) ||
      !access
        .toolRoles(user)
        .some((role) => ["super_admin", "file_editor"].includes(role))
    )
      throw problem(
        403,
        "file_role_read_only",
        "Your current Files role is read-only.",
      );
  }
  function canAdmin(user) {
    const context = identity.currentContext?.();
    return (
      access.isAdmin(user) ||
      Boolean(
        context?.workspace?.id === workspaceId &&
        context.actor?.effectiveUserId === user.id &&
        ["owner", "admin"].includes(context.member?.role),
      )
    );
  }
  function admin(user, write = false) {
    if (!canAdmin(user))
      throw problem(
        403,
        "tool_admin_required",
        "Ask your Files administrator.",
      );
    if (write) writable(user);
  }
  function quota(bytes) {
    const p = policy();
    if (!p.canAcceptSamples)
      throw problem(
        423,
        "storage_unavailable",
        "Files storage is read-only or unavailable.",
      );
    if (p.effectiveBytes == null || p.usedBytes + bytes > p.effectiveBytes)
      throw problem(
        409,
        "storage_quota_exceeded",
        "Storage is full. Purge eligible trash or increase the storage allowance.",
      );
  }
  function fileFor(user, id, archived = false) {
    const file = files.get(String(id));
    if (
      !file ||
      !access.fileAccess(user, file) ||
      (!archived && !access.activeFile(file))
    )
      throw problem(404, "file_not_found", "This file is unavailable.");
    return file;
  }
  function targetFor(user, id) {
    if (id == null || id === "") return null;
    const folder = folders.get(String(id));
    if (
      !folder ||
      access
        .chain(folder)
        .some((row) => row.deletedAt || row.custodyReadOnly) ||
      !access.folderCaps(user, folder).canWrite
    )
      throw problem(
        403,
        "folder_unavailable",
        "Choose a writable destination folder.",
      );
    return folder;
  }
  const safeName = (value) => {
    if (typeof value !== "string")
      throw problem(422, "invalid_name", "Use a valid text file name.");
    const name = String(value || "").trim();
    if (
      !name ||
      name.length > 180 ||
      /[\\/\x00-\x1f]/.test(name) ||
      name === "." ||
      name === ".."
    )
      throw problem(422, "invalid_name", "Use a file name without slashes.");
    return name;
  };
  function uniqueName(name, folderId, except, keepBoth) {
    const clash = (candidate) =>
      [...files.values()].some(
        (row) =>
          row.id !== except &&
          access.activeFile(row) &&
          (row.folderId || null) === (folderId || null) &&
          row.name.toLocaleLowerCase() === candidate.toLocaleLowerCase(),
      );
    if (!clash(name)) return name;
    if (!keepBoth)
      throw problem(
        409,
        "name_collision",
        "A file with this name already exists. Choose Keep both or a new name.",
      );
    const dot = name.lastIndexOf("."),
      base = dot > 0 ? name.slice(0, dot) : name,
      ext = dot > 0 ? name.slice(dot) : "";
    for (let n = 2; n < 10000; n++) {
      const candidate = `${base} (${n})${ext}`;
      if (!clash(candidate)) return candidate;
    }
    throw problem(409, "name_collision", "Choose another file name.");
  }
  const samples = () =>
    Object.entries(manifest)
      .filter(
        ([key, item]) =>
          !key.startsWith("whiteboard") && item.file?.startsWith("originals/"),
      )
      .map(([id, item]) => ({
        id,
        name: path.basename(item.file),
        mimeType: item.mimeType,
        size: item.size,
        preview: item.preview?.kind || "unsupported",
      }));
  function asset(id) {
    const item = samples().find((row) => row.id === id);
    if (!item)
      throw problem(422, "invalid_sample", "Choose a packaged sample.");
    const bytes = fs.readFileSync(
      path.resolve(__dirname, "assets", manifest[id].file),
    );
    if (bytes.length !== item.size)
      throw problem(
        503,
        "sample_unavailable",
        "The packaged sample is unavailable.",
      );
    return {
      ...item,
      hash: crypto.createHash("sha256").update(bytes).digest("hex"),
      storage: { kind: "asset", key: id },
    };
  }
  function versions(file) {
    return (
      file.versions || [
        {
          id: "v1",
          number: 1,
          storage: clone(file.storage),
          size: Number(file.size),
          mimeType: file.mimeType,
          name: file.name,
          createdAt: file.createdAt,
          createdBy: file.ownerId,
        },
      ]
    );
  }
  function fileOut(user, file) {
    const pref = store.get(`person:${user.id}`) || {};
    return {
      ...hooks.serializeFile(file, user),
      versionId: file.currentVersionId || "v1",
      version: versions(file).length,
      starred: (pref.starred || []).includes(file.id),
      lastOpenedAt: pref.recent?.[file.id] || null,
      canComment: access.fileCaps(user, file).canComment,
      custodyReadOnly: Boolean(file.custodyReadOnly),
    };
  }
  function log(req, user, action, file, metadata = {}) {
    hooks.logActivity(req, user, action, "file", file.id, {
      name: file.name,
      ...metadata,
    });
    file.updatedAt = at();
  }
  function receipt(req, actor, fn) {
    const operationId = req.get("idempotency-key");
    if (
      !/^[\w.:-]{1,100}$/.test(operationId || "") ||
      ["constructor", "prototype", "__proto__"].includes(operationId)
    )
      throw problem(
        422,
        "operation_id_required",
        "Keep the original action reference when retrying.",
      );
    const key = `operation:${actor}:${operationId}`,
      fingerprint = crypto
        .createHash("sha256")
        .update(JSON.stringify([req.method, req.path, req.body]))
        .digest("hex"),
      prior = store.get(key);
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw problem(
          409,
          "operation_conflict",
          "This reference was already used for another action.",
        );
      return clone(prior.result);
    }
    const result = fn(),
      persisted = clone(result);
    // A creation receipt recovers the link record, never its secret. Rotation is
    // the explicit way to obtain a new URL after losing the one-time response.
    if (persisted.shareUrl) {
      delete persisted.shareUrl;
      persisted.receiptRecovery = "rotate_link_for_new_secret";
    }
    store.set(key, { fingerprint, result: persisted });
    return result;
  }
  function addAsset(sample, name, folderId, ownerId, submittedBy) {
    quota(sample.size);
    const timestamp = at(),
      id = lib.newId();
    const file = {
      id,
      name,
      originalName: sample.name,
      ownerId,
      folderId: folderId || null,
      size: sample.size,
      mimeType: sample.mimeType,
      storage: clone(sample.storage),
      accessOverride: null,
      isUsed: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      archivedBy: null,
      archiveBatch: null,
      versions: [
        {
          id: "v1",
          number: 1,
          name,
          mimeType: sample.mimeType,
          size: sample.size,
          storage: clone(sample.storage),
          hash: sample.hash,
          createdAt: timestamp,
          createdBy: submittedBy ? null : ownerId,
        },
      ],
      currentVersionId: "v1",
      ...(submittedBy ? { submittedBy } : {}),
    };
    files.set(id, file);
    return file;
  }
  const middleware = express.Router();
  const respond = (fn) => (req, res, next) => {
    try {
      const result = fn(req, res);
      if (!res.headersSent)
        res
          .set("Cache-Control", "private, no-store")
          .json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
  const own = (fn, write = false) =>
    respond((req, res) => {
      const user = identity.requireUser(req, res);
      if (!user) return;
      if (write) writable(user);
      return fn(req, user);
    });
  const allowedBodies = {
    samples: ["sampleId", "name", "folderId", "keepBoth"],
    version: ["sampleId", "baseVersionId"],
    rename: ["name", "keepBoth"],
    duplicate: ["name", "folderId"],
    access: ["permissions", "notify"],
    comment: ["text"],
    star: ["starred"],
    open: [],
    bulk: ["ids", "action", "folderId", "keepBoth"],
    settings: Object.keys(DEFAULTS),
    purge: [],
    requests: ["folderId", "label", "password", "maxSubmissions"],
    revoke: [],
  };
  const validBody = (body, allowed) => {
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => !allowed.includes(key))
    )
      throw problem(
        422,
        "invalid_file_payload",
        "Supply only the fields for this action.",
      );
  };
  const post = (url, fn) =>
    middleware.post(
      url,
      own((req, user) => {
        validBody(req.body, allowedBodies[url.split("/").at(-1)] || []);
        if (req.params.id && req.path.startsWith("/api/v1/files-v3/files/")) {
          const file = fileFor(user, req.params.id),
            caps = access.fileCaps(user, file),
            action = req.path.split("/").at(-1);
          if (
            (["rename", "version", "duplicate"].includes(action) &&
              !caps.canWrite) ||
            (action === "access" && !caps.canManageAccess) ||
            (action === "comment" && !caps.canComment)
          )
            throw problem(
              403,
              "file_action_denied",
              "Your current file permission does not allow this action.",
            );
        }
        if (req.path === "/api/v1/files-v3/samples")
          targetFor(user, req.body.folderId);
        const result = receipt(req, user.id, () => fn(req, user));
        if (result?.id && result.mimeType) fileFor(user, result.id);
        return result;
      }, true),
    );
  const base = "/api/v1/files-v3";
  middleware.get(
    `${base}/library`,
    own((req, user) => {
      const pref = store.get(`person:${user.id}`) || {},
        view = String(req.query.view || "all"),
        query = String(req.query.q || "")
          .toLocaleLowerCase()
          .slice(0, 200),
        type = String(req.query.type || "all"),
        folder = req.query.folder;
      if (folder) {
        const parent = folders.get(String(folder));
        if (
          !parent ||
          access
            .chain(parent)
            .some((row) => row.deletedAt || row.custodyReadOnly) ||
          !access.folderAccess(user, parent)
        )
          throw problem(404, "folder_not_found", "This folder is unavailable.");
      }
      let list = [...files.values()].filter(
        (file) =>
          access.fileAccess(user, file) &&
          (view === "trash"
            ? Boolean(file.deletedAt)
            : access.activeFile(file)),
      );
      if (view === "my") list = list.filter((file) => file.ownerId === user.id);
      if (view === "shared")
        list = list.filter((file) => file.ownerId !== user.id);
      if (view === "starred")
        list = list.filter((file) => (pref.starred || []).includes(file.id));
      if (view === "recent")
        list = list.filter((file) => pref.recent?.[file.id]);
      if (folder !== undefined)
        list = list.filter((file) => (file.folderId || "") === String(folder));
      if (query)
        list = list.filter((file) =>
          file.name.toLocaleLowerCase().includes(query),
        );
      if (type !== "all")
        list = list.filter((file) =>
          type === "board"
            ? Boolean(file.whiteboard)
            : type === "sheet"
              ? /spreadsheet|excel|csv/.test(file.mimeType)
              : type === "slide"
                ? /presentation|powerpoint/.test(file.mimeType)
                : file.mimeType.startsWith(type),
        );
      const sort = String(
        req.query.sort || (view === "recent" ? "recent" : "updated"),
      );
      list.sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "size"
            ? b.size - a.size
            : String(
                sort === "recent" ? pref.recent?.[b.id] : b.updatedAt,
              ).localeCompare(
                String(sort === "recent" ? pref.recent?.[a.id] : a.updatedAt),
              ),
      );
      return {
        files: list.map((file) => fileOut(user, file)),
        folders: [...folders.values()]
          .filter(
            (folder) =>
              !access
                .chain(folder)
                .some((row) => row.deletedAt || row.custodyReadOnly) &&
              access.folderAccess(user, folder),
          )
          .map((folder) => hooks.serializeFolder(folder, user)),
        policy: policy(),
        samples: samples(),
        preferences: clone(pref),
        isAdmin: canAdmin(user),
        canWrite: policy().canWrite,
      };
    }),
  );
  middleware.get(
    `${base}/files/:id`,
    own((req, user) => {
      const file = fileFor(user, req.params.id, true),
        caps = access.fileCaps(user, file);
      return {
        file: fileOut(user, file),
        versions: versions(file).map(({ storage, ...row }) => ({
          ...row,
          createdByKind:
            (row.createdBy ?? row.createdById) == null &&
            file.submittedBy?.kind === "public_request"
              ? "link_visitor"
              : identity.findUser(row.createdBy ?? row.createdById)
                ? "member"
                : "former_member",
          createdByName:
            (row.createdBy ?? row.createdById) == null &&
            file.submittedBy?.kind === "public_request"
              ? "Link visitor"
              : actorName(row.createdBy ?? row.createdById),
          downloadPath: `/api/v1/files/${file.id}/versions/${row.id}/download`,
        })),
        comments: rows(`comment:${file.id}:`).map((row) => ({
          ...row,
          author: actorName(row.actorId),
        })),
        permissions: caps.canManageAccess
          ? clone(file.accessOverride?.permissions || [])
          : [],
        people: caps.canManageAccess
          ? identity.users
              .filter(
                (person) =>
                  person.isActive !== false &&
                  access.toolRoles(person).length &&
                  person.id !== file.ownerId &&
                  !access.isAdmin(person),
              )
              .map((person) => ({
                id: person.id,
                name: identity.fullName(person),
                email: person.email,
                roleReadOnly: !access
                  .toolRoles(person)
                  .some((role) =>
                    ["super_admin", "file_editor"].includes(role),
                  ),
              }))
          : [],
        shares: caps.canManageExternalShares
          ? [...state.shares.values()]
              .filter(
                (row) =>
                  row.resourceType === "file" && row.resourceId === file.id,
              )
              .map((row) => hooks.shareOut(row))
          : [],
        policy: policy(),
      };
    }),
  );
  post(`${base}/samples`, (req, user) => {
    const sample = asset(req.body.sampleId),
      folder = targetFor(user, req.body.folderId),
      name = uniqueName(
        safeName(req.body.name || sample.name),
        folder?.id,
        null,
        req.body.keepBoth === true,
      );
    const file = addAsset(sample, name, folder?.id, user.id);
    log(req, user, "uploaded", file, { packagedSample: true });
    return fileOut(user, file);
  });
  post(`${base}/files/:id/version`, (req, user) => {
    const file = fileFor(user, req.params.id);
    if (!access.fileCaps(user, file).canWrite)
      throw problem(403, "file_edit_required", "Ask for edit access.");
    if (file.whiteboard)
      throw problem(
        422,
        "source_whiteboard_required",
        "Edit this whiteboard in its source chat.",
      );
    if (req.body.baseVersionId !== (file.currentVersionId || "v1"))
      throw problem(
        409,
        "version_conflict",
        "A newer version is available. Reload before adding a version.",
      );
    const sample = asset(req.body.sampleId);
    if (sample.mimeType !== file.mimeType)
      throw problem(
        422,
        "version_type_mismatch",
        "Choose a sample with the same file type.",
      );
    quota(sample.size);
    const list = versions(file),
      number = Math.max(...list.map((row) => row.number)) + 1,
      version = {
        id: `v${number}`,
        number,
        name: file.name,
        mimeType: sample.mimeType,
        size: sample.size,
        storage: clone(sample.storage),
        hash: sample.hash,
        createdAt: at(),
        createdBy: user.id,
      };
    file.versions = [...list, version];
    file.currentVersionId = version.id;
    file.storage = clone(sample.storage);
    file.size = sample.size;
    log(req, user, "version_added", file, { versionId: version.id });
    return fileOut(user, file);
  });
  post(`${base}/files/:id/rename`, (req, user) => {
    const file = fileFor(user, req.params.id);
    if (!access.fileCaps(user, file).canWrite)
      throw problem(403, "file_edit_required", "Ask for edit access.");
    const oldName = file.name;
    file.name = uniqueName(
      safeName(req.body.name),
      file.folderId,
      file.id,
      req.body.keepBoth === true,
    );
    log(req, user, "renamed", file, { oldName });
    return fileOut(user, file);
  });
  post(`${base}/files/:id/duplicate`, (req, user) => {
    const file = fileFor(user, req.params.id);
    if (!access.fileCaps(user, file).canWrite || file.whiteboard)
      throw problem(
        403,
        "duplicate_unavailable",
        "This file cannot be duplicated here.",
      );
    const sample = asset(file.storage.key),
      folder = targetFor(
        user,
        req.body.folderId === undefined ? file.folderId : req.body.folderId,
      ),
      name = uniqueName(
        safeName(req.body.name || file.name),
        folder?.id,
        null,
        true,
      ),
      duplicate = addAsset(sample, name, folder?.id, user.id);
    log(req, user, "duplicated", duplicate, { sourceFileId: file.id });
    return fileOut(user, duplicate);
  });
  post(`${base}/files/:id/access`, (req, user) => {
    const file = fileFor(user, req.params.id);
    if (!access.fileCaps(user, file).canManageAccess)
      throw problem(
        403,
        "file_owner_required",
        "Ask the file owner to change access.",
      );
    const list = req.body.permissions;
    if (
      !Array.isArray(list) ||
      list.length > 100 ||
      new Set(list.map((row) => row.userId)).size !== list.length ||
      list.some(
        (row) =>
          !row ||
          !Number.isSafeInteger(row.userId) ||
          !["view", "comment", "edit"].includes(row.permission) ||
          !identity.findUser(row.userId) ||
          identity.findUser(row.userId).isActive === false ||
          !access.toolRoles(identity.findUser(row.userId)).length ||
          row.userId === file.ownerId ||
          access.isAdmin(identity.findUser(row.userId)),
      )
    )
      throw problem(
        422,
        "invalid_file_permissions",
        "Choose current Files members and a valid permission.",
      );
    file.accessOverride = {
      visibility: "specific_people",
      allowedUserIds: list.map((row) => row.userId),
      permissions: list.map((row) => ({
        userId: row.userId,
        permission: row.permission,
      })),
    };
    log(req, user, "access_updated", file);
    const notificationIds = [];
    if (req.body.notify === true)
      for (const row of list) {
        const id = lib.newId();
        store.set(`notice:${id}`, {
          id,
          fileId: file.id,
          recipientId: row.userId,
          title: `${identity.fullName(user)} shared ${file.name}`,
          category: "files",
          createdAt: at(),
          path: `/file/${file.id}`,
        });
        notificationIds.push(id);
      }
    return {
      file: fileOut(user, file),
      notificationIds,
      delivery: "in_app_mock",
    };
  });
  post(`${base}/files/:id/comment`, (req, user) => {
    const file = fileFor(user, req.params.id);
    if (!access.fileCaps(user, file).canComment)
      throw problem(403, "file_comment_required", "Ask for comment access.");
    const text = String(req.body.text || "").trim();
    if (!text || text.length > 2000)
      throw problem(
        422,
        "invalid_comment",
        "Write a comment of up to 2,000 characters.",
      );
    const id = lib.newId(),
      row = { id, fileId: file.id, actorId: user.id, text, createdAt: at() };
    store.set(`comment:${file.id}:${id}`, row);
    log(req, user, "commented", file);
    return { ...row, author: identity.fullName(user) };
  });
  post(`${base}/files/:id/star`, (req, user) => {
    const file = fileFor(user, req.params.id),
      pref = store.get(`person:${user.id}`) || {},
      starred = new Set(pref.starred || []);
    req.body.starred === true ? starred.add(file.id) : starred.delete(file.id);
    store.set(`person:${user.id}`, { ...pref, starred: [...starred] });
    return { starred: starred.has(file.id) };
  });
  post(`${base}/files/:id/open`, (req, user) => {
    const file = fileFor(user, req.params.id),
      pref = store.get(`person:${user.id}`) || {};
    store.set(`person:${user.id}`, {
      ...pref,
      recent: { ...pref.recent, [file.id]: at() },
    });
    return { fileId: file.id };
  });
  post(`${base}/bulk`, (req, user) => {
    const ids = req.body.ids,
      action = req.body.action;
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 100 ||
      new Set(ids).size !== ids.length ||
      !["move", "archive", "restore"].includes(action)
    )
      throw problem(
        422,
        "invalid_bulk_action",
        "Choose up to 100 files and a valid action.",
      );
    const destination =
        action === "move" ? targetFor(user, req.body.folderId) : null,
      succeeded = [],
      failed = [];
    for (const id of ids) {
      try {
        const file = fileFor(user, id, action === "restore"),
          caps = access.fileCaps(user, file);
        if (
          file.custodyReadOnly ||
          access
            .chain(folders.get(file.folderId))
            .some((row) => row.custodyReadOnly) ||
          !caps[action === "move" ? "canMove" : "canArchive"]
        )
          throw problem(403, "file_action_denied", "This file is read-only.");
        if (action === "move") {
          file.name = uniqueName(
            file.name,
            destination?.id,
            file.id,
            req.body.keepBoth === true,
          );
          file.folderId = destination?.id || null;
        }
        if (action === "archive") {
          file.deletedAt = at();
          file.archivedBy = user.id;
          file.archiveBatch = `ordinary:${req.get("idempotency-key")}`;
        }
        if (action === "restore") {
          if (
            access
              .chain(folders.get(file.folderId))
              .some((row) => row.deletedAt)
          )
            throw problem(
              409,
              "parent_archived",
              "Restore the parent folder first.",
            );
          file.name = uniqueName(
            file.name,
            file.folderId,
            file.id,
            req.body.keepBoth === true,
          );
          file.deletedAt = null;
          file.archivedBy = null;
          file.archiveBatch = null;
        }
        log(
          req,
          user,
          action === "move"
            ? "moved"
            : action === "archive"
              ? "deleted"
              : "restored",
          file,
        );
        succeeded.push(file.id);
      } catch (error) {
        failed.push({ id, code: error.code || "file_action_denied" });
      }
    }
    return { succeeded, failed };
  });
  middleware.get(
    `${base}/settings`,
    own((_req, user) => {
      admin(user);
      return policy();
    }),
  );
  post(`${base}/settings`, (req, user) => {
    admin(user, true);
    const body = req.body,
      current = policy();
    if (
      !body ||
      Object.keys(body).some((key) => !Object.hasOwn(DEFAULTS, key)) ||
      (body.safetyBytes != null &&
        (!Number.isSafeInteger(body.safetyBytes) ||
          body.safetyBytes < 0 ||
          current.storageBytes == null ||
          body.safetyBytes > current.storageBytes)) ||
      !Number.isInteger(body.defaultExpiryDays) ||
      body.defaultExpiryDays < 1 ||
      body.defaultExpiryDays > 366 ||
      typeof body.requestLinks !== "boolean" ||
      !Number.isInteger(body.trashDays) ||
      body.trashDays < 1 ||
      body.trashDays > 365 ||
      body.versionPolicy !== "retain_all"
    )
      throw problem(
        422,
        "invalid_file_settings",
        "Check the Files policy values.",
      );
    store.set("settings", clone(body));
    return policy();
  });
  post(`${base}/trash/purge`, (req, user) => {
    admin(user, true);
    const cutoff = Date.now() - settings().trashDays * 864e5,
      purged = [],
      protectedIds = [];
    for (const file of files.values())
      if (
        file.deletedAt &&
        Date.parse(file.deletedAt) <= cutoff &&
        access.fileAccess(user, file)
      ) {
        if (
          file.custodyReadOnly ||
          file.whiteboard ||
          access
            .chain(folders.get(file.folderId))
            .some((row) => row.custodyReadOnly)
        ) {
          protectedIds.push(file.id);
          continue;
        }
        for (const share of state.shares.values())
          if (share.resourceType === "file" && share.resourceId === file.id) {
            share.revokedAt ||= at();
            state.shares.delete(share.id);
            for (const [id, session] of state.sessions)
              if (session.shareId === share.id) state.sessions.delete(id);
          }
        files.delete(file.id);
        for (const key of store.keys())
          if (key.startsWith(`comment:${file.id}:`)) store.delete(key);
        purged.push(file.id);
      }
    return { purged, protectedIds, usedBytes: retainedBytes() };
  });
  post(`${base}/requests`, (req, user) => {
    const folder = targetFor(user, req.body.folderId);
    if (
      !folder ||
      !access.folderCaps(user, folder).canManageExternalShares ||
      !policy().shareLinks ||
      !settings().requestLinks
    )
      throw problem(
        403,
        "request_link_unavailable",
        "Upload requests require a writable folder and an enabled sharing plan.",
      );
    const max = Number(req.body.maxSubmissions || 20);
    if (!Number.isInteger(max) || max < 1 || max > 100)
      throw problem(
        422,
        "invalid_request_limit",
        "Choose a limit from 1 to 100.",
      );
    const secret = lib.newSecret(),
      timestamp = at(),
      expires = Date.now() + settings().defaultExpiryDays * 864e5,
      id = lib.newId();
    const share = {
      id,
      ownerId: user.id,
      resourceType: "folder",
      resourceId: folder.id,
      purpose: "upload_request",
      label: String(req.body.label || folder.name).slice(0, 120),
      permission: "view_only",
      passwordHash: req.body.password
        ? crypto
            .createHash("sha256")
            .update(String(req.body.password))
            .digest("hex")
        : null,
      secretHash: crypto.createHash("sha256").update(secret).digest("hex"),
      expiresAt: new Date(expires).toISOString(),
      revokedAt: null,
      maxDownloads: null,
      downloadCount: 0,
      version: 1,
      lastAccessedAt: null,
      createdAt: timestamp,
      maxSubmissions: max,
      submissionCount: 0,
    };
    if (req.body.password && String(req.body.password).length < 4)
      throw problem(422, "invalid_password", "Use at least four characters.");
    state.shares.set(id, share);
    return {
      ...hooks.shareOut(share, true, secret),
      purpose: share.purpose,
      maxSubmissions: max,
      submissionCount: 0,
    };
  });
  middleware.get(
    `${base}/requests`,
    own((_req, user) =>
      [...state.shares.values()]
        .filter(
          (row) =>
            row.purpose === "upload_request" &&
            (row.ownerId === user.id || access.isAdmin(user)),
        )
        .map((row) => ({
          ...hooks.shareOut(row),
          purpose: row.purpose,
          maxSubmissions: row.maxSubmissions,
          submissionCount: row.submissionCount,
        })),
    ),
  );
  post(`${base}/shares/:id/revoke`, (req, user) => {
    const share = state.shares.get(req.params.id),
      resource =
        share &&
        (share.resourceType === "file" ? files : folders).get(share.resourceId);
    if (
      !share ||
      !resource ||
      !(
        share.resourceType === "file"
          ? access.fileCaps(user, resource)
          : access.folderCaps(user, resource)
      ).canManageExternalShares
    )
      throw problem(404, "share_unavailable", "This link is unavailable.");
    share.revokedAt ||= at();
    for (const [key, session] of state.sessions)
      if (session.shareId === share.id) state.sessions.delete(key);
    return hooks.shareOut(share);
  });
  middleware.post("/api/v1/shares", (req, res, next) => {
    try {
      const user = identity.requireUser(req, res);
      if (!user) return;
      writable(user);
      if (!policy().shareLinks)
        throw problem(
          403,
          "sharing_unavailable",
          "Public sharing is unavailable on the current plan.",
        );
      if (!req.body.expiresAt)
        req.body.expiresAt = new Date(
          Date.now() + settings().defaultExpiryDays * 864e5,
        ).toISOString();
      next();
    } catch (error) {
      next(error);
    }
  });
  // This prefix is admitted by the existing public-resource boundary. The
  // original session route still validates secret/password and binds its cookie.
  middleware.use("/api/v1/public/shares/:shareId", (req, res, next) => {
    const share = state.shares.get(req.params.shareId);
    if (share?.purpose !== "upload_request" || req.path === "/session")
      return next();
    try {
      const found = hooks.publicShare(req, res);
      if (!found) return;
      if (
        access
          .chain(found.resource)
          .some((row) => row.deletedAt || row.custodyReadOnly) ||
        !settings().requestLinks ||
        !policy().shareLinks
      )
        throw problem(410, "request_closed", "This upload request is closed.");
      if (req.method === "GET" && req.path === "/")
        return res.set("Cache-Control", "private, no-store").json({
          success: true,
          data: {
            shareId: share.id,
            purpose: share.purpose,
            label: share.label,
            permission: "view_only",
            expiresAt: share.expiresAt,
            resource: {
              type: "folder",
              id: found.resource.id,
              name: found.resource.name,
              parentId: null,
              createdAt: found.resource.createdAt,
              updatedAt: found.resource.updatedAt,
            },
            capabilities: { canPreview: false, canDownload: false },
            request: {
              samples: samples(),
              maxSubmissions: share.maxSubmissions,
              submissionCount: share.submissionCount,
              canSubmit:
                policy().canAcceptSamples &&
                share.submissionCount < share.maxSubmissions,
            },
          },
        });
      if (req.method === "POST" && req.path === "/request") {
        validBody(req.body, ["sampleId", "name"]);
        const result = receipt(
          req,
          `share:${share.id}:${share.version}`,
          () => {
            if (share.submissionCount >= share.maxSubmissions)
              throw problem(
                409,
                "request_limit_reached",
                "This request has received its maximum number of submissions.",
              );
            const owner = identity.findUser(share.ownerId);
            if (
              !owner ||
              owner.isActive === false ||
              !access
                .toolRoles(owner)
                .some((role) => ["super_admin", "file_editor"].includes(role))
            )
              throw problem(
                410,
                "request_closed",
                "This upload request is closed.",
              );
            const sample = asset(req.body.sampleId),
              name = uniqueName(
                safeName(req.body.name || sample.name),
                found.resource.id,
                null,
                true,
              ),
              file = addAsset(sample, name, found.resource.id, share.ownerId, {
                kind: "public_request",
                shareId: share.id,
              });
            share.submissionCount++;
            state.activities.unshift({
              id: lib.newId(),
              actorId: null,
              action: "request_submitted",
              entityType: "file",
              entityId: file.id,
              metadata: { name: file.name },
              timestamp: at(),
            });
            return {
              receiptId: file.id,
              name: file.name,
              submissionCount: share.submissionCount,
              delivery: "packaged_sample",
            };
          },
        );
        return res.json({ success: true, data: result });
      }
      throw problem(
        403,
        "request_write_only",
        "This request does not expose folder contents.",
      );
    } catch (error) {
      next(error);
    }
  });
  middleware.get(
    `${base}/files/:id/versions/:versionId/preview`,
    own((req, user) => {
      const file = fileFor(user, req.params.id),
        version = versions(file).find((row) => row.id === req.params.versionId);
      if (!version)
        throw problem(404, "version_not_found", "This version is unavailable.");
      const preview = manifest[version.storage.key]?.preview;
      return preview?.kind === "pages"
        ? {
            kind: "pages",
            assets: preview.assets.map((row, index) => ({
              index,
              path: `${base}/files/${file.id}/versions/${version.id}/preview/${index}`,
              mimeType: row.mimeType,
            })),
          }
        : { kind: "unsupported", assets: [] };
    }),
  );
  middleware.get(
    `${base}/files/:id/versions/:versionId/preview/:index`,
    respond((req, res) => {
      const user = identity.requireUser(req, res);
      if (!user) return;
      const file = fileFor(user, req.params.id),
        version = versions(file).find((row) => row.id === req.params.versionId),
        index = Number(req.params.index);
      const item =
        Number.isSafeInteger(index) &&
        index >= 0 &&
        manifest[version?.storage.key]?.preview?.assets?.[index];
      if (!item)
        throw problem(404, "preview_unavailable", "This page is unavailable.");
      res
        .set("Cache-Control", "private, no-store")
        .set("X-Content-Type-Options", "nosniff")
        .type(item.mimeType)
        .sendFile(path.resolve(__dirname, "assets", item.file));
    }),
  );
  middleware.get(
    `${base}/files/:id/versions/:versionId/content`,
    respond((req, res) => {
      const user = identity.requireUser(req, res);
      if (!user) return;
      const file = fileFor(user, req.params.id),
        version = versions(file).find((row) => row.id === req.params.versionId);
      if (!version)
        throw problem(
          404,
          "version_not_found",
          "This saved version is unavailable.",
        );
      res
        .set("Cache-Control", "private, no-store")
        .set("X-Content-Type-Options", "nosniff")
        .attachment(version.name || version.originalName || file.name);
      if (version.storage.kind === "whiteboard") {
        const content = shared.contentSharedFile({
          actorId: user.id,
          fileId: file.id,
          versionId: version.id,
        });
        return res.type(content.mimetype).send(content.bytes);
      }
      const item = manifest[version.storage.key];
      if (!item)
        throw problem(
          410,
          "file_content_unavailable",
          "This saved content is unavailable.",
        );
      res
        .type(item.mimeType)
        .sendFile(path.resolve(__dirname, "assets", item.file));
    }),
  );
  middleware.use((error, _req, res, _next) =>
    res.status(error.status || 503).json({
      success: false,
      code: error.code || "files_unavailable",
      message: error.status ? error.message : "Files could not be loaded.",
    }),
  );
  function feed(user) {
    const visible = [...files.values()].filter(
        (file) => access.activeFile(file) && access.fileAccess(user, file),
      ),
      ids = new Set(visible.map((row) => row.id));
    return {
      files: visible.map((file) => fileOut(user, file)),
      folders: [...folders.values()]
        .filter(
          (folder) =>
            !access
              .chain(folder)
              .some((row) => row.deletedAt || row.custodyReadOnly) &&
            access.folderAccess(user, folder),
        )
        .map((folder) => hooks.serializeFolder(folder, user)),
      activities: state.activities
        .filter((row) => row.entityType === "file" && ids.has(row.entityId))
        .map((row) => ({
          id: row.id,
          title: row.metadata?.name || files.get(row.entityId)?.name,
          action: row.action,
          actor:
            row.actorId == null
              ? "Link visitor"
              : actorName(Number(row.actorId)),
          at: row.createdAt || row.timestamp,
          path: `/file/${row.entityId}`,
        })),
      notifications: rows("notice:")
        .filter((row) => row.recipientId === user.id && ids.has(row.fileId))
        .map(clone),
    };
  }
  function exportVisible(user) {
    const visible = [...files.values()].filter((file) =>
      access.fileAccess(user, file),
    );
    return {
      ...feed(user),
      files: visible.map((file) => ({
        ...fileOut(user, file),
        versions: versions(file).map(({ storage, ...row }) => row),
        comments: rows(`comment:${file.id}:`).map((row) => ({
          ...row,
          author: actorName(row.actorId),
        })),
        ...(access.fileCaps(user, file).canManageAccess
          ? {
              permissions: clone(file.accessOverride?.permissions || []),
              shares: [...state.shares.values()]
                .filter(
                  (row) =>
                    row.resourceType === "file" && row.resourceId === file.id,
                )
                .map((row) => hooks.shareOut(row)),
            }
          : {}),
      })),
      ...(canAdmin(user)
        ? {
            policy: policy(),
            requests: [...state.shares.values()]
              .filter((row) => row.purpose === "upload_request")
              .map((row) => ({
                ...hooks.shareOut(row),
                maxSubmissions: row.maxSubmissions,
                submissionCount: row.submissionCount,
              })),
          }
        : {}),
    };
  }
  return { middleware, policy, quota, retainedBytes, feed, exportVisible };
}
module.exports = { create, DEFAULTS };
