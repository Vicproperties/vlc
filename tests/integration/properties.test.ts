import { randomUUID } from "node:crypto";
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
 * Stage 5 database rules (migrations 0015, 0016) through the real Data API.
 *   editor   properties view/create/edit
 *   viewer   properties view only
 *   customer signed-in non-admin
 */
const service = serviceClient();
const propertyIds: string[] = [];
const storagePaths: string[] = [];
const importJobs: string[] = [];

let editor: TestUser;
let viewer: TestUser;
let customer: TestUser;

async function property(values: Record<string, unknown> = {}) {
  const { data, error } = await service
    .from("properties")
    .insert({ kind: "land", purpose: "sale", title: uniqueText("Plot"), ...values } as never)
    .select("id, title")
    .single();
  if (error) throw new Error(error.message);
  propertyIds.push(data.id);
  return data;
}

async function image(propertyId: string, order: number, isCover = false) {
  const path = `${propertyId}/${randomUUID()}.webp`;
  const { data, error } = await service
    .from("property_images")
    .insert({ property_id: propertyId, storage_path: path, sort_order: order, is_cover: isCover })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

beforeAll(async () => {
  [editor, viewer, customer] = await Promise.all([
    createUser("p-editor"),
    createUser("p-viewer"),
    createUser("p-customer"),
  ]);
  await Promise.all([
    makeAdmin(editor, {
      role: "sub_admin",
      verified: true,
      permissions: { properties: { can_view: true, can_create: true, can_edit: true } },
    }),
    makeAdmin(viewer, { role: "sub_admin", verified: true, permissions: { properties: { can_view: true } } }),
  ]);
});

afterAll(async () => {
  if (storagePaths.length) await service.storage.from("property-media").remove(storagePaths);
  if (importJobs.length) await service.from("import_jobs").delete().in("id", importJobs);
  await cleanup(propertyIds);
});

describe("state", () => {
  it("accepts only Nigerian states and the FCT", async () => {
    const bad = await service
      .from("properties")
      .insert({ kind: "land", title: uniqueText("Plot"), state: "Texas" } as never);
    expect(bad.error?.code).toBe("23514");
    const good = await property({ state: "Federal Capital Territory" });
    expect(good.id).toBeTruthy();
  });
});

describe("duplicate checks for imports", () => {
  it("find matches for admins who can create, and refuse everyone else", async () => {
    const existing = await property({ location_text: "Lekki Phase 1" });
    const rows = [
      { title: existing.title, location_text: "Lekki Phase 1" },
      { title: uniqueText("Unrelated"), location_text: "" },
    ];

    const ok = await editor.client.rpc("find_property_duplicates", { p_kind: "land", p_rows: rows });
    expect(ok.error).toBeNull();
    expect(ok.data).toEqual([{ idx: 1, id: existing.id, title: existing.title }]);

    for (const actor of [viewer, customer]) {
      const denied = await actor.client.rpc("find_property_duplicates", { p_kind: "land", p_rows: rows });
      expect(isDenied(denied.error)).toBe(true);
    }
    const anon = await anonClient().rpc("find_property_duplicates", { p_kind: "land", p_rows: rows });
    expect(anon.error).not.toBeNull();
  });

  it("refuses oversized batches", async () => {
    const rows = Array.from({ length: 1001 }, () => ({ title: "x" }));
    const { error } = await editor.client.rpc("find_property_duplicates", { p_kind: "land", p_rows: rows });
    expect(error?.code).toBe("22023");
  });
});

describe("photos", () => {
  it("cover and order changes need edit permission", async () => {
    const { id } = await property();
    const first = await image(id, 0, true);
    const second = await image(id, 1);

    // Viewer: runs with the caller's privileges, so RLS leaves the rows untouched.
    await viewer.client.rpc("set_property_cover", { p_property_id: id, p_image_id: second });
    let { data } = await service.from("property_images").select("id, is_cover").eq("property_id", id);
    expect(data?.find((row) => row.is_cover)?.id).toBe(first);

    const cover = await editor.client.rpc("set_property_cover", { p_property_id: id, p_image_id: second });
    expect(cover.error).toBeNull();
    ({ data } = await service.from("property_images").select("id, is_cover").eq("property_id", id));
    expect(data?.filter((row) => row.is_cover).map((row) => row.id)).toEqual([second]);

    const reorder = await editor.client.rpc("reorder_property_images", {
      p_property_id: id,
      p_image_ids: [second, first],
    });
    expect(reorder.error).toBeNull();
    const { data: ordered } = await service
      .from("property_images")
      .select("id")
      .eq("property_id", id)
      .order("sort_order");
    expect(ordered?.map((row) => row.id)).toEqual([second, first]);

    const stale = await editor.client.rpc("reorder_property_images", { p_property_id: id, p_image_ids: [first] });
    expect(stale.error?.message).toMatch(/out of date/);
  });

  it("are limited to 30 per property", async () => {
    const { id } = await property();
    const rows = Array.from({ length: 30 }, (_, i) => ({
      property_id: id,
      storage_path: `${id}/${randomUUID()}.webp`,
      sort_order: i,
    }));
    const { error } = await service.from("property_images").insert(rows);
    expect(error).toBeNull();
    await expect(image(id, 31)).rejects.toThrow(/at most 30 photos/);
  });

  it("storage accepts editor uploads with safe names only", async () => {
    const { id } = await property();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    );
    const path = `${id}/${randomUUID()}.webp`;
    const ok = await editor.client.storage.from("property-media").upload(path, png, { contentType: "image/webp" });
    expect(ok.error).toBeNull();
    storagePaths.push(path);

    const customerUpload = await customer.client.storage
      .from("property-media")
      .upload(`${id}/${randomUUID()}.webp`, png, { contentType: "image/webp" });
    expect(customerUpload.error).not.toBeNull();

    // Names outside [a-z0-9/_.-] are refused by the storage policy. ("../" segments are
    // normalised away by the Storage API before the policy runs, so they cannot escape.)
    const unsafe = await editor.client.storage
      .from("property-media")
      .upload(`${id}/Bad Name!.webp`, png, { contentType: "image/webp" });
    expect(unsafe.error).not.toBeNull();

    const svg = await editor.client.storage
      .from("property-media")
      .upload(`${id}/${randomUUID()}.svg`, Buffer.from("<svg/>"), { contentType: "image/svg+xml" });
    expect(svg.error).not.toBeNull();
  });
});

describe("public listing view", () => {
  it("exposes the formatted description of listed properties only", async () => {
    const html = "<p><strong>Dry</strong> land</p>";
    const published = await property({ status: "published", description_html: html, description: "Dry land" });
    const draft = await property({ description_html: html });

    const { data } = await anonClient()
      .from("property_listings")
      .select("id, description_html")
      .in("id", [published.id, draft.id]);
    expect(data).toEqual([{ id: published.id, description_html: html }]);
  });
});

describe("imports", () => {
  it("only admins who can create properties can record import jobs", async () => {
    const ok = await editor.client
      .from("import_jobs")
      .insert({ kind: "land", file_name: "test.csv" })
      .select("id")
      .single();
    expect(ok.error).toBeNull();
    if (ok.data) importJobs.push(ok.data.id);

    const denied = await viewer.client.from("import_jobs").insert({ kind: "land", file_name: "test.csv" });
    expect(isDenied(denied.error)).toBe(true);
  });
});
