"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import {
  type ContentFormState,
  deleteListItemAction,
  type ListKind,
  reorderListAction,
  type Result,
  saveListItemAction,
  setListItemActiveAction,
} from "@/features/content/actions";
import { cn } from "@/lib/cn";

export interface ListItem {
  id: string;
  a: string;
  b: string;
  isActive: boolean;
}

interface Labels {
  item: string;
  a: string;
  b: string;
  aField: string;
  bField: string;
  bLong?: boolean;
}

/**
 * Add, edit, reorder (arrow buttons), show/hide and delete for simple content lists:
 * core values, why-choose-us reasons and FAQs.
 */
export function ListManager({
  kind,
  labels,
  items,
  can,
}: {
  kind: ListKind;
  labels: Labels;
  items: ListItem[];
  can: { create: boolean; edit: boolean; delete: boolean };
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<ListItem | null>(null);
  const run = (fn: () => Promise<Result>) => startTransition(async () => setResult(await fn()));

  const move = (index: number, offset: number) => {
    const ids = items.map((item) => item.id);
    ids.splice(index + offset, 0, ...ids.splice(index, 1));
    run(() => reorderListAction(kind, ids));
  };

  return (
    <div className="flex flex-col gap-6">
      {result && <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice>}
      {items.length === 0 ? (
        <p className="text-small text-stone">
          Nothing added yet. This section stays hidden on the website until it has items.
        </p>
      ) : (
        <ol className="flex flex-col border-t border-line">
          {items.map((item, index) => (
            <li key={item.id} className="flex flex-col gap-3 border-b border-line py-4">
              {editing === item.id ? (
                <ItemForm kind={kind} labels={labels} item={item} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className={cn("flex min-w-0 flex-col gap-1", !item.isActive && "opacity-60")}>
                    <p className="font-medium text-ink">{item.a}</p>
                    {item.b && <p className="line-clamp-2 text-small whitespace-pre-line text-stone">{item.b}</p>}
                    {!item.isActive && <p className="text-caption text-stone">Hidden from the website</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {can.edit && (
                      <>
                        <Icon
                          label={`Move “${item.a}” up`}
                          disabled={index === 0 || pending}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp className="size-4" />
                        </Icon>
                        <Icon
                          label={`Move “${item.a}” down`}
                          disabled={index === items.length - 1 || pending}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Icon>
                        <Icon
                          label={item.isActive ? `Hide “${item.a}”` : `Show “${item.a}”`}
                          disabled={pending}
                          onClick={() => run(() => setListItemActiveAction(kind, item.id, !item.isActive))}
                        >
                          {item.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Icon>
                        <Icon label={`Edit “${item.a}”`} onClick={() => setEditing(item.id)}>
                          <Pencil className="size-4" />
                        </Icon>
                      </>
                    )}
                    {can.delete && (
                      <Icon label={`Delete “${item.a}”`} className="text-danger" onClick={() => setConfirm(item)}>
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
          <h3 className="text-small font-semibold text-ink">Add {labels.item}</h3>
          <ItemForm kind={kind} labels={labels} item={null} />
        </div>
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title={`Delete this ${labels.item}?`}>
        <div className="flex flex-col gap-6">
          <p className="text-small text-ink">“{confirm?.a}” is deleted permanently. To keep it, hide it instead.</p>
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => {
                const item = confirm;
                if (!item) return;
                run(async () => {
                  const r = await deleteListItemAction(kind, item.id);
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

function ItemForm({
  kind,
  labels,
  item,
  onDone,
}: {
  kind: ListKind;
  labels: Labels;
  item: ListItem | null;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: ContentFormState, formData: FormData) => {
      const result = await saveListItemAction(kind, item?.id ?? null, prev, formData);
      if (result.status === "success") onDone?.();
      return result;
    },
    { status: "idle" } as ContentFormState,
  );
  const prefix = `${kind}-${item?.id ?? "new"}`;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}
      <FormField id={`${prefix}-a`} label={labels.a} error={errors[labels.aField]} required>
        <Input id={`${prefix}-a`} name={labels.aField} defaultValue={item?.a} required />
      </FormField>
      <FormField id={`${prefix}-b`} label={labels.b} error={errors[labels.bField]}>
        <Textarea id={`${prefix}-b`} name={labels.bField} rows={labels.bLong ? 5 : 3} defaultValue={item?.b} />
      </FormField>
      <div className="flex gap-3">
        <Button type="submit" size="sm" variant="secondary" loading={pending}>
          {item ? "Save" : `Add ${labels.item}`}
        </Button>
        {onDone && (
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
        "flex size-9 items-center justify-center rounded-sm text-ink transition-colors hover:bg-brand-tint disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
