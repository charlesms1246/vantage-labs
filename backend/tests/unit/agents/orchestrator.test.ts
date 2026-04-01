import { Orchestrator } from "../../../src/agents/orchestrator";
import { Eric } from "../../../src/agents/eric";
import { Harper } from "../../../src/agents/harper";
import { Rishi } from "../../../src/agents/rishi";
import { Yasmin } from "../../../src/agents/yasmin";
import { mockUserMessage, mockPlan } from "../../fixtures/test-data";

// Mock LLM
jest.mock("@langchain/groq");

describe("Orchestrator", () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  describe("initialization", () => {
    it("should create orchestrator instance", () => {
      expect(orchestrator).toBeDefined();
    });
  });

  describe("agent registration", () => {
    it("should register agents correctly", () => {
      const eric = new Eric();
      expect(() => {
        orchestrator.registerAgent(eric);
      }).not.toThrow();
    });

    it("should register all four agents", () => {
      const eric = new Eric();
      const harper = new Harper();
      const rishi = new Rishi();
      const yasmin = new Yasmin();

      orchestrator.registerAgent(eric);
      orchestrator.registerAgent(harper);
      orchestrator.registerAgent(rishi);
      orchestrator.registerAgent(yasmin);

      const names = orchestrator.getAgentNames();
      expect(names).toContain("Eric");
      expect(names).toContain("Harper");
      expect(names).toContain("Rishi");
      expect(names).toContain("Yasmin");
    });
  });

  describe("processUserRequest", () => {
    beforeEach(() => {
      orchestrator.registerAgent(new Eric());
      orchestrator.registerAgent(new Harper());
      orchestrator.registerAgent(new Rishi());
      orchestrator.registerAgent(new Yasmin());
    });

    it("should create session with proper structure", async () => {
      const result = await orchestrator.processUserRequest(
        mockUserMessage.message,
        mockUserMessage.sessionId,
        mockUserMessage.walletAddress
      );

      expect(result).toHaveProperty("sessionId", mockUserMessage.sessionId);
      expect(result).toHaveProperty("plan");
      expect(result).toHaveProperty("status", "pending_approval");
      expect(result).toHaveProperty("messages");
      expect(result).toHaveProperty("results");
    });

    it("should generate valid JSON plan", async () => {
      const result = await orchestrator.processUserRequest(
        "analyze the market",
        "session-123",
        "0x1234"
      );

      const plan = JSON.parse(result.plan);
      expect(plan).toHaveProperty("intent");
      expect(plan).toHaveProperty("agents");
      expect(plan).toHaveProperty("steps");
    });
  });

  describe("executeStep", () => {
    beforeEach(() => {
      orchestrator.registerAgent(new Eric());
      orchestrator.registerAgent(new Harper());
    });

    it("should handle case-insensitive agent lookup", async () => {
      const result = await orchestrator.executeStep("eric", "analyze market");
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should return error for unknown agent", async () => {
      const result = await orchestrator.executeStep(
        "NonExistentAgent",
        "do something"
      );
      expect(result).toContain("Error");
    });
  });

  describe("executePlan", () => {
    beforeEach(() => {
      orchestrator.registerAgent(new Eric());
      orchestrator.registerAgent(new Harper());
      orchestrator.registerAgent(new Rishi());
      orchestrator.registerAgent(new Yasmin());
    });

    it("should execute plan steps sequentially", async () => {
      const session = {
        sessionId: "test-123",
        walletAddress: "0x1234",
        messages: [],
        plan: JSON.stringify(mockPlan),
        status: "pending_approval" as const,
        results: [],
      };

      const progressUpdates: any[] = [];
      const onProgress = (update: any) => {
        progressUpdates.push(update);
      };

      const result = await orchestrator.executePlan(session, onProgress);

      expect(result).toHaveProperty("status", "complete");
      expect(result).toHaveProperty("results");
      expect(Array.isArray(result.results)).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);
    });
  });
});
