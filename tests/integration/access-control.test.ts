import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  cleanup,
  createUser,
  isDenied,
  makeAdmin,
  serviceClient,
  uniqueText,
  type TestUser,
} from "./helpers";

/**
 * Access-control suite: proves the RLS policies, privileges and triggers through the real
 * Supabase Data API — the same surface an attacker would use.
 *
 * Actors
 *   anon         public visitor
 *   customer     signed-in non-admin
 *   unverified   super admin whose session has NOT passed OTP
 *   noPerms      verified sub-admin with no permissions
 *   editor       verified sub-admin: properties view/create/edit (no publish, no delete)
 *   publisher    verified sub-admin: properties view/create/edit/publish
 *   superAdmin   verified super admin
 */

const service = serviceClient();
const anon = anonClient();
const createdProperties: string[] = [];

let customer: TestUser;
let otherCustomer: TestUser;
let unverified: TestUser;
let noPerms: TestUser;
let editor: TestUser;
let publisher: TestUser;
let superAdmin: TestUser;

let publishedId: string;
let draftId: string;

async function serviceProperty(values: Record<string, unknown>) {
  const { data, error } = await service
    .from("properties")
    .insert({ kind: "land", title: uniqueText("Plot"), ...values } as never)
    .select("id, slug, status, discount_percent, effective_price, duplicate_state")
    .single();
  if (error) throw new Error(`service insert property: ${error.message}`);
  createdProperties.push(data.id);
  return data;
}

beforeAll(async () => {
  [customer, otherCustomer, unverified, noPerms, editor, publisher, superAdmin] = await Promise.all([
    createUser("customer"),
    createUser("customer2"),
    createUser("unverified"),
    createUser("noperms"),
    createUser("editor"),
    createUser("publisher"),
    createUser("super"),
  ]);

  await service.from("customer_profiles").insert([
    { id: customer.id, full_name: "Test Customer" },
    { id: otherCustomer.id, full_name: "Other Customer" },
  ]);

  await makeAdmin(superAdmin, { role: "super_admin", verified: true });
  await makeAdmin(unverified, { role: "super_admin", verified: false });
  await makeAdmin(noPerms, { role: "sub_admin", verified: true });
  await makeAdmin(editor, {
    role: "sub_admin",
    verified: true,
    permissions: { properties: { can_view: true, can_create: true, can_edit: true } },
  });
  await makeAdmin(publisher, {
    role: "sub_admin",
    verified: true,
    permissions: { properties: { can_view: true, can_create: true, can_edit: true, can_publish: true } },
  });

  publishedId = (await serviceProperty({ status: "published", location_text: uniqueText("Location") })).id;
  draftId = (await serviceProperty({ status: "draft" })).id;
}, 120_000);

afterAll(async () => {
  await cleanup(createdProperties);
}, 120_000);

// ---------------------------------------------------------------------------
describe("anonymous visitors", () => {
  it("see published listings through the public view, never drafts", async () => {
    const { data, error } = await anon.from("property_listings").select("id").in("id", [publishedId, draftId]);
    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).toEqual([publishedId]);
  });

  it("cannot read the properties base table, estates or admin tables", async () => {
    for (const table of [
      "properties",
      "estates",
      "admin_users",
      "admin_permissions",
      "activity_logs",
      "inspection_requests",
      "contact_submissions",
      "newsletter_subscribers",
      "customer_profiles",
    ] as const) {
      const { error } = await anon.from(table).select("*").limit(1);
      expect(isDenied(error), `anon select ${table}`).toBe(true);
    }
  });

  it("cannot submit enquiries directly (server-only writes)", async () => {
    const insp = await anon
      .from("inspection_requests")
      .insert({ property_id: publishedId, full_name: "X Y", phone: "+2348031234567" });
    expect(isDenied(insp.error)).toBe(true);
    const contact = await anon
      .from("contact_submissions")
      .insert({ name: "X Y", email: "x@example.com", message: "hello" });
    expect(isDenied(contact.error)).toBe(true);
    const news = await anon.from("newsletter_subscribers").insert({ email: "x@example.com" });
    expect(isDenied(news.error)).toBe(true);
  });

  it("cannot call service-only RPCs", async () => {
    const rate = await anon.rpc("check_rate_limit", { p_key: "x", p_limit: 5, p_window_seconds: 60 });
    expect(isDenied(rate.error)).toBe(true);
    const session = await anon.rpc("admin_session_mark_verified", { p_session_id: superAdmin.sessionId });
    expect(isDenied(session.error)).toBe(true);
    const log = await anon.rpc("log_activity_as", {
      p_actor_id: superAdmin.id,
      p_actor_type: "admin",
      p_action: "forged",
    });
    expect(isDenied(log.error)).toBe(true);
  });

  it("cannot reach the private schema", async () => {
    const { error } = await anon
      .schema("private" as never)
      .from("admin_sessions")
      .select("*");
    expect(error).not.toBeNull();
  });

  it("cannot upload files", async () => {
    const { error } = await anon.storage
      .from("property-media")
      .upload(`test/${Date.now()}.png`, new Blob(["x"], { type: "image/png" }));
    expect(error).not.toBeNull();
  });

  it("can read public content (site settings)", async () => {
    const { data, error } = await anon.from("site_settings").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
describe("customers", () => {
  it("get no rows from admin-managed tables", async () => {
    const props = await customer.client.from("properties").select("id").limit(5);
    expect(props.error).toBeNull();
    expect(props.data).toEqual([]);
    const insp = await customer.client.from("inspection_requests").select("id").limit(5);
    expect(insp.data ?? []).toEqual([]);
  });

  it("cannot create properties", async () => {
    const { error } = await customer.client.from("properties").insert({ kind: "land", title: uniqueText("Hack") });
    expect(isDenied(error)).toBe(true);
  });

  it("have no admin permissions and cannot write activity logs", async () => {
    const perms = await customer.client.rpc("my_admin_permissions");
    expect(perms.data ?? []).toEqual([]);
    const log = await customer.client.rpc("log_activity", { p_action: "forged.action" });
    expect(isDenied(log.error)).toBe(true);
  });

  it("can favourite listed properties only, and only for themselves", async () => {
    const ok = await customer.client.from("favourites").insert({ customer_id: customer.id, property_id: publishedId });
    expect(ok.error).toBeNull();
    const draft = await customer.client.from("favourites").insert({ customer_id: customer.id, property_id: draftId });
    expect(isDenied(draft.error)).toBe(true);
    const forged = await customer.client
      .from("favourites")
      .insert({ customer_id: otherCustomer.id, property_id: publishedId });
    expect(isDenied(forged.error)).toBe(true);
    const mine = await customer.client.from("favourites").select("property_id");
    expect(mine.data).toEqual([{ property_id: publishedId }]);
  });

  it("read and update only their own profile", async () => {
    const all = await customer.client.from("customer_profiles").select("id");
    expect(all.data?.map((r) => r.id)).toEqual([customer.id]);

    const other = await customer.client
      .from("customer_profiles")
      .update({ full_name: "Hacked" })
      .eq("id", otherCustomer.id)
      .select();
    expect(other.data ?? []).toEqual([]);

    const own = await customer.client
      .from("customer_profiles")
      .update({ full_name: "Updated Name" })
      .eq("id", customer.id)
      .select("full_name");
    expect(own.data).toEqual([{ full_name: "Updated Name" }]);
  });

  it("see only their own inspection requests, without admin notes", async () => {
    const mine = await service
      .from("inspection_requests")
      .insert({
        property_id: publishedId,
        customer_id: customer.id,
        full_name: "Test Customer",
        phone: "+2348031234567",
      })
      .select("id")
      .single();
    expect(mine.error).toBeNull();
    await service
      .from("inspection_requests")
      .insert({ property_id: publishedId, customer_id: otherCustomer.id, full_name: "Other", phone: "+2348031234568" });
    await service.from("inspection_requests").update({ admin_notes: "internal note" }).eq("id", mine.data!.id);

    const { data, error } = await customer.client.from("my_inspection_requests").select("*");
    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).toEqual([mine.data!.id]);
    expect(Object.keys(data![0])).not.toContain("admin_notes");
  });
});

// ---------------------------------------------------------------------------
describe("admin sessions", () => {
  it("an admin whose session has not passed OTP has no admin access", async () => {
    const read = await unverified.client.from("properties").select("id").limit(1);
    expect(read.data ?? []).toEqual([]);
    const write = await unverified.client.from("properties").insert({ kind: "land", title: uniqueText("Unverified") });
    expect(isDenied(write.error)).toBe(true);
    const perms = await unverified.client.rpc("my_admin_permissions");
    expect(perms.data ?? []).toEqual([]);
  });

  it("a verified sub-admin without permissions sees nothing", async () => {
    const read = await noPerms.client.from("properties").select("id").limit(1);
    expect(read.data ?? []).toEqual([]);
    const estates = await noPerms.client.from("estates").select("id").limit(1);
    expect(estates.data ?? []).toEqual([]);
  });

  it("revoking a session removes access immediately", async () => {
    const temp = await createUser("revoked");
    await makeAdmin(temp, { role: "sub_admin", verified: true, permissions: { properties: { can_view: true } } });
    const before = await temp.client.from("properties").select("id").eq("id", publishedId);
    expect(before.data).toHaveLength(1);

    await service.rpc("admin_session_revoke", { p_admin_id: temp.id });
    const after = await temp.client.from("properties").select("id").eq("id", publishedId);
    expect(after.data ?? []).toEqual([]);
  });

  it("deactivating an admin removes access immediately", async () => {
    const temp = await createUser("deactivated");
    await makeAdmin(temp, { role: "sub_admin", verified: true, permissions: { properties: { can_view: true } } });
    await service.from("admin_users").update({ is_active: false }).eq("id", temp.id);
    const after = await temp.client.from("properties").select("id").eq("id", publishedId);
    expect(after.data ?? []).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("privilege escalation", () => {
  it("sub-admins cannot grant themselves permissions or change their role", async () => {
    const perm = await editor.client
      .from("admin_permissions")
      .insert({ admin_id: editor.id, module: "admins", can_view: true });
    expect(isDenied(perm.error)).toBe(true);
    const upd = await editor.client.from("admin_permissions").update({ can_publish: true }).eq("admin_id", editor.id);
    expect(isDenied(upd.error)).toBe(true);
    const role = await editor.client.from("admin_users").update({ role: "super_admin" }).eq("id", editor.id);
    expect(isDenied(role.error)).toBe(true);
  });

  it("customers cannot make themselves admins", async () => {
    const { error } = await customer.client
      .from("admin_users")
      .insert({ id: customer.id, email: customer.email, full_name: "Hacker", role: "super_admin" });
    expect(isDenied(error)).toBe(true);
  });

  it("sub-admins cannot verify their own session", async () => {
    const { error } = await unverified.client.rpc("admin_session_mark_verified", {
      p_session_id: unverified.sessionId,
    });
    expect(isDenied(error)).toBe(true);
  });

  it("the last active super admin cannot be demoted, even by the service role", async () => {
    // superAdmin and unverified are both super admins; deactivate one, then try the last.
    const first = await service.from("admin_users").update({ is_active: false }).eq("id", unverified.id);
    expect(first.error).toBeNull();
    const last = await service.from("admin_users").update({ role: "sub_admin" }).eq("id", superAdmin.id);
    expect(last.error?.message).toMatch(/last active super admin/i);
    await service.from("admin_users").update({ is_active: true }).eq("id", unverified.id);
  });
});

// ---------------------------------------------------------------------------
describe("property editing and publishing", () => {
  it("editors create drafts; audit columns cannot be forged", async () => {
    const { data, error } = await editor.client
      .from("properties")
      .insert({ kind: "land", title: uniqueText("Editor plot"), created_by: superAdmin.id, duplicate_state: "cleared" })
      .select("id, created_by, duplicate_state, status")
      .single();
    expect(error).toBeNull();
    createdProperties.push(data!.id);
    expect(data!.created_by).toBe(editor.id);
    expect(data!.duplicate_state).toBe("none");
    expect(data!.status).toBe("draft");
  });

  it("editors cannot publish or delete", async () => {
    const pub = await editor.client.from("properties").update({ status: "published" }).eq("id", draftId);
    expect(isDenied(pub.error)).toBe(true);
    const del = await editor.client.from("properties").delete().eq("id", draftId).select();
    expect(del.data ?? []).toEqual([]);
    const still = await service.from("properties").select("status").eq("id", draftId).single();
    expect(still.data?.status).toBe("draft");
  });

  it("publishers can publish; published_at and an activity log entry are recorded", async () => {
    const prop = await serviceProperty({ status: "draft" });
    const { data, error } = await publisher.client
      .from("properties")
      .update({ status: "published" })
      .eq("id", prop.id)
      .select("status, published_at")
      .single();
    expect(error).toBeNull();
    expect(data!.status).toBe("published");
    expect(data!.published_at).not.toBeNull();

    const log = await service
      .from("activity_logs")
      .select("actor_id, action")
      .eq("entity_id", prop.id)
      .eq("action", "property.status_changed");
    expect(log.data).toEqual([{ actor_id: publisher.id, action: "property.status_changed" }]);
  });

  it("possible duplicates are flagged and blocked until a publisher clears them", async () => {
    const title = uniqueText("Lekki Gardens Plot");
    const location = uniqueText("Lekki Phase 1");
    await serviceProperty({ title, location_text: location, land_size: 600, land_size_unit: "sqm" });

    const dup = await editor.client
      .from("properties")
      .insert({ kind: "land", title: `${title} `, location_text: location, land_size: 600, land_size_unit: "sqm" })
      .select("id, duplicate_state, duplicate_of")
      .single();
    expect(dup.error).toBeNull();
    createdProperties.push(dup.data!.id);
    expect(dup.data!.duplicate_state).toBe("flagged");

    const blocked = await publisher.client.from("properties").update({ status: "published" }).eq("id", dup.data!.id);
    expect(blocked.error?.message).toMatch(/duplicate/i);

    // Editors cannot clear the flag: their change is silently reverted.
    await editor.client.from("properties").update({ duplicate_state: "cleared" }).eq("id", dup.data!.id);
    const stillFlagged = await service.from("properties").select("duplicate_state").eq("id", dup.data!.id).single();
    expect(stillFlagged.data?.duplicate_state).toBe("flagged");

    // Nobody can reset the flag to 'none' to sneak past review.
    await publisher.client.from("properties").update({ duplicate_state: "none" }).eq("id", dup.data!.id);
    const notReset = await service.from("properties").select("duplicate_state").eq("id", dup.data!.id).single();
    expect(notReset.data?.duplicate_state).toBe("flagged");

    const cleared = await publisher.client
      .from("properties")
      .update({ duplicate_state: "cleared" })
      .eq("id", dup.data!.id)
      .select("duplicate_state, duplicate_reviewed_by")
      .single();
    expect(cleared.data).toEqual({ duplicate_state: "cleared", duplicate_reviewed_by: publisher.id });

    const published = await publisher.client.from("properties").update({ status: "published" }).eq("id", dup.data!.id);
    expect(published.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("database business rules", () => {
  it("computes discount and effective price; never trusts the client", async () => {
    const promo = await serviceProperty({ regular_price: 30_000_000, sales_price: 25_500_000, promotion_active: true });
    expect(promo.discount_percent).toBe(15);
    expect(Number(promo.effective_price)).toBe(25_500_000);

    const inactive = await serviceProperty({
      regular_price: 30_000_000,
      sales_price: 25_500_000,
      promotion_active: false,
    });
    expect(inactive.discount_percent).toBeNull();

    const invalid = await serviceProperty({
      regular_price: 20_000_000,
      sales_price: 25_000_000,
      promotion_active: true,
    });
    expect(invalid.discount_percent).toBeNull();
  });

  it("rejects building fields on land, price periods on sales and size without a unit", async () => {
    const bedrooms = await service.from("properties").insert({ kind: "land", title: uniqueText("Bad"), bedrooms: 3 });
    expect(bedrooms.error?.message).toMatch(/building_fields_only_for_buildings/);
    const period = await service
      .from("properties")
      .insert({ kind: "land", title: uniqueText("Bad"), purpose: "sale", price_period: "per_year" });
    expect(period.error?.message).toMatch(/price_period_purpose/);
    const unit = await service.from("properties").insert({ kind: "land", title: uniqueText("Bad"), land_size: 500 });
    expect(unit.error?.message).toMatch(/land_size_pair/);
  });

  it("generates unique slugs", async () => {
    const title = uniqueText("Same Title");
    const a = await serviceProperty({ title, location_text: uniqueText("A") });
    const b = await service.from("properties").insert({ kind: "building", title }).select("id, slug").single();
    createdProperties.push(b.data!.id);
    expect(b.data!.slug).not.toBe(a.slug);
    expect(b.data!.slug.startsWith(a.slug)).toBe(true);
  });

  it("attaches the property snapshot itself and ignores forged inspection fields", async () => {
    const { data, error } = await service
      .from("inspection_requests")
      .insert({
        property_id: publishedId,
        full_name: "Snapshot Test",
        phone: "+2348031234567",
        status: "confirmed",
        admin_notes: "forged",
        property_snapshot: { title: "Forged title" },
      })
      .select("status, admin_notes, property_snapshot")
      .single();
    expect(error).toBeNull();
    expect(data!.status).toBe("pending");
    expect(data!.admin_notes).toBeNull();
    expect((data!.property_snapshot as { id: string }).id).toBe(publishedId);
  });

  it("refuses inspection requests for unlisted properties", async () => {
    const { error } = await service
      .from("inspection_requests")
      .insert({ property_id: draftId, full_name: "Draft Test", phone: "+2348031234567" });
    expect(error?.message).toMatch(/not available/i);
  });

  it("activity logs are append-only, even for the service role", async () => {
    const { data } = await service.from("activity_logs").select("id").limit(1).single();
    const upd = await service.from("activity_logs").update({ action: "tampered" }).eq("id", data!.id);
    expect(upd.error?.message).toMatch(/append-only/i);
    const del = await service.from("activity_logs").delete().eq("id", data!.id);
    expect(del.error?.message).toMatch(/append-only/i);
  });

  it("rate limiter allows up to the limit then refuses", async () => {
    const key = `test:${uniqueText("rl")}`;
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const { data } = await service.rpc("check_rate_limit", { p_key: key, p_limit: 3, p_window_seconds: 60 });
      results.push(data as boolean);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});

// ---------------------------------------------------------------------------
describe("super admins", () => {
  it("can read every admin area", async () => {
    for (const table of [
      "properties",
      "estates",
      "admin_users",
      "activity_logs",
      "security_events",
      "inspection_requests",
    ] as const) {
      const { error } = await superAdmin.client.from(table).select("*").limit(1);
      expect(error, `super admin select ${table}`).toBeNull();
    }
    const perms = await superAdmin.client.rpc("my_admin_permissions");
    expect(perms.data?.length).toBeGreaterThan(10);
    expect(perms.data?.every((p) => p.can_publish && p.is_super_admin)).toBe(true);
  });
});
