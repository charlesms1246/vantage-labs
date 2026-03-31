import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { config } from "./env";

export function createGroqModel(modelName = "llama-3.1-70b-versatile") {
  return new ChatGroq({
    apiKey: config.GROQ_API_KEY,
    model: modelName,
    temperature: 0.1,
  });
}

export function createGeminiModel(modelName = "gemini-1.5-pro") {
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
    model: "anthropic/claude-3.5-sonnet",
    temperature: 0.1,
  });
}
