import { z } from 'zod';

export const contentSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .min(2)
  .max(150);
export const mediaPathSchema = z
  .string()
  .regex(/^articles\/[0-9a-f-]{36}\.webp$/);
export const sourceSchema = z.strictObject({
  title: z.string().trim().min(3).max(200),
  source_url: z
    .url()
    .max(2000)
    .refine((v) => v.startsWith('https://'), 'Use an HTTPS source URL'),
  publisher: z.string().trim().max(150).nullable(),
});
export interface RichMark {
  type: 'bold' | 'italic' | 'strike' | 'underline' | 'link';
  attrs?: {
    href: string;
    target?: string | null;
    rel?: string | null;
    class?: string | null;
  };
}
export interface RichNode {
  type:
    | 'doc'
    | 'paragraph'
    | 'heading'
    | 'text'
    | 'bulletList'
    | 'orderedList'
    | 'listItem'
    | 'blockquote'
    | 'hardBreak'
    | 'image';
  text?: string;
  attrs?: Record<string, string | number | null>;
  marks?: RichMark[];
  content?: RichNode[];
}
// Validate shape before traversing; cap both tree depth and total nodes before recursion.
export const richDocumentSchema = z
  .custom<RichNode>()
  .superRefine((input, ctx) => {
    let count = 0,
      textLength = 0;
    const visit = (value: unknown, depth: number, parent?: string): void => {
      const fail = (message: string) =>
        ctx.addIssue({ code: 'custom', message });
      if (++count > 2500 || depth > 12) {
        fail('Article content is too complex.');
        return;
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        fail('Invalid rich-text node.');
        return;
      }
      const n = value as RichNode;
      const allowed = [
        'doc',
        'paragraph',
        'heading',
        'text',
        'bulletList',
        'orderedList',
        'listItem',
        'blockquote',
        'hardBreak',
        'image',
      ];
      if (
        !allowed.includes(n.type) ||
        Object.keys(n).some(
          (k) => !['type', 'text', 'attrs', 'marks', 'content'].includes(k),
        )
      ) {
        fail('Unsupported rich-text element.');
        return;
      }
      if ((!parent && n.type !== 'doc') || (parent && n.type === 'doc'))
        fail('Content must have one document root.');
      const inline = ['text', 'hardBreak'];
      if (
        parent &&
        ((['paragraph', 'heading'].includes(parent) &&
          !inline.includes(n.type)) ||
          (['doc', 'blockquote', 'listItem'].includes(parent) &&
            (inline.includes(n.type) || n.type === 'listItem')) ||
          (['bulletList', 'orderedList'].includes(parent) &&
            n.type !== 'listItem'))
      )
        fail('Invalid rich-text nesting.');
      if (n.type === 'text') {
        if (typeof n.text !== 'string' || n.text.length > 20000)
          fail('Invalid article text.');
        else textLength += n.text.length;
      } else if (n.text !== undefined)
        fail('Text is only permitted on text nodes.');
      if (n.attrs !== undefined) {
        if (!n.attrs || typeof n.attrs !== 'object' || Array.isArray(n.attrs)) {
          fail('Invalid element attributes.');
          return;
        }
        const allowedAttrs =
          n.type === 'heading'
            ? ['level']
            : n.type === 'orderedList'
              ? ['start', 'type']
              : n.type === 'image'
                ? ['src', 'alt', 'title', 'width', 'height']
                : [];
        if (Object.keys(n.attrs).some((k) => !allowedAttrs.includes(k)))
          fail('Unsupported element attribute.');
        if (n.type === 'heading' && ![2, 3].includes(Number(n.attrs.level)))
          fail('Use heading level 2 or 3.');
        if (
          n.type === 'orderedList' &&
          n.attrs.start !== undefined &&
          (!Number.isInteger(n.attrs.start) ||
            Number(n.attrs.start) < 1 ||
            Number(n.attrs.start) > 10000)
        )
          fail('Invalid list start.');
        if (
          n.type === 'image' &&
          (typeof n.attrs.src !== 'string' ||
            !n.attrs.src.startsWith('https://') ||
            n.attrs.src.length > 2000)
        )
          fail('Images require an approved HTTPS media URL.');
        if (
          n.type === 'image' &&
          [n.attrs.alt, n.attrs.title].some(
            (v) =>
              v !== undefined &&
              v !== null &&
              (typeof v !== 'string' || v.length > 500),
          )
        )
          fail('Invalid image description.');
      }
      if (n.type === 'heading' && !n.attrs) fail('Choose a heading level.');
      if (n.type === 'image' && !n.attrs) fail('Choose an image.');
      if (n.marks !== undefined) {
        if (
          n.type !== 'text' ||
          !Array.isArray(n.marks) ||
          n.marks.length > 5
        ) {
          fail('Invalid text formatting.');
          return;
        }
        for (const m of n.marks) {
          if (
            !m ||
            !['bold', 'italic', 'strike', 'underline', 'link'].includes(
              m.type,
            ) ||
            Object.keys(m).some((k) => !['type', 'attrs'].includes(k))
          ) {
            fail('Unsupported text formatting.');
            continue;
          }
          if (m.type === 'link') {
            if (
              !m.attrs ||
              Object.keys(m.attrs).some(
                (k) => !['href', 'target', 'rel', 'class'].includes(k),
              ) ||
              typeof m.attrs.href !== 'string' ||
              !z
                .url()
                .max(2000)
                .refine((v) => v.startsWith('https://'))
                .safeParse(m.attrs.href).success
            )
              fail('Links must use a valid HTTPS URL.');
          } else if (m.attrs !== undefined)
            fail('Unsupported formatting attributes.');
        }
      }
      if (n.content !== undefined) {
        if (
          !Array.isArray(n.content) ||
          n.content.length > 1000 ||
          ['text', 'image', 'hardBreak'].includes(n.type)
        ) {
          fail('Invalid element content.');
          return;
        }
        for (const child of n.content) {
          if (count > 2500) break;
          visit(child, depth + 1, n.type);
        }
      }
    };
    visit(input, 0);
    if (textLength > 80000)
      ctx.addIssue({
        code: 'custom',
        message: 'Article text exceeds 80,000 characters.',
      });
  })
  .transform((v) => v as RichNode);
export const articleInputSchema = z.strictObject({
  title: z.string().trim().min(3).max(180),
  slug: contentSlugSchema,
  summary: z.string().trim().max(600),
  category_id: z.uuid(),
  content: richDocumentSchema,
  cover_image_path: mediaPathSchema.nullable(),
  tag_ids: z
    .array(z.uuid())
    .max(20)
    .refine((v) => new Set(v).size === v.length, 'Choose distinct tags.'),
  sources: z.array(sourceSchema).max(20),
  is_featured: z.boolean(),
  editorial_reviewed: z.boolean(),
  revision: z.number().int().min(1).optional(),
});
export const categoryInputSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  slug: contentSlugSchema,
  description: z.string().trim().max(1000).nullable(),
  icon: z.string().max(60).nullable(),
  display_order: z.number().int().min(0).max(9999),
  is_active: z.boolean(),
});
export const tagInputSchema = z.strictObject({
  name: z.string().trim().min(2).max(60),
  slug: contentSlugSchema,
});
export const articleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
  search: z.string().trim().max(100).default(''),
  categoryId: z.uuid().optional(),
  tagId: z.uuid().optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  featured: z.enum(['true', 'false']).optional(),
});
export const articleTransitionSchema = z.strictObject({
  revision: z.number().int().min(1),
});
export const bookmarkInputSchema = z.strictObject({ articleId: z.uuid() });
export type ArticleInput = z.infer<typeof articleInputSchema>;
export type ArticleQuery = z.infer<typeof articleQuerySchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type TagInput = z.infer<typeof tagInputSchema>;
export interface ArticleCategory extends CategoryInput {
  id: string;
  created_at: string;
  updated_at: string;
}
export interface ArticleTag extends TagInput {
  id: string;
}
export interface ArticleMedia {
  id: string;
  path: string;
  url: string;
  created_at: string;
  status: 'READY' | 'DELETING';
}
export interface Article extends Omit<ArticleInput, 'revision'> {
  id: string;
  revision: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  reading_time_minutes: number;
  word_count: number;
  author_id: string | null;
  author_name: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category: ArticleCategory;
  tags: ArticleTag[];
  cover_image_url: string | null;
  is_bookmarked: boolean;
}
export interface BookmarkEntry {
  id: string;
  article_id: string;
  created_at: string;
  article: Article | null;
}
export interface ContentSummary {
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  categories: number;
  activeActivities: number;
  activeRules: number;
}
