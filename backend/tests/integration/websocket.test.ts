jest.mock("@langchain/groq", () => ({
  ChatGroq: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        intent: "test",
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
    invoke: jest.fn().mockResolvedValue({ content: "Eric's analysis" }),
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
    uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmLogCID" } }),
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

import { createServer } from "http";
import { Server } from "socket.io";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import { WebSocketHandler } from "../../src/websocket/handler";
import { Orchestrator } from "../../src/agents/orchestrator";
import { Eric } from "../../src/agents/eric";

describe("WebSocket Handler", () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let orchestrator: Orchestrator;
  let clientSocket: ClientSocket;
  let port: number;

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer, { cors: { origin: "*" } });
    orchestrator = new Orchestrator();
    orchestrator.registerAgent(new Eric());
    new WebSocketHandler(io, orchestrator);

    httpServer.listen(0, () => {
      const addr = httpServer.address() as { port: number };
      port = addr.port;
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket?.connected) clientSocket.disconnect();
    io.close();
    httpServer.close(done);
  });

  beforeEach((done) => {
    clientSocket = Client(`http://localhost:${port}`, {
      forceNew: true,
      timeout: 5000,
    });
    clientSocket.on("connect", done);
  });

  afterEach(() => {
    if (clientSocket?.connected) clientSocket.disconnect();
  });

  it("client connects successfully", (done) => {
    expect(clientSocket.connected).toBe(true);
    done();
  });

  it("user_message triggers agent_thinking then plan_ready", (done) => {
    const events: string[] = [];

    clientSocket.on("agent_thinking", () => {
      events.push("agent_thinking");
    });

    clientSocket.on("plan_ready", (data: any) => {
      events.push("plan_ready");
      expect(data).toHaveProperty("sessionId");
      expect(data).toHaveProperty("plan");
      expect(events).toContain("agent_thinking");
      done();
    });

    clientSocket.emit("user_message", { message: "Analyze the ETH market" });
  });

  it("plan_ready returns awaiting_approval status", (done) => {
    clientSocket.on("plan_ready", (data: any) => {
      expect(data.status).toBe("awaiting_approval");
      done();
    });

    clientSocket.emit("user_message", { message: "Analyze FLOW" });
  });

  it("reject event triggers execution_cancelled", (done) => {
    let sessionId: string;

    clientSocket.on("plan_ready", (data: any) => {
      sessionId = data.sessionId;
      clientSocket.emit("reject", { sessionId });
    });

    clientSocket.on("execution_cancelled", (data: any) => {
      expect(data).toHaveProperty("sessionId");
      done();
    });

    clientSocket.emit("user_message", { message: "Test request" });
  });

  it("approve with invalid sessionId emits error", (done) => {
    clientSocket.on("error", (data: any) => {
      expect(data).toHaveProperty("message");
      done();
    });

    clientSocket.emit("approve", { sessionId: "non-existent-session-id" });
  });

  it("approve triggers execution flow", (done) => {
    let executionStarted = false;

    clientSocket.on("plan_ready", (data: any) => {
      clientSocket.emit("approve", { sessionId: data.sessionId });
    });

    clientSocket.on("execution_started", () => {
      executionStarted = true;
    });

    clientSocket.on("execution_complete", (data: any) => {
      expect(executionStarted).toBe(true);
      expect(data).toHaveProperty("sessionId");
      expect(data).toHaveProperty("results");
      expect(data).toHaveProperty("logCid");
      done();
    });

    clientSocket.on("error", (data: any) => {
      // If error happens, still consider test done to avoid hanging
      done(new Error(data.message));
    });

    clientSocket.emit("user_message", {
      message: "Do a market analysis",
      sessionId: `ws-test-${Date.now()}`,
    });
  }, 20000);

  it("user_message uses provided sessionId", (done) => {
    const customSessionId = "custom-session-id-123";

    clientSocket.on("plan_ready", (data: any) => {
      expect(data.sessionId).toBe(customSessionId);
      done();
    });

    clientSocket.emit("user_message", {
      message: "Test",
      sessionId: customSessionId,
    });
  });
});
