// Vercel entry: every mock API in one function, each under its app key
// (https://<mock>/sos/api/..., /tasks/..., /files/...). Sockets (live updates) aren't available here.
// With a journal store configured (lib/journal.js, D-053) the data survives cold starts and is the
// same on every instance; without one it lives in memory and resets on a cold start.
process.env.ORGTIK_MOCK_NO_LISTEN = "1";
const {createPresentationHandler}=require('../lib/presentation');
const {presentationStorage}=require('../lib/presentation-storage');
const presentation=createPresentationHandler(presentationStorage());
const { slots, handle, ready } = require("../server");

module.exports = async (req, res) => {
  if (/^\/presentation(?:\/|\?|$)/.test(req.url||'')) {
    req.url=req.url.replace(/^\/presentation/,'')||'/';
    return presentation(req,res);
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": req.headers.origin || "*", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-allow-headers": req.headers["access-control-request-headers"] || "content-type,authorization", "access-control-allow-credentials": "true", vary: "Origin" });
    return res.end();
  }
  try {
    await ready();
  } catch (e) {
    console.error("[journal] start failed:", e);
    res.statusCode = 503;
    res.setHeader("content-type", "application/json");
    res.setHeader("access-control-allow-origin", "*");
    return res.end(JSON.stringify({ success: false, statusCode: 503, message: "[mock] data store unavailable" }));
  }
  const m = /^\/([a-z_]+)(\/[^?]*)?(\?.*)?$/.exec(req.url || "/");
  const key = m && m[1];
  if (!key || !slots.has(key)) {
    res.statusCode = key ? 404 : 200;
    res.setHeader("content-type", "application/json");
    res.setHeader("access-control-allow-origin", "*");
    return res.end(JSON.stringify({ ok: !key, service: "OrgTik suite mock API", apps: [...slots.keys()].map((k) => `/${k}`) }));
  }
  req.url = (m[2] || "/") + (m[3] || "");
  return handle(key, req, res);
};
