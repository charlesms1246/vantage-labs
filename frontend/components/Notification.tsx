import { truncateAddress } from '@/utils/formatters';
import Image from 'next/image';
import React from 'react';

// Renders JSON object as formatted key-value pairs (for orchestrator events)
function renderJsonMessage(message: string): React.ReactNode {
    try {
        const parsed = JSON.parse(message);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return null; // Not a valid object to render
        }

        return (
            <div className="space-y-2 text-sm">
                {Object.entries(parsed).map(([key, value]) => {
                    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                    const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
                    return (
                        <div key={key} className="flex gap-2">
                            <span className="font-semibold text-foreground/70 min-w-fit">{label}:</span>
                            <span className="text-foreground break-words flex-1">{displayValue}</span>
                        </div>
                    );
                })}
            </div>
        );
    } catch {
        return null; // Not JSON, will be handled by linkify
    }
}

// Renders plain text with URLs converted to clickable <a> tags and markdown [text](url) links resolved
function linkify(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    // Match markdown links [label](url) OR bare https?:// URLs
    const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>")\]]+)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index));
        if (m[1] && m[2]) {
            // markdown link
            parts.push(<a key={m.index} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-foreground underline break-all hover:opacity-70">{m[1]}</a>);
        } else {
            // bare URL
            parts.push(<a key={m.index} href={m[3]} target="_blank" rel="noopener noreferrer" className="text-foreground underline break-all hover:opacity-70">{m[3]}</a>);
        }
        last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
}

interface NotificationProps {
    message: string;
    timestamp: Date;
    characterName: string;
    eventName?: string;
    metadata?: Record<string, string>;
}

const Notification = ({ message, timestamp, characterName, eventName, metadata }: NotificationProps) => {
    const getEventTagClass = (event: string) => {
        return 'border border-foreground text-foreground bg-transparent';
    };

    const getCharacterNameClass = (name: string) => {
        const lowerName = name.toLowerCase();
        switch (lowerName) {
            case 'eric':
                return 'text-green-500';
            case 'harper':
                return 'text-purple-500';
            case 'rishi':
                return 'text-amber-500';
            case 'yasmin':
                return 'text-rose-500';
            default:
                return 'text-black';
        }
    };

    const getBackgroundClass = (name: string) => {
        return 'bg-background';
    };

    const getBorderClass = (name: string) => {
        return 'border-foreground/20';
    };

    const renderMetadataValue = (key: string, value: string) => {
        if (key === 'walletAddress' || key === 'contractAddress' ||
            key === 'fromAddress' || key === 'toAddress' ||
            key === 'poolAddress' || key === 'tokenAddress') {
            return truncateAddress(value);
        }
        if (key === 'requestedAmount' || key === 'amount' || key === 'totalSupply') {
            return `${parseFloat(value) / 1e18} ETH`;
        }
        return value;
    };

    const getExternalLink = (eventName: string, metadata: Record<string, string>): string | null => {
        switch (eventName) {
            case 'contract_deployed':
                return `https://basescan.org/address/${metadata.contractAddress}`;
            case 'uniswap_pool_created':
                return `https://dexscreener.com/base/${metadata.poolAddress.toLowerCase()}`;
            case 'nft_created':
                return `https://zora.co/collect/zora:${metadata.contractAddress.toLowerCase()}`;
            case 'tweet_created':
                return `https://x.com/i/${metadata.tweetId}`;
            default:
                return null;
        }
    };

    return (
        <div
            className={`relative p-4 mb-2 rounded-lg shadow-sm ${getBackgroundClass(characterName)} ${getBorderClass(characterName)} border-2 ${['contract_deployed', 'uniswap_pool_created', 'nft_created'].includes(eventName || '') ? 'cursor-pointer hover:opacity-90' : ''
                } text-foreground`}
            onClick={() => {
                const link = metadata && eventName ? getExternalLink(eventName, metadata) : null;
                if (link) {
                    window.open(link, '_blank');
                }
            }}
        >
            <div className="flex flex-col gap-2 w-full">
                <div className="flex items-start justify-between gap-2 w-full">
                    <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <span className={`font-semibold truncate ${getCharacterNameClass(characterName)}`}>
                            {characterName}
                        </span>
                        {eventName && (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${getEventTagClass(eventName)} shrink-0`}>
                                {eventName.replace('_', ' ')}
                            </span>
                        )}
                    </div>
                    <span className="text-xs text-foreground/60 shrink-0">
                        {timestamp.toLocaleTimeString()}
                    </span>
                </div>

                <div className={`text-sm w-full text-foreground ${eventName === 'system' ? 'font-black' : ''}`}>
                    {(() => {
                        // Try JSON rendering for orchestrator/system events
                        if (eventName === 'system' || characterName === 'Orchestrator') {
                            const jsonRendered = renderJsonMessage(message);
                            if (jsonRendered) return jsonRendered;
                        }
                        // Fall back to linkify
                        return <div className="whitespace-pre-wrap break-words">{linkify(message)}</div>;
                    })()}
                </div>

                {metadata && (
                    <div className="mt-1 p-2 rounded-md bg-background border border-foreground/20 text-xs font-mono w-full text-foreground">
                        {eventName === "image_created" && metadata.url && (
                            <Image
                                src={metadata.url}
                                unoptimized={true}
                                alt="Generated image"
                                width={250}
                                height={250}
                                className="rounded-md"
                            />
                        )}
                        {eventName === "basename_managed" && metadata.basename && (
                            <div className="text-xs font-mono">
                                {metadata.walletAddress && truncateAddress(metadata.walletAddress as `0x${string}`)}
                            </div>
                        )}
                        {eventName === "uniswap_pool_created" && (
                            <Image
                                src={"https://i.pinimg.com/originals/1d/cc/84/1dcc8458abdeee8e528d7996047d1000.jpg"}
                                unoptimized={true}
                                alt="Uniswap pool"
                                width={250}
                                height={250}
                                className="rounded-md"
                            />
                        )}
                        {eventName === "nft_created" && (
                            <Image
                                src={"https://avatars.githubusercontent.com/u/60056322?s=280&v=4"}
                                unoptimized={true}
                                alt="NFT"
                                width={250}
                                height={250}
                                className="rounded-md"
                            />
                        )}
                        {eventName === "contract_deployed" && (
                            <Image
                                src={"https://images.mirror-media.xyz/publication-images/cgqxxPdUFBDjgKna_dDir.png?height=1200&width=1200"}
                                unoptimized={true}
                                alt="Contract deployed"
                                width={250}
                                height={250}
                                className="rounded-md"
                            />
                        )}
                        <div className="grid grid-cols-1 gap-1">
                            {Object.entries(metadata).map(([key, value]) => (
                                <div key={key} className="flex items-center gap-2">
                                    <span className="text-foreground font-medium capitalize shrink-0">
                                        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                                    </span>
                                    <span className="text-foreground truncate">
                                        {renderMetadataValue(key, value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notification;
