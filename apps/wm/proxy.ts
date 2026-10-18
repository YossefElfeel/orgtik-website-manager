import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Only the language: who may see what is decided by the API (/v2/admin/me), which the app asks
// on every load. A page never trusts a cookie for permissions.
export default createMiddleware(routing);

export const config = { matcher: ["/((?!api|_next|_vercel|.*\..*).*)"] };
