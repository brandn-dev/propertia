"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  LoaderCircle,
  Save,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import type { UserFormState } from "@/app/(dashboard)/users/actions";
import {
  APP_ROLES,
  CAPABILITY_GROUPS,
  CAPABILITY_LABELS,
  ROLE_LABELS,
  type AppCapability,
  type AppRole,
} from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatarField } from "@/components/users/user-avatar-field";

const initialState: UserFormState = {};
const selectClassName = "select-blank";

async function noopDeleteAction(): Promise<UserFormState> {
  return {};
}

type UserFormProps = {
  mode: "create" | "edit";
  formAction: (
    state: UserFormState,
    formData: FormData
  ) => Promise<UserFormState>;
  initialValues?: {
    displayName: string;
    username: string;
    role: AppRole;
    capabilities: AppCapability[];
    avatarUrl: string;
    isActive?: boolean;
  };
  selfDeleteAction?: (
    state: UserFormState,
    formData: FormData
  ) => Promise<UserFormState>;
  selfDeleteDisabledReason?: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

export function UserForm({
  mode,
  formAction,
  initialValues = {
    displayName: "",
    username: "",
    role: "STAFF",
    capabilities: ["VIEW_DASHBOARD"],
    avatarUrl: "",
    isActive: true,
  },
  selfDeleteAction,
  selfDeleteDisabledReason,
}: UserFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(
    selfDeleteAction ?? noopDeleteAction,
    initialState
  );


  const [displayName, setDisplayName] = useState(initialValues.displayName);
  const [role, setRole] = useState<AppRole>(initialValues.role);

  return (
    <div className="space-y-5">
      <section className="border-blank flex flex-wrap items-center justify-between gap-4 rounded-[1.4rem] px-5 py-4">
        <div className="min-w-0 space-y-1">
          <p className="text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">
            Account
          </p>
          <h2 className="text-xl font-semibold tracking-[-0.04em]">
            {displayName || initialValues.displayName || "New user"}
          </h2>
          <p className="text-sm text-muted-foreground">
            @{initialValues.username || "new-account"} · {ROLE_LABELS[role]} ·{" "}
            {initialValues.isActive === false ? "Inactive" : "Active"}
          </p>
        </div>
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UserRound className="size-5" />
        </div>
      </section>

      <form action={action} className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <section className="border-blank rounded-[1.4rem] p-5">
              <div className="mb-4 space-y-1">
                <p className="text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">
                  Identity
                </p>
                <h3 className="text-lg font-semibold tracking-[-0.04em]">
                  Basic details
                </h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    name="displayName"
                    defaultValue={initialValues.displayName}
                    placeholder="Jane Reyes"
                    className="field-blank h-11"
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                  <FieldError message={state.errors?.displayName?.[0]} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    defaultValue={initialValues.username}
                    placeholder="jane.reyes"
                    className="field-blank h-11"
                  />
                  <FieldError message={state.errors?.username?.[0]} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    name="role"
                    defaultValue={initialValues.role}
                    className={selectClassName}
                    onChange={(event) => setRole(event.target.value as AppRole)}
                  >
                    {APP_ROLES.map((roleOption) => (
                      <option key={roleOption} value={roleOption}>
                        {ROLE_LABELS[roleOption]}
                      </option>
                    ))}
                  </select>
                  <FieldError message={state.errors?.role?.[0]} />
                </div>
              </div>
            </section>

            <section className="border-blank rounded-[1.4rem] p-5">
              <div className="mb-4 space-y-1">
                <p className="text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">
                  Security
                </p>
                <h3 className="text-lg font-semibold tracking-[-0.04em]">
                  Password
                </h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  {mode === "create" ? "Password" : "New password"}
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={
                    mode === "create"
                      ? "At least 8 characters"
                      : "Leave blank to keep current password"
                  }
                  className="field-blank h-11"
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  {mode === "create"
                    ? "Set starting sign-in password."
                    : "Only fill if password should change."}
                </p>
                <FieldError message={state.errors?.password?.[0]} />
              </div>
            </section>

            <section className="border-blank rounded-[1.4rem] p-5">
              <div className="mb-4 space-y-1">
                <p className="text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">
                  Access
                </p>
                <h3 className="text-lg font-semibold tracking-[-0.04em]">
                  Permissions
                </h3>
                <p className="text-sm text-muted-foreground">
                  Pick what this user can open and manage.
                </p>
              </div>

              {role === "ADMIN" ? (
                <div className="rounded-[1.2rem] border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  Administrators always have full access.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {CAPABILITY_GROUPS.map((group) => (
                    <section
                      key={group.title}
                      className="rounded-[1.2rem] border border-border/60 bg-background/55 p-4"
                    >
                      <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground">
                        {group.title}
                      </p>
                      <div className="mt-3 space-y-2">
                        {group.capabilities.map((capability) => (
                          <label
                            key={capability}
                            className="field-blank flex items-center gap-3 rounded-[1rem] border bg-background/60 px-4 py-3"
                          >
                            <input
                              type="checkbox"
                              name="capabilities"
                              value={capability}
                              defaultChecked={initialValues.capabilities.includes(
                                capability
                              )}
                              className="size-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <p className="text-sm font-medium">
                              {CAPABILITY_LABELS[capability]}
                            </p>
                          </label>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
              <FieldError message={state.errors?.capabilities?.[0]} />
            </section>

            {state.message ? (
              <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {state.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-5">
            <UserAvatarField
              initialAvatarUrl={initialValues.avatarUrl}
              previewName={displayName || initialValues.displayName || "User"}
              errorMessage={state.errors?.avatarFile?.[0]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            render={<Link href="/users" />}
            variant="outline"
            className="rounded-full"
          >
            <ArrowLeft />
            Back to users
          </Button>

          <Button type="submit" className="rounded-full" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
            {mode === "create" ? "Create user" : "Save user"}
          </Button>
        </div>
      </form>

      {mode === "edit" && selfDeleteAction ? (
        <section className="rounded-[1.4rem] border border-destructive/25 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <ShieldAlert className="size-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-[0.72rem] uppercase tracking-[0.2em] text-destructive/80">
                Danger zone
              </p>
              <h3 className="text-lg font-semibold tracking-[-0.04em]">
                Delete my account
              </h3>
              <p className="text-sm text-muted-foreground">
                Remove this sign-in account and sign out.
              </p>
            </div>
          </div>

          <form action={deleteAction} className="mt-4 space-y-3">
            {deleteState.message ? (
              <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {deleteState.message}
              </p>
            ) : null}

            <p className="text-sm text-muted-foreground">
              {selfDeleteDisabledReason ??
                "Allowed only when another active admin already exists."}
            </p>

            <Button
              type="submit"
              variant="outline"
              className="rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={deletePending || Boolean(selfDeleteDisabledReason)}
            >
              {deletePending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Trash2 />
              )}
              Delete my account
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
