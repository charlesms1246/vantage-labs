import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { config } from "./env";

export function createGroqModel(modelName = "llama-3.3-70b-versatile") {
  return new ChatGroq({
    apiKey: config.GROQ_API_KEY,
    model: modelName,
    temperature: 0.1,
  });
}

export function createGeminiModel(modelName = "gemini-2.5-flash") {
  return new ChatGoogleGenerativeAI({
    apiKey: config.GEMINI_API_KEY,
    model: modelName,
    temperature: 0.1,
  });
}

// Generic OpenRouter factory — pass any OpenRouter model slug
export function createOpenRouterModel(modelName: string) {
  return new ChatOpenAI({
    apiKey: config.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    model: modelName,
    temperature: 0.1,
  });
}
