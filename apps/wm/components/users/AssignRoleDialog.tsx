"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Select,
  toast,
} from "@orgtik/ui";
import {
  useMeQuery,
  useRolesQuery,
  useUsersQuery,
  useUpdateUserMutation,
  type ApiError,
  type SuiteUser,
} from "@/store/api";

export function AssignRoleDialog({
  roleKey,
  onClose,
}: {
  roleKey?: string;
  onClose: () => void;
}) {
  const t = useTranslations("RoleAccess");
  const ti = useTranslations("Improvements");
  const tr = useTranslations("Roles");
  const { data: me } = useMeQuery();
  const { data: roles = [] } = useRolesQuery();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<SuiteUser | null>(null);
  const [role, setRole] = useState(roleKey ?? "wm_admin");
  const [problem, setProblem] = useState("");
  const search = email.trim() || name.trim();
  const users = useUsersQuery(
    { search, pageSize: 10 },
    { skip: search.length < 2 || Boolean(selected) },
  );
  const [assign, assigning] = useUpdateUserMutation();
  const save = async () => {
    if (!selected) return;
    try {
      await assign({
        id: selected.id,
        version: selected.version,
        patch: { roles: [...new Set([...selected.roles, role])] },
      }).unwrap();
      toast.success(t("assigned"));
      onClose();
    } catch (error) {
      const e = error as ApiError;
      setProblem(
        e.status === 412
          ? ti("accountStale")
          : e.code === "internal_member_required"
            ? ti("internalMemberRequired")
            : e.code === "suite_admin_required"
              ? t("protectedRole")
              : t("assignFailed"),
      );
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !assigning.isLoading && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addRole")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <p className="text-body-sm text-fg-muted">{t("assignHelp")}</p>
          {problem ? (
            <p role="alert" className="text-danger">
              {problem}
            </p>
          ) : null}
          <Field label={t("userName")}>
            <Input
              value={name}
              disabled={assigning.isLoading}
              onChange={(event) => {
                setName(event.target.value);
                setSelected(null);
                setProblem("");
              }}
              autoComplete="off"
            />
          </Field>
          <Field label={ti("email")}>
            <Input
              type="email"
              value={email}
              disabled={assigning.isLoading}
              onChange={(event) => {
                setEmail(event.target.value);
                setSelected(null);
                setProblem("");
              }}
              autoComplete="off"
            />
          </Field>
          {!selected && search.length >= 2 ? (
            <div
              className="max-h-40 overflow-y-auto rounded-field border border-line"
              aria-label={t("existingUsers")}
            >
              {users.isFetching ? (
                <p role="status" className="p-3 text-body-sm">
                  {t("searching")}
                </p>
              ) : users.isError ? (
                <div className="p-3">
                  <p role="alert" className="text-body-sm text-danger">
                    {t("userSearchFailed")}
                  </p>
                  <Button variant="link" size="sm" onClick={users.refetch}>
                    {t("retry")}
                  </Button>
                </div>
              ) : users.data?.items.length ? (
                users.data.items.map((user) => (
                  <button
                    type="button"
                    key={user.id}
                    disabled={!user.active}
                    className="flex w-full flex-col gap-0.5 p-3 text-start hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
                    onClick={() => {
                      setSelected(user);
                      setName(user.name);
                      setEmail(user.email);
                    }}
                  >
                    <span className="text-body-sm font-medium">
                      {user.name}
                    </span>
                    <span className="text-caption text-fg-muted">
                      {user.email}
                    </span>
                  </button>
                ))
              ) : (
                <p role="status" className="p-3 text-body-sm text-fg-muted">
                  {t("noUsers")}
                </p>
              )}
            </div>
          ) : null}
          <Field label={t("role")}>
            <Select
              value={role}
              readOnly={assigning.isLoading}
              onValueChange={(value) => value && setRole(value)}
              options={roles
                .filter((r) => !r.protected || me?.identity.accounts)
                .map((r) => ({
                  value: r.key,
                  label: tr.has(r.key) ? tr(r.key) : r.label,
                }))}
            />
          </Field>
          {selected?.roles.includes(role) ? (
            <p role="status" className="text-body-sm text-fg-muted">
              {t("alreadyAssigned")}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="secondary"
            disabled={assigning.isLoading}
            onClick={onClose}
          >
            {t("cancel")}
          </Button>
          <Button
            disabled={
              !selected ||
              !role ||
              selected.roles.includes(role) ||
              (roles.find((r) => r.key === role)?.protected &&
                !me?.identity.accounts)
            }
            loading={assigning.isLoading}
            onClick={save}
          >
            {t("assign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
