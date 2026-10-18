export function demoRuntime(apiUrl, webUrls, sosApiUrl) { if (!apiUrl || !webUrls || !sosApiUrl)
    return; try {
    return { apiUrl, webUrls: JSON.parse(webUrls), sosApiUrl };
}
catch {
    return;
} }
export async function demoRequest(runtime, scene, path, body) { const url = new URL(runtime.apiUrl.replace(/\/$/, "") + "/" + path.replace(/^\//, "")); url.searchParams.set("workspace", scene.workspace === "current" ? "nile" : scene.workspace); url.searchParams.set("persona", scene.persona); const response = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); const value = await response.json(); if (!response.ok || value.simulated !== true)
    throw Error("The presentation connection could not complete."); return value.data; }
//# sourceMappingURL=connections.js.map