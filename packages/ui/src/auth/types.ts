export type ToolKey = "tasks" | "files" | "hr" | "crm" | "marketing" | "chat";
export type AccessState = "no_access" | "not_subscribed" | "trial" | "free" | "active" | "read_only";
export type MemberRole = "owner" | "admin" | "member" | "guest";
export type Audience = "identity" | "suite" | `tool:${"tasks" | "files" | "hr" | "sales" | "marketing" | "chats"}` | "staff:admin" | "staff:wm";
export type ScopeGrant = { scope: string; roles: string[]; permissions?: string[] };
export type SessionTokens = { accessToken: string; refreshToken: string; expiresIn: number };
export type StaffAccess = { actorUserId: number; apps: ("admin" | "wm")[]; roles: { admin?: string[]; wm?: string[] }; permissions: { admin?: string[]; wm?: string[] }; toolLaunch?: { workspaceId: string; tools: ToolKey[] } };
export type WorkspaceContext = {
  version: 1;
  realm: string;
  workspace: { id: string; name: string; kind: "customer" | "orgtik_internal"; state: "active" | "past_due" | "suspended" | "cancelled" | "deleted"; timeZone: string };
  actor: { userId: number; effectiveUserId: number; readOnly: boolean; impersonatedBy?: number };
  member: { id: string; role: MemberRole; revision: number; accessEpoch?: number };
  tools: Partial<Record<ToolKey, { scope: string; roles: string[]; access: AccessState; canWrite: boolean; reason?: string; seats: { capacity: number | null; assigned: number; reserved: number; available: number | null } }>>;
  revision: number;
};
export type SessionPerson = { id: number | string; firstName?: string; lastName?: string; email?: string; username?: string };
export type AuthEnvelope<User extends SessionPerson = SessionPerson> = { user: User; tokens: SessionTokens; scopes: ScopeGrant[]; workspaceContext: WorkspaceContext | null; staffAccess: StaffAccess | null };
export type ToolAccess = { roles: string[]; hasAccess: boolean; canWrite: boolean; readOnly: boolean; access: AccessState };
