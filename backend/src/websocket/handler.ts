import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { Orchestrator } from "../agents/orchestrator";
import { lighthouseService } from "../services/lighthouse";
import { WS_EVENTS } from "./events";
import { SessionState } from "../types";

export class WebSocketHandler {
  private sessions: Map<string, SessionState> = new Map();

  constructor(private io: Server, private orchestrator: Orchestrator) {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      console.log(`[WS] Client connected: ${socket.id}`);

      socket.on(WS_EVENTS.USER_MESSAGE, async (data) => {
        await this.handleUserMessage(socket, data);
      });

      socket.on(WS_EVENTS.APPROVE, async (data) => {
        await this.handleApproval(socket, data, true);
      });

      socket.on(WS_EVENTS.REJECT, async (data) => {
        await this.handleApproval(socket, data, false);
      });

      socket.on("disconnect", () => {
        console.log(`[WS] Client disconnected: ${socket.id}`);
      });
    });
  }

  private async handleUserMessage(socket: Socket, data: { message: string; sessionId?: string; walletAddress?: string }): Promise<void> {
    const sessionId = data.sessionId || uuidv4();

    socket.emit(WS_EVENTS.AGENT_THINKING, { agent: "Orchestrator", status: "parsing", sessionId });

    try {
      const session = await this.orchestrator.processUserRequest(
        data.message,
        sessionId,
        data.walletAddress
      );

      this.sessions.set(sessionId, session);

      socket.emit(WS_EVENTS.PLAN_READY, {
        sessionId,
        plan: JSON.parse(session.plan),
        status: "awaiting_approval",
      });
    } catch (error: unknown) {
      console.error("[WS] handleUserMessage error:", (error as Error).message);
      socket.emit(WS_EVENTS.ERROR, { message: (error as Error).message, sessionId });
    }
  }

  private async handleApproval(socket: Socket, data: { sessionId: string }, approved: boolean): Promise<void> {
    const session = this.sessions.get(data.sessionId);

    if (!session) {
      socket.emit(WS_EVENTS.ERROR, { message: "Session not found" });
      return;
    }

    if (!approved) {
      socket.emit(WS_EVENTS.EXECUTION_CANCELLED, { sessionId: data.sessionId });
      this.sessions.delete(data.sessionId);
      return;
    }

    socket.emit(WS_EVENTS.EXECUTION_STARTED, { sessionId: data.sessionId });

    try {
      const completedSession = await this.orchestrator.executePlan(session, (update) => {
        socket.emit(WS_EVENTS.AGENT_RESPONSE, { ...update, sessionId: data.sessionId });
      });

      // Store session log on Filecoin
      let logCid = "";
      try {
        logCid = await lighthouseService.upload(JSON.stringify(completedSession));
      } catch (uploadError) {
        console.error("[WS] Lighthouse upload failed:", (uploadError as Error).message);
        logCid = ""; // Continue without CID if upload fails
      }

      this.sessions.set(data.sessionId, { ...completedSession, logCid });

      socket.emit(WS_EVENTS.EXECUTION_COMPLETE, {
        sessionId: data.sessionId,
        results: completedSession.results,
        logCid: logCid || undefined,
        logUrl: logCid ? lighthouseService.getGatewayUrl(logCid) : undefined,
        status: "success",
      });
    } catch (error: unknown) {
      console.error("[WS] handleApproval error:", (error as Error).message);
      socket.emit(WS_EVENTS.ERROR, { message: (error as Error).message, sessionId: data.sessionId });
    }
  }
}
