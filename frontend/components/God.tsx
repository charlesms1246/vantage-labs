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
    private planReadyHandler: (data: unknown) => void;

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

        // Bind handlers
        this.agentResponseHandler = (data: unknown) => {
            try {
                const parsed = data as any;
                console.log(`God received agent_response: ${JSON.stringify(parsed)}`);
                this.onMessageReceived(JSON.stringify(parsed));
            } catch (error) {
                console.error('Error processing agent_response:', error);
            }
        };

        this.planReadyHandler = (data: unknown) => {
            try {
                const parsed = data as any;
                console.log(`God received plan_ready: ${JSON.stringify(parsed)}`);
                this.onMessageReceived(JSON.stringify(parsed));
            } catch (error) {
                console.error('Error processing plan_ready:', error);
            }
        };

        // Register socketManager listeners
        socketManager.on('agent_response', this.agentResponseHandler);
        socketManager.on('plan_ready', this.planReadyHandler);
    }

    public closeWebSocket() {
        socketManager.off('agent_response', this.agentResponseHandler);
        socketManager.off('plan_ready', this.planReadyHandler);
    }

    public setChatMode(chatMode: 'STANDARD' | 'RECURSIVE') {
        this.chatMode = chatMode;
    }

    sendMessage(message: string) {
        if (!message.trim()) {
            return;
        }

        const payload = {
            type: "user_message",
            message: message,
            sessionId: this.sessionId,
            chatMode: this.chatMode,
        };

        console.log(`God sending message: ${JSON.stringify(payload)}`);
        socketManager.send('user_message', payload);
        console.log(`God sent message: ${JSON.stringify(payload)}`);
    }
}
