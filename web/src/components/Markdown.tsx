import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  p: ({ children }) => (
    <p className="text-sm text-[var(--color-ink-muted)] leading-relaxed mb-2 last:mb-0">{children}</p>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--color-ink)]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className={`block text-xs ${className || ""}`}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-[var(--color-surface-sunken)] text-[var(--color-ink)] px-1.5 py-0.5 rounded text-xs font-[var(--font-mono)]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-[var(--color-surface-sunken)] rounded-[var(--radius-sm)] p-3 overflow-x-auto text-xs font-[var(--font-mono)] mb-2 last:mb-0">
      {children}
    </pre>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside ml-4 text-sm text-[var(--color-ink-muted)] space-y-0.5 mb-2 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside ml-4 text-sm text-[var(--color-ink-muted)] space-y-0.5 mb-2 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-[var(--color-ink)] mb-2 mt-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-[var(--color-ink)] mb-1.5 mt-3 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-1 mt-2 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-medium text-[var(--color-ink)] mb-1 mt-2 first:mt-0">{children}</h4>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-3 border-[var(--color-accent)] pl-3 my-2 text-sm text-[var(--color-ink-muted)] italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2 last:mb-0">
      <table className="markdown-table w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="bg-[var(--color-surface-sunken)] border border-[var(--color-border)] px-3 py-1.5 text-left text-xs font-semibold text-[var(--color-ink)]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)]">
      {children}
    </td>
  ),
  hr: () => <hr className="border-[var(--color-border)] my-3" />,
  img: ({ src, alt }) => (
    <img src={src} alt={alt || ""} className="max-w-full rounded-[var(--radius-sm)] my-2" />
  ),
};

export default function Markdown({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={`markdown-prose ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
