jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  const contractImpl = {
    mint: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xmintHash" }) }),
    tip: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xtipHash" }) }),
  };
  const mockBalance = BigInt("10000000000000000000");
  const MockProvider = jest.fn().mockImplementation(() => ({
    getBalance: jest.fn().mockResolvedValue(mockBalance),
    getBlockNumber: jest.fn().mockResolvedValue(12345),
  }));
  const MockContract = jest.fn().mockImplementation(() => contractImpl);
  const MockWallet = jest.fn().mockImplementation((pk: string, provider: any) => ({ address: "0xce4389ACb79463062c362fACB8CB04513fA3D8D8", provider }));
  return {
    ...actual,
    Contract: MockContract,
    JsonRpcProvider: MockProvider,
    Wallet: MockWallet,
    ethers: { ...actual.ethers, Contract: MockContract, JsonRpcProvider: MockProvider, Wallet: MockWallet },
  };
});

jest.mock("@lighthouse-web3/sdk", () => ({
  default: { uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmMock" } }) },
}));

import { ethers } from "ethers";
import { flowService } from "../../../src/services/flow";

describe("FlowService", () => {
  describe("prepareTxData", () => {
    it("returns object with action, params, network, chainId", () => {
      const result = flowService.prepareTxData("swap", { from: "ETH", to: "FLOW" });
      expect(result).toEqual({ action: "swap", params: { from: "ETH", to: "FLOW" }, network: "flow-evm-testnet", chainId: 545 });
    });
  });

  describe("mintToken", () => {
    it("returns a transaction hash", async () => {
      const hash = await flowService.mintToken("0xrecipient", BigInt("1000"));
      expect(hash).toBe("0xmintHash");
    });
  });

  describe("mintNFT", () => {
    it("returns tokenId and txHash", async () => {
      const result = await flowService.mintNFT("0xrecipient", "ipfs://QmNFT");
      expect(result).toHaveProperty("tokenId");
      expect(result).toHaveProperty("txHash", "0xmintHash");
    });
  });

  describe("sendTip", () => {
    it("returns a transaction hash", async () => {
      const hash = await flowService.sendTip("0xcreator", BigInt("100"));
      expect(hash).toBe("0xtipHash");
    });
  });

  describe("getBalance", () => {
    it("returns a bigint", async () => {
      const balance = await flowService.getBalance("0xaddress");
      expect(typeof balance).toBe("bigint");
    });
  });
});
