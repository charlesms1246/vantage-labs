import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { GoogleGenAI, ApiError, type GenerateContentResponse } from "@google/genai";
import { lighthouseService } from "../services/lighthouse";
import { uploadToImgbb } from "../services/imgbb";
import { logger } from "../services/logger";
import { config } from "../config/env";

const IMAGE_GEN_MODEL = "gemini-2.5-flash-image";

interface UploadedImage {
  imageCID: string;
  displayUrl: string;   // imgbb (fast) or Lighthouse gateway
  lighthouseUrl: string;
  stableUrl: string;    // direct picsum /id/{n}/... URL used as source
}

/**
 * Fetch a random picsum image, upload the binary to Lighthouse/Filecoin,
 * and optionally to imgbb for fast frontend display.
 *
 * Mirrors picsum_ref.html: fetch /1000/1000 to follow the redirect and
 * obtain a stable /id/{n}/1000/1000 URL + the actual image bytes in one
 * request, then upload the raw binary (not JSON) to Filecoin.
 */
async function fetchPicsumAndUpload(): Promise<UploadedImage> {
  const response = await fetch("https://picsum.photos/1000/1000");
  if (!response.ok) throw new Error(`Picsum fetch failed: HTTP ${response.status}`);

  // After following the redirect, response.url is the stable /id/{n}/... URL
  const stableUrl = response.url;
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const mimeType = contentType.split(";")[0].trim();
  const ext = mimeType.split("/")[1] ?? "jpg";

  const base64 = Buffer.from(await response.arrayBuffer()).toString("base64");

  // Upload to imgbb for fast frontend display (optional)
  let imgbbUrl: string | undefined;
  if (config.IMGBB_API_KEY) {
    try {
      imgbbUrl = await uploadToImgbb(base64);
    } catch (err) {
      logger.warn("IMGBB", "fetchPicsumAndUpload: imgbb upload failed", { error: String(err) });
    }
  }

  // Upload binary image to Lighthouse/Filecoin for permanent decentralised storage
  const imageCID = await lighthouseService.uploadBuffer(
    base64,
    `vantage-picsum-${Date.now()}.${ext}`,
    mimeType
  );

  const lighthouseUrl = lighthouseService.getGatewayUrl(imageCID);
  const displayUrl = imgbbUrl ?? lighthouseUrl;

  logger.info("PICSUM", "Picsum image uploaded to Lighthouse", { imageCID, stableUrl, displayUrl });
  return { imageCID, displayUrl, lighthouseUrl, stableUrl };
}

export class GenerateImageTool extends StructuredTool {
  name = "generate_image";
  description =
    "Generate an image using Gemini. Provide a detailed visual prompt describing what the image should look like.";
  schema = z.object({
    prompt: z.string().describe("Detailed description of the image to generate"),
  });

  async _call({ prompt }: { prompt: string }): Promise<string> {
    try {
      logger.info("LLM", "[Yasmin] generate_image: invoking Gemini image generation", { model: IMAGE_GEN_MODEL, promptPreview: prompt.slice(0, 150) });

      const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

      const genParams = {
        model: IMAGE_GEN_MODEL,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { aspectRatio: "1:1" },
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      };

      let response: AsyncGenerator<GenerateContentResponse> | undefined;
      const MAX_ATTEMPTS = 3;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          response = await ai.models.generateContentStream(genParams);
          break;
        } catch (err) {
          if (err instanceof ApiError && err.status === 429) {
            if (attempt === MAX_ATTEMPTS) break;
            // Extract retryDelay from the API error message JSON, e.g. "retryDelay":"43s"
            const delayMatch = err.message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
            const waitMs = delayMatch
              ? Math.min(Math.ceil(parseFloat(delayMatch[1])) * 1000, 120_000)
              : 35_000 * attempt;
            logger.warn("LLM", `[Yasmin] generate_image: rate limited (429), retry ${attempt}/${MAX_ATTEMPTS - 1} in ${waitMs / 1000}s`, { model: IMAGE_GEN_MODEL });
            await new Promise(resolve => setTimeout(resolve, waitMs));
          } else {
            throw err;
          }
        }
      }
      if (!response) {
        logger.warn("LLM", "[Yasmin] generate_image: using picsum fallback due to quota exhaustion");
        const image = await fetchPicsumAndUpload();
        const metadataCID = await lighthouseService.upload(
          JSON.stringify({ prompt, description: "Fallback image used due to Gemini quota exhaustion", imageCID: image.imageCID, generated_by: `Yasmin fallback (picsum)` }),
          "image-metadata.json"
        );
        return JSON.stringify({
          prompt,
          description: "Fallback image used due to Gemini quota exhaustion",
          imageCID: image.imageCID,
          metadataCID,
          url: image.displayUrl,
          lighthouseUrl: image.lighthouseUrl,
          note: "Fallback image from picsum.photos. Use imageCID with create_nft_metadata to complete NFT.",
        });
      }

      // Collect base64 image and text description from stream chunks
      let base64: string | undefined;
      let mimeType: string | undefined;
      let description = "";

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (part.inlineData?.data && !base64) {
            base64 = part.inlineData.data;
            mimeType = part.inlineData.mimeType;
          }
          if (part.text) {
            description += part.text;
          }
        }
      }

      logger.info("LLM", "[Yasmin] generate_image: Gemini responded", { hasImage: !!base64, mimeType, descriptionPreview: description.slice(0, 200) });

      // If no image was generated, use picsum fallback
      if (!base64) {
        logger.warn("LLM", "[Yasmin] generate_image: no image data received, using picsum fallback");
        const image = await fetchPicsumAndUpload();
        const metadataCID = await lighthouseService.upload(
          JSON.stringify({ prompt, description: description || "Fallback image used", imageCID: image.imageCID, generated_by: `Yasmin fallback (picsum)` }),
          "image-metadata.json"
        );
        return JSON.stringify({
          prompt,
          description: description || "Fallback image used",
          imageCID: image.imageCID,
          metadataCID,
          url: image.displayUrl,
          lighthouseUrl: image.lighthouseUrl,
          note: "Fallback image from picsum.photos. Use imageCID with create_nft_metadata to complete NFT.",
        });
      }

      // Upload image to imgbb for fast public hosting (5 min expiry — for frontend display)
      let imgbbUrl: string | undefined;
      if (config.IMGBB_API_KEY) {
        try {
          imgbbUrl = await uploadToImgbb(base64);
        } catch (err) {
          logger.warn("IMGBB", "[Yasmin] generate_image: imgbb upload failed", { error: String(err) });
        }
      } else {
        logger.warn("IMGBB", "[Yasmin] generate_image: IMGBB_API_KEY not set, skipping imgbb upload");
      }

      // Upload the actual image bytes to Lighthouse/IPFS for permanent decentralised storage.
      let imageCID: string | undefined;
      try {
        const ext = (mimeType ?? "image/png").split("/")[1] ?? "png";
        imageCID = await lighthouseService.uploadBuffer(
          base64,
          `vantage-image-${Date.now()}.${ext}`,
          mimeType ?? "image/png"
        );
        logger.info("IPFS", "[Yasmin] generate_image: image uploaded to Lighthouse", {
          cid: imageCID,
          mimeType,
          promptPreview: prompt.slice(0, 100),
        });
      } catch (err) {
        logger.warn("IPFS", "[Yasmin] generate_image: Lighthouse image upload failed", { error: String(err) });
      }

      // Always store a metadata JSON too (links prompt + description + both URLs)
      const metadataCID = await lighthouseService.upload(
        JSON.stringify({ prompt, description, imgbbUrl, imageCID, generated_by: `Yasmin via ${IMAGE_GEN_MODEL}` }),
        "image-metadata.json"
      );

      // Prefer imgbb for the display URL (loads fast); fall back to Lighthouse gateway
      const displayUrl = imgbbUrl
        ?? (imageCID ? lighthouseService.getGatewayUrl(imageCID) : lighthouseService.getGatewayUrl(metadataCID));

      return JSON.stringify({
        prompt,
        description,
        imageCID: imageCID ?? metadataCID,
        metadataCID,
        url: displayUrl,
        lighthouseUrl: imageCID ? lighthouseService.getGatewayUrl(imageCID) : lighthouseService.getGatewayUrl(metadataCID),
        note: "Image generated by Gemini. Use imageCID with create_nft_metadata to complete NFT.",
      });
    } catch (err) {
      // Fallback for any unexpected errors
      logger.error("LLM", "[Yasmin] generate_image: unexpected error, using picsum fallback", { error: String(err) });
      const image = await fetchPicsumAndUpload();
      const metadataCID = await lighthouseService.upload(
        JSON.stringify({ prompt, description: "Fallback image used due to generation error", imageCID: image.imageCID, generated_by: `Yasmin fallback (picsum)` }),
        "image-metadata.json"
      );
      return JSON.stringify({
        prompt,
        description: "Fallback image used due to generation error",
        imageCID: image.imageCID,
        metadataCID,
        url: image.displayUrl,
        lighthouseUrl: image.lighthouseUrl,
        note: "Fallback image from picsum.photos. Use imageCID with create_nft_metadata to complete NFT.",
      });
    }
  }
}

export class CreateNFTMetadataTool extends StructuredTool {
  name = "create_nft_metadata";
  description = "Create NFT metadata JSON and upload to Filecoin via Lighthouse. Returns the metadata CID.";
  schema = z.object({
    name: z.string().describe("Name of the NFT"),
    description: z.string().describe("Description of the NFT"),
    imageCID: z.string().describe("IPFS CID of the NFT image"),
    attributes: z.array(z.record(z.string(), z.unknown())).optional().describe("Optional NFT attributes array"),
  });

  async _call({ name, description, imageCID, attributes = [] }: {
    name: string;
    description: string;
    imageCID: string;
    attributes?: Record<string, unknown>[];
  }): Promise<string> {
    const metadata = {
      name,
      description,
      image: `ipfs://${imageCID}`,
      attributes,
      created_by: "Yasmin - Vantage Labs",
    };
    const cid = await lighthouseService.upload(JSON.stringify(metadata));
    logger.info("IPFS", "[Yasmin] create_nft_metadata: metadata uploaded", { cid, name, url: lighthouseService.getGatewayUrl(cid) });
    return JSON.stringify({ cid, metadata, url: lighthouseService.getGatewayUrl(cid) });
  }
}

export class UploadToFilecoinTool extends StructuredTool {
  name = "upload_to_filecoin";
  description = "Upload arbitrary content to Filecoin via Lighthouse. Returns the CID.";
  schema = z.object({
    content: z.string().describe("Content to upload (string or JSON)"),
  });

  async _call({ content }: { content: string }): Promise<string> {
    const cid = await lighthouseService.upload(content);
    logger.info("IPFS", "[Yasmin] upload_to_filecoin: content uploaded", { cid, url: lighthouseService.getGatewayUrl(cid) });
    return JSON.stringify({ cid, url: lighthouseService.getGatewayUrl(cid) });
  }
}

export class CreateTweetTool extends StructuredTool {
  name = "create_tweet";
  description = "Generate a marketing tweet for Vantage Labs.";
  schema = z.object({
    context: z.string().describe("Context or topic for the tweet"),
  });

  async _call({ context }: { context: string }): Promise<string> {
    return JSON.stringify({
      tweet: `🚀 Exciting news from Vantage Labs! ${context} #Web3 #DeFi #Flow #Filecoin #DAA`,
      charCount: 280,
    });
  }
}
