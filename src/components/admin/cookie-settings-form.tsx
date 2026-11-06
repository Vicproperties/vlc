"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { type CookieSettingsState, saveCookieSettingsAction } from "@/features/cookies/actions";

export function CookieSettingsForm({
  initial,
}: {
  initial: {
    notice: string;
    analyticsDescription: string;
    analyticsEnabled: boolean;
    defaults: { notice: string; analytics: string };
  };
}) {
  const [state, action, pending] = useActionState<CookieSettingsState, FormData>(saveCookieSettingsAction, {
    status: "idle",
  });
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-6">
      {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}
      <FormField
        id="notice_text"
        label="Cookie notice text"
        optionalLabel
        error={errors.notice_text}
        hint="Leave empty to use the standard text."
      >
        <Textarea
          id="notice_text"
          name="notice_text"
          rows={4}
          maxLength={2000}
          defaultValue={initial.notice}
          placeholder={initial.defaults.notice}
          aria-describedby={fieldDescribedBy("notice_text", { hint: true, error: errors.notice_text })}
        />
      </FormField>
      <FormField
        id="analytics_description"
        label="Visit statistics description"
        optionalLabel
        error={errors.analytics_description}
        hint="Shown under the notice. Leave empty to use the standard text."
      >
        <Textarea
          id="analytics_description"
          name="analytics_description"
          rows={3}
          maxLength={1000}
          defaultValue={initial.analyticsDescription}
          placeholder={initial.defaults.analytics}
          aria-describedby={fieldDescribedBy("analytics_description", {
            hint: true,
            error: errors.analytics_description,
          })}
        />
      </FormField>
      <Checkbox
        id="enable_analytics"
        name="enable_analytics"
        defaultChecked={initial.analyticsEnabled}
        label="Collect visit statistics (with permission)"
        description="When off, no statistics are collected and the cookie notice is not shown, because only essential cookies are used."
      />
      <Checkbox
        id="ask_again"
        name="ask_again"
        label="Ask every visitor again"
        description="Use this after a meaningful change to what is collected. Visitors see the notice again on their next visit."
      />
      <div>
        <Button type="submit" loading={pending}>
          Save cookie settings
        </Button>
      </div>
    </form>
  );
}
