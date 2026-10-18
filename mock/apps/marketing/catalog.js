// Static platform catalog: display metadata, OAuth scopes and capabilities per social/ads platform.
// Platform keys follow the app's IntegrationPlatform enum (X, not TWITTER). Reports use EPlatform (TWITTER).

const PLATFORMS = {
  FACEBOOK: {
    platform: "FACEBOOK", name: "Facebook", icon: "logos:facebook", color: "#1877F2", oauthVersion: "2.0",
    requiresRefreshToken: false, publish: true, ads: true, analytics: true, messaging: true,
    resourceType: "PAGE", supportedContentTypes: ["POST", "REEL", "STORY"], mediaConstraints: { maxItems: 10, maxVideos: 1 },
    postUrl: (handle, id) => `https://www.facebook.com/${handle}/posts/${id}`,
    profileUrl: (handle) => `https://www.facebook.com/${handle}`,
    scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_manage_metadata", "read_insights", "ads_management", "ads_read", "business_management", "pages_messaging"],
    video: false,
  },
  INSTAGRAM: {
    platform: "INSTAGRAM", name: "Instagram", icon: "skill-icons:instagram", color: "#E4405F", oauthVersion: "2.0",
    requiresRefreshToken: false, publish: true, ads: true, analytics: true, messaging: true,
    resourceType: "ACCOUNT", supportedContentTypes: ["POST", "REEL", "STORY"], mediaConstraints: { maxItems: 10, maxVideos: 1 },
    postUrl: (handle, id) => `https://www.instagram.com/p/${id}/`,
    profileUrl: (handle) => `https://www.instagram.com/${handle}/`,
    scopes: ["instagram_basic", "instagram_content_publish", "instagram_manage_insights", "instagram_manage_comments", "instagram_manage_messages", "pages_show_list", "business_management"],
    video: true,
  },
  X: {
    platform: "X", name: "X (Twitter)", icon: "ri:twitter-x-fill", color: "#000000", oauthVersion: "2.0",
    requiresRefreshToken: true, publish: true, ads: false, analytics: true, messaging: false,
    resourceType: "ACCOUNT", supportedContentTypes: ["POST"], mediaConstraints: { maxItems: 4, maxVideos: 1 },
    postUrl: (handle, id) => `https://x.com/${handle}/status/${id}`,
    profileUrl: (handle) => `https://x.com/${handle}`,
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access", "like.read"],
    video: false,
  },
  LINKEDIN: {
    platform: "LINKEDIN", name: "LinkedIn", icon: "logos:linkedin-icon", color: "#0A66C2", oauthVersion: "2.0",
    requiresRefreshToken: true, publish: true, ads: true, analytics: true, messaging: false,
    resourceType: "ORGANIZATION", supportedContentTypes: ["POST", "ARTICLE"], mediaConstraints: { maxItems: 9, maxVideos: 1 },
    postUrl: (handle, id) => `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`,
    profileUrl: (handle) => `https://www.linkedin.com/company/${handle}/`,
    scopes: ["r_organization_social", "w_organization_social", "rw_organization_admin", "r_ads", "rw_ads", "r_basicprofile"],
    video: false,
  },
  TIKTOK: {
    platform: "TIKTOK", name: "TikTok", icon: "logos:tiktok-icon", color: "#000000", oauthVersion: "2.0",
    requiresRefreshToken: true, publish: true, ads: true, analytics: true, messaging: false,
    resourceType: "ACCOUNT", supportedContentTypes: ["VIDEO", "POST"], mediaConstraints: { maxItems: 35, maxVideos: 1 },
    postUrl: (handle, id) => `https://www.tiktok.com/@${handle}/video/${id}`,
    profileUrl: (handle) => `https://www.tiktok.com/@${handle}`,
    scopes: ["user.info.basic", "user.info.stats", "video.list", "video.publish", "video.upload", "advertiser.read"],
    video: true,
  },
  YOUTUBE: {
    platform: "YOUTUBE", name: "YouTube", icon: "logos:youtube-icon", color: "#FF0000", oauthVersion: "2.0",
    requiresRefreshToken: true, publish: true, ads: false, analytics: true, messaging: false,
    resourceType: "CHANNEL", supportedContentTypes: ["VIDEO", "SHORT"], mediaConstraints: { maxItems: 1, maxVideos: 1 },
    postUrl: (handle, id) => `https://www.youtube.com/watch?v=${id}`,
    profileUrl: (handle) => `https://www.youtube.com/@${handle}`,
    scopes: ["youtube.readonly", "youtube.upload", "youtube.force-ssl", "yt-analytics.readonly"],
    video: true,
  },
  GOOGLE: {
    platform: "GOOGLE", name: "Google Ads", icon: "logos:google-ads", color: "#4285F4", oauthVersion: "2.0",
    requiresRefreshToken: true, publish: false, ads: true, analytics: true, messaging: false,
    resourceType: "AD_ACCOUNT", supportedContentTypes: [], mediaConstraints: { maxItems: 0, maxVideos: 0 },
    postUrl: () => null,
    profileUrl: () => "https://ads.google.com/",
    scopes: ["openid", "email", "profile", "adwords", "analytics.readonly"],
    video: false,
  },
};

const PLATFORM_KEYS = Object.keys(PLATFORMS);

// "twitter"/"TWITTER"/"x" -> "X"; unknown -> upper-cased input.
function normPlatform(p) {
  const up = String(p || "").trim().toUpperCase();
  if (up === "TWITTER") return "X";
  if (up === "GOOGLE_ADS") return "GOOGLE";
  return up;
}
// Reports use EPlatform where X is called TWITTER.
const reportPlatform = (p) => (p === "X" ? "TWITTER" : p);
const meta = (p) => PLATFORMS[normPlatform(p)] || null;

// Target platform object embedded in post details (IPostById.targets[].platform).
function platformBrief(p) {
  const m = meta(p) || { name: p, oauthVersion: "2.0", color: "#64748B", icon: "ph:share-network", requiresRefreshToken: false };
  return { name: m.name, oauthVersion: m.oauthVersion, color: m.color, icon: m.icon, requiresRefreshToken: m.requiresRefreshToken };
}

// Row for GET /integrations/available.
function availableRow(p, id) {
  const m = PLATFORMS[p];
  return { id, name: m.name, icon: m.icon, color: m.color, platform: p, oauthVersion: m.oauthVersion, requiresRefreshToken: m.requiresRefreshToken };
}

// Capability key used in wizard selections <-> resource group key.
const CAPABILITY_GROUPS = [
  { key: "publishing", capability: "PUBLISHING", title: "Publishing Pages & Profiles" },
  { key: "advertising", capability: "ADS", title: "Ad Accounts" },
  { key: "analytics", capability: "ANALYTICS", title: "Analytics Sources" },
  { key: "messaging", capability: "MESSAGING", title: "Messaging Inboxes" },
];

// Feature -> scopes needed (for featureStatuses / missing scope counts).
const FEATURES = {
  PUBLISHING: { capability: "PUBLISHING" },
  ADS_MANAGEMENT: { capability: "ADS" },
  ANALYTICS: { capability: "ANALYTICS" },
  MESSAGING: { capability: "MESSAGING" },
};

module.exports = { PLATFORMS, PLATFORM_KEYS, normPlatform, reportPlatform, meta, platformBrief, availableRow, CAPABILITY_GROUPS, FEATURES };
