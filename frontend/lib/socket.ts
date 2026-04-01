import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

type EventHandler = (data: unknown) => void;

class SocketManager {
  private socket: Socket | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private reconnecting = false;

  connect(walletAddress: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(SOCKET_URL, {
        transports: ["websocket"],
        query: { walletAddress },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 20000,
      });

      this.socket.on("connect", () => {
        this.reconnecting = false;
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        if (!this.reconnecting) {
          reject(error);
        }
      });

      this.socket.on("disconnect", (reason) => {
        if (reason === "io server disconnect") {
          this.socket?.connect();
        }
      });

      this.socket.on("reconnecting", () => {
        this.reconnecting = true;
      });

      this.setupEventListeners();
    });
  }

  private setupEventListeners() {
    const events = [
      "agent_thinking",
      "agent_response",
      "plan_ready",
      "execution_started",
      "execution_complete",
      "execution_cancelled",
      "error",
    ];

    events.forEach((event) => {
      this.socket?.on(event, (data: unknown) => {
        this.dispatch(event, data);
      });
    });
  }

  private dispatch(event: string, data: unknown) {
    this.eventHandlers.get(event)?.forEach((handler) => handler(data));
  }

  on(event: string, handler: EventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler) {
    this.eventHandlers.get(event)?.delete(handler);
  }

  send(event: string, data: unknown) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.eventHandlers.clear();
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketManager = new SocketManager();
