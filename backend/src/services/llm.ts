import { createGroqModel, createGeminiModel, createOpenRouterModel } from "../config/models";

export type ModelType =
  | "groq"              // Orchestrator default → llama-3.3-70b-versatile
  | "groq-qwen3-32b"   // Yasmin thinking
  | "groq-eric"        // Eric → llama-3.1-8b-instant (fast, market analysis)
  | "groq-harper"      // Harper → llama3-groq-70b-8192-tool-use-preview (tool-use optimised)
  | "groq-rishi"       // Rishi → llama-3.3-70b-versatile (code generation)
  | "gemini"            // Gemini general
  | "gemini-image"      // Yasmin image description (text only)
  | "openrouter-minimax"   // Eric  → minimax/minimax-m2.5:free (fallback)
  | "openrouter-stepfun"   // Harper → stepfun/step-3.5-flash:free (fallback)
  | "openrouter-nemotron"  // Rishi primary → nvidia/nemotron-3-super-120b-a12b:free (fallback)
  | "openrouter-qwen"      // Rishi secondary → qwen/qwen3.6-plus-preview:free

export function getLLM(model: ModelType): ReturnType<typeof createGroqModel> | ReturnType<typeof createGeminiModel> | ReturnType<typeof createOpenRouterModel> {
  switch (model) {
    case "groq":
      return createGroqModel();
    case "groq-qwen3-32b":
      return createGroqModel("qwen/qwen3-32b");
    case "groq-eric":
      return createGroqModel("llama-3.1-8b-instant");
    case "groq-harper":
      return createGroqModel("llama3-groq-70b-8192-tool-use-preview");
    case "groq-rishi":
      return createGroqModel("llama-3.3-70b-versatile");
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
      return createOpenRouterModel("qwen/qwen3.6-plus:free");
    default: {
      // This should never happen if ModelType is exhaustive — but guards against
      // runtime mismatches (e.g. env config passing an unrecognised model string).
      const exhaustiveCheck: never = model;
      throw new Error(`[getLLM] Unknown model type: "${exhaustiveCheck}". Check ModelType union and agent config.`);
    }
  }
}
