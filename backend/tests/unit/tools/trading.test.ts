const mockOwnerOf = jest.fn().mockResolvedValue("0x1234567890123456789012345678901234567890");
const mockIsVantageAgent = jest.fn().mockResolvedValue(true);
const mockGetAgentByName = jest.fn().mockResolvedValue(1n);
const mockTokenURI = jest.fn().mockResolvedValue("ipfs://QmAgent");
const mockMint = jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xabc" }) });
const mockTip = jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xdef" }) });

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  return {
    ...actual,
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBalance: jest.fn().mockResolvedValue(BigInt("10000000000000000000")),
      getBlockNumber: jest.fn().mockResolvedValue(12345),
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

jest.mock("@lighthouse-web3/sdk", () => ({
  default: {
    uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmMockCID123" } }),
  },
}));

import {
  VerifyAgentIdentityTool,
  PrepareTxTool,
  ExecuteSwapTool,
} from "../../../src/tools/trading";

describe("Trading Tools", () => {
  describe("VerifyAgentIdentityTool", () => {
    let tool: VerifyAgentIdentityTool;

    beforeEach(() => {
      tool = new VerifyAgentIdentityTool();
      jest.clearAllMocks();
      mockOwnerOf.mockResolvedValue("0x1234567890123456789012345678901234567890");
    });

    it("has correct name", () => {
      expect(tool.name).toBe("verify_agent_identity");
    });

    it("returns JSON with agentId and verified fields", async () => {
      const result = await tool._call(JSON.stringify({ agentId: 1 }));
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("agentId", 1);
      expect(parsed).toHaveProperty("verified");
      expect(parsed).toHaveProperty("timestamp");
    });

    it("returns verified true for valid agent", async () => {
      const result = await tool._call(JSON.stringify({ agentId: 1 }));
      const parsed = JSON.parse(result);
      expect(parsed.verified).toBe(true);
    });

    it("returns verified false when agent not found", async () => {
      mockOwnerOf.mockRejectedValueOnce(new Error("Not found"));
      const result = await tool._call(JSON.stringify({ agentId: 999 }));
      const parsed = JSON.parse(result);
      expect(parsed.verified).toBe(false);
    });
  });

  describe("PrepareTxTool", () => {
    let tool: PrepareTxTool;

    beforeEach(() => {
      tool = new PrepareTxTool();
    });

    it("has correct name", () => {
      expect(tool.name).toBe("prepare_transaction");
    });

    it("returns JSON with tx data", async () => {
      const input = JSON.stringify({ action: "swap", params: { from: "ETH", to: "FLOW" } });
      const result = await tool._call(input);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("action", "swap");
      expect(parsed).toHaveProperty("network");
      expect(parsed).toHaveProperty("chainId");
      expect(parsed).toHaveProperty("status", "pending_approval");
      expect(parsed).toHaveProperty("requiresUserSignature", true);
    });
  });

  describe("ExecuteSwapTool", () => {
    let tool: ExecuteSwapTool;

    beforeEach(() => {
      tool = new ExecuteSwapTool();
    });

    it("has correct name", () => {
      expect(tool.name).toBe("execute_swap");
    });

    it("returns JSON with status simulated", async () => {
      const input = JSON.stringify({ fromToken: "ETH", toToken: "FLOW", amount: "1.0" });
      const result = await tool._call(input);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("status", "simulated");
      expect(parsed).toHaveProperty("fromToken", "ETH");
      expect(parsed).toHaveProperty("toToken", "FLOW");
    });
  });
});
