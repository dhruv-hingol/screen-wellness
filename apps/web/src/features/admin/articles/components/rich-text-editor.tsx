import { useEffect, useState } from 'react';
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import type { RichNode } from '@screenwise/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { MediaPicker } from './media-picker';
export function RichTextEditor({
  value,
  onChange,
}: {
  value: RichNode;
  onChange: (value: RichNode) => void;
}) {
  const [images, setImages] = useState(false),
    [link, setLink] = useState<string | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: false,
          protocols: ['https'],
          defaultProtocol: 'https',
        },
      }),
      Image.configure({ allowBase64: false }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichNode),
    editorProps: {
      attributes: {
        class: 'article-prose min-h-72 p-5 outline-none',
        role: 'textbox',
        'aria-label': 'Article content',
        'aria-multiline': 'true',
      },
    },
  });
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive('bold'),
      italic: editor?.isActive('italic'),
      h2: editor?.isActive('heading', { level: 2 }),
      h3: editor?.isActive('heading', { level: 3 }),
      bullet: editor?.isActive('bulletList'),
      ordered: editor?.isActive('orderedList'),
      quote: editor?.isActive('blockquote'),
    }),
  });
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value))
      editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);
  if (!editor) return <p role="status">Loading editor…</p>;
  const tools = [
    ['Bold', state?.bold, () => editor.chain().focus().toggleBold().run()],
    [
      'Italic',
      state?.italic,
      () => editor.chain().focus().toggleItalic().run(),
    ],
    [
      'Heading 2',
      state?.h2,
      () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    ],
    [
      'Heading 3',
      state?.h3,
      () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    ],
    [
      'Bullet list',
      state?.bullet,
      () => editor.chain().focus().toggleBulletList().run(),
    ],
    [
      'Numbered list',
      state?.ordered,
      () => editor.chain().focus().toggleOrderedList().run(),
    ],
    [
      'Quote',
      state?.quote,
      () => editor.chain().focus().toggleBlockquote().run(),
    ],
  ] as const;
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div
        role="toolbar"
        aria-label="Article formatting"
        className="flex flex-wrap gap-2 border-b bg-muted/50 p-3"
      >
        {tools.map(([label, active, action]) => (
          <Button
            key={label}
            type="button"
            size="xs"
            variant={active ? 'secondary' : 'outline'}
            aria-pressed={!!active}
            onClick={action}
          >
            {label}
          </Button>
        ))}
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() =>
            setLink(String(editor.getAttributes('link').href ?? ''))
          }
        >
          Add link
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          Remove link
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => setImages(true)}
        >
          Insert image
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          Undo
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          Redo
        </Button>
      </div>
      <EditorContent editor={editor} />
      {images && (
        <MediaPicker
          onClose={() => setImages(false)}
          onSelect={(media) => {
            editor.chain().focus().setImage({ src: media.url, alt: '' }).run();
            setImages(false);
          }}
        />
      )}
      <Dialog
        open={link !== null}
        onOpenChange={(open) => {
          if (!open) setLink(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link selected text</DialogTitle>
            <DialogDescription>
              Use a complete HTTPS URL. Select text in the editor before adding
              a link.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Link URL"
            value={link ?? ''}
            onChange={(e) => setLink(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => {
              try {
                const url = new URL(link ?? '');
                if (url.protocol !== 'https:') throw new Error();
                editor
                  .chain()
                  .focus()
                  .extendMarkRange('link')
                  .setLink({ href: url.href })
                  .run();
                setLink(null);
              } catch {
                toast.error('Enter a valid HTTPS URL.');
              }
            }}
          >
            Apply link
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
