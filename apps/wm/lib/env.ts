// Where things live. local-dev sets these in .env.local; the defaults are the local mock ports.
export const WM_API = `${process.env.NEXT_PUBLIC_WM_API_URL ?? "http://localhost:4007"}/v2`;
export const SOS_API = `${process.env.NEXT_PUBLIC_SOS_API_URL ?? "http://localhost:4000"}/api`;
export const SOS_URL = process.env.NEXT_PUBLIC_SOS_URL ?? "http://localhost:3007";
export const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? "http://localhost:4173";

/** A website image by the file name the content stores ("brand-cards.webp"); the site serves them from /assets. */
export const mediaUrl = (src: string) => (/^https?:\/\//.test(src) ? src : `${WEBSITE_URL}/assets/${src.replace(/^\/+/, "")}`);

/** Where a library file is served: an upload from the API, a website file from the website. */
export const libraryUrl = (m: { file: string; url: string | null }) => (m.url ? WM_API.replace(/\/v2$/, "") + m.url : mediaUrl(m.file));
