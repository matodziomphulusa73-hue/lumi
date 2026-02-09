
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Props {
  content: string;
}

const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="prose prose-invert max-w-none prose-pre:bg-slate-900 prose-pre:p-0 prose-code:text-blue-300"
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <div className="relative group">
               <div className="absolute right-2 top-2 text-xs text-slate-500 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                {match[1]}
              </div>
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                className="rounded-lg !mt-0 !mb-0 text-sm border border-slate-700 shadow-xl"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code className={`${className} bg-slate-800 px-1.5 py-0.5 rounded text-sm font-medium`} {...props}>
              {children}
            </code>
          );
        },
        p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-6 mb-4">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-6 mb-4">{children}</ol>,
        blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500 pl-4 italic my-4 text-slate-300">{children}</blockquote>,
        a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline transition-colors">{children}</a>,
        table: ({ children }) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-slate-700 border border-slate-700 rounded-lg">{children}</table></div>,
        th: ({ children }) => <th className="px-4 py-2 bg-slate-800 font-bold text-left">{children}</th>,
        td: ({ children }) => <td className="px-4 py-2 border-t border-slate-700">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;
