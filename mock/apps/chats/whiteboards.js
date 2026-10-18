const crypto = require('node:crypto');
const { validateWhiteboardScene } = require('../../lib/whiteboard-scene');
const { reference, sameReference } = require('../../lib/workspace-file-references');
const copy = value => JSON.parse(JSON.stringify(value));
const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };
const id = value => typeof value === 'string' && /^[\w.:-]{1,96}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);

function createWhiteboards({ db, seq, identity, ctx, actor, channelFor }) {
  db.whiteboardOperations ??= {};
  function files(method, args) {
    if (typeof ctx.sharedFiles?.[method] !== 'function') fail(503, 'whiteboard_storage_unavailable', 'Whiteboards could not be loaded. Try again.');
    return ctx.sharedFiles[method](args);
  }
  function association(who, { channelId = null, meetingId = null }, write = false) {
    if (channelId && meetingId || channelId !== null && !id(channelId) || meetingId !== null && !id(meetingId)) fail(422, 'invalid_board_context', 'Choose one saved conversation or meeting.');
    if (channelId) channelFor(channelId, who, write);
    if (meetingId) {
      const meeting = [...db.meetings, ...db.pastMeetings].find(row => row.id === meetingId);
      if (!meeting || !meeting.participantIds?.includes(who.id)) fail(404, 'meeting_not_found', 'This saved meeting was not found.');
      if (write && (meeting.custodyReadOnly || meeting.archivedAt)) fail(423, 'board_read_only', 'This meeting whiteboard is read-only.');
    }
    if (write && !identity.canWrite(who.user)) fail(423, 'board_read_only', 'Whiteboards are read-only for this workspace.');
  }
  function authorizeTarget({ actorId, boardId, fileId, write = false }) {
    const who = actor(identity.findUser(actorId)), board = db.whiteboards.find(row => row.id === boardId);
    if (!board || board.custodyReadOnly || !board.channelId && !board.meetingId && board.ownerId !== who.id || fileId && board.reference && board.reference.fileId !== fileId) fail(404, 'whiteboard_not_found', 'This whiteboard was not found.');
    association(who, board, write);
    return board;
  }
  function custodyEligible({ boardId, fromUserId, targetUserId }) {
    const person = identity.findUser(targetUserId), board = db.whiteboards.find(row => row.id === boardId);
    if (!person || person.isActive !== true || !board || board.custodyReadOnly || !identity.userScopes(person).some(scope => scope.scope === 'hq' && scope.roles.some(role => ['owner', 'admin', 'member'].includes(role)))) return false;
    const target = String(targetUserId);
    if (board.channelId) {
      const channel = db.channels.find(row => row.id === board.channelId);
      return Boolean(channel && !channel.custodyReadOnly && (channel.memberIds.includes(target) || channel.ownerId === String(fromUserId)));
    }
    if (board.meetingId) return [...db.meetings, ...db.pastMeetings].some(meeting => meeting.id === board.meetingId && !meeting.custodyReadOnly && meeting.participantIds.includes(target));
    return true;
  }
  function writable(who, board) {
    try {
      authorizeTarget({ actorId: who.user.id, boardId: board.id, write: true });
      files('authorizeWhiteboard', { actorId: who.user.id, fileId: board.reference.fileId, boardId: board.id, write: true });
      return true;
    } catch (error) { if ([403, 404, 423].includes(error.status)) return false; throw error; }
  }
  function detail(user, boardId, versionId) {
    const who = actor(user), board = authorizeTarget({ actorId: user.id, boardId });
    if (!board.reference) fail(503, 'whiteboard_storage_unavailable', 'The whiteboard record is incomplete.');
    const source = files('resolveWhiteboard', { actorId: user.id, fileId: board.reference.fileId, versionId: versionId || board.reference.versionId });
    if (source.boardId !== board.id || source.reference.workspaceId !== identity.workspaceId || source.reference.fileId !== board.reference.fileId) fail(503, 'whiteboard_storage_unavailable', 'The whiteboard record is inconsistent.');
    const historical = source.reference.versionId !== board.reference.versionId, canWrite = !historical && writable(who, board);
    return { workspaceId: identity.workspaceId, id: board.id, name: board.name, channelId: board.channelId, meetingId: board.meetingId, revision: board.revision, reference: source.reference, headReference: copy(board.reference), updatedAt: source.updatedAt || board.updatedAt, historical, capabilities: { canWrite, readOnly: !canWrite }, scene: source.scene };
  }
  function list(user, query = {}) {
    const who = actor(user);
    const channelId = query.channelId || null, meetingId = query.meetingId || null;
    association(who, { channelId, meetingId });
    const items = [];
    for (const board of db.whiteboards) {
      if (channelId && board.channelId !== channelId || meetingId && board.meetingId !== meetingId) continue;
      try { const { scene, ...summary } = detail(user, board.id); items.push(summary); }
      catch (error) { if (![403, 404].includes(error.status)) throw error; }
    }
    return { items };
  }
  function operation(who, key, kind, boardId, payload) {
    if (!id(key)) fail(422, 'operation_id_required', 'Supply the original whiteboard action reference.');
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ workspaceId: identity.workspaceId, actorId: who.id, kind, boardId, payload })).digest('hex');
    const receiptKey = `${who.id}:${key}`, prior = db.whiteboardOperations[receiptKey];
    if (prior && prior.fingerprint !== fingerprint) fail(409, 'operation_conflict', 'This action reference was used for a different whiteboard change.');
    return { receiptKey, fingerprint, prior };
  }
  function replay(user, prior) {
    const board = authorizeTarget({ actorId: user.id, boardId: prior.boardId, write: true });
    files('authorizeWhiteboard', { actorId: user.id, fileId: board.reference.fileId, boardId: board.id, write: true });
    const saved = files('resolveWhiteboard', { actorId: user.id, fileId: board.reference.fileId, versionId: prior.versionId });
    return { ...detail(user, board.id), savedReference: saved.reference, replayed: true };
  }
  function create(user, body, key) {
    const who = actor(user);
    if (!body || Array.isArray(body) || Object.keys(body).some(name => !['name', 'parentId', 'channelId', 'meetingId', 'scene'].includes(name)) || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100 || ['parentId', 'channelId', 'meetingId'].some(name => body[name] !== undefined && body[name] !== null && !id(body[name]))) fail(422, 'invalid_whiteboard', 'Enter a name and valid saved whiteboard.');
    const payload = { name: body.name.trim(), parentId: body.parentId || null, channelId: body.channelId || null, meetingId: body.meetingId || null, scene: validateWhiteboardScene(body.scene) };
    association(who, payload, true);
    files('authorizeWhiteboard', { actorId: user.id, parentId: payload.parentId, write: true });
    const command = operation(who, key, 'create', null, payload);
    if (command.prior) return replay(user, command.prior);
    if (Object.keys(db.whiteboardOperations).length >= 10000) fail(422, 'whiteboard_action_limit', 'This workspace has reached its whiteboard action limit.');
    const boardId = 'b-' + crypto.randomUUID();
    if (db.whiteboards.some(row => row.id === boardId)) fail(503, 'whiteboard_id_unavailable', 'A whiteboard reference could not be created. Try again.');
    const board = { id: boardId, name: payload.name, ownerId: who.id, channelId: payload.channelId, meetingId: payload.meetingId, reference: null, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    // The source target exists before the linked File is projected. Both candidates
    // are discarded together if File creation or persistence fails.
    db.whiteboards.push(board);
    const source = files('createWhiteboard', { actorId: user.id, boardId, name: payload.name, parentId: payload.parentId, scene: payload.scene });
    board.reference = reference(source.reference, identity.workspaceId);
    db.whiteboardOperations[command.receiptKey] = { fingerprint: command.fingerprint, boardId, versionId: board.reference.versionId };
    seq.revision++;
    return { ...detail(user, boardId), savedReference: copy(board.reference), replayed: false };
  }
  function save(user, boardId, body, key) {
    const who = actor(user), board = authorizeTarget({ actorId: user.id, boardId, write: true });
    files('authorizeWhiteboard', { actorId: user.id, fileId: board.reference.fileId, boardId, write: true });
    if (!body || Array.isArray(body) || Object.keys(body).sort().join() !== 'baseVersionId,scene' || !id(body.baseVersionId)) fail(422, 'invalid_whiteboard', 'Supply the saved version and whiteboard drawing.');
    const payload = { baseVersionId: body.baseVersionId, scene: validateWhiteboardScene(body.scene) }, command = operation(who, key, 'save', boardId, payload);
    if (command.prior) return replay(user, command.prior);
    if (Object.keys(db.whiteboardOperations).length >= 10000) fail(422, 'whiteboard_action_limit', 'This workspace has reached its whiteboard action limit.');
    const source = files('saveWhiteboard', { actorId: user.id, fileId: board.reference.fileId, baseVersionId: payload.baseVersionId, scene: payload.scene });
    if (!sameReference(board.reference, source.reference)) { board.reference = reference(source.reference, identity.workspaceId); board.revision++; board.updatedAt = new Date().toISOString(); seq.revision++; }
    db.whiteboardOperations[command.receiptKey] = { fingerprint: command.fingerprint, boardId, versionId: source.reference.versionId };
    return { ...detail(user, boardId), savedReference: source.reference, replayed: false };
  }
  return { list, detail, create, save, authorizeTarget, custodyEligible };
}
module.exports = { createWhiteboards };
