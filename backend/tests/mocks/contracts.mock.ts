export const createMockContract = () => ({
  ownerOf: jest.fn().mockResolvedValue("0x1234567890123456789012345678901234567890"),
  tokenURI: jest.fn().mockResolvedValue("ipfs://QmTest"),
  giveFeedback: jest.fn().mockResolvedValue({
    wait: jest.fn().mockResolvedValue({ hash: "0xabc..." }),
  }),
  register: jest.fn().mockResolvedValue({
    wait: jest.fn().mockResolvedValue({ hash: "0xdef..." }),
  }),
  getAddress: jest
    .fn()
    .mockResolvedValue("0x1234567890123456789012345678901234567890"),
  mint: jest.fn().mockResolvedValue({
    wait: jest.fn().mockResolvedValue({ hash: "0xmint123" }),
  }),
  transfer: jest.fn().mockResolvedValue({
    wait: jest.fn().mockResolvedValue({ hash: "0xtx456" }),
  }),
});

export const createMockProvider = () => ({
  getBalance: jest.fn().mockResolvedValue("10000000000000000000"), // 10 ETH in wei
  getNetwork: jest.fn().mockResolvedValue({ chainId: 314159 }),
  getBlockNumber: jest.fn().mockResolvedValue(1000),
  call: jest.fn().mockResolvedValue("0x"),
});

export const createMockWallet = () => ({
  address: "0x1234567890123456789012345678901234567890",
  signMessage: jest.fn().mockResolvedValue("0xsignature..."),
  connect: jest.fn().mockReturnValue(createMockProvider()),
});

jest.mock("ethers", () => ({
  Contract: jest.fn().mockImplementation(() => createMockContract()),
  JsonRpcProvider: jest.fn().mockImplementation(() => createMockProvider()),
  Wallet: jest.fn().mockImplementation(() => createMockWallet()),
  ethers: {
    Contract: jest.fn().mockImplementation(() => createMockContract()),
    parseEther: (n: string) => n,
  },
}));
