const { test } = require('node:test');
const assert = require('node:assert/strict');
const parser = require('./whiteboard-scene');
const scene = elements => ({ schema: 'orgtik.whiteboard', version: 1, elements, appState: { viewBackgroundColor: '#FFFFFF' } });
const rectangle = (id = 'box') => ({ id, type: 'rectangle', x: 20, y: 10, width: 200, height: 90, seed: 17 });
const invalid = value => assert.throws(() => parser.validateWhiteboardScene(value), { status: 422, code: 'invalid_whiteboard_scene' });

test('canonical scene retains vector/text geometry, local bindings and deterministic UTF8 content', () => {
  const value = parser.serializeWhiteboardScene(scene([{ ...rectangle(), boundElements: [{ id: 'title', type: 'text' }] }, { id: 'title', type: 'text', text: 'خطة العمل', x: 30, y: 20, width: 170, height: 40, containerId: 'box', fontSize: 24 }]));
  assert.equal(value.scene.elements[0].seed, 17); assert.equal(value.scene.elements[1].containerId, 'box');
  assert.equal(value.scene.appState.viewBackgroundColor, '#ffffff');
  assert.equal(value.size, Buffer.byteLength(value.json)); assert.match(value.hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(parser.serializeWhiteboardScene(JSON.parse(value.json)), value);
});

test('volatile reconciliation metadata and input property order do not invent drawing versions', () => {
  const first = parser.serializeWhiteboardScene(scene([rectangle()]));
  const second = parser.serializeWhiteboardScene(scene([{ version: 80, versionNonce: 3423, updated: 1788888888, index: 'a1', ...Object.fromEntries(Object.entries(rectangle()).reverse()) }]));
  assert.equal(first.json, second.json); assert.equal(first.hash, second.hash);
  assert.equal(parser.validateWhiteboardScene(scene([{ ...rectangle(), isDeleted: true }])).elements.length, 0);
  invalid(scene([{ ...rectangle(), versionNonce: Infinity }]));
});

test('images, external content and unchecked fields are refused rather than silently persisted', () => {
  for (const change of [s => s.elements[0].type = 'image', s => s.elements[0].type = 'embeddable', s => s.elements[0].type = 'iframe', s => s.elements[0].link = 'https://untrusted.fixture', s => s.elements[0].fileId = 'opaque-image', s => s.elements[0].customData = {}, s => s.files = { binary: 'data:image/png;base64,untrusted' }, s => s.appState.collaborators = []]) {
    const value = scene([rectangle()]); change(value); invalid(value);
  }
  assert.equal(parser.validateWhiteboardScene(scene([{ id: 'text', type: 'text', text: 'Discuss https://example.test as plain text' }])).elements[0].link, null);
});

test('geometry, colors and local binding targets fail closed before serialization', () => {
  for (const value of [scene([{ ...rectangle(), x: NaN }]), scene([{ ...rectangle(), width: -1 }]), scene([{ ...rectangle(), strokeColor: 'url(https://untrusted.fixture)' }]), scene([rectangle(), rectangle()]), scene([{ ...rectangle(), frameId: 'foreign' }]), scene([{ ...rectangle(), boundElements: [{ id: 'foreign', type: 'text' }] }]), scene([{ ...rectangle(), id: '__proto__' }])]) invalid(value);
});

test('arrow and pen scenes preserve bounded points and supported bindings', () => {
  const value = parser.validateWhiteboardScene(scene([rectangle(), { id: 'arrow', type: 'arrow', points: [[0, 0], [80, 20]], startBinding: { elementId: 'box', focus: 0, gap: 3 }, endArrowhead: 'arrow' }, { id: 'pen', type: 'freedraw', points: [[0, 0], [2, 3]], pressures: [0.4, 0.8], simulatePressure: false }]));
  assert.deepEqual(value.elements[1].points, [[0, 0], [80, 20]]); assert.equal(value.elements[1].startBinding.elementId, 'box');
  assert.equal(value.elements[2].pressures[1], 0.8);
  invalid(scene([{ id: 'pen', type: 'freedraw', points: [[0, 0]], pressures: [2] }]));
});

test('element, point and text limits reject oversized drawing inputs', () => {
  invalid(scene(Array.from({ length: parser.LIMITS.elements + 1 }, (_, index) => rectangle('box-' + index))));
  invalid(scene([{ id: 'pen', type: 'freedraw', points: Array.from({ length: parser.LIMITS.points + 1 }, () => [0, 0]) }]));
  invalid(scene([{ id: 'text', type: 'text', text: 'x'.repeat(parser.LIMITS.text + 1) }]));
});

test('size limit applies to UTF8 input and expanded canonical JSON, not character counts', () => {
  invalid(scene([{ id: 'text', type: 'text', text: 'ع'.repeat(70000) }]));
  invalid(scene([{ ...rectangle(), index: 'a'.repeat(parser.LIMITS.bytes) }]));
  const cyclic = scene([]); cyclic.elements.push(cyclic); invalid(cyclic);
});

test('stored content must already be canonical and cannot redirect its content kind', () => {
  const value = parser.serializeWhiteboardScene(scene([rectangle()]));
  assert.deepEqual(parser.readWhiteboardStorage({ kind: 'whiteboard', scene: value.scene }), value);
  for (const storage of [{ kind: 'upload', scene: value.scene }, { kind: 'whiteboard', scene: value.scene, path: '/untrusted' }, { kind: 'whiteboard', scene: { ...value.scene, elements: [{ ...value.scene.elements[0], versionNonce: 34 }] } }]) assert.throws(() => parser.readWhiteboardStorage(storage), { status: 503, code: 'invalid_whiteboard_content' });
});
