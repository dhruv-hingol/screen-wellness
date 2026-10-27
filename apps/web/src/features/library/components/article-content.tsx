import type { ReactNode } from 'react';
import { richDocumentSchema, type RichNode } from '@screenwise/shared';
function plain(n: RichNode): string {
  return n.text ?? n.content?.map(plain).join('') ?? '';
}
const safeLink = (href: unknown) =>
  typeof href === 'string' && /^https:\/\//i.test(href) ? href : undefined;
export function ArticleContent({
  content,
  showContents = true,
}: {
  content: RichNode;
  showContents?: boolean;
}) {
  const result = richDocumentSchema.safeParse(content);
  if (!result.success)
    return (
      <p role="alert">This article content could not be displayed safely.</p>
    );
  const headings: { title: string; id: string }[] = [];
  const collect = (n: RichNode) => {
    if (n.type === 'heading')
      headings.push({
        title: plain(n),
        id: 'article-section-' + headings.length,
      });
    n.content?.forEach(collect);
  };
  collect(result.data);
  let heading = 0;
  const render = (n: RichNode, key: string): ReactNode => {
    const children = n.content?.map((child, i) => render(child, key + '-' + i));
    switch (n.type) {
      case 'doc':
        return <div key={key}>{children}</div>;
      case 'paragraph':
        return <p key={key}>{children}</p>;
      case 'heading': {
        const id = 'article-section-' + heading++;
        return Number(n.attrs?.level) === 3 ? (
          <h3 id={id} key={key}>
            {children}
          </h3>
        ) : (
          <h2 id={id} key={key}>
            {children}
          </h2>
        );
      }
      case 'text': {
        let value: ReactNode = n.text;
        for (const [i, m] of (n.marks ?? []).entries()) {
          if (m.type === 'bold') value = <strong key={i}>{value}</strong>;
          if (m.type === 'italic') value = <em key={i}>{value}</em>;
          if (m.type === 'strike') value = <s key={i}>{value}</s>;
          if (m.type === 'underline') value = <u key={i}>{value}</u>;
          if (m.type === 'link' && safeLink(m.attrs?.href))
            value = (
              <a
                key={i}
                href={safeLink(m.attrs?.href)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {value}
              </a>
            );
        }
        return <span key={key}>{value}</span>;
      }
      case 'bulletList':
        return <ul key={key}>{children}</ul>;
      case 'orderedList':
        return (
          <ol key={key} start={Number(n.attrs?.start ?? 1)}>
            {children}
          </ol>
        );
      case 'listItem':
        return <li key={key}>{children}</li>;
      case 'blockquote':
        return <blockquote key={key}>{children}</blockquote>;
      case 'hardBreak':
        return <br key={key} />;
      case 'image': {
        const src = String(n.attrs?.src ?? '');
        const prefix =
          String(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '') +
          '/storage/v1/object/public/article-media/articles/';
        return src.startsWith(prefix) && /^https:\/\//.test(src) ? (
          <img
            key={key}
            src={src}
            alt={String(n.attrs?.alt ?? '')}
            loading="lazy"
          />
        ) : null;
      }
    }
  };
  return (
    <>
      {showContents && headings.length >= 3 && (
        <nav
          aria-label="Table of contents"
          className="mb-8 rounded-xl border bg-muted/40 p-5"
        >
          <p className="mb-3 font-semibold">In this article</p>
          <ol className="space-y-2 text-sm">
            {headings.map((h) => (
              <li key={h.id}>
                <a href={'#' + h.id} className="text-primary hover:underline">
                  {h.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="article-prose">{render(result.data, 'root')}</div>
    </>
  );
}
