import { saveSectionAction } from "@/features/content/actions";
import { readContent, sectionsFor, type PageKey } from "@/features/content/sections";
import { createClient } from "@/lib/supabase/server";
import { SectionEditor } from "./section-editor";

/** All section editors of one page (server component: loads hidden sections too, via RLS). */
export async function ContentSections({ page, canEdit }: { page: PageKey; canEdit: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.from("page_sections").select("section_key, content, is_visible").eq("page_key", page);
  const rows = new Map((data ?? []).map((row) => [row.section_key, row]));

  return (
    <div className="flex flex-col gap-8">
      {sectionsFor(page).map((def) => {
        const row = rows.get(def.key);
        return (
          <SectionEditor
            key={def.key}
            def={def}
            content={readContent(def, row?.content)}
            isVisible={row?.is_visible ?? true}
            action={saveSectionAction.bind(null, def.page, def.key)}
            canEdit={canEdit}
          />
        );
      })}
    </div>
  );
}
