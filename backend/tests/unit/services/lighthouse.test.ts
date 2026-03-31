jest.mock("@lighthouse-web3/sdk", () => ({
  default: {
    uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmMockCID123" } }),
  },
}));

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  const MockProvider = jest.fn().mockImplementation(() => ({ getBlockNumber: jest.fn().mockResolvedValue(12345) }));
  return { ...actual, JsonRpcProvider: MockProvider, Contract: jest.fn().mockImplementation(() => ({})), Wallet: jest.fn().mockImplementation(() => ({ address: "0xtest" })), ethers: { ...actual.ethers, JsonRpcProvider: MockProvider } };
});

import { lighthouseService } from "../../../src/services/lighthouse";

describe("LighthouseService", () => {
  beforeEach(() => {
    jest.requireMock("@lighthouse-web3/sdk").default.uploadText.mockClear();
    jest.requireMock("@lighthouse-web3/sdk").default.uploadText.mockResolvedValue({ data: { Hash: "QmMockCID123" } });
  });

  describe("upload", () => {
    it("calls lighthouse.uploadText and returns the Hash", async () => {
      const cid = await lighthouseService.upload("test data");
      expect(jest.requireMock("@lighthouse-web3/sdk").default.uploadText).toHaveBeenCalledWith("test data", "test-lighthouse-key");
      expect(cid).toBe("QmMockCID123");
    });

    it("uploads JSON strings", async () => {
      const cid = await lighthouseService.upload(JSON.stringify({ key: "value" }));
      expect(cid).toBe("QmMockCID123");
    });
  });

  describe("getGatewayUrl", () => {
    it("returns URL containing the cid", () => {
      const url = lighthouseService.getGatewayUrl("QmTestCID");
      expect(url).toContain("QmTestCID");
      expect(url).toContain("https://");
    });

    it("returns the expected gateway URL", () => {
      const cid = "QmABC123";
      expect(lighthouseService.getGatewayUrl(cid)).toBe(`https://gateway.lighthouse.storage/ipfs/${cid}`);
    });
  });

  describe("getFile", () => {
    it("calls fetch with correct URL and returns JSON", async () => {
      const mockData = { token: "FLOW" };
      global.fetch = jest.fn().mockResolvedValue({ json: jest.fn().mockResolvedValue(mockData) } as any);
      const result = await lighthouseService.getFile("QmTestCID");
      expect(global.fetch).toHaveBeenCalledWith("https://gateway.lighthouse.storage/ipfs/QmTestCID");
      expect(result).toEqual(mockData);
    });
  });
});
