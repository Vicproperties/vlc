"use server";

import { randomUUID } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import mammoth from "mammoth";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { articleImagePaths, sanitizeArticleHtml } from "@/lib/article-html";
import { ACCEPTED_IMAGE_TYPES, publicStorageUrl, reencodePhoto } from "@/lib/images";
import { richTextToPlain } from "@/lib/rich-text";
import { slugify } from "@/lib/slug";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { BLOG_TAG } from "./tags";

/** Blog management (module "blog"). Publishing needs blog:publish (checked here and by the database). */
export interface BlogFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export interface Result {
  ok: boolean;
  message: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_UPLOAD = 3.5 * 1024 * 1024;

function text(formData: FormData, key: string, max = 10_000): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.slice(0, max).trim() : "";
}

function optionalId(value: string): string | null {
  return UUID.test(value) ? value : null;
}

function changed() {
  updateTag(BLOG_TAG);
  refresh();
}

async function storeImage(file: File, folder: string, maxEdge: number) {
  if (file.size > MAX_UPLOAD) return { error: "This image is too large." } as const;
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type))
    return { error: "Use a JPEG, PNG or WebP image." } as const;
  const encoded = await reencodePhoto(file, maxEdge);
  if (!encoded) return { error: "This file could not be read as an image." } as const;
  const supabase = await createClient();
  const path = `${folder}/${randomUUID()}.webp`;
  const upload = await supabase.storage
    .from("blog-media")
    .upload(path, encoded.data, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
  if (upload.error) return { error: "The image could not be stored. Please try again." } as const;
  return { path, width: encoded.width, height: encoded.height } as const;
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------
export async function saveArticleAction(
  id: string | null,
  _prev: BlogFormState,
  formData: FormData,
): Promise<BlogFormState> {
  if (id !== null && !UUID.test(id)) throw new Error("Invalid id.");
  const admin = await requireAdminPermission("blog", id ? "edit" : "create");
  const intent = text(formData, "intent", 20);
  const wantsPublish = intent === "publish";
  const wantsUnpublish = intent === "unpublish";
  const canPublish = admin.isSuperAdmin || admin.permissions.blog?.publish === true;
  if ((wantsPublish || wantsUnpublish) && !canPublish) {
    return { status: "error", message: "You do not have permission to publish or unpublish articles." };
  }

  const title = text(formData, "title", 300);
  const slugInput = text(formData, "slug", 200);
  const excerpt = text(formData, "excerpt", 1000);
  const seoTitle = text(formData, "seo_title", 300);
  const seoDescription = text(formData, "seo_description", 600);
  const imageAlt = text(formData, "featured_image_alt", 600);
  const html = sanitizeArticleHtml(text(formData, "content_html", 2_000_000));
  const plain = richTextToPlain(html);
  let contentJson: unknown = { type: "doc", content: [] };
  try {
    contentJson = JSON.parse(text(formData, "content_json", 2_000_000) || "{}");
  } catch {
    return { status: "error", message: "The article content could not be read. Please try again." };
  }

  const fieldErrors: Record<string, string> = {};
  if (title.length < 3 || title.length > 200) fieldErrors.title = "Enter a title of 3 to 200 characters.";
  const slug = slugInput ? slugify(slugInput, 100) : "";
  if (slugInput && !slug) fieldErrors.slug = "Use letters and numbers in the web address.";
  if (excerpt.length > 500) fieldErrors.excerpt = "Use 500 characters or fewer.";
  if (seoTitle.length > 120) fieldErrors.seo_title = "Use 120 characters or fewer.";
  if (seoDescription.length > 320) fieldErrors.seo_description = "Use 320 characters or fewer.";
  if (imageAlt.length > 300) fieldErrors.featured_image_alt = "Use 300 characters or fewer.";
  if (wantsPublish && plain.length < 50) fieldErrors.content_html = "Write the article before publishing it.";
  if (Object.keys(fieldErrors).length)
    return { status: "error", fieldErrors, message: "Check the highlighted fields." };

  const supabase = await createClient();
  const { data: current } = id
    ? await supabase.from("blog_posts").select("featured_image_path, status, is_featured").eq("id", id).maybeSingle()
    : { data: null };
  if (id && !current) return { status: "error", message: "This article no longer exists." };

  // Featured image
  let featuredPath = current?.featured_image_path ?? null;
  const replaced: string[] = [];
  const image = formData.get("featured_image");
  if (image instanceof File && image.size > 0) {
    const stored = await storeImage(image, "featured", 2000);
    if ("error" in stored) return { status: "error", fieldErrors: { featured_image: stored.error ?? "" } };
    if (featuredPath) replaced.push(featuredPath);
    featuredPath = stored.path;
  } else if (formData.get("featured_image_remove") === "on" && featuredPath) {
    replaced.push(featuredPath);
    featuredPath = null;
  }

  const wantsFeatured = formData.get("is_featured") === "on";
  const values = {
    title,
    ...(slug ? { slug } : {}),
    excerpt: excerpt || null,
    category_id: optionalId(text(formData, "category_id", 64)),
    author_id: optionalId(text(formData, "author_id", 64)),
    content_json: contentJson as never,
    content_html: html || null,
    content_text: plain || null,
    seo_title: seoTitle || null,
    seo_description: seoDescription || null,
    featured_image_path: featuredPath,
    featured_image_alt: imageAlt || null,
    ...(wantsPublish ? { status: "published" as const } : wantsUnpublish ? { status: "draft" as const } : {}),
    ...(canPublish ? { is_featured: wantsFeatured } : {}),
  };

  // Only one article can be featured: clear the previous one first.
  if (canPublish && wantsFeatured && !current?.is_featured) {
    await supabase.from("blog_posts").update({ is_featured: false }).eq("is_featured", true);
  }

  const { data, error } = id
    ? await supabase.from("blog_posts").update(values).eq("id", id).select("id, status").single()
    : await supabase.from("blog_posts").insert(values).select("id, status").single();
  if (error) {
    if (featuredPath && featuredPath !== current?.featured_image_path) {
      await supabase.storage.from("blog-media").remove([featuredPath]);
    }
    return { status: "error", message: dbErrorMessage(error) };
  }
  if (replaced.length) await supabase.storage.from("blog-media").remove(replaced);
  await supabase.rpc("log_activity", {
    p_action: id ? "blog.updated" : "blog.created",
    p_entity_type: "blog_post",
    p_entity_id: data.id,
  });
  changed();
  if (!id) redirect(`/admin/blog/${data.id}?created=1`);
  return {
    status: "success",
    message: wantsPublish
      ? "Published. The article is live."
      : wantsUnpublish
        ? "Unpublished. The article is now a draft."
        : "Saved.",
  };
}

export async function deleteArticleAction(id: string): Promise<Result> {
  if (!UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("blog", "delete");
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("title, featured_image_path, content_html")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { ok: false, message: "This article no longer exists." };
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  const files = [
    ...articleImagePaths(data.content_html ?? ""),
    ...(data.featured_image_path ? [data.featured_image_path] : []),
  ];
  if (files.length) await supabase.storage.from("blog-media").remove(files);
  await supabase.rpc("log_activity", {
    p_action: "blog.deleted",
    p_entity_type: "blog_post",
    p_entity_id: id,
    p_metadata: { title: data.title },
  });
  updateTag(BLOG_TAG);
  redirect("/admin/blog?deleted=1");
}

/** Inline image for the editor. Returns the public URL to insert. */
export async function uploadArticleImageAction(
  formData: FormData,
): Promise<{ ok: true; url: string; width: number; height: number } | { ok: false; message: string }> {
  await requireAdminPermission("blog", "edit").catch(() => requireAdminPermission("blog", "create"));
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose an image." };
  const stored = await storeImage(file, "articles", 2000);
  if ("error" in stored) return { ok: false, message: stored.error ?? "Upload failed." };
  return { ok: true, url: publicStorageUrl("blog-media", stored.path), width: stored.width, height: stored.height };
}

/**
 * Word import: converts a .docx into editor content. Images inside the document are processed
 * and stored like uploaded images. Nothing is saved or published: the result is only placed
 * in the editor for review.
 */
export async function importDocxAction(
  formData: FormData,
): Promise<{ ok: true; html: string; title: string | null; notes: string[] } | { ok: false; message: string }> {
  await requireAdminPermission("blog", "edit").catch(() => requireAdminPermission("blog", "create"));
  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a Word document (.docx)." };
  if (!/\.docx$/i.test(file.name))
    return { ok: false, message: "Only .docx files can be imported. In Word: File → Save As → Word Document (.docx)." };
  if (file.size > MAX_UPLOAD) {
    return {
      ok: false,
      message: "This document is larger than 3.5 MB. Import the text first, then add large images in the editor.",
    };
  }

  let imageCount = 0;
  let imageFailures = 0;
  const result = await mammoth
    .convertToHtml(
      { buffer: Buffer.from(await file.arrayBuffer()) },
      {
        styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh"],
        convertImage: mammoth.images.imgElement(async (image) => {
          if (imageCount >= 20) {
            imageFailures += 1;
            return { src: "" };
          }
          const bytes = Buffer.from(await image.readAsBase64String(), "base64");
          const stored = await storeImage(new File([bytes], "image", { type: image.contentType }), "articles", 2000);
          if ("error" in stored) {
            imageFailures += 1;
            return { src: "" };
          }
          imageCount += 1;
          return { src: publicStorageUrl("blog-media", stored.path), alt: "" };
        }),
      },
    )
    .catch(() => null);
  if (!result) return { ok: false, message: "This document could not be read. Check it opens in Word and try again." };

  // A leading Title paragraph becomes the article title.
  let html = result.value;
  let title: string | null = null;
  const titleMatch = html.match(/^<h1>(.*?)<\/h1>/);
  if (titleMatch) {
    title = richTextToPlain(titleMatch[1]).slice(0, 200) || null;
    html = html.slice(titleMatch[0].length);
  }
  const clean = sanitizeArticleHtml(html);
  const notes = [
    "Check the imported article carefully: some Word formatting (fonts, colours, text boxes, comments, footnotes and complex layouts) does not transfer.",
    ...(imageCount ? [`${imageCount} image(s) imported. Add a short description (alt text) to each one.`] : []),
    ...(imageFailures ? [`${imageFailures} image(s) could not be imported. Add them again in the editor.`] : []),
    "Nothing has been saved yet. Review the article, then save it as a draft or publish it.",
  ];
  return { ok: true, html: clean, title, notes };
}

// ---------------------------------------------------------------------------
// Categories and authors
// ---------------------------------------------------------------------------
export async function saveCategoryAction(
  id: string | null,
  _prev: BlogFormState,
  formData: FormData,
): Promise<BlogFormState> {
  if (id !== null && !UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("blog", id ? "edit" : "create");
  const name = text(formData, "name", 200);
  const description = text(formData, "description", 1000);
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2 || name.length > 80) fieldErrors.name = "Enter a name of 2 to 80 characters.";
  if (description.length > 500) fieldErrors.description = "Use 500 characters or fewer.";
  const slug = slugify(name, 80);
  if (!fieldErrors.name && !slug) fieldErrors.name = "Use letters or numbers in the name.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  const supabase = await createClient();
  const values = { name, slug, description: description || null };
  const { error } = id
    ? await supabase.from("blog_categories").update(values).eq("id", id)
    : await supabase.from("blog_categories").insert(values);
  if (error?.code === "23505")
    return { status: "error", fieldErrors: { name: "A category with this name already exists." } };
  if (error) return { status: "error", message: dbErrorMessage(error) };
  changed();
  return { status: "success", message: id ? "Category saved." : "Category added." };
}

export async function deleteCategoryAction(id: string): Promise<Result> {
  if (!UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("blog", "delete");
  const supabase = await createClient();
  const { error } = await supabase.from("blog_categories").delete().eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  changed();
  return { ok: true, message: "Category deleted. Its articles now have no category." };
}

export async function saveAuthorAction(
  id: string | null,
  _prev: BlogFormState,
  formData: FormData,
): Promise<BlogFormState> {
  if (id !== null && !UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("blog", id ? "edit" : "create");
  const name = text(formData, "name", 200);
  const role = text(formData, "role_title", 200);
  const bio = text(formData, "bio", 3000);
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2 || name.length > 120) fieldErrors.name = "Enter a name of 2 to 120 characters.";
  if (role.length > 120) fieldErrors.role_title = "Use 120 characters or fewer.";
  if (bio.length > 2000) fieldErrors.bio = "Use 2,000 characters or fewer.";
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors };

  const supabase = await createClient();
  let photoPath: string | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const stored = await storeImage(photo, "authors", 800);
    if ("error" in stored) return { status: "error", fieldErrors: { photo: stored.error ?? "" } };
    photoPath = stored.path;
  }
  const { data: current } = id
    ? await supabase.from("blog_authors").select("photo_path").eq("id", id).maybeSingle()
    : { data: null };
  const values = {
    name,
    role_title: role || null,
    bio: bio || null,
    is_active: formData.get("is_active") === "on",
    ...(photoPath ? { photo_path: photoPath } : {}),
  };
  const { error } = id
    ? await supabase.from("blog_authors").update(values).eq("id", id)
    : await supabase
        .from("blog_authors")
        .insert({ ...values, slug: `${slugify(name, 60)}-${randomUUID().slice(0, 6)}` });
  if (error) {
    if (photoPath) await supabase.storage.from("blog-media").remove([photoPath]);
    return { status: "error", message: dbErrorMessage(error) };
  }
  if (photoPath && current?.photo_path) await supabase.storage.from("blog-media").remove([current.photo_path]);
  changed();
  return { status: "success", message: id ? "Author saved." : "Author added." };
}
