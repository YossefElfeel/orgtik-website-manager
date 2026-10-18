// Signing in or creating an account on the website opens the OrgTik suite (2026-10-07): the
// suite's identity API checks (or creates) the account, gives a one-time code for the session,
// and SOS takes it at /auth/handoff, so no token travels in the address. The password is sent
// once and never kept here. Reset password starts the suite's own reset and opens its next step.
// The website keeps the suite session it was given (the access token, in this browser) so its
// header shows the person on every visit; Sign out forgets it here (the suite keeps its own).
// Checkout uses the same account: a paid order goes into that person's suite workspace, and an
// order paid as a guest joins the account they sign in to or create next (in the same tab).
//   VITE_SUITE_URL   the suite's home (SOS), e.g. https://orgtik-suite-sos.vercel.app
//   VITE_SUITE_API   its identity API, e.g. https://orgtik-suite-mock.vercel.app/sos/api
import {
  getPreviewCustomer,
  signInPreviewCustomer,
  subscribePreviewCustomer,
} from "./purchase-identity.js";
import {
  provisionCRM,
  loadPurchaseSession,
  savePurchaseSession,
} from "./purchase-adapter.js";
import { loadPublicCatalog } from "./purchase-catalog.js";
import {
  PLATFORM_API,
  SUITE_API,
  purchaseHeaders,
  setPurchaseTokenProvider,
} from "./purchase-platform.js";

export const SUITE_URL = (
  import.meta.env?.VITE_SUITE_URL || "http://localhost:3013"
).replace(/\/$/, "");

const SESSION_KEY = "orgtik.suite-session.v1";
let memoryToken;
const readToken = () => {
  if (memoryToken !== undefined) return memoryToken;
  try {
    return (
      JSON.parse(localStorage.getItem(SESSION_KEY) || "null")?.token || null
    );
  } catch {
    return null;
  }
};
const writeToken = (token) => {
  const previous = readToken();
  memoryToken = token;
  try {
    if (token) localStorage.setItem(SESSION_KEY, JSON.stringify({ token }));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked: the person stays signed in until the page is left.
  }
  if (previous !== token && typeof document !== "undefined") {
    const actor = (value) => {
      try {
        return JSON.parse(
          atob(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        ).sub;
      } catch {
        return null;
      }
    };
    if (!previous || !token || actor(previous) !== actor(token))
      document.cookie = "ot-workspace=; path=/; max-age=0; samesite=lax";
    loadPublicCatalog({ force: true });
  }
};
setPurchaseTokenProvider(readToken);
export const hasSuiteSession = () => Boolean(readToken());

const post = (path, body, token) =>
  fetch(`${SUITE_API}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

// The address that opens the suite signed in with `token`, through a one-time code.
async function handoffHref(token) {
  // Compile a cold suite entry before creating its short-lived destination code.
  if (typeof document !== "undefined")
    await fetch(`${SUITE_URL}/auth/handoff`, { mode: "no-cors" });
  const handoff = token
    ? await post("/auth/handoff", null, token).catch(() => null)
    : null;
  if (!handoff?.ok) throw new Error("unavailable");
  const code = (await handoff.json())?.data?.code;
  if (!code) throw new Error("unavailable");
  return `${SUITE_URL}/auth/handoff?code=${encodeURIComponent(code)}`;
}

// Opens the suite signed in with the session in `res` (a login or sign-up response), and keeps
// that session for the website's header. An order this tab paid as a guest joins the account.
async function openSuite(res) {
  const { data } = await res.json();
  const token = data?.tokens?.accessToken;
  writeToken(token);
  const saved = loadPurchaseSession();
  if (saved && token && !linked().includes(saved.order.reference))
    await sendOrder(saved.order, token)
      .then(() =>
        savePurchaseSession(saved.order, {
          status: "ready",
          access: "verified-existing",
        }),
      )
      .catch(() => {}); // The account still opens; the order can be linked from checkout later.
  const href = await handoffHref(token);
  return { user: data.user, href };
}

// Orders this tab already brought into the suite (the suite also ignores repeats).
const LINKED_KEY = "orgtik.suite-orders.v1";
const linked = () => {
  try {
    return JSON.parse(sessionStorage.getItem(LINKED_KEY) || "[]");
  } catch {
    return [];
  }
};
async function sendOrder(order, token) {
  if (!order?.quoteId || !order.claimToken) throw new Error("purchase");
  const res = await fetch(`${PLATFORM_API}/website-orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...purchaseHeaders(),
    },
    body: JSON.stringify({
      reference: order.reference,
      claimToken: order.claimToken,
    }),
  }).catch(() => null);
  if (!res?.ok) throw new Error("unavailable");
  const result = (await res.json())?.data;
  try {
    sessionStorage.setItem(
      LINKED_KEY,
      JSON.stringify([...new Set([...linked(), order.reference])]),
    );
  } catch {
    // Without storage the suite's own check stops a second copy.
  }
  if (typeof document !== "undefined") await loadPublicCatalog({ force: true });
  return result;
}

// Checkout's account setup: signed in to the suite, the paid order goes into the person's
// workspace (software on, services requested, invoice paid); a guest finishes password setup
// after payment. Same answer shape as provisionCRM.
export async function setupInSuite(order, options = {}) {
  const token = readToken();
  if (!options.verified || !token) return provisionCRM(order, options);
  try {
    const result = await sendOrder(order, token);
    return {
      purchaseReference: order.reference,
      destination: SUITE_URL,
      status: "ready",
      access: "verified-existing",
      tools: result?.tools ?? [],
    };
  } catch {
    return {
      purchaseReference: order.reference,
      destination: SUITE_URL,
      status: "failed",
      access: "verified-existing",
    };
  }
}

// My account: the suite, signed in with the kept session (its home if that fails).
export async function suiteAccountHref() {
  try {
    return await handoffHref(readToken());
  } catch {
    return SUITE_URL;
  }
}

// On each visit: show the person whose session the website kept, if the suite still knows them.
export async function restoreSuiteSession() {
  const token = readToken();
  if (!token || getPreviewCustomer()) return;
  let res;
  try {
    res = await fetch(`${SUITE_API}/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } catch {
    return; // The suite is unreachable: keep the session for the next visit.
  }
  if (res.status === 401 || res.status === 403) return writeToken(null);
  if (!res.ok) return; // Retry next visit; a service outage does not invalidate this account.
  let user;
  try {
    user = (await res.json())?.data?.user;
  } catch {
    return;
  }
  if (!user?.email) return;
  signInPreviewCustomer({
    name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    email: user.email,
    company: "",
  });
}

// Signing out on the website (header or checkout) forgets the kept session.
subscribePreviewCustomer(() => {
  if (!getPreviewCustomer()) writeToken(null);
});

const send = (path, body) =>
  post(path, body).catch(() => {
    throw new Error("unavailable");
  });

// Resolves to { user, href } (href opens the suite signed in), or rejects with
// Error("credentials") for a wrong email or password and Error("unavailable") otherwise.
export async function signInToSuite(email, password) {
  const res = await send("/auth/login", { email, password });
  if (res.status === 401 || res.status === 403) throw new Error("credentials");
  if (!res.ok) throw new Error("unavailable");
  return openSuite(res);
}

// Creates a customer account in the suite (with its own workspace) and resolves like
// signInToSuite. Rejects with Error("exists") when the email already has an account.
export async function signUpToSuite({ name, email, password }) {
  const res = await send("/auth/register", { name, email, password });
  if (res.status === 409) throw new Error("exists");
  if (!res.ok) throw new Error("unavailable");
  return openSuite(res);
}

// Post-purchase setup reuses the billing details. Keep the session as soon as registration
// succeeds so an order or handoff retry never creates another account or asks for payment.
export function validatePurchasePassword(password, confirmation) {
  if (String(password || "").length < 8) return "password";
  if (password !== confirmation) return "confirmation";
  return null;
}

export async function setupPurchaseAccount(order, customer, password) {
  if (
    order?.paymentStatus !== "succeeded" ||
    !order.quoteId ||
    !order.claimToken
  )
    throw new Error("purchase");
  const email = customer?.email?.trim().toLowerCase();
  const name = customer?.name?.trim();
  if (!name || !email) throw new Error("billing");
  let token = readToken();
  let user;
  if (!token || getPreviewCustomer()?.email?.toLowerCase() !== email) {
    if (String(password || "").length < 8) throw new Error("password");
    const res = await send("/auth/register", { name, email, password });
    if (res.status === 409) throw new Error("exists");
    if (!res.ok) throw new Error("unavailable");
    const { data } = await res.json();
    token = data?.tokens?.accessToken;
    user = data?.user;
    if (!token || !user) throw new Error("unavailable");
    writeToken(token);
    signInPreviewCustomer({ name, email, company: customer.company || "" });
  }
  try {
    if (!linked().includes(order.reference)) await sendOrder(order, token);
  } catch {
    throw new Error("order");
  }
  savePurchaseSession(
    order,
    { status: "ready", access: "verified-existing" },
    customer,
  );
  return { user, href: await handoffHref(token) };
}

// Starts a password reset in the suite (it emails a code) and resolves to the suite page where
// the code and a new password are entered. The suite answers the same for unknown emails, so
// this never reveals whether an account exists. Rejects with Error("unavailable").
export async function resetInSuite(email) {
  const res = await send("/auth/forgot-password", { email });
  if (!res.ok) throw new Error("unavailable");
  return `${SUITE_URL}/auth/reset-password`;
}
