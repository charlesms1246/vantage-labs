jest.mock("@langchain/groq", () => ({
  ChatGroq: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "Harper's trading result" }),
  })),
}));

jest.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "Gemini result" }),
  })),
}));

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "OpenAI result" }),
  })),
}));

jest.mock("@lighthouse-web3/sdk", () => ({
  __esModule: true,
  default: {
    uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmMockCID123" } }),
  },
}));

jest.mock("ethers", () => {
  const actual = jest.requireActual("ethers");
  return {
    ...actual,
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBlockNumber: jest.fn().mockResolvedValue(12345),
      getBalance: jest.fn().mockResolvedValue(BigInt("10000000000000000000")),
    })),
    Contract: jest.fn().mockImplementation(() => ({
      ownerOf: jest.fn().mockResolvedValue("0x1234567890123456789012345678901234567890"),
      tokenURI: jest.fn().mockResolvedValue("ipfs://QmTestAgent"),
      getAgentByName: jest.fn().mockResolvedValue(1n),
      isVantageAgent: jest.fn().mockResolvedValue(true),
      mint: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xabc" }) }),
      tip: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({ hash: "0xdef" }) }),
    })),
    Wallet: jest.fn().mockImplementation(() => ({ address: "0xtest" })),
  };
});

import { Harper } from "../../../src/agents/harper";

describe("Harper Agent", () => {
  let harper: Harper;

  beforeEach(() => {
    harper = new Harper();
  });

  it("getName() returns 'Harper'", () => {
    expect(harper.getName()).toBe("Harper");
  });

  it("getRole() returns 'trader'", () => {
    expect(harper.getRole()).toBe("trader");
  });

  it("invoke() returns a string", async () => {
    const result = await harper.invoke("Prepare a trade for FLOW tokens");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("clearHistory() does not throw", () => {
    expect(() => harper.clearHistory()).not.toThrow();
  });

  it("invoke() with prepare_transaction tool name uses tool", async () => {
    const result = await harper.invoke(
      JSON.stringify({ action: "swap", params: {} })
    );
    expect(typeof result).toBe("string");
  });
});
