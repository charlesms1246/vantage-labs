import { createServer } from "http";
import { Server } from "socket.io";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import { WebSocketHandler } from "../../src/websocket/handler";
import { Orchestrator } from "../../src/agents/orchestrator";
import { Eric } from "../../src/agents/eric";
import { Harper } from "../../src/agents/harper";
import { Rishi } from "../../src/agents/rishi";
import { Yasmin } from "../../src/agents/yasmin";
import { mockUserMessage } from "../fixtures/test-data";

jest.mock("@langchain/groq");
jest.mock("@langchain/google-genai");
jest.mock("@lighthouse-web3/sdk");

describe("WebSocket Integration", () => {
  let httpServer: any;
  let ioServer: Server;
  let clientSocket: ClientSocket;
  let orchestrator: Orchestrator;

  beforeAll((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer, {
      cors: { origin: "http://localhost:3000", credentials: true },
    });
    orchestrator = new Orchestrator();
    
    // Register agents
    orchestrator.registerAgent(new Eric());
    orchestrator.registerAgent(new Harper());
    orchestrator.registerAgent(new Rishi());
    orchestrator.registerAgent(new Yasmin());
    
    new WebSocketHandler(ioServer, orchestrator);

    httpServer.listen(() => {
      const port = (httpServer.address() as any).port;
      clientSocket = Client(`http://localhost:${port}`, {
        transports: ["websocket"],
        reconnection: false,
      });
      clientSocket.on("connect", done);
    });
  });

  afterAll(() => {
    ioServer.close();
    clientSocket.close();
    httpServer.close();
  });

  it("should handle user_message event", (done) => {
    clientSocket.emit("user_message", mockUserMessage);

    clientSocket.on("agent_thinking", (data) => {
      expect(data).toHaveProperty("agent", "Orchestrator");
      expect(data).toHaveProperty("status", "parsing");
      done();
    });
  });

  it("should emit plan_ready after processing", (done) => {
    const sessionId = "test-session-plan";
    clientSocket.emit("user_message", {
      message: "analyze market",
      sessionId,
      walletAddress: "0x123",
    });

    clientSocket.on("plan_ready", (data) => {
      expect(data).toHaveProperty("sessionId", sessionId);
      expect(data).toHaveProperty("plan");
      expect(data).toHaveProperty("status", "awaiting_approval");
      done();
    });
  });

  it("should handle approve event and execute plan", (done) => {
    const sessionId = "test-session-approve";

    clientSocket.emit("user_message", {
      message: "deploy a token",
      sessionId,
      walletAddress: "0x456",
    });

    let planReady = false;
    clientSocket.on("plan_ready", () => {
      planReady = true;
      clientSocket.emit("approve", { sessionId });
    });

    clientSocket.on("execution_complete", (data) => {
      expect(planReady).toBe(true);
      expect(data).toHaveProperty("sessionId", sessionId);
      expect(data).toHaveProperty("status", "success");
      done();
    });
  });

  it("should handle reject event and cancel execution", (done) => {
    const sessionId = "test-session-reject";

    clientSocket.emit("user_message", {
      message: "execute trade",
      sessionId,
      walletAddress: "0x789",
    });

    clientSocket.on("plan_ready", () => {
      clientSocket.emit("reject", { sessionId });
    });

    clientSocket.on("execution_cancelled", (data) => {
      expect(data).toHaveProperty("sessionId", sessionId);
      done();
    });
  });
});
