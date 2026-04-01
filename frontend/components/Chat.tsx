"use client"

import { pixelify_sans } from '@/app/fonts';
import { truncateAddress } from '@/utils/formatters';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useRef, useState } from 'react';
import { IoSend } from "react-icons/io5";
import React from 'react';

// Renders text with markdown [label](url) links and bare URLs as clickable <a> tags,
// and pretty-prints any embedded JSON code blocks for readability.
function renderMessage(text: string): React.ReactNode {
    // Strip <think>...</think> blocks (internal model reasoning)
    const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // Split on JSON fenced code blocks: ```json ... ``` or ``` ... ```
    const parts: React.ReactNode[] = [];
    const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/g;
    let last = 0;
    let fm: RegExpExecArray | null;
    while ((fm = fenceRegex.exec(cleaned)) !== null) {
        if (fm.index > last) parts.push(...linkifySegment(cleaned.slice(last, fm.index)));
        // Try to pretty-print if JSON
        let block = fm[1].trim();
        try {
            block = JSON.stringify(JSON.parse(block), null, 2);
        } catch { /* not JSON — show as-is */ }
        parts.push(
            <pre key={fm.index} className="bg-gray-100 rounded p-2 text-xs overflow-x-auto my-1 whitespace-pre-wrap break-words">{block}</pre>
        );
        last = fm.index + fm[0].length;
    }
    if (last < cleaned.length) parts.push(...linkifySegment(cleaned.slice(last)));
    return <>{parts}</>;
}

function linkifySegment(text: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>")\]]+)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
        if (m.index > last) nodes.push(text.slice(last, m.index));
        if (m[1] && m[2]) {
            nodes.push(<a key={m.index} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all hover:text-blue-800">{m[1]}</a>);
        } else {
            nodes.push(<a key={m.index} href={m[3]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all hover:text-blue-800">{m[3]}</a>);
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
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`
                        p-4 border-b border-gray-200 cursor-pointer
                        flex items-center gap-3
                        md:cursor-default h-14 shrink-0
                    `}
                >
                    <div className="flex-1 flex items-center gap-2">
                        <h2 className="font-semibold tracking-tight text-2xl text-blue-900 flex items-center gap-2">
                            Chat History
                            {user?.wallet?.address && (
                                <span className="text-sm font-normal text-gray-600">
                                    ({truncateAddress(user.wallet.address)})
                                </span>
                            )}
                        </h2>
                        <button className="md:hidden ml-auto">
                            {isExpanded ? '✕' : '↑'}
                        </button>
                    </div>
                </div>
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
                                <span className={`font-semibold text-sm ${characterColors[msg.characterName] || 'text-gray-600'}`}>
                                    {msg.characterName} {msg.address && (`(${truncateAddress(msg.address)})`)}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {msg.timestamp.toLocaleTimeString()}
                                </span>
                            </div>
                            <div className="text-sm text-gray-700 break-words whitespace-pre-wrap">{renderMessage(msg.message)}</div>
                        </div>
                    ))}
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="p-4 border-t border-gray-200"
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
                                    border border-navy-600/20 text-black placeholder-navy-400
                                    focus:outline-none focus:ring-2 focus:ring-navy-300"
                        />
                        <button
                            type="submit"
                            disabled={disabled || !message.trim()}
                            className="p-2 rounded-lg bg-primary text-white
                                    hover:bg-primary/90 focus:outline-none
                                    focus:ring-2 focus:ring-navy-300
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
