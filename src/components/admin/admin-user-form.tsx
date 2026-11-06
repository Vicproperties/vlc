"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Radio } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import {
  type AdminUserFormState,
  type AdminUserResult,
  inviteAdminAction,
  resendAdminInviteAction,
  setAdminActiveAction,
  updateAdminAction,
} from "@/features/admins/actions";
import {
  MANAGED_MODULES,
  PERMISSION_ACTIONS,
  type AdminModuleName,
  type PermissionAction,
  type PermissionSet,
  permissionFieldName,
} from "@/features/admins/permissions";

type Role = "super_admin" | "sub_admin";

export interface AdminUserFormProps {
  mode: "invite" | "edit";
  initial: { id?: string; fullName: string; email: string; role: Role; permissions: PermissionSet };
}

/**
 * Invite or edit an administrator. Super administrators have every permission, so the
 * permission grid only appears for administrators. Inviting asks for confirmation of the
 * email address first: the invite gives dashboard access to whoever owns that inbox.
 */
export function AdminUserForm({ mode, initial }: AdminUserFormProps) {
  const [state, formAction, pending] = useActionState<AdminUserFormState, FormData>(
    mode === "invite" ? inviteAdminAction : updateAdminAction,
    { status: "idle" },
  );
  const [role, setRole] = useState<Role>(initial.role);
  const [permissions, setPermissions] = useState<PermissionSet>(initial.permissions);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  const toggle = (module: AdminModuleName, action: PermissionAction, on: boolean) =>
    setPermissions((current) => {
      const flags = { ...current[module], [action]: on };
      // View is required for anything else; removing View removes the rest.
      if (on && action !== "view") flags.view = true;
      if (!on && action === "view") for (const key of Object.keys(flags)) flags[key as PermissionAction] = false;
      return { ...current, [module]: flags };
    });

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (mode !== "invite" || confirmEmail !== null) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    event.preventDefault();
    setConfirmEmail(
      String(new FormData(form).get("email") ?? "")
        .trim()
        .toLowerCase(),
    );
  };

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-8">
      {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField id="full_name" label="Full name" required error={errors.full_name}>
          <Input
            id="full_name"
            name="full_name"
            defaultValue={initial.fullName}
            required
            maxLength={120}
            autoComplete="off"
            aria-invalid={errors.full_name ? true : undefined}
            aria-describedby={fieldDescribedBy("full_name", { error: errors.full_name })}
          />
        </FormField>
        <FormField
          id="email"
          label="Email address"
          required={mode === "invite"}
          error={errors.email}
          hint={
            mode === "invite"
              ? "They receive a link at this address to set their password."
              : "The email cannot be changed."
          }
        >
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={initial.email}
            required={mode === "invite"}
            readOnly={mode === "edit"}
            maxLength={254}
            autoComplete="off"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={fieldDescribedBy("email", { hint: true, error: errors.email })}
          />
        </FormField>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-small font-medium text-ink">Role</legend>
        <Radio
          id="role_sub_admin"
          name="role"
          value="sub_admin"
          checked={role === "sub_admin"}
          onChange={() => setRole("sub_admin")}
          label="Administrator"
          description="Can use only the sections ticked below."
        />
        <Radio
          id="role_super_admin"
          name="role"
          value="super_admin"
          checked={role === "super_admin"}
          onChange={() => setRole("super_admin")}
          label="Super administrator"
          description="Full access to everything, including adding and removing administrators."
        />
        {errors.role && <p className="text-caption text-danger">{errors.role}</p>}
      </fieldset>

      {role === "sub_admin" && (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 text-small font-medium text-ink">What this administrator can do</legend>
          <p className="text-caption text-stone">
            Ticking any action also allows viewing that section. Sections that are not ticked are hidden from them.
          </p>
          <ul className="flex flex-col border-t border-line">
            {MANAGED_MODULES.map(({ module, label, hint, actions }) => (
              <li
                key={module}
                className="flex flex-col gap-3 border-b border-line py-4 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="lg:max-w-xs">
                  <p className="text-small font-medium text-ink">{label}</p>
                  <p className="text-caption text-stone">{hint}</p>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {PERMISSION_ACTIONS.filter(({ key }) => actions.includes(key)).map(({ key, label: actionLabel }) => {
                    const name = permissionFieldName(module, key);
                    return (
                      <Checkbox
                        key={key}
                        id={name}
                        name={name}
                        checked={permissions[module]?.[key] === true}
                        onChange={(event) => toggle(module, key, event.currentTarget.checked)}
                        label={actionLabel}
                        aria-label={`${label}: ${actionLabel}`}
                      />
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div>
        <Button type="submit" loading={pending}>
          {mode === "invite" ? "Send invitation" : "Save changes"}
        </Button>
      </div>

      <Dialog
        open={confirmEmail !== null}
        onClose={() => setConfirmEmail(null)}
        title="Send the invitation?"
        description={
          <>
            Dashboard access goes to whoever owns <strong className="break-all">{confirmEmail}</strong>. Check the
            address is correct.
          </>
        }
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirmEmail(null)}>
              Go back
            </Button>
            <Button
              onClick={() => {
                formRef.current?.requestSubmit();
                setConfirmEmail(null);
              }}
            >
              Yes, send invitation
            </Button>
          </>
        }
      />
    </form>
  );
}

/** Restore or remove access, and resend the password setup link. */
export function AdminAccessControls({ id, name, isActive }: { id: string; name: string; isActive: boolean }) {
  const [result, setResult] = useState<AdminUserResult | null>(null);
  const [pending, setPending] = useState<"active" | "resend" | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const run = async (kind: "active" | "resend", fn: () => Promise<AdminUserResult>) => {
    setPending(kind);
    try {
      setResult(await fn());
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {result && <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice>}
      <div className="flex flex-wrap gap-3">
        {isActive && (
          <Button
            variant="secondary"
            loading={pending === "resend"}
            onClick={() => run("resend", () => resendAdminInviteAction(id))}
          >
            Send password setup link
          </Button>
        )}
        {isActive ? (
          <Button variant="danger" onClick={() => setConfirmDeactivate(true)} loading={pending === "active"}>
            Remove access
          </Button>
        ) : (
          <Button
            variant="secondary"
            loading={pending === "active"}
            onClick={() => run("active", () => setAdminActiveAction(id, true))}
          >
            Restore access
          </Button>
        )}
      </div>
      <Dialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        title={`Remove ${name}'s access?`}
        description="They are signed out of the dashboard straight away and cannot sign in. Their past work and the activity log are kept. You can restore access later."
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirmDeactivate(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDeactivate(false);
                void run("active", () => setAdminActiveAction(id, false));
              }}
            >
              Remove access
            </Button>
          </>
        }
      />
    </div>
  );
}
