import { Heart } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountShell } from "@/components/public/account-shell";
import { PropertyGrid } from "@/components/public/property-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { getMyFavourites } from "@/features/customers/queries";

export const metadata: Metadata = { title: "My favourites", robots: { index: false, follow: false } };

export default function FavouritesPage() {
  return (
    <Suspense
      fallback={
        <div className="container-content py-16">
          <Skeleton className="h-64" />
        </div>
      }
    >
      <AccountShell current="/account/favourites" title="My favourites">
        {() => <FavouritesList />}
      </AccountShell>
    </Suspense>
  );
}

async function FavouritesList() {
  const listings = await getMyFavourites();
  if (!listings.length)
    return (
      <EmptyState
        icon={Heart}
        title="No saved properties yet"
        description="Use the heart on any property to save it here."
        action={
          <ButtonLink href="/properties" variant="secondary">
            Browse properties
          </ButtonLink>
        }
      />
    );
  return <PropertyGrid listings={listings} />;
}
