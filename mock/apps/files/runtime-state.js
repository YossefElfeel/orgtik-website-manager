const lib = require("./lib");
const whiteboards = require('../../lib/whiteboard-scene');
const MAPS = ["folders", "files", "pins", "shares", "sessions", "failures", "previewPages"];
const OPTIONAL_MAPS = ['sampleOperations', 'workspaceFeatures'];
const clone = value => JSON.parse(JSON.stringify(value));
const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value) && !['constructor', 'prototype'].includes(value);
const invalid = message => { throw Object.assign(new Error(message), { status: 503, code: "invalid_tool_snapshot" }); };
const empty = () => ({ ...Object.fromEntries([...MAPS, ...OPTIONAL_MAPS].map(key => [key, new Map()])), activities: [] });

function encode(state) {
  if (Object.keys(state).some(key => ![...MAPS, ...OPTIONAL_MAPS, "activities"].includes(key))) invalid("Files codec does not cover every store field.");
  const data = { activities: clone(state.activities) };
  for (const key of MAPS) data[key] = [...state[key]].map(([id, value]) => [id, key === "pins" ? [...value] : clone(value)]);
  for (const key of OPTIONAL_MAPS) if (state[key]?.size) data[key] = [...state[key]].map(([id, value]) => [id, clone(value)]);
  return data;
}

function decode(data, manifest) {
  if (!data || Object.keys(data).some(key => ![...MAPS, ...OPTIONAL_MAPS, "activities"].includes(key)) || !Array.isArray(data.activities)) invalid("Files snapshot has incomplete state.");
  const state = empty();
  for (const key of MAPS) {
    if (!Array.isArray(data[key])) invalid(`Files snapshot ${key} is missing.`);
    const seen = new Set();
    for (const pair of data[key]) {
      if (!Array.isArray(pair) || pair.length !== 2 || !["string", "number"].includes(typeof pair[0]) || seen.has(pair[0])) invalid(`Files snapshot ${key} has invalid keys.`);
      seen.add(pair[0]);
      if (key === "pins") {
        if (!Array.isArray(pair[1]) || pair[1].some(pin => !Array.isArray(pin) || pin.length !== 2 || typeof pin[0] !== "string" || typeof pin[1] !== "string") || new Set(pair[1].map(pin => pin[0])).size !== pair[1].length) invalid("Files pin snapshot is invalid.");
        state.pins.set(pair[0], new Map(clone(pair[1])));
      } else state[key].set(pair[0], clone(pair[1]));
    }
  }
  for (const [id, row] of state.folders) {
    if (row.id !== id || row.parentId != null && !state.folders.has(row.parentId)) invalid("Files snapshot has an invalid folder reference.");
    const ancestors = new Set();
    for (let folder = row; folder; folder = state.folders.get(folder.parentId)) {
      if (ancestors.has(folder.id)) invalid("Files snapshot has a folder cycle.");
      ancestors.add(folder.id);
    }
  }
  for (const [id, row] of state.files) {
    if (row.id !== id || row.folderId != null && !state.folders.has(row.folderId)) invalid("Files snapshot has an invalid file reference.");
    if (row.accessOverride?.permissions !== undefined && (!Array.isArray(row.accessOverride.permissions) || row.accessOverride.permissions.length > 100 || row.accessOverride.permissions.some(grant => !grant || Object.keys(grant).sort().join(',') !== 'permission,userId' || !Number.isSafeInteger(grant.userId) || grant.userId < 1 || !['view', 'comment', 'edit'].includes(grant.permission)) || new Set(row.accessOverride.permissions.map(grant => grant.userId)).size !== row.accessOverride.permissions.length)) invalid('Files per-person permissions are invalid.');
    const storageValid = storage => {
      if (storage?.kind === 'asset') return Object.hasOwn(manifest, storage.key);
      if (storage?.kind !== 'whiteboard') return false;
      try { whiteboards.readWhiteboardStorage(storage); return true; } catch { return false; }
    };
    if (!storageValid(row.storage)) invalid("Files snapshot content is invalid.");
    if (row.storage.kind === 'whiteboard' && (!row.whiteboard || Object.keys(row.whiteboard).join() !== 'boardId' || !whiteboards.identifier(row.whiteboard.boardId) || row.mimeType !== whiteboards.MIME || !Array.isArray(row.versions) || !row.currentVersionId)) invalid('Files whiteboard association is invalid.');
    if (row.whiteboard && row.storage.kind !== 'whiteboard') invalid('Files whiteboard content is missing.');
    if (row.versions !== undefined) {
      if (!Array.isArray(row.versions) || !row.versions.length || row.versions.some(version => !version || !validId(version.id) || !Number.isSafeInteger(version.number) || version.number < 1 || !Number.isFinite(version.size) || version.size < 0 || typeof version.createdAt !== 'string' || !Number.isFinite(Date.parse(version.createdAt)) || !storageValid(version.storage)) || new Set(row.versions.map(version => version.id)).size !== row.versions.length) invalid('Files version metadata is invalid.');
      if (row.whiteboard) for (const version of row.versions) {
        if (version.storage.kind !== 'whiteboard' || version.mimeType !== whiteboards.MIME || version.id !== `v${version.number}`) invalid('Whiteboard versions must retain structured content.');
        const canonical = whiteboards.readWhiteboardStorage(version.storage);
        if (version.size !== canonical.size || version.hash !== canonical.hash) invalid('Whiteboard version content does not match its immutable metadata.');
      }
    }
    if (row.currentVersionId !== undefined && (!validId(row.currentVersionId) || !row.versions?.some(version => version.id === row.currentVersionId))) invalid('The current Files version is unavailable.');
    if (row.whiteboard) {
      const head = row.versions.find(version => version.id === row.currentVersionId), canonical = whiteboards.readWhiteboardStorage(row.storage);
      if (row.size !== canonical.size || head.hash !== canonical.hash || new Set(row.versions.map(version => version.number)).size !== row.versions.length) invalid('The current whiteboard version is inconsistent.');
    }
  }
  const boardIds = [...state.files.values()].filter(row => row.whiteboard).map(row => row.whiteboard.boardId);
  if (new Set(boardIds).size !== boardIds.length) invalid('A whiteboard cannot own multiple Files records.');
  for (const key of OPTIONAL_MAPS) {
    if (data[key] === undefined) continue;
    if (key === 'workspaceFeatures') {
      if (!Array.isArray(data[key]) || data[key].length > 20000) invalid('Files feature records are invalid.');
      for (const pair of data[key]) {
        if (!Array.isArray(pair) || pair.length !== 2 || !validId(pair[0]) || !/^(settings|person:\d+|comment:[\w-]+:[\w-]+|notice:[\w-]+|operation:[\w.:-]+)$/.test(pair[0]) || state[key].has(pair[0]) || !pair[1] || typeof pair[1] !== 'object' || Array.isArray(pair[1]) || JSON.stringify(pair[1]).length > 200000) invalid('Files feature record is invalid.');
        state[key].set(pair[0], clone(pair[1]));
      }
      continue;
    }
    if (!Array.isArray(data[key])) invalid('Files sample receipts are invalid.');
    for (const pair of data[key]) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || !/^[1-9]\d*:[\w.:-]{1,200}$/.test(pair[0]) || ['__proto__', 'constructor', 'prototype'].includes(pair[0].slice(pair[0].indexOf(':') + 1)) || state[key].has(pair[0]) || !pair[1] || Object.keys(pair[1]).sort().join(',') !== 'fileId,fingerprint,versionId' || !/^[a-f0-9]{64}$/.test(pair[1].fingerprint) || !validId(pair[1].fileId) || pair[1].versionId !== 'v1') invalid('Files sample receipt is invalid.');
      state[key].set(pair[0], clone(pair[1]));
    }
  }
  for (const [id, row] of state.shares) if (row.id !== id || !["file", "folder"].includes(row.resourceType) || !(row.resourceType === "file" ? state.files : state.folders).has(row.resourceId)) invalid("Files snapshot has an invalid share reference.");
  state.activities = clone(data.activities);
  return state;
}

function nileFixture(identity, manifest, at) {
  const owner = identity.users.find(person => identity.userScopes(person).some(scope => scope.scope === "file_manager" && scope.roles.includes("super_admin"))) || identity.users[0];
  const asset = manifest.pdf_msa_nilefoods;
  if (!owner || !asset) invalid("Nile Files fixture needs its admitted owner and packaged agreement.");
  const state = empty();
  const rootId = lib.seedId("folder:contracts"), folderId = lib.seedId("folder:contracts-clients"), fileId = lib.seedId("file:pdf_msa_nilefoods");
  const timestamp = new Date(Date.parse(at) - 47 * 864e5).toISOString();
  const folder = (id, name, parentId) => ({ id, name, parentId, ownerId: owner.id, visibility: "only_me", allowedUserIds: [], grantedBy: owner.id, grantsAt: timestamp, inheritedAccess: Boolean(parentId), createdAt: timestamp, updatedAt: timestamp, deletedAt: null, archivedBy: null, archiveBatch: null });
  state.folders.set(rootId, folder(rootId, "Contracts", null));
  state.folders.set(folderId, folder(folderId, "Client Agreements", rootId));
  state.files.set(fileId, { id: fileId, name: "Nile Foods - Master Service Agreement 2026.pdf", originalName: "Nile Foods - Master Service Agreement 2026.pdf", ownerId: owner.id, size: asset.size, mimeType: asset.mimeType, folderId, isUsed: false, usedNote: null, usedAt: null, usedBy: null, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, archivedBy: null, archiveBatch: null, storage: { kind: "asset", key: "pdf_msa_nilefoods" }, accessOverride: null });
  return state;
}

module.exports = { MAPS, OPTIONAL_MAPS, empty, encode, decode, nileFixture };
