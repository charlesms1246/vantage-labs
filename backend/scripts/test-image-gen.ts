/**
 * Test script for Gemini image generation.
 *
 * Run from the backend directory:
 *   npx tsx scripts/test-image-gen.ts
 *
 * Requires GEMINI_API_KEY in backend/.env (or as an env var).
 * Saves generated images to backend/scripts/output/.
 */

import { GoogleGenAI, ApiError, type GenerateContentResponse } from "@google/genai";
import { extension as mimeExtension } from "mime-types";
import { writeFile, mkdirSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";

dotenv.config();

const MODEL = "gemini-3.1-flash-image-preview";
const OUTPUT_DIR = join(__dirname, "output");
const TEST_PROMPT = "A futuristic Web3 office with holographic screens";

function saveImage(fileName: string, base64Data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const buffer = Buffer.from(base64Data, "base64");
    writeFile(fileName, buffer, (err) => {
      if (err) {
        console.error(`  ✗ Failed to save ${fileName}:`, err.message);
        reject(err);
      } else {
        console.log(`  ✓ Saved: ${fileName}`);
        resolve();
      }
    });
  });
}

async function testImageGeneration(prompt: string): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("✗ GEMINI_API_KEY is not set in environment / .env");
    process.exit(1);
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log("Vantage Labs — Gemini Image Generation Test");
  console.log(`${"─".repeat(60)}`);
  console.log(`Model  : ${MODEL}`);
  console.log(`Prompt : ${prompt.slice(0, 100)}${prompt.length > 100 ? "…" : ""}`);
  console.log(`Output : ${OUTPUT_DIR}`);
  console.log(`${"─".repeat(60)}\n`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const ai = new GoogleGenAI({ apiKey });

  const MAX_ATTEMPTS = 3;
  let response: AsyncGenerator<GenerateContentResponse> | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${MAX_ATTEMPTS}: calling ${MODEL}…`);
      response = await ai.models.generateContentStream({
        model: MODEL,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { aspectRatio: "1:1" },
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      break;
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        if (attempt === MAX_ATTEMPTS) {
          console.error(`✗ Rate-limited after ${MAX_ATTEMPTS} attempts.`);
          throw err;
        }
        const delayMatch = err.message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
        const waitMs = delayMatch
          ? Math.min(Math.ceil(parseFloat(delayMatch[1])) * 1000, 120_000)
          : 35_000 * attempt;
        console.warn(`  Rate limited (429) — retrying in ${waitMs / 1000}s…`);
        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        throw err;
      }
    }
  }

  if (!response) throw new Error("No response received after retries.");

  let imageCount = 0;
  let description = "";

  console.log("Streaming response…");
  for await (const chunk of response) {
    const parts = chunk.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType ?? "image/png";
        const ext = mimeExtension(mimeType) || "png";
        const timestamp = Date.now();
        const outPath = join(OUTPUT_DIR, `generated_${timestamp}_${imageCount}.${ext}`);

        console.log(`  Image chunk received — mimeType: ${mimeType}`);
        await saveImage(outPath, part.inlineData.data);
        imageCount++;
      }
      if (part.text) {
        description += part.text;
      }
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  if (imageCount === 0) {
    console.warn("⚠  No image data was returned by the model.");
    console.warn("   The model may have refused the prompt or returned text only.");
  } else {
    console.log(`✓ ${imageCount} image(s) saved to ${OUTPUT_DIR}`);
  }

  if (description) {
    console.log(`\nModel description:\n${description}`);
  }
  console.log(`${"─".repeat(60)}\n`);
}

testImageGeneration(TEST_PROMPT).catch((err) => {
  console.error("\n✗ Test failed:", err instanceof Error ? err.message : String(err));
  if (err instanceof ApiError) {
    console.error("  Status:", err.status);
    try {
      const body = JSON.parse(err.message);
      const violations = body?.error?.details?.find((d: Record<string, unknown>) => d["@type"]?.toString().includes("QuotaFailure"))?.violations;
      if (violations) {
        console.error("  Quota violations:");
        for (const v of violations) console.error(`    - ${v.quotaId} (model: ${v.quotaDimensions?.model})`);
      }
    } catch { /* error body not parseable */ }
  }
  process.exit(1);
});
