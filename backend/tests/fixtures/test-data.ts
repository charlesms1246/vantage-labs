export const mockAgentRegistration = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "TestAgent",
  description: "A test agent",
  image: "ipfs://QmTest",
  services: [],
  active: true,
  supportedTrust: ["reputation"],
};

export const mockMarketAnalysis = {
  token: "FLOW",
  price: 1.25,
  volume24h: 1000000,
  recommendation: "HOLD",
  confidence: 0.75,
  timestamp: new Date().toISOString(),
};

export const mockSessionState = {
  sessionId: "test-session",
  walletAddress: "0x1234567890123456789012345678901234567890",
  messages: [],
  plan: JSON.stringify({
    intent: "market analysis",
    agents: ["Eric"],
    steps: [{ agent: "Eric", task: "Analyze market" }],
    requiresApproval: true,
    onChainActions: [],
  }),
  status: "pending_approval" as const,
  results: [],
};
