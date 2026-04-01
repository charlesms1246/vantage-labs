import { lighthouseService } from "../../../src/services/lighthouse";
import lighthouse from "@lighthouse-web3/sdk";

jest.mock("@lighthouse-web3/sdk");

describe("LighthouseService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("upload", () => {
    it("should upload text and return CID", async () => {
      (lighthouse.uploadText as jest.Mock).mockResolvedValue({
        data: { Hash: "QmTestCID123" },
      });

      const cid = await lighthouseService.upload("test data");

      expect(cid).toBe("QmTestCID123");
      expect(lighthouse.uploadText).toHaveBeenCalledWith(
        "test data",
        expect.any(String)
      );
    });

    it("should skip upload if no API key", async () => {
      const originalKey = process.env.LIGHTHOUSE_API_KEY;
      delete process.env.LIGHTHOUSE_API_KEY;

      const cid = await lighthouseService.upload("test data");

      expect(cid).toBe("QmSimulatedCID");
      process.env.LIGHTHOUSE_API_KEY = originalKey;
    });

    it("should handle upload errors gracefully", async () => {
      (lighthouse.uploadText as jest.Mock).mockRejectedValue(
        new Error("Upload failed")
      );

      await expect(lighthouseService.upload("test")).rejects.toThrow(
        "Upload failed"
      );
    });
  });

  describe("getGatewayUrl", () => {
    it("should return correct gateway URL", () => {
      const cid = "QmTestCID123";
      const url = lighthouseService.getGatewayUrl(cid);

      expect(url).toContain("gateway.lighthouse.storage");
      expect(url).toContain(cid);
    });
  });
});
