import "server-only";
import { CARD_COLUMNS, type ListingCardData } from "@/features/listings/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Account-page reads. All use the visitor's own session (RLS): favourites are limited to the
 * signed-in customer, and properties come from the public read model, so a saved property that
 * is later unpublished or deleted simply drops out of the list.
 */
export async function getMyFavourites(): Promise<ListingCardData[]> {
  const supabase = await createClient();
  const { data: favs, error } = await supabase
    .from("favourites")
    .select("property_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load favourites.");
  if (!favs?.length) return [];
  const { data: rows, error: listError } = await supabase
    .from("property_listings")
    .select(CARD_COLUMNS)
    .in(
      "id",
      favs.map((f) => f.property_id),
    );
  if (listError) throw new Error("Unable to load favourites.");
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  return favs.map((f) => byId.get(f.property_id)).filter((r): r is ListingCardData => Boolean(r));
}

export interface MyInspectionRequest {
  id: string;
  title: string;
  path: string | null;
  location: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  createdAt: string;
}

export async function getMyInspectionRequests(): Promise<MyInspectionRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("my_inspection_requests")
    .select("id, property_snapshot, preferred_date, preferred_time, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Unable to load inspection requests.");
  return (data ?? []).flatMap((r) => {
    if (!r.id || !r.status || !r.created_at) return [];
    const snap = (r.property_snapshot ?? {}) as { title?: string; path?: string; location?: string | null };
    return [
      {
        id: r.id,
        title: snap.title ?? "Property",
        path: typeof snap.path === "string" && snap.path.startsWith("/properties/") ? snap.path : null,
        location: snap.location ?? null,
        preferredDate: r.preferred_date,
        preferredTime: r.preferred_time,
        status: r.status,
        createdAt: r.created_at,
      },
    ];
  });
}
