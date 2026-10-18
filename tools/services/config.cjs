// Shared public URLs for the optional single-project deployment. Binding URLs are
// deliberately absent: Vercel supplies those to functions at request time.
const apps = ["admin", "chats", "files", "hr", "marketing", "sales", "sos", "tasks", "wm"];
const packages = {
  admin: "orgtik-admin", chats: "somion-hq", files: "file-management-dashboard",
  hr: "somion-hr-management-system", marketing: "marketing-management-dashboard",
  sales: "new-sales-dashboard", sos: "somion_new_dashboard", tasks: "somion-task-manager",
  wm: "orgtik-website-manager", website: "orgtik-cinematic-website",
};
function publicOrigin(env = process.env) {
  const value = env.SUITE_SERVICES_PUBLIC_URL || (env.VERCEL_ENV !== "development" && env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "http://localhost:3000");
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("SUITE_SERVICES_PUBLIC_URL must be an HTTP(S) origin.");
  if (env.VERCEL && env.VERCEL_ENV !== "development" && env.ORGTIK_SERVICES_DEV !== "1" && url.protocol !== "https:") throw new Error("Hosted services require an HTTPS public origin.");
  return url.origin;
}
function webUrls(env = process.env) {
  const origin = publicOrigin(env);
  return Object.fromEntries([...apps.map(key => [key, `${origin}/${key}`]), ["website", origin]]);
}
function clientEnvironment(key, env = process.env) {
  if (!apps.includes(key) && key !== "website") throw new Error(`Unknown suite service: ${key}`);
  const urls = webUrls(env), origin = publicOrigin(env);
  const gateway = `${origin}/${key === "website" ? "sos" : key}/api/backend`;
  const own = `${gateway}/${key}`, identity = `${gateway}/sos`;
  if (key === "website") return {
    VITE_SUITE_URL: urls.sos, VITE_CRM_PORTAL_URL: urls.sos,
    VITE_SUITE_API: `${identity}/api`, VITE_CMS_API: `${gateway}/wm/v2`, VITE_WM_ORIGIN: origin,
  };
  return {
    NEXT_PUBLIC_BASE_PATH: `/${key}`,
    NEXT_PUBLIC_SUITE_SERVICES: "1",
    NEXT_PUBLIC_API_URL: ["sos", "sales", "hr", "marketing"].includes(key) ? `${own}/api` : own,
    NEXT_PUBLIC_SOS_API_URL: ["chats", "hr"].includes(key) ? `${identity}/api` : identity,
    NEXT_PUBLIC_AUTH_API_URL: `${identity}/api`,
    NEXT_PUBLIC_ADMIN_API_URL: `${gateway}/admin`, NEXT_PUBLIC_WM_API_URL: `${gateway}/wm`,
    NEXT_PUBLIC_SOS_URL: urls.sos, NEXT_PUBLIC_ADMIN_URL: urls.admin,
    NEXT_PUBLIC_WM_URL: urls.wm, NEXT_PUBLIC_WEBSITE_URL: urls.website,
    NEXT_PUBLIC_REDIRECT_URL: `${urls.sos}/auth/login`,
    NEXT_PUBLIC_EXCALIDRAW_ASSET_PATH: `${urls.chats}/excalidraw/`,
  };
}
function servicesNextConfig(key, env = process.env) {
  if (env.ORGTIK_SERVICES !== "1" && !env.VERCEL_DEV_PORT) return {};
  return { basePath: `/${key}`, env: clientEnvironment(key, env), experimental: { optimizePackageImports: ["@phosphor-icons/react"] } };
}
module.exports = { apps, packages, publicOrigin, webUrls, clientEnvironment, servicesNextConfig };
