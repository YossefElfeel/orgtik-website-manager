const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, harness, plain } = require('../tasks/runtime-harness');
const event = (channelId, text, id) => ({ type: 'message.created', message: { ...(id ? { id } : {}), channelId, authorId: '999', text, attachments: [] } });
const create = (id, members = ['1', '2'], kind = 'private') => ({ type: 'channel.created', channel: { id, name: 'Delivery', kind, memberIds: members } });

test('Chats actual routers isolate equal IDs, directory, member-only channels and spoofed authors', async () => {
  const first = runtime('chats', 'one'), second = runtime('chats', 'two', { users: [{ id: 1, key: 'one', firstName: 'Other', lastName: 'Owner', email: 'other@test.invalid', isActive: true }, { id: 3, key: 'three', firstName: 'Other', lastName: 'Member', isActive: true }], roles: { one: ['owner'], three: ['member'] } });
  const api = await harness([first, second]);
  try {
    const empty = (await api.call(0, 'GET', '/api/hq/bootstrap')).json.data;
    assert.equal(empty.me, '1'); assert.deepEqual(empty.channels, []); assert.deepEqual(empty.floor.rooms, []); assert.deepEqual(empty.messages, []);
    assert.deepEqual(empty.users.map(user => user.id), ['1', '2']);
    const command = async (index, event, operationId, user = '1') => api.call(index, 'POST', '/api/hq/commands', { event }, { 'Idempotency-Key': operationId, 'x-user': user });
    assert.equal((await command(0, create('same', ['1']), 'create-a')).status, 200);
    assert.equal((await command(1, create('same', ['1', '3']), 'create-b')).status, 200);
    assert.equal((await command(0, event('same', 'Alpha'), 'send-a')).status, 200);
    assert.equal((await command(1, event('same', 'Beta'), 'send-b')).status, 200);
    assert.equal((await api.call(0, 'GET', '/api/hq/bootstrap', undefined, { 'x-user': '2' })).json.data.messages.length, 0);
    assert.equal((await command(0, event('same', 'Forbidden'), 'send-c', '2')).status, 404);
    assert.equal((await command(0, create('other', ['1', '3']), 'foreign-member')).status, 422);
    const a = (await api.call(0, 'GET', '/api/hq/bootstrap')).json.data, b = (await api.call(1, 'GET', '/api/hq/bootstrap')).json.data;
    assert.equal(a.messages[0].text, 'Alpha'); assert.equal(b.messages[0].text, 'Beta'); assert.equal(a.messages[0].authorId, '1');
    assert.deepEqual(b.users.map(user => user.id), ['1', '3']);
  } finally { await api.close(); }
});

test('Chats snapshots preserve read cursors, thread/reaction state, receipts and allocator after cold start', async () => {
  const first = runtime('chats', 'one'); const api = await harness([first]); let snapshot;
  try {
    const command = (value, op, user = '1') => api.call(0, 'POST', '/api/hq/commands', { event: value }, { 'Idempotency-Key': op, 'x-user': user });
    await command(create('channel'), 'create');
    const original = event('channel', 'Original');
    const sent = await command(original, 'send'); assert.equal(sent.status, 200);
    const id = sent.json.data.messages[0].id;
    assert.equal((await command(original, 'send')).json.data.messages.length, 1);
    assert.equal((await command(event('channel', 'Altered'), 'send')).status, 409);
    await command({ type: 'message.created', message: { channelId: 'channel', text: 'Reply', threadId: id } }, 'thread', '2');
    await command({ type: 'message.reaction_toggled', messageId: id, emoji: '👍', userId: '999' }, 'react', '2');
    await command({ type: 'channel.read', channelId: 'channel' }, 'read', '1');
    snapshot = plain(first.instance.exportSnapshot());
    assert.equal(snapshot.data.messages[0].replyCount, 1); assert.deepEqual(snapshot.data.messages[0].reactions[0].userIds, ['2']);
  } finally { await api.close(); }
  const cold = runtime('chats', 'one', { snapshot }); const restarted = await harness([cold]);
  try {
    assert.deepEqual(plain(cold.instance.exportSnapshot()), snapshot);
    const boot = (await restarted.call(0, 'GET', '/api/hq/bootstrap')).json.data;
    assert.equal(boot.channels[0].unread, 0); assert.equal(boot.readState.channel, 2); assert.equal(Object.values(boot.threadReplies)[0][0].text, 'Reply');
    const sent = await restarted.call(0, 'POST', '/api/hq/commands', { event: event('channel', 'After cold start') }, { 'Idempotency-Key': 'send-next' });
    assert.equal(sent.json.data.messages.at(-1).id, 'm-3');
    assert.throws(() => runtime('chats', 'other', { snapshot }), /another runtime/);
  } finally { await restarted.close(); }
});

test('Chats guests, global-admin-like users and read-only contexts cannot bootstrap or write beyond own grants', async () => {
  const guest = runtime('chats', 'one', { roles: { one: ['guest'], two: ['member'] } }), readOnly = runtime('chats', 'two', { writable: false });
  const api = await harness([guest, readOnly]);
  try {
    assert.equal((await api.call(0, 'GET', '/api/hq/bootstrap')).status, 403);
    assert.equal((await api.call(0, 'POST', '/api/hq/commands', { event: create('x') }, { 'Idempotency-Key': 'guest' })).status, 403);
    assert.equal((await api.call(1, 'POST', '/api/hq/commands', { event: create('x') }, { 'Idempotency-Key': 'readonly' })).status, 423);
    assert.throws(() => readOnly.instance.bootstrap({ mode: 'public_resource', realm: 'isolated', workspace: { id: 'two' }, actor: { effectiveUserId: 1 }, tools: { chat: { access: 'active' } } }), /not authorized/);
    assert.deepEqual(plain(readOnly.instance.exportSnapshot().data.channels), []);
  } finally { await api.close(); }
});

test('OrgTik historical sample is explicit, author display never enters membership; Nile stays empty', async () => {
  const org = runtime('chats', 'ws_orgtik', { fixtureId: 'orgtik-v1' }), nile = runtime('chats', 'ws_nile', { fixtureId: 'nile-v1' });
  const api = await harness([org, nile]);
  try {
    const boot = (await api.call(0, 'GET', '/api/hq/bootstrap')).json.data;
    assert.equal(boot.me, '1'); assert.ok(boot.channels.length > 0); assert.ok(boot.messages.length > 0);
    assert.deepEqual(boot.users.map(user => user.id), ['1', '2']); assert.ok(boot.historicalUsers.length > 0);
    assert.ok(boot.historicalUsers.every(user => !('role' in user) && !('email' in user)));
    const empty = (await api.call(1, 'GET', '/api/hq/bootstrap')).json.data; assert.deepEqual(empty.channels, []); assert.deepEqual(empty.historicalUsers, []);
    const snapshot = plain(org.instance.exportSnapshot()); assert.equal(snapshot.data.messages.length, 28); // original messages and seeded thread replies
  } finally { await api.close(); }
});

test('Chats custody transfers history once and archives without granting departed access', async () => {
  const first = runtime('chats', 'one'); const api = await harness([first]);
  try {
    await api.call(0, 'POST', '/api/hq/commands', { event: create('owned') }, { 'Idempotency-Key': 'create' });
    await api.call(0, 'POST', '/api/hq/commands', { event: event('owned', 'Authored by one') }, { 'Idempotency-Key': 'send' });
    assert.deepEqual(plain(first.instance.transferOwnership({ fromUserId: 1, target: { kind: 'member', userId: 2 }, operationId: 'transfer' })), { transferred: ['chat:channel:owned'], archived: [] });
    assert.equal((await api.call(0, 'GET', '/api/hq/bootstrap')).json.data.channels.length, 0);
    assert.equal((await api.call(0, 'GET', '/api/hq/bootstrap', undefined, { 'x-user': '2' })).json.data.messages[0].authorId, '1');
    assert.deepEqual(plain(first.instance.transferOwnership({ fromUserId: 1, target: { kind: 'member', userId: 2 }, operationId: 'transfer' })), { transferred: [], archived: [] });
    first.instance.transferOwnership({ fromUserId: 2, target: { kind: 'archive' }, operationId: 'archive' });
    const saved = first.instance.exportSnapshot(); assert.equal(saved.data.channels[0].custodyReadOnly, true); assert.equal(saved.data.messages[0].authorId, '1');
  } finally { await api.close(); }
});

test('Chats receipts recheck current channel membership before returning prior success', async () => {
  const first = runtime('chats', 'one'); const api = await harness([first]);
  try {
    await api.call(0, 'POST', '/api/hq/commands', { event: create('private') }, { 'Idempotency-Key': 'create' });
    const command = event('private', 'Member message');
    assert.equal((await api.call(0, 'POST', '/api/hq/commands', { event: command }, { 'Idempotency-Key': 'member-send', 'x-user': '2' })).status, 200);
    await api.call(0, 'POST', '/api/hq/commands', { event: { type: 'channel.member_removed', channelId: 'private', userId: '2' } }, { 'Idempotency-Key': 'remove' });
    assert.equal((await api.call(0, 'POST', '/api/hq/commands', { event: command }, { 'Idempotency-Key': 'member-send', 'x-user': '2' })).status, 404);
    assert.equal(first.instance.exportSnapshot().data.messages.length, 1);
  } finally { await api.close(); }
});


test('connected task audience keeps private/group/DM messages within current admitted source readers',async()=>{
  const first=runtime('chats','one'),api=await harness([first]),context={mode:'workspace',realm:'isolated',workspace:{id:'one'},actor:{effectiveUserId:1},tools:{chat:{access:'active'}}};
  try{
    await api.call(0,'POST','/api/hq/commands',{event:create('private-source')},{'Idempotency-Key':'audience-create'});
    const response=await api.call(0,'POST','/api/hq/commands',{event:event('private-source','Private source')},{'Idempotency-Key':'audience-message'}),messageId=response.json.data.messages[0].id;
    assert.deepEqual(plain(first.instance.connectedTaskAudience(context,messageId)),{restricted:true,userIds:[1,2]});
    assert.throws(()=>first.instance.connectedTaskAudience({...context,workspace:{id:'other'}},messageId),/not authorized/);
    assert.throws(()=>first.instance.connectedTaskAudience({...context,mode:'public_resource'},messageId),/not authorized/);
    first.identity.users[1].isActive=false;
    assert.deepEqual(plain(first.instance.connectedTaskAudience(context,messageId)),{restricted:true,userIds:[1]});
    assert.throws(()=>first.instance.connectedTaskAudience({...context,actor:{effectiveUserId:2}},messageId),/assigned Chats member/);
    assert.throws(()=>first.instance.connectedTaskAudience(context,'missing-message'),/Message not found/);
  }finally{await api.close();}
});
test('public source metadata is marked unrestricted while an unjoined member cannot read a private source',async()=>{
  const first=runtime('chats','one'),api=await harness([first]),context={mode:'workspace',realm:'isolated',workspace:{id:'one'},actor:{effectiveUserId:1},tools:{chat:{access:'active'}}};
  try{
    await api.call(0,'POST','/api/hq/commands',{event:create('public-source',['1'],'public')},{'Idempotency-Key':'public-create'});
    const pub=await api.call(0,'POST','/api/hq/commands',{event:event('public-source','Public source')},{'Idempotency-Key':'public-message'});
    assert.deepEqual(plain(first.instance.connectedTaskAudience(context,pub.json.data.messages[0].id)),{restricted:false,userIds:[]});
    await api.call(0,'POST','/api/hq/commands',{event:create('only-owner',['1'])},{'Idempotency-Key':'private-create'});
    const pri=await api.call(0,'POST','/api/hq/commands',{event:event('only-owner','Owner only')},{'Idempotency-Key':'private-message'}),messageId=pri.json.data.messages.find(m=>m.channelId==='only-owner').id;
    assert.throws(()=>first.instance.connectedTaskAudience({...context,actor:{effectiveUserId:2}},messageId),/Conversation not found/);
  }finally{await api.close();}
});
