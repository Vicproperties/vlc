"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import { StatusText } from "@/components/ui/states";
import {
  deleteAnnouncementAction,
  deleteBannerAction,
  type MarketingFormState,
  type MarketingResult,
  saveAnnouncementAction,
  saveBannerAction,
  setAnnouncementActiveAction,
  setBannerActiveAction,
  setPromotionAction,
} from "@/features/marketing/actions";
import { deleteSubscriberAction } from "@/features/newsletter/actions";

export interface Can {
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface BannerRow {
  id: string;
  message: string;
  type: "information" | "promotion" | "notice";
  linkUrl: string;
  ctaLabel: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

export interface AnnouncementRow {
  id: string;
  heading: string;
  message: string;
  imageUrl: string | null;
  imageAlt: string;
  ctaLabel: string;
  ctaUrl: string;
  frequency: "once" | "once_per_days" | "once_per_session";
  frequencyDays: number | null;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

/** ISO time -> value for <input type="datetime-local"> in Lagos time (UTC+1). */
function lagosInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 3600_000).toISOString().slice(0, 16);
}

const lagos = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

function scheduleText(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return "No schedule";
  return [
    startsAt ? `From ${lagos.format(new Date(startsAt))}` : null,
    endsAt ? `until ${lagos.format(new Date(endsAt))}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function liveStatus(item: { isActive: boolean; startsAt: string | null; endsAt: string | null }) {
  const now = Date.now();
  if (!item.isActive) return <StatusText tone="neutral">Off</StatusText>;
  if (item.startsAt && new Date(item.startsAt).getTime() > now) return <StatusText tone="accent">Scheduled</StatusText>;
  if (item.endsAt && new Date(item.endsAt).getTime() <= now) return <StatusText tone="neutral">Ended</StatusText>;
  return <StatusText tone="success">Showing</StatusText>;
}

function Field({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <FormField id={id} label={label} error={error} hint={hint} required={required} optionalLabel={!required}>
      {children}
    </FormField>
  );
}

function ScheduleFields({
  startsAt,
  endsAt,
  errors,
}: {
  startsAt: string | null;
  endsAt: string | null;
  errors: Record<string, string>;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Field id="starts_at" label="Start showing" error={errors.starts_at} hint="Nigeria time. Empty: straight away.">
        <Input
          id="starts_at"
          name="starts_at"
          type="datetime-local"
          defaultValue={lagosInput(startsAt)}
          aria-describedby={fieldDescribedBy("starts_at", { hint: true, error: errors.starts_at })}
        />
      </Field>
      <Field id="ends_at" label="Stop showing" error={errors.ends_at} hint="Empty: until switched off.">
        <Input
          id="ends_at"
          name="ends_at"
          type="datetime-local"
          defaultValue={lagosInput(endsAt)}
          aria-describedby={fieldDescribedBy("ends_at", { hint: true, error: errors.ends_at })}
        />
      </Field>
    </div>
  );
}

function RowActions({
  label,
  isActive,
  can,
  onEdit,
  onToggle,
  onDelete,
  pending,
}: {
  label: string;
  isActive: boolean;
  can: Can;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {can.edit && (
        <>
          <Button variant="secondary" size="sm" onClick={onToggle} disabled={pending}>
            {isActive ? "Switch off" : "Switch on"}
          </Button>
          <Button
            variant="quiet"
            size="sm"
            onClick={onEdit}
            leadingIcon={<Pencil className="size-4" aria-hidden="true" />}
            aria-label={`Edit ${label}`}
          >
            Edit
          </Button>
        </>
      )}
      {can.delete && (
        <Button
          variant="quiet"
          size="sm"
          className="text-danger"
          onClick={onDelete}
          leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}
          aria-label={`Delete ${label}`}
        >
          Delete
        </Button>
      )}
    </div>
  );
}

function ConfirmDelete({
  open,
  title,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description="This cannot be undone."
      footer={
        <>
          <Button variant="quiet" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete permanently
          </Button>
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Top banner
// ---------------------------------------------------------------------------
export function BannerManager({ banners, can }: { banners: BannerRow[]; can: Can }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<MarketingResult | null>(null);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<BannerRow | null>(null);
  const run = (fn: () => Promise<MarketingResult>) => start(async () => setResult(await fn()));

  return (
    <div className="flex flex-col gap-6">
      {result && <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice>}
      {banners.length === 0 && !adding && (
        <p className="text-small text-stone">No banners yet. A banner appears as a thin strip above the menu.</p>
      )}
      {banners.length > 0 && (
        <ul className="flex flex-col border-t border-line">
          {banners.map((banner) => (
            <li key={banner.id} className="flex flex-col gap-4 border-b border-line py-4">
              {editing === banner.id ? (
                <BannerForm
                  banner={banner}
                  onDone={(saved) => {
                    setEditing(null);
                    if (saved) setResult({ ok: true, message: saved });
                  }}
                />
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium text-ink">{banner.message}</p>
                    <p className="text-caption text-stone">{scheduleText(banner.startsAt, banner.endsAt)}</p>
                    {liveStatus(banner)}
                  </div>
                  <RowActions
                    label={`banner “${banner.message}”`}
                    isActive={banner.isActive}
                    can={can}
                    pending={pending}
                    onEdit={() => setEditing(banner.id)}
                    onToggle={() => run(() => setBannerActiveAction(banner.id, !banner.isActive))}
                    onDelete={() => setConfirm(banner)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {can.create &&
        (adding ? (
          <BannerForm
            banner={null}
            onDone={(saved) => {
              setAdding(false);
              if (saved) setResult({ ok: true, message: saved });
            }}
          />
        ) : (
          <div>
            <Button onClick={() => setAdding(true)}>Add banner</Button>
          </div>
        ))}
      <ConfirmDelete
        open={confirm !== null}
        title="Delete this banner?"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const id = confirm!.id;
          setConfirm(null);
          run(() => deleteBannerAction(id));
        }}
      />
    </div>
  );
}

function BannerForm({ banner, onDone }: { banner: BannerRow | null; onDone: (saved?: string) => void }) {
  const [state, action, pending] = useActionState<MarketingFormState, FormData>(
    async (prev, formData) => {
      const next = await saveBannerAction(banner?.id ?? null, prev, formData);
      if (next.status === "success") onDone(next.message);
      return next;
    },
    { status: "idle" },
  );
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-6 border border-line p-5">
      {state.message && state.status === "error" && <Notice tone="error">{state.message}</Notice>}
      <Field id="message" label="Message" required error={errors.message}>
        <Input id="message" name="message" required maxLength={200} defaultValue={banner?.message ?? ""} />
      </Field>
      <div className="grid gap-6 sm:grid-cols-3">
        <Field id="type" label="Style" required error={errors.type}>
          <Select
            id="type"
            name="type"
            defaultValue={banner?.type ?? "information"}
            options={[
              { value: "information", label: "Information (light purple)" },
              { value: "promotion", label: "Promotion (purple)" },
              { value: "notice", label: "Important notice (dark)" },
            ]}
          />
        </Field>
        <Field id="link_url" label="Link" error={errors.link_url} hint="For example /properties">
          <Input id="link_url" name="link_url" maxLength={1000} defaultValue={banner?.linkUrl ?? ""} />
        </Field>
        <Field id="cta_label" label="Link text" error={errors.cta_label} hint="For example View offers">
          <Input id="cta_label" name="cta_label" maxLength={40} defaultValue={banner?.ctaLabel ?? ""} />
        </Field>
      </div>
      <ScheduleFields startsAt={banner?.startsAt ?? null} endsAt={banner?.endsAt ?? null} errors={errors} />
      <Checkbox
        id="banner_active"
        name="is_active"
        defaultChecked={banner?.isActive ?? true}
        label="Switched on"
        description="Only one banner shows at a time; switching this on switches the others off."
      />
      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          {banner ? "Save banner" : "Add banner"}
        </Button>
        <Button variant="quiet" onClick={() => onDone()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Announcement pop-up
// ---------------------------------------------------------------------------
const FREQUENCY_LABEL: Record<AnnouncementRow["frequency"], string> = {
  once: "Once per visitor",
  once_per_days: "Again after a number of days",
  once_per_session: "Once per visit",
};

export function AnnouncementManager({ items, can }: { items: AnnouncementRow[]; can: Can }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<MarketingResult | null>(null);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<AnnouncementRow | null>(null);
  const run = (fn: () => Promise<MarketingResult>) => start(async () => setResult(await fn()));

  return (
    <div className="flex flex-col gap-6">
      {result && <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice>}
      {items.length === 0 && !adding && (
        <p className="text-small text-stone">
          No announcements yet. An announcement opens as a pop-up shortly after a visitor arrives.
        </p>
      )}
      {items.length > 0 && (
        <ul className="flex flex-col border-t border-line">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-4 border-b border-line py-4">
              {editing === item.id ? (
                <AnnouncementForm
                  item={item}
                  onDone={(saved) => {
                    setEditing(null);
                    if (saved) setResult({ ok: true, message: saved });
                  }}
                />
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium text-ink">{item.heading}</p>
                    <p className="text-caption text-stone">
                      {FREQUENCY_LABEL[item.frequency]}
                      {item.frequency === "once_per_days" && ` (${item.frequencyDays} days)`} · Priority {item.priority}{" "}
                      · {scheduleText(item.startsAt, item.endsAt)}
                    </p>
                    {liveStatus(item)}
                  </div>
                  <RowActions
                    label={`announcement “${item.heading}”`}
                    isActive={item.isActive}
                    can={can}
                    pending={pending}
                    onEdit={() => setEditing(item.id)}
                    onToggle={() => run(() => setAnnouncementActiveAction(item.id, !item.isActive))}
                    onDelete={() => setConfirm(item)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {can.create &&
        (adding ? (
          <AnnouncementForm
            item={null}
            onDone={(saved) => {
              setAdding(false);
              if (saved) setResult({ ok: true, message: saved });
            }}
          />
        ) : (
          <div>
            <Button onClick={() => setAdding(true)}>Add announcement</Button>
          </div>
        ))}
      <ConfirmDelete
        open={confirm !== null}
        title="Delete this announcement?"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const id = confirm!.id;
          setConfirm(null);
          run(() => deleteAnnouncementAction(id));
        }}
      />
    </div>
  );
}

function AnnouncementForm({ item, onDone }: { item: AnnouncementRow | null; onDone: (saved?: string) => void }) {
  const [state, action, pending] = useActionState<MarketingFormState, FormData>(
    async (prev, formData) => {
      const next = await saveAnnouncementAction(item?.id ?? null, prev, formData);
      if (next.status === "success") onDone(next.message);
      return next;
    },
    { status: "idle" },
  );
  const [frequency, setFrequency] = useState<AnnouncementRow["frequency"]>(item?.frequency ?? "once_per_days");
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-6 border border-line p-5">
      {state.message && state.status === "error" && <Notice tone="error">{state.message}</Notice>}
      <Field id="heading" label="Heading" required error={errors.heading}>
        <Input id="heading" name="heading" required maxLength={150} defaultValue={item?.heading ?? ""} />
      </Field>
      <Field id="ann_message" label="Message" error={errors.message}>
        <Textarea id="ann_message" name="message" rows={4} maxLength={2000} defaultValue={item?.message ?? ""} />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="image" label="Image" error={errors.image} hint="JPEG, PNG or WebP. Resized automatically.">
          <Input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
        </Field>
        <Field id="image_alt" label="Image description" error={errors.image_alt} hint="Required with an image.">
          <Input id="image_alt" name="image_alt" maxLength={300} defaultValue={item?.imageAlt ?? ""} />
        </Field>
      </div>
      {item?.imageUrl && <Checkbox id="remove_image" name="remove_image" label="Remove the current image" />}
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="ann_cta_label" label="Button text" error={errors.cta_label}>
          <Input id="ann_cta_label" name="cta_label" maxLength={40} defaultValue={item?.ctaLabel ?? ""} />
        </Field>
        <Field id="cta_url" label="Button link" error={errors.cta_url} hint="For example /properties">
          <Input id="cta_url" name="cta_url" maxLength={1000} defaultValue={item?.ctaUrl ?? ""} />
        </Field>
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        <Field id="frequency" label="How often" required error={errors.frequency}>
          <Select
            id="frequency"
            name="frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.currentTarget.value as AnnouncementRow["frequency"])}
            options={Object.entries(FREQUENCY_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        {frequency === "once_per_days" && (
          <Field id="frequency_days" label="Days" required error={errors.frequency_days}>
            <Input
              id="frequency_days"
              name="frequency_days"
              type="number"
              min={1}
              max={365}
              defaultValue={item?.frequencyDays ?? 7}
            />
          </Field>
        )}
        <Field id="priority" label="Priority" error={errors.priority} hint="Highest shows first, 0 to 100.">
          <Input id="priority" name="priority" type="number" min={0} max={100} defaultValue={item?.priority ?? 0} />
        </Field>
      </div>
      <ScheduleFields startsAt={item?.startsAt ?? null} endsAt={item?.endsAt ?? null} errors={errors} />
      <Checkbox
        id="ann_active"
        name="is_active"
        defaultChecked={item?.isActive ?? true}
        label="Switched on"
        description="Saving shows the announcement again to visitors who closed an earlier version."
      />
      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          {item ? "Save announcement" : "Add announcement"}
        </Button>
        <Button variant="quiet" onClick={() => onDone()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Promotions and subscribers (small row controls)
// ---------------------------------------------------------------------------
export function PromotionToggle({
  id,
  title,
  active,
  eligible,
}: {
  id: string;
  title: string;
  active: boolean;
  eligible: boolean;
}) {
  const [result, setResult] = useState<MarketingResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant={active ? "secondary" : "primary"}
        loading={pending}
        disabled={!active && !eligible}
        aria-label={`${active ? "End promotion for" : "Start promotion for"} ${title}`}
        onClick={() => start(async () => setResult(await setPromotionAction(id, !active)))}
      >
        {active ? "End promotion" : "Start promotion"}
      </Button>
      {result && !result.ok && (
        <p role="alert" className="text-caption text-danger">
          {result.message}
        </p>
      )}
    </div>
  );
}

export function DeleteSubscriber({ id, email }: { id: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<MarketingResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button
        variant="quiet"
        size="sm"
        className="text-danger"
        loading={pending}
        onClick={() => setOpen(true)}
        aria-label={`Delete ${email}`}
      >
        Delete
      </Button>
      {result && !result.ok && <p className="text-caption text-danger">{result.message}</p>}
      <ConfirmDelete
        open={open}
        title={`Delete ${email}?`}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          start(async () => setResult(await deleteSubscriberAction(id)));
        }}
      />
    </>
  );
}
