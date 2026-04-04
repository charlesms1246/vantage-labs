import dotenv from "dotenv";

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error("❌ Error: OPENROUTER_API_KEY not set in environment variables");
  process.exit(1);
}

async function generateImageWithQwen(): Promise<void> {
  const MODEL_ID = "qwen/qwen3.6-plus:free";
  const PROMPT =
    "A serene landscape with mountains, a clear blue sky, and a flowing river. Digital art style, 4k resolution";

  console.log("🚀 Starting Qwen3.6 Image Generation Test");
  console.log(`📦 Model: ${MODEL_ID}`);
  console.log(`📝 Prompt: ${PROMPT}\n`);

  try {
    console.log("📤 Sending request to OpenRouter API...");

    const response = await fetch("https://openrouter.ai/api/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "Vantage Labs - Qwen Test",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        prompt: PROMPT,
        size: "1024x1024",
        quality: "standard",
        n: 1, // Number of images to generate
      }),
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ API Error Response:");
      console.error(errorData);
      process.exit(1);
    }

    const data = (await response.json()) as {
      data?: Array<{ url?: string; b64_json?: string }>;
      created?: number;
      error?: string;
    };

    if (data.error) {
      console.error("❌ API Error:", data.error);
      process.exit(1);
    }

    if (!data.data || data.data.length === 0) {
      console.error("❌ No image data returned from API");
      process.exit(1);
    }

    const imageData = data.data[0];
    const imageUrl = imageData.url;
    const imageB64 = imageData.b64_json;

    console.log("✅ Image Generated Successfully!\n");
    console.log("📸 Image Details:");
    console.log(`   Created: ${new Date(data.created! * 1000).toISOString()}`);

    if (imageUrl) {
      console.log(`   URL: ${imageUrl}`);
    }

    if (imageB64) {
      console.log(`   Base64 Length: ${imageB64.length} characters`);
      console.log(`   Base64 Preview: ${imageB64.substring(0, 50)}...`);
    }

    console.log("\n✨ Test completed successfully!");
  } catch (error) {
    console.error("❌ Test Failed:", error);
    process.exit(1);
  }
}

generateImageWithQwen();
