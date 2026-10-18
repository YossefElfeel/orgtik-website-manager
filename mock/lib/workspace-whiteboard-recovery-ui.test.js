// Real client modules and effects with an isolated React/HTTP boundary. No browser or live API.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const ts = require(require.resolve('typescript', { paths: [path.join(root, 'apps/chats')] }));
const parser = require('./whiteboard-scene');
const clone = value => JSON.parse(JSON.stringify(value));
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };
const scene = width => parser.validateWhiteboardScene({ schema: 'orgtik.whiteboard', version: 1, elements: [{ id: 'box', type: 'rectangle', x: 0, y: 0, width, height: 50 }], appState: { viewBackgroundColor: '#ffffff' } });
const deferred = () => { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve }; };

function renderer() {
  const hooks = []; let cursor = 0, pending = false, active = false, component, props, tree, error, renders = 0;
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  function schedule() { if (!pending && active) { pending = true; queueMicrotask(render); } }
  function render() {
    pending = false; if (!active) return;
    try {
      if (++renders > 150) throw new Error('The actual component does not settle its render/effect cycle.');
      cursor = 0; tree = resolveComponents(component(props));
      // Effects run as one commit; setter updates do not interrupt this effect batch.
      for (const hook of hooks) if (hook.effect) { const effect = hook.effect; hook.effect = null; hook.cleanup?.(); hook.cleanup = effect(); }
    } catch (failure) { error = failure; active = false; }
  }
  // Evaluate the real owner component nested by the new connection composition.
  function resolveComponents(value) {
    if (Array.isArray(value)) return value.map(resolveComponents);
    if (!value || typeof value !== 'object' || !value.props) return value;
    if (typeof value.type === 'function') return resolveComponents(value.type(value.props));
    return { ...value, props: { ...value.props, children: resolveComponents(value.props.children) } };
  }
  const react = {
    useState(initial) {
      const index = cursor++, hook = hooks[index] ||= { value: typeof initial === 'function' ? initial() : initial };
      hook.set ||= next => { const value = typeof next === 'function' ? next(hook.value) : next; if (!Object.is(value, hook.value)) { hook.value = value; schedule(); } };
      return [hook.value, hook.set];
    },
    useRef(initial) { const index = cursor++; return (hooks[index] ||= { value: { current: initial } }).value; },
    useEffect(effect, deps) { const index = cursor++, hook = hooks[index] ||= {}; if (!equal(hook.deps, deps)) { hook.deps = deps; hook.effect = effect; } },
    useMemo(factory, deps) { const index = cursor++, hook = hooks[index] ||= {}; if (!equal(hook.deps, deps)) { hook.deps = deps; hook.value = factory(); } return hook.value; },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useSyncExternalStore(subscribe, read) { react.useEffect(() => subscribe(schedule), [subscribe]); return read(); },
  };
  function nodes(type, predicate = () => true) {
    const found = [];
    function visit(value) { if (Array.isArray(value)) return value.forEach(visit); if (!value || typeof value !== 'object') return; if (value.type === type && predicate(value.props)) found.push(value); visit(value.props?.children); }
    visit(tree); return found;
  }
  return { react, mount(fn, initial = {}) { component = fn; props = initial; active = true; render(); }, update(next) { props = { ...props, ...next }; schedule(); }, nodes, get error() { return error; }, close() { active = false; hooks.forEach(hook => hook.cleanup?.()); } };
}

function environment() {
  const r = renderer(), storage = new Map(), listeners = new Set(), writes = [], receipts = new Map(), boards = new Map();
  let current, holdList = null, holdWrite = null, outcome = 'available';
  let address = new URL('http://isolated.fixture/hq/whiteboard'), navigationSearch = address.search;
  const historyCalls = [];
  const browser = {
    location: Object.fromEntries(['href', 'origin', 'pathname', 'search', 'hash'].map(key => [key, undefined])),
    history: { state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ['fixture-router-tree'] }, replaceState(state, _unused, next) {
      const value = next == null ? address : new URL(String(next), address);
      assert.equal(value.origin, address.origin, 'History updates must stay on the browser origin');
      // Match the installed Next wrapper: its own __NA/_N state bypasses query sync.
      // External replaceState copies router internals and restores the live query context.
      if (!state?.__NA && !state?._N) {
        navigationSearch = value.search;
        state = { ...(state || {}), __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: this.state.__PRIVATE_NEXTJS_INTERNALS_TREE };
        r.update({});
      }
      address = value; this.state = structuredClone(state); historyCalls.push({ href: address.href, state: clone(this.state) });
      // Neither branch fabricates popstate or a server-component prop refresh.
    } },
  };
  for (const key of ['href', 'origin', 'pathname', 'search', 'hash']) Object.defineProperty(browser.location, key, { get: () => address[key] });
  function session(workspaceId) {
    return { tokens: { accessToken: 'isolated-client-placeholder' }, workspaceContext: { realm: 'fixture', workspace: { id: workspaceId, state: 'active' }, actor: { userId: 1, effectiveUserId: 1, readOnly: false }, member: { id: 'member-one', role: 'owner', revision: 1, accessEpoch: 0 }, tools: { chat: { scope: 'hq', access: 'active', roles: ['owner'], canWrite: true }, files: { scope: 'file_manager', access: 'active', roles: ['super_admin'], canWrite: true } } } };
  }
  current = session('a');
  function board(workspaceId, id, width, versionId = 'v1') {
    return { workspaceId, id, name: 'Board ' + id, channelId: null, meetingId: null, revision: Number(versionId.slice(1)), reference: { workspaceId, fileId: 'file-' + id, versionId }, headReference: { workspaceId, fileId: 'file-' + id, versionId }, updatedAt: '2026-10-07T09:00:00Z', capabilities: { canWrite: true, readOnly: false }, scene: scene(width) };
  }
  for (const [workspaceId, id, width] of [['a', 'A', 100], ['a', 'B', 200], ['b', 'C', 300]]) boards.set(workspaceId + ':' + id, board(workspaceId, id, width));
  const response = (data, status = 200) => ({ status, ok: status < 400, json: async () => status < 400 ? { success: true, data: clone(data) } : { success: false, code: data } });
  const cache = new Map();
  const t = key => key, jsx = (type, props, key) => ({ type, props, key });
  const auth = { readClientSession: () => current, refreshClientSession: async () => current, subscribeClientSession(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
  async function fetch(url, options) {
    const parsed = new URL(url), workspaceId = options.headers.get('X-Workspace'), id = parsed.pathname.split('/whiteboards/')[1];
    if (options.method === 'GET') {
      const value = id ? boards.get(workspaceId + ':' + decodeURIComponent(id)) : { items: [...boards.values()].filter(item => item.workspaceId === workspaceId).map(({ scene, ...summary }) => summary) };
      const gate = !id && holdList; if (gate) { holdList = null; await gate.promise; }
      return value ? response(value) : response('whiteboard_not_found', 404);
    }
    const body = JSON.parse(options.body), key = options.headers.get('Idempotency-Key');
    writes.push({ workspaceId, key, body: clone(body), method: options.method });
    if (outcome === 'refused') return response('whiteboard_write_required', 403);
    if (outcome === 'conflict') return response('version_conflict', 409);
    if (!receipts.has(key)) {
      const previous = id ? boards.get(workspaceId + ':' + decodeURIComponent(id)) : null;
      const saved = board(workspaceId, id || 'created', body.scene.elements[0]?.width || 0, previous ? 'v' + (previous.revision + 1) : 'v1');
      saved.name = body.name || previous?.name || saved.name; saved.scene = parser.validateWhiteboardScene(body.scene); saved.savedReference = clone(saved.reference);
      receipts.set(key, saved); boards.set(workspaceId + ':' + saved.id, saved);
    }
    const gate = holdWrite; if (gate) { holdWrite = null; await gate.promise; }
    if (outcome === 'lost') throw new Error('Isolated response lost after commit');
    return response(receipts.get(key), options.method === 'POST' ? 201 : 200);
  }
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const module = { exports: {} }; cache.set(relative, module.exports);
    const source = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(source, { module, exports: module.exports, crypto: crypto.webcrypto, structuredClone, TextEncoder, AbortController, URL, URLSearchParams, Headers, fetch, window: browser, process: { env: { NEXT_PUBLIC_API_URL: 'http://isolated.fixture/chats' } }, document: { documentElement: { dataset: { theme: 'light' } } }, sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, require(name) {
      if (name === 'react') return r.react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (name === '@orgtik/ui/auth') return auth;
      if (name === '@orgtik/ui') return { Button: 'Button', Input: 'Input', Select: 'Select' };
      if (name === '@phosphor-icons/react') return { FloppyDisk: 'FloppyDisk', Plus: 'Plus' };
      // Connection policy has its actual selector/native readonly proof; this boundary
      // keeps the original board conflict, history and recovery assertions isolated.
      if (name === '@/features/chat/ChatFeatures') return { ChatConnection: ({ children }) => children };
      if (name === '@/lib/i18n') return { useT: () => t, useI18n: () => ({ locale: 'en' }) };
      if (name === '@/lib/suite-session') return { SOS_API_URL: 'http://isolated.fixture/sos/api' };
      if (name === './Whiteboard') return { Whiteboard: 'Whiteboard' };
      if (name === 'next/dynamic') return { default: () => 'Excalidraw' };
      if (name === 'next/navigation') return { useSearchParams: () => r.react.useMemo(() => new URLSearchParams(navigationSearch), [navigationSearch]) };
      if (name === '@/components/ui/Primitives') return { Skeleton: 'Skeleton' };
      if (name.endsWith('.css')) return {};
      const mapped = { '@/lib/api-url': 'apps/chats/lib/api-url.ts', '@/lib/file-references': 'apps/chats/lib/file-references.ts', './file-references': 'apps/chats/lib/file-references.ts', '@/lib/whiteboard-scene': 'apps/chats/lib/whiteboard-scene.ts', './whiteboard-scene': 'apps/chats/lib/whiteboard-scene.ts', '@/lib/whiteboards': 'apps/chats/lib/whiteboards.ts' }[name];
      if (!mapped) throw new Error('Unexpected UI module import: ' + name); return load(mapped);
    } });
    cache.set(relative, module.exports); return module.exports;
  }
  return { r, storage, boards, writes, receipts, load, browser, historyCalls, mount(props) {
    const query = new URLSearchParams(); if (props?.boardId) query.set('boardId', props.boardId); if (props?.versionId) query.set('versionId', props.versionId);
    address = new URL('http://isolated.fixture/hq/whiteboard' + (query.size ? '?' + query : ''));
    navigationSearch = address.search;
    r.mount(load('apps/chats/features/meetings/BoardScreen.tsx').BoardScreen, props);
  }, navigate(next) {
    // Explicit router navigation has both a new URL and fresh page props, unlike native history.
    for (const key of ['boardId', 'versionId']) if (Object.hasOwn(next, key)) { if (next[key]) address.searchParams.set(key, next[key]); else address.searchParams.delete(key); }
    navigationSearch = address.search; r.update(next);
  }, switch(workspaceId) { current = session(workspaceId); listeners.forEach(listener => listener()); }, holdNextList() { const gate = deferred(); holdList = gate; return gate; }, holdNextWrite() { const gate = deferred(); holdWrite = gate; return gate; }, outcome(value) { outcome = value; },
    editor() { assert.equal(r.error, undefined); const nodes = r.nodes('Whiteboard'); assert.equal(nodes.length, 1); return nodes[0].props; },
    button(label) { const node = r.nodes('Button', props => props.children === label)[0]; assert.ok(node, 'Expected current button: ' + label); return node.props; },
    select(id) { const node = r.nodes('Select')[0]; assert.ok(node); node.props.onValueChange(id); }, close: r.close };
}

test('actual BoardScreen switches dirty A to B without storing or hydrating A under B', async () => {
  const f = environment();
  try {
    f.mount({ boardId: 'A' }); await settle(); f.editor().onChange(scene(150)); await settle();
    const gate = f.holdNextList(); f.select('B'); await settle(); assert.equal(f.r.nodes('Whiteboard').length, 0);
    gate.resolve(); await settle(); assert.equal(f.editor().scene.elements[0].width, 200);
    for (const [key, value] of f.storage) if (key.endsWith(':B:draft')) assert.notEqual(JSON.parse(value).scene.elements[0].width, 150);
    f.select('A'); await settle(); assert.equal(f.editor().scene.elements[0].width, 150);
  } finally { f.close(); }
});

test('actual Save as new copy cannot hydrate an old workspace drawing after a delayed list', async () => {
  const f = environment();
  try {
    f.mount({ boardId: 'A', versionId: 'v1' }); await settle();
    const gate = f.holdNextList(); f.button('boards.saveAsNew').onClick(); await settle();
    f.switch('b'); await settle(); gate.resolve(); await settle();
    assert.equal(f.editor().scene.elements.length, 0);
    const input = f.r.nodes('Input')[0]; assert.equal(input.props.value, '');
    for (const [key, value] of f.storage) if (key.includes('["fixture","b"')) assert.equal(JSON.parse(value).scene?.elements?.some(element => element.width === 100), false);
  } finally { f.close(); }
});

test('actual BoardScreen retains an uncertain save through403 and recovers one original operation', async () => {
  const f = environment();
  try {
    f.mount({ boardId: 'A' }); await settle(); f.editor().onChange(scene(160)); await settle();
    f.outcome('lost'); await f.button('boards.save').onClick(); await settle(); assert.equal(f.editor().readOnly, true);
    f.outcome('refused'); await f.button('boards.recover').onClick(); await settle(); assert.equal(f.editor().readOnly, true);
    f.outcome('available'); await f.button('boards.recover').onClick(); await settle();
    assert.equal(f.receipts.size, 1); assert.equal(new Set(f.writes.map(row => row.key)).size, 1); assert.equal(new Set(f.writes.map(row => JSON.stringify(row.body))).size, 1);
    assert.equal(f.editor().readOnly, false); assert.equal(f.editor().scene.elements[0].width, 160);
  } finally { f.close(); }
});

test('a delayed successful A save never hydrates B and remains recoverable in its original view', async () => {
  const f = environment();
  try {
    f.mount({ boardId: 'A' }); await settle(); f.editor().onChange(scene(165)); await settle();
    const gate = f.holdNextWrite(); f.button('boards.save').onClick(); await settle(); assert.equal(f.writes.length, 1);
    f.navigate({ boardId: 'B' }); await settle(); assert.equal(f.editor().scene.elements[0].width, 200);
    gate.resolve(); await settle(); assert.equal(f.editor().scene.elements[0].width, 200);
    f.navigate({ boardId: 'A' }); await settle(); assert.equal(f.editor().scene.elements[0].width, 165); assert.equal(f.editor().readOnly, true);
    f.button('boards.recover').onClick(); await settle(); assert.equal(f.editor().readOnly, false);
    assert.equal(f.receipts.size, 1); assert.equal(new Set(f.writes.map(row => row.key)).size, 1);
  } finally { f.close(); }
});

test('actual conflict reload retains its draft and historical mode never edits the pinned scene', async () => {
  const f = environment();
  try {
    f.mount({ boardId: 'A' }); await settle(); f.editor().onChange(scene(175)); await settle();
    f.outcome('conflict'); await f.button('boards.save').onClick(); await settle();
    assert.equal(f.editor().scene.elements[0].width, 175);
    f.button('boards.reloadLatest').onClick(); await settle(); assert.equal(f.editor().scene.elements[0].width, 100);
    f.button('boards.restoreDraft').onClick(); await settle(); assert.equal(f.editor().scene.elements[0].width, 175);
    f.navigate({ versionId: 'v1' }); await settle(); assert.equal(f.editor().readOnly, true); assert.equal(f.editor().scene.elements[0].width, 100);
  } finally { f.close(); }
});

test('actual Whiteboard unchanged vendor callbacks do not feed a parent render loop', async () => {
  const f = environment(); let changes = 0;
  try {
    const initial = scene(100);
    initial.elements.push(parser.validateWhiteboardScene({ schema: 'orgtik.whiteboard', version: 1, elements: [{ id: 'line', type: 'line', points: [[0, 0], [80, 20]], lastCommittedPoint: [80, 20], width: 80, height: 20 }], appState: { viewBackgroundColor: '#ffffff' } }).elements[0]);
    const Whiteboard = f.load('apps/chats/features/meetings/Whiteboard.tsx').Whiteboard;
    f.r.mount(Whiteboard, { scene: initial, onChange() { changes++; }, onIssue() {} }); await settle();
    const vendor = () => f.r.nodes('Excalidraw')[0].props;
    vendor().onChange(initial.elements, initial.appState, {}); vendor().onChange(initial.elements, initial.appState, {});
    // The installed vendor restores empty bindings as[] and finalizes transient points asnull.
    const restored = clone(initial); for (const element of restored.elements) { element.boundElements = []; if ('lastCommittedPoint' in element) element.lastCommittedPoint = null; }
    vendor().onChange(restored.elements, restored.appState, {});
    assert.equal(changes, 0);
    const edited = scene(180); vendor().onChange(edited.elements, edited.appState, {}); vendor().onChange(edited.elements, edited.appState, {});
    assert.equal(changes, 1);
  } finally { f.close(); }
});
