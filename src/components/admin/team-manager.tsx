"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2, UserRound } from "lucide-react";
import { startTransition, useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import {
  type ContentFormState,
  deleteTeamMemberAction,
  reorderListAction,
  type Result,
  saveTeamMemberAction,
  setTeamMemberActiveAction,
} from "@/features/content/actions";
import { prepareImageForUpload } from "@/features/properties/resize-image";
import { cn } from "@/lib/cn";

export interface TeamMember {
  id: string;
  name: string;
  position: string;
  department: string;
  bio: string;
  photoUrl: string | null;
  social: Record<string, string>;
  isActive: boolean;
}

const SOCIAL = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X (Twitter)" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
];

export function TeamManager({
  members,
  can,
}: {
  members: TeamMember[];
  can: { create: boolean; edit: boolean; delete: boolean };
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startAction] = useTransition();
  const [confirm, setConfirm] = useState<TeamMember | null>(null);
  const [addKey, setAddKey] = useState(0);
  const run = (fn: () => Promise<Result>) => startAction(async () => setResult(await fn()));
  const move = (index: number, offset: number) => {
    const ids = members.map((m) => m.id);
    ids.splice(index + offset, 0, ...ids.splice(index, 1));
    run(() => reorderListAction("team_members", ids));
  };

  return (
    <div className="flex flex-col gap-6">
      {result && <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice>}
      {members.length === 0 ? (
        <p className="text-small text-stone">
          No team members yet. The team section stays hidden until someone is added.
        </p>
      ) : (
        <ol className="flex flex-col border-t border-line">
          {members.map((member, index) => (
            <li key={member.id} className="border-b border-line py-4">
              {editing === member.id ? (
                <MemberForm member={member} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className={cn("flex items-center gap-4", !member.isActive && "opacity-60")}>
                    <Avatar url={member.photoUrl} />
                    <div>
                      <p className="font-medium text-ink">{member.name}</p>
                      <p className="text-small text-stone">
                        {[member.position, member.department].filter(Boolean).join(" · ")}
                      </p>
                      {!member.isActive && <p className="text-caption text-stone">Hidden from the website</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {can.edit && (
                      <>
                        <Icon
                          label={`Move ${member.name} up`}
                          disabled={index === 0 || pending}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp className="size-4" />
                        </Icon>
                        <Icon
                          label={`Move ${member.name} down`}
                          disabled={index === members.length - 1 || pending}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Icon>
                        <Icon
                          label={member.isActive ? `Hide ${member.name}` : `Show ${member.name}`}
                          disabled={pending}
                          onClick={() => run(() => setTeamMemberActiveAction(member.id, !member.isActive))}
                        >
                          {member.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Icon>
                        <Icon label={`Edit ${member.name}`} onClick={() => setEditing(member.id)}>
                          <Pencil className="size-4" />
                        </Icon>
                      </>
                    )}
                    {can.delete && (
                      <Icon label={`Delete ${member.name}`} className="text-danger" onClick={() => setConfirm(member)}>
                        <Trash2 className="size-4" />
                      </Icon>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {can.create && (
        <div className="flex flex-col gap-4 border border-line p-5">
          <h3 className="text-small font-semibold text-ink">Add team member</h3>
          <MemberForm key={addKey} member={null} onDone={() => setAddKey((k) => k + 1)} />
        </div>
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title="Delete this team member?">
        <div className="flex flex-col gap-6">
          <p className="text-small text-ink">{confirm?.name} and their photo are deleted permanently.</p>
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => {
                const member = confirm;
                if (!member) return;
                run(async () => {
                  const r = await deleteTeamMemberAction(member.id);
                  setConfirm(null);
                  return r;
                });
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function Avatar({ url }: { url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- small dashboard preview of an optimised WebP
    <img src={url} alt="" className="size-14 shrink-0 object-cover" />
  ) : (
    <span className="flex size-14 shrink-0 items-center justify-center bg-surface text-stone">
      <UserRound className="size-6" strokeWidth={1.25} aria-hidden="true" />
    </span>
  );
}

function MemberForm({ member, onDone }: { member: TeamMember | null; onDone?: () => void }) {
  const [state, formAction, pending] = useActionState(
    async (prev: ContentFormState, formData: FormData) => {
      const result = await saveTeamMemberAction(member?.id ?? null, prev, formData);
      if (result.status === "success") onDone?.();
      return result;
    },
    { status: "idle" } as ContentFormState,
  );
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const prefix = `team-${member?.id ?? "new"}`;
  const errors: Record<string, string | undefined> = {
    ...state.fieldErrors,
    ...(photoError ? { photo: photoError } : {}),
  };

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const photo = formData.get("photo");
        setPhotoError(null);
        if (photo instanceof File && photo.size > 0) {
          setPreparing(true);
          try {
            const blob = await prepareImageForUpload(photo, 1000);
            formData.set("photo", new File([blob], "photo", { type: blob.type }));
          } catch (error) {
            setPhotoError(error instanceof Error ? error.message : "The photo could not be prepared.");
            setPreparing(false);
            return;
          }
          setPreparing(false);
        }
        startTransition(() => formAction(formData));
      }}
    >
      {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${prefix}-name`} label="Name" error={errors.name} required>
          <Input id={`${prefix}-name`} name="name" defaultValue={member?.name} maxLength={120} required />
        </FormField>
        <FormField id={`${prefix}-position`} label="Position" error={errors.position} optionalLabel>
          <Input id={`${prefix}-position`} name="position" defaultValue={member?.position} maxLength={120} />
        </FormField>
      </div>
      <FormField id={`${prefix}-department`} label="Department" error={errors.department} optionalLabel>
        <Input id={`${prefix}-department`} name="department" defaultValue={member?.department} maxLength={120} />
      </FormField>
      <FormField id={`${prefix}-bio`} label="Short biography" error={errors.bio} optionalLabel>
        <Textarea id={`${prefix}-bio`} name="bio" rows={4} defaultValue={member?.bio} maxLength={3000} />
      </FormField>
      <FormField
        id={`${prefix}-photo`}
        label={member?.photoUrl ? "Replace photo" : "Photo"}
        hint="JPEG, PNG or WebP. Resized automatically; location data is removed."
        error={errors.photo}
        optionalLabel
      >
        <input
          id={`${prefix}-photo`}
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="text-small text-ink file:mr-4 file:h-10 file:cursor-pointer file:rounded-xl file:border file:border-ink file:bg-transparent file:px-4 file:text-small file:text-ink"
        />
      </FormField>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-small font-medium text-ink">Profile links (optional)</legend>
        {SOCIAL.map((network) => (
          <FormField
            key={network.key}
            id={`${prefix}-${network.key}`}
            label={network.label}
            error={errors[`social_${network.key}`]}
          >
            <Input
              id={`${prefix}-${network.key}`}
              name={`social_${network.key}`}
              type="url"
              inputMode="url"
              defaultValue={member?.social[network.key]}
              placeholder="https://"
            />
          </FormField>
        ))}
      </fieldset>
      <div className="flex gap-3">
        <Button type="submit" size="sm" variant="secondary" loading={pending || preparing}>
          {member ? "Save" : "Add team member"}
        </Button>
        {onDone && member && (
          <Button type="button" size="sm" variant="quiet" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function Icon({
  label,
  children,
  className,
  ...props
}: { label: string; children: React.ReactNode } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-xl text-ink transition-colors hover:bg-brand-tint disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
