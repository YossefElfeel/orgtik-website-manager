// Transport only. The platform owns prices, regions, payment results and order claims.
export const SUITE_API = (
  import.meta.env?.VITE_SUITE_API || "http://localhost:4000/api"
).replace(/\/$/, "");
export const PLATFORM_API = `${SUITE_API.replace(/\/api$/, "")}/v1/app`;
const PUBLIC_API = `${SUITE_API.replace(/\/api$/, "")}/v1/public`;
let tokenProvider = () => {
  try {
    return (
      JSON.parse(
        globalThis.localStorage?.getItem("orgtik.suite-session.v1") || "null",
      )?.token || null
    );
  } catch {
    return null;
  }
};
export function setPurchaseTokenProvider(provider) {
  tokenProvider = provider;
}
export function purchaseHeaders() {
  const token = tokenProvider();
  let workspace = null;
  try {
    workspace =
      typeof document === "undefined"
        ? null
        : decodeURIComponent(
            document.cookie.match(/(?:^|; )ot-workspace=([^;]+)/)?.[1] || "",
          );
  } catch {}
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(token && workspace ? { "x-workspace": workspace } : {}),
  };
}
export const purchaseContextKey = () => JSON.stringify(purchaseHeaders());
export async function publicRequest(
  path,
  { body, signal, headers = {}, anonymous = false } = {},
) {
  let response;
  let result;
  try {
    response = await fetch(`${PUBLIC_API}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        ...(anonymous ? {} : purchaseHeaders()),
        ...(body ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal,
    });
    result = await response.json();
    if (!result || typeof result !== "object")
      throw new Error("invalid_response");
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw Object.assign(new Error("transport_unavailable"), {
      code: "transport_unavailable",
    });
  }
  if (!response.ok)
    throw Object.assign(new Error(result.error?.code || "unavailable"), {
      code: result.error?.code || "unavailable",
      status: response.status,
    });
  return result.data;
}
