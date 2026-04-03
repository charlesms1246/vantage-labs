"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMemo } from 'react';
import React from 'react';

export function useMarkdown(text: string): React.ReactNode {
    return useMemo(() => {
        // Strip <think>...</think> blocks (internal model reasoning)
        const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        if (!cleaned) return null;

        return (
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground underline break-all hover:opacity-70"
                        >
                            {children}
                        </a>
                    ),
                    p: ({ children }) => (
                        <p className="mb-2 last:mb-0 text-foreground break-words">
                            {children}
                        </p>
                    ),
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside space-y-1 mb-2 text-foreground">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside space-y-1 mb-2 text-foreground">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => (
                        <li className="text-foreground break-words">
                            {children}
                        </li>
                    ),
                    code: (props: any) => {
                        const { inline, children } = props;
                        if (inline) {
                            return (
                                <code className="bg-foreground/10 rounded px-1.5 py-0.5 text-xs font-mono text-foreground">
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code className="block bg-background border border-foreground/20 rounded p-2 text-xs overflow-x-auto my-2 whitespace-pre break-words text-foreground font-mono">
                                {children}
                            </code>
                        );
                    },
                    pre: ({ children }) => (
                        <pre className="bg-background border border-foreground/20 rounded p-2 text-xs overflow-x-auto my-2 whitespace-pre-wrap break-words text-foreground">
                            {children}
                        </pre>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-foreground/40 pl-3 py-1 my-2 text-foreground/80 italic">
                            {children}
                        </blockquote>
                    ),
                    h1: ({ children }) => (
                        <h1 className="text-lg font-bold mb-2 mt-3 text-foreground">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-base font-bold mb-1.5 mt-2.5 text-foreground">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-sm font-bold mb-1 mt-2 text-foreground">
                            {children}
                        </h3>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-bold text-foreground">
                            {children}
                        </strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic text-foreground">
                            {children}
                        </em>
                    ),
                    table: ({ children }) => (
                        <table className="border-collapse border border-foreground/20 text-xs mb-2 text-foreground">
                            {children}
                        </table>
                    ),
                    th: ({ children }) => (
                        <th className="border border-foreground/20 px-2 py-1 bg-foreground/10 text-left">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="border border-foreground/20 px-2 py-1">
                            {children}
                        </td>
                    ),
                }}
            >
                {cleaned}
            </ReactMarkdown>
        );
    }, [text]);
}
