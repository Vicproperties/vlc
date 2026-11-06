"use server";

import { randomUUID } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { CONTENT_TAG } from "@/features/listings/tags";
import { ACCEPTED_IMAGE_TYPES, reencodePhoto } from "@/lib/images";
import { richTextToPlain, sanitizeRichText } from "@/lib/rich-text";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { findSection, readContent, sectionSchema } from "./sections";

/** Website content (module "content"). Every change clears the public content cache. */
export interface ContentFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export interface Result {
  ok: boolean;
  message: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string, max = 100_000): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.slice(0, max) : "";
}

function errorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

function published() {
  updateTag(CONTENT_TAG);
  refresh();
}

// ---------------------------------------------------------------------------
// Page sections
// ---------------------------------------------------------------------------
export async function saveSectionAction(
  page: string,
  key: string,
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const def = findSection(page, key);
  if (!def) throw new Error("Unknown section.");
  await requireAdminPermission("content", "edit");

  const raw = Object.fromEntries(def.fields.map((field) => [field.key, text(formData, field.key)]));
  const parsed = sectionSchema(def).safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: errorsOf(parsed.error) };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("page_sections")
    .select("content")
    .eq("page_key", def.page)
    .eq("section_key", def.key)
    .maybeSingle();
  const stored = readContent(def, current?.content);

  const content: Record<string, string> = {};
  const uploaded: string[] = [];
  const replaced: string[] = [];
  for (const field of def.fields) {
    if (field.type === "image") {
      // The stored path comes from the database, never from the browser.
      const file = formData.get(field.key);
      const remove = formData.get(`${field.key}_remove`) === "on";
      if (file instanceof File && file.size > 0) {
        if (file.size > 3.5 * 1024 * 1024)
          return { status: "error", fieldErrors: { [field.key]: "This image is too large." } };
        if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
          return { status: "error", fieldErrors: { [field.key]: "Use a JPEG, PNG or WebP image." } };
        }
        const encoded = await reencodePhoto(file, 2400);
        if (!encoded)
          return { status: "error", fieldErrors: { [field.key]: "This file could not be read as an image." } };
        const path = `sections/${def.page}-${def.key}-${randomUUID()}.webp`;
        const upload = await supabase.storage
          .from("site-media")
          .upload(path, encoded.data, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
        if (upload.error) {
          console.error(`[content] section image upload failed: ${upload.error.message}`);
          if (uploaded.length) await supabase.storage.from("site-media").remove(uploaded);
          return { status: "error", message: "The image could not be stored. Please try again." };
        }
        uploaded.push(path);
        content[field.key] = path;
        if (stored[field.key]) replaced.push(stored[field.key]);
      } else if (remove) {
        if (stored[field.key]) replaced.push(stored[field.key]);
      } else if (stored[field.key]) {
        content[field.key] = stored[field.key];
      }
      continue;
    }
    let value = parsed.data[field.key] ?? "";
    if (field.type === "rich") {
      value = sanitizeRichText(value);
      if (richTextToPlain(value).length > field.max) {
        return { status: "error", fieldErrors: { [field.key]: `${field.label} is too long.` } };
      }
    }
    if (value) content[field.key] = value;
  }

  const { error } = await supabase.from("page_sections").upsert({
    page_key: def.page,
    section_key: def.key,
    content,
    is_visible: formData.get("is_visible") === "on",
  });
  if (error) {
    if (uploaded.length) await supabase.storage.from("site-media").remove(uploaded);
    return { status: "error", message: dbErrorMessage(error) };
  }
  if (replaced.length) await supabase.storage.from("site-media").remove(replaced);
  await supabase.rpc("log_activity", {
    p_action: "content.section_saved",
    p_entity_type: "page_section",
    p_entity_id: `${def.page}/${def.key}`,
  });
  published();
  return { status: "success", message: "Saved. The website is updated." };
}

// ---------------------------------------------------------------------------
// Simple lists: core values, why-choose-us reasons, FAQs
// ---------------------------------------------------------------------------
export type ListKind = "core_values" | "why_choose_us_items" | "faqs";
const LISTS: Record<ListKind, { a: string; b: string; aMax: number; bMax: number; aMin: number; bRequired: boolean }> =
  {
    core_values: { a: "title", b: "description", aMin: 2, aMax: 120, bMax: 1000, bRequired: false },
    why_choose_us_items: { a: "title", b: "description", aMin: 2, aMax: 120, bMax: 1000, bRequired: false },
    faqs: { a: "question", b: "answer", aMin: 5, aMax: 300, bMax: 5000, bRequired: true },
  };

function listConfig(kind: string) {
  if (!(kind in LISTS)) throw new Error("Unknown list.");
  return LISTS[kind as ListKind];
}

export async function saveListItemAction(
  kind: ListKind,
  id: string | null,
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const config = listConfig(kind);
  if (id !== null && !UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("content", id ? "edit" : "create");

  const a = text(formData, config.a, 2000).trim();
  const b = text(formData, config.b, 10_000).trim();
  const fieldErrors: Record<string, string> = {};
  if (a.length < config.aMin || a.length > config.aMax) {
    fieldErrors[config.a] = `Use ${config.aMin} to ${config.aMax} characters.`;
  }
  if (b.length > config.bMax) fieldErrors[config.b] = `Use ${config.bMax.toLocaleString("en-NG")} characters or fewer.`;
  if (config.bRequired && b.length < 2) fieldErrors[config.b] = "This is required.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  const supabase = await createClient();
  const values = { [config.a]: a, [config.b]: b || null };
  let error;
  if (id) {
    ({ error } = await supabase
      .from(kind)
      .update(values as never)
      .eq("id", id));
  } else {
    const { data: last } = await supabase
      .from(kind)
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    ({ error } = await supabase.from(kind).insert({ ...values, sort_order: (last?.sort_order ?? 0) + 10 } as never));
  }
  if (error) return { status: "error", message: dbErrorMessage(error) };
  await supabase.rpc("log_activity", {
    p_action: `content.${kind}_${id ? "updated" : "created"}`,
    p_entity_type: kind,
  });
  published();
  return { status: "success", message: id ? "Saved." : "Added." };
}

export async function setListItemActiveAction(kind: ListKind, id: string, active: boolean): Promise<Result> {
  listConfig(kind);
  if (!UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("content", "edit");
  const supabase = await createClient();
  const { error } = await supabase
    .from(kind)
    .update({ is_active: active } as never)
    .eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  published();
  return { ok: true, message: active ? "Shown on the website." : "Hidden from the website." };
}

export async function deleteListItemAction(kind: ListKind, id: string): Promise<Result> {
  listConfig(kind);
  if (!UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("content", "delete");
  const supabase = await createClient();
  const { error } = await supabase.from(kind).delete().eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  await supabase.rpc("log_activity", { p_action: `content.${kind}_deleted`, p_entity_type: kind, p_entity_id: id });
  published();
  return { ok: true, message: "Deleted." };
}

/** Saves a new order: `ids` is the complete list in display order. */
export async function reorderListAction(kind: ListKind | "team_members", ids: string[]): Promise<Result> {
  if (kind !== "team_members") listConfig(kind);
  if (ids.length > 200 || !ids.every((id) => UUID.test(id))) throw new Error("Invalid ids.");
  await requireAdminPermission("content", "edit");
  const supabase = await createClient();
  const results = await Promise.all(
    ids.map((id, index) =>
      supabase
        .from(kind)
        .update({ sort_order: (index + 1) * 10 } as never)
        .eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, message: dbErrorMessage(failed.error) };
  published();
  return { ok: true, message: "Order saved." };
}

// ---------------------------------------------------------------------------
// Team members
// ---------------------------------------------------------------------------
const SOCIAL_HOSTS: Record<string, RegExp> = {
  linkedin: /(^|\.)linkedin\.com$/,
  x: /(^|\.)(x|twitter)\.com$/,
  instagram: /(^|\.)instagram\.com$/,
  facebook: /(^|\.)facebook\.com$/,
};

/** HTTPS links to the expected network only. */
function parseSocialLink(network: string, value: string): string | null | false {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && SOCIAL_HOSTS[network]?.test(host) ? url.toString() : false;
  } catch {
    return false;
  }
}

export async function saveTeamMemberAction(
  id: string | null,
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  if (id !== null && !UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("content", id ? "edit" : "create");

  const name = text(formData, "name", 200).trim();
  const position = text(formData, "position", 200).trim();
  const department = text(formData, "department", 200).trim();
  const bio = text(formData, "bio", 4000).trim();
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2 || name.length > 120) fieldErrors.name = "Enter a name of 2 to 120 characters.";
  if (position.length > 120) fieldErrors.position = "Use 120 characters or fewer.";
  if (department.length > 120) fieldErrors.department = "Use 120 characters or fewer.";
  if (bio.length > 3000) fieldErrors.bio = "Use 3,000 characters or fewer.";

  const social: Record<string, string> = {};
  for (const network of Object.keys(SOCIAL_HOSTS)) {
    const link = parseSocialLink(network, text(formData, `social_${network}`, 500));
    if (link === false) fieldErrors[`social_${network}`] = "Paste the full https:// link to the profile.";
    else if (link) social[network] = link;
  }

  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto) {
    if (photo.size > 3.5 * 1024 * 1024) fieldErrors.photo = "This photo is too large.";
    else if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(photo.type))
      fieldErrors.photo = "Use a JPEG, PNG or WebP photo.";
  }
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  const supabase = await createClient();
  let photoPath: string | undefined;
  if (hasPhoto) {
    const encoded = await reencodePhoto(photo, 1000);
    if (!encoded) return { status: "error", fieldErrors: { photo: "This file could not be read as a photo." } };
    photoPath = `team/${randomUUID()}.webp`;
    const upload = await supabase.storage
      .from("site-media")
      .upload(photoPath, encoded.data, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
    if (upload.error) return { status: "error", message: "The photo could not be stored. Please try again." };
  }

  const values = {
    name,
    position: position || null,
    department: department || null,
    bio: bio || null,
    social_links: social,
    ...(photoPath ? { photo_path: photoPath } : {}),
  };

  let oldPhoto: string | null = null;
  let error;
  if (id) {
    if (photoPath) {
      const { data } = await supabase.from("team_members").select("photo_path").eq("id", id).maybeSingle();
      oldPhoto = data?.photo_path ?? null;
    }
    ({ error } = await supabase.from("team_members").update(values).eq("id", id));
  } else {
    const { data: last } = await supabase
      .from("team_members")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    ({ error } = await supabase.from("team_members").insert({ ...values, sort_order: (last?.sort_order ?? 0) + 10 }));
  }
  if (error) {
    if (photoPath) await supabase.storage.from("site-media").remove([photoPath]);
    return { status: "error", message: dbErrorMessage(error) };
  }
  if (oldPhoto) await supabase.storage.from("site-media").remove([oldPhoto]);

  await supabase.rpc("log_activity", {
    p_action: `content.team_member_${id ? "updated" : "created"}`,
    p_entity_type: "team_member",
    p_metadata: { name },
  });
  published();
  return { status: "success", message: id ? "Saved." : "Team member added." };
}

export async function setTeamMemberActiveAction(id: string, active: boolean): Promise<Result> {
  if (!UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("content", "edit");
  const supabase = await createClient();
  const { error } = await supabase.from("team_members").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  published();
  return { ok: true, message: active ? "Shown on the website." : "Hidden from the website." };
}

export async function deleteTeamMemberAction(id: string): Promise<Result> {
  if (!UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("content", "delete");
  const supabase = await createClient();
  const { data } = await supabase.from("team_members").select("photo_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (data?.photo_path) await supabase.storage.from("site-media").remove([data.photo_path]);
  await supabase.rpc("log_activity", {
    p_action: "content.team_member_deleted",
    p_entity_type: "team_member",
    p_entity_id: id,
  });
  published();
  return { ok: true, message: "Team member deleted." };
}

// ---------------------------------------------------------------------------
// Legal pages
// ---------------------------------------------------------------------------
const LEGAL_SLUGS = ["privacy-policy", "terms-and-conditions"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export async function saveLegalPageAction(
  slug: LegalSlug,
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  if (!LEGAL_SLUGS.includes(slug)) throw new Error("Unknown page.");
  await requireAdminPermission("content", "edit");

  const title = text(formData, "title", 300).trim();
  const html = sanitizeRichText(text(formData, "content_html", 300_000), { document: true });
  const publish = formData.get("is_published") === "on";
  const needsReview = formData.get("needs_legal_review") === "on";
  const fieldErrors: Record<string, string> = {};
  if (title.length < 3 || title.length > 150) fieldErrors.title = "Enter a title of 3 to 150 characters.";
  if (publish && richTextToPlain(html).length < 50) fieldErrors.content_html = "Write the page before publishing it.";
  if (html.length > 200_000) fieldErrors.content_html = "The page is too long.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("legal_pages")
    .select("content_html, version, needs_legal_review")
    .eq("slug", slug)
    .maybeSingle();
  const changed = (current?.content_html ?? "") !== html;
  const values = {
    slug,
    title,
    content_html: html || null,
    is_published: publish,
    needs_legal_review: needsReview,
    version: current ? current.version + (changed ? 1 : 0) : 1,
    // Unticking "needs legal review" records when the review was confirmed.
    ...(current?.needs_legal_review && !needsReview ? { last_reviewed_at: new Date().toISOString() } : {}),
  };
  const { error } = await supabase.from("legal_pages").upsert(values);
  if (error) return { status: "error", message: dbErrorMessage(error) };
  await supabase.rpc("log_activity", {
    p_action: "content.legal_page_saved",
    p_entity_type: "legal_page",
    p_entity_id: slug,
    p_metadata: { published: publish, needs_legal_review: needsReview, version: values.version },
  });
  published();
  return {
    status: "success",
    message: publish ? "Saved and published." : "Saved as a draft (not shown on the website).",
  };
}
