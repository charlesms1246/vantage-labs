"use client"

import { pixelify_sans } from '@/app/fonts';
import { truncateAddress } from '@/utils/formatters';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useRef, useState } from 'react';
import { IoSend } from "react-icons/io5";
import React from 'react';
import { useMarkdown } from '@/hooks/useMarkdown';

// Keys to omit from human-readable JSON rendering (internal LLM-to-LLM hints)
const SKIP_KEYS = new Set(['note', 'generated_by']);

// Renders a parsed JSON object as a human-readable key-value list.
// URL-valued keys become clickable links; imgbb URLs also render as inline images.
function renderJsonObject(obj: Record<string, unknown>, baseKey = ''): React.ReactNode {
    const entries = Object.entries(obj).filter(([k]) => !SKIP_KEYS.has(k));
    return (
        <div className="bg-background border border-foreground/20 rounded p-2 my-1 text-xs space-y-1">
            {entries.map(([key, val]) => {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                const strVal = typeof val === 'string' ? val : Array.isArray(val) ? val.join(', ') : String(val);
                const isUrl = typeof val === 'string' && /^https?:\/\//.test(val);
                const isImageUrl = isUrl && (/i\.ibb\.co/.test(val) || /picsum\.photos/.test(val));
                return (
                    <div key={`${baseKey}-${key}`} className="flex flex-col gap-0.5">
                        <span className="font-semibold text-foreground/70 capitalize">{label}</span>
                        {isImageUrl ? (
                            <div>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={strVal} alt={label} className="rounded max-w-[200px] max-h-[200px] object-cover my-1" />
                                <a href={strVal} target="_blank" rel="noopener noreferrer" className="text-foreground underline break-all">{strVal}</a>
                            </div>
                        ) : isUrl ? (
                            <a href={strVal} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{strVal}</a>
                        ) : (
                            <span className="text-foreground break-words">{strVal}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// Renders text with markdown [label](url) links and bare URLs as clickable <a> tags,
// pretty-prints fenced JSON code blocks, and formats bare JSON objects for readability.
function renderMessage(text: string): React.ReactNode {
    // Strip <think>...</think> blocks (internal model reasoning)
    const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // If the entire message is a JSON object, render it as a structured summary
    try {
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return renderJsonObject(parsed as Record<string, unknown>);
        }
    } catch { /* not pure JSON — continue with mixed-content rendering */ }

    // Split on JSON fenced code blocks: ```json ... ``` or ``` ... ```
    const parts: React.ReactNode[] = [];
    const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/g;
    let last = 0;
    let fm: RegExpExecArray | null;
    while ((fm = fenceRegex.exec(cleaned)) !== null) {
        if (fm.index > last) {
            // Check if the segment before this fence is itself bare JSON
            const seg = cleaned.slice(last, fm.index).trim();
            if (seg) parts.push(...renderTextSegment(seg, fm.index));
        }
        // Try to render fenced block as structured JSON; fall back to <pre>
        const block = fm[1].trim();
        try {
            const parsed = JSON.parse(block);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                parts.push(<div key={fm.index}>{renderJsonObject(parsed as Record<string, unknown>, String(fm.index))}</div>);
            } else {
                parts.push(<pre key={fm.index} className="bg-background border border-foreground/20 rounded p-2 text-xs overflow-x-auto my-1 whitespace-pre-wrap break-words">{JSON.stringify(parsed, null, 2)}</pre>);
            }
        } catch {
            parts.push(<pre key={fm.index} className="bg-background border border-foreground/20 rounded p-2 text-xs overflow-x-auto my-1 whitespace-pre-wrap break-words">{block}</pre>);
        }
        last = fm.index + fm[0].length;
    }
    if (last < cleaned.length) parts.push(...renderTextSegment(cleaned.slice(last), last));
    return <>{parts}</>;
}

// Renders a text segment, detecting and formatting any bare inline JSON objects.
function renderTextSegment(text: string, keyOffset: number): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    // Match top-level JSON objects { ... } in text (single-level brace matching)
    const jsonRe = /\{(?:[^{}]|\{[^{}]*\})*\}/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = jsonRe.exec(text)) !== null) {
        try {
            const parsed = JSON.parse(m[0]);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                if (m.index > last) nodes.push(...linkifySegment(text.slice(last, m.index)));
                nodes.push(<div key={keyOffset + m.index}>{renderJsonObject(parsed as Record<string, unknown>, String(keyOffset + m.index))}</div>);
                last = m.index + m[0].length;
            }
        } catch { /* not valid JSON — treat as plain text */ }
    }
    if (last < text.length) nodes.push(...linkifySegment(text.slice(last)));
    return nodes;
}

function linkifySegment(text: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>")\]]+)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
        if (m.index > last) nodes.push(text.slice(last, m.index));
        if (m[1] && m[2]) {
            nodes.push(<a key={m.index} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-foreground underline break-all hover:opacity-70">{m[1]}</a>);
        } else {
            nodes.push(<a key={m.index} href={m[3]} target="_blank" rel="noopener noreferrer" className="text-foreground underline break-all hover:opacity-70">{m[3]}</a>);
        }
        last = m.index + m[0].length;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
}

interface ChatMessage {
    id: string;
    message: string;
    timestamp: Date;
    address?: `0x${string}`;
    characterName: string;
}

interface ChatProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    disabled?: boolean;
}

const characterColors: { [key: string]: string } = {
    'Eric': 'text-emerald-600',
    'Harper': 'text-purple-600',
    'Rishi': 'text-amber-600',
    'Yasmin': 'text-rose-600',
    'You': 'text-blue-600'
};

// Component to render markdown messages
function MarkdownMessage({ text }: { text: string }) {
    const rendered = useMarkdown(text);
    return <>{rendered}</>;
}

const Chat = ({ messages, onSendMessage, disabled = false }: ChatProps) => {
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [message, setMessage] = useState('');
    const { user } = usePrivy();

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim()) {
            onSendMessage(message.trim());
            setMessage('');
        }
    };

    return (
        <div className={` ${pixelify_sans.className}
            transition-all duration-300 flex-1 md:flex-none
            md:w-full h-full max-h-screen md:relative
            ${isExpanded
                ? 'fixed inset-0 z-50 bg-card/95'
                : 'relative bg-card/80 backdrop-blur-sm rounded-lg h-14 md:h-full'
            }
        `}>
            <div className="flex flex-col h-full">
                <div
                    ref={chatContainerRef}
                    data-testid="chat-output"
                    className={`
                        overflow-y-auto p-4 space-y-4 flex-1
                        transition-all duration-300
                        ${isExpanded
                            ? 'h-[calc(100vh-8rem)]'
                            : 'h-0 md:h-[calc(100%-8rem)]'
                        }
                        ${!isExpanded && 'md:opacity-100 opacity-0'}
                    `}
                >
                    {messages.map((msg) => (
                        <div key={msg.id} className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className={`font-semibold text-sm ${characterColors[msg.characterName] || 'text-foreground'}`}>
                                    {msg.characterName} {msg.address && (`(${truncateAddress(msg.address)})`)}
                                </span>
                                <span className="text-xs text-foreground/60">
                                    {msg.timestamp.toLocaleTimeString()}
                                </span>
                            </div>
                            <div className="text-sm text-foreground break-words"><MarkdownMessage text={msg.message} /></div>
                        </div>
                    ))}
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="p-4 border-t border-foreground/20"
                >
                    <div className="flex gap-2 items-center">
                        <input
                            type="text"
                            data-testid="chat-input"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            disabled={disabled}
                            placeholder="Just ask..."
                            className="flex-1 px-4 py-2 rounded-lg bg-transparent
                                    border border-foreground/20 text-foreground placeholder-foreground/40
                                    focus:outline-none focus:ring-2 focus:ring-foreground/30"
                        />
                        <button
                            type="submit"
                            disabled={disabled || !message.trim()}
                            className="p-2 rounded-lg border border-foreground text-foreground
                                    hover:bg-foreground/10 focus:outline-none
                                    focus:ring-2 focus:ring-foreground/30
                                    disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <IoSend size={20} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Chat;
