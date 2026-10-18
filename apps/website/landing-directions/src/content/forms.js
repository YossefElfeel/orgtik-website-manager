// Where the website's forms go (S6, D-041). The Website Manager's site settings decide: contact
// submissions stay in the page in "preview"; in "live" they're sent to the
// Website Manager, which keeps it as a lead or an idea for moderation. Roadmap ideas always ask
// the CMS to accept the submission: a paused or unavailable CMS must never show a false success.
// The privacy version in force is sent along, so each record says which notice it was made under.
import snapshot from "./snapshot.js";

const API = import.meta.env?.VITE_CMS_API ?? "http://localhost:4007/v2";

export const formsLive = () => snapshot.site?.forms?.mode === "live";

async function post(path, body) {
  const r = await fetch(`${API}/public/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      privacyVersion: snapshot.site?.forms?.privacyVersion ?? "",
    }),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

/** A contact message. Resolves when it's kept (or at once, in preview); rejects when it isn't. */
export async function sendLead({ name, email, message, topic }) {
  if (!formsLive()) return { preview: true };
  // The form's privacy line is the notice locally (D-041); a production go-live needs an explicit
  // consent control, which is a design change for the site's owner.
  return post("leads", {
    name,
    email,
    message,
    topic,
    page: window.location.pathname,
    consent: true,
    utm: utmOf(window.location.search),
  });
}

/** A roadmap idea. Resolves only after the CMS accepts it into its moderation queue. */
export async function sendIdea({
  name,
  email,
  title,
  message,
  topic,
  consent,
}) {
  return post("ideas", { name, email, title, message, topic, consent });
}

const utmOf = (search) =>
  Object.fromEntries(
    [...new URLSearchParams(search)]
      .filter(([k]) => k.startsWith("utm_"))
      .map(([k, v]) => [k.slice(4), v]),
  );

/** Said in the form's own error slot when a live submission fails (to become a Website Manager string). */
export const SEND_FAILED =
  "Your message couldn't be sent. Check your connection and try again.";
