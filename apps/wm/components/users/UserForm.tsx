"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Field,
  Input,
  Switch,
  toast,
} from "@orgtik/ui";
import {
  useMeQuery,
  useRolesQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  type SuiteUser,
  type ApiError,
} from "@/store/api";

export function UserForm({
  user,
  readOnly = false,
  onClose,
}: {
  user?: SuiteUser;
  readOnly?: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Improvements");
  const tr = useTranslations("Roles");
  const te = useTranslations("Editor");
  const { data: me } = useMeQuery();
  const { data: roles = [] } = useRolesQuery();
  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    password: "",
    active: user?.active ?? true,
    roles: user?.roles ?? [],
  });
  const [problem, setProblem] = useState("");
  const [create, creating] = useCreateUserMutation();
  const [update, updating] = useUpdateUserMutation();
  const accounts = Boolean(me?.identity.accounts);
  const self = user?.id === me?.user.id;
  const save = async () => {
    setProblem("");
    try {
      if (user)
        await update({
          id: user.id,
          version: user.version,
          patch: {
            ...(accounts
              ? {
                  firstName: form.firstName,
                  lastName: form.lastName,
                  email: form.email,
                  active: form.active,
                }
              : {}),
            roles: form.roles,
          },
        }).unwrap();
      else
        await create({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
        }).unwrap();
      toast.success(te("saved"));
      onClose();
    } catch (error) {
      const e = error as ApiError;
      setProblem(
        e.status === 412
          ? t("accountStale")
          : e.code === "self_lockout"
            ? t("selfLockout")
            : e.code === "internal_member_required"
              ? t("internalMemberRequired")
              : e.status === 422
                ? t("accountInvalid")
                : te("saveFailed"),
      );
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {readOnly ? user?.name : t(user ? "editAccount" : "newAccount")}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {problem ? (
            <p role="alert" className="text-danger">
              {problem}
            </p>
          ) : null}
          {!accounts ? (
            <p className="text-body-sm text-fg-muted">
              {t("centralAccountsHelp")}
            </p>
          ) : null}
          {(["firstName", "lastName", "email"] as const).map((key) => (
            <Field key={key} label={t(key)}>
              <Input
                type={key === "email" ? "email" : "text"}
                disabled={readOnly || !accounts}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </Field>
          ))}
          {!user ? (
            <Field label={t("initialPassword")}>
              <Input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
          ) : (
            <>
              <label className="flex items-center gap-3">
                <Switch
                  checked={form.active}
                  disabled={readOnly || !accounts || self}
                  onCheckedChange={(active) => setForm({ ...form, active })}
                />
                {t("activeAccount")}
              </label>
              <Field
                label={t("websiteRoles")}
                description={t("websiteRolesHelp")}
                group
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {roles.map((role) => (
                    <Checkbox
                      key={role.key}
                      checked={form.roles.includes(role.key)}
                      disabled={readOnly || (role.protected && !accounts) || (self && ["wm_admin", "wm_owner", "wm_super_admin"].includes(role.key) && form.roles.includes(role.key))}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          roles: checked
                            ? [...form.roles, role.key]
                            : form.roles.filter((key) => key !== role.key),
                        })
                      }
                      label={tr(role.key)}
                    />
                  ))}
                </div>
              </Field>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {te("cancel")}
          </Button>
          {!readOnly ? (
            <Button
              loading={creating.isLoading || updating.isLoading}
              disabled={
                !form.firstName.trim() ||
                !form.lastName.trim() ||
                !form.email.trim() ||
                (!user && form.password.length < 8)
              }
              onClick={save}
            >
              {te("save")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
