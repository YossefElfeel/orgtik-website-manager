// Ports and folders for every app. MOCK_PORT_OFFSET shifts all API ports (handy for isolated tests).
const offset = Number(process.env.MOCK_PORT_OFFSET || 0);

const apps = {
  sos: { dir: "apps/sos", web: 3013, api: 4000 },
  tasks: { dir: "apps/tasks", web: 3001, api: 4001 },
  files: { dir: "apps/files", web: 3002, api: 4002 },
  sales: { dir: "apps/sales", web: 3003, api: 4003 },
  hr: { dir: "apps/hr", web: 3004, api: 4004 },
  marketing: { dir: "apps/marketing", web: 3014, api: 4005 },
  content: { dir: "apps/content", web: 3006, api: 4006 },
  // Somion HQ (chat, calls, virtual office): a prototype with its own built-in mock data, so no API.
  chats: { dir: "apps/chats", web: 3000, api: 4009, devArgs: ["run", "dev", "--", "-p", "3000"] },
  // The public website is frontend-only (no API). devArgs: Vite takes --port, not -p.
  website: { dir: "apps/website/landing-directions", web: 4173, api: null, devArgs: ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4173", "--strictPort"] },
  // Reserved for apps the program will build. They're skipped until they exist (reserved: true).
  wm: { dir: "apps/wm", web: 3007, api: 4007 }, // Website Manager (CMS), D-034
  admin: { dir: "apps/admin", web: 3008, api: 4008 }, // Admin back-office (ADM) + platform API (Phase E)
};

for (const a of Object.values(apps)) if (a.api != null) a.api += offset;

const icons = { port: 4099 + offset };

// Hosted prototype (Vercel): one function serves every API under /<key>, and each web app has
// its own domain. MOCK_PUBLIC_URL is the function's origin; SUITE_WEB_URLS is a JSON map
// {key: origin}. Writable data goes to /tmp there, since the deployment itself is read-only.
const services = process.env.ORGTIK_SERVICES === "1";
const servicesConfig = services ? require("../tools/services/config.cjs") : null;
const PUBLIC = (services ? `${servicesConfig.publicOrigin()}/sos/api/backend` : process.env.MOCK_PUBLIC_URL || "").replace(/\/$/, "");
let WEB = {};
try {
  WEB = JSON.parse(process.env.SUITE_WEB_URLS || "{}");
} catch {
  WEB = {};
}
if (services) WEB = servicesConfig.webUrls();
const hosted = Boolean(PUBLIC);
const dataDir = process.env.ORGTIK_SERVICES_DEV === "1" ? require("node:path").resolve(__dirname, "../.vercel/dev/mock") : process.env.VERCEL ? "/tmp/orgtik-mock" : __dirname;

const webUrl = (key) => (WEB[key] ? WEB[key].replace(/\/$/, "") : `http://localhost:${apps[key].web}`);
const apiUrl = (key) => (hosted ? `${PUBLIC}/${key}` : `http://localhost:${apps[key].api}`);

module.exports = { apps, icons, webUrl, apiUrl, offset, hosted, dataDir };
