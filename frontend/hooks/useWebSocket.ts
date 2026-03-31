"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { usePrivy } from "@privy-io/react-auth";
import type { WebSocketMessage } from "@/types";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const { user } = usePrivy();
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (!user) return;

    const newSocket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      setConnected(true);
      reconnectAttempts.current = 0;
    });

    newSocket.on("disconnect", () => {
      setConnected(false);
    });

    const events = [
      "agent_thinking",
      "agent_response",
      "plan_ready",
      "execution_started",
      "execution_complete",
      "error",
    ];

    events.forEach((event) => {
      newSocket.on(event, (data: Omit<WebSocketMessage, "type">) => {
        setLastMessage({ type: event, ...data });
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user]);

  const sendMessage = useCallback(
    (data: WebSocketMessage) => {
      if (socket && connected) {
        socket.emit(data.type, data);
      }
    },
    [socket, connected],
  );

  return { socket, connected, lastMessage, sendMessage };
}
