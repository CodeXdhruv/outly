import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Quote,
} from 'lucide-react';

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export const RichEditor: React.FC<RichEditorProps> = ({ value, onChange }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'min-h-[220px] max-h-[400px] overflow-y-auto px-4 py-3 focus:outline-none text-sm text-neutral-100 prose prose-invert max-w-none',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900 focus-within:border-orange-500/80 transition-colors">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-neutral-850 border-b border-neutral-800">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-neutral-800 transition-colors ${
            editor.isActive('bold') ? 'bg-neutral-800 text-orange-400' : 'text-neutral-400'
          }`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-neutral-800 transition-colors ${
            editor.isActive('italic') ? 'bg-neutral-800 text-orange-400' : 'text-neutral-400'
          }`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-neutral-800 transition-colors ${
            editor.isActive('underline') ? 'bg-neutral-800 text-orange-400' : 'text-neutral-400'
          }`}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded hover:bg-neutral-800 transition-colors ${
            editor.isActive('strike') ? 'bg-neutral-800 text-orange-400' : 'text-neutral-400'
          }`}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-neutral-750 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded hover:bg-neutral-800 transition-colors ${
            editor.isActive('heading', { level: 1 }) ? 'bg-neutral-800 text-orange-400' : 'text-neutral-400'
          }`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded hover:bg-neutral-800 transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-neutral-800 text-orange-400' : 'text-neutral-400'
          }`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-neutral-750 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-neutral-800 transition-colors ${
            editor.isActive('bulletList') ? 'bg-neutral-800 text-orange-400' : 'text-neutral-400'
          }`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-neutral-800 transition-colors ${
            editor.isActive('orderedList') ? 'bg-neutral-800 text-orange-400' : 'text-neutral-400'
          }`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded hover:bg-neutral-800 transition-colors ${
            editor.isActive('blockquote') ? 'bg-neutral-800 text-orange-400' : 'text-neutral-400'
          }`}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-neutral-750 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-1.5 rounded hover:bg-neutral-800 transition-colors ${
            editor.isActive({ textAlign: 'left' }) ? 'bg-neutral-800 text-orange-400' : 'text-neutral-400'
          }`}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-1.5 rounded hover:bg-neutral-800 transition-colors ${
            editor.isActive({ textAlign: 'center' }) ? 'bg-neutral-800 text-orange-400' : 'text-neutral-400'
          }`}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-1.5 rounded hover:bg-neutral-800 transition-colors ${
            editor.isActive({ textAlign: 'right' }) ? 'bg-neutral-800 text-orange-400' : 'text-neutral-400'
          }`}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
};
