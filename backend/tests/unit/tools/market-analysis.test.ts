jest.mock("@lighthouse-web3/sdk", () => ({
  default: {
    uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmAnalysisCID" } }),
  },
}));

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  const MockProvider = jest.fn().mockImplementation(() => ({ getBlockNumber: jest.fn().mockResolvedValue(12345) }));
  const MockContract = jest.fn().mockImplementation(() => ({ ownerOf: jest.fn(), tokenURI: jest.fn(), getAgentByName: jest.fn().mockResolvedValue(1n), isVantageAgent: jest.fn().mockResolvedValue(true) }));
  const MockWallet = jest.fn().mockImplementation(() => ({ address: "0xtest" }));
  return { ...actual, JsonRpcProvider: MockProvider, Contract: MockContract, Wallet: MockWallet, ethers: { ...actual.ethers, JsonRpcProvider: MockProvider, Contract: MockContract, Wallet: MockWallet } };
});

import {
  AnalyzeMarketTool,
  StoreAnalysisTool,
  GetYieldOpportunitiesTool,
} from "../../../src/tools/market-analysis";

describe("Market Analysis Tools", () => {
  beforeEach(() => {
    jest.requireMock("@lighthouse-web3/sdk").default.uploadText.mockClear();
    jest.requireMock("@lighthouse-web3/sdk").default.uploadText.mockResolvedValue({ data: { Hash: "QmAnalysisCID" } });
  });

  describe("AnalyzeMarketTool", () => {
    let tool: AnalyzeMarketTool;

    beforeEach(() => {
      tool = new AnalyzeMarketTool();
    });

    it("has correct name", () => {
      expect(tool.name).toBe("analyze_market");
    });

    it("returns JSON with recommendation for token", async () => {
      const result = await tool._call(JSON.stringify({ token: "ETH" }));
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("token", "ETH");
      expect(parsed).toHaveProperty("recommendation");
      expect(parsed).toHaveProperty("confidence");
    });

    it("handles plain string input", async () => {
      const result = await tool._call("FLOW");
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("token", "FLOW");
    });

    it("includes timestamp in result", async () => {
      const result = await tool._call(JSON.stringify({ token: "BTC" }));
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("timestamp");
    });

    it("includes reasoning", async () => {
      const result = await tool._call(JSON.stringify({ token: "ETH" }));
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("reasoning");
    });
  });

  describe("StoreAnalysisTool", () => {
    let tool: StoreAnalysisTool;

    beforeEach(() => {
      tool = new StoreAnalysisTool();
    });

    it("has correct name", () => {
      expect(tool.name).toBe("store_analysis");
    });

    it("returns JSON with cid", async () => {
      const data = JSON.stringify({ token: "ETH", recommendation: "HOLD" });
      const result = await tool._call(data);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("cid", "QmAnalysisCID");
      expect(parsed).toHaveProperty("stored", true);
    });

    it("returns url in response", async () => {
      const result = await tool._call("some data");
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("url");
      expect(parsed.url).toContain("QmAnalysisCID");
    });

    it("calls lighthouse uploadText", async () => {
      await tool._call("test data");
      expect(jest.requireMock("@lighthouse-web3/sdk").default.uploadText).toHaveBeenCalled();
    });
  });

  describe("GetYieldOpportunitiesTool", () => {
    let tool: GetYieldOpportunitiesTool;

    beforeEach(() => {
      tool = new GetYieldOpportunitiesTool();
    });

    it("has correct name", () => {
      expect(tool.name).toBe("get_yield_opportunities");
    });

    it("returns JSON with opportunities array", async () => {
      const result = await tool._call("");
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("opportunities");
      expect(Array.isArray(parsed.opportunities)).toBe(true);
    });

    it("opportunities have required fields", async () => {
      const result = await tool._call("");
      const parsed = JSON.parse(result);
      const first = parsed.opportunities[0];
      expect(first).toHaveProperty("protocol");
      expect(first).toHaveProperty("apy");
      expect(first).toHaveProperty("risk");
    });
  });
});
