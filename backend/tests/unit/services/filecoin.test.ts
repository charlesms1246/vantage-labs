const mockOwnerOf = jest.fn().mockResolvedValue("0x1234567890123456789012345678901234567890");
const mockTokenURI = jest.fn().mockResolvedValue("ipfs://QmTestAgent");
const mockGetAgentByName = jest.fn().mockResolvedValue(1n);
const mockIsVantageAgent = jest.fn().mockResolvedValue(true);
const mockGiveFeedback = jest.fn().mockResolvedValue({
  wait: jest.fn().mockResolvedValue({ hash: "0xabc123" }),
});

const mockContractInstance = {
  ownerOf: mockOwnerOf,
  tokenURI: mockTokenURI,
  getAgentByName: mockGetAgentByName,
  isVantageAgent: mockIsVantageAgent,
  giveFeedback: mockGiveFeedback,
};

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  return {
    ...actual,
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBlockNumber: jest.fn().mockResolvedValue(12345),
    })),
    Contract: jest.fn().mockImplementation(() => mockContractInstance),
    Wallet: jest.fn().mockImplementation(() => ({
      address: "0xce4389ACb79463062c362fACB8CB04513fA3D8D8",
    })),
  };
});

jest.mock("@lighthouse-web3/sdk", () => ({
  default: {
    uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmMockCID123" } }),
  },
}));

import { filecoinService } from "../../../src/services/filecoin";

describe("FilecoinService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOwnerOf.mockResolvedValue("0x1234567890123456789012345678901234567890");
    mockTokenURI.mockResolvedValue("ipfs://QmTestAgent");
    mockGetAgentByName.mockResolvedValue(1n);
    mockIsVantageAgent.mockResolvedValue(true);
    mockGiveFeedback.mockResolvedValue({
      wait: jest.fn().mockResolvedValue({ hash: "0xabc123" }),
    });
  });

  describe("verifyAgent", () => {
    it("returns true when ownerOf succeeds and address is not zero", async () => {
      const result = await filecoinService.verifyAgent(1);
      expect(result).toBe(true);
    });

    it("returns false when ownerOf throws", async () => {
      mockOwnerOf.mockRejectedValueOnce(new Error("Token does not exist"));
      const result = await filecoinService.verifyAgent(999);
      expect(result).toBe(false);
    });

    it("returns false when ownerOf returns ZeroAddress", async () => {
      mockOwnerOf.mockResolvedValueOnce("0x0000000000000000000000000000000000000000");
      const result = await filecoinService.verifyAgent(0);
      expect(result).toBe(false);
    });
  });

  describe("getAgentURI", () => {
    it("returns the tokenURI", async () => {
      const uri = await filecoinService.getAgentURI(1);
      expect(uri).toBe("ipfs://QmTestAgent");
    });

    it("calls tokenURI with the agent id", async () => {
      await filecoinService.getAgentURI(42);
      expect(mockTokenURI).toHaveBeenCalledWith(42);
    });
  });

  describe("getAgentByName", () => {
    it("returns a bigint", async () => {
      const result = await filecoinService.getAgentByName("Eric");
      expect(typeof result).toBe("bigint");
      expect(result).toBe(1n);
    });

    it("calls getAgentByName with the name", async () => {
      await filecoinService.getAgentByName("Harper");
      expect(mockGetAgentByName).toHaveBeenCalledWith("Harper");
    });
  });

  describe("isVantageAgent", () => {
    it("returns true when agent is registered", async () => {
      const result = await filecoinService.isVantageAgent(1);
      expect(result).toBe(true);
    });

    it("returns false when agent is not registered", async () => {
      mockIsVantageAgent.mockResolvedValueOnce(false);
      const result = await filecoinService.isVantageAgent(999);
      expect(result).toBe(false);
    });
  });

  describe("giveFeedback", () => {
    it("returns a transaction hash", async () => {
      const hash = await filecoinService.giveFeedback(1, 5, "quality", "helpful");
      expect(hash).toBe("0xabc123");
    });
  });

  describe("logAction", () => {
    it("does not throw", async () => {
      await expect(filecoinService.logAction({ action: "test", agent: "Eric" })).resolves.not.toThrow();
    });
  });
});
