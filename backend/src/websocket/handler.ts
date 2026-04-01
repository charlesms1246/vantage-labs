import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { Orchestrator } from "../agents/orchestrator";
import { lighthouseService } from "../services/lighthouse";
import { flowService } from "../services/flow";
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

  private async handleUserMessage(socket: Socket, data: { message: string; sessionId?: string; walletAddress?: string; chatMode?: string }): Promise<void> {
    const sessionId = data.sessionId || uuidv4();
    // Prefer walletAddress from message payload; fall back to socket handshake query
    const walletAddress = data.walletAddress || (socket.handshake.query.walletAddress as string) || "";

    socket.emit(WS_EVENTS.AGENT_THINKING, { agent: "Orchestrator", status: "parsing", sessionId });

    try {
      const session = await this.orchestrator.processUserRequest(
        data.message,
        sessionId,
        walletAddress
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

      // Store session log on Lighthouse (IPFS)
      let logCid = "";
      let onChainTxHash = "";
      try {
        logCid = await lighthouseService.upload(JSON.stringify(completedSession));
        console.log(`[WS] Session log uploaded to Lighthouse: ${logCid}`);
      } catch (uploadError) {
        console.error("[WS] Lighthouse upload failed:", (uploadError as Error).message);
      }

      // Record Lighthouse CID on-chain (Flow EVM Testnet) via SampleNFT mint
      let onChainExplorerUrl = "";
      let proofTokenId = "";
      if (logCid) {
        try {
          const proof = await flowService.recordProofOnChain(logCid, `session-${data.sessionId}`);
          onChainTxHash = proof.txHash;
          proofTokenId = proof.tokenId;
          onChainExplorerUrl = proof.explorerUrl;
          console.log(`[WS] Proof NFT minted on Flow EVM: tokenId=${proofTokenId} tx=${onChainTxHash}`);
        } catch (chainError) {
          console.error("[WS] On-chain proof recording failed:", (chainError as Error).message);
        }
      }

      this.sessions.set(data.sessionId, { ...completedSession, logCid });

      socket.emit(WS_EVENTS.EXECUTION_COMPLETE, {
        sessionId: data.sessionId,
        results: completedSession.results,
        logCid: logCid || undefined,
        logUrl: logCid ? lighthouseService.getGatewayUrl(logCid) : undefined,
        onChainTxHash: onChainTxHash || undefined,
        onChainExplorerUrl: onChainExplorerUrl || undefined,
        proofTokenId: proofTokenId || undefined,
        status: "success",
      });
    } catch (error: unknown) {
      console.error("[WS] handleApproval error:", (error as Error).message);
      socket.emit(WS_EVENTS.ERROR, { message: (error as Error).message, sessionId: data.sessionId });
    }
  }
}
