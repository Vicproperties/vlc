"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Simple formatted text (owner decision 2026-11-04): paragraphs, bold, italic, sub-headings
 * and lists. Every other format is switched off. The HTML is posted in a hidden input and
 * sanitised again on the server.
 */
export function RichTextEditor({
  id,
  name,
  defaultValue,
  invalid,
  describedBy,
  labelledBy,
  document = false,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  invalid?: boolean;
  describedBy?: string;
  labelledBy: string;
  /** Longer documents (legal pages) also get a main heading level. */
  document?: boolean;
}) {
  const [html, setHtml] = useState(defaultValue ?? "");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: document ? [2, 3] : [3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: false,
        underline: false,
      }),
    ],
    content: defaultValue ?? "",
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
        class: "rich-text min-h-48 px-3.5 py-3 text-body focus:outline-none",
      },
    },
    onUpdate: ({ editor: instance }) => setHtml(instance.isEmpty ? "" : instance.getHTML()),
  });

  const active = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance?.isActive("bold") ?? false,
      italic: instance?.isActive("italic") ?? false,
      heading: instance?.isActive("heading", { level: 3 }) ?? false,
      heading2: instance?.isActive("heading", { level: 2 }) ?? false,
      bullet: instance?.isActive("bulletList") ?? false,
      ordered: instance?.isActive("orderedList") ?? false,
    }),
  });

  const tools: Array<{ label: string; icon: LucideIcon; pressed: boolean; run: () => void }> = editor
    ? [
        { label: "Bold", icon: Bold, pressed: !!active?.bold, run: () => editor.chain().focus().toggleBold().run() },
        {
          label: "Italic",
          icon: Italic,
          pressed: !!active?.italic,
          run: () => editor.chain().focus().toggleItalic().run(),
        },
        ...(document
          ? [
              {
                label: "Heading",
                icon: Heading2,
                pressed: !!active?.heading2,
                run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
              },
            ]
          : []),
        {
          label: "Sub-heading",
          icon: Heading3,
          pressed: !!active?.heading,
          run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
          label: "Bullet list",
          icon: List,
          pressed: !!active?.bullet,
          run: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          label: "Numbered list",
          icon: ListOrdered,
          pressed: !!active?.ordered,
          run: () => editor.chain().focus().toggleOrderedList().run(),
        },
      ]
    : [];

  return (
    <div
      className={cn(
        "rounded-xl border border-line-strong bg-surface focus-within:border-brand focus-within:outline-2 focus-within:outline-brand",
        invalid && "border-danger",
      )}
    >
      <div
        role="toolbar"
        aria-label="Formatting"
        aria-controls={id}
        className="flex gap-1 border-b border-line px-2 py-1.5"
      >
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onClick={tool.run}
            aria-pressed={tool.pressed}
            aria-label={tool.label}
            title={tool.label}
            className={cn(
              "flex size-9 items-center justify-center rounded-xl text-ink transition-colors hover:bg-brand-tint",
              tool.pressed && "bg-brand-tint text-brand-deep",
            )}
          >
            <tool.icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        ))}
      </div>
      {editor ? <EditorContent editor={editor} /> : <div className="min-h-48" aria-hidden="true" />}
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
