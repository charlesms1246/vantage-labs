let sharedContractImpl: any;
let sharedProviderImpl: any;

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  sharedContractImpl = {
    mint: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xmintHash" }) }),
    tip: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xtipHash" }) }),
  };
  sharedProviderImpl = {
    getBalance: jest.fn().mockResolvedValue(BigInt("10000000000000000000")),
    getBlockNumber: jest.fn().mockResolvedValue(12345),
  };
  const MockContract = jest.fn().mockImplementation(() => sharedContractImpl);
  const MockProvider = jest.fn().mockImplementation(() => sharedProviderImpl);
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
  __esModule: true,
  default: { uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmMock" } }) },
}));

import { flowService } from "../../../src/services/flow";

describe("FlowService", () => {
  beforeEach(() => {
    if (sharedContractImpl) {
      sharedContractImpl.mint.mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xmintHash" }) });
      sharedContractImpl.tip.mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xtipHash" }) });
    }
    if (sharedProviderImpl) {
      sharedProviderImpl.getBalance.mockResolvedValue(BigInt("10000000000000000000"));
    }
  });

  describe("prepareTxData", () => {
    it("returns object with action, params, network, chainId", () => {
      const result = flowService.prepareTxData("swap", { from: "ETH", to: "FLOW" });
      expect(result).toEqual({ action: "swap", params: { from: "ETH", to: "FLOW" }, network: "flow-evm-testnet", chainId: 545 });
    });

    it("handles empty params", () => {
      const result = flowService.prepareTxData("mint", {});
      expect(result.action).toBe("mint");
      expect(result.network).toBe("flow-evm-testnet");
      expect(result.chainId).toBe(545);
    });
  });

  describe("mintToken", () => {
    it("returns a transaction hash", async () => {
      const hash = await flowService.mintToken("0xrecipient", BigInt("1000"));
      expect(hash).toBe("0xmintHash");
    });

    it("calls mint with correct params", async () => {
      await flowService.mintToken("0xrecipient", BigInt("500"));
      expect(sharedContractImpl.mint).toHaveBeenCalledWith("0xrecipient", BigInt("500"));
    });
  });

  describe("mintNFT", () => {
    it("returns tokenId and txHash", async () => {
      const result = await flowService.mintNFT("0xrecipient", "ipfs://QmNFT");
      expect(result).toHaveProperty("tokenId");
      expect(result).toHaveProperty("txHash");
      expect(result.txHash).toBe("0xmintHash");
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
      expect(balance).toBe(BigInt("10000000000000000000"));
    });
  });
});
