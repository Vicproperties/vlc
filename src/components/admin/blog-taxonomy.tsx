"use client";

import { Pencil, Trash2, UserRound } from "lucide-react";
import { startTransition, useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import {
  type BlogFormState,
  deleteCategoryAction,
  type Result,
  saveAuthorAction,
  saveCategoryAction,
} from "@/features/blog/actions";
import { prepareImageForUpload } from "@/features/properties/resize-image";

export interface Category {
  id: string;
  name: string;
  description: string;
  count: number;
}

export function CategoryManager({
  categories,
  can,
}: {
  categories: Category[];
  can: { create: boolean; edit: boolean; delete: boolean };
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Category | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startAction] = useTransition();
  const [addKey, setAddKey] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      {result && <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice>}
      {categories.length === 0 ? (
        <p className="text-small text-stone">No categories yet.</p>
      ) : (
        <ul className="flex flex-col border-t border-line">
          {categories.map((category) => (
            <li key={category.id} className="border-b border-line py-4">
              {editing === category.id ? (
                <CategoryForm category={category} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-ink">{category.name}</p>
                    <p className="text-small text-stone">
                      {category.count} article{category.count === 1 ? "" : "s"}
                      {category.description && ` · ${category.description}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {can.edit && (
                      <IconButton label={`Edit ${category.name}`} onClick={() => setEditing(category.id)}>
                        <Pencil className="size-4" />
                      </IconButton>
                    )}
                    {can.delete && (
                      <IconButton
                        label={`Delete ${category.name}`}
                        className="text-danger"
                        onClick={() => setConfirm(category)}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {can.create && (
        <div className="flex flex-col gap-4 border border-line p-5">
          <h3 className="text-small font-semibold text-ink">Add category</h3>
          <CategoryForm key={addKey} category={null} onDone={() => setAddKey((k) => k + 1)} />
        </div>
      )}
      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title="Delete this category?">
        <div className="flex flex-col gap-6">
          <p className="text-small text-ink">Articles in “{confirm?.name}” stay, without a category.</p>
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => {
                const category = confirm;
                if (!category) return;
                startAction(async () => {
                  setResult(await deleteCategoryAction(category.id));
                  setConfirm(null);
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

function CategoryForm({ category, onDone }: { category: Category | null; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    async (prev: BlogFormState, formData: FormData) => {
      const result = await saveCategoryAction(category?.id ?? null, prev, formData);
      if (result.status === "success") onDone();
      return result;
    },
    { status: "idle" } as BlogFormState,
  );
  const prefix = `category-${category?.id ?? "new"}`;
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}
      <FormField id={`${prefix}-name`} label="Name" error={state.fieldErrors?.name} required>
        <Input id={`${prefix}-name`} name="name" defaultValue={category?.name} maxLength={80} required />
      </FormField>
      <FormField id={`${prefix}-description`} label="Description" error={state.fieldErrors?.description} optionalLabel>
        <Textarea
          id={`${prefix}-description`}
          name="description"
          rows={2}
          defaultValue={category?.description}
          maxLength={500}
        />
      </FormField>
      <div className="flex gap-3">
        <Button type="submit" size="sm" variant="secondary" loading={pending}>
          {category ? "Save" : "Add category"}
        </Button>
        {category && (
          <Button type="button" size="sm" variant="quiet" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export interface Author {
  id: string;
  name: string;
  roleTitle: string;
  bio: string;
  photoUrl: string | null;
  isActive: boolean;
}

export function AuthorManager({ authors, can }: { authors: Author[]; can: { create: boolean; edit: boolean } }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [addKey, setAddKey] = useState(0);
  return (
    <div className="flex flex-col gap-6">
      {authors.length === 0 ? (
        <p className="text-small text-stone">No authors yet. Articles without an author show no byline.</p>
      ) : (
        <ul className="flex flex-col border-t border-line">
          {authors.map((author) => (
            <li key={author.id} className="border-b border-line py-4">
              {editing === author.id ? (
                <AuthorForm author={author} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {author.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- dashboard preview
                      <img src={author.photoUrl} alt="" className="size-12 object-cover" />
                    ) : (
                      <span className="flex size-12 items-center justify-center bg-surface text-stone">
                        <UserRound className="size-5" strokeWidth={1.25} aria-hidden="true" />
                      </span>
                    )}
                    <div>
                      <p className="font-medium text-ink">{author.name}</p>
                      <p className="text-small text-stone">
                        {[author.roleTitle, author.isActive ? null : "Inactive"].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  {can.edit && (
                    <IconButton label={`Edit ${author.name}`} onClick={() => setEditing(author.id)}>
                      <Pencil className="size-4" />
                    </IconButton>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {can.create && (
        <div className="flex flex-col gap-4 border border-line p-5">
          <h3 className="text-small font-semibold text-ink">Add author</h3>
          <AuthorForm key={addKey} author={null} onDone={() => setAddKey((k) => k + 1)} />
        </div>
      )}
    </div>
  );
}

function AuthorForm({ author, onDone }: { author: Author | null; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    async (prev: BlogFormState, formData: FormData) => {
      const result = await saveAuthorAction(author?.id ?? null, prev, formData);
      if (result.status === "success") onDone();
      return result;
    },
    { status: "idle" } as BlogFormState,
  );
  const [preparing, setPreparing] = useState(false);
  const prefix = `author-${author?.id ?? "new"}`;
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const photo = formData.get("photo");
        if (photo instanceof File && photo.size > 0) {
          setPreparing(true);
          try {
            const blob = await prepareImageForUpload(photo, 800);
            formData.set("photo", new File([blob], "photo", { type: blob.type }));
          } finally {
            setPreparing(false);
          }
        } else formData.delete("photo");
        startTransition(() => formAction(formData));
      }}
    >
      {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${prefix}-name`} label="Name" error={state.fieldErrors?.name} required>
          <Input id={`${prefix}-name`} name="name" defaultValue={author?.name} maxLength={120} required />
        </FormField>
        <FormField id={`${prefix}-role`} label="Role" error={state.fieldErrors?.role_title} optionalLabel>
          <Input id={`${prefix}-role`} name="role_title" defaultValue={author?.roleTitle} maxLength={120} />
        </FormField>
      </div>
      <FormField id={`${prefix}-bio`} label="Short biography" error={state.fieldErrors?.bio} optionalLabel>
        <Textarea id={`${prefix}-bio`} name="bio" rows={3} defaultValue={author?.bio} maxLength={2000} />
      </FormField>
      <FormField id={`${prefix}-photo`} label="Photo" error={state.fieldErrors?.photo} optionalLabel>
        <input
          id={`${prefix}-photo`}
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="text-small"
        />
      </FormField>
      <Checkbox
        id={`${prefix}-active`}
        name="is_active"
        value="on"
        defaultChecked={author?.isActive ?? true}
        label="Available for new articles"
      />
      <div className="flex gap-3">
        <Button type="submit" size="sm" variant="secondary" loading={pending || preparing}>
          {author ? "Save" : "Add author"}
        </Button>
        {author && (
          <Button type="button" size="sm" variant="quiet" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function IconButton({
  label,
  children,
  className = "",
  ...props
}: { label: string; children: React.ReactNode } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex size-9 items-center justify-center rounded-sm text-ink transition-colors hover:bg-brand-tint ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
