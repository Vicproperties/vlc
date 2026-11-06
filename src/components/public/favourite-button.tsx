"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loadedFavourites, toggleFavourite, useFavourites } from "@/features/customers/favourites-store";
import { cn } from "@/lib/cn";

/**
 * Save / unsave a property. Signed-out visitors are taken to sign in; after signing in the
 * property is saved automatically (owner brief) and they come back to the same page.
 */
export function FavouriteButton({
  propertyId,
  title,
  variant = "overlay",
}: {
  propertyId: string;
  title: string;
  variant?: "overlay" | "inline";
}) {
  const { signedIn, isStaff, ids, loaded } = useFavourites();
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const saved = ids.has(propertyId);
  if (isStaff) return null;

  async function onClick() {
    setNote(null);
    // Read at click time (not during render), so cached pages stay static.
    const pathname = window.location.pathname;
    // A click before the first load finishes must not treat a signed-in customer as signed out.
    const current = loaded ? { signedIn, isStaff } : await loadedFavourites();
    if (current.isStaff) return;
    if (!current.signedIn) {
      router.push(`/account/login?next=${encodeURIComponent(pathname)}&favourite=${propertyId}`);
      return;
    }
    const result = await toggleFavourite(propertyId);
    if (result === "sign_in")
      router.push(`/account/login?next=${encodeURIComponent(pathname)}&favourite=${propertyId}`);
    else if (result === "error") setNote("Could not update favourites. Please try again.");
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${title} from favourites` : `Save ${title} to favourites`}
        title={saved ? "Remove from favourites" : "Save to favourites"}
        className={cn(
          "relative z-10 flex items-center justify-center gap-2 transition-colors",
          variant === "overlay"
            ? "size-10 bg-paper/90 text-ink hover:bg-paper"
            : "h-11 border border-line-strong px-4 text-small text-ink hover:border-ink",
        )}
      >
        <Heart className={cn("size-5", saved && "fill-brand text-brand")} strokeWidth={1.75} aria-hidden="true" />
        {variant === "inline" && (saved ? "Saved" : "Save")}
      </button>
      {note && (
        <span role="alert" className="sr-only">
          {note}
        </span>
      )}
    </>
  );
}

/** Header link: "Sign in" or "My account". */
export function AccountLink({ className }: { className?: string }) {
  const { signedIn, isStaff, loaded } = useFavourites();
  if (!loaded || isStaff) return null;
  return (
    <a href={signedIn ? "/account" : "/account/login"} className={className}>
      {signedIn ? "My account" : "Sign in"}
    </a>
  );
}
