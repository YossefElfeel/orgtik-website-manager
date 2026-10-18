const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const fail = () => Object.assign(new Error('This packaged delivery file is unavailable.'), { status: 410, code: 'delivery_file_unavailable' });
const assets = path.resolve(__dirname, '../apps/files/assets');
const manifest = JSON.parse(fs.readFileSync(path.join(assets, 'manifest.json'), 'utf8'));
function content(file) {
  const asset = file && manifest[file.assetKey];
  if (!asset || !/^[a-f0-9]{64}$/.test(file.sha256 || '')) throw fail();
  try {
    const root = fs.realpathSync(assets), filename = fs.realpathSync(path.resolve(root, asset.file)), relative = path.relative(root, filename), stat = fs.statSync(filename);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !stat.isFile() || stat.size !== asset.size || crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex') !== file.sha256) throw fail();
    return { path: filename, name: file.name, mimetype: asset.mimeType };
  } catch { throw fail(); }
}
function project(file, requestId, deliveryId, index) {
  if (!file?.assetKey || !file.sha256) return file;
  const { assetKey, sha256, ...publicFile } = file;
  return { ...publicFile, contentPath: `/api/suite/services/deliveries/${encodeURIComponent(requestId)}/${encodeURIComponent(deliveryId)}/${index}/content` };
}
function projectRequest(row) {
  return { ...row, deliveries: (row.deliveries || []).map(delivery => ({ ...delivery, files: (delivery.files || []).map((file, index) => project(file, row.id, delivery.id, index)) })) };
}
module.exports = { content, project, projectRequest };
