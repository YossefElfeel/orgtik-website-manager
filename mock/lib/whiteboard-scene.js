// Canonical vector/text scenes. This is the only server parser for saved whiteboards.
const crypto = require('node:crypto');
const MIME = 'application/vnd.orgtik.whiteboard+json';
const LIMITS = Object.freeze({ bytes: 256 * 1024, elements: 1000, points: 20000, text: 100000 });
const TYPES = new Set(['rectangle', 'diamond', 'ellipse', 'line', 'arrow', 'freedraw', 'text', 'frame']);
const BASE = ['id', 'type', 'x', 'y', 'width', 'height', 'angle', 'strokeColor', 'backgroundColor', 'fillStyle', 'strokeWidth', 'strokeStyle', 'roundness', 'roughness', 'opacity', 'seed', 'version', 'versionNonce', 'index', 'isDeleted', 'groupIds', 'frameId', 'boundElements', 'updated', 'link', 'locked'];
const EXTRA = {
  rectangle: [], diamond: [], ellipse: [],
  text: ['fontSize', 'fontFamily', 'text', 'originalText', 'textAlign', 'verticalAlign', 'containerId', 'autoResize', 'lineHeight'],
  line: ['points', 'lastCommittedPoint', 'startBinding', 'endBinding', 'startArrowhead', 'endArrowhead'],
  arrow: ['points', 'lastCommittedPoint', 'startBinding', 'endBinding', 'startArrowhead', 'endArrowhead', 'elbowed', 'fixedSegments', 'startIsSpecial', 'endIsSpecial'],
  freedraw: ['points', 'pressures', 'simulatePressure', 'lastCommittedPoint'], frame: ['name'],
};
const ARROWHEADS = ['arrow', 'bar', 'dot', 'circle', 'circle_outline', 'triangle', 'triangle_outline', 'diamond', 'diamond_outline', 'crowfoot_one', 'crowfoot_many', 'crowfoot_one_or_many'];
const fail = message => { throw Object.assign(new Error(message), { status: 422, code: 'invalid_whiteboard_scene' }); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, allowed) => { if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('Only supported vector and text fields can be saved.'); };
const identifier = value => typeof value === 'string' && /^[\w.:-]{1,96}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
function number(value, fallback, min = -1000000, max = 1000000, integer = false) {
  const result = value === undefined ? fallback : value;
  if (!Number.isFinite(result) || result < min || result > max || integer && !Number.isSafeInteger(result)) fail('Whiteboard geometry and counters must be finite and bounded.');
  return Object.is(result, -0) ? 0 : result;
}
const boolean = (value, fallback = false) => { if (value === undefined) return fallback; if (typeof value !== 'boolean') fail('Whiteboard flags must be boolean.'); return value; };
const choice = (value, allowed, fallback) => { const result = value === undefined ? fallback : value; if (!allowed.includes(result)) fail('This whiteboard style is not supported.'); return result; };
function color(value, fallback) {
  const result = value === undefined ? fallback : value;
  if (typeof result !== 'string' || !/^(?:#[a-f\d]{3}|#[a-f\d]{6}|#[a-f\d]{8}|transparent)$/i.test(result)) fail('Use a supported whiteboard color.');
  return result.toLowerCase();
}
function validateWhiteboardScene(input) {
  try { if (Buffer.byteLength(JSON.stringify(input), 'utf8') > LIMITS.bytes) fail('The whiteboard has reached its saved size limit.'); }
  catch (error) { if (error.code === 'invalid_whiteboard_scene') throw error; fail('Whiteboard scenes must be bounded JSON.'); }
  keys(input, ['schema', 'version', 'elements', 'appState']);
  if (input.schema !== 'orgtik.whiteboard' || input.version !== 1 || !Array.isArray(input.elements) || input.elements.length > LIMITS.elements) fail('Choose a supported whiteboard scene.');
  keys(input.appState, ['viewBackgroundColor']);
  let points = 0, textLength = 0;
  const localId = value => { if (!identifier(value)) fail('Whiteboard IDs must be local identifiers.'); return value; };
  const nullableId = value => value == null ? null : localId(value);
  const text = (value, fallback = '', maximum = LIMITS.text) => {
    const result = value === undefined ? fallback : value;
    if (typeof result !== 'string' || result.length > maximum || /\u0000/.test(result)) fail('Whiteboard text is invalid or too long.');
    textLength += result.length; if (textLength > LIMITS.text) fail('The whiteboard has reached its text limit.'); return result;
  };
  const point = value => { if (!Array.isArray(value) || value.length !== 2 || ++points > LIMITS.points) fail('The whiteboard has reached its point limit.'); return value.map(n => number(n)); };
  const pointList = value => { if (!Array.isArray(value) || value.length > LIMITS.points) fail('Whiteboard points are invalid.'); return value.map(point); };
  const binding = value => {
    if (value == null) return null;
    keys(value, ['elementId', 'focus', 'gap', 'fixedPoint']);
    return { elementId: localId(value.elementId), focus: number(value.focus, 0, -1, 1), gap: number(value.gap, 0, 0), ...(value.fixedPoint != null ? { fixedPoint: point(value.fixedPoint).map(n => number(n, 0, 0, 1)) } : {}) };
  };
  const elements = input.elements.map(element => {
    if (!object(element) || !TYPES.has(element.type)) fail('Images, embeds and binary uploads cannot be saved in a whiteboard.');
    keys(element, [...BASE, ...EXTRA[element.type]]);
    if (element.link != null) fail('External links cannot be saved in a whiteboard.');
    const groupIds = element.groupIds === undefined ? [] : element.groupIds;
    if (!Array.isArray(groupIds) || groupIds.length > 20 || new Set(groupIds).size !== groupIds.length) fail('Whiteboard groups are invalid.');
    let roundness = null;
    if (element.roundness != null) { keys(element.roundness, ['type', 'value']); roundness = { type: choice(element.roundness.type, [1, 2, 3]), ...(element.roundness.value !== undefined ? { value: number(element.roundness.value, 0, 0) } : {}) }; }
    const boundElements = element.boundElements == null ? null : element.boundElements;
    if (boundElements !== null && (!Array.isArray(boundElements) || boundElements.length > LIMITS.elements)) fail('Whiteboard bindings are invalid.');
    const row = { id: localId(element.id), type: element.type, x: number(element.x, 0), y: number(element.y, 0), width: number(element.width, 0, 0), height: number(element.height, 0, 0), angle: number(element.angle, 0), strokeColor: color(element.strokeColor, '#190b25'), backgroundColor: color(element.backgroundColor, 'transparent'), fillStyle: choice(element.fillStyle, ['hachure', 'cross-hatch', 'solid', 'zigzag'], 'hachure'), strokeWidth: number(element.strokeWidth, 1, 0, 1000), strokeStyle: choice(element.strokeStyle, ['solid', 'dashed', 'dotted'], 'solid'), roundness, roughness: number(element.roughness, 1, 0, 8), opacity: number(element.opacity, 100, 0, 100), seed: number(element.seed, 1, -2147483648, 4294967295, true), version: 1, versionNonce: 0, index: null, isDeleted: boolean(element.isDeleted), groupIds: groupIds.map(localId), frameId: nullableId(element.frameId), boundElements: boundElements === null ? null : boundElements.map(value => { keys(value, ['id', 'type']); return { id: localId(value.id), type: choice(value.type, ['arrow', 'text']) }; }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), updated: 0, link: null, locked: boolean(element.locked) };
    // Ignore only known volatile reconciliation metadata; reject malformed values, even when normalized.
    number(element.version, 1, 0, Number.MAX_SAFE_INTEGER, true); number(element.versionNonce, 0, -2147483648, 4294967295, true); number(element.updated, 0, 0, Number.MAX_SAFE_INTEGER);
    if (element.index != null && (typeof element.index !== 'string' || element.index.length > 96)) fail('Whiteboard ordering is invalid.');
    if (element.type === 'text') Object.assign(row, { fontSize: number(element.fontSize, 20, 1, 1000), fontFamily: number(element.fontFamily, 5, 1, 100, true), text: text(element.text), originalText: text(element.originalText, element.text || ''), textAlign: choice(element.textAlign, ['left', 'center', 'right'], 'left'), verticalAlign: choice(element.verticalAlign, ['top', 'middle', 'bottom'], 'top'), containerId: nullableId(element.containerId), autoResize: boolean(element.autoResize, true), lineHeight: number(element.lineHeight, 1.25, 0.1, 10) });
    if (element.type === 'line' || element.type === 'arrow') Object.assign(row, { points: pointList(element.points), lastCommittedPoint: element.lastCommittedPoint == null ? null : point(element.lastCommittedPoint), startBinding: binding(element.startBinding), endBinding: binding(element.endBinding), startArrowhead: choice(element.startArrowhead, [null, ...ARROWHEADS], null), endArrowhead: choice(element.endArrowhead, [null, ...ARROWHEADS], element.type === 'arrow' ? 'arrow' : null) });
    if (['line', 'arrow'].includes(element.type) && row.points.length < 2) fail('Whiteboard lines require at least two points.');
    if (element.type === 'arrow') {
      let fixedSegments = null;
      if (element.fixedSegments != null) { if (!Array.isArray(element.fixedSegments)) fail('Whiteboard arrow segments are invalid.'); fixedSegments = element.fixedSegments.map(value => { keys(value, ['start', 'end', 'index']); return { start: point(value.start), end: point(value.end), index: number(value.index, 0, 0, row.points.length, true) }; }); }
      Object.assign(row, { elbowed: boolean(element.elbowed), fixedSegments, startIsSpecial: element.startIsSpecial == null ? null : boolean(element.startIsSpecial), endIsSpecial: element.endIsSpecial == null ? null : boolean(element.endIsSpecial) });
    }
    if (element.type === 'freedraw') {
      if (element.pressures !== undefined && (!Array.isArray(element.pressures) || element.pressures.length !== element.points?.length && element.pressures.length !== 0)) fail('Whiteboard pen pressure is invalid.');
      Object.assign(row, { points: pointList(element.points), pressures: (element.pressures || []).map(value => number(value, 0, 0, 1)), simulatePressure: boolean(element.simulatePressure, true), lastCommittedPoint: element.lastCommittedPoint == null ? null : point(element.lastCommittedPoint) });
    }
    if (element.type === 'frame') row.name = element.name == null ? null : text(element.name, '', 160);
    return row;
  }).filter(element => !element.isDeleted);
  const byId = new Map(elements.map(element => [element.id, element]));
  if (byId.size !== elements.length) fail('Whiteboard elements must have unique IDs.');
  for (const element of elements) {
    const target = value => { if (value === element.id || !byId.has(value)) fail('Whiteboard bindings must refer to another element in this scene.'); return byId.get(value); };
    if (element.frameId && (target(element.frameId).type !== 'frame' || element.type === 'frame')) fail('Whiteboard frame binding is invalid.');
    if (element.containerId && !['rectangle', 'diamond', 'ellipse', 'arrow'].includes(target(element.containerId).type)) fail('Whiteboard text container is invalid.');
    for (const bound of element.boundElements || []) if (target(bound.id).type !== bound.type) fail('Whiteboard element binding is invalid.');
    for (const bound of [element.startBinding, element.endBinding].filter(Boolean)) if (!['rectangle', 'diamond', 'ellipse', 'text', 'frame'].includes(target(bound.elementId).type)) fail('Whiteboard arrow binding is invalid.');
  }
  const scene = { schema: 'orgtik.whiteboard', version: 1, elements, appState: { viewBackgroundColor: color(input.appState.viewBackgroundColor, '#ffffff') } };
  if (Buffer.byteLength(JSON.stringify(scene), 'utf8') > LIMITS.bytes) fail('The whiteboard has reached its saved size limit.');
  return scene;
}
function serializeWhiteboardScene(input) {
  const scene = validateWhiteboardScene(input), json = JSON.stringify(scene), size = Buffer.byteLength(json, 'utf8');
  return { scene, json, size, hash: crypto.createHash('sha256').update(json).digest('hex') };
}
function readWhiteboardStorage(storage) {
  try {
    keys(storage, ['kind', 'scene']);
    if (storage.kind !== 'whiteboard') fail('A structured whiteboard version is required.');
    const value = serializeWhiteboardScene(storage.scene);
    if (JSON.stringify(storage.scene) !== value.json) fail('Stored whiteboard content must be canonical.');
    return value;
  } catch { throw Object.assign(new Error('The saved whiteboard content is invalid.'), { status: 503, code: 'invalid_whiteboard_content' }); }
}
module.exports = { validateWhiteboardScene, serializeWhiteboardScene, readWhiteboardStorage, MIME, LIMITS, identifier };
