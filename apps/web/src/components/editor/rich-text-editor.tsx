'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function ToolbarButton({
  onClick,
  active,
  label,
  title,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // keep editor focus
        onClick();
      }}
      title={title}
      aria-label={title}
      className={cn(
        'rounded px-2 py-0.5 text-xs font-medium transition-colors',
        active
          ? 'bg-slate-600 text-slate-100'
          : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200',
      )}
    >
      {label}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      // emit empty string for an empty doc so dirty detection works correctly
      const html = e.isEmpty ? '' : e.getHTML();
      onChange(html);
    },
  });

  // Sync editable flag when disabled prop changes
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled, false);
  }, [editor, disabled]);

  // Sync content when parent value is pushed in from outside (initial data load, post-save refetch)
  useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return; // never clobber while user is typing
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value, false); // false → skip onUpdate emit
    }
  }, [editor, value]);

  return (
    <div
      className={cn(
        'rounded-md border border-slate-700 bg-slate-900 text-sm text-slate-200',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      {/* Toolbar — only shown when editable */}
      {!disabled && (
        <div className="flex flex-wrap gap-1 border-b border-slate-700 px-2 py-1.5">
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBold().run() ?? void 0}
            active={editor?.isActive('bold') ?? false}
            label="B"
            title="Bold (Ctrl+B)"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleItalic().run() ?? void 0}
            active={editor?.isActive('italic') ?? false}
            label="I"
            title="Italic (Ctrl+I)"
          />
          <span className="mx-1 border-l border-slate-700" aria-hidden="true" />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBulletList().run() ?? void 0}
            active={editor?.isActive('bulletList') ?? false}
            label="• List"
            title="Bullet list"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleOrderedList().run() ?? void 0}
            active={editor?.isActive('orderedList') ?? false}
            label="1. List"
            title="Ordered list"
          />
        </div>
      )}

      {/*
        EditorContent renders the ProseMirror contenteditable div.
        Prose styles below target the generated .ProseMirror element.
      */}
      <EditorContent
        editor={editor}
        className={cn(
          '[&_.ProseMirror]:min-h-[6rem] [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:outline-none',
          // Placeholder
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-500',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
          // List styles
          '[&_.ProseMirror_ul]:ml-4 [&_.ProseMirror_ul]:list-disc',
          '[&_.ProseMirror_ol]:ml-4 [&_.ProseMirror_ol]:list-decimal',
        )}
      />
    </div>
  );
}
