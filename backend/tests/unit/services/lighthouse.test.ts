const mockUploadText = jest.fn().mockResolvedValue({ data: { Hash: "QmMockCID123" } });

jest.mock("@lighthouse-web3/sdk", () => ({
  default: {
    uploadText: mockUploadText,
  },
}));

// Mock ethers for any transitive imports
jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  return {
    ...actual,
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBlockNumber: jest.fn().mockResolvedValue(12345),
    })),
    Contract: jest.fn().mockImplementation(() => ({})),
    Wallet: jest.fn().mockImplementation(() => ({ address: "0xtest" })),
  };
});

import { lighthouseService } from "../../../src/services/lighthouse";

describe("LighthouseService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadText.mockResolvedValue({ data: { Hash: "QmMockCID123" } });
  });

  describe("upload", () => {
    it("calls lighthouse.uploadText and returns the Hash", async () => {
      const cid = await lighthouseService.upload("test data");
      expect(mockUploadText).toHaveBeenCalledWith("test data", "test-lighthouse-key");
      expect(cid).toBe("QmMockCID123");
    });

    it("uploads JSON strings", async () => {
      const data = JSON.stringify({ key: "value" });
      const cid = await lighthouseService.upload(data);
      expect(cid).toBe("QmMockCID123");
    });
  });

  describe("getGatewayUrl", () => {
    it("returns URL containing the cid", () => {
      const cid = "QmTestCID";
      const url = lighthouseService.getGatewayUrl(cid);
      expect(url).toContain(cid);
      expect(url).toContain("https://");
    });

    it("returns a valid IPFS gateway URL", () => {
      const cid = "QmABC123";
      const url = lighthouseService.getGatewayUrl(cid);
      expect(url).toBe(`https://gateway.lighthouse.storage/ipfs/${cid}`);
    });
  });

  describe("getFile", () => {
    it("calls fetch with correct URL", async () => {
      const mockResponse = { token: "FLOW", recommendation: "HOLD" };
      global.fetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const cid = "QmTestCID";
      const result = await lighthouseService.getFile(cid);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://gateway.lighthouse.storage/ipfs/${cid}`
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
