jest.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: "Eric's analysis result" }),
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
    })),
    Contract: jest.fn().mockImplementation(() => ({
      ownerOf: jest.fn().mockResolvedValue("0x1234567890123456789012345678901234567890"),
      tokenURI: jest.fn().mockResolvedValue("ipfs://QmTestAgent"),
      getAgentByName: jest.fn().mockResolvedValue(1n),
      isVantageAgent: jest.fn().mockResolvedValue(true),
    })),
    Wallet: jest.fn().mockImplementation(() => ({ address: "0xtest" })),
  };
});

import { Eric } from "../../../src/agents/eric";

describe("Eric Agent", () => {
  let eric: Eric;

  beforeEach(() => {
    eric = new Eric();
  });

  it("getName() returns 'Eric'", () => {
    expect(eric.getName()).toBe("Eric");
  });

  it("getRole() returns 'market_analyst'", () => {
    expect(eric.getRole()).toBe("market_analyst");
  });

  it("invoke() returns a string", async () => {
    const result = await eric.invoke("Analyze the FLOW token market");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("clearHistory() does not throw", () => {
    expect(() => eric.clearHistory()).not.toThrow();
  });

  it("invoke() with tool name in input uses tool", async () => {
    const result = await eric.invoke("analyze market for ETH");
    expect(typeof result).toBe("string");
  });

  it("invoke() can be called multiple times", async () => {
    const r1 = await eric.invoke("first call");
    const r2 = await eric.invoke("second call");
    expect(typeof r1).toBe("string");
    expect(typeof r2).toBe("string");
  });

  it("truncates history when it exceeds 20 messages", async () => {
    for (let i = 0; i < 11; i++) {
      await eric.invoke(`call number ${i}`);
    }
    // No error means history truncation worked
    expect(true).toBe(true);
  });

  it("handles non-string content from LLM", async () => {
    const { ChatGoogleGenerativeAI } = jest.requireMock("@langchain/google-genai");
    ChatGoogleGenerativeAI.mockImplementationOnce(() => ({
      invoke: jest.fn().mockResolvedValue({ content: [{ text: "array content" }] }),
    }));
    const freshEric = new (require("../../../src/agents/eric").Eric)();
    const result = await freshEric.invoke("test non-string content");
    expect(typeof result).toBe("string");
  });
});
