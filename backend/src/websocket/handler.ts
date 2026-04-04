import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { Orchestrator } from "../agents/orchestrator";
import { lighthouseService } from "../services/lighthouse";
import { flowService } from "../services/flow";
import { WS_EVENTS } from "./events";
import { SessionState } from "../types";
import { logger } from "../services/logger";

export class WebSocketHandler {
  private sessions: Map<string, SessionState> = new Map();

  constructor(private io: Server, private orchestrator: Orchestrator) {
    this.setupHandlers();
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : error != null ? String(error) : 'Unknown error';
  }

  private setupHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      logger.info("WS", "Client connected", { socketId: socket.id });

      // Stream every backend log entry to this socket in real time.
      // The frontend uses these to populate the Events / System Logs panel.
      const unsubscribeLog = logger.onEntry((entry) => {
        socket.emit(WS_EVENTS.SYSTEM_LOG, entry);
      });

      socket.on(WS_EVENTS.USER_MESSAGE, async (data) => {
        await this.handleUserMessage(socket, data);
      });

      socket.on("disconnect", () => {
        unsubscribeLog();
        logger.info("WS", "Client disconnected", { socketId: socket.id });
      });
    });
  }

  private async handleUserMessage(socket: Socket, data: { message: string; sessionId?: string; walletAddress?: string; chatMode?: string }): Promise<void> {
    const sessionId = data.sessionId || uuidv4();
    // Prefer walletAddress from message payload; fall back to socket handshake query
    const walletAddress = data.walletAddress || (socket.handshake.query.walletAddress as string) || "";

    const existingSession = this.sessions.get(sessionId);
    const chatHistory = existingSession?.chatHistory || [];

    logger.info("WS", `Event received: ${WS_EVENTS.USER_MESSAGE}`, {
      sessionId,
      messagePreview: data?.message?.slice(0, 150) ?? '',
      walletAddress: walletAddress || undefined,
    });
    socket.emit(WS_EVENTS.AGENT_THINKING, { agent: "Orchestrator", status: "parsing", sessionId });

    try {
      const session = await this.orchestrator.processUserRequest(
        data.message,
        sessionId,
        walletAddress,
        chatHistory
      );

      // Append this turn to history so next invocation remembers it
      session.chatHistory.push({ role: "user", content: data.message });
      session.chatHistory.push({ role: "assistant", content: session.plan });

      this.sessions.set(sessionId, session);

      let parsedPlan: any;
      try { parsedPlan = JSON.parse(session.plan); } catch { parsedPlan = session.plan; }
      logger.info("WS", `Event sent: ${WS_EVENTS.PLAN_READY}`, {
        sessionId,
        intent: parsedPlan?.intent,
      });
      socket.emit(WS_EVENTS.PLAN_READY, {
        sessionId,
        plan: parsedPlan,
        status: "executing",
      });

      // If the orchestrator has no steps, it implies it's directly asking the user or stating something.
      // We emit this intent to the Chat via AGENT_LLM_OUTPUT.
      if (parsedPlan && Array.isArray(parsedPlan.steps) && parsedPlan.steps.length === 0 && parsedPlan.intent) {
        socket.emit(WS_EVENTS.AGENT_LLM_OUTPUT, {
          sessionId,
          agent: "Orchestrator",
          content: parsedPlan.intent,
          timestamp: new Date().toISOString()
        });
      }

      // Auto-execute without waiting for client approval
      await this.executeSession(socket, sessionId);
    } catch (error: unknown) {
      const errMsg = this.getErrorMessage(error);
      logger.error("WS", "handleUserMessage error", { error: errMsg, sessionId });
      socket.emit(WS_EVENTS.ERROR, { message: errMsg, sessionId });
    }
  }

  private async executeSession(socket: Socket, sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      socket.emit(WS_EVENTS.ERROR, { message: "Session not found", sessionId });
      return;
    }

    logger.info("WS", `Event sent: ${WS_EVENTS.EXECUTION_STARTED}`, { sessionId });
    socket.emit(WS_EVENTS.EXECUTION_STARTED, { sessionId });

    try {
      const completedSession = await this.orchestrator.executePlan(session, (update) => {
        socket.emit(WS_EVENTS.AGENT_RESPONSE, { ...update, sessionId });

        // When an agent step finishes, also emit its prose output to Agent Chat.
        // We skip tool_use updates (those are raw tool results) and only surface
        // the final "complete" result which is the LLM's synthesised response.
        if (
          update.status === "complete" &&
          update.result &&
          typeof update.result === "string" &&
          update.result.trim()
        ) {
          socket.emit(WS_EVENTS.AGENT_LLM_OUTPUT, {
            sessionId,
            agent: update.agent,
            content: update.result,
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Store session log on Lighthouse (IPFS)
      let logCid = "";
      let onChainTxHash = "";
      try {
        logCid = await lighthouseService.upload(JSON.stringify(completedSession));
        logger.info("IPFS", "Session log uploaded to Lighthouse", {
          cid: logCid,
          url: lighthouseService.getGatewayUrl(logCid),
          sessionId,
        });
      } catch (uploadError) {
        logger.error("IPFS", "Lighthouse upload failed", { error: this.getErrorMessage(uploadError), sessionId });
      }

      // Record Lighthouse CID on-chain (Flow EVM Testnet) via SampleNFT mint
      let onChainExplorerUrl = "";
      let proofTokenId = "";
      if (logCid) {
        try {
          const proof = await flowService.recordProofOnChain(logCid, `session-${sessionId}`);
          onChainTxHash = proof.txHash;
          proofTokenId = proof.tokenId;
          onChainExplorerUrl = proof.explorerUrl;
          logger.info("ONCHAIN", "Proof NFT minted on Flow EVM", {
            tokenId: proofTokenId,
            txHash: onChainTxHash,
            explorerUrl: onChainExplorerUrl,
            sessionId,
          });
        } catch (chainError) {
          logger.error("ONCHAIN", "On-chain proof recording failed", { error: this.getErrorMessage(chainError), sessionId });
        }
      }

      this.sessions.set(sessionId, { ...completedSession, logCid });

      logger.info("WS", `Event sent: ${WS_EVENTS.EXECUTION_COMPLETE}`, { sessionId, resultCount: completedSession.results.length });
      socket.emit(WS_EVENTS.EXECUTION_COMPLETE, {
        sessionId,
        results: completedSession.results,
        logCid: logCid || undefined,
        logUrl: logCid ? lighthouseService.getGatewayUrl(logCid) : undefined,
        onChainTxHash: onChainTxHash || undefined,
        onChainExplorerUrl: onChainExplorerUrl || undefined,
        proofTokenId: proofTokenId || undefined,
        status: "success",
      });
    } catch (error: unknown) {
      const errMsg = this.getErrorMessage(error);
      logger.error("WS", "Execution error", { error: errMsg, sessionId });
      socket.emit(WS_EVENTS.ERROR, { message: errMsg, sessionId });
    }
  }
}
