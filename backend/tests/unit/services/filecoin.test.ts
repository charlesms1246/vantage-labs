jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  const contractImpl = {
    ownerOf: jest.fn().mockResolvedValue("0x1234567890123456789012345678901234567890"),
    tokenURI: jest.fn().mockResolvedValue("ipfs://QmTestAgent"),
    getAgentByName: jest.fn().mockResolvedValue(1n),
    isVantageAgent: jest.fn().mockResolvedValue(true),
    giveFeedback: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xabc123" }) }),
  };
  const MockContract = jest.fn().mockImplementation(() => contractImpl);
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
  default: { uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmMockCID123" } }) },
}));

import { ethers } from "ethers";
import { filecoinService } from "../../../src/services/filecoin";

function getContractImpl() {
  return (ethers.Contract as jest.Mock).mock.results[0]?.value || (ethers.Contract as jest.Mock).mock.results[1]?.value;
}

describe("FilecoinService", () => {
  beforeEach(() => {
    const MockContract = ethers.Contract as jest.Mock;
    MockContract.mock.results.forEach((r: any) => {
      if (r.value?.ownerOf) {
        r.value.ownerOf.mockResolvedValue("0x1234567890123456789012345678901234567890");
        r.value.tokenURI.mockResolvedValue("ipfs://QmTestAgent");
        r.value.getAgentByName.mockResolvedValue(1n);
        r.value.isVantageAgent.mockResolvedValue(true);
        r.value.giveFeedback.mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xabc123" }) });
      }
    });
  });

  describe("verifyAgent", () => {
    it("returns true when ownerOf succeeds and address is not ZeroAddress", async () => {
      const result = await filecoinService.verifyAgent(1);
      expect(result).toBe(true);
    });

    it("returns false when ownerOf throws", async () => {
      const impl = getContractImpl();
      if (impl?.ownerOf) impl.ownerOf.mockRejectedValueOnce(new Error("Not found"));
      const result = await filecoinService.verifyAgent(999);
      expect(result).toBe(false);
    });
  });

  describe("getAgentURI", () => {
    it("returns the tokenURI", async () => {
      const uri = await filecoinService.getAgentURI(1);
      expect(uri).toBe("ipfs://QmTestAgent");
    });
  });

  describe("getAgentByName", () => {
    it("returns a bigint", async () => {
      const result = await filecoinService.getAgentByName("Eric");
      expect(typeof result).toBe("bigint");
    });
  });

  describe("isVantageAgent", () => {
    it("returns true when agent is registered", async () => {
      const result = await filecoinService.isVantageAgent(1);
      expect(result).toBe(true);
    });

    it("returns false when agent is not registered", async () => {
      const impl = getContractImpl();
      if (impl?.isVantageAgent) impl.isVantageAgent.mockResolvedValueOnce(false);
      const result = await filecoinService.isVantageAgent(999);
      expect(result).toBe(false);
    });
  });

  describe("giveFeedback", () => {
    it("returns a transaction hash", async () => {
      const hash = await filecoinService.giveFeedback(1, 5, "quality", "helpful");
      expect(typeof hash).toBe("string");
    });
  });

  describe("logAction", () => {
    it("does not throw", async () => {
      await expect(filecoinService.logAction({ action: "test" })).resolves.not.toThrow();
    });
  });
});
