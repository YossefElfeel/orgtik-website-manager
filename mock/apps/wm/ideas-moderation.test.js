const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const wm = require('../wm');

async function fixture(t) {
  let role = 'wm_admin';
  const actor = { id: 1, key: 'editor', firstName: 'Test', lastName: 'Moderator', isActive: true };
  const identity = { userFromReq: () => actor, userScopes: () => [{ scope: 'website_manager', roles: [role] }], fullName: () => 'Test Moderator', publicUser: user => user, findByKey: () => actor, findUser: () => actor, users: [actor] };
  const app = express(); app.use(express.json());
  const hooks = wm.routes(app, { identity, realm: 'ideas-test', uploadsDir: require('node:os').tmpdir(), config: { apiUrl: () => 'http://localhost' }, apiUrl: () => 'http://localhost', webUrl: () => 'http://localhost', log() {} });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return { hooks, as(value) { role = value; }, async call(route, body, version) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/v2${route}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(version == null ? {} : { 'if-match': String(version) }) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, ...await response.json() };
  } };
}

test('comment moderation is permission checked, versioned, persisted and reflected publicly', async t => {
  const f = await fixture(t);
  let idea = (await f.call('/admin/ideas?status=open')).data.find(row => row.commentPreview?.length);
  const comment = idea.commentPreview[0], route = `/admin/ideas/${idea.id}/comments/${comment.id}/moderate`;
  f.as('wm_viewer'); assert.equal((await f.call(route, { action: 'hide' }, idea.version)).status, 403);
  f.as('wm_admin'); assert.equal((await f.call(route, { action: 'hide' }, idea.version + 1)).status, 412);
  assert.equal((await f.call(route, { action: 'unknown' }, idea.version)).status, 400);
  const before = idea.comments;
  idea = (await f.call(route, { action: 'hide' }, idea.version)).data;
  assert.equal(idea.comments, before - 1); assert.equal(idea.commentPreview[0].status, 'hidden');
  assert.ok(!(await f.call('/public/ideas')).data.find(row => row.id === idea.id).commentPreview.some(row => row.id === comment.id));
  const snapshot = f.hooks.exportState(); f.hooks.importState(snapshot);
  assert.equal((await f.call(`/admin/ideas/${idea.id}`)).data.commentPreview[0].status, 'hidden');
  idea = (await f.call(route, { action: 'publish' }, idea.version)).data;
  assert.equal(idea.comments, before);
  assert.ok((await f.call('/public/ideas')).data.find(row => row.id === idea.id).commentPreview.some(row => row.id === comment.id));
  idea = (await f.call(route, { action: 'delete' }, idea.version)).data;
  assert.equal(idea.comments, before - 1); assert.ok(!idea.commentPreview.some(row => row.id === comment.id));
  assert.equal((await f.call(route, { action: 'publish' }, idea.version)).status, 404);
  assert.ok(idea.history.some(row => row.action === 'comment_delete'));
});

test('notes survive reload, reject invalid or stale writes and never enter public ideas', async t => {
  const f = await fixture(t); let idea = (await f.call('/admin/ideas?status=open')).data[0];
  const route = `/admin/ideas/${idea.id}/notes`;
  assert.equal((await f.call(route, { text: ' ' }, idea.version)).status, 422);
  assert.equal((await f.call(route, { text: 'x'.repeat(5001) }, idea.version)).status, 422);
  f.as('wm_viewer'); assert.equal((await f.call(route, { text: 'Private team note' }, idea.version)).status, 403);
  f.as('wm_admin');
  const previousVersion = idea.version;
  idea = (await f.call(route, { text: 'Private team note' }, idea.version)).data;
  assert.equal((await f.call(route, { text: 'Stale note' }, previousVersion)).status, 412);
  f.hooks.importState(f.hooks.exportState());
  assert.equal((await f.call(`/admin/ideas/${idea.id}`)).data.notes[0].text, 'Private team note');
  const publicIdea = (await f.call('/public/ideas')).data.find(row => row.id === idea.id);
  assert.equal(publicIdea.notes, undefined); assert.ok(!JSON.stringify(publicIdea).includes('Private team note'));
});

test('titled website suggestions appear in the normal list and merge into the chosen topic', async t => {
  const f = await fixture(t);
  const state = f.hooks.exportState(); state.data.ops.site.formsMode = 'live'; f.hooks.importState(state);
  const privacyVersion = (await f.call('/public/site')).data.forms.privacyVersion;
  const submission = { name: 'Sample Visitor', email: 'visitor@example.test', title: 'A separate suggestion title', message: 'Full suggestion details', topic: 'A product idea', consent: true, privacyVersion };
  assert.equal((await f.call('/public/ideas', { ...submission, title: '' })).status, 422);
  const saved = await f.call('/public/ideas', submission); assert.equal(saved.status, 201);
  const duplicate = await f.call('/public/ideas', submission); assert.equal(duplicate.data.id, saved.data.id);
  const list = await f.call('/admin/ideas?status=all');
  let idea = list.data.find(row => row.id === saved.data.id);
  assert.ok(idea); assert.equal(idea.title, submission.title); assert.equal(idea.body, submission.message); assert.equal(idea.status, 'pending');
  assert.ok(!(await f.call('/public/ideas')).data.some(row => row.id === idea.id));
  const target = (await f.call('/admin/ideas?mergeable=true')).data[0];
  assert.ok(['open','planned','in_progress','shipped'].includes(target.status));
  idea = (await f.call(`/admin/ideas/${idea.id}/moderate`, { action: 'merge', into: target.id }, idea.version)).data;
  assert.equal(idea.mergedInto, target.id); assert.equal(idea.mergedIntoTitle, target.title);
});

test('merging moves moderated discussions without duplicate IDs or leaking private notes', () => {
  const { makeStore } = require('./content');
  const { publicIdea, moderateComment, addIdeaNote } = require('./ideas');
  const now = '2026-10-15T10:00:00.000Z';
  const store = makeStore(() => now), source = [...store.ideas.values()].find(row => row.status === 'open');
  const target = [...store.ideas.values()].find(row => row.id !== source.id && store.VISIBLE.includes(row.status));
  source.commentPreview = [{ id: 'shared-id', author: 'Sample author', body: 'Visible comment' }, { id: 'hidden-id', author: 'Sample author', body: 'Hidden comment', status: 'hidden' }];
  source.comments = 1; source.votes = 5;
  target.commentPreview = [{ id: 'shared-id', author: 'Another author', body: 'Existing comment' }]; target.comments = 1;
  addIdeaNote(source, 'Private merge context', 'editor', now, store.audit);
  const votes = target.votes;
  assert.ok(store.moderate(source, { key: 'editor' }, 'merge', { into: target.id }).idea);
  assert.equal(target.votes, votes + 5); assert.equal(target.comments, 2); assert.deepEqual(source.commentPreview, []); assert.equal(source.comments, 0);
  assert.equal(new Set(target.commentPreview.map(row => row.id)).size, 3);
  assert.equal(publicIdea(target).commentPreview.length, 2);
  const moved = target.commentPreview.find(row => row.body === 'Visible comment');
  moderateComment(target, moved.id, 'hide', 'editor', now, store.audit);
  assert.equal(publicIdea(target).comments, 1);
  assert.equal(source.notes[0].text, 'Private merge context'); assert.equal(publicIdea(source).notes, undefined);
});
