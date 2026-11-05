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
 * Stage 7: inspection requests and contact messages (migrations 0004, 0008, 0017).
 *   coordinator  inspections view + edit
 *   viewer       inspections view only
 *   inbox        enquiries view + edit (contact messages only)
 */
const service = serviceClient();
const propertyIds: string[] = [];
const messageIds: string[] = [];
let coordinator: TestUser;
let viewer: TestUser;
let inbox: TestUser;
let customer: TestUser;
let publishedId: string;
let draftId: string;

async function property(status: "published" | "draft") {
  const { data, error } = await service
    .from("properties")
    .insert({ kind: "land", purpose: "sale", title: uniqueText("Inspect Plot"), status } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  propertyIds.push(data.id);
  return data.id;
}

async function request(values: Record<string, unknown> = {}) {
  const { data, error } = await service
    .from("inspection_requests")
    .insert({
      property_id: publishedId,
      full_name: "Ada Obi",
      phone: "+2348031234567",
      consent_at: new Date().toISOString(),
      ...values,
    } as never)
    .select("id, status, property_snapshot, consent_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

beforeAll(async () => {
  [coordinator, viewer, inbox, customer] = await Promise.all([
    createUser("enq-coord"),
    createUser("enq-viewer"),
    createUser("enq-inbox"),
    createUser("enq-customer"),
  ]);
  await Promise.all([
    makeAdmin(coordinator, {
      role: "sub_admin",
      verified: true,
      permissions: { inspections: { can_view: true, can_edit: true } },
    }),
    makeAdmin(viewer, { role: "sub_admin", verified: true, permissions: { inspections: { can_view: true } } }),
    makeAdmin(inbox, {
      role: "sub_admin",
      verified: true,
      permissions: { enquiries: { can_view: true, can_edit: true } },
    }),
  ]);
  publishedId = await property("published");
  draftId = await property("draft");
});

afterAll(async () => {
  if (messageIds.length) await service.from("contact_submissions").delete().in("id", messageIds);
  await cleanup(propertyIds);
});

describe("public submissions", () => {
  it("cannot be written directly through the public API", async () => {
    const insp = await anonClient()
      .from("inspection_requests")
      .insert({ property_id: publishedId, full_name: "Bot", phone: "+2348031234567" });
    expect(isDenied(insp.error)).toBe(true);
    const contact = await anonClient()
      .from("contact_submissions")
      .insert({ name: "Bot", email: "bot@example.com", message: "spam" });
    expect(isDenied(contact.error)).toBe(true);
  });

  it("get the property snapshot from the database and always start pending", async () => {
    const created = await request({ status: "completed", property_snapshot: { title: "Forged" } });
    expect(created.status).toBe("pending");
    expect((created.property_snapshot as { id: string }).id).toBe(publishedId);
    expect(created.consent_at).not.toBeNull();
  });

  it("are refused for unlisted properties", async () => {
    await expect(request({ property_id: draftId })).rejects.toThrow(/not available/i);
  });
});

describe("inspection workflow", () => {
  it("coordinators change status with a note recorded in the history", async () => {
    const { id } = await request();
    const { data, error } = await coordinator.client.rpc("change_inspection_status", {
      p_request_id: id,
      p_status: "confirmed",
      p_note: "Saturday 10am",
    });
    expect(error).toBeNull();
    expect(data).toBe("confirmed");

    const { data: history } = await service
      .from("inspection_status_history")
      .select("from_status, to_status, changed_by, note")
      .eq("request_id", id)
      .order("created_at");
    expect(history).toEqual([
      { from_status: null, to_status: "pending", changed_by: null, note: null },
      { from_status: "pending", to_status: "confirmed", changed_by: coordinator.id, note: "Saturday 10am" },
    ]);
  });

  it("view-only admins and customers cannot change status", async () => {
    const { id } = await request();
    const asViewer = await viewer.client.rpc("change_inspection_status", { p_request_id: id, p_status: "cancelled" });
    expect(asViewer.error?.code).toBe("P0002");
    const asCustomer = await customer.client.rpc("change_inspection_status", {
      p_request_id: id,
      p_status: "cancelled",
    });
    expect(asCustomer.error).not.toBeNull();
    const { data } = await service.from("inspection_requests").select("status").eq("id", id).single();
    expect(data?.status).toBe("pending");
  });

  it("the visitor's details cannot be edited afterwards", async () => {
    const { id } = await request();
    await coordinator.client
      .from("inspection_requests")
      .update({ full_name: "Changed", phone: "+2348000000000", admin_notes: "Called back" })
      .eq("id", id);
    const { data } = await service
      .from("inspection_requests")
      .select("full_name, phone, admin_notes")
      .eq("id", id)
      .single();
    expect(data).toEqual({ full_name: "Ada Obi", phone: "+2348031234567", admin_notes: "Called back" });
  });

  it("customers cannot read requests; contact-only admins cannot see inspections", async () => {
    await request();
    for (const actor of [customer, inbox]) {
      const { data } = await actor.client.from("inspection_requests").select("id").eq("property_id", publishedId);
      expect(data ?? []).toEqual([]);
    }
  });
});

describe("contact messages", () => {
  it("are visible only to admins with the enquiries permission, who can triage them", async () => {
    const { data: created } = await service
      .from("contact_submissions")
      .insert({
        name: "Ada",
        email: "ada@example.com",
        message: uniqueText("Hello"),
        consent_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    messageIds.push(created!.id);

    const hidden = await coordinator.client.from("contact_submissions").select("id").eq("id", created!.id);
    expect(hidden.data ?? []).toEqual([]);

    const update = await inbox.client
      .from("contact_submissions")
      .update({ is_read: true, message: "tampered" })
      .eq("id", created!.id)
      .select("is_read, message, handled_by")
      .single();
    expect(update.error).toBeNull();
    expect(update.data?.is_read).toBe(true);
    expect(update.data?.message).not.toBe("tampered");
    expect(update.data?.handled_by).toBe(inbox.id);
  });
});
