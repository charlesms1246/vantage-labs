/**
 * Test script for picsum image upload to Lighthouse/Filecoin.
 *
 * This validates that picsum fallback images are properly:
 * 1. Fetched as binary data (following redirects to get stable /id/{n}/... URLs)
 * 2. Uploaded to Lighthouse as binary files (.jpg)
 * 3. Accessible via the Lighthouse gateway
 *
 * Run from the backend directory:
 *   npx tsx scripts/test-picsum-upload.ts [--dry-run]
 *
 * Flags:
 *   --dry-run              Simulate upload without network (for testing without Lighthouse connectivity)
 *
 * Requires LIGHTHOUSE_API_KEY in backend/.env (for real uploads).
 * Saves images to backend/scripts/output/ for inspection.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";
import crypto from "crypto";
import lighthouse from "@lighthouse-web3/sdk";

dotenv.config();

const OUTPUT_DIR = join(__dirname, "output");
const DRY_RUN = process.argv.includes("--dry-run");
const LIGHTHOUSE_GATEWAY = "https://gateway.lighthouse.storage/ipfs";

async function testPicsumUpload(): Promise<void> {
  console.log(`\n${"─".repeat(70)}`);
  console.log("Vantage Labs — Picsum Image Upload to Filecoin Test");
  console.log(`${"─".repeat(70)}`);
  console.log(`Mode: ${DRY_RUN ? "🔵 DRY-RUN (simulated)" : "🔴 LIVE (requires Lighthouse connectivity)"}`);
  console.log(`Lighthouse API Key: ${process.env.LIGHTHOUSE_API_KEY ? "✓ Set" : "✗ Not set"}`);
  console.log(`Output Dir: ${OUTPUT_DIR}`);
  console.log(`${"─".repeat(70)}\n`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  try {
    // ──────────────────────────────────────────────────────────────
    // Step 1: Fetch picsum image (follows redirect to stable URL)
    // ──────────────────────────────────────────────────────────────

    console.log("Step 1: Fetching random picsum image…");
    const picsumResponse = await fetch("https://picsum.photos/1000/1000");
    if (!picsumResponse.ok) {
      throw new Error(`Picsum fetch failed: HTTP ${picsumResponse.status}`);
    }

    const stableUrl = picsumResponse.url; // /id/{n}/1000/1000 after redirect
    const contentType = picsumResponse.headers.get("content-type") ?? "image/jpeg";
    const mimeType = contentType.split(";")[0].trim();
    const ext = mimeType.split("/")[1] ?? "jpg";

    console.log(`  ✓ Stable URL: ${stableUrl}`);
    console.log(`  ✓ MIME Type: ${mimeType}`);
    console.log(`  ✓ Extension: ${ext}`);

    // Convert to base64
    const arrayBuffer = await picsumResponse.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const fileSize = (arrayBuffer.byteLength / 1024).toFixed(2);

    console.log(`  ✓ Downloaded: ${fileSize} KB`);

    // Save locally for inspection
    const localPath = join(OUTPUT_DIR, `test-picsum-${Date.now()}.${ext}`);
    writeFileSync(localPath, Buffer.from(arrayBuffer));
    console.log(`  ✓ Saved locally: ${localPath}\n`);

    // ──────────────────────────────────────────────────────────────
    // Step 2: Upload binary to Lighthouse/Filecoin
    // ──────────────────────────────────────────────────────────────

    console.log("Step 2: Uploading binary to Lighthouse…");

    let imageCID: string;
    let lighthouseUrl: string;

    if (DRY_RUN) {
      // Simulate upload for offline testing
      imageCID = `QmPicsum${crypto.randomBytes(20).toString("hex")}`;
      lighthouseUrl = `${LIGHTHOUSE_GATEWAY}/${imageCID}`;
      console.log(`  ⚠  [DRY-RUN] Simulated CID: ${imageCID}`);
      console.log(`  ⚠  [DRY-RUN] Not uploading to live Lighthouse\n`);
    } else {
      // Real upload via Lighthouse SDK
      if (!process.env.LIGHTHOUSE_API_KEY) {
        throw new Error(
          "LIGHTHOUSE_API_KEY not set. Set it in .env or run with --dry-run to test offline"
        );
      }

      // Use the Lighthouse SDK to upload the already-saved file
      const response = await lighthouse.upload(localPath, process.env.LIGHTHOUSE_API_KEY);
      imageCID = response.data.Hash;
      lighthouseUrl = `${LIGHTHOUSE_GATEWAY}/${imageCID}`;

      console.log(`  ✓ CID: ${imageCID}`);
      console.log(`  ✓ Name: ${response.data.Name}`);
      console.log(`  ✓ Size: ${response.data.Size} bytes`);
      console.log(`  ✓ Gateway URL: ${lighthouseUrl}`);

      // Verify accessibility
      console.log(`\nStep 3: Verifying Lighthouse gateway accessibility…`);
      const verifyResponse = await fetch(lighthouseUrl);
      if (verifyResponse.ok) {
        const contentLength = verifyResponse.headers.get("content-length");
        console.log(`  ✓ Gateway accessible (${contentLength} bytes)\n`);
      } else {
        console.warn(
          `  ⚠  Gateway returned HTTP ${verifyResponse.status} (file may still be syncing, check again in 30s)\n`
        );
      }
    }

    // ──────────────────────────────────────────────────────────────
    // Summary
    // ──────────────────────────────────────────────────────────────

    console.log(`${"─".repeat(70)}`);
    console.log("✓ Test Complete");
    console.log(`${"─".repeat(70)}`);
    console.log("\nResults:");
    console.log(`  Picsum URL (stable)  : ${stableUrl}`);
    console.log(`  Image CID            : ${imageCID}`);
    console.log(`  Lighthouse Gateway   : ${lighthouseUrl}`);
    console.log(`  Local File (inspect) : ${localPath}`);
    console.log("\nNFT Creation Flow:");
    console.log(`  1. Use Yasmin agent to call generate_image`);
    console.log(`  2. Yasmin will use this picsum + upload flow for fallback images`);
    console.log(`  3. Returns imageCID + metadata`);
    console.log(`  4. Pass imageCID to create_nft_metadata tool`);
    console.log(`  5. Use metadata CID to mint NFT\n`);

    if (DRY_RUN) {
      console.log("To run with real Lighthouse upload:");
      console.log(`  npx tsx scripts/test-picsum-upload.ts\n`);
    }

    console.log(`${"─".repeat(70)}\n`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`\n✗ Test failed: ${errorMsg}\n`);
    if (!DRY_RUN) {
      console.error("Hint: If Lighthouse is unreachable, run with --dry-run to test locally:\n");
      console.error(`  npx tsx scripts/test-picsum-upload.ts --dry-run\n`);
    }
    process.exit(1);
  }
}

testPicsumUpload();
