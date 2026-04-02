import { config } from "../config/env";
import { logger } from "./logger";

export async function uploadToImgbb(base64Data: string): Promise<string> {
  const form = new FormData();
  form.append("key", config.IMGBB_API_KEY);
  form.append("image", base64Data);
  form.append("expiration", "300"); // 5 minutes

  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: form,
  });

  const json = (await res.json()) as { data: { url: string }; status: number };
  if (!res.ok || json.status !== 200) {
    throw new Error(`imgbb upload failed: ${JSON.stringify(json)}`);
  }

  logger.info("IMGBB", "Image uploaded to imgbb", { url: json.data.url });
  return json.data.url;
}
