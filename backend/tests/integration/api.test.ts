// All mocks must be before any imports
jest.mock("@langchain/groq", () => ({
  ChatGroq: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        intent: "test",
        agents: ["Eric"],
        steps: [{ agent: "Eric", task: "test" }],
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

jest.mock("../../src/services/filecoin", () => ({
  filecoinService: {
    verifyAgent: jest.fn().mockResolvedValue(true),
    getAgentURI: jest.fn().mockResolvedValue("ipfs://QmTestAgent"),
    getAgentByName: jest.fn().mockResolvedValue(1n),
    isVantageAgent: jest.fn().mockResolvedValue(true),
    giveFeedback: jest.fn().mockResolvedValue("0xabc"),
    logAction: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../src/services/lighthouse", () => ({
  lighthouseService: {
    upload: jest.fn().mockResolvedValue("QmApiCID"),
    getGatewayUrl: jest.fn().mockImplementation((cid: string) => `https://gateway.lighthouse.storage/ipfs/${cid}`),
    getFile: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  const MockProvider = jest.fn().mockImplementation(() => ({ getBlockNumber: jest.fn().mockResolvedValue(12345) }));
  return { ...actual, JsonRpcProvider: MockProvider, Contract: jest.fn().mockImplementation(() => ({})), Wallet: jest.fn().mockImplementation(() => ({ address: "0xtest" })), ethers: { ...actual.ethers, JsonRpcProvider: MockProvider } };
});

jest.mock("@lighthouse-web3/sdk", () => ({
  __esModule: true,
  default: {
    uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmApiCID" } }),
  },
}));

import express from "express";
import request from "supertest";
import apiRoutes from "../../src/routes/api";
import healthRoutes from "../../src/routes/health";

const app = express();
app.use(express.json());
app.use("/api", apiRoutes);
app.use("/health", healthRoutes);

describe("API Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.requireMock("../../src/services/filecoin").filecoinService.getAgentByName.mockResolvedValue(1n);
    jest.requireMock("../../src/services/filecoin").filecoinService.getAgentURI.mockResolvedValue("ipfs://QmTestAgent");
    jest.requireMock("../../src/services/filecoin").filecoinService.verifyAgent.mockResolvedValue(true);
    jest.requireMock("../../src/services/lighthouse").lighthouseService.upload.mockResolvedValue("QmApiCID");
    jest.requireMock("../../src/services/lighthouse").lighthouseService.getGatewayUrl.mockImplementation(
      (cid: string) => `https://gateway.lighthouse.storage/ipfs/${cid}`
    );
  });

  describe("GET /health", () => {
    it("returns status ok", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
    });

    it("returns timestamp", async () => {
      const res = await request(app).get("/health");
      expect(res.body).toHaveProperty("timestamp");
    });

    it("returns services status", async () => {
      const res = await request(app).get("/health");
      expect(res.body).toHaveProperty("services");
    });
  });

  describe("GET /api/agents", () => {
    it("returns agents array", async () => {
      const res = await request(app).get("/api/agents");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("agents");
      expect(Array.isArray(res.body.agents)).toBe(true);
    });

    it("returns 4 agents", async () => {
      const res = await request(app).get("/api/agents");
      expect(res.body.agents).toHaveLength(4);
    });

    it("agents have name, agentId, uri fields", async () => {
      const res = await request(app).get("/api/agents");
      const agent = res.body.agents[0];
      expect(agent).toHaveProperty("name");
      expect(agent).toHaveProperty("agentId");
      expect(agent).toHaveProperty("uri");
    });

    it("returns 500 on service error", async () => {
      jest.requireMock("../../src/services/filecoin").filecoinService.getAgentByName.mockRejectedValueOnce(new Error("Contract error"));
      const res = await request(app).get("/api/agents");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/agents/:agentId/verify", () => {
    it("returns agentId and verified true", async () => {
      const res = await request(app).get("/api/agents/1/verify");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("agentId", 1);
      expect(res.body).toHaveProperty("verified", true);
    });

    it("returns verified false when agent not found", async () => {
      jest.requireMock("../../src/services/filecoin").filecoinService.verifyAgent.mockResolvedValueOnce(false);
      const res = await request(app).get("/api/agents/999/verify");
      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(false);
    });
  });

  describe("POST /api/storage/upload", () => {
    it("returns cid and url with valid data", async () => {
      const res = await request(app)
        .post("/api/storage/upload")
        .send({ data: "test data" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("cid", "QmApiCID");
      expect(res.body).toHaveProperty("url");
    });

    it("returns 400 without data", async () => {
      const res = await request(app)
        .post("/api/storage/upload")
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("accepts object data and stringifies it", async () => {
      const res = await request(app)
        .post("/api/storage/upload")
        .send({ data: { token: "FLOW", price: 1.5 } });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("cid");
    });

    it("returns 500 on upload error", async () => {
      jest.requireMock("../../src/services/lighthouse").lighthouseService.upload.mockRejectedValueOnce(new Error("Upload failed"));
      const res = await request(app)
        .post("/api/storage/upload")
        .send({ data: "test" });
      expect(res.status).toBe(500);
    });
  });
});
