/**
 * Convert text to a URL-friendly slug. Uniqueness is enforced by the database (Stage 3).
 */
export function slugify(input: string, maxLength = 80): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length <= maxLength) return slug;
  return slug.slice(0, maxLength).replace(/-+[^-]*$/, "") || slug.slice(0, maxLength);
}
