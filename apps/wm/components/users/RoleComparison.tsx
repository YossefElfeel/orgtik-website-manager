"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, MagnifyingGlass } from "@phosphor-icons/react";
import {
  Badge,
  Button,
  Checkbox,
  ErrorState,
  Input,
  PageHeader,
  Skeleton,
  Tabs,
  TabsList,
  toast,
} from "@orgtik/ui";
import { useCan } from "@/lib/permissions";
import { CAPABILITY_GROUPS, ROLE_ACTIONS } from "@/lib/roleCapabilities";
import {
  useMeQuery,
  useRolesQuery,
  useUpdateRoleMutation,
  type ApiError,
} from "@/store/api";
import { AssignRoleDialog } from "./AssignRoleDialog";

type Draft = { permissions: string[]; version: string };
export function RoleComparison() {
  const t = useTranslations("RoleAccess");
  const ti = useTranslations("Improvements");
  const tr = useTranslations("Roles");
  const te = useTranslations("Editor");
  const can = useCan();
  const me = useMeQuery();
  const query = useRolesQuery();
  const [update, updating] = useUpdateRoleMutation();
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [problem, setProblem] = useState("");
  const roles = query.data ?? [];
  const role =
    roles.find((r) => r.key === (selected ?? me.data?.roles[0]?.key)) ??
    roles[0];
  const label = (key: string) =>
    tr.has(key) ? tr(key) : (roles.find((r) => r.key === key)?.label ?? key);
  const groupLabel = (key: string) =>
    key === "roles"
      ? t("title")
      : key === "structuredData"
        ? ti("structuredData")
        : ti(`capabilityGroups.${key}`);
  const rows = CAPABILITY_GROUPS.filter((group) =>
    groupLabel(group.key).toLowerCase().includes(search.trim().toLowerCase()),
  );
  const draft = role ? drafts[role.key] : undefined;
  const permissions = new Set(draft?.permissions ?? role?.permissions ?? []);
  const editable = Boolean(
    role &&
    can("roles:manage") &&
    (!role.protected || me.data?.identity.accounts),
  );
  const mine = me.data?.roles.some((r) => r.key === role?.key);
  const locked = (permission: string) =>
    !editable ||
    updating.isLoading ||
    Boolean(
      mine &&
      permissions.has(permission) &&
      ["roles:manage", "users:manage", "settings:view"].includes(permission),
    );
  const dirty = Boolean(
    role &&
    draft &&
    [...draft.permissions].sort().join() !==
      [...role.permissions].sort().join(),
  );
  const change = (items: string[], checked: boolean) => {
    if (!role) return;
    const next = new Set(permissions);
    for (const p of items)
      if (!locked(p)) checked ? next.add(p) : next.delete(p);
    setDrafts((previous) => ({
      ...previous,
      [role.key]: {
        permissions: [...next],
        version: draft?.version ?? role.version,
      },
    }));
    setProblem("");
  };
  const reset = () => {
    if (!role) return;
    setDrafts((previous) => {
      const next = { ...previous };
      delete next[role.key];
      return next;
    });
    setProblem("");
  };
  const save = async () => {
    if (!role || !draft) return;
    try {
      await update({ key: role.key, ...draft }).unwrap();
      reset();
      toast.success(te("saved"));
    } catch (error) {
      const e = error as ApiError;
      setProblem(
        e.status === 412
          ? t("stale")
          : e.code === "self_lockout"
            ? ti("selfLockout")
            : te("saveFailed"),
      );
    }
  };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          can("users:manage") ? (
            <Button startIcon={<Plus />} onClick={() => setAssigning(true)}>
              {t("addRole")}
            </Button>
          ) : undefined
        }
      />
      {query.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : query.isError ? (
        <ErrorState onRetry={query.refetch} />
      ) : role ? (
        <>
          <div className="overflow-x-auto">
            <Tabs
              value={role.key}
              onValueChange={(value) => {
                setSelected(value);
                setProblem("");
              }}
            >
              <TabsList
                items={roles.map((r) => ({
                  value: r.key,
                  label: (
                    <span className="inline-flex items-center gap-2">
                      {label(r.key)}
                      {drafts[r.key] ? (
                        <span
                          aria-label={t("unsaved")}
                          className="size-1.5 rounded-full bg-fg-brand"
                        />
                      ) : null}
                    </span>
                  ),
                }))}
              />
            </Tabs>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-title-sm font-semibold">{label(role.key)}</h2>
              {mine ? (
                <Badge tone="brand" size="sm">
                  {t("yourRole")}
                </Badge>
              ) : null}
            </div>
            <Input
              size="sm"
              className="w-full sm:max-w-xs"
              type="search"
              aria-label={t("search")}
              placeholder={t("search")}
              startIcon={<MagnifyingGlass className="size-4" />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {!editable ? (
            <p className="text-body-sm text-fg-muted">
              {t(role.protected ? "protectedRole" : "readOnly")}
            </p>
          ) : null}
          {problem ? (
            <p role="alert" className="text-body-sm text-danger">
              {problem}
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-card border border-line bg-raised">
            <table
              className="w-full min-w-[48rem] text-body-sm"
              aria-label={t("matrix", { role: label(role.key) })}
            >
              <thead className="bg-sunken text-fg-muted">
                <tr>
                  <th
                    scope="col"
                    className="sticky start-0 z-10 min-w-52 bg-sunken px-4 py-3 text-start font-medium"
                  >
                    {ti("capability")}
                  </th>
                  {ROLE_ACTIONS.map((action) => (
                    <th
                      scope="col"
                      key={action}
                      className="px-4 py-3 text-center font-medium"
                    >
                      {t(action)}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-end font-medium">
                    {t("action")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {!rows.length ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-fg-muted"
                    >
                      {ti("noResults")}
                    </td>
                  </tr>
                ) : null}
                {rows.map((group) => {
                  const items = Object.values(group.actions);
                  const all = items.every((p) => permissions.has(p));
                  return (
                    <tr key={group.key} className="border-t border-line">
                      <th
                        scope="row"
                        className="sticky start-0 bg-raised px-4 py-4 text-start font-medium"
                      >
                        {groupLabel(group.key)}
                      </th>
                      {ROLE_ACTIONS.map((action) => {
                        const p = group.actions[action];
                        return (
                          <td key={action} className="px-4 py-4 text-center">
                            {p ? (
                              <div className="flex justify-center">
                                <Checkbox
                                  aria-label={`${label(role.key)}: ${groupLabel(group.key)} — ${t(action)}`}
                                  checked={permissions.has(p)}
                                  disabled={locked(p)}
                                  onCheckedChange={(checked) =>
                                    change([p], checked)
                                  }
                                />
                              </div>
                            ) : (
                              <span
                                className="text-fg-subtle"
                                aria-label={t("unavailable")}
                              >
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-end">
                        <Button
                          size="sm"
                          variant="link"
                          disabled={
                            !editable ||
                            updating.isLoading ||
                            (all && items.some(locked))
                          }
                          aria-label={`${t(all ? "clearAll" : "activateAll")}: ${groupLabel(group.key)}`}
                          onClick={() => change(items, !all)}
                        >
                          {t(all ? "clearAll" : "activateAll")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {editable ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" className="text-body-sm text-fg-muted">
                {t(dirty ? "unsavedHelp" : "savedHelp")}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={!draft || updating.isLoading}
                  onClick={reset}
                >
                  {t("reset")}
                </Button>
                <Button
                  disabled={!dirty}
                  loading={updating.isLoading}
                  onClick={save}
                >
                  {t("save")}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {assigning ? (
        <AssignRoleDialog
          roleKey={role?.key}
          onClose={() => setAssigning(false)}
        />
      ) : null}
    </div>
  );
}
