// Mock LLM providers at module level
jest.mock("@langchain/groq", () => ({
  ChatGroq: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        intent: "market analysis",
        agents: ["Eric"],
        steps: [{ agent: "Eric", task: "Analyze market" }],
        requiresApproval: true,
        onChainActions: [],
      }),
    }),
  })),
}));

jest.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "result" }),
  })),
}));

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "result" }),
  })),
}));

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  return {
    ...actual,
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBalance: jest.fn().mockResolvedValue(BigInt("10000000000000000000")),
      getBlockNumber: jest.fn().mockResolvedValue(12345),
    })),
    Contract: jest.fn().mockImplementation(() => ({
      ownerOf: jest.fn().mockResolvedValue("0x1234567890123456789012345678901234567890"),
      tokenURI: jest.fn().mockResolvedValue("ipfs://QmTestAgent"),
      getAgentByName: jest.fn().mockResolvedValue(1n),
      isVantageAgent: jest.fn().mockResolvedValue(true),
      giveFeedback: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xabc123" }) }),
      mint: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xdef456" }) }),
      tip: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xghi789" }) }),
    })),
    Wallet: jest.fn().mockImplementation(() => ({
      address: "0xce4389ACb79463062c362fACB8CB04513fA3D8D8",
    })),
  };
});

jest.mock("@lighthouse-web3/sdk", () => ({
  default: {
    uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmMockCID123" } }),
  },
}));

import { Orchestrator } from "../../../src/agents/orchestrator";
import { BaseAgent } from "../../../src/agents/base-agent";
import { mockSessionState } from "../../fixtures/test-data";

// A simple mock agent for testing
class MockAgent extends BaseAgent {
  constructor(name: string, role: string) {
    super({
      name,
      role,
      model: "groq",
      systemPrompt: "Test prompt",
      tools: [],
    });
    // Override the LLM invoke directly
    (this as any).llm = {
      invoke: jest.fn().mockResolvedValue({ content: `Result from ${name}` }),
    };
  }
}

describe("Orchestrator", () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  describe("registerAgent", () => {
    it("registers an agent and can retrieve by name", () => {
      const agent = new MockAgent("TestAgent", "tester");
      orchestrator.registerAgent(agent);
      expect(orchestrator.getAgentNames()).toContain("TestAgent");
    });

    it("registers multiple agents", () => {
      orchestrator.registerAgent(new MockAgent("AgentA", "roleA"));
      orchestrator.registerAgent(new MockAgent("AgentB", "roleB"));
      const names = orchestrator.getAgentNames();
      expect(names).toContain("AgentA");
      expect(names).toContain("AgentB");
      expect(names).toHaveLength(2);
    });
  });

  describe("getAgentNames", () => {
    it("returns empty array when no agents registered", () => {
      expect(orchestrator.getAgentNames()).toEqual([]);
    });
  });

  describe("processUserRequest", () => {
    it("returns a SessionState with correct sessionId", async () => {
      const result = await orchestrator.processUserRequest("Analyze the market", "session-123");
      expect(result.sessionId).toBe("session-123");
    });

    it("returns status pending_approval", async () => {
      const result = await orchestrator.processUserRequest("Analyze the market", "session-123");
      expect(result.status).toBe("pending_approval");
    });

    it("returns a plan as JSON string", async () => {
      const result = await orchestrator.processUserRequest("Analyze the market", "session-123");
      const plan = JSON.parse(result.plan);
      expect(plan).toHaveProperty("intent");
      expect(plan).toHaveProperty("agents");
      expect(plan).toHaveProperty("steps");
    });

    it("sets walletAddress when provided", async () => {
      const result = await orchestrator.processUserRequest("Analyze", "sid", "0xWallet");
      expect(result.walletAddress).toBe("0xWallet");
    });

    it("defaults walletAddress to empty string", async () => {
      const result = await orchestrator.processUserRequest("Analyze", "sid");
      expect(result.walletAddress).toBe("");
    });

    it("returns empty messages and results arrays", async () => {
      const result = await orchestrator.processUserRequest("Test", "sid");
      expect(result.messages).toEqual([]);
      expect(result.results).toEqual([]);
    });
  });

  describe("executeStep", () => {
    it("returns error string for unknown agent", async () => {
      const result = await orchestrator.executeStep("NonExistent", "some task");
      expect(result).toContain("Error");
      expect(result).toContain("NonExistent");
    });

    it("calls agent invoke and returns result for known agent", async () => {
      const agent = new MockAgent("TestAgent", "tester");
      orchestrator.registerAgent(agent);
      const result = await orchestrator.executeStep("TestAgent", "Do something");
      expect(typeof result).toBe("string");
    });
  });

  describe("executePlan", () => {
    it("returns updated session with complete status", async () => {
      const agent = new MockAgent("Eric", "market_analyst");
      orchestrator.registerAgent(agent);
      const result = await orchestrator.executePlan(mockSessionState);
      expect(result.status).toBe("complete");
    });

    it("returns results for each step", async () => {
      const agent = new MockAgent("Eric", "market_analyst");
      orchestrator.registerAgent(agent);
      const result = await orchestrator.executePlan(mockSessionState);
      expect(result.results).toHaveLength(1);
      expect((result.results[0] as any).agent).toBe("Eric");
    });

    it("calls onProgress callback for each step", async () => {
      const agent = new MockAgent("Eric", "market_analyst");
      orchestrator.registerAgent(agent);
      const progressUpdates: any[] = [];
      await orchestrator.executePlan(mockSessionState, (update) => {
        progressUpdates.push(update);
      });
      // 2 updates per step: executing + complete
      expect(progressUpdates.length).toBeGreaterThan(0);
    });

    it("handles session with no steps", async () => {
      const emptyStepSession = {
        ...mockSessionState,
        plan: JSON.stringify({ intent: "test", agents: [], steps: [], requiresApproval: false, onChainActions: [] }),
      };
      const result = await orchestrator.executePlan(emptyStepSession);
      expect(result.status).toBe("complete");
      expect(result.results).toHaveLength(0);
    });
  });
});
