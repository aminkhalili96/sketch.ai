'use client';

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownContentProps {
    content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
    return (
        <div className="prose prose-sm max-w-none prose-neutral">
            <ReactMarkdown
                components={{
                    code: ({ className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;
                        return isInline ? (
                            <code className="px-1 py-0.5 rounded bg-neutral-100 text-sm font-mono" {...props}>
                                {children}
                            </code>
                        ) : (
                            <SyntaxHighlighter
                                language={match[1]}
                                style={oneLight}
                                customStyle={{ borderRadius: '0.5rem', fontSize: '13px' }}
                            >
                                {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                        );
                    },
                    p: ({ children }) => <p className="m-0">{children}</p>,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
