const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createFileAccess } = require('../apps/files/access');
const lib = require('../apps/files/lib');
const boards = require('./whiteboard-scene');
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const copy = value => JSON.parse(JSON.stringify(value));
const SAMPLES = Object.freeze({ pdf_company_profile: 'Sample company profile.pdf', docx_runbook: 'Sample runbook.docx', txt_release_notes: 'Sample release notes.txt', png_app_home: 'Sample home screen.png', png_app_checkout: 'Sample checkout flow.png', png_dashboard_dark: 'Sample dashboard.png', jpg_mango: 'Sample product photo.jpg', mp4_app_walkthrough: 'Sample app walkthrough.mp4' });
const TYPES = new Set(['application/pdf', 'text/plain', 'text/csv', 'text/markdown', 'application/json', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'video/mp4']);
TYPES.add(boards.MIME);
function createWorkspaceFiles({ state, identity, workspaceId, realm, manifest, assetDir, boardAuthority, now = () => new Date().toISOString(), fileOut }) {
  const acl = createFileAccess({ state, identity, boardAuthority });
  state.sampleOperations ||= new Map();
  let closed = false;
  function actor(actorId, write = false) {
    if (closed) throw fail(503, 'workspace_runtime_closed', 'This Files runtime is closed.');
    const user = identity.findUser(actorId), context = identity.currentContext?.();
    if (!user || user.isActive !== true || user.deletedAt || !acl.toolRoles(user).length || context && (context.workspace.id !== workspaceId || context.actor.effectiveUserId !== user.id || context.realm !== realm) || typeof identity.currentContext === 'function' && !context) throw fail(403, 'files_access_required', 'Your current workspace Files access is required.');
    if (context && !['free', 'trial', 'active', 'read_only'].includes(context.tools?.files?.access)) throw fail(403, 'files_access_required', 'Your current Files assignment is required.');
    if (write) {
      if (context?.actor.readOnly || context?.tools.files.access === 'read_only') throw fail(423, 'workspace_read_only', 'This Files workspace is read-only.');
      if (!acl.toolRoles(user).some(role => ['super_admin', 'file_editor'].includes(role)) || typeof identity.canWrite !== 'function' || !identity.canWrite(user)) throw fail(403, 'files_write_required', 'An assigned Files editor is required.');
    }
    return user;
  }
  function content(storage) {
    if (storage?.kind === 'whiteboard') {
      const value = boards.readWhiteboardStorage(storage);
      return { bytes: Buffer.from(value.json, 'utf8'), mimetype: boards.MIME, size: value.size };
    }
    if (storage?.kind !== 'asset' || !Object.hasOwn(manifest, storage.key)) throw fail(410, 'file_content_unavailable', 'This file version is unavailable.');
    const asset = manifest[storage.key];
    try {
      const root = fs.realpathSync(assetDir), filename = fs.realpathSync(path.resolve(root, asset.file)), relative = path.relative(root, filename), stat = fs.statSync(filename);
      if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !stat.isFile() || stat.size !== asset.size) throw fail(410, 'file_content_unavailable', 'The packaged file content is unavailable.');
      return { path: filename, mimetype: asset.mimeType, size: stat.size };
    } catch (error) { throw error.code === 'file_content_unavailable' ? error : fail(410, 'file_content_unavailable', 'The packaged file content is unavailable.'); }
  }
  function record(user, fileId) {
    if (typeof fileId !== 'string' || !fileId || fileId.length > 200) throw fail(404, 'file_not_found', 'This file is unavailable.');
    const file = state.files.get(fileId);
    if (!acl.activeFile(file) || !acl.fileAccess(user, file) || file.internalReferencesAllowed === false) throw fail(404, 'file_not_found', 'This file is unavailable.');
    return file;
  }
  function version(file, requested) {
    const versionId = requested ?? file.currentVersionId ?? 'v1';
    if (typeof versionId !== 'string' || !versionId || versionId.length > 200) throw fail(404, 'file_version_not_found', 'This file version is unavailable.');
    const modeled = file.versions !== undefined || file.currentVersionId !== undefined, stored = file.versions?.find(row => row.id === versionId);
    // Historic rows did not own a content-version model. Only their immutable packaged
    // version1 can be inferred; never pretend another metadata-only version has bytes.
    if (modeled ? !stored?.storage : versionId !== 'v1') throw fail(404, 'file_version_not_found', 'This file version is unavailable.');
    const storage = modeled ? stored.storage : file.storage, binary = content(storage);
    if (!TYPES.has(binary.mimetype)) throw fail(422, 'unsupported_shared_file', 'This file type is not available in shared references yet.');
    return { id: versionId, number: stored?.number || 1, storage, binary, stored };
  }
  function metadata(file, selected) {
    return { workspaceId, fileId: file.id, versionId: selected.id, name: file.name, mimetype: selected.binary.mimetype, size: selected.binary.size, version: selected.number };
  }
  function resolveSharedFile({ actorId, fileId, versionId }) {
    const user = actor(actorId), file = record(user, fileId);
    return metadata(file, version(file, versionId));
  }
  function contentSharedFile({ actorId, fileId, versionId }) {
    const user = actor(actorId), file = record(user, fileId), selected = version(file, versionId);
    return { ...(selected.binary.bytes ? { bytes: selected.binary.bytes } : { path: selected.binary.path }), mimetype: selected.binary.mimetype, name: file.name };
  }
  function packageServiceDelivery({ actorId, fileId, versionId }) {
    const user = actor(actorId), file = record(user, fileId), selected = version(file, versionId);
    if (selected.storage.kind !== 'asset' || !selected.binary.path) throw fail(422, 'packaged_assets_only', 'Choose an immutable packaged sample asset for this delivery.');
    return { reference: { workspaceId, fileId, versionId: selected.id }, ...metadata(file, selected), assetKey: selected.storage.key, sha256: crypto.createHash('sha256').update(fs.readFileSync(selected.binary.path)).digest('hex') };
  }
  function listSharedFiles({ actorId, search = '', page = 1, limit = 20 }) {
    const user = actor(actorId), p = typeof page === 'string' && /^\d+$/.test(page) ? Number(page) : page, size = typeof limit === 'string' && /^\d+$/.test(limit) ? Number(limit) : limit;
    if (typeof search !== 'string' || search.length > 200 || !Number.isSafeInteger(p) || p < 1 || !Number.isSafeInteger(size) || size < 1 || size > 100) throw fail(422, 'invalid_file_query', 'Choose a valid Files search and page.');
    const text = search.trim().toLowerCase(), items = [];
    for (const file of state.files.values()) {
      if (!acl.activeFile(file) || !acl.fileAccess(user, file) || file.internalReferencesAllowed === false || text && !file.name.toLowerCase().includes(text)) continue;
      try { items.push(metadata(file, version(file))); }
      catch (error) { if (!['unsupported_shared_file', 'file_content_unavailable', 'file_version_not_found'].includes(error.code)) throw error; }
    }
    items.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.fileId < b.fileId ? -1 : a.fileId > b.fileId ? 1 : 0);
    return { items: items.slice((p - 1) * size, p * size), meta: { page: p, limit: size, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / size)) } };
  }
  function sampleCatalog({ actorId }) {
    const user = actor(actorId);
    return { items: Object.entries(SAMPLES).map(([sampleId, name]) => {
      const binary = content({ kind: 'asset', key: sampleId });
      return { sampleId, name, mimetype: binary.mimetype, size: binary.size };
    }), canCreate: acl.toolRoles(user).some(role => ['super_admin', 'file_editor'].includes(role)) && identity.canWrite?.(user) === true };
  }
  function createSample({ actorId, sampleId, parentId = null, operationId }) {
    const user = actor(actorId, true);
    if (typeof operationId !== 'string' || !/^[\w.:-]{1,200}$/.test(operationId) || ['__proto__', 'constructor', 'prototype'].includes(operationId)) throw fail(422, 'operation_id_required', 'Supply the original sample creation reference.');
    if (typeof sampleId !== 'string' || !Object.hasOwn(SAMPLES, sampleId)) throw fail(422, 'invalid_sample', 'Choose a packaged sample from the catalog.');
    const parent = parentId === null ? null : typeof parentId === 'string' && state.folders.get(parentId);
    if (parentId !== null && (!parent || parent.deletedAt || acl.chain(parent).some(row => row.deletedAt || row.custodyReadOnly))) throw fail(404, 'folder_not_found', 'The destination folder is unavailable.');
    if (parent && !acl.folderCaps(user, parent).canWrite) throw fail(403, 'folder_write_required', 'You cannot create a sample in that folder.');
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ workspaceId, actorId: user.id, sampleId, parentId })).digest('hex'), receiptKey = `${user.id}:${operationId}`, prior = state.sampleOperations.get(receiptKey);
    if (prior && prior.fingerprint !== fingerprint) throw fail(409, 'operation_conflict', 'Retry the original sample and folder unchanged.');
    if (prior) {
      const file = record(user, prior.fileId); version(file, prior.versionId);
      return { ...fileOut(file, user), workspaceId, fileId: file.id, versionId: prior.versionId, version: 1 };
    }
    const binary = content({ kind: 'asset', key: sampleId }), timestamp = now(), id = lib.newId(), name = SAMPLES[sampleId];
    const file = { id, name, originalName: name, ownerId: user.id, size: binary.size, mimeType: binary.mimetype, folderId: parent?.id || null, isUsed: false, usedNote: null, usedAt: null, usedBy: null, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, archivedBy: null, archiveBatch: null, storage: { kind: 'asset', key: sampleId }, accessOverride: null, currentVersionId: 'v1', versions: [{ id: 'v1', number: 1, createdAt: timestamp, createdById: user.id, originalName: name, size: binary.size, mimeType: binary.mimetype, storage: { kind: 'asset', key: sampleId } }] };
    state.files.set(id, file);
    state.activities.unshift({ id: lib.newId(), scope: 'file_manager', actorId: String(user.id), action: 'sample_created', entityType: 'file', entityId: id, metadata: { sampleId, parentId }, createdAt: timestamp, ip: '', userAgent: '' });
    state.sampleOperations.set(receiptKey, { fingerprint, fileId: id, versionId: 'v1' });
    return { ...fileOut(file, user), workspaceId, fileId: id, versionId: 'v1', version: 1 };
  }
  function destination(user, parentId = null) {
    const parent = parentId === null ? null : typeof parentId === 'string' && state.folders.get(parentId);
    if (parentId !== null && (!parent || acl.chain(parent).some(row => row.deletedAt || row.custodyReadOnly))) throw fail(404, 'folder_not_found', 'The destination folder is unavailable.');
    if (parent && !acl.folderCaps(user, parent).canWrite) throw fail(403, 'folder_write_required', 'You cannot save a whiteboard in that folder.');
    return parent;
  }
  function authorizeWhiteboard({ actorId, fileId, boardId, parentId = null, write = false }) {
    const user = actor(actorId, write);
    if (!fileId) {
      if (write) destination(user, parentId);
      return { canWrite: write, readOnly: !write };
    }
    const file = record(user, fileId);
    if (!file.whiteboard || boardId && boardId !== file.whiteboard.boardId) throw fail(404, 'whiteboard_not_found', 'This whiteboard is unavailable.');
    if (write) {
      acl.authorizeBoard(user, file, true);
      if (!acl.fileCaps(user, file).canWrite) throw fail(403, 'file_write_required', 'You cannot change this whiteboard file.');
    }
    return { canWrite: acl.fileCaps(user, file).canWrite, readOnly: !acl.fileCaps(user, file).canWrite };
  }
  function whiteboardOut(file, selected, user) {
    const capabilities = acl.fileCaps(user, file);
    return { boardId: file.whiteboard.boardId, reference: { workspaceId, fileId: file.id, versionId: selected.id }, name: file.name, version: selected.number, scene: copy(selected.storage.scene), updatedAt: selected.stored?.createdAt || file.updatedAt, capabilities: { canWrite: capabilities.canWrite, readOnly: !capabilities.canWrite } };
  }
  function resolveWhiteboard({ actorId, fileId, versionId }) {
    const user = actor(actorId), file = record(user, fileId), selected = version(file, versionId);
    if (!file.whiteboard || selected.storage.kind !== 'whiteboard') throw fail(404, 'whiteboard_not_found', 'This whiteboard is unavailable.');
    return whiteboardOut(file, selected, user);
  }
  function createWhiteboard({ actorId, boardId, name, parentId = null, scene }) {
    const user = actor(actorId, true), parent = destination(user, parentId);
    if (!boards.identifier(boardId) || typeof name !== 'string' || !name.trim() || name.trim().length > 120 || /[\\/\u0000-\u001f]/.test(name)) throw fail(422, 'invalid_whiteboard', 'Choose a valid board ID and name.');
    const binding = { whiteboard: { boardId } }; acl.authorizeBoard(user, binding, true);
    if ([...state.files.values()].some(file => file.whiteboard?.boardId === boardId)) throw fail(409, 'whiteboard_already_exists', 'This whiteboard already has a Files record.');
    const value = boards.serializeWhiteboardScene(scene), timestamp = now(), id = lib.newId(), filename = `${name.trim()}.whiteboard.json`;
    const storage = { kind: 'whiteboard', scene: value.scene };
    const file = { id, name: filename, originalName: filename, ownerId: user.id, size: value.size, mimeType: boards.MIME, folderId: parent?.id || null, isUsed: false, usedNote: null, usedAt: null, usedBy: null, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, archivedBy: null, archiveBatch: null, storage: copy(storage), accessOverride: null, whiteboard: { boardId }, currentVersionId: 'v1', versions: [{ id: 'v1', number: 1, createdAt: timestamp, createdById: user.id, originalName: filename, size: value.size, mimeType: boards.MIME, hash: value.hash, storage: copy(storage) }] };
    state.files.set(id, file);
    state.activities.unshift({ id: lib.newId(), scope: 'file_manager', actorId: String(user.id), action: 'whiteboard_created', entityType: 'file', entityId: id, metadata: { boardId, versionId: 'v1' }, createdAt: timestamp, ip: '', userAgent: '' });
    // The coordinator owns operation receipts and fills the Chats index before committing.
    return whiteboardOut(file, version(file, 'v1'), user);
  }
  function saveWhiteboard({ actorId, fileId, baseVersionId, scene }) {
    authorizeWhiteboard({ actorId, fileId, write: true });
    const user = actor(actorId, true), file = record(user, fileId);
    if (baseVersionId !== file.currentVersionId) throw fail(409, 'version_conflict', 'The board was changed elsewhere. Reopen its saved version.');
    const value = boards.serializeWhiteboardScene(scene), head = version(file), previous = boards.readWhiteboardStorage(head.storage);
    if (value.hash === previous.hash) return whiteboardOut(file, head, user);
    const number = Math.max(...file.versions.map(row => row.number)) + 1, versionId = `v${number}`, timestamp = now(), storage = { kind: 'whiteboard', scene: value.scene };
    file.versions.push({ id: versionId, number, createdAt: timestamp, createdById: user.id, originalName: file.originalName, size: value.size, mimeType: boards.MIME, hash: value.hash, storage: copy(storage) });
    file.currentVersionId = versionId; file.storage = copy(storage); file.size = value.size; file.updatedAt = timestamp;
    state.activities.unshift({ id: lib.newId(), scope: 'file_manager', actorId: String(user.id), action: 'whiteboard_saved', entityType: 'file', entityId: file.id, metadata: { boardId: file.whiteboard.boardId, versionId }, createdAt: timestamp, ip: '', userAgent: '' });
    return whiteboardOut(file, version(file, versionId), user);
  }
  function getVersionMetadata({ actorId, fileId, versionId }) {
    const user = actor(actorId), file = record(user, fileId), selected = version(file, versionId);
    return { ...fileOut(file, user, selected) };
  }
  function previewWhiteboard({ actorId, fileId, versionId }) {
    resolveWhiteboard({ actorId, fileId, versionId });
    const binary = content({ kind: 'asset', key: 'svg_whiteboard_sample' });
    return { path: binary.path, mimetype: binary.mimetype, name: 'whiteboard-sample.svg', sample: true };
  }
  return { listSharedFiles, resolveSharedFile, contentSharedFile, packageServiceDelivery, sampleCatalog, createSample, authorizeWhiteboard, createWhiteboard, saveWhiteboard, resolveWhiteboard, getVersionMetadata, previewWhiteboard, close() { closed = true; } };
}
module.exports = { createWorkspaceFiles, SAMPLES };
