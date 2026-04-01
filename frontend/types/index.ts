export interface Message {
  id: string;
  type: "user" | "agent" | "system";
  agent?: string;
  content: string;
  timestamp: Date;
}

export interface AgentInfo {
  name: string;
  role: string;
  color: string;
  model: string;
}

export interface PendingApproval {
  sessionId: string;
  plan: {
    agents?: string[];
    actions?: string[];
    proofs?: Array<{ cid: string; label: string }>;
  };
}

export interface WebSocketMessage {
  type: string;
  agent?: string;
  content?: string;
  logCid?: string;
  logUrl?: string;
  onChainTxHash?: string;
  onChainExplorerUrl?: string;
  proofTokenId?: string;
  plan?: PendingApproval["plan"];
  sessionId?: string;
  [key: string]: unknown;
}
