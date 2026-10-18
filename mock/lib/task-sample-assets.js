// Public fixture bytes only. Tenant attachments, generated customer assets and metadata
// never enter this router. Original seed IDs are pinned in apps/tasks/seed.js + identity.js.
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { ATTACHMENTS } = require('../apps/tasks/files');
const samples = new Map(Object.values(ATTACHMENTS).map(asset => [asset.file, asset.mimetype]));
for (let id = 1; id <= 16; id++) samples.set(`seed-avatar-${id}.svg`, 'image/svg+xml');
for (let id = 1; id <= 8; id++) samples.set(`seed-team-${id}.svg`, 'image/svg+xml');

function sampleName(req) {
  if (!['GET', 'HEAD'].includes(req.method) || typeof req.url !== 'string') return null;
  // Check the raw path before URL/Express decoding or dot-segment normalization.
  const pathname = req.url.split('?')[0], match = /^\/uploads\/([a-zA-Z0-9_.-]+)$/.exec(pathname);
  return match && samples.has(match[1]) ? match[1] : null;
}
function isTaskSampleRequest(req) { return Boolean(sampleName(req)); }
function contained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
}
function createTaskSampleRouter({ config }) {
  if (typeof config?.dataDir !== 'string' || !config.dataDir) throw new TypeError('Tasks sample assets require the configured data directory.');
  const folder = path.resolve(config.dataDir, 'uploads', 'tasks'), router = express.Router();
  router.use((req, res) => {
    const name = sampleName(req);
    if (!name) return res.status(404).json({ success: false, code: 'sample_not_found' });
    let file;
    try {
      const base = fs.realpathSync(path.resolve(config.dataDir)), root = fs.realpathSync(folder);
      const expected = path.join(base, 'uploads', 'tasks');
      if ((process.platform === 'win32' ? root.toLowerCase() !== expected.toLowerCase() : root !== expected)) return res.status(404).json({ success: false, code: 'sample_not_found' });
      const target = fs.realpathSync(path.join(folder, name));
      if (!contained(root, target) || !fs.statSync(target).isFile()) return res.status(404).json({ success: false, code: 'sample_not_found' });
      file = fs.readFileSync(target);
    } catch { return res.status(404).json({ success: false, code: 'sample_not_found' }); }
    res.set({ 'Content-Type': samples.get(name), 'Content-Length': String(file.length), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=604800, immutable', 'Access-Control-Allow-Origin': '*' });
    return res.status(200).end(req.method === 'HEAD' ? undefined : file);
  });
  return router;
}
module.exports = { createTaskSampleRouter, isTaskSampleRequest };
