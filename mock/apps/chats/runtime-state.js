const fixture = require('./fixture.json');
const fileReferences = require('../../lib/workspace-file-references');
const TABLES = ['channels', 'messages', 'presence', 'meetings', 'pastMeetings', 'notifications', 'whiteboards', 'historicalUsers'];
const FIELDS = [...TABLES, 'floor', 'settings', 'insight', 'myTime', 'readState', 'channelPreferences', 'processedCommands', 'custodyOperations', 'fixtureOwnerId'];
const OPTIONAL_FIELDS = ['whiteboardOperations'];
const clone = value => JSON.parse(JSON.stringify(value));
const invalid = text => { throw Object.assign(new Error(text), { status: 503, code: 'invalid_tool_snapshot' }); };
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_:.-]{1,96}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const emptyInsight = () => ({ week: '', presenceHoursByHour: Array.from({ length: 7 }, () => Array(24).fill(0)), meetingHoursByDay: Array(7).fill(0), roomUsage: [], cohortSize: 0 });
const emptyTime = () => ({ week: '', presenceHoursByDay: Array(7).fill(0), meetingHoursByDay: Array(7).fill(0), focusHoursByDay: Array(7).fill(0) });

function initialize({ workspace, identity, fixtureId }) {
  const state = {
    ...Object.fromEntries(TABLES.map(key => [key, []])), floor: { id: 'floor', template: 'team', rooms: [] },
    settings: { ...clone(fixture.settings), name: workspace.name || workspace.id, activation: { state: 'active', tier: 'business', userCap: null }, integrations: { google: 'off', microsoft: 'off' } },
    insight: emptyInsight(), myTime: emptyTime(), readState: {}, channelPreferences: {}, processedCommands: [], custodyOperations: [], fixtureOwnerId: null,
  };
  const sequences = { channels: 0, messages: 0, revision: 0 };
  if (fixtureId !== 'orgtik-v1') return { data: state, sequences };
  const people = identity.seedUsers || identity.users;
  const owner = people.find(user => identity.userScopes(user).some(scope => scope.scope === 'hq' && scope.roles.includes('owner'))) || people[0];
  if (!owner) invalid('OrgTik Chats fixture requires an admitted person.');
  const ownerId = String(owner.id), remap = key => key === fixture.ME ? ownerId : key;
  state.fixtureOwnerId = ownerId;
  state.historicalUsers = fixture.users.filter(user => user.id !== fixture.ME).map(({ id, name, initials, tint }) => ({ id, name, initials, tint }));
  state.floor = clone(fixture.floor);
  state.settings = { ...clone(fixture.settings), name: workspace.name || workspace.id, integrations: { google: 'off', microsoft: 'off' } };
  state.channels = clone(fixture.channels).map(channel => ({ ...channel, memberIds: channel.memberIds.map(remap), ownerId, unread: 0, mentions: 0 }));
  const messages = [...fixture.messages, ...Object.values(fixture.threadReplies).flat()];
  state.messages = clone(messages).map(message => ({ ...message, authorId: remap(message.authorId), replyUserIds: message.replyUserIds.map(remap), reactions: message.reactions.map(reaction => ({ ...reaction, userIds: reaction.userIds.map(remap) })), sequence: ++sequences.messages }));
  state.meetings = clone(fixture.meetings).map(meeting => ({ ...meeting, participantIds: meeting.participantIds.map(remap) }));
  state.pastMeetings = clone(fixture.pastMeetings).map(meeting => ({ ...meeting, participantIds: meeting.participantIds.map(remap) }));
  state.insight = clone(fixture.insight); state.myTime = clone(fixture.myTime);
  sequences.channels = state.channels.length;
  return { data: state, sequences };
}

function validate(data, sequences) {
  if (!data || typeof data !== 'object' || FIELDS.some(key => !Object.hasOwn(data, key)) || Object.keys(data).some(key => ![...FIELDS, ...OPTIONAL_FIELDS].includes(key))) invalid('Chats snapshot has an uncovered state field.');
  for (const key of TABLES) if (!Array.isArray(data[key])) invalid('Chats snapshot table is missing: ' + key);
  if (!sequences || Object.keys(sequences).sort().join() !== 'channels,messages,revision' || Object.values(sequences).some(value => !Number.isSafeInteger(value) || value < 0)) invalid('Chats counters are invalid.');
  const channels = new Map(), messages = new Map();
  for (const channel of data.channels) {
    if (!id(channel.id) || channels.has(channel.id) || !['public', 'private', 'dm', 'group'].includes(channel.kind) || !Array.isArray(channel.memberIds) || channel.memberIds.some(value => !id(value)) || typeof channel.name !== 'string' || !id(channel.ownerId)) invalid('Chats channel is invalid.');
    if(channel.workspaceFeatures){const x=channel.workspaceFeatures;if(!x||Array.isArray(x)||Object.keys(x).some(k=>!['typing','activity'].includes(k))||x.typing&&Object.entries(x.typing).some(([uid,on])=>!id(uid)||typeof on!=='boolean')||x.activity&&(!Array.isArray(x.activity)||x.activity.some(r=>!id(r.id)||!id(r.actorId)||typeof r.action!=='string'||!Number.isFinite(Date.parse(r.createdAt)))))invalid('Chats channel feature state is invalid.');}
    channels.set(channel.id, channel);
  }
  if (sequences.channels < channels.size) invalid('Chats counter would reuse committed channel IDs.');
  const messageSequences = new Set();
  for (const message of data.messages) {
    if (!id(message.id) || messages.has(message.id) || !channels.has(message.channelId) || !id(message.authorId) || !Number.isSafeInteger(message.sequence) || message.sequence < 1 || message.sequence > sequences.messages || messageSequences.has(message.sequence) || typeof message.text !== 'string' || !Number.isFinite(Date.parse(message.createdAt)) || !Array.isArray(message.replyUserIds) || !Array.isArray(message.reactions) || !Array.isArray(message.attachments)) invalid('Chats message is invalid.');
    messageSequences.add(message.sequence);
    for (const attachment of message.attachments) if (attachment.reference) {
      try { fileReferences.reference(attachment.reference, attachment.reference.workspaceId); }
      catch { invalid('Chats file reference is invalid.'); }
      if (Object.keys(attachment).join() !== 'reference') invalid('Chats file reference stores unchecked metadata.');
    }
    if (message.fileOperation && (!id(message.fileOperation.id) || !/^[a-f0-9]{64}$/.test(message.fileOperation.fingerprint) || Object.keys(message.fileOperation).sort().join() !== 'fingerprint,id')) invalid('Chats file action receipt is invalid.');
    if(message.workspaceFeatures){const x=message.workspaceFeatures;if(!x||Array.isArray(x)||Object.keys(x).some(k=>!['saved','reminders','format','voice','scheduledAt','timeZone','poll','taskIds'].includes(k))||x.saved&&Object.entries(x.saved).some(([uid,on])=>!id(uid)||typeof on!=='boolean')||x.reminders&&Object.entries(x.reminders).some(([uid,r])=>!id(uid)||!r||!Number.isFinite(Date.parse(r.at))||typeof r.delivered!=='boolean')||x.format&&!['plain','markdown','rich'].includes(x.format)||x.scheduledAt&&!Number.isFinite(Date.parse(x.scheduledAt))||x.taskIds&&(!Array.isArray(x.taskIds)||x.taskIds.some(v=>!Number.isSafeInteger(v)||v<1))||x.voice&&(x.voice.simulated!==true||!Number.isInteger(x.voice.durationSeconds)||x.voice.durationSeconds<1||x.voice.durationSeconds>300)||x.poll&&(!Array.isArray(x.poll.options)||x.poll.options.length<2||x.poll.options.length>8||typeof x.poll.question!=='string'||typeof x.poll.closed!=='boolean'||!x.poll.votes||Object.entries(x.poll.votes).some(([uid,v])=>!id(uid)||!Number.isInteger(v)||v<0||v>=x.poll.options.length)))invalid('Chats message feature state is invalid.');}
    messages.set(message.id, message);
  }
  for (const message of data.messages) if (message.threadId && (!messages.has(message.threadId) || messages.get(message.threadId).channelId !== message.channelId || messages.get(message.threadId).threadId)) invalid('Chats thread crosses a channel.');
  const meetings = new Set();
  for (const meeting of [...data.meetings, ...data.pastMeetings]) {
    if (!id(meeting.id) || meetings.has(meeting.id) || !Array.isArray(meeting.participantIds) || meeting.participantIds.some(value => !id(value))) invalid('Chats saved meeting authority is invalid.');
    if(!Array.isArray(meeting.guests))invalid('Chats meeting guests are invalid.');
    for(const guest of meeting.guests){if(typeof guest.name!=='string'||typeof guest.email!=='string'||!['invited','lobby','admitted','declined','left'].includes(guest.state))invalid('Chats guest display record is invalid.');if(guest.visitId!==undefined&&(!id(guest.visitId)||!/^visit:guest-[\w-]+$/.test(guest.email)||!/^[a-f0-9]{64}$/.test(guest.visitProofHash||'')||!/^[a-f0-9]{64}$/.test(guest.joinFingerprint||'')||!id(guest.joinOperationId)||guest.contactEmail!==undefined&&typeof guest.contactEmail!=='string'))invalid('Chats guest visit proof is invalid.');}
    if(meeting.recordingFile){try{fileReferences.reference(meeting.recordingFile.reference,meeting.recordingFile.reference?.workspaceId);}catch{invalid('Chats recording reference is invalid.');}if(Object.keys(meeting.recordingFile).join()!=='reference')invalid('Chats recording stores unchecked metadata.');}
    meetings.add(meeting.id);
  }
  for(const p of data.presence)if(!id(p.userId)||!['available','busy','focus','in_meeting','away','offline'].includes(p.status)||!p.position||['x','y'].some(k=>!Number.isFinite(p.position[k])||p.position[k]<0||p.position[k]>100)||!Number.isFinite(Date.parse(p.since)))invalid('Chats presence state is invalid.');
  for(const n of data.notifications)if(!id(n.id)||!id(n.userId)||typeof n.title!=='string'||!Number.isFinite(Date.parse(n.createdAt))||n.channelId&&!channels.has(n.channelId))invalid('Chats notification state is invalid.');
  const boards = new Set();
  for (const board of data.whiteboards) {
    if (!id(board.id) || boards.has(board.id) || !id(board.ownerId) || typeof board.name !== 'string' || !board.name.trim() || board.name.length > 100 || !Number.isSafeInteger(board.revision) || board.revision < 1 || !Number.isFinite(Date.parse(board.createdAt)) || !Number.isFinite(Date.parse(board.updatedAt)) || board.channelId && board.meetingId || board.channelId !== null && !channels.has(board.channelId) || board.meetingId !== null && !meetings.has(board.meetingId) || Object.keys(board).some(key => !['id', 'name', 'ownerId', 'channelId', 'meetingId', 'reference', 'revision', 'createdAt', 'updatedAt', 'custodyReadOnly', 'custodyOperationId'].includes(key))) invalid('Chats whiteboard index is invalid.');
    try { fileReferences.reference(board.reference, board.reference?.workspaceId); } catch { invalid('Chats whiteboard Files reference is invalid.'); }
    boards.add(board.id);
  }
  if (data.whiteboardOperations !== undefined) {
    if (!data.whiteboardOperations || typeof data.whiteboardOperations !== 'object' || Array.isArray(data.whiteboardOperations)) invalid('Chats whiteboard receipts are invalid.');
    for (const [key, receipt] of Object.entries(data.whiteboardOperations)) if (!/^[\w.:-]{1,96}:[\w.:-]{1,96}$/.test(key) || !receipt || Object.keys(receipt).sort().join() !== 'boardId,fingerprint,versionId' || !/^[a-f0-9]{64}$/.test(receipt.fingerprint) || !boards.has(receipt.boardId) || !id(receipt.versionId)) invalid('Chats whiteboard receipt is invalid.');
  }
  for (const user of data.historicalUsers) if (Object.keys(user).some(key => !['id', 'name', 'initials', 'tint'].includes(key)) || !id(user.id) || typeof user.name !== 'string') invalid('Chats historical display record contains authority or private fields.');
  for (const [userId, reads] of Object.entries(data.readState)) {
    if (!id(userId) || !reads || typeof reads !== 'object') invalid('Chats read state is invalid.');
    for (const [channelId, cursor] of Object.entries(reads)) if (!channels.has(channelId) || !Number.isSafeInteger(cursor) || cursor < 0 || cursor > sequences.messages) invalid('Chats read cursor is invalid.');
  }
  for (const [userId, preferences] of Object.entries(data.channelPreferences)) {
    if (!id(userId) || !preferences || typeof preferences !== 'object') invalid('Chats channel preferences are invalid.');
    for (const [channelId, notify] of Object.entries(preferences)) if (!channels.has(channelId) || !['all', 'mentions', 'none'].includes(notify)) invalid('Chats channel preference crosses a channel.');
  }
  if (!Array.isArray(data.processedCommands) || data.processedCommands.length > 256 || !Array.isArray(data.custodyOperations)) invalid('Chats command metadata is invalid.');
  const operations = new Set();
  for (const entry of data.processedCommands) { if (!id(entry.id) || operations.has(entry.id) || typeof entry.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(entry.fingerprint) || Object.keys(entry).sort().join() !== 'fingerprint,id') invalid('Chats command receipt is invalid.'); operations.add(entry.id); }
  if (data.custodyOperations.some(operation => !id(operation))) invalid('Chats custody operation is invalid.');
  if (!data.floor || !Array.isArray(data.floor.rooms) || !data.settings) invalid('Chats presentation state is invalid.');
}
function decode(data, sequences) { validate(data, sequences); return { data: clone(data), sequences: clone(sequences) }; }
function encode(state) { const result = decode(state.data, state.sequences); if (!Object.keys(result.data.whiteboardOperations || {}).length) delete result.data.whiteboardOperations; return result; }
module.exports = { initialize, decode, encode, emptyInsight, emptyTime, id };
