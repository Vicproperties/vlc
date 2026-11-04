"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Radio } from "@/components/ui/choice";
import { Notice } from "@/components/ui/notice";
import { type ImportFormState, validateImportAction } from "@/features/properties/import/actions";

export function ImportUploadForm() {
  const [state, formAction, pending] = useActionState(validateImportAction, { status: "idle" } as ImportFormState);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {state.message && (
        <Notice tone="error">
          <p>{state.message}</p>
          {state.details && (
            <ul className="mt-2 list-disc pl-5">
              {state.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-small font-medium text-ink">The file contains</legend>
        <Radio id="kind-land" name="kind" value="land" label="Land" defaultChecked />
        <Radio id="kind-building" name="kind" value="building" label="Buildings" />
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor="file" className="text-small font-medium text-ink">
          CSV file
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="text-small text-ink file:mr-4 file:h-10 file:cursor-pointer file:rounded-sm file:border file:border-ink file:bg-transparent file:px-4 file:text-small file:text-ink hover:file:bg-ink hover:file:text-paper"
        />
        <p className="text-caption text-stone">
          Up to 500 rows and 2 MB. Nothing is saved until you confirm the preview.
        </p>
      </div>
      <Button type="submit" loading={pending} className="self-start">
        Check file
      </Button>
    </form>
  );
}
