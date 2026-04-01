export const mockLighthouse = {
  uploadText: jest.fn().mockResolvedValue({
    data: { Hash: "QmMockCID123" },
  }),
  upload: jest.fn().mockResolvedValue({
    data: { Hash: "QmMockCID456" },
  }),
  getAccessConditions: jest.fn().mockResolvedValue([]),
};

jest.mock("@lighthouse-web3/sdk", () => ({
  default: mockLighthouse,
  __esModule: true,
}));
