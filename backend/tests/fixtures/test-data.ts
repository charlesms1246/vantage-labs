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
    intent: "test",
    agents: ["Eric"],
    steps: [{ agent: "Eric", task: "analyze market" }],
    requiresApproval: true,
    onChainActions: [],
  }),
  status: "pending_approval",
  results: [],
};

export const mockUserMessage = {
  message: "create a memecoin",
  sessionId: "test-session-123",
  walletAddress: "0x1234567890123456789012345678901234567890",
};

export const mockPlan = {
  intent: "create a memecoin",
  agents: ["Rishi", "Harper", "Yasmin"],
  steps: [
    { agent: "Rishi", task: "generate smart contract code for memecoin" },
    { agent: "Harper", task: "deploy the contract to blockchain" },
    { agent: "Yasmin", task: "create marketing content for the memecoin" },
  ],
  requiresApproval: true,
  onChainActions: ["deploy contract", "mint initial supply"],
};
