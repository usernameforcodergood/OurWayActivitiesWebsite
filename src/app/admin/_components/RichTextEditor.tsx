"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, Extension, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Heading } from "@tiptap/extension-heading";
import { TextAlign } from "@tiptap/extension-text-align";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  ChevronDown,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo2,
  RemoveFormatting,
  SeparatorHorizontal,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { RICH_ALIGNMENTS, RICH_COLORS, RICH_FONT_SIZES, normalizeColor, normalizeFontSize, toEditorHtml } from "@/lib/cms/richText";
import { cn } from "@/lib/utils";
import { t } from "../_lib/strings";

const E = t.editor;
type Align = (typeof RICH_ALIGNMENTS)[number];

/**
 * Text colour and size live on the textStyle mark, limited to the site palette.
 * Pasted colours/sizes outside it (black from Word, 11pt from Docs…) are dropped,
 * so pasted text always matches the website.
 */
const PaletteStyle = Extension.create({
  name: "paletteStyle",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          color: {
            default: null,
            parseHTML: (el) => normalizeColor(el.style.color),
            renderHTML: (a) => (a.color ? { style: `color: ${a.color}` } : {}),
          },
          fontSize: {
            default: null,
            parseHTML: (el) => normalizeFontSize(el.style.fontSize),
            renderHTML: (a) => (a.fontSize ? { style: `font-size: ${a.fontSize}` } : {}),
          },
        },
      },
    ];
  },
});

/** Only keep a pasted <span> when it carries a palette colour or size; others are dropped, text kept. */
const PaletteTextStyle = TextStyle.extend({
  parseHTML() {
    return [
      {
        tag: "span",
        consuming: false,
        getAttrs: (el) => (normalizeColor(el.style.color) || normalizeFontSize(el.style.fontSize) ? {} : false),
      },
    ];
  },
});

/** Headings 2–4 only (the page title is the h1); pasted h1 / h5 / h6 map onto them. */
const SiteHeading = Heading.extend({
  parseHTML() {
    return [
      { tag: "h1", attrs: { level: 2 } },
      { tag: "h2", attrs: { level: 2 } },
      { tag: "h3", attrs: { level: 3 } },
      { tag: "h4", attrs: { level: 4 } },
      { tag: "h5", attrs: { level: 4 } },
      { tag: "h6", attrs: { level: 4 } },
    ];
  },
}).configure({ levels: [2, 3, 4] });

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl+";

function withScheme(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(v)) return `mailto:${v}`;
  if (/^\+?[\d\s()-]{6,}$/.test(v)) return `tel:${v.replace(/[\s()-]/g, "")}`;
  return `https://${v.replace(/^\/+/, "")}`;
}

type Props = {
  id: string;
  /** Stored value: editor HTML or older plain text (converted on open). */
  value: string;
  onChange: (html: string) => void;
  label: string;
  describedBy?: string;
  placeholder?: string;
};

/** Gmail-style WYSIWYG editor. Emits "" when empty, otherwise HTML (sanitised again on save). */
export function RichTextEditor({ id, value, onChange, label, describedBy, placeholder }: Props) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: "https",
          protocols: ["mailto", "tel"],
          HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
        },
      }),
      SiteHeading,
      PaletteTextStyle,
      PaletteStyle,
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: [...RICH_ALIGNMENTS] }),
      Placeholder.configure({ placeholder: placeholder ?? E.placeholder }),
      CharacterCount,
    ],
    content: toEditorHtml(value),
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        class: "rich-text rte-content",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.isEmpty ? "" : editor.getHTML()),
  });

  return (
    <div className="rte rounded-lg border border-ink/20 bg-white transition-[border-color,box-shadow] focus-within:border-turquoise focus-within:shadow-[0_0_0_3px_rgb(32_175_192/0.2)]">
      {editor ? <Toolbar editor={editor} /> : <div className="h-[2.875rem] rounded-t-lg border-b border-ink/10 bg-stone" />}
      <EditorContent editor={editor} />
      {editor && <Footer editor={editor} />}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Toolbar
   -------------------------------------------------------------------------- */

type Pop = "color" | "align" | "link" | null;

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed.isActive("bold"),
      italic: ed.isActive("italic"),
      underline: ed.isActive("underline"),
      strike: ed.isActive("strike"),
      bullet: ed.isActive("bulletList"),
      ordered: ed.isActive("orderedList"),
      link: ed.isActive("link"),
      block: ed.isActive("heading", { level: 2 }) ? "h2" : ed.isActive("heading", { level: 3 }) ? "h3" : ed.isActive("heading", { level: 4 }) ? "h4" : "p",
      size: (ed.getAttributes("textStyle").fontSize as string | undefined) ?? "",
      color: (ed.getAttributes("textStyle").color as string | undefined) ?? null,
      align: ((["center", "right", "justify"] as const).find((a) => ed.isActive({ textAlign: a })) ?? "left") as Align,
      canUndo: ed.can().undo(),
      canRedo: ed.can().redo(),
    }),
  });
  const [pop, setPop] = useState<Pop>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Close an open menu on outside click or Escape.
  useEffect(() => {
    if (!pop) return;
    const onDown = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setPop(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPop(null);
        editor.view.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pop, editor]);

  // Ctrl/⌘+K opens the link menu, as in Gmail.
  useEffect(() => {
    const dom = editor.view.dom;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPop("link");
      }
    };
    dom.addEventListener("keydown", onKey);
    return () => dom.removeEventListener("keydown", onKey);
  }, [editor]);

  const chain = () => editor.chain().focus();
  const toggle = (p: Exclude<Pop, null>) => setPop((cur) => (cur === p ? null : p));

  // The menus take focus from the text; hand it straight back so typing continues there.
  const setBlock = (v: string) => {
    if (v === "p") chain().setParagraph().run();
    else chain().setHeading({ level: Number(v[1]) as 2 | 3 | 4 }).run();
    editor.view.focus();
  };
  const setSize = (v: string) => {
    if (v) chain().setMark("textStyle", { fontSize: v }).run();
    else chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run();
    editor.view.focus();
  };
  const setColor = (v: string | null) => {
    if (v) chain().setMark("textStyle", { color: v }).run();
    else chain().setMark("textStyle", { color: null }).removeEmptyTextStyle().run();
    setPop(null);
  };
  const AlignIcon = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify }[s.align];

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label={E.toolbar}
      className="sticky top-14 z-20 flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-ink/10 bg-stone px-1.5 py-1.5 lg:top-0"
    >
      <Tool label={E.undo} shortcut={`${mod}Z`} onClick={() => chain().undo().run()} disabled={!s.canUndo}>
        <Undo2 />
      </Tool>
      <Tool label={E.redo} shortcut={isMac ? "⌘⇧Z" : "Ctrl+Y"} onClick={() => chain().redo().run()} disabled={!s.canRedo}>
        <Redo2 />
      </Tool>
      <Sep />

      <ToolSelect label={E.blockStyle} value={s.block} onChange={setBlock} className="w-[8.5rem]">
        <option value="p">{E.blocks.p}</option>
        <option value="h2">{E.blocks.h2}</option>
        <option value="h3">{E.blocks.h3}</option>
        <option value="h4">{E.blocks.h4}</option>
      </ToolSelect>
      <ToolSelect label={E.size} value={s.size} onChange={setSize} className="w-[7.25rem]">
        {RICH_FONT_SIZES.map((f) => (
          <option key={f.name} value={f.value ?? ""}>
            {f.name}
          </option>
        ))}
      </ToolSelect>
      <Sep />

      <Tool label={E.bold} shortcut={`${mod}B`} active={s.bold} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </Tool>
      <Tool label={E.italic} shortcut={`${mod}I`} active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </Tool>
      <Tool label={E.underline} shortcut={`${mod}U`} active={s.underline} onClick={() => chain().toggleUnderline().run()}>
        <Underline />
      </Tool>
      <Tool label={E.strike} shortcut={isMac ? "⌘⇧S" : "Ctrl+Shift+S"} active={s.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough />
      </Tool>

      <div className="relative">
        <Tool label={E.color} active={pop === "color"} expanded={pop === "color"} onClick={() => toggle("color")}>
          <span className="relative flex flex-col items-center">
            <Baseline />
            <span aria-hidden className="absolute -bottom-0.5 h-[3px] w-4 rounded-full" style={{ background: s.color ?? "var(--color-ink)" }} />
          </span>
        </Tool>
        {pop === "color" && (
          <Popover label={E.color}>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setColor(null)}
                aria-pressed={!s.color}
                title={E.colorDefault}
                className={cn("flex size-8 items-center justify-center rounded-md bg-ink text-[10px] font-semibold text-white ring-offset-2", !s.color && "ring-2 ring-turquoise")}
              >
                A<span className="sr-only">{E.colorDefault}</span>
              </button>
              {RICH_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setColor(c.value)}
                  aria-pressed={s.color === c.value}
                  title={c.name}
                  className={cn("size-8 rounded-md ring-offset-2", s.color === c.value && "ring-2 ring-turquoise")}
                  style={{ background: c.value }}
                >
                  <span className="sr-only">{c.name}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 max-w-[11rem] text-[11px] leading-snug text-bark">{E.colorNote}</p>
          </Popover>
        )}
      </div>
      <Sep />

      <div className="relative">
        <Tool label={E.link} shortcut={`${mod}K`} active={s.link || pop === "link"} expanded={pop === "link"} onClick={() => toggle("link")}>
          <LinkIcon />
        </Tool>
        {pop === "link" && <LinkMenu editor={editor} onClose={() => setPop(null)} />}
      </div>
      <Tool label={E.bulletList} shortcut={isMac ? "⌘⇧8" : "Ctrl+Shift+8"} active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List />
      </Tool>
      <Tool label={E.orderedList} shortcut={isMac ? "⌘⇧7" : "Ctrl+Shift+7"} active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered />
      </Tool>

      <div className="relative">
        <Tool label={E.align} active={pop === "align"} expanded={pop === "align"} onClick={() => toggle("align")} wide>
          <AlignIcon />
          <ChevronDown className="!size-3" />
        </Tool>
        {pop === "align" && (
          <Popover label={E.align}>
            <div className="flex gap-0.5">
              {RICH_ALIGNMENTS.map((a) => {
                const Icon = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify }[a];
                return (
                  <Tool
                    key={a}
                    label={E.alignments[a]}
                    active={s.align === a}
                    onClick={() => {
                      chain().setTextAlign(a).run();
                      setPop(null);
                    }}
                  >
                    <Icon />
                  </Tool>
                );
              })}
            </div>
          </Popover>
        )}
      </div>
      <Tool label={E.divider} onClick={() => chain().setHorizontalRule().run()}>
        <SeparatorHorizontal />
      </Tool>
      <Sep />
      <Tool label={E.clear} onClick={() => chain().unsetAllMarks().clearNodes().unsetTextAlign().run()}>
        <RemoveFormatting />
      </Tool>
    </div>
  );
}

function Tool({
  label,
  shortcut,
  active,
  expanded,
  disabled,
  wide,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  wide?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={shortcut ? `${label} (${shortcut})` : label}
        aria-pressed={expanded === undefined && active !== undefined ? active : undefined}
        aria-expanded={expanded}
        disabled={disabled}
        // Keep the text selection while clicking the toolbar.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={cn(
          "inline-flex h-8 items-center justify-center gap-0.5 rounded-md text-ink/80 transition-colors hover:bg-ink/[0.07] hover:text-ink disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-[1.05rem]",
          wide ? "px-1.5" : "w-8",
          active && "bg-emerald-100 text-emerald-900 hover:bg-emerald-100",
        )}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-40 mt-1.5 -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity delay-0 group-hover:opacity-100 group-hover:delay-300 group-has-[:focus-visible]:opacity-100"
      >
        {label}
        {shortcut && <span className="ml-1.5 text-white/60">{shortcut}</span>}
      </span>
    </span>
  );
}

function ToolSelect({
  label,
  value,
  onChange,
  className,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className="group relative inline-flex">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-8 cursor-pointer appearance-none rounded-md bg-transparent bg-[length:0.9rem] bg-[right_0.35rem_center] bg-no-repeat pr-6 pl-2 text-[13px] font-medium text-ink/85 hover:bg-ink/[0.07] focus-visible:outline-2",
          "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%230c1311%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')]",
          className,
        )}
      >
        {children}
      </select>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-40 mt-1.5 -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-hover:delay-300"
      >
        {label}
      </span>
    </span>
  );
}

function Sep() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-ink/15" />;
}

function Popover({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="dialog" aria-label={label} className="absolute top-full left-0 z-50 mt-1.5 rounded-lg border border-ink/10 bg-white p-2.5 shadow-xl">
      {children}
    </div>
  );
}

function LinkMenu({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const current = (editor.getAttributes("link").href as string | undefined) ?? "";
  const { empty } = editor.state.selection;
  // With nothing selected (and not inside a link), ask for the text to show too.
  const needsText = empty && !current;
  const [href, setHref] = useState(current);
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);
  const hrefRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hrefRef.current?.focus();
    hrefRef.current?.select();
  }, []);

  const apply = () => {
    const url = withScheme(href);
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      editor.view.focus();
      onClose();
      return;
    }
    if (!/^(https?:\/\/[^\s]+\.[^\s]+|mailto:\S+@\S+|tel:\+?\d{6,})$/i.test(url)) {
      setInvalid(true);
      return;
    }
    if (needsText) {
      const label = text.trim() || href.trim();
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: label, marks: [{ type: "link", attrs: { href: url } }] })
        .unsetMark("link")
        .insertContent(" ")
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    editor.view.focus();
    onClose();
  };

  return (
    <Popover label={E.link}>
      {/* Not a <form>: the editor may sit inside one. Enter applies. */}
      <div
        className="grid w-[min(20rem,calc(100vw-3rem))] gap-2"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          }
        }}
      >
        {needsText && (
          <label className="grid gap-1 text-xs font-semibold">
            {E.linkText}
            <input value={text} onChange={(e) => setText(e.target.value)} className="admin-input !py-1.5 text-sm font-normal" />
          </label>
        )}
        <label className="grid gap-1 text-xs font-semibold">
          {E.linkUrl}
          <input
            ref={hrefRef}
            value={href}
            onChange={(e) => {
              setHref(e.target.value);
              setInvalid(false);
            }}
            placeholder="https://"
            inputMode="url"
            aria-invalid={invalid || undefined}
            className="admin-input !py-1.5 text-sm font-normal"
          />
        </label>
        {invalid && <p className="text-xs text-red-700">{E.linkInvalid}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          {current ? (
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                editor.view.focus();
                onClose();
              }}
              className="text-xs font-semibold text-red-700 hover:underline"
            >
              {E.linkRemove}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {current && (
              <a href={current} target="_blank" rel="noopener noreferrer" className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-bark hover:bg-ink/5">
                {E.linkOpen}
              </a>
            )}
            <button type="button" onClick={apply} className="rounded-md bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900">
              {E.linkApply}
            </button>
          </div>
        </div>
      </div>
    </Popover>
  );
}

function Footer({ editor }: { editor: Editor }) {
  const words = useEditorState({ editor, selector: ({ editor: ed }) => ed.storage.characterCount.words() as number });
  return (
    <div className="flex items-center justify-between gap-3 rounded-b-lg border-t border-ink/[0.06] px-3 py-1.5 text-[11px] text-bark">
      <span>{E.pasteNote}</span>
      <span className="shrink-0 tabular-nums">{fmtWords(words)}</span>
    </div>
  );
}

const fmtWords = (n: number) => (n === 1 ? E.oneWord : E.words.replace("{n}", String(n)));
