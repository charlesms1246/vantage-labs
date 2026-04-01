import request from "supertest";
import express from "express";
import apiRoutes from "../../src/routes/api";
import healthRoutes from "../../src/routes/health";

jest.mock("@langchain/groq");
jest.mock("@langchain/google-genai");
jest.mock("@lighthouse-web3/sdk");

describe("API Integration", () => {
  const app = express();
  app.use(express.json());
  app.use("/api", apiRoutes);
  app.use("/health", healthRoutes);

  describe("GET /health", () => {
    it("should return healthy status", async () => {
      const res = await request(app).get("/health");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
    });

    it("should include timestamp", async () => {
      const res = await request(app).get("/health");

      expect(res.body).toHaveProperty("timestamp");
    });
  });

  describe("GET /api/agents", () => {
    it("should return list of agents", async () => {
      const res = await request(app).get("/api/agents");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("agents");
      expect(Array.isArray(res.body.agents)).toBe(true);
    });

    it("should return agent with name and role", async () => {
      const res = await request(app).get("/api/agents");

      if (res.body.agents.length > 0) {
        const agent = res.body.agents[0];
        expect(agent).toHaveProperty("name");
        expect(agent).toHaveProperty("role");
      }
    });
  });

  describe("GET /api/agents/:name/status", () => {
    it("should return status for specific agent", async () => {
      const res = await request(app).get("/api/agents/Eric/status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("name");
      expect(res.body).toHaveProperty("status");
    });

    it("should return 404 for non-existent agent", async () => {
      const res = await request(app).get("/api/agents/NonExistent/status");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/session", () => {
    it("should create a new session", async () => {
      const res = await request(app)
        .post("/api/session")
        .send({ walletAddress: "0x1234567890123456789012345678901234567890" });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("sessionId");
      expect(res.body).toHaveProperty("walletAddress");
    });

    it("should generate unique session IDs", async () => {
      const res1 = await request(app)
        .post("/api/session")
        .send({ walletAddress: "0x1111111111111111111111111111111111111111" });

      const res2 = await request(app)
        .post("/api/session")
        .send({ walletAddress: "0x2222222222222222222222222222222222222222" });

      expect(res1.body.sessionId).not.toBe(res2.body.sessionId);
    });
  });

  describe("GET /api/session/:sessionId", () => {
    it("should retrieve session data", async () => {
      const createRes = await request(app)
        .post("/api/session")
        .send({ walletAddress: "0x3333333333333333333333333333333333333333" });

      const sessionId = createRes.body.sessionId;

      const getRes = await request(app).get(`/api/session/${sessionId}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body).toHaveProperty("sessionId", sessionId);
    });

    it("should return 404 for non-existent session", async () => {
      const res = await request(app).get("/api/session/non-existent-id");

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/session/:sessionId/history", () => {
    it("should return empty history for new session", async () => {
      const createRes = await request(app)
        .post("/api/session")
        .send({ walletAddress: "0x4444444444444444444444444444444444444444" });

      const sessionId = createRes.body.sessionId;

      const res = await request(app).get(`/api/session/${sessionId}/history`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("history");
      expect(Array.isArray(res.body.history)).toBe(true);
    });
  });
});
