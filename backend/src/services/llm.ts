import { createGroqModel, createGeminiModel, createClaudeModel } from "../config/models";

export type ModelType = "groq" | "gemini" | "claude";

export function getLLM(model: ModelType) {
  switch (model) {
    case "groq": return createGroqModel();
    case "gemini": return createGeminiModel();
    case "claude": return createClaudeModel();
  }
}
