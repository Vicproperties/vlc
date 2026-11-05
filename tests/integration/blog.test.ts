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
 * Stage 9 blog rules (migrations 0005, 0008, 0019).
 *   writer     blog view/create/edit (no publish)
 *   publisher  blog view/create/edit/publish
 */
const service = serviceClient();
const postIds: string[] = [];
const storagePaths: string[] = [];
let writer: TestUser;
let publisher: TestUser;
let customer: TestUser;

async function post(values: Record<string, unknown>) {
  const { data, error } = await service
    .from("blog_posts")
    .insert({ title: uniqueText("Blog test"), ...values } as never)
    .select("id, slug, status")
    .single();
  if (error) throw new Error(error.message);
  postIds.push(data.id);
  return data;
}

beforeAll(async () => {
  [writer, publisher, customer] = await Promise.all([
    createUser("b-writer"),
    createUser("b-publisher"),
    createUser("b-customer"),
  ]);
  await Promise.all([
    makeAdmin(writer, {
      role: "sub_admin",
      verified: true,
      permissions: { blog: { can_view: true, can_create: true, can_edit: true } },
    }),
    makeAdmin(publisher, {
      role: "sub_admin",
      verified: true,
      permissions: { blog: { can_view: true, can_create: true, can_edit: true, can_publish: true } },
    }),
  ]);
});

afterAll(async () => {
  if (storagePaths.length) await service.storage.from("blog-media").remove(storagePaths);
  if (postIds.length) await service.from("blog_posts").delete().in("id", postIds);
  await cleanup([]);
});

describe("publishing", () => {
  it("writers save drafts but cannot publish; publishers can", async () => {
    const title = uniqueText("Writer draft");
    const draft = await writer.client.from("blog_posts").insert({ title }).select("id, status").single();
    expect(draft.error).toBeNull();
    postIds.push(draft.data!.id);
    expect(draft.data!.status).toBe("draft");

    const publishAttempt = await writer.client
      .from("blog_posts")
      .update({ status: "published" })
      .eq("id", draft.data!.id);
    expect(isDenied(publishAttempt.error)).toBe(true);

    const published = await publisher.client
      .from("blog_posts")
      .update({ status: "published" })
      .eq("id", draft.data!.id)
      .select("status, published_at")
      .single();
    expect(published.data?.status).toBe("published");
    expect(published.data?.published_at).not.toBeNull();
  });

  it("the public sees published articles only, never drafts or future-dated ones", async () => {
    const live = await post({ status: "published" });
    const draft = await post({});
    const future = await post({ status: "published", published_at: new Date(Date.now() + 86_400_000).toISOString() });
    const { data } = await anonClient().from("blog_posts").select("id").in("id", [live.id, draft.id, future.id]);
    expect(data).toEqual([{ id: live.id }]);
  });
});

describe("slugs, featured article and search", () => {
  it("duplicate titles get unique web addresses", async () => {
    const title = uniqueText("Same title");
    const a = await post({ title });
    const b = await post({ title });
    expect(b.slug).toBe(`${a.slug}-2`);
  });

  it("only one article can be featured at a time", async () => {
    await service.from("blog_posts").update({ is_featured: false }).eq("is_featured", true).in("id", postIds);
    const { data: current } = await service.from("blog_posts").select("id").eq("is_featured", true).maybeSingle();
    const a = await post({ is_featured: !current });
    if (!current) {
      const second = await service
        .from("blog_posts")
        .insert({ title: uniqueText("Second featured"), is_featured: true });
      expect(second.error?.code).toBe("23505");
      await service.from("blog_posts").update({ is_featured: false }).eq("id", a.id);
    } else {
      const second = await service
        .from("blog_posts")
        .insert({ title: uniqueText("Second featured"), is_featured: true });
      expect(second.error?.code).toBe("23505");
    }
  });

  it("search covers the article body", async () => {
    const word = `zebracrossing${randomUUID().slice(0, 6)}`;
    const p = await post({ status: "published", content_text: `This guide mentions ${word} once.` });
    const { data } = await anonClient()
      .from("blog_posts")
      .select("id")
      .textSearch("search_vector", word, { type: "websearch", config: "english" });
    expect(data).toEqual([{ id: p.id }]);
  });
});

describe("blog images", () => {
  it("writers can upload and delete blog images; customers cannot", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    );
    const path = `articles/${randomUUID()}.webp`;
    const up = await writer.client.storage.from("blog-media").upload(path, png, { contentType: "image/webp" });
    expect(up.error).toBeNull();
    storagePaths.push(path);
    const denied = await customer.client.storage
      .from("blog-media")
      .upload(`articles/${randomUUID()}.webp`, png, { contentType: "image/webp" });
    expect(denied.error).not.toBeNull();
    const removed = await writer.client.storage.from("blog-media").remove([path]);
    expect(removed.data?.map((f) => f.name)).toEqual([path]);
    storagePaths.splice(storagePaths.indexOf(path), 1);
  });
});
