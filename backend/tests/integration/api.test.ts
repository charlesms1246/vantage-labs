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

const mockUploadText = jest.fn().mockResolvedValue({ data: { Hash: "QmApiCID" } });

jest.mock("@lighthouse-web3/sdk", () => ({
  default: {
    uploadText: mockUploadText,
  },
}));

const mockOwnerOf = jest.fn().mockResolvedValue("0x1234567890123456789012345678901234567890");
const mockTokenURI = jest.fn().mockResolvedValue("ipfs://QmTestAgent");
const mockGetAgentByName = jest.fn().mockResolvedValue(1n);
const mockIsVantageAgent = jest.fn().mockResolvedValue(true);
const mockGetBlockNumber = jest.fn().mockResolvedValue(12345);
const mockGetBalance = jest.fn().mockResolvedValue(BigInt("10000000000000000000"));
const mockMint = jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xabc" }) });
const mockTip = jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xdef" }) });

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  return {
    ...actual,
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBalance: mockGetBalance,
      getBlockNumber: mockGetBlockNumber,
    })),
    Contract: jest.fn().mockImplementation(() => ({
      ownerOf: mockOwnerOf,
      tokenURI: mockTokenURI,
      getAgentByName: mockGetAgentByName,
      isVantageAgent: mockIsVantageAgent,
      giveFeedback: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xfeed" }) }),
      mint: mockMint,
      tip: mockTip,
    })),
    Wallet: jest.fn().mockImplementation(() => ({ address: "0xtest" })),
  };
});

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
    mockGetBlockNumber.mockResolvedValue(12345);
    mockGetAgentByName.mockResolvedValue(1n);
    mockTokenURI.mockResolvedValue("ipfs://QmTestAgent");
    mockOwnerOf.mockResolvedValue("0x1234567890123456789012345678901234567890");
    mockUploadText.mockResolvedValue({ data: { Hash: "QmApiCID" } });
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
      mockGetAgentByName.mockRejectedValueOnce(new Error("Contract error"));
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
      mockOwnerOf.mockRejectedValueOnce(new Error("Not found"));
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
      mockUploadText.mockRejectedValueOnce(new Error("Upload failed"));
      const res = await request(app)
        .post("/api/storage/upload")
        .send({ data: "test" });
      expect(res.status).toBe(500);
    });
  });
});
