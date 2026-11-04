import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Phone handling. International numbers are accepted; Nigeria is the default country,
 * so local formats such as "0803 123 4567" are understood.
 *
 * This module uses the compact metadata (length-based validation), suitable for the browser.
 * Server actions perform the authoritative check in Stage 7 with the full metadata set.
 */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "NG";

export type PhoneParseResult =
  { ok: true; e164: string; international: string; country: CountryCode | undefined } | { ok: false; error: string };

export function parsePhone(input: string, defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY): PhoneParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter a phone number." };
  if (!/^[+\d\s().-]+$/.test(trimmed)) {
    return { ok: false, error: "Use digits only, with an optional leading +." };
  }

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) {
    return {
      ok: false,
      error: "Enter a valid phone number. Include the country code for numbers outside Nigeria.",
    };
  }

  return {
    ok: true,
    e164: parsed.number,
    international: parsed.formatInternational(),
    country: parsed.country,
  };
}
