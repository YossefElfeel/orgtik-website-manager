export const TOOL_SCOPES = { tasks: "task_manager", files: "file_manager", hr: "hr_system", crm: "sales", marketing: "digital_marketing", chat: "hq" };
/** Navigation metadata never supplies the active tool's authorization context. */
export function staffToolLaunch(session) {
    const access = session?.staffAccess, launch = access?.toolLaunch;
    if (session?.workspaceContext || !access?.roles.admin?.includes("super_admin") || !launch?.workspaceId)
        return undefined;
    return { workspaceId: launch.workspaceId, tools: [...new Set(launch.tools.filter(tool => Object.hasOwn(TOOL_SCOPES, tool)))] };
}
export function toolAccess(context, key, fallback) {
    if (context) {
        const own = context.tools[key];
        const hasAccess = Boolean(own && !["no_access", "not_subscribed"].includes(own.access));
        return { roles: hasAccess ? own.roles : [], hasAccess, canWrite: Boolean(hasAccess && own?.canWrite && !context.actor.readOnly), readOnly: Boolean(context.actor.readOnly || own?.access === "read_only"), access: own?.access || "no_access" };
    }
    // Compatibility uses only this exact app scope. Global/userType/flattened roles confer nothing.
    const scopes = Array.isArray(fallback) ? fallback : [];
    const roles = scopes.find(entry => entry?.scope === TOOL_SCOPES[key])?.roles?.filter((role) => typeof role === "string") || [];
    const canWrite = roles.some(role => !["viewer", "guest", "file_guest", "file_viewer", "customer", "client_reviewer"].includes(role));
    return { roles, hasAccess: roles.length > 0, canWrite, readOnly: false, access: roles.length ? "active" : "no_access" };
}
export function scopesFromContext(context) {
    return context ? Object.values(context.tools).filter(tool => tool && !["no_access", "not_subscribed"].includes(tool.access)).map(tool => ({ scope: tool.scope, roles: [...tool.roles], permissions: [] })) : [];
}
//# sourceMappingURL=access.js.map