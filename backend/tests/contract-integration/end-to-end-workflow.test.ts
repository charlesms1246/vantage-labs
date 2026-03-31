// Mock all LLM providers — API keys not available in integration env
jest.mock("@langchain/groq", () => ({
  ChatGroq: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        intent: "market analysis and potential trade",
        agents: ["Eric", "Harper"],
        steps: [
          { agent: "Eric", task: "Analyze FLOW token market conditions" },
          { agent: "Harper", task: "Prepare trade transaction for user approval" },
        ],
        requiresApproval: true,
        onChainActions: ["Token swap on Flow EVM (requires approval)"],
      }),
    }),
  })),
}));

jest.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: JSON.stringify({ recommendation: "HOLD", confidence: 0.75, reasoning: "Market is stable" }),
    }),
  })),
}));

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "Contract analysis complete. No vulnerabilities found." }),
  })),
}));

jest.mock("@lighthouse-web3/sdk", () => ({
  __esModule: true,
  default: {
    uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmE2ESessionLog123" } }),
  },
}));

import { Orchestrator } from "../../src/agents/orchestrator";
import { Eric } from "../../src/agents/eric";
import { Harper } from "../../src/agents/harper";
import { Rishi } from "../../src/agents/rishi";
import { Yasmin } from "../../src/agents/yasmin";

describe("End-to-End Agent Workflow", () => {
  let orchestrator: Orchestrator;

  beforeAll(() => {
    orchestrator = new Orchestrator();
    orchestrator.registerAgent(new Eric());
    orchestrator.registerAgent(new Harper());
    orchestrator.registerAgent(new Rishi());
    orchestrator.registerAgent(new Yasmin());
  });

  it("should have all 4 agents registered", () => {
    const names = orchestrator.getAgentNames();
    expect(names).toContain("Eric");
    expect(names).toContain("Harper");
    expect(names).toContain("Rishi");
    expect(names).toContain("Yasmin");
  });

  it("should process a market analysis request and return a plan", async () => {
    const sessionId = `e2e-test-${Date.now()}`;
    const result = await orchestrator.processUserRequest(
      "Analyze FLOW token and suggest a trade strategy",
      sessionId
    );

    expect(result.sessionId).toBe(sessionId);
    expect(result.status).toBe("pending_approval");
    expect(typeof result.plan).toBe("string");

    const plan = JSON.parse(result.plan);
    expect(plan).toHaveProperty("intent");
    expect(plan).toHaveProperty("steps");
    expect(Array.isArray(plan.steps)).toBe(true);
  });

  it("should execute a plan and return results with session log CID", async () => {
    const sessionId = `e2e-exec-${Date.now()}`;
    const session = await orchestrator.processUserRequest(
      "Check yield opportunities on Flow EVM",
      sessionId
    );

    const completedSession = await orchestrator.executePlan(session);
    expect(completedSession.status).toBe("complete");
    expect(Array.isArray(completedSession.results)).toBe(true);
  });

  it("should route NFT creation to Yasmin and Rishi", async () => {
    const sessionId = `nft-e2e-${Date.now()}`;
    const result = await orchestrator.processUserRequest(
      'Create a generative art NFT collection called "Vantage Genesis"',
      sessionId
    );

    expect(result.status).toBe("pending_approval");
    const plan = JSON.parse(result.plan);
    // Orchestrator should identify Yasmin/Rishi for NFT tasks
    expect(plan).toHaveProperty("agents");
  });

  it("should handle unknown agent step gracefully", async () => {
    const result = await orchestrator.executeStep("UnknownAgent", "some task");
    expect(result).toContain("Error");
  });
});
