"use client";
import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { WM_API } from "@/lib/env";
import { clearToken, getToken } from "@/lib/session";
import { refreshClientSession, SessionRequestError } from "@orgtik/ui/auth";
import { SOS_API } from "@/lib/env";

/** Every failure the UI handles, from the v2 envelope: { error: { code, message, required? } }. */
export type ApiError = {
  status: number | "offline";
  code: string;
  message: string;
  required?: string;
  fieldErrors?: Record<string, string>;
  /** On 412: who saved the newer version, and its number. */
  by?: string;
  current?: number;
};

const raw = fetchBaseQuery({
  baseUrl: WM_API,
  prepareHeaders: (headers) => {
    const token = getToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
    return headers;
  },
});

// Unwraps { data } and turns every error into an ApiError, so screens branch on `status`/`code`
// and never parse bodies themselves. No toast here: a screen says what failed where it failed.
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, ApiError> = async (
  args,
  api,
  extra,
) => {
  const originalToken = getToken();
  let result = await raw(args, api, extra);
  if (getToken() !== originalToken) return { error: { status: 503, code: "session_changed", message: "" } };
  if (result.error?.status === 401 && originalToken) {
    try {
      await refreshClientSession(SOS_API);
      const retryToken = getToken();
      if (!retryToken) return { error: { status: 403, code: "staff_access_required", message: "" } };
      result = await raw(args, api, extra);
      if (getToken() !== retryToken) return { error: { status: 503, code: "session_changed", message: "" } };
    } catch (reason) {
      if (reason instanceof SessionRequestError && [401, 403].includes(reason.status)) {
        if (getToken() === originalToken) clearToken();
        return { error: { status: reason.status, code: reason.code, message: "" } };
      }
      return { error: { status: 503, code: "session_unavailable", message: "" } };
    }
  }
  if (result.error) {
    const e = result.error as FetchBaseQueryError;
    if (typeof e.status !== "number")
      return { error: { status: "offline", code: "offline", message: "" } };
    const body =
      (e.data as { error?: Partial<ApiError> } | undefined)?.error ?? {};
    return {
      error: {
        status: e.status,
        code: body.code ?? "error",
        message: body.message ?? "",
        required: body.required,
        fieldErrors: body.fieldErrors,
        by: body.by,
        current: body.current,
      },
    };
  }
  const body = result.data as {
    data: unknown;
    meta?: { total?: number; page?: number; pageSize?: number };
  };
  // A list answer carries paging in meta; the screen gets it next to the rows.
  if (body?.meta && typeof body.meta.total === "number") {
    const { page, pageSize, total, ...rest } = body.meta as {
      page?: number;
      pageSize?: number;
      total: number;
    };
    return {
      data: {
        items: body.data,
        page: page ?? 1,
        pageSize: pageSize ?? 10,
        total,
        ...rest,
      },
      meta: result.meta,
    };
  }
  // A 204 (a delete) has no body: RTK Query needs data to be something, so it's null.
  return { data: body?.data ?? null, meta: result.meta };
};

export type Me = {
  identity: { accounts: boolean };
  user: {
    id: number;
    key: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };
  roles: { key: string; label: string }[];
  permissions: string[];
  site: {
    id: string;
    name: string;
    locales: string[];
    publicLocales: string[];
  };
};

export type Overview = {
  queue: {
    drafts: number;
    inReview: number;
    scheduled: number;
    translationGaps: number;
    seoIssues: number;
    mediaIssues: number;
    newLeads: number;
    pendingIdeas: number;
    translationReview: number;
  };
};

export type Role = { key: string; label: string; permissions: string[]; version: string; protected: boolean };

export type Person = { key: string; name: string | null };
export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};
export type Locale = "en" | "ar" | "de" | "fr" | "it";
export type WorkflowState =
  "draft" | "in_review" | "approved" | "scheduled" | "published";
export type TranslationState =
  | "not_started"
  | "in_progress"
  | "needs_review"
  | "ready"
  | "published"
  | "outdated";

/** The content types the Website Manager edits (lib/contentTypes.ts has how each one looks). */
export type EntryType =
  | "page"
  | "global"
  | "strings"
  | "caseStudy"
  | "serviceFamily"
  | "service"
  | "softwareModule"
  | "article"
  | "legalDocument"
  | "roadmapItem"
  | "review"
  | "pricing";
export type RoadmapStatus = "open" | "planned" | "in_progress" | "shipped";
export type Period = "past" | "now" | "next";
export type PriceMode = "indicative" | "on_request";
export type Department =
  "design" | "development" | "hosting" | "digital-marketing" | "it-support";
export type MediaRef = { src: string; alt: Partial<Record<Locale, string>>; focal?: { x: number; y: number } };

export type EntrySummary = {
  id: string;
  type: EntryType;
  name: string;
  /** Case studies only. */
  department?: Department;
  format?: string;
  narrativePublished?: boolean;
  sampleNarrativePublished?: boolean;
  /** Services: the family they belong to. */
  parent?: string;
  /** Articles: the service family they're filed under. */
  category?: string;
  icon?: string;
  publishedOn?: string;
  readingMinutes?: number;
  /** Roadmap items. */
  status?: RoadmapStatus;
  period?: Period;
  year?: string;
  progress?: number;
  /** Legal documents: the published version. */
  versionLabel?: string;
  effectiveFrom?: string | null;
  /** Pages, Global, Strings: how many texts. */
  slots?: number;
  slug: Partial<Record<Locale, string>>;
  image?: MediaRef;
  order: number;
  state: WorkflowState;
  visibility: "not_on_site" | "live" | "archived";
  hasDraft: boolean;
  /** The draft changes only the SEO block: the SEO team can take it through review (fast lane). */
  seoOnly?: boolean;
  version: number;
  updatedAt: string;
  /** name is null for the import from the website. */
  updatedBy: Person;
  translation: Record<Locale, TranslationState>;
  /** Case studies only; null elsewhere. */
  figures: "sample" | "approved" | null;
};

/** How a page or global entry is laid out (language-neutral; from the website's own markup). */
export type CopySlot = {
  key: string;
  kind: string;
  level?: number;
  href?: string;
  source?: string;
  context?: string;
  fixedValues?: string[];
};
export type LayoutSection =
  | { key: string; kind: "copy"; label: string | null; slots: CopySlot[] }
  | {
      key: string;
      kind: "data";
      label: string;
      node: import("@/lib/caseStudySchema").Node;
    };

export type EntryContent = {
  presentation?: { sectionOrder: string[]; sectionMedia: Record<string, MediaRef[]>; cursor: { text: Partial<Record<Locale, string>>; link: string } };
  sample?: boolean;
  position?: number;
  relatedEntry?: string;
  narrativePublished?: boolean;
  sampleNarrativePublished?: boolean;
  /** Pages and Global: an internal name and the layout. */
  name?: string;
  layout?: LayoutSection[];
  slug: Partial<Record<Locale, string>>;
  image?: MediaRef;
  gallery?: MediaRef[];
  icon?: string;
  category?: string;
  publishedOn?: string;
  readingMinutes?: number;
  /** Roadmap items. */
  status?: RoadmapStatus;
  period?: Period;
  year?: string;
  progress?: number;
  /** Kept in the website's own code (a purchasing catalog file): shown here read-only. */
  managedIn?: string;
  /** Pricing: how the website shows prices. */
  priceMode?: PriceMode;
  currency?: string;
  /** Legal documents: the version this draft becomes, and from when it applies. */
  versionLabel?: string;
  effectiveFrom?: string | null;
  provenance?: {
    figures: "sample" | "approved";
    sampleLabel: Partial<Record<Locale, string>>;
    approvedBy?: string;
    approvedAt?: string;
  };
  locales: Partial<Record<Locale, Record<string, unknown>>>;
  seo: Partial<
    Record<
      Locale,
      {
        title?: string;
        description?: string;
        focus?: string;
        keywords?: string[];
        ogTitle?: string;
        ogDescription?: string;
        ogImage?: string;
        robots?: "index" | "noindex";
        inSitemap?: boolean;
        canonical?: string;
        jsonLd?: unknown;
      }
    >
  >;
};

export type LegalVersion = {
  versionLabel: string;
  effectiveFrom: string | null;
  publishedAt: string;
  note: string | null;
};

export type Entry = EntrySummary & {
  /** Author of the working copy, retained across review transitions. */
  lastEditor?: string | null;
  content: EntryContent;
  live: EntryContent;
  versions: {
    version: number;
    state: WorkflowState;
    at: string;
    by: Person;
    note: string | null;
    action?: string;
  }[];
  /** Scheduled entries: when the website will show them. */
  publishAt?: string | null;
  /** Legal documents: every published version, newest first, never changed. */
  legalVersions?: LegalVersion[];
};

export type IdeaStatus =
  | "pending"
  | "open"
  | "planned"
  | "in_progress"
  | "shipped"
  | "declined"
  | "merged"
  | "hidden";
export type Idea = {
  id: string;
  status: IdeaStatus;
  theme: string;
  title: string;
  body: string;
  votes: number;
  comments: number;
  submittedAt: string;
  version: number;
  /** Seeded demonstration content; real local submissions enter as private pending ideas. */
  sample?: boolean;
  source?: string;
  submitter?: { name?: string; email?: string; privacyVersion: string; erased?: boolean; masked?: boolean };
  commentPreview?: { id: string; author: string; body: string; status?: "pending" | "published" | "hidden" }[];
  notes?: { id: string; text: string; at: string; by: Person }[];
  reason?: string;
  link?: string;
  mergedInto?: string;
  mergedIntoTitle?: string;
  history: {
    at: string;
    by: Person;
    action: string;
    from?: IdeaStatus;
    to?: IdeaStatus;
    reason?: string;
    link?: string;
    into?: string;
  }[];
};
export type IdeaAction =
  "publish" | "plan" | "start" | "ship" | "decline" | "merge" | "hide";
export type IdeaPage = Page<Idea> & {
  counts: Partial<Record<IdeaStatus, number>>;
};

/** Language-neutral fields an editor may change. */
export type NeutralPatch = Partial<
  Pick<
    EntryContent,
    | "icon"
    | "category"
    | "publishedOn"
    | "readingMinutes"
    | "status"
    | "period"
    | "year"
    | "progress"
    | "versionLabel"
    | "effectiveFrom"
    | "priceMode"
    | "narrativePublished"
    | "sampleNarrativePublished"
    | "sample"
    | "position"
    | "relatedEntry"
  >
>;

// ---- leads (D-028) ----
export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "unqualified"
  | "quoted"
  | "won"
  | "lost"
  | "spam"
  | "duplicate";
export type LeadAction =
  | "contact"
  | "qualify"
  | "unqualify"
  | "quote"
  | "win"
  | "lose"
  | "spam"
  | "duplicate"
  | "reopen";
export type Lead = {
  id: string;
  source: "website";
  status: LeadStatus;
  topic: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  page: string;
  context: {
    plan?: string;
    modules?: string[];
    duration?: string;
    bundle?: string;
    services?: string[];
  };
  utm: { source?: string; medium?: string; campaign?: string };
  consent: { privacyVersion: string; at: string };
  owner: Person | null;
  notes: { at: string; by: Person; text: string }[];
  history: {
    at: string;
    by: Person;
    action: string;
    from?: LeadStatus;
    to?: LeadStatus;
    reason?: string;
  }[];
  reason?: string;
  duplicateOf?: string;
  createdAt: string;
  version: number;
  sample?: boolean;
  /** Personal data hidden: the viewer lacks leads:pii. */
  masked?: boolean;
  erased?: boolean;
};
export type LeadPage = Page<Lead> & {
  counts: Partial<Record<LeadStatus, number>>;
  pii: boolean;
};
export type Member = {
  key: string;
  name: string;
  roles: string[];
  permissions: string[];
};
export type AuditEvent = {
  targetName?: string;
  at: string;
  by: Person;
  action: string;
  entry: string;
  type: string;
  version?: number;
  locale?: string;
};
export type SiteSettings = {
  siteName: string;
  titleTemplate: string;
  defaultDescription: string;
  defaultOgImage: string | null;
  organization: { name: string; email: string; phone: string; address: string };
  formsMode: "preview" | "live";
  locales: { code: Locale; enabled: boolean; public: boolean }[];
  readiness: Record<Locale, { done: number; total: number }>;
  version: number;
  updatedAt: string | null;
  updatedBy: Person | null;
};
export type LocalizationRow = {
  id: string;
  type: EntryType;
  name: string;
  translation: Record<Locale, TranslationState>;
  state: WorkflowState;
};
export type EntryVersion = Entry["versions"][number] & {
  content?: EntryContent;
};

// ---- media ----
export type MediaKind = "image" | "vector" | "video";
export type RightsStatus =
  "unknown" | "owned" | "licensed" | "stock" | "client";
export type MediaIssue =
  "noAlt" | "altSuggested" | "rightsUnknown" | "rightsExpiring" | "unused";
export type MediaItem = {
  description?: string;
  tags?: string[];
  id: string;
  file: string;
  kind: MediaKind;
  bytes: number;
  width: number | null;
  height: number | null;
  alt: Partial<Record<Locale, string>>;
  rights: {
    status: RightsStatus;
    holder: string;
    expires: string | null;
    note: string;
  };
  focal: { x: number; y: number };
  /** Pages whose code uses the file directly (the hero video, logos). */
  templateUses: string[];
  source: "website" | "upload";
  /** Uploads: served by the API; website files come from the website. */
  url: string | null;
  usage: number;
  issues: MediaIssue[];
  version: number;
  uses?: {
    entry: string;
    type: EntryType;
    name: string;
    field: string;
    ownAlt: boolean;
  }[];
};
export type MediaPage = Page<MediaItem> & {
  counts: Partial<Record<MediaIssue, number>>;
};
export type MediaPatch = {
  description?: string;
  tags?: string[];
  alt?: Partial<Record<Locale, string>>;
  rights?: Partial<MediaItem["rights"]>;
  focal?: { x: number; y: number };
};

// ---- SEO ----
export type SeoCheck =
  | "titleMissing"
  | "titleLong"
  | "titleDuplicate"
  | "descriptionMissing"
  | "descriptionShort"
  | "descriptionLong"
  | "noSocialImage"
  | "imageNoAlt";
export type SeoRow = {
  id: string;
  type: EntryType;
  name: string;
  path: string;
  locale: Locale;
  title: string;
  titleLength: number;
  descriptionLength: number;
  issues: SeoCheck[];
  state: WorkflowState;
};
export type SeoHealth = Page<SeoRow> & {
  counts: Record<SeoCheck, number>;
  healthy: number;
  checked: number;
};
export type AnalyticsPeriod = "30d" | "90d" | "12m";
type Totals = {
  visits: number;
  visitors: number;
  leads: number;
  conversion: number;
};
export type Analytics = {
  sample: boolean;
  period: AnalyticsPeriod;
  bucket: "day" | "week" | "month";
  from: string;
  to: string;
  totals: Totals;
  previous: Totals;
  series: { period: string; visits: number; previous: number; leads: number }[];
  pages: { path: string; name: string; type: EntryType; visits: number }[];
  services: { id: string; name: string; leads: number }[];
  articles: {
    id?: string;
    title: string;
    path: string;
    views: number;
    image: string | null;
  }[];
  topics: { key: string; label: string; value: number }[];
  channels: { key: string; value: number }[];
  realLeads: number;
};
export type PreviewAddress = {
  path: string;
  id: string;
  type: EntryType;
  name: string;
  draft: boolean;
  onSite: boolean;
};
export type Redirect = {
  id: string;
  from: string;
  to: string;
  code: 301 | 302;
  note?: string;
  source: "website" | "manager" | "address_change" | "archived";
  history?: { at: string; action: string; by: Person }[];
  handledBy: "browser" | "host";
  createdAt: string;
  createdBy: Person;
  version: number;
};
export type Indexing = {
  urls: { id: string; type: EntryType; locale: string; loc: string; canonical: string; policy: "index" | "noindex"; reason: "siteOverride" | "pagePolicy" | "allowed"; inSitemap: boolean; lastmod: string }[];
  settings: {
    canonicalHost: string;
    visibility: "index" | "noindex";
    publicLocales: Locale[];
    version: number;
    history: {
      at: string;
      by: Person;
      visibility: "index" | "noindex";
      note: string;
    }[];
  };
  sitemap: { loc: string; lastmod: string; type: EntryType; id: string }[];
  robots: string;
};

export type EntryPatch = {
  presentation?: EntryContent["presentation"];
  locale?: Locale;
  fields?: Record<string, unknown>;
  seo?: Record<string, unknown>;
  slug?: string;
  image?: Partial<MediaRef>;
  neutral?: NeutralPatch;
  sampleLabel?: string;
};

export type EntryRef = { type: EntryType; id: string };
export type Transition =
  | "submit"
  | "request_changes"
  | "approve"
  | "publish"
  | "discard"
  | "schedule"
  | "unschedule";
export type Pricing = {
  currency: string;
  priceMode: "indicative" | "on_request" | "live";
  modules: Record<string, { monthly: number }>;
};

// A write answers with the entry as it now is: put it in the cache straight away, so the next
// write is based on the new version without waiting for a refetch.
const putEntry = async (
  { type, id }: EntryRef,
  {
    dispatch,
    queryFulfilled,
  }: {
    dispatch: (a: unknown) => unknown;
    queryFulfilled: Promise<{ data: Entry }>;
  },
) => {
  try {
    const { data } = await queryFulfilled;
    dispatch(api.util.upsertQueryData("entry", { type, id }, data));
  } catch {
    // The screen handles the failure.
  }
};

export type SuiteUser = { id: number; key: string; name: string; firstName: string; lastName: string; email: string; active: boolean; roles: string[]; version: string };

export const api = createApi({
  reducerPath: "wm",
  baseQuery,
  tagTypes: [
    "Me",
    "Entry",
    "EntryList",
    "Overview",
    "Ideas",
    "Media",
    "MediaList",
    "Seo",
    "Localization",
    "Leads",
    "Audit",
    "Site",
    "Users",
    "Roles",
  ],
  endpoints: (b) => ({
    pageSources: b.query<Entry[], string>({query: id => "/admin/manager/pages/" + id, providesTags: ["Entry"]}),
    managerOrder: b.query<{ids:string[];version:string}, EntryType>({query:type=>"/admin/manager/order/"+type,providesTags:["EntryList"]}),
    saveManagerOrder: b.mutation<{ids:string[];version:string},{type:EntryType;ids:string[];version:string}>({query:({type,...body})=>({url:"/admin/manager/order/"+type,method:"PUT",body}),invalidatesTags:["EntryList","Audit"]}),
    contentQueue: b.query<Page<EntrySummary>, { state?: string; mine?: string; search?: string; page?: number; pageSize?: number }>({ query: params => ({ url: "/admin/queue", params }), providesTags: ["EntryList", "Overview"] }),
    users: b.query<Page<SuiteUser>, { search?: string; status?: string; role?: string; page?: number; pageSize?: number }>({ query: params => ({ url: "/admin/users", params }), providesTags: ["Users"] }),
    createUser: b.mutation<SuiteUser, { firstName: string; lastName: string; email: string; password: string }>({ query: body => ({ url: "/admin/users", method: "POST", body }), invalidatesTags: ["Users", "Audit"] }),
    updateUser: b.mutation<SuiteUser, { id: number; version: string; patch: Partial<Pick<SuiteUser, "firstName" | "lastName" | "email" | "active" | "roles">> }>({ query: ({ id, version, patch }) => ({ url: `/admin/users/${id}`, method: "PATCH", headers: { "if-match": version }, body: patch }), invalidatesTags: ["Users", "Audit", "Me"] }),
    me: b.query<Me, void>({ query: () => "/admin/me", providesTags: ["Me"] }),
    overview: b.query<Overview, void>({
      query: () => "/admin/overview",
      providesTags: ["Overview"],
    }),
    analytics: b.query<Analytics, AnalyticsPeriod>({
      query: (period) => `/admin/analytics?period=${period}`,
    }),
    roles: b.query<Role[], void>({ query: () => "/admin/roles", providesTags: ["Roles"] }),
    updateRole: b.mutation<Role, { key: string; version: string; permissions: string[] }>({
      query: ({ key, version, permissions }) => ({ url: `/admin/roles/${key}`, method: "PATCH", headers: { "if-match": version }, body: { permissions } }),
      async onQueryStarted(_request, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(api.util.updateQueryData("roles", undefined, roles => {
            const index = roles.findIndex(role => role.key === data.key);
            if (index >= 0) roles[index] = data;
          }));
        } catch { /* The editor shows the save error. */ }
      },
      invalidatesTags: ["Roles", "Me", "Users", "Audit"],
    }),
    pricing: b.query<Pricing, void>({ query: () => "/admin/pricing" }),
    entries: b.query<
      Page<EntrySummary>,
      {
        type: EntryType;
        search?: string;
        state?: string;
        department?: string;
        parent?: string;
        missingLanguages?: string;
        deliveryStatus?: string;
        period?: string;
        year?: string;
        sort?: string;
        page?: number;
        pageSize?: number;
      }
    >({
      query: ({ type, ...params }) => ({
        url: `/admin/entries/${type}`,
        params,
      }),
      providesTags: ["EntryList"],
    }),
    entry: b.query<Entry, EntryRef>({
      query: ({ type, id }) => `/admin/entries/${type}/${id}`,
      providesTags: (_r, _e, { id }) => [{ type: "Entry", id }],
    }),
    // Every write sends the version it was based on (If-Match); a newer one on the server is a 412.
    saveEntry: b.mutation<
      Entry,
      EntryRef & { version: number; patch: EntryPatch }
    >({
      query: ({ type, id, version, patch }) => ({
        url: `/admin/entries/${type}/${id}`,
        method: "PATCH",
        body: patch,
        headers: { "if-match": String(version) },
      }),
      invalidatesTags: ["EntryList", "Overview", "Seo", "Media", "MediaList"],
      onQueryStarted: putEntry,
    }),
    saveManagerPage: b.mutation<Entry, EntryRef & {commands: {id: string; version: number; patches: EntryPatch[]}[]}>({
      query: ({id, commands}) => ({url: "/admin/studio/page-draft/" + id, method: "POST", body: {commands}}),
      invalidatesTags: ["Entry", "EntryList", "Overview", "Seo", "Media", "MediaList"],
      onQueryStarted: putEntry,
    }),
    createEntry: b.mutation<
      Entry,
      {
        type: EntryType;
        name: string;
        slug?: string;
        from?: string;
        department?: Department;
      }
    >({
      query: ({ type, ...body }) => ({
        url: `/admin/entries/${type}`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["EntryList", "Overview", "Seo"],
      async onQueryStarted(_input, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(api.util.upsertQueryData("entry", { type: data.type, id: data.id }, data));
        } catch { /* The creation dialog handles the error. */ }
      },
    }),
    setEntryVisibility: b.mutation<
      Entry,
      EntryRef & { version: number; action: "archive" | "unarchive" }
    >({
      query: ({ type, id, version, action }) => ({
        url: `/admin/entries/${type}/${id}/visibility`,
        method: "POST",
        body: { action },
        headers: { "if-match": String(version) },
      }),
      invalidatesTags: ["EntryList", "Overview", "Seo"],
      onQueryStarted: putEntry,
    }),
    deleteEntry: b.mutation<void, EntryRef>({
      query: ({ type, id }) => ({
        url: `/admin/entries/${type}/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["EntryList", "Overview", "Seo"],
    }),
    transitionEntry: b.mutation<
      Entry,
      EntryRef & {
        version: number;
        action: Transition;
        note?: string;
        publishAt?: string;
      }
    >({
      query: ({ type, id, version, action, note, publishAt }) => ({
        url: `/admin/entries/${type}/${id}/transitions`,
        method: "POST",
        body: { action, note, publishAt },
        headers: { "if-match": String(version) },
      }),
      invalidatesTags: ["EntryList", "Overview", "Seo", "Media", "MediaList"],
      onQueryStarted: putEntry,
    }),
    ideas: b.query<
      IdeaPage,
      { status?: string; search?: string; page?: number; pageSize?: number; mergeable?: boolean }
    >({
      query: (params) => ({ url: "/admin/ideas", params }),
      providesTags: ["Ideas"],
    }),
    idea: b.query<Idea, string>({ query: id => `/admin/ideas/${id}`, providesTags: ["Ideas"] }),
    editIdea: b.mutation<Idea, { id: string; version: number; title: string; body: string; theme: string }>({
      query: ({ id, version, ...body }) => ({ url: `/admin/ideas/${id}`, method: "PATCH", headers: { "if-match": String(version) }, body }),
      invalidatesTags: ["Ideas", "Overview", "Audit"],
    }),
    eraseIdea: b.mutation<Idea, { id: string; version: number }>({
      query: ({ id, version }) => ({ url: `/admin/ideas/${id}/erase`, method: "POST", headers: { "if-match": String(version) } }),
      invalidatesTags: ["Ideas"],
    }),
    moderateIdeaComment: b.mutation<Idea, { id: string; version: number; commentId: string; action: "publish" | "hide" | "delete" }>({
      query: ({ id, version, commentId, action }) => ({ url: `/admin/ideas/${id}/comments/${commentId}/moderate`, method: "POST", headers: { "if-match": String(version) }, body: { action } }),
      invalidatesTags: ["Ideas", "Overview", "Audit"],
    }),
    noteIdea: b.mutation<Idea, { id: string; version: number; text: string }>({
      query: ({ id, version, text }) => ({ url: `/admin/ideas/${id}/notes`, method: "POST", headers: { "if-match": String(version) }, body: { text } }),
      invalidatesTags: ["Ideas", "Audit"],
    }),
    moderateIdea: b.mutation<
      Idea,
      {
        id: string;
        version: number;
        action: IdeaAction;
        reason?: string;
        link?: string;
        into?: string;
      }
    >({
      query: ({ id, version, ...body }) => ({
        url: `/admin/ideas/${id}/moderate`,
        method: "POST",
        body,
        headers: { "if-match": String(version) },
      }),
      invalidatesTags: ["Ideas", "Overview"],
    }),
    media: b.query<
      MediaPage,
      {
        kind?: string;
        issue?: string;
        search?: string;
        page?: number;
        pageSize?: number;
      }
    >({
      query: (params) => ({ url: "/admin/media", params }),
      providesTags: ["MediaList"],
    }),
    mediaItem: b.query<MediaItem, string>({
      query: (id) => `/admin/media/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Media", id }],
    }),
    updateMedia: b.mutation<
      MediaItem,
      { id: string; version: number; patch: MediaPatch }
    >({
      query: ({ id, version, patch }) => ({
        url: `/admin/media/${id}`,
        method: "PATCH",
        body: patch,
        headers: { "if-match": String(version) },
      }),
      invalidatesTags: ["MediaList", "Overview", "Seo"],
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(api.util.upsertQueryData("mediaItem", id, data));
        } catch {
          // The screen handles the failure.
        }
      },
    }),
    uploadMedia: b.mutation<MediaItem, File | { file: File; description: string; tags: string[] }>({
      query: (input) => {
        const body = new FormData();
        const file = input instanceof File ? input : input.file;
        body.append("file", file);
        if (!(input instanceof File)) {
          body.append("description", input.description);
          body.append("tags", JSON.stringify(input.tags));
        }
        return { url: "/admin/media", method: "POST", body };
      },
      invalidatesTags: ["MediaList", "Overview"],
    }),
    deleteMedia: b.mutation<void, string>({
      query: (id) => ({ url: `/admin/media/${id}`, method: "DELETE" }),
      invalidatesTags: ["MediaList", "Overview"],
    }),
    seoHealth: b.query<SeoHealth, { issue?: string; search?: string; kind?: string; page?: number; pageSize?: number }>({
      query: (params) => ({ url: "/admin/seo/health", params }),
      providesTags: ["Seo", "EntryList"],
    }),
    redirects: b.query<Page<Redirect>, { page?: number; pageSize?: number; search?: string; kind?: string }>({
      query: (params) => ({ url: "/admin/seo/redirects", params }),
      providesTags: ["Seo"],
    }),
    saveRedirect: b.mutation<
      Redirect,
      {
        id?: string;
        version?: number;
        from: string;
        to: string;
        code: number;
        note?: string;
      }
    >({
      query: ({ id, version, ...body }) =>
        id
          ? {
              url: `/admin/seo/redirects/${id}`,
              method: "PATCH",
              body,
              headers: { "if-match": String(version) },
            }
          : { url: "/admin/seo/redirects", method: "POST", body },
      invalidatesTags: ["Seo"],
    }),
    deleteRedirect: b.mutation<void, string>({
      query: (id) => ({ url: `/admin/seo/redirects/${id}`, method: "DELETE" }),
      invalidatesTags: ["Seo"],
    }),
    previewAddresses: b.query<PreviewAddress[], void>({
      query: () => "/admin/preview/addresses",
      providesTags: ["Entry"],
    }),
    previewToken: b.mutation<{ token: string; expiresAt: string }, void>({
      query: () => ({ url: "/admin/preview-token", method: "POST" }),
    }),
    indexing: b.query<Indexing, void>({
      query: () => "/admin/seo/indexing",
      providesTags: ["Seo"],
    }),
    setVisibility: b.mutation<
      Indexing,
      { version: number; visibility: "index" | "noindex"; reason: string }
    >({
      query: ({ version, ...body }) => ({
        url: "/admin/seo/indexing",
        method: "PATCH",
        body,
        headers: { "if-match": String(version) },
      }),
      invalidatesTags: ["Seo"],
    }),
    translateEntry: b.mutation<
      Entry,
      EntryRef & {
        version: number;
        locale: Locale;
        action: "submit" | "approve" | "reopen";
      }
    >({
      query: ({ type, id, version, locale, action }) => ({
        url: `/admin/entries/${type}/${id}/translation`,
        method: "POST",
        body: { locale, action },
        headers: { "if-match": String(version) },
      }),
      invalidatesTags: ["EntryList", "Overview", "Localization"],
      onQueryStarted: putEntry,
    }),
    entryVersion: b.query<EntryVersion, EntryRef & { version: number }>({
      query: ({ type, id, version }) =>
        `/admin/entries/${type}/${id}/versions/${version}`,
    }),
    restoreEntry: b.mutation<
      Entry,
      EntryRef & { version: number; restore: number }
    >({
      query: ({ type, id, version, restore }) => ({
        url: `/admin/entries/${type}/${id}/restore`,
        method: "POST",
        body: { version: restore },
        headers: { "if-match": String(version) },
      }),
      invalidatesTags: [
        "EntryList",
        "Overview",
        "Seo",
        "Media",
        "MediaList",
        "Localization",
      ],
      onQueryStarted: putEntry,
    }),
    localization: b.query<Page<LocalizationRow>, void>({
      query: () => "/admin/localization",
      providesTags: ["Localization"],
    }),
    leads: b.query<
      LeadPage,
      { status?: string; search?: string; page?: number; pageSize?: number }
    >({
      query: (params) => ({ url: "/admin/leads", params }),
      providesTags: ["Leads"],
    }),
    lead: b.query<Lead, string>({
      query: (id) => `/admin/leads/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Leads", id }],
    }),
    moveLead: b.mutation<
      Lead,
      {
        id: string;
        version: number;
        action: LeadAction;
        reason?: string;
        of?: string;
      }
    >({
      query: ({ id, version, ...body }) => ({
        url: `/admin/leads/${id}/move`,
        method: "POST",
        body,
        headers: { "if-match": String(version) },
      }),
      invalidatesTags: ["Leads", "Overview"],
    }),
    assignLead: b.mutation<
      Lead,
      { id: string; version: number; owner: string | null }
    >({
      query: ({ id, version, owner }) => ({
        url: `/admin/leads/${id}/assign`,
        method: "POST",
        body: { owner },
        headers: { "if-match": String(version) },
      }),
      invalidatesTags: ["Leads"],
    }),
    noteLead: b.mutation<Lead, { id: string; text: string }>({
      query: ({ id, text }) => ({
        url: `/admin/leads/${id}/notes`,
        method: "POST",
        body: { text },
      }),
      invalidatesTags: ["Leads"],
    }),
    eraseLead: b.mutation<Lead, string>({
      query: (id) => ({
        url: `/admin/leads/${id}/personal-data`,
        method: "DELETE",
      }),
      invalidatesTags: ["Leads"],
    }),
    members: b.query<Page<Member>, void>({ query: () => "/admin/members" }),
    audit: b.query<
      Page<AuditEvent>,
      { search?: string; type?: string; by?: string; page?: number; pageSize?: number }
    >({
      query: (params) => ({ url: "/admin/audit", params }),
      providesTags: ["Audit"],
    }),
    site: b.query<SiteSettings, void>({
      query: () => "/admin/settings/site",
      providesTags: ["Site"],
    }),
    updateSite: b.mutation<
      SiteSettings,
      {
        version: number;
        patch: Partial<
          Omit<
            SiteSettings,
            "readiness" | "version" | "updatedAt" | "updatedBy"
          >
        >;
      }
    >({
      query: ({ version, patch }) => ({
        url: "/admin/settings/site",
        method: "PATCH",
        body: patch,
        headers: { "if-match": String(version) },
      }),
      invalidatesTags: ["Site", "Audit"],
    }),
    approveFigures: b.mutation<Entry, EntryRef & { version: number }>({
      query: ({ type, id, version }) => ({
        url: `/admin/entries/${type}/${id}/approve-figures`,
        method: "POST",
        headers: { "if-match": String(version) },
      }),
      invalidatesTags: ["EntryList", "Overview", "Seo", "Media", "MediaList"],
      onQueryStarted: putEntry,
    }),
  }),
});

export const {
  useMeQuery,
  useOverviewQuery,
  useAnalyticsQuery,
  useRolesQuery,
  useUpdateRoleMutation,
  usePricingQuery,
  useEntriesQuery,
  useEntryQuery,
  useSaveEntryMutation,
  useSaveManagerPageMutation,
  useTransitionEntryMutation,
  useCreateEntryMutation,
  useSetEntryVisibilityMutation,
  useDeleteEntryMutation,
  useApproveFiguresMutation,
  useIdeasQuery,
  useIdeaQuery,
  useEditIdeaMutation,
  useModerateIdeaMutation,
  useEraseIdeaMutation,
  useModerateIdeaCommentMutation,
  useNoteIdeaMutation,
  useMediaQuery,
  useMediaItemQuery,
  useUpdateMediaMutation,
  useUploadMediaMutation,
  useDeleteMediaMutation,
  useSeoHealthQuery,
  useRedirectsQuery,
  useSaveRedirectMutation,
  useDeleteRedirectMutation,
  useIndexingQuery,
  usePreviewAddressesQuery,
  usePreviewTokenMutation,
  useSetVisibilityMutation,
  useTranslateEntryMutation,
  useEntryVersionQuery,
  useRestoreEntryMutation,
  useLocalizationQuery,
  useLeadsQuery,
  useLeadQuery,
  useMoveLeadMutation,
  useAssignLeadMutation,
  useNoteLeadMutation,
  useEraseLeadMutation,
  useMembersQuery,
  useAuditQuery,
  useSiteQuery,
  useUpdateSiteMutation,
  usePageSourcesQuery,
  useManagerOrderQuery,
  useSaveManagerOrderMutation,
  useContentQueueQuery,
  useUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
} = api;

/** Downloads the leads as CSV (the API decides whether personal data is in it). */
export async function downloadLeads() {
  const res = await fetch(`${WM_API}/admin/leads/export.csv`, {
    headers: { authorization: `Bearer ${getToken() ?? ""}` },
  });
  if (!res.ok) throw new Error(String(res.status));
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: "orgtik-leads.csv",
  });
  a.click();
  URL.revokeObjectURL(url);
}

/** The HTTP status of a query's error, or undefined (RTK Query can also hand back a SerializedError). */
export const statusOf = (e: unknown): ApiError["status"] | undefined =>
  e && typeof e === "object" && "status" in e
    ? (e as ApiError).status
    : undefined;
