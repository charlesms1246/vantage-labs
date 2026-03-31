let sharedContractImpl: any;

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  sharedContractImpl = {
    ownerOf: jest.fn().mockResolvedValue("0x1234567890123456789012345678901234567890"),
    tokenURI: jest.fn().mockResolvedValue("ipfs://QmTestAgent"),
    getAgentByName: jest.fn().mockResolvedValue(1n),
    isVantageAgent: jest.fn().mockResolvedValue(true),
    giveFeedback: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xabc123" }) }),
  };
  const MockContract = jest.fn().mockImplementation(() => sharedContractImpl);
  const MockProvider = jest.fn().mockImplementation(() => ({ getBlockNumber: jest.fn().mockResolvedValue(12345) }));
  const MockWallet = jest.fn().mockImplementation(() => ({ address: "0xce4389ACb79463062c362fACB8CB04513fA3D8D8" }));
  return {
    ...actual,
    Contract: MockContract,
    JsonRpcProvider: MockProvider,
    Wallet: MockWallet,
    ethers: { ...actual.ethers, Contract: MockContract, JsonRpcProvider: MockProvider, Wallet: MockWallet },
  };
});

jest.mock("@lighthouse-web3/sdk", () => ({
  __esModule: true,
  default: { uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmMockCID123" } }) },
}));

import { filecoinService } from "../../../src/services/filecoin";

describe("FilecoinService", () => {
  beforeEach(() => {
    if (sharedContractImpl) {
      sharedContractImpl.ownerOf.mockResolvedValue("0x1234567890123456789012345678901234567890");
      sharedContractImpl.tokenURI.mockResolvedValue("ipfs://QmTestAgent");
      sharedContractImpl.getAgentByName.mockResolvedValue(1n);
      sharedContractImpl.isVantageAgent.mockResolvedValue(true);
      sharedContractImpl.giveFeedback.mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xabc123" }) });
    }
  });

  describe("verifyAgent", () => {
    it("returns true when ownerOf succeeds and address is not ZeroAddress", async () => {
      const result = await filecoinService.verifyAgent(1);
      expect(result).toBe(true);
    });

    it("returns false when ownerOf throws", async () => {
      sharedContractImpl.ownerOf.mockRejectedValueOnce(new Error("Not found"));
      const result = await filecoinService.verifyAgent(999);
      expect(result).toBe(false);
    });

    it("returns false when ownerOf returns ZeroAddress", async () => {
      sharedContractImpl.ownerOf.mockResolvedValueOnce("0x0000000000000000000000000000000000000000");
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
      expect(sharedContractImpl.tokenURI).toHaveBeenCalledWith(42);
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
      expect(sharedContractImpl.getAgentByName).toHaveBeenCalledWith("Harper");
    });
  });

  describe("isVantageAgent", () => {
    it("returns true when agent is registered", async () => {
      const result = await filecoinService.isVantageAgent(1);
      expect(result).toBe(true);
    });

    it("returns false when agent is not registered", async () => {
      sharedContractImpl.isVantageAgent.mockResolvedValueOnce(false);
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
