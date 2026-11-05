import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  cleanup,
  createUser,
  isDenied,
  makeAdmin,
  RUN_ID,
  serviceClient,
  uniqueText,
  type TestUser,
} from "./helpers";

/**
 * Stage 8: website content permissions. Uses test-only rows (a section key and FAQs unique to
 * this run) and restores the shared settings row afterwards, so real content is never changed.
 *   editor    content view/create/edit
 *   viewer    content view only
 *   settings  settings view/edit only
 */
const service = serviceClient();
const sectionKey = `rlstest_${RUN_ID}`.toLowerCase().slice(0, 40);
const faqIds: string[] = [];
const storagePaths: string[] = [];
let originalTagline: string | null = null;
let editor: TestUser;
let viewer: TestUser;
let settingsAdmin: TestUser;
let customer: TestUser;

beforeAll(async () => {
  [editor, viewer, settingsAdmin, customer] = await Promise.all([
    createUser("c-editor"),
    createUser("c-viewer"),
    createUser("c-settings"),
    createUser("c-customer"),
  ]);
  await Promise.all([
    makeAdmin(editor, {
      role: "sub_admin",
      verified: true,
      permissions: { content: { can_view: true, can_create: true, can_edit: true } },
    }),
    makeAdmin(viewer, { role: "sub_admin", verified: true, permissions: { content: { can_view: true } } }),
    makeAdmin(settingsAdmin, {
      role: "sub_admin",
      verified: true,
      permissions: { settings: { can_view: true, can_edit: true } },
    }),
  ]);
  const { data } = await service.from("site_settings").select("tagline").eq("id", 1).single();
  originalTagline = data?.tagline ?? null;
});

afterAll(async () => {
  await service.from("site_settings").update({ tagline: originalTagline }).eq("id", 1);
  await service.from("page_sections").delete().eq("page_key", "blog").eq("section_key", sectionKey);
  if (faqIds.length) await service.from("faqs").delete().in("id", faqIds);
  if (storagePaths.length) await service.storage.from("site-media").remove(storagePaths);
  await cleanup([]);
});

describe("page sections", () => {
  it("content editors save sections; viewers and customers cannot", async () => {
    const ok = await editor.client
      .from("page_sections")
      .upsert({ page_key: "blog", section_key: sectionKey, content: { heading: "Test" }, is_visible: false });
    expect(ok.error).toBeNull();
    for (const actor of [viewer, customer]) {
      const denied = await actor.client
        .from("page_sections")
        .upsert({ page_key: "blog", section_key: sectionKey, content: { heading: "Hacked" }, is_visible: true });
      expect(denied.error).not.toBeNull();
    }
    const { data } = await service
      .from("page_sections")
      .select("content, is_visible")
      .eq("section_key", sectionKey)
      .single();
    expect(data).toEqual({ content: { heading: "Test" }, is_visible: false });
  });

  it("hidden sections are not public; visible ones are", async () => {
    const hidden = await anonClient().from("page_sections").select("section_key").eq("section_key", sectionKey);
    expect(hidden.data).toEqual([]);
    await editor.client
      .from("page_sections")
      .update({ is_visible: true })
      .eq("page_key", "blog")
      .eq("section_key", sectionKey);
    const visible = await anonClient().from("page_sections").select("section_key").eq("section_key", sectionKey);
    expect(visible.data).toEqual([{ section_key: sectionKey }]);
  });
});

describe("FAQs and lists", () => {
  it("only active items are public; only editors can add them", async () => {
    const question = uniqueText("Do you offer instalment plans");
    const added = await editor.client
      .from("faqs")
      .insert({ question, answer: "Test answer", is_active: false })
      .select("id")
      .single();
    expect(added.error).toBeNull();
    faqIds.push(added.data!.id);

    const hidden = await anonClient().from("faqs").select("id").eq("id", added.data!.id);
    expect(hidden.data).toEqual([]);
    await editor.client.from("faqs").update({ is_active: true }).eq("id", added.data!.id);
    const shown = await anonClient().from("faqs").select("question").eq("id", added.data!.id);
    expect(shown.data).toEqual([{ question }]);

    const denied = await viewer.client.from("faqs").insert({ question: uniqueText("Viewer question"), answer: "No" });
    expect(isDenied(denied.error)).toBe(true);
  });
});

describe("website settings", () => {
  it("only admins with the settings permission can change them", async () => {
    const tagline = `Test tagline ${RUN_ID}`;
    const asContent = await editor.client.from("site_settings").update({ tagline }).eq("id", 1).select("tagline");
    expect(asContent.data ?? []).toEqual([]);
    const asSettings = await settingsAdmin.client
      .from("site_settings")
      .update({ tagline })
      .eq("id", 1)
      .select("tagline")
      .single();
    expect(asSettings.data?.tagline).toBe(tagline);
  });

  it("phone numbers must be in international format", async () => {
    const { error } = await settingsAdmin.client
      .from("site_settings")
      .update({ phone_secondary: "0803 123 4567" })
      .eq("id", 1);
    expect(error?.code).toBe("23514");
  });
});

describe("site media", () => {
  it("content editors can upload team photos; customers cannot", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    );
    const path = `team/${randomUUID()}.webp`;
    const ok = await editor.client.storage.from("site-media").upload(path, png, { contentType: "image/webp" });
    expect(ok.error).toBeNull();
    storagePaths.push(path);
    // Editors can also delete website images (migration 0018); customers cannot even list them.
    const listedByCustomer = await customer.client.storage.from("site-media").list("team");
    expect((listedByCustomer.data ?? []).some((file) => path.endsWith(file.name))).toBe(false);
    const removed = await editor.client.storage.from("site-media").remove([path]);
    expect(removed.error).toBeNull();
    expect(removed.data?.map((file) => file.name)).toEqual([path]);
    storagePaths.splice(storagePaths.indexOf(path), 1);

    const denied = await customer.client.storage
      .from("site-media")
      .upload(`team/${randomUUID()}.webp`, png, { contentType: "image/webp" });
    expect(denied.error).not.toBeNull();
  });
});
