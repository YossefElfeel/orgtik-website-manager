const zlib = require("node:zlib");
const MAX_BYTES = 16 * 1024 * 1024;
function encodeDomainCheckpoint(value) {
  const raw = Buffer.from(JSON.stringify(value));
  if (raw.length > MAX_BYTES) throw Object.assign(new Error("Workspace snapshot exceeds the supported limit."), { status: 503 });
  const gzip = zlib.gzipSync(raw, { level: 9 });
  const brotli = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } });
  const compact = brotli.length < gzip.length;
  return { version: 1, encoding: compact ? "br-base64" : "gzip-base64", bytes: raw.length, data: (compact ? brotli : gzip).toString("base64") };
}
function decodeDomainCheckpoint(value) {
  if (value?.version !== 1 || !["gzip-base64", "br-base64"].includes(value.encoding) || !Number.isSafeInteger(value.bytes) || value.bytes < 0 || value.bytes > MAX_BYTES || typeof value.data !== "string") throw Object.assign(new Error("Invalid workspace checkpoint."), { status: 503 });
  const raw = (value.encoding === "br-base64" ? zlib.brotliDecompressSync : zlib.gunzipSync)(Buffer.from(value.data, "base64"), { maxOutputLength: MAX_BYTES });
  if (raw.length !== value.bytes) throw Object.assign(new Error("Workspace checkpoint is incomplete."), { status: 503 });
  return JSON.parse(raw.toString("utf8"));
}
module.exports = { encodeDomainCheckpoint, decodeDomainCheckpoint };
