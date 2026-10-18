import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { servicesNextConfig } from "../../tools/services/config.cjs";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  ...servicesNextConfig("wm"),
  // The media library shows images from the mock API (http://localhost:4007/uploads/…).
  images: { remotePatterns: [{ protocol: "http", hostname: "localhost" }, { protocol: "https", hostname: "*.vercel.app" }] },
};

export default withNextIntl(nextConfig);
