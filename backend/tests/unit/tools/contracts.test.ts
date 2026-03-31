jest.mock("@lighthouse-web3/sdk", () => ({
  __esModule: true,
  default: {
    uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmContractCID" } }),
  },
}));

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  const MockProvider = jest.fn().mockImplementation(() => ({ getBlockNumber: jest.fn().mockResolvedValue(12345) }));
  const MockContract = jest.fn().mockImplementation(() => ({
    ownerOf: jest.fn().mockResolvedValue("0x1234"),
    tokenURI: jest.fn().mockResolvedValue("ipfs://Qm"),
    getAgentByName: jest.fn().mockResolvedValue(1n),
    isVantageAgent: jest.fn().mockResolvedValue(true),
  }));
  const MockWallet = jest.fn().mockImplementation(() => ({ address: "0xtest" }));
  return { ...actual, JsonRpcProvider: MockProvider, Contract: MockContract, Wallet: MockWallet, ethers: { ...actual.ethers, JsonRpcProvider: MockProvider, Contract: MockContract, Wallet: MockWallet } };
});

import { GenerateContractTool, StoreProofTool } from "../../../src/tools/contracts";

describe("Contract Tools", () => {
  beforeEach(() => {
    jest.requireMock("@lighthouse-web3/sdk").default.uploadText.mockClear();
    jest.requireMock("@lighthouse-web3/sdk").default.uploadText.mockResolvedValue({ data: { Hash: "QmContractCID" } });
  });

  describe("GenerateContractTool", () => {
    let tool: GenerateContractTool;

    beforeEach(() => {
      tool = new GenerateContractTool();
    });

    it("has correct name", () => {
      expect(tool.name).toBe("generate_contract");
    });

    it("returns JSON with spec and template", async () => {
      const input = JSON.stringify({ spec: "ERC-20 token for DeFi" });
      const result = await tool._call(input);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("spec");
      expect(parsed).toHaveProperty("template");
      expect(parsed).toHaveProperty("solidity");
    });

    it("handles plain string input", async () => {
      const result = await tool._call("simple token contract");
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("spec");
    });

    it("uses input as spec when JSON has no spec field", async () => {
      const input = JSON.stringify({ other: "value" });
      const result = await tool._call(input);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("spec", input);
    });

    it("includes a note about code generation", async () => {
      const result = await tool._call(JSON.stringify({ spec: "test" }));
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("note");
    });
  });

  describe("StoreProofTool", () => {
    let tool: StoreProofTool;

    beforeEach(() => {
      tool = new StoreProofTool();
    });

    it("has correct name", () => {
      expect(tool.name).toBe("store_proof");
    });

    it("returns JSON with cid and stored=true", async () => {
      const input = JSON.stringify({ bytecode: "0x60806040", metadata: { abi: [] } });
      const result = await tool._call(input);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("cid", "QmContractCID");
      expect(parsed).toHaveProperty("stored", true);
    });

    it("returns url in response", async () => {
      const result = await tool._call("{}");
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("url");
      expect(parsed.url).toContain("QmContractCID");
    });

    it("calls lighthouse uploadText", async () => {
      await tool._call("proof data");
      expect(jest.requireMock("@lighthouse-web3/sdk").default.uploadText).toHaveBeenCalled();
    });
  });
});
