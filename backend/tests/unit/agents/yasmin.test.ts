jest.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "Yasmin's creative result" }),
  })),
}));

jest.mock("@langchain/groq", () => ({
  ChatGroq: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "Groq result" }),
  })),
}));

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "OpenAI result" }),
  })),
}));

jest.mock("@lighthouse-web3/sdk", () => ({
  default: {
    uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmYasminCID" } }),
  },
}));

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  const MockContract = jest.fn().mockImplementation(() => ({
    ownerOf: jest.fn().mockResolvedValue("0x1234567890123456789012345678901234567890"),
    tokenURI: jest.fn().mockResolvedValue("ipfs://QmTestAgent"),
    getAgentByName: jest.fn().mockResolvedValue(1n),
    isVantageAgent: jest.fn().mockResolvedValue(true),
  }));
  const MockProvider = jest.fn().mockImplementation(() => ({
    getBlockNumber: jest.fn().mockResolvedValue(12345),
  }));
  const MockWallet = jest.fn().mockImplementation(() => ({ address: "0xtest" }));
  return {
    ...actual,
    JsonRpcProvider: MockProvider,
    Contract: MockContract,
    Wallet: MockWallet,
    ethers: { ...actual.ethers, JsonRpcProvider: MockProvider, Contract: MockContract, Wallet: MockWallet },
  };
});

import { Yasmin } from "../../../src/agents/yasmin";

describe("Yasmin Agent", () => {
  let yasmin: Yasmin;

  beforeEach(() => {
    yasmin = new Yasmin();
  });

  it("getName() returns 'Yasmin'", () => {
    expect(yasmin.getName()).toBe("Yasmin");
  });

  it("getRole() returns 'creative'", () => {
    expect(yasmin.getRole()).toBe("creative");
  });

  it("invoke() returns a string", async () => {
    const result = await yasmin.invoke("Help me plan a visual brand strategy");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("clearHistory() does not throw", () => {
    expect(() => yasmin.clearHistory()).not.toThrow();
  });
});
