const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };
const identifier = value => typeof value === 'string' && /^[\w.:-]{1,160}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);

function reference(value, workspaceId) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).sort().join() !== 'fileId,versionId,workspaceId' || ![value.workspaceId, value.fileId, value.versionId].every(identifier)) fail(422, 'invalid_file_reference', 'Choose a Files record and version.');
  if (value.workspaceId !== workspaceId) fail(404, 'file_not_found', 'This file is not available in this workspace.');
  return { workspaceId: value.workspaceId, fileId: value.fileId, versionId: value.versionId };
}
const sameReference = (a, b) => a?.workspaceId === b?.workspaceId && a?.fileId === b?.fileId && a?.versionId === b?.versionId;
const referenceId = value => `${value.fileId}:${value.versionId}`;
function contentPath(value, target, id) {
  const query = new URLSearchParams({ resourceType: target.type, resourceId: String(target.id), referenceId: String(id) });
  return `/api/shared/files/${encodeURIComponent(value.fileId)}/versions/${encodeURIComponent(value.versionId)}/content?${query}`;
}
function chatAttachment(value, projection, target) {
  const ref = value.reference, id = referenceId(ref);
  if (projection.state !== 'available') return { id, reference: ref, state: 'unavailable', name: '', size: '', kind: 'other' };
  const file = projection.file, mimetype = file.mimetype;
  const kind = mimetype === 'application/pdf' ? 'pdf' : mimetype.startsWith('image/') ? 'image' : /spreadsheet|excel/.test(mimetype) ? 'sheet' : mimetype.startsWith('video/') ? 'video' : /word|text\//.test(mimetype) ? 'doc' : 'other';
  return { id, reference: ref, state: 'available', name: file.name, size: `${file.size} B`, bytes: file.size, mimetype, kind, version: file.version, contentPath: contentPath(ref, target, id) };
}
module.exports = { reference, identifier, sameReference, referenceId, contentPath, chatAttachment };
