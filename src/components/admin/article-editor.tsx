"use client";

import { EditorContent, mergeAttributes, Node, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { Youtube } from "@tiptap/extension-youtube";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Columns3,
  FileUp,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  type LucideIcon,
  Pilcrow,
  Quote,
  Redo2,
  Rows3,
  Strikethrough,
  Table as TableIcon,
  TableCellsSplit,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
  Video,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { importDocxAction, uploadArticleImageAction } from "@/features/blog/actions";
import { parseYouTubeId } from "@/features/properties/links";
import { prepareImageForUpload } from "@/features/properties/resize-image";
import { cn } from "@/lib/cn";

/** Image with alt text and an optional caption, stored as <figure><img><figcaption>. */
const Figure = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null }, alt: { default: "" }, caption: { default: "" } };
  },
  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (element) => {
          const img = (element as HTMLElement).querySelector("img");
          if (!img) return false;
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt") ?? "",
            caption: (element as HTMLElement).querySelector("figcaption")?.textContent ?? "",
          };
        },
      },
      {
        tag: "img[src]",
        getAttrs: (element) => ({
          src: (element as HTMLElement).getAttribute("src"),
          alt: (element as HTMLElement).getAttribute("alt") ?? "",
          caption: "",
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const { src, alt, caption } = HTMLAttributes as { src: string; alt: string; caption: string };
    const img = ["img", mergeAttributes({ src, alt })] as const;
    return caption ? ["figure", {}, img, ["figcaption", {}, caption]] : ["figure", {}, img];
  },
});

type Dialogs = "link" | "image" | "video" | null;

export function ArticleEditor({
  initialJson,
  invalid,
  onImportTitle,
}: {
  initialJson: unknown;
  invalid?: boolean;
  /** Called with the document title when a Word file starts with a Title paragraph. */
  onImportTitle?: (title: string) => void;
}) {
  const [json, setJson] = useState(() => JSON.stringify(initialJson ?? { type: "doc", content: [] }));
  const [html, setHtml] = useState("");
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [imageText, setImageText] = useState({ src: "", alt: "", caption: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "info" | "error" | "success"; lines: string[] } | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const docxInput = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ["http", "https", "mailto"],
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: null },
        },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({ nocookie: true, controls: true, modestBranding: true, width: 640, height: 360 }),
      Figure,
    ],
    content: initialJson && typeof initialJson === "object" ? (initialJson as object) : "",
    editorProps: {
      attributes: {
        id: "article-content",
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": "article-content-label",
        ...(invalid ? { "aria-invalid": "true" } : {}),
        class: "rich-text article min-h-96 px-4 py-4 text-body focus:outline-none",
      },
    },
    onCreate: ({ editor: instance }) => setHtml(instance.isEmpty ? "" : instance.getHTML()),
    onUpdate: ({ editor: instance }) => {
      setJson(JSON.stringify(instance.getJSON()));
      setHtml(instance.isEmpty ? "" : instance.getHTML());
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            h4: e.isActive("heading", { level: 4 }),
            paragraph: e.isActive("paragraph"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
            table: e.isActive("table"),
            figure: e.isActive("figure"),
            left: e.isActive({ textAlign: "left" }),
            center: e.isActive({ textAlign: "center" }),
            right: e.isActive({ textAlign: "right" }),
            justify: e.isActive({ textAlign: "justify" }),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });

  if (!editor) {
    return <div className="min-h-96 border border-line-strong bg-surface" aria-hidden="true" />;
  }

  const chain = () => editor.chain().focus();
  type Tool = { label: string; icon: LucideIcon; on?: boolean; run: () => void; disabled?: boolean };
  const groups: Tool[][] = [
    [
      { label: "Undo", icon: Undo2, run: () => chain().undo().run(), disabled: !state?.canUndo },
      { label: "Redo", icon: Redo2, run: () => chain().redo().run(), disabled: !state?.canRedo },
    ],
    [
      { label: "Paragraph", icon: Pilcrow, on: state?.paragraph, run: () => chain().setParagraph().run() },
      { label: "Heading", icon: Heading2, on: state?.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
      { label: "Sub-heading", icon: Heading3, on: state?.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
      { label: "Small heading", icon: Heading4, on: state?.h4, run: () => chain().toggleHeading({ level: 4 }).run() },
    ],
    [
      { label: "Bold", icon: Bold, on: state?.bold, run: () => chain().toggleBold().run() },
      { label: "Italic", icon: Italic, on: state?.italic, run: () => chain().toggleItalic().run() },
      { label: "Underline", icon: UnderlineIcon, on: state?.underline, run: () => chain().toggleUnderline().run() },
      { label: "Strikethrough", icon: Strikethrough, on: state?.strike, run: () => chain().toggleStrike().run() },
    ],
    [
      { label: "Align left", icon: AlignLeft, on: state?.left, run: () => chain().setTextAlign("left").run() },
      { label: "Align centre", icon: AlignCenter, on: state?.center, run: () => chain().setTextAlign("center").run() },
      { label: "Align right", icon: AlignRight, on: state?.right, run: () => chain().setTextAlign("right").run() },
      { label: "Justify", icon: AlignJustify, on: state?.justify, run: () => chain().setTextAlign("justify").run() },
    ],
    [
      { label: "Bullet list", icon: List, on: state?.bullet, run: () => chain().toggleBulletList().run() },
      { label: "Numbered list", icon: ListOrdered, on: state?.ordered, run: () => chain().toggleOrderedList().run() },
      { label: "Quote", icon: Quote, on: state?.quote, run: () => chain().toggleBlockquote().run() },
    ],
    [
      {
        label: "Add link",
        icon: LinkIcon,
        on: state?.link,
        run: () => {
          setLinkUrl((editor.getAttributes("link").href as string | undefined) ?? "");
          setDialog("link");
        },
      },
      { label: "Remove link", icon: Unlink, run: () => chain().unsetLink().run(), disabled: !state?.link },
      { label: "Insert image", icon: ImagePlus, run: () => document.getElementById("article-image-input")?.click() },
      { label: "Insert YouTube video", icon: Video, run: () => (setVideoUrl(""), setDialog("video")) },
      {
        label: "Insert table",
        icon: TableIcon,
        run: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
    ],
  ];
  const tableTools: Tool[] = state?.table
    ? [
        { label: "Add row", icon: Rows3, run: () => chain().addRowAfter().run() },
        { label: "Add column", icon: Columns3, run: () => chain().addColumnAfter().run() },
        { label: "Delete row", icon: TableCellsSplit, run: () => chain().deleteRow().run() },
        { label: "Delete column", icon: TableCellsSplit, run: () => chain().deleteColumn().run() },
        { label: "Delete table", icon: Trash2, run: () => chain().deleteTable().run() },
      ]
    : [];

  /** Updates (or removes, with null) the image with this address, wherever the cursor is. */
  function updateFigure(src: string, attrs: { alt: string; caption: string } | null) {
    if (!editor || !src) return;
    editor
      .chain()
      .focus()
      .command(({ tr, state: editorState }) => {
        let found = false;
        editorState.doc.descendants((node, pos) => {
          if (found || node.type.name !== "figure" || node.attrs.src !== src) return !found;
          found = true;
          if (attrs) tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
          else tr.delete(pos, pos + node.nodeSize);
          return false;
        });
        return found;
      })
      .run();
  }

  async function insertImage(file: File | undefined) {
    if (!file || !editor) return;
    setBusy("Uploading image…");
    setNotice(null);
    try {
      const blob = await prepareImageForUpload(file, 2000);
      const data = new FormData();
      data.set("image", new File([blob], "image", { type: blob.type }));
      const result = await uploadArticleImageAction(data);
      if (!result.ok) {
        setNotice({ tone: "error", lines: [result.message] });
        return;
      }
      editor
        .chain()
        .focus()
        // A paragraph after the image moves the cursor off it, so the next insert cannot replace it.
        .insertContent([{ type: "figure", attrs: { src: result.url, alt: "", caption: "" } }, { type: "paragraph" }])
        .run();
      setImageText({ src: result.url, alt: "", caption: "" });
      setDialog("image");
    } catch (error) {
      setNotice({
        tone: "error",
        lines: [error instanceof Error ? error.message : "The image could not be uploaded."],
      });
    } finally {
      setBusy(null);
      if (imageInput.current) imageInput.current.value = "";
    }
  }

  async function importDocx(file: File | undefined) {
    if (!file || !editor) return;
    if (!editor.isEmpty && !window.confirm("Replace the current article text with the Word document?")) return;
    setBusy("Importing the Word document…");
    setNotice(null);
    try {
      const data = new FormData();
      data.set("document", file);
      const result = await importDocxAction(data);
      if (!result.ok) {
        setNotice({ tone: "error", lines: [result.message] });
        return;
      }
      editor.commands.setContent(result.html);
      if (result.title) onImportTitle?.(result.title);
      setNotice({ tone: "info", lines: result.notes });
    } finally {
      setBusy(null);
      if (docxInput.current) docxInput.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {notice && (
        <Notice tone={notice.tone}>
          <ul className="flex flex-col gap-1">
            {notice.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Notice>
      )}
      {busy && <Notice tone="info">{busy}</Notice>}

      <div className={cn("border border-line-strong bg-surface focus-within:border-brand", invalid && "border-danger")}>
        <div
          role="toolbar"
          aria-label="Formatting"
          aria-controls="article-content"
          className="sticky top-16 z-10 flex flex-wrap gap-x-3 gap-y-1 border-b border-line bg-surface px-2 py-1.5"
        >
          {[...groups, ...(tableTools.length ? [tableTools] : [])].map((group, index) => (
            <div key={index} className="flex gap-0.5 border-r border-line pr-3 last:border-r-0">
              {group.map((tool) => (
                <button
                  key={tool.label}
                  type="button"
                  onClick={tool.run}
                  disabled={tool.disabled}
                  aria-pressed={tool.on === undefined ? undefined : !!tool.on}
                  aria-label={tool.label}
                  title={tool.label}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-sm text-ink transition-colors hover:bg-brand-tint disabled:opacity-35",
                    tool.on && "bg-brand-tint text-brand-deep",
                  )}
                >
                  <tool.icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
              ))}
            </div>
          ))}
          {state?.figure && (
            <Button
              type="button"
              size="sm"
              variant="quiet"
              onClick={() => {
                const attrs = editor.getAttributes("figure") as { src?: string; alt?: string; caption?: string };
                setImageText({ src: attrs.src ?? "", alt: attrs.alt ?? "", caption: attrs.caption ?? "" });
                setDialog("image");
              }}
            >
              Image description and caption
            </Button>
          )}
        </div>
        <EditorContent editor={editor} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          leadingIcon={<FileUp className="size-4" strokeWidth={1.5} aria-hidden="true" />}
          onClick={() => docxInput.current?.click()}
          loading={busy === "Importing the Word document…"}
        >
          Import from Word (.docx)
        </Button>
        <p className="text-caption text-stone">
          Imported text is placed here for review. Some Word formatting may not transfer perfectly.
        </p>
      </div>

      <input
        id="article-image-input"
        ref={imageInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void insertImage(e.target.files?.[0])}
      />
      <input
        ref={docxInput}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void importDocx(e.target.files?.[0])}
      />
      <input type="hidden" name="content_json" value={json} />
      <input type="hidden" name="content_html" value={html} />

      <Dialog open={dialog === "link"} onClose={() => setDialog(null)} title="Link">
        <div className="flex flex-col gap-5">
          <FormField id="link-url" label="Web address" hint="https://…, or mailto: for an email address">
            <Input id="link-url" type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          </FormField>
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const url = linkUrl.trim();
                if (/^(https?:\/\/|mailto:)/i.test(url)) chain().extendMarkRange("link").setLink({ href: url }).run();
                else chain().extendMarkRange("link").unsetLink().run();
                setDialog(null);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={dialog === "video"} onClose={() => setDialog(null)} title="YouTube video">
        <div className="flex flex-col gap-5">
          <FormField
            id="video-url"
            label="YouTube link"
            error={videoUrl && !parseYouTubeId(videoUrl) ? "This is not a YouTube video link." : undefined}
          >
            <Input id="video-url" type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
          </FormField>
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={!parseYouTubeId(videoUrl)}
              onClick={() => {
                const id = parseYouTubeId(videoUrl);
                if (id)
                  chain()
                    .setYoutubeVideo({ src: `https://www.youtube.com/watch?v=${id}` })
                    .run();
                setDialog(null);
              }}
            >
              Insert video
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={dialog === "image"} onClose={() => setDialog(null)} title="Image description and caption">
        <div className="flex flex-col gap-5">
          <FormField
            id="image-alt"
            label="Description for screen readers (alt text)"
            hint="Describe what the image shows, e.g. “Fenced plot with a gate on a tarred road”."
          >
            <Input
              id="image-alt"
              value={imageText.alt}
              maxLength={300}
              onChange={(e) => setImageText((t) => ({ ...t, alt: e.target.value }))}
            />
          </FormField>
          <FormField id="image-caption" label="Caption shown under the image" optionalLabel>
            <Input
              id="image-caption"
              value={imageText.caption}
              maxLength={300}
              onChange={(e) => setImageText((t) => ({ ...t, caption: e.target.value }))}
            />
          </FormField>
          <div className="flex justify-end gap-3">
            <Button
              variant="danger"
              onClick={() => {
                updateFigure(imageText.src, null);
                setDialog(null);
              }}
            >
              Remove image
            </Button>
            <Button
              onClick={() => {
                updateFigure(imageText.src, { alt: imageText.alt.trim(), caption: imageText.caption.trim() });
                setDialog(null);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
