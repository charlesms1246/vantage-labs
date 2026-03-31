const mockUploadText = jest.fn().mockResolvedValue({ data: { Hash: "QmCreativeCID" } });

jest.mock("@lighthouse-web3/sdk", () => ({
  default: {
    uploadText: mockUploadText,
  },
}));

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  return {
    ...actual,
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBlockNumber: jest.fn().mockResolvedValue(12345),
    })),
    Contract: jest.fn().mockImplementation(() => ({
      ownerOf: jest.fn().mockResolvedValue("0x1234"),
      tokenURI: jest.fn().mockResolvedValue("ipfs://Qm"),
      getAgentByName: jest.fn().mockResolvedValue(1n),
      isVantageAgent: jest.fn().mockResolvedValue(true),
    })),
    Wallet: jest.fn().mockImplementation(() => ({ address: "0xtest" })),
  };
});

import {
  CreateNFTMetadataTool,
  UploadToFilecoinTool,
  CreateTweetTool,
} from "../../../src/tools/creative";

describe("Creative Tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadText.mockResolvedValue({ data: { Hash: "QmCreativeCID" } });
  });

  describe("CreateNFTMetadataTool", () => {
    let tool: CreateNFTMetadataTool;

    beforeEach(() => {
      tool = new CreateNFTMetadataTool();
    });

    it("has correct name", () => {
      expect(tool.name).toBe("create_nft_metadata");
    });

    it("returns JSON with cid and metadata", async () => {
      const input = JSON.stringify({
        name: "Vantage NFT #1",
        description: "A DeFi artwork",
        imageCID: "QmImageCID",
      });
      const result = await tool._call(input);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("cid", "QmCreativeCID");
      expect(parsed).toHaveProperty("metadata");
      expect(parsed.metadata).toHaveProperty("name", "Vantage NFT #1");
      expect(parsed.metadata).toHaveProperty("image", "ipfs://QmImageCID");
    });

    it("uploads metadata to lighthouse", async () => {
      const input = JSON.stringify({ name: "Test", description: "Desc", imageCID: "QmImg" });
      await tool._call(input);
      expect(mockUploadText).toHaveBeenCalled();
    });

    it("includes url in response", async () => {
      const input = JSON.stringify({ name: "Test", description: "Desc", imageCID: "QmImg" });
      const result = await tool._call(input);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("url");
      expect(parsed.url).toContain("QmCreativeCID");
    });
  });

  describe("UploadToFilecoinTool", () => {
    let tool: UploadToFilecoinTool;

    beforeEach(() => {
      tool = new UploadToFilecoinTool();
    });

    it("has correct name", () => {
      expect(tool.name).toBe("upload_to_filecoin");
    });

    it("returns JSON with cid", async () => {
      const result = await tool._call("some content to upload");
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("cid", "QmCreativeCID");
      expect(parsed).toHaveProperty("url");
    });

    it("calls lighthouse upload", async () => {
      await tool._call("content");
      expect(mockUploadText).toHaveBeenCalled();
    });
  });

  describe("CreateTweetTool", () => {
    let tool: CreateTweetTool;

    beforeEach(() => {
      tool = new CreateTweetTool();
    });

    it("has correct name", () => {
      expect(tool.name).toBe("create_tweet");
    });

    it("returns JSON with tweet and charCount", async () => {
      const result = await tool._call(JSON.stringify({ context: "New NFT launch" }));
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("tweet");
      expect(parsed).toHaveProperty("charCount");
    });

    it("tweet contains Web3 hashtags", async () => {
      const result = await tool._call(JSON.stringify({ context: "launch" }));
      const parsed = JSON.parse(result);
      expect(parsed.tweet).toContain("#Web3");
    });

    it("handles plain string input", async () => {
      const result = await tool._call("some context");
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("tweet");
    });
  });
});
