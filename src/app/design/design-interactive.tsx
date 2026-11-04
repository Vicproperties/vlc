"use client";

import { useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { DEFAULT_PHONE_COUNTRY, parsePhone } from "@/lib/phone";

export function DesignInteractive() {
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [country, setCountry] = useState<CountryCode>(DEFAULT_PHONE_COUNTRY);
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const { notify } = useToast();

  const phoneResult = phone ? parsePhone(phone, country) : null;
  const phoneError = phoneTouched && phoneResult && !phoneResult.ok ? phoneResult.error : undefined;

  return (
    <section className="flex flex-col gap-8 border-t border-line py-14">
      <h2 className="text-h2">Interactive components</h2>
      <div className="grid max-w-3xl gap-8 md:grid-cols-2">
        <FormField id="d-password" label="Password">
          <PasswordInput id="d-password" autoComplete="current-password" />
        </FormField>
        <FormField
          id="d-phone"
          label="Phone number"
          hint={phoneResult?.ok ? `Saved as ${phoneResult.e164}` : "International numbers are accepted."}
          error={phoneError}
        >
          <PhoneInput
            id="d-phone"
            country={country}
            onCountryChange={setCountry}
            value={phone}
            onValueChange={setPhone}
            onBlur={() => setPhoneTouched(true)}
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={fieldDescribedBy("d-phone", { hint: !phoneError, error: phoneError })}
          />
        </FormField>
      </div>

      <div className="flex flex-wrap gap-4">
        <Button variant="secondary" onClick={() => setDialog(true)}>
          Open dialog
        </Button>
        <Button variant="secondary" onClick={() => setDrawer(true)}>
          Open filter drawer
        </Button>
        <Button
          variant="quiet"
          onClick={() => notify({ tone: "success", title: "Changes saved", description: "The property was updated." })}
        >
          Success toast
        </Button>
        <Button
          variant="quiet"
          onClick={() => notify({ tone: "error", title: "Could not save", description: "Please try again." })}
        >
          Error toast
        </Button>
      </div>

      <Tabs
        items={[
          { id: "overview", label: "Overview", content: <p className="text-stone">Overview panel content.</p> },
          { id: "pricing", label: "Pricing", content: <p className="text-stone">Pricing panel content.</p> },
          { id: "media", label: "Media", content: <p className="text-stone">Media panel content.</p> },
        ]}
      />

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Archive property"
        description="Archived properties are hidden from the public website."
        footer={
          <>
            <Button variant="quiet" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setDialog(false)}>
              Archive
            </Button>
          </>
        }
      >
        <p className="text-body text-ink">You can restore an archived property at any time from the dashboard.</p>
      </Dialog>

      <Dialog
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Filters"
        variant="drawer-right"
        footer={
          <>
            <Button variant="quiet" onClick={() => setDrawer(false)}>
              Clear all
            </Button>
            <Button onClick={() => setDrawer(false)}>Show results</Button>
          </>
        }
      >
        <p className="text-stone">The mobile property filter drawer uses this pattern.</p>
      </Dialog>
    </section>
  );
}
