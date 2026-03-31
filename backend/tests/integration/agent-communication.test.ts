jest.mock("@langchain/groq", () => ({
  ChatGroq: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        intent: "analyze ETH and prepare trade",
        agents: ["Eric", "Harper"],
        steps: [
          { agent: "Eric", task: "Analyze ETH market conditions" },
          { agent: "Harper", task: "Prepare a trade based on Eric's analysis" },
        ],
        requiresApproval: true,
        onChainActions: ["swap ETH for FLOW"],
      }),
    }),
  })),
}));

jest.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "Eric's market analysis complete" }),
  })),
}));

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "result" }),
  })),
}));

jest.mock("@lighthouse-web3/sdk", () => ({
  default: {
    uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmAgentComm" } }),
  },
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
      giveFeedback: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xabc" }) }),
      mint: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xdef" }) }),
      tip: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xghi" }) }),
    })),
    Wallet: jest.fn().mockImplementation(() => ({ address: "0xtest" })),
  };
});

import { Orchestrator } from "../../src/agents/orchestrator";
import { Eric } from "../../src/agents/eric";
import { Harper } from "../../src/agents/harper";
import { Rishi } from "../../src/agents/rishi";
import { Yasmin } from "../../src/agents/yasmin";

describe("Multi-Agent Communication", () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
    orchestrator.registerAgent(new Eric());
    orchestrator.registerAgent(new Harper());
    orchestrator.registerAgent(new Rishi());
    orchestrator.registerAgent(new Yasmin());
  });

  it("registers Eric and Harper and getAgentNames returns them", () => {
    const names = orchestrator.getAgentNames();
    expect(names).toContain("Eric");
    expect(names).toContain("Harper");
    expect(names).toContain("Rishi");
    expect(names).toContain("Yasmin");
    expect(names).toHaveLength(4);
  });

  it("processUserRequest returns plan with both agents", async () => {
    const session = await orchestrator.processUserRequest(
      "Analyze ETH and prepare a trade",
      "multi-agent-test-1"
    );
    expect(session.sessionId).toBe("multi-agent-test-1");
    expect(session.status).toBe("pending_approval");

    const plan = JSON.parse(session.plan);
    expect(plan).toHaveProperty("agents");
    expect(plan).toHaveProperty("steps");
    expect(Array.isArray(plan.steps)).toBe(true);
  });

  it("executePlan executes all steps and returns results", async () => {
    const session = await orchestrator.processUserRequest(
      "Analyze ETH and prepare a trade",
      "multi-agent-test-2"
    );

    const completedSession = await orchestrator.executePlan(session);
    expect(completedSession.status).toBe("complete");
    expect(Array.isArray(completedSession.results)).toBe(true);
    expect(completedSession.results.length).toBeGreaterThan(0);
  });

  it("executePlan results contain agent info for each step", async () => {
    const session = await orchestrator.processUserRequest(
      "Analyze ETH and prepare a trade",
      "multi-agent-test-3"
    );

    const completedSession = await orchestrator.executePlan(session);
    for (const result of completedSession.results as any[]) {
      expect(result).toHaveProperty("agent");
      expect(result).toHaveProperty("task");
      expect(result).toHaveProperty("result");
    }
  });

  it("executePlan collects progress updates via callback", async () => {
    const session = await orchestrator.processUserRequest(
      "Analyze ETH and prepare a trade",
      "multi-agent-test-4"
    );

    const updates: any[] = [];
    await orchestrator.executePlan(session, (update) => updates.push(update));
    expect(updates.length).toBeGreaterThan(0);
    const statuses = updates.map(u => u.status);
    expect(statuses).toContain("executing");
  });

  it("executeStep returns error for unknown agent", async () => {
    const result = await orchestrator.executeStep("UnknownBot", "do something");
    expect(result).toContain("Error");
    expect(result).toContain("UnknownBot");
  });

  it("all four agents can be invoked independently", async () => {
    const ericResult = await orchestrator.executeStep("Eric", "Analyze FLOW market");
    const harperResult = await orchestrator.executeStep("Harper", "Check balances");
    const rishiResult = await orchestrator.executeStep("Rishi", "Review contract code");
    const yasminResult = await orchestrator.executeStep("Yasmin", "Create tweet for launch");

    expect(typeof ericResult).toBe("string");
    expect(typeof harperResult).toBe("string");
    expect(typeof rishiResult).toBe("string");
    expect(typeof yasminResult).toBe("string");
  });
});
