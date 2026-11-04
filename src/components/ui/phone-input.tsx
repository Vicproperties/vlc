"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import { cn } from "@/lib/cn";
import { DEFAULT_PHONE_COUNTRY } from "@/lib/phone";
import { Input, type InputProps } from "./input";
import { Select } from "./select";

/**
 * Phone number entry that accepts international numbers.
 * Nigeria is preselected; visitors abroad choose their country or type a number starting with +.
 * Validation happens in the form schema via `parsePhone(number, country)`.
 */
const subscribeNoop = () => () => {};

export interface PhoneInputProps extends Omit<InputProps, "type" | "value" | "onChange"> {
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  value: string;
  onValueChange: (value: string) => void;
  countryLabel?: string;
}

export function PhoneInput({
  country,
  onCountryChange,
  value,
  onValueChange,
  countryLabel = "Country code",
  id,
  className,
  ...props
}: PhoneInputProps) {
  // Intl.DisplayNames output differs between Node (server) and browsers, which would cause a
  // hydration mismatch. Render deterministic labels first, then localized names once hydrated.
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const options = useMemo(() => {
    const names = hydrated ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
    const countries = getCountries()
      .map((code) => ({
        value: code,
        label: `${names?.of(code) ?? code} (+${getCountryCallingCode(code)})`,
      }))
      .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
    const ng = countries.find((c) => c.value === DEFAULT_PHONE_COUNTRY);
    return ng ? [ng, ...countries.filter((c) => c.value !== DEFAULT_PHONE_COUNTRY)] : countries;
  }, [hydrated]);

  return (
    <div className={cn("grid grid-cols-[minmax(0,11.5rem)_1fr] gap-2", className)}>
      <Select
        aria-label={countryLabel}
        id={id ? `${id}-country` : undefined}
        value={country}
        onChange={(e) => onCountryChange(e.target.value as CountryCode)}
        options={options}
      />
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        {...props}
      />
    </div>
  );
}
