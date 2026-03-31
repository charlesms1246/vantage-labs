// Mocks must come before all imports
jest.mock("@langchain/groq", () => ({
  ChatGroq: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        intent: "analyze market",
        agents: ["Eric"],
        steps: [{ agent: "Eric", task: "Analyze FLOW market" }],
        requiresApproval: true,
        onChainActions: [],
      }),
    }),
  })),
}));

jest.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "FLOW market analysis complete" }),
  })),
}));

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "result" }),
  })),
}));

jest.mock("@lighthouse-web3/sdk", () => ({
  __esModule: true,
  default: {
    uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmFrontendBackendCID" } }),
  },
}));

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  return {
    ...actual,
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBlockNumber: jest.fn().mockResolvedValue(12345),
    })),
    Contract: jest.fn().mockImplementation(() => ({
      getAgentByName: jest.fn().mockResolvedValue(1n),
      tokenURI: jest.fn().mockResolvedValue("ipfs://QmTestAgent"),
      isVantageAgent: jest.fn().mockResolvedValue(true),
    })),
    Wallet: jest.fn().mockImplementation(() => ({ address: "0xtest" })),
  };
});

jest.mock("../../src/services/filecoin", () => ({
  filecoinService: {
    getAgentByName: jest.fn().mockResolvedValue(1n),
    getAgentURI: jest.fn().mockResolvedValue("ipfs://QmTestAgent"),
    verifyAgent: jest.fn().mockResolvedValue(true),
    getAgentId: jest.fn().mockResolvedValue(1),
    getAgentReputation: jest.fn().mockResolvedValue({ averageScore: 90 }),
    isVantageAgent: jest.fn().mockResolvedValue(true),
    logAction: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../src/services/lighthouse", () => ({
  lighthouseService: {
    upload: jest.fn().mockResolvedValue("QmFrontendBackendCID"),
    getGatewayUrl: jest.fn().mockImplementation((cid: string) => `https://gateway.lighthouse.storage/ipfs/${cid}`),
    getFile: jest.fn().mockResolvedValue({ type: "session_log", sessionId: "test" }),
  },
}));

import { createServer } from "http";
import express from "express";
import { Server } from "socket.io";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import request from "supertest";
import cors from "cors";
import { WebSocketHandler } from "../../src/websocket/handler";
import { Orchestrator } from "../../src/agents/orchestrator";
import { Eric } from "../../src/agents/eric";
import { Harper } from "../../src/agents/harper";
import { Rishi } from "../../src/agents/rishi";
import { Yasmin } from "../../src/agents/yasmin";
import apiRoutes from "../../src/routes/api";
import healthRoutes from "../../src/routes/health";

describe("Frontend-Backend Integration", () => {
  let clientSocket: ClientSocket;
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let app: express.Express;
  let port: number;

  beforeAll((done) => {
    app = express();
    app.use(cors({ origin: "*" }));
    app.use(express.json());
    app.use("/api", apiRoutes);
    app.use("/health", healthRoutes);

    httpServer = createServer(app);
    io = new Server(httpServer, { cors: { origin: "*" } });

    const orchestrator = new Orchestrator();
    orchestrator.registerAgent(new Eric());
    orchestrator.registerAgent(new Harper());
    orchestrator.registerAgent(new Rishi());
    orchestrator.registerAgent(new Yasmin());

    new WebSocketHandler(io, orchestrator);

    httpServer.listen(0, () => {
      const addr = httpServer.address() as { port: number };
      port = addr.port;

      clientSocket = Client(`http://localhost:${port}`, {
        transports: ["websocket"],
        query: { walletAddress: "0x1234567890123456789012345678901234567890" },
      });
      clientSocket.on("connect", done);
    });
  });

  afterAll((done) => {
    if (clientSocket?.connected) clientSocket.disconnect();
    io.close();
    httpServer.close(done);
  });

  describe("REST API", () => {
    it("should return health status", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });

    it("should create a session", async () => {
      const res = await request(app)
        .post("/api/session")
        .send({ walletAddress: "0x1234567890123456789012345678901234567890" });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("sessionId");
    });

    it("should retrieve a created session", async () => {
      const createRes = await request(app)
        .post("/api/session")
        .send({ walletAddress: "0xabc" });
      const { sessionId } = createRes.body;

      const res = await request(app).get(`/api/session/${sessionId}`);
      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBe(sessionId);
    });

    it("should return 404 for unknown session", async () => {
      const res = await request(app).get("/api/session/nonexistent-session-id");
      expect(res.status).toBe(404);
    });

    it("should return agents list with 4 agents", async () => {
      const res = await request(app).get("/api/agents");
      expect(res.status).toBe(200);
      expect(res.body.agents).toHaveLength(4);
    });

    it("should return agent status by name", async () => {
      const res = await request(app).get("/api/agents/Eric/status");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("name", "Eric");
      expect(res.body).toHaveProperty("verified");
      expect(res.body).toHaveProperty("status", "ready");
    });

    it("should return session history", async () => {
      const createRes = await request(app)
        .post("/api/session")
        .send({ walletAddress: "0xdef" });
      const { sessionId } = createRes.body;

      const res = await request(app).get(`/api/session/${sessionId}/history`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("history");
      expect(Array.isArray(res.body.history)).toBe(true);
    });

    it("should retrieve a proof by CID", async () => {
      const res = await request(app).get("/api/proofs/QmTestCID");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("cid", "QmTestCID");
      expect(res.body).toHaveProperty("data");
    });
  });

  describe("WebSocket Communication", () => {
    let freshSocket: ClientSocket;

    beforeEach((done) => {
      freshSocket = Client(`http://localhost:${port}`, {
        forceNew: true,
        transports: ["websocket"],
      });
      freshSocket.on("connect", done);
    });

    afterEach(() => {
      if (freshSocket?.connected) freshSocket.disconnect();
    });

    it("should receive agent_thinking event on user_message", (done) => {
      freshSocket.on("agent_thinking", (data: { agent: string }) => {
        expect(data).toHaveProperty("agent");
        done();
      });

      freshSocket.emit("user_message", {
        message: "Analyze FLOW market",
        sessionId: `test-${Date.now()}`,
      });
    });

    it("should receive plan_ready with awaiting_approval status", (done) => {
      freshSocket.on("plan_ready", (data: { sessionId: string; plan: object; status: string }) => {
        expect(data).toHaveProperty("sessionId");
        expect(data).toHaveProperty("plan");
        expect(data.status).toBe("awaiting_approval");
        done();
      });

      freshSocket.emit("user_message", {
        message: "Analyze FLOW token",
        sessionId: `test-${Date.now()}`,
      });
    }, 15000);

    it("should complete full message flow: thinking → plan_ready", (done) => {
      const events: string[] = [];

      freshSocket.on("agent_thinking", () => events.push("agent_thinking"));
      freshSocket.on("plan_ready", () => {
        events.push("plan_ready");
        expect(events).toContain("agent_thinking");
        done();
      });

      freshSocket.emit("user_message", {
        message: "Analyze FLOW market conditions",
        sessionId: `flow-test-${Date.now()}`,
      });
    }, 15000);

    it("should handle approval and complete execution", (done) => {
      let executionStarted = false;

      freshSocket.on("plan_ready", (data: { sessionId: string }) => {
        freshSocket.emit("approve", { sessionId: data.sessionId });
      });

      freshSocket.on("execution_started", () => {
        executionStarted = true;
      });

      freshSocket.on("execution_complete", (data: { sessionId: string; logCid: string; status: string }) => {
        expect(executionStarted).toBe(true);
        expect(data).toHaveProperty("logCid");
        expect(data.status).toBe("success");
        done();
      });

      freshSocket.on("error", (data: { message: string }) => {
        done(new Error(data.message));
      });

      freshSocket.emit("user_message", {
        message: "Do a market analysis",
        sessionId: `approve-test-${Date.now()}`,
      });
    }, 30000);

    it("should handle rejection with execution_cancelled", (done) => {
      freshSocket.on("plan_ready", (data: { sessionId: string }) => {
        freshSocket.emit("reject", { sessionId: data.sessionId });
      });

      freshSocket.on("execution_cancelled", (data: { sessionId: string }) => {
        expect(data).toHaveProperty("sessionId");
        done();
      });

      freshSocket.emit("user_message", {
        message: "Test rejection",
        sessionId: `reject-test-${Date.now()}`,
      });
    }, 15000);

    it("should emit error for invalid session approval", (done) => {
      freshSocket.on("error", (data: { message: string }) => {
        expect(data).toHaveProperty("message");
        done();
      });

      freshSocket.emit("approve", { sessionId: "nonexistent-session-id" });
    });
  });
});
