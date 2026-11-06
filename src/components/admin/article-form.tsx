"use client";

import { startTransition, useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Select, type SelectOption } from "@/components/ui/select";
import type { BlogFormState } from "@/features/blog/actions";
import { prepareImageForUpload } from "@/features/properties/resize-image";
import { ArticleEditor } from "./article-editor";

type Action = (state: BlogFormState, formData: FormData) => Promise<BlogFormState>;

export interface ArticleValues {
  title: string;
  slug: string;
  excerpt: string;
  category_id: string;
  author_id: string;
  seo_title: string;
  seo_description: string;
  featured_image_alt: string;
  featuredImageUrl: string | null;
  isFeatured: boolean;
  status: "draft" | "published";
  contentJson: unknown;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-line pt-8 lg:grid-cols-[12rem_1fr] lg:gap-10">
      <h2 className="text-body font-semibold text-ink">{title}</h2>
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </section>
  );
}

export function ArticleForm({
  action,
  initial,
  categories,
  authors,
  canPublish,
}: {
  action: Action;
  initial: ArticleValues;
  categories: SelectOption[];
  authors: SelectOption[];
  canPublish: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as BlogFormState);
  const [title, setTitle] = useState(initial.title);
  const [preparing, setPreparing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const errors: Record<string, string | undefined> = {
    ...state.fieldErrors,
    ...(imageError ? { featured_image: imageError } : {}),
  };
  const a11y = (name: string, hint?: unknown) => ({
    id: name,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": fieldDescribedBy(name, { hint, error: errors[name] }),
  });
  const published = initial.status === "published";

  return (
    <form
      className="flex flex-col gap-8"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const formData = new FormData(event.currentTarget);
        formData.set("intent", submitter?.value ?? "save");
        setImageError(null);
        const image = formData.get("featured_image");
        if (image instanceof File && image.size > 0) {
          setPreparing(true);
          try {
            const blob = await prepareImageForUpload(image, 2000);
            formData.set("featured_image", new File([blob], "image", { type: blob.type }));
          } catch (error) {
            setImageError(error instanceof Error ? error.message : "The image could not be prepared.");
            setPreparing(false);
            return;
          }
          setPreparing(false);
        } else {
          formData.delete("featured_image");
        }
        startTransition(() => formAction(formData));
      }}
    >
      {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}

      <Section title="Article">
        <FormField id="title" label="Title" error={errors.title} required>
          <Input {...a11y("title")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </FormField>
        <FormField
          id="excerpt"
          label="Summary"
          hint="One or two sentences shown on the blog page and in search results."
          error={errors.excerpt}
          optionalLabel
        >
          <Textarea {...a11y("excerpt", true)} rows={3} defaultValue={initial.excerpt} maxLength={500} />
        </FormField>
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField id="category_id" label="Category" error={errors.category_id} optionalLabel>
            <Select
              {...a11y("category_id")}
              defaultValue={initial.category_id}
              options={categories}
              placeholder="No category"
            />
          </FormField>
          <FormField id="author_id" label="Author" error={errors.author_id} optionalLabel>
            <Select
              {...a11y("author_id")}
              defaultValue={initial.author_id}
              options={authors}
              placeholder="No author shown"
            />
          </FormField>
        </div>
        <FormField id="article-content" label="Content" error={errors.content_html}>
          <ArticleEditor
            initialJson={initial.contentJson}
            invalid={!!errors.content_html}
            onImportTitle={(t) => !title.trim() && setTitle(t)}
          />
        </FormField>
      </Section>

      <Section title="Featured image">
        {initial.featuredImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- dashboard preview of an optimised WebP
          <img
            src={initial.featuredImageUrl}
            alt="Current featured image"
            className="aspect-[16/9] w-full max-w-lg object-cover"
          />
        )}
        <FormField
          id="featured_image"
          label={initial.featuredImageUrl ? "Replace image" : "Image"}
          hint="Shown at the top of the article and on the blog page. Resized automatically."
          error={errors.featured_image}
          optionalLabel
        >
          <input
            {...a11y("featured_image", true)}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="text-small text-ink file:mr-4 file:h-10 file:cursor-pointer file:rounded-xl file:border file:border-ink file:bg-transparent file:px-4 file:text-small file:text-ink"
          />
        </FormField>
        {initial.featuredImageUrl && (
          <Checkbox
            id="featured_image_remove"
            name="featured_image_remove"
            value="on"
            label="Remove the current image"
          />
        )}
        <FormField
          id="featured_image_alt"
          label="Image description (alt text)"
          error={errors.featured_image_alt}
          optionalLabel
        >
          <Input {...a11y("featured_image_alt")} defaultValue={initial.featured_image_alt} maxLength={300} />
        </FormField>
      </Section>

      <Section title="Search engines">
        <FormField
          id="slug"
          label="Web address"
          hint="Leave empty to create it from the title, e.g. “buying-land-in-lagos”."
          error={errors.slug}
          optionalLabel
        >
          <Input {...a11y("slug", true)} defaultValue={initial.slug} maxLength={120} />
        </FormField>
        <FormField
          id="seo_title"
          label="SEO title"
          hint="Defaults to the article title."
          error={errors.seo_title}
          optionalLabel
        >
          <Input {...a11y("seo_title", true)} defaultValue={initial.seo_title} maxLength={120} />
        </FormField>
        <FormField
          id="seo_description"
          label="SEO description"
          hint="Defaults to the summary."
          error={errors.seo_description}
          optionalLabel
        >
          <Textarea
            {...a11y("seo_description", true)}
            rows={2}
            defaultValue={initial.seo_description}
            maxLength={320}
          />
        </FormField>
      </Section>

      {canPublish && (
        <Section title="Highlight">
          <Checkbox
            id="is_featured"
            name="is_featured"
            value="on"
            defaultChecked={initial.isFeatured}
            label="Featured article"
            description="Shown at the top of the blog page. Only one article can be featured; choosing this one replaces the current one."
          />
        </Section>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-paper/95 px-4 py-4 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        <p className="mr-auto text-small text-stone">
          Status: <span className="font-medium text-ink">{published ? "Published" : "Draft"}</span>
        </p>
        {canPublish && published && (
          <Button type="submit" name="intent" value="unpublish" variant="quiet" loading={pending}>
            Unpublish
          </Button>
        )}
        <Button
          type="submit"
          name="intent"
          value="save"
          variant={canPublish && !published ? "secondary" : "primary"}
          loading={pending || preparing}
        >
          {published ? "Save changes" : "Save draft"}
        </Button>
        {canPublish && !published && (
          <Button type="submit" name="intent" value="publish" loading={pending || preparing}>
            Publish
          </Button>
        )}
      </div>
    </form>
  );
}
