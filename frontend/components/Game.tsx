"use client";

import {
    AGENT_ZONE_KEYS,
    AI_MOVE_DURATION_MAX,
    AI_MOVE_DURATION_MIN,
    AI_MOVE_SPEED,
    AI_PAUSE_DURATION_MAX,
    AI_PAUSE_DURATION_MIN,
    ANIMATION_FRAMES,
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    DEBUG_CHARACTER_SELECT_BOXES,
    DEBUG_WALKABLE_AREAS,
    DIRECTIONS,
    FRAME_DURATION,
    MAP_OFFSET_X,
    MAP_OFFSET_Y,
    PLAYER_MOVE_SPEED,
    SCALE_FACTOR,
    SPRITE_DISPLAY_SIZE,
    SPRITE_SIZE,
    WALKABLE_POLYGONS
} from '@/utils/properties';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSession } from '@/contexts/SessionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Character } from './Character';
import Chat from './Chat';
import { ChatEventsPanel } from './ChatEventsPanel';
import { GameContainer } from './GameContainer';
import { God } from './God';
import NotificationBoard from './NotificationBoard';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { WalletAddress } from './WalletAddress';
import PrivyAuthButton from './PrivyAuthButton';

// Function to get a random integer between min and max
function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Interface for player state
interface PlayerState {
    x: number;
    y: number;
    direction: 'up' | 'down' | 'left' | 'right';
    isMoving: boolean;
    message: string | null;
    messageTimeoutId?: NodeJS.Timeout;
    ai?: {
        action: 'moving' | 'paused';
        actionEndTime: number;
    };
}


// Helper function to check if two bounds overlap
function isOverlapping(
    bounds1: { x: number; y: number; width: number; height: number; },
    bounds2: { x: number; y: number; width: number; height: number; }
): boolean {
    const center1 = {
        x: bounds1.x + bounds1.width / 2,
        y: bounds1.y + bounds1.height / 2
    };

    const center2 = {
        x: bounds2.x + bounds2.width / 2,
        y: bounds2.y + bounds2.height / 2
    };

    // Calculate distance between centers
    const dx = Math.abs(center1.x - center2.x);
    const dy = Math.abs(center1.y - center2.y);

    // Calculate minimum distance required between centers
    const minDistanceX = (bounds1.width + bounds2.width) / 2;
    const minDistanceY = (bounds1.height + bounds2.height) / 2;

    return dx < minDistanceX && dy < minDistanceY;
}

// Helper function to check if a point is inside a polygon using ray casting algorithm
function isPointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

// Function to check if a character would collide with others at the given position
function checkCharacterCollision(
    playerStates: PlayerState[],
    characterIndex: number,
    newX: number,
    newY: number
): boolean {
    // Collision box at 95% of character display size
    const width = SPRITE_DISPLAY_SIZE * 0.95;
    const height = SPRITE_DISPLAY_SIZE * 0.95;

    const newBounds = {
        x: newX,
        y: newY,
        width,
        height,
    };

    return playerStates.some((state, index) => {
        if (index === characterIndex) return false;
        if (!state) return false;

        const otherBounds = {
            x: state.x,
            y: state.y,
            width,
            height,
        };

        const buffer = 8;
        const expandedBounds = {
            x: otherBounds.x - buffer,
            y: otherBounds.y - buffer,
            width: otherBounds.width + buffer * 2,
            height: otherBounds.height + buffer * 2
        };

        return isOverlapping(newBounds, expandedBounds);
    });
}

// Check if a character sprite is within canvas bounds (using raw map coordinates)
function isWithinCanvasBounds(x: number, y: number): boolean {
    return (
        x >= 0 &&
        x + SPRITE_DISPLAY_SIZE <= CANVAS_WIDTH &&
        y >= 0 &&
        y + SPRITE_DISPLAY_SIZE <= CANVAS_HEIGHT
    );
}

const Game = ({ userId, walletAddress }: { userId: string, walletAddress: string }) => {
    const { theme } = useTheme();
    const { authenticated } = usePrivy();
    const mapSrc = theme === 'dark'
        ? '/maps/nyc_trading_floor_night.png'
        : '/maps/nyc_trading_floor_day.png';

    // Refs
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const mapRef = useRef<HTMLImageElement | null>(null);
    const lastRenderTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>(0);
    const { sessionId } = useSession();

    // State variables
    const [isInitialized, setIsInitialized] = useState(false);
    const [playerStates, setPlayerStates] = useState<PlayerState[]>([]);
    const [controlledCharacterIndex, setControlledCharacterIndex] = useState<number | null>(null);
    const [isInputActive, setIsInputActive] = useState<boolean>(false);
    const [isHoveredIndex, setIsHoveredIndex] = useState<number | null>(null);
    const [inputValue, setInputValue] = useState<string>('');
    const [notifications, setNotifications] = useState<any[]>([]);
    const [chatMessages, setChatMessages] = useState<{
        id: string;
        message: string;
        timestamp: Date;
        characterName: string;
        address?: `0x${string}`;
    }[]>([]);

    // Store Character instances in a ref to ensure they are only created once
    const charactersRef = useRef<Character[] | null>(null);

    // Add godRef to store the God instance
    const godRef = useRef<God | null>(null);

    // Stable function references using useCallback
    const handleCharacterMessage = useCallback((index: number, messageChunk: string) => {
        setPlayerStates((prevStates) => {
            const newStates = [...prevStates];
            const currentState = newStates[index];

            // If there's an existing timeout, clear it since we're still receiving chunks
            if (currentState?.messageTimeoutId) {
                clearTimeout(currentState.messageTimeoutId);
            }

            // Set the message in player state (for speech bubble)
            const timeoutId = setTimeout(() => {
                setPlayerStates((states) => {
                    const clearedStates = [...states];
                    if (clearedStates[index]) {
                        clearedStates[index] = {
                            ...clearedStates[index],
                            message: null,
                            messageTimeoutId: undefined,
                        };
                    }
                    return clearedStates;
                });
            }, 8000);

            newStates[index] = {
                ...currentState,
                message: messageChunk,
                messageTimeoutId: timeoutId
            };

            return newStates;
        });

        // Only add non-empty messages to chat history
        if (messageChunk.trim()) {
            const characterName = charactersRef.current?.[index]?.name || `Character ${index}`;
            setChatMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                message: messageChunk,
                timestamp: new Date(),
                characterName: characterName,
                address: charactersRef.current?.[index]?.address || undefined,
            }].slice(-50));
        }
    }, []);

    const handleCharacterError = useCallback((index: number, error: string) => {
        setPlayerStates((prevStates) => {
            const newStates = [...prevStates];
            newStates[index] = {
                ...newStates[index],
                message: error,
            };
            return newStates;
        });

        // Clear the error message after 5 seconds
        setTimeout(() => {
            setPlayerStates((prevStates) => {
                const newStates = [...prevStates];
                if (newStates[index]) {
                    newStates[index] = {
                        ...newStates[index],
                        message: null,
                    };
                }
                return newStates;
            });
        }, 5000);
    }, []);

    // Maps agent name → character index (0-based, matches Character array order)
    const AGENT_CHARACTER_INDEX: Record<string, number> = {
        eric: 0,
        harper: 1,
        rishi: 2,
        yasmin: 3,
    };

    const handleGodMessage = useCallback((message: string) => {
        // Try to parse as a structured agent event
        try {
            const parsed = JSON.parse(message);

            // agent_response with tool_use status → add tool call to chat
            if (parsed.type === "agent_response" && parsed.status === "tool_use") {
                const agentName = parsed.agent ?? "Agent";
                const toolName: string = parsed.toolName ?? "unknown_tool";
                const toolResult: string = typeof parsed.toolResult === "string"
                    ? parsed.toolResult
                    : JSON.stringify(parsed.toolResult ?? "");

                // For Yasmin's image tool, embed the image as markdown
                let messageText = "";
                if (agentName.toLowerCase() === "yasmin" && toolName === "generate_image") {
                    let imageUrl: string | undefined;
                    try {
                        const r = JSON.parse(toolResult);
                        imageUrl = r?.url ?? r?.imgbbUrl ?? r?.lighthouseUrl;
                    } catch {
                        /* ignore */
                    }
                    const imageUrlRe = /(https:\/\/i\.ibb\.co\/[^\s)">\]]+|https:\/\/gateway\.lighthouse\.storage\/ipfs\/[^\s)">\]]+|https:\/\/picsum\.photos\/[^\s)">\]]+)/;
                    if (!imageUrl) imageUrl = imageUrlRe.exec(toolResult)?.[0];
                    const desc = (() => {
                        try {
                            return JSON.parse(toolResult)?.description ?? "";
                        } catch {
                            return "";
                        }
                    })();
                    messageText = imageUrl
                        ? `🎨 **generate_image**\n\n![Generated Image](${imageUrl})${desc ? `\n\n${desc}` : ""}`
                        : `🎨 **generate_image**\n\n${toolResult.slice(0, 300)}`;
                } else {
                    // Generic tool result: show name + truncated result
                    const preview = toolResult.length > 300 ? toolResult.slice(0, 300) + "…" : toolResult;
                    messageText = `🔧 **${toolName}**\n\n${preview}`;
                }

                setChatMessages((prev) =>
                    [
                        ...prev,
                        {
                            id: crypto.randomUUID(),
                            message: messageText,
                            timestamp: new Date(),
                            characterName: agentName,
                        },
                    ].slice(-50)
                );
                return;
            }

            // agent_response "executing" → show which agent started its task
            if (parsed.type === "agent_response" && parsed.status === "executing") {
                const agentName = parsed.agent ?? "Agent";
                const taskPreview = typeof parsed.task === "string"
                    ? parsed.task.slice(0, 120) + (parsed.task.length > 120 ? "…" : "")
                    : "";
                setNotifications(prev => [{
                    id: crypto.randomUUID(),
                    message: `${agentName} → ${taskPreview}`,
                    timestamp: new Date(),
                    metadata: { agent: parsed.agent, status: "executing" },
                }, ...prev].slice(0, 50));
                return;
            }

            // agent_response with a completed result → add to notifications
            // (Character.tsx's own agent_response listener handles speech bubbles + chat history)
            if (parsed.type === "agent_response" && parsed.status === "complete" && parsed.result) {
                const resultText = typeof parsed.result === "string"
                    ? parsed.result
                    : JSON.stringify(parsed.result);

                // Extract an imgbb, Lighthouse, or picsum image URL if present (for inline image display).
                // Try JSON parse first so we get the URL even when the LLM doesn't repeat it verbatim.
                const IMAGE_URL_RE = /(https:\/\/i\.ibb\.co\/[^\s)">\]]+|https:\/\/gateway\.lighthouse\.storage\/ipfs\/[^\s)">\]]+|https:\/\/picsum\.photos\/[^\s)">\]]+)/;
                let imageUrl: string | undefined;
                try {
                    const parsed_result = JSON.parse(resultText);
                    imageUrl = parsed_result?.url ?? parsed_result?.imgbbUrl ?? parsed_result?.lighthouseUrl;
                    // Validate it looks like an image host URL
                    if (imageUrl && !IMAGE_URL_RE.test(imageUrl)) imageUrl = undefined;
                } catch { /* not JSON — fall back to regex scan */ }
                if (!imageUrl) {
                    imageUrl = IMAGE_URL_RE.exec(resultText)?.[0];
                }

                setNotifications(prev => [{
                    id: crypto.randomUUID(),
                    message: `[${parsed.agent ?? "Agent"}] ${resultText}`,
                    timestamp: new Date(),
                    metadata: {
                        agent: parsed.agent,
                        status: parsed.status,
                        ...(imageUrl ? { url: imageUrl } : {}),
                    },
                }, ...prev].slice(0, 50));
                return;
            }

            // agent_thinking → show brief status notification
            if (parsed.type === "agent_thinking") {
                setNotifications(prev => [{
                    id: crypto.randomUUID(),
                    message: `${parsed.agent ?? "Agent"} is thinking…`,
                    timestamp: new Date(),
                    metadata: null,
                }, ...prev].slice(0, 50));
                return;
            }

            // execution_complete → show proof links and push any results not yet in chat
            if (parsed.type === "execution_complete") {
                const parts: string[] = ["✅ All agents done."];
                if (parsed.logCid) parts.push(`📦 IPFS: ${parsed.logUrl || `ipfs://${parsed.logCid}`}`);
                if (parsed.onChainTxHash) parts.push(`⛓️ Flow EVM${parsed.proofTokenId ? ` NFT #${parsed.proofTokenId}` : ""}: ${parsed.onChainExplorerUrl}`);
                setNotifications(prev => [{
                    id: crypto.randomUUID(),
                    message: parts.join("\n"),
                    timestamp: new Date(),
                    metadata: null,
                }, ...prev].slice(0, 50));
                return;
            }
        } catch {
            // Not JSON — fall through to plain notification
        }

        // Plain text / unrecognised events
        setNotifications(prev => [{
            id: crypto.randomUUID(),
            message: message,
            timestamp: new Date(),
            metadata: null,
        }, ...prev].slice(0, 50));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGodError = useCallback((error: string) => {
        console.error('God error:', error);
    }, []);

    // Draw the game
    const drawGame = useCallback(() => {
        if (!isInitialized) {
            console.debug("drawGame early return because not initialized");
            return;
        }
        const canvas = canvasRef.current;
        const map = mapRef.current;
        const characters = charactersRef.current;


        if (!canvas || !map || !characters || playerStates.length === 0) {
            if (!canvas) console.debug("Missing canvas");
            if (!map) console.debug("Missing map");
            if (!characters) console.debug("Missing characters");
            if (playerStates.length === 0) console.debug("No player states");
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw the office map background to fill the entire canvas
        ctx.drawImage(
            map,
            0,  // source x
            0,  // source y
            map.width,  // source width
            map.height, // source height
            0,  // destination x
            0,  // destination y
            CANVAS_WIDTH,  // destination width - fill entire canvas width
            CANVAS_HEIGHT  // destination height - fill entire canvas height
        );

        // Draw walkable areas for debugging
        if (DEBUG_WALKABLE_AREAS) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            Object.values(WALKABLE_POLYGONS).forEach(polygon => {
                ctx.beginPath();
                polygon.forEach((pt, i) => {
                    const sx = pt.x;
                    const sy = pt.y;
                    i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
                });
                ctx.closePath();
                ctx.stroke();
            });
        }

        // Draw each character
        characters.forEach((character, index) => {
            const playerState = playerStates[index];

            if (!playerState) {
                return; // Skip this iteration if playerState is not defined
            }

            character.draw(
                ctx,
                playerState.x,
                playerState.y,
                playerState.direction,
                animationFrameRef.current,
                playerState.isMoving,
                playerState.message
            );

            const characterX = playerState.x;
            const characterY = playerState.y;
            const characterWidth = SPRITE_DISPLAY_SIZE;
            const characterHeight = SPRITE_DISPLAY_SIZE;

            // Draw the name above the character if hovered
            if (isHoveredIndex === index && !isInputActive) {
                ctx.fillStyle = 'white';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                const textX = characterX + characterWidth / 2;
                const textY = characterY - 10;

                ctx.fillText(character.name, textX, textY);
            }

            // Highlight the controlled character
            if (controlledCharacterIndex !== null && controlledCharacterIndex === index && DEBUG_CHARACTER_SELECT_BOXES) {
                ctx.strokeStyle = 'yellow';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    characterX,
                    characterY,
                    characterWidth,
                    characterHeight
                );
            }
        });

        if (DEBUG_CHARACTER_SELECT_BOXES && ctx) {
            // Draw collision boxes for all characters
            playerStates.forEach(state => {
                const width = SPRITE_SIZE * SCALE_FACTOR * 1.15;
                const height = SPRITE_SIZE * SCALE_FACTOR * 1.15;
                const buffer = 14;

                // Draw character's collision box
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.strokeRect(
                    state.x * SCALE_FACTOR + MAP_OFFSET_X,
                    state.y * SCALE_FACTOR + MAP_OFFSET_Y,
                    width,
                    height
                );

                // Draw buffer zone
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
                ctx.strokeRect(
                    state.x * SCALE_FACTOR + MAP_OFFSET_X - buffer,
                    state.y * SCALE_FACTOR + MAP_OFFSET_Y - buffer,
                    width + buffer * 2,
                    height + buffer * 2
                );
            });
        }
    }, [
        isInitialized,
        playerStates,
        isHoveredIndex,
        isInputActive,
        controlledCharacterIndex,
    ]);

    // Store functions in refs to have stable references
    const drawGameRef = useRef(drawGame);
    const handleCharacterMessageRef = useRef(handleCharacterMessage);
    const handleCharacterErrorRef = useRef(handleCharacterError);
    const handleGodMessageRef = useRef(handleGodMessage);
    const handleGodErrorRef = useRef(handleGodError);

    // Update refs to point to the latest versions
    useEffect(() => {
        drawGameRef.current = drawGame;
        handleCharacterMessageRef.current = handleCharacterMessage;
        handleGodMessageRef.current = handleGodMessage;
        handleGodErrorRef.current = handleGodError;
        handleCharacterErrorRef.current = handleCharacterError;
    }, [drawGame, handleCharacterMessage, handleGodMessage, handleGodError, handleCharacterError]);

    // Initialize characters and load the map
    useEffect(() => {
        let mounted = true;

        const initializeGame = async () => {
            // Initialize characters if not already initialized
            if (!charactersRef.current) {
                console.debug("Initializing characters...");
                charactersRef.current = [
                    new Character(
                        0,
                        'Eric',
                        '/sprite_p1.png',
                        () => {
                            if (mounted) drawGameRef.current();
                        },
                        (index, message) => {
                            handleCharacterMessageRef.current(index, message);
                        },
                        (index, error) => {
                            handleCharacterErrorRef.current(index, error);
                        },
                        sessionId,
                        userId
                    ),
                    new Character(
                        1,
                        'Harper',
                        '/sprite_p2.png',
                        () => {
                            if (mounted) drawGameRef.current();
                        },
                        (index, message) => {
                            handleCharacterMessageRef.current(index, message);
                        },
                        (index, error) => {
                            handleCharacterErrorRef.current(index, error);
                        },
                        sessionId,
                        userId
                    ),
                    new Character(
                        2,
                        'Rishi',
                        '/sprite_p3.png',
                        () => {
                            if (mounted) drawGameRef.current();
                        },
                        (index, message) => {
                            handleCharacterMessageRef.current(index, message);
                        },
                        (index, error) => {
                            handleCharacterErrorRef.current(index, error);
                        },
                        sessionId,
                        userId
                    ),
                    new Character(
                        3,
                        'Yasmin',
                        '/sprite_p4.png',
                        () => {
                            if (mounted) drawGameRef.current();
                        },
                        (index, message) => {
                            handleCharacterMessageRef.current(index, message);
                        },
                        (index, error) => {
                            handleCharacterErrorRef.current(index, error);
                        },
                        sessionId,
                        userId
                    ),
                ];
                // Initialize God and store in ref
                godRef.current = new God(
                    (message) => {
                        console.log(`God received message: ${JSON.stringify(message)}`);
                        handleGodMessageRef.current(message);
                    },
                    (error) => {
                        console.error(`God error: ${JSON.stringify(error)}`);
                        handleGodErrorRef.current(error);
                    },
                    sessionId,
                    userId,
                    walletAddress,
                    'RECURSIVE'
                );
            }

            // Initialize player states — spawn positions match the NYC trading floor map
            // Positions are sprite top-left; foot (bottom-center) anchor is used for walkability
            const spawnPositions = [
                { x: 1863, y: 1372 }, // Eric 1863,1372
                { x: 1796, y: 783 }, // Harper 1796,783
                { x: 1455, y: 1246 }, // Rishi 1455,1246
                { x: 710, y: 755 }, // Yasmin 710,755
            ];

            const initialPlayerStates: PlayerState[] = spawnPositions.map((pos) => ({
                x: pos.x,
                y: pos.y,
                direction: 'down' as const,
                isMoving: false,
                message: null,
                ai: {
                    action: 'paused' as const,
                    actionEndTime:
                        Date.now() +
                        getRandomInt(AI_PAUSE_DURATION_MIN, AI_PAUSE_DURATION_MAX),
                },
            }));

            // Load the map image
            const mapImage = new Image();
            mapImage.src = mapSrc;
            await new Promise((resolve, reject) => {
                mapImage.onload = () => {
                    resolve(null);
                };
                mapImage.onerror = (error) => {
                    console.error("Failed to load map image:", error);
                    reject(error);
                };
            });

            if (mounted) {
                setPlayerStates(initialPlayerStates);
                mapRef.current = mapImage;
                setIsInitialized(true);

            }
        };

        initializeGame().catch((error) => {
            console.error("Error during game initialization:", error);
        });

        return () => {
            mounted = false;
            // Clean up WebSocket connections and character instances
            if (charactersRef.current) {
                charactersRef.current.forEach(character => character.destroy());
                charactersRef.current = null;
            }
            if (godRef.current) {
                godRef.current.closeWebSocket();
                godRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, userId, walletAddress]);

    // Reload map image when theme changes
    useEffect(() => {
        if (!isInitialized) return;
        const mapImage = new Image();
        mapImage.src = mapSrc;
        mapImage.onload = () => { mapRef.current = mapImage; };
    }, [mapSrc, isInitialized]);

    // Initialize AI states for uncontrolled characters
    useEffect(() => {
        setPlayerStates((prevStates) =>
            prevStates.map((state, index) => {
                if (
                    controlledCharacterIndex === null ||
                    index !== controlledCharacterIndex
                ) {
                    if (!state.ai) {
                        return {
                            ...state,
                            ai: {
                                action: 'paused',
                                actionEndTime:
                                    Date.now() +
                                    getRandomInt(
                                        AI_PAUSE_DURATION_MIN,
                                        AI_PAUSE_DURATION_MAX
                                    ),
                            },
                        };
                    }
                } else if (index === controlledCharacterIndex && state.ai) {
                    // Remove AI state from the newly controlled character
                    const { ai: _unused, ...rest } = state;
                    return rest;
                }
                return state;
            })
        );
    }, [controlledCharacterIndex]);

    // Animation loop
    useEffect(() => {
        if (!isInitialized) {
            console.debug("Animation loop not started because game is not initialized");
            return;
        }
        let animationId: number;

        const animate = (timestamp: number) => {
            const newPlayerStates = [...playerStates];

            newPlayerStates.forEach((playerState, index) => {
                if (playerState.ai && charactersRef.current) {
                    // AI-controlled character logic
                    if (Date.now() >= playerState.ai.actionEndTime) {
                        // Change action
                        if (playerState.ai.action === 'paused') {
                            // Start moving
                            playerState.ai.action = 'moving';
                            playerState.ai.actionEndTime =
                                Date.now() + getRandomInt(AI_MOVE_DURATION_MIN, AI_MOVE_DURATION_MAX);
                            playerState.direction = DIRECTIONS[getRandomInt(0, DIRECTIONS.length - 1)];
                            playerState.isMoving = true;
                        } else {
                            // Pause
                            playerState.ai.action = 'paused';
                            playerState.ai.actionEndTime =
                                Date.now() + getRandomInt(AI_PAUSE_DURATION_MIN, AI_PAUSE_DURATION_MAX);
                            playerState.isMoving = false;
                            animationFrameRef.current = 0; // Reset animation frame
                        }
                    }

                    if (playerState.ai.action === 'moving') {
                        const moveDistance = (AI_MOVE_SPEED / SCALE_FACTOR) *
                            ((timestamp - lastRenderTimeRef.current) / FRAME_DURATION);
                        let newX = playerState.x;
                        let newY = playerState.y;

                        // Try movement in current direction
                        switch (playerState.direction) {
                            case 'up':
                                newY -= moveDistance;
                                break;
                            case 'down':
                                newY += moveDistance;
                                break;
                            case 'left':
                                newX -= moveDistance;
                                break;
                            case 'right':
                                newX += moveDistance;
                                break;
                        }

                        // Check both canvas bounds, walkable area, and character collisions
                        // Use bottom-center of sprite (foot anchor) for walkability check
                        const footX = newX + SPRITE_DISPLAY_SIZE / 2;
                        const footY = newY + SPRITE_DISPLAY_SIZE;
                        if (
                            isWithinCanvasBounds(newX, newY) &&
                            isWalkable(footX, footY, index) &&
                            !checkCharacterCollision(newPlayerStates, index, newX, newY)
                        ) {
                            playerState.x = newX;
                            playerState.y = newY;
                        } else {
                            // On collision, immediately stop and change direction
                            playerState.isMoving = false;
                            playerState.ai.action = 'paused';
                            playerState.ai.actionEndTime = Date.now() + 1000;
                            let newDirection;
                            do {
                                newDirection = DIRECTIONS[getRandomInt(0, DIRECTIONS.length - 1)];
                            } while (newDirection === playerState.direction);
                            playerState.direction = newDirection;
                        }

                        // Update animation frame
                        if (timestamp - lastRenderTimeRef.current >= FRAME_DURATION) {
                            animationFrameRef.current = (animationFrameRef.current + 1) % ANIMATION_FRAMES;
                            lastRenderTimeRef.current = timestamp;
                        }
                    }
                }
            });

            setPlayerStates(newPlayerStates);
            drawGame();

            animationId = requestAnimationFrame(animate);
        };

        animationId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, [drawGame, playerStates, isInitialized]);

    // Handle keyboard input for movement and chat
    useEffect(() => {
        if (!isInitialized) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) {
                return;
            }

            if (e.key === 'Enter') {
                if (controlledCharacterIndex !== null) {
                    setIsInputActive((prev) => !prev);
                }
                return;
            }

            if (controlledCharacterIndex === null || !charactersRef.current) return;

            setPlayerStates((prevStates) => {
                const newStates = [...prevStates];
                const playerState = { ...newStates[controlledCharacterIndex] };

                playerState.isMoving = true;
                const moveDistance = PLAYER_MOVE_SPEED / SCALE_FACTOR;

                let newX = playerState.x;
                let newY = playerState.y;

                switch (e.key) {
                    case 'ArrowUp':
                        newY -= moveDistance;
                        playerState.direction = 'up';
                        break;
                    case 'ArrowDown':
                        newY += moveDistance;
                        playerState.direction = 'down';
                        break;
                    case 'ArrowLeft':
                        newX -= moveDistance;
                        playerState.direction = 'left';
                        break;
                    case 'ArrowRight':
                        newX += moveDistance;
                        playerState.direction = 'right';
                        break;
                    default:
                        return prevStates;
                }

                // Check both canvas bounds, walkable area, and character collisions
                // Use bottom-center of sprite (foot anchor) for walkability check
                const footX = newX + SPRITE_DISPLAY_SIZE / 2;
                const footY = newY + SPRITE_DISPLAY_SIZE;
                if (
                    isWithinCanvasBounds(newX, newY) &&
                    isWalkable(footX, footY) &&
                    !checkCharacterCollision(newStates, controlledCharacterIndex, newX, newY)
                ) {
                    playerState.x = newX;
                    playerState.y = newY;
                    newStates[controlledCharacterIndex] = playerState;
                    drawGame();
                    return newStates;
                } else {
                    // Add a small "bump" effect by moving slightly in the opposite direction
                    const bumpDistance = 0.9;
                    switch (playerState.direction) {
                        case 'up':
                            playerState.y += bumpDistance;
                            break;
                        case 'down':
                            playerState.y -= bumpDistance;
                            break;
                        case 'left':
                            playerState.x += bumpDistance;
                            break;
                        case 'right':
                            playerState.x -= bumpDistance;
                            break;
                    }
                    newStates[controlledCharacterIndex] = playerState;
                    return newStates;
                }
            });
        };

        const handleKeyUp = () => {
            if (controlledCharacterIndex === null) return;
            setPlayerStates((prevStates) => {
                const newStates = [...prevStates];
                newStates[controlledCharacterIndex].isMoving = false;
                animationFrameRef.current = 0; // Reset to standing frame
                drawGame();
                return newStates;
            });
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, [drawGame, isInputActive, controlledCharacterIndex, isInitialized]);


    // Function to check if a point is within a character's area
    const isPointInCharacter = (x: number, y: number, characterIndex: number): boolean => {
        const playerState = playerStates[characterIndex];
        if (!playerState) return false;

        const characterX = playerState.x * SCALE_FACTOR + MAP_OFFSET_X;
        const characterY = playerState.y * SCALE_FACTOR + MAP_OFFSET_Y;
        const characterWidth = SPRITE_SIZE * SCALE_FACTOR;
        const characterHeight = SPRITE_SIZE * SCALE_FACTOR;

        return (
            x >= characterX &&
            x <= characterX + characterWidth &&
            y >= characterY &&
            y <= characterY + characterHeight
        );
    };

    // Mouse move handler
    const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isInitialized || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        let hoveredIndex: number | null = null;

        for (let i = 0; i < (charactersRef.current?.length || 0); i++) {
            if (isPointInCharacter(mouseX, mouseY, i)) {
                hoveredIndex = i;
                break;
            }
        }

        if (hoveredIndex !== isHoveredIndex) {
            setIsHoveredIndex(hoveredIndex);
        }
    };

    // Click handler to select character
    const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isInitialized || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        let clickedCharacterIndex: number | null = null;

        for (let i = 0; i < (charactersRef.current?.length || 0); i++) {
            if (isPointInCharacter(mouseX, mouseY, i)) {
                clickedCharacterIndex = i;
                break;
            }
        }

        if (clickedCharacterIndex !== null) {
            if (controlledCharacterIndex !== clickedCharacterIndex) {
                // Close input field when selecting a new character
                setIsInputActive(false);
            }
            setControlledCharacterIndex(clickedCharacterIndex);
            // Remove AI state from the controlled character
            setPlayerStates((prevStates) => {
                const newStates = [...prevStates];
                delete newStates[clickedCharacterIndex].ai;
                return newStates;
            });
        } else {
            // Release control if clicked outside any character
            setControlledCharacterIndex(null);
            setIsInputActive(false);
        }
    };

    // Input key down handler for chat
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();

            if (inputValue.trim()) {
                // Add user message to notifications
                setNotifications(prev => [{
                    id: crypto.randomUUID(),
                    message: inputValue,
                    timestamp: new Date(),
                    characterName: 'You',
                    chatMode: 'RECURSIVE',
                    metadata: null,
                }, ...prev].slice(0, 50));

                // Send message through God
                if (godRef.current) {
                    godRef.current.sendMessage(inputValue);
                } else {
                    console.error('God instance not initialized');
                }
            }

            // Reset input field
            setInputValue('');
            setIsInputActive(false);
        }
    };

    // Function to check if a position is walkable
    const isWalkable = useCallback((x: number, y: number, agentIndex?: number): boolean => {
        if (agentIndex !== undefined) {
            // AI agent: constrain to its own zone
            const key = AGENT_ZONE_KEYS[agentIndex];
            const polygon = key ? WALKABLE_POLYGONS[key] : null;
            return polygon ? isPointInPolygon(x, y, polygon) : false;
        }
        // Player-controlled: can roam all zones
        return Object.values(WALKABLE_POLYGONS).some(polygon =>
            isPointInPolygon(x, y, polygon)
        );
    }, []);

    // Compute controlled character's position for the input field
    const controlledPlayerState =
        controlledCharacterIndex !== null ? playerStates[controlledCharacterIndex] : null;
    const controlledCharacterX = controlledPlayerState
        ? controlledPlayerState.x
        : 0;
    const controlledCharacterY = controlledPlayerState
        ? controlledPlayerState.y
        : 0;
    const characterWidth = SPRITE_DISPLAY_SIZE;

    // Function to send a message to all characters
    const handleGlobalMessage = (message: string) => {
        if (message.trim()) {
            setChatMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                message: message,
                timestamp: new Date(),
                characterName: 'You',
            }].slice(-50));

            // Send message through God
            if (godRef.current) {
                godRef.current.sendMessage(message);
            } else {
                console.error('God instance not initialized');
            }
        }
    };

    // Return statement with conditional rendering
    return (
        <div className="flex gap-4 h-full p-4 overflow-hidden">
            {/* Left column */}
            <div className="flex flex-col flex-1 gap-3 min-w-0 min-h-0">
                {/* Left column header */}
                <div className="flex items-center justify-between shrink-0">
                    <WalletAddress />
                    <ThemeToggle />
                </div>
                {/* Logo */}
                <div className="shrink-0">
                    <Logo />
                </div>
                {/* Canvas */}
                <div className="flex-1 min-h-0 relative flex items-center justify-center">
                    <GameContainer>
                        {!isInitialized ? (
                            <div className="flex items-center justify-center w-64 h-48 text-sm opacity-60">
                                Loading…
                            </div>
                        ) : (
                            <>
                                <canvas
                                    ref={canvasRef}
                                    width={CANVAS_WIDTH}
                                    height={CANVAS_HEIGHT}
                                    onMouseMove={handleMouseMove}
                                    onClick={handleClick}
                                    className="w-full h-full"
                                    style={{ display: 'block' }}
                                />
                                {isInputActive && controlledPlayerState && (
                                    <input
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={handleInputKeyDown}
                                        style={{
                                            position: 'absolute',
                                            left: `${controlledCharacterX + characterWidth / 2}px`,
                                            top: `${controlledCharacterY - 30}px`,
                                            transform: 'translateX(-50%)',
                                            zIndex: 10,
                                        }}
                                        autoFocus
                                    />
                                )}
                            </>
                        )}
                    </GameContainer>
                </div>
            </div>

            {/* Right column */}
            <div className="w-96 shrink-0 h-full">
                <ChatEventsPanel
                    chatContent={
                        authenticated ? (
                            <Chat
                                messages={chatMessages}
                                onSendMessage={handleGlobalMessage}
                                disabled={!isInitialized}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <PrivyAuthButton />
                            </div>
                        )
                    }
                    eventsContent={<NotificationBoard notifications={notifications} />}
                />
            </div>
        </div>
    );
};

export default Game;
