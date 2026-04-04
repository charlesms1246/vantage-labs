# Qwen3.6 Image Generation Test

This directory contains test scripts for generating images using Qwen3.6 via OpenRouter API.

## Files

- **test-qwen-image.js** - JavaScript version (recommended for direct execution)
- **test-qwen-image.ts** - TypeScript version (requires tsx/compilation)

## Setup

### 1. Ensure OPENROUTER_API_KEY is Set

Add your OpenRouter API key to `.env`:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

You can get a free API key at: https://openrouter.ai

## Running the Test

### Option 1: Using npm script (Recommended)

```bash
cd backend
npm run test:qwen
```

### Option 2: Direct Node.js execution

```bash
cd backend
node scripts/test-qwen-image.js
```

### Option 3: TypeScript version

```bash
cd backend
npx tsx scripts/test-qwen-image.ts
```

## What the Script Does

1. **Validates** OPENROUTER_API_KEY is configured
2. **Sends** an image generation request to Qwen3.6 via OpenRouter
3. **Generates** a 1024x1024 landscape image
4. **Returns** the image URL and/or base64 encoded data
5. **Saves** the generated image to disk (if base64 is returned)

## Expected Output

```
🚀 Starting Qwen3.6 Image Generation Test
📦 Model: qwen/qwen3.6-plus:free
📝 Prompt: A serene landscape with mountains, a clear blue sky, and a flowing river. Digital art style, 4k resolution

📤 Sending request to OpenRouter API...
📊 Response Status: 200 OK

✅ Image Generated Successfully!

📸 Image Details:
   Created: 2026-04-03T15:30:45.123Z
   URL: https://image-url-here.com/image.png
   ➜ Open in browser: https://image-url-here.com/image.png
   💾 Saved to: D:\vantage-labs\backend\generated_image_1712162445123.png

✨ Test completed successfully!
```

## API Request Details

**Endpoint:** `https://openrouter.ai/api/v1/images/generations`

**Method:** POST

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_API_KEY`
- `HTTP-Referer: http://localhost:3001`
- `X-Title: Vantage Labs - Qwen Test`

**Request Body:**
```json
{
  "model": "qwen/qwen3.6-plus:free",
  "prompt": "A serene landscape with mountains, a clear blue sky, and a flowing river. Digital art style, 4k resolution",
  "size": "1024x1024",
  "quality": "standard",
  "n": 1
}
```

## Customizing the Prompt

Edit the `PROMPT` variable in the script to generate different images:

```javascript
const PROMPT = "Your custom prompt here";
```

### Prompt Tips

- Be specific about style: "digital art", "oil painting", "3d render"
- Include quality descriptors: "4k resolution", "highly detailed", "professional"
- Mention lighting: "golden hour", "dramatic lighting", "soft shadows"
- Specify composition: "wide angle", "closeup", "landscape orientation"

## Troubleshooting

### Error: "OPENROUTER_API_KEY not set"

- Ensure `.env` file exists in the backend directory
- Verify `OPENROUTER_API_KEY=...` is correctly set
- Restart your terminal after adding the key

### Error: "429 Too Many Requests"

- You've hit the rate limit on the free tier
- Wait a few minutes before retrying
- Consider upgrading your OpenRouter account

### Error: "Invalid API key"

- Check your API key is correct in `.env`
- Regenerate the key in your OpenRouter dashboard
- Make sure there are no extra spaces or quotes

### No Image Data Returned

- The API may not support base64 output for this model
- Check OpenRouter documentation for Qwen3.6 capabilities
- Try reducing image size or changing quality setting

## OpenRouter Documentation

- **API Docs:** https://openrouter.ai/docs
- **Model List:** https://openrouter.ai/models
- **Pricing:** https://openrouter.ai/pricing

## Model Information

- **Model:** Qwen3.6 Plus
- **Provider:** Alibaba
- **Free Tier:** Yes (with limitations)
- **Speed:** Fast
- **Quality:** High

## Next Steps

Once this test works, you can:

1. Integrate image generation into your backend services
2. Add image generation as a tool for your AI agents
3. Store generated images on Filecoin via Lighthouse
4. Display images in the frontend UI
