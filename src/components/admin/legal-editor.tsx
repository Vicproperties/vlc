"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import type { ContentFormState } from "@/features/content/actions";
import { RichTextEditor } from "./rich-text-editor";

type Action = (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;

export function LegalEditor({
  action,
  title,
  html,
  isPublished,
  needsReview,
  draft,
}: {
  action: Action;
  title: string;
  html: string;
  isPublished: boolean;
  needsReview: boolean;
  /** Optional starter text that can be inserted when the page is empty. */
  draft?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as ContentFormState);
  const [content, setContent] = useState(html);
  const [editorKey, setEditorKey] = useState(0);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}
      {needsReview && (
        <Notice tone="info">
          This page is marked as needing legal review. Have a qualified lawyer check it, then untick “Needs legal
          review” below.
        </Notice>
      )}
      <FormField id="legal-title" label="Page title" error={errors.title} required>
        <Input id="legal-title" name="title" defaultValue={title} maxLength={150} required />
      </FormField>
      <FormField id="legal-content" label="Text" error={errors.content_html}>
        <RichTextEditor
          key={editorKey}
          id="legal-content"
          name="content_html"
          labelledBy="legal-content-label"
          defaultValue={content}
          invalid={!!errors.content_html}
          document
        />
      </FormField>
      {draft && !content && (
        <Button
          type="button"
          variant="link"
          className="self-start"
          onClick={() => {
            setContent(draft);
            setEditorKey((k) => k + 1);
          }}
        >
          Insert the starter draft (for legal review)
        </Button>
      )}
      <div className="flex flex-col gap-3">
        <Checkbox
          id="legal-review"
          name="needs_legal_review"
          value="on"
          defaultChecked={needsReview}
          label="Needs legal review"
          description="Keep ticked until a lawyer has reviewed this version. Unticking records the review date."
        />
        <Checkbox
          id="legal-published"
          name="is_published"
          value="on"
          defaultChecked={isPublished}
          label="Published on the website"
          description="When unticked, the page is hidden from visitors."
        />
      </div>
      <Button type="submit" loading={pending} className="self-start">
        Save page
      </Button>
    </form>
  );
}
