import { richDocumentSchema, type RichNode } from '@screenwise/shared';

// Rebuild only supported nodes/attributes. Never store or render arbitrary HTML.
export function sanitizeArticleDocument(input: unknown): RichNode {
  const clean = (n: RichNode): RichNode => {
    const result: RichNode = { type: n.type };
    if (n.type === 'text') result.text = n.text;
    if (n.type === 'heading') result.attrs = { level: Number(n.attrs!.level) };
    if (n.type === 'orderedList')
      result.attrs = { start: Number(n.attrs?.start ?? 1) };
    if (n.type === 'image')
      result.attrs = {
        src: String(n.attrs!.src),
        alt: String(n.attrs?.alt ?? ''),
        title: n.attrs?.title ? String(n.attrs.title) : null,
      };
    if (n.marks?.length)
      result.marks = n.marks.map((m) =>
        m.type === 'link'
          ? {
              type: 'link',
              attrs: {
                href: m.attrs!.href,
                target: '_blank',
                rel: 'noopener noreferrer',
              },
            }
          : { type: m.type },
      );
    if (n.content) result.content = n.content.map(clean);
    return result;
  };
  return clean(richDocumentSchema.parse(input));
}
export function articlePlainText(node: RichNode): string {
  if (node.type === 'hardBreak') return ' ';
  if (node.type === 'text') return node.text ?? '';
  const separator = ['paragraph', 'heading'].includes(node.type) ? '' : ' ';
  return (node.content ?? []).map(articlePlainText).join(separator);
}
export function articleReadingTime(content: RichNode, wordsPerMinute = 200) {
  if (!Number.isFinite(wordsPerMinute) || wordsPerMinute <= 0)
    throw new Error('Invalid reading speed');
  const text = articlePlainText(content).trim();
  const word_count = text ? text.split(/\s+/u).length : 0;
  return {
    word_count,
    reading_time_minutes: Math.max(1, Math.ceil(word_count / wordsPerMinute)),
  };
}
export function articleImageUrls(node: RichNode): string[] {
  return [
    ...new Set([
      ...(node.type === 'image' ? [String(node.attrs!.src)] : []),
      ...(node.content ?? []).flatMap(articleImageUrls),
    ]),
  ];
}
