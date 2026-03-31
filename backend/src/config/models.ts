import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { config } from "./env";

export function createGroqModel(modelName = "qwen/qwen3-32b") {
  return new ChatGroq({
    apiKey: config.GROQ_API_KEY,
    model: modelName,
    temperature: 0.1,
  });
}

export function createGeminiModel(modelName = "gemini-2.5-flash-lite") {
  return new ChatGoogleGenerativeAI({
    apiKey: config.GEMINI_API_KEY,
    model: modelName,
    temperature: 0.1,
  });
}

export function createClaudeModel() {
  return new ChatOpenAI({
    apiKey: config.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    temperature: 0.1,
  });
}
