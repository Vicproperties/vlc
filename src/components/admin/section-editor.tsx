"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import type { ContentFormState } from "@/features/content/actions";
import type { SectionDef } from "@/features/content/sections";
import { RichTextEditor } from "./rich-text-editor";

type Action = (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;

/** Editor for one page section, generated from its definition. */
export function SectionEditor({
  def,
  content,
  isVisible,
  action,
  canEdit,
}: {
  def: SectionDef;
  content: Record<string, string>;
  isVisible: boolean;
  action: Action;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as ContentFormState);
  const errors = state.fieldErrors ?? {};
  const id = (field: string) => `${def.page}-${def.key}-${field}`;

  return (
    <section className="grid gap-6 border-t border-line pt-8 lg:grid-cols-[14rem_1fr] lg:gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-body font-semibold text-ink">{def.title}</h2>
        <p className="text-small text-stone">{def.description}</p>
      </div>
      <form action={formAction} className="flex min-w-0 flex-col gap-5" noValidate>
        {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}
        {def.fields.map((field) => {
          const fieldId = id(field.key);
          const error = errors[field.key];
          const common = {
            id: fieldId,
            name: field.key,
            defaultValue: content[field.key] ?? "",
            disabled: !canEdit,
            "aria-invalid": error ? true : undefined,
            "aria-describedby": fieldDescribedBy(fieldId, { hint: field.hint, error }),
          };
          return (
            <FormField key={field.key} id={fieldId} label={field.label} hint={field.hint} error={error}>
              {field.type === "text" ? (
                <Input {...common} maxLength={field.max} />
              ) : field.type === "textarea" ? (
                <Textarea {...common} rows={3} maxLength={field.max} />
              ) : (
                <RichTextEditor
                  id={fieldId}
                  name={field.key}
                  labelledBy={`${fieldId}-label`}
                  defaultValue={content[field.key] ?? ""}
                  invalid={!!error}
                />
              )}
            </FormField>
          );
        })}
        <Checkbox
          id={id("visible")}
          name="is_visible"
          value="on"
          defaultChecked={isVisible}
          disabled={!canEdit}
          label="Show this section on the website"
        />
        {canEdit && (
          <Button type="submit" variant="secondary" loading={pending} className="self-start">
            Save {def.title.toLowerCase()}
          </Button>
        )}
      </form>
    </section>
  );
}
