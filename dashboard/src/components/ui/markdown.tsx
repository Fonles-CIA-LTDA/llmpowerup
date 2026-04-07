"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre({ children }) {
          return <pre className="my-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs">{children}</pre>;
        },
        code({ className, children, ...props }) {
          const isBlock = className?.startsWith("language-");
          if (isBlock) {
            return (
              <code className={`${className} text-green-300/80`} {...props}>
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-pink-300" {...props}>
              {children}
            </code>
          );
        },
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">
              {children}
            </a>
          );
        },
        ul({ children }) {
          return <ul className="list-disc pl-5 my-1 space-y-0.5">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-5 my-1 space-y-0.5">{children}</ol>;
        },
        h1({ children }) { return <h1 className="text-lg font-bold mt-3 mb-1">{children}</h1>; },
        h2({ children }) { return <h2 className="text-base font-bold mt-3 mb-1">{children}</h2>; },
        h3({ children }) { return <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>; },
        p({ children }) { return <p className="my-1">{children}</p>; },
        blockquote({ children }) {
          return <blockquote className="border-l-2 border-white/20 pl-3 my-2 text-white/60 italic">{children}</blockquote>;
        },
        table({ children }) {
          return <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>;
        },
        th({ children }) { return <th className="border border-white/10 px-2 py-1 text-left bg-white/5 font-medium">{children}</th>; },
        td({ children }) { return <td className="border border-white/10 px-2 py-1">{children}</td>; },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
