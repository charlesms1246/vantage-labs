export const mockLLMResponse = (response: string) => ({
  invoke: jest.fn().mockResolvedValue({ content: response }),
  generate: jest.fn().mockResolvedValue({ text: response }),
});

export const createMockGroq = () => mockLLMResponse("Mock Groq response");
export const createMockGemini = () => mockLLMResponse("Mock Gemini response");
export const createMockOpenRouter = () => mockLLMResponse("Mock OpenRouter response");

// Mock LangChain modules
jest.mock("@langchain/groq", () => ({
  ChatGroq: jest.fn().mockImplementation(() => createMockGroq()),
}));

jest.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: jest
    .fn()
    .mockImplementation(() => createMockGemini()),
}));

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest
    .fn()
    .mockImplementation(() => createMockOpenRouter()),
}));
