import { createGroqModel, createGeminiModel, createGeminiImageGenModel, createOpenRouterModel } from "../config/models";

export type ModelType =
  | "groq"              // Orchestrator default
  | "groq-qwen3-32b"   // Yasmin thinking
  | "gemini"            // Gemini general
  | "gemini-image"      // Yasmin image description (text only)
  | "gemini-image-gen"  // Yasmin actual image generation
  | "openrouter-minimax"   // Eric  → minimax/minimax-m2.5:free
  | "openrouter-stepfun"   // Harper → stepfun/step-3.5-flash:free
  | "openrouter-nemotron"  // Rishi primary → nvidia/nemotron-3-super-120b-a12b:free
  | "openrouter-qwen"      // Rishi secondary → qwen/qwen3.6-plus-preview:free

export function getLLM(model: ModelType) {
  switch (model) {
    case "groq":
      return createGroqModel();
    case "groq-qwen3-32b":
      return createGroqModel("qwen/qwen3-32b");
    case "gemini":
      return createGeminiModel();
    case "gemini-image":
      return createGeminiModel("gemini-2.5-flash");
    case "openrouter-minimax":
      return createOpenRouterModel("minimax/minimax-m2.5:free");
    case "openrouter-stepfun":
      return createOpenRouterModel("stepfun/step-3.5-flash:free");
    case "openrouter-nemotron":
      return createOpenRouterModel("nvidia/nemotron-3-super-120b-a12b:free");
    case "openrouter-qwen":
      return createOpenRouterModel("qwen/qwen3.6-plus-preview:free");
  }
}
