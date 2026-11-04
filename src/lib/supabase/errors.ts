/**
 * Turns a PostgREST / Postgres error into a message safe to show an admin. Messages raised
 * deliberately by our own triggers (P0001, 42501 with our text) are already written for
 * people; anything else gets a generic message so internals never reach the browser.
 */
export function dbErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  switch (error.code) {
    case "P0001":
    case "P0002":
      return error.message ?? "This change is not allowed.";
    case "42501":
      return error.message?.startsWith("You do not have permission")
        ? error.message
        : "You do not have permission to do this.";
    case "23505":
      return "An item with the same name or address already exists.";
    case "23503":
      return "A linked item no longer exists. Reload the page and try again.";
    case "23514":
    case "22P02":
    case "22023":
      return "Some values are not allowed. Check the form and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
