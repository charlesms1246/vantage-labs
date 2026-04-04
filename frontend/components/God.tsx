"use client"

import { socketManager } from "@/lib/socket";

export class God {
    onMessageReceived: (message: string) => void;
    onError: (error: string) => void;
    sessionId: string;
    userId: string;
    walletAddress: string;
    chatMode: 'STANDARD' | 'RECURSIVE';
    private agentResponseHandler: (data: unknown) => void;
    private agentThinkingHandler: (data: unknown) => void;
    private agentLlmOutputHandler: (data: unknown) => void;
    private systemLogHandler: (data: unknown) => void;
    private executionCompleteHandler: (data: unknown) => void;
    private planReadyHandler: (data: unknown) => void;
    private errorHandler: (data: unknown) => void;

    constructor(
        onMessageReceived: (message: string) => void,
        onError: (error: string) => void,
        sessionId: string,
        userId: string,
        walletAddress: string,
        chatMode: 'STANDARD' | 'RECURSIVE'
    ) {
        this.sessionId = sessionId;
        this.onMessageReceived = onMessageReceived;
        this.onError = onError;
        this.userId = userId;
        this.chatMode = chatMode;
        this.walletAddress = walletAddress;

        const forward = (type: string) => (data: unknown) => {
            try {
                const payload = { type, ...(data as object) };
                this.onMessageReceived(JSON.stringify(payload));
            } catch (err) {
                console.error(`God: error forwarding ${type}`, err);
            }
        };

        this.agentResponseHandler = forward("agent_response");
        this.agentThinkingHandler = forward("agent_thinking");
        this.agentLlmOutputHandler = forward("agent_llm_output");
        this.systemLogHandler = forward("system_log");
        this.executionCompleteHandler = forward("execution_complete");
        this.planReadyHandler = forward("plan_ready");
        this.errorHandler = (data: unknown) => {
            const msg = (data as any)?.message || JSON.stringify(data);
            this.onError(msg);
        };

        socketManager.on('agent_response', this.agentResponseHandler);
        socketManager.on('agent_thinking', this.agentThinkingHandler);
        socketManager.on('agent_llm_output', this.agentLlmOutputHandler);
        socketManager.on('system_log', this.systemLogHandler);
        socketManager.on('execution_complete', this.executionCompleteHandler);
        socketManager.on('plan_ready', this.planReadyHandler);
        socketManager.on('error', this.errorHandler);
    }

    public closeWebSocket() {
        socketManager.off('agent_response', this.agentResponseHandler);
        socketManager.off('agent_thinking', this.agentThinkingHandler);
        socketManager.off('agent_llm_output', this.agentLlmOutputHandler);
        socketManager.off('system_log', this.systemLogHandler);
        socketManager.off('execution_complete', this.executionCompleteHandler);
        socketManager.off('plan_ready', this.planReadyHandler);
        socketManager.off('error', this.errorHandler);
    }

    public setChatMode(chatMode: 'STANDARD' | 'RECURSIVE') {
        this.chatMode = chatMode;
    }

    sendMessage(message: string) {
        if (!message.trim()) return;

        const payload = {
            type: "user_message",
            message: message,
            sessionId: this.sessionId,
            chatMode: this.chatMode,
            walletAddress: this.walletAddress,
        };

        console.log(`God sending message: ${JSON.stringify(payload)}`);
        socketManager.send('user_message', payload);
    }
}
