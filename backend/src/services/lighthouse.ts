import lighthouse from "@lighthouse-web3/sdk";
import { ethers } from "ethers";
import { config } from "../config/env";
import { filecoinProvider, getDeployerWallet } from "../config/chains";
import OnchainCIDABI from "../../contracts/abis/OnchainCID.json";
import { logger } from "./logger";

const ONCHAIN_CID_ADDRESS = config.ONCHAIN_CID_ADDRESS;

// Lighthouse HTTP endpoints
const LIGHTHOUSE_NODE_URL = "https://upload.lighthouse.storage/api/v0/add";
const LIGHTHOUSE_DEAL_REQUEST_URL = "https://api.lighthouse.storage/api/lighthouse/pdp_deal_request";
const LIGHTHOUSE_DEAL_STATUS_URL = "https://api.lighthouse.storage/api/lighthouse/deal_status";
const LIGHTHOUSE_GATEWAY = "https://gateway.lighthouse.storage/ipfs";

class LighthouseService {
  // ── OnchainCID contract ───────────────────────────────────────────────────

  private getOnchainCIDContract(): ethers.Contract | null {
    try {
      const wallet = getDeployerWallet(filecoinProvider);
      return new ethers.Contract(ONCHAIN_CID_ADDRESS, OnchainCIDABI, wallet);
    } catch {
      return null;
    }
  }

  private async pushCIDOnchain(
    cid: string,
    filename: string,
    size: bigint,
    mimeType: string
  ): Promise<void> {
    const contract = this.getOnchainCIDContract();
    if (!contract) {
      logger.warn("LIGHTHOUSE", "DEPLOYER_PRIVATE_KEY not set — skipping on-chain CID push");
      return;
    }
    try {
      const tx = await contract.pushCIDOnchain(cid, filename, size, false, mimeType, []);
      const receipt = await tx.wait();
      logger.info("LIGHTHOUSE", "CID pushed on-chain", { cid, txHash: receipt.hash, filename });
    } catch (err) {
      logger.error("LIGHTHOUSE", "Failed to push CID on-chain (upload still succeeded)", {
        cid,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Deal request (PDP) ────────────────────────────────────────────────────

  /**
   * Ask Lighthouse to proactively find a miner and make a Filecoin deal for
   * this CID. Without this call, miners pick up CIDs opportunistically which
   * can leave files in a "queued" state indefinitely.
   *
   * Deals take ~20 min to appear; size limit is 100 MB per PDP deal request.
   */
  private async requestDeal(cid: string): Promise<void> {
    if (!config.LIGHTHOUSE_API_KEY) return;
    try {
      const res = await fetch(`${LIGHTHOUSE_DEAL_REQUEST_URL}?cid=${cid}`, {
        headers: { Authorization: `Bearer ${config.LIGHTHOUSE_API_KEY}` },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        logger.warn("LIGHTHOUSE", `Deal request HTTP ${res.status}`, { cid, body: body.slice(0, 200) });
        return;
      }
      logger.info("LIGHTHOUSE", "Filecoin deal requested via PDP", { cid });
    } catch (err) {
      // Non-fatal — upload succeeded; deal will be retried on next run
      logger.warn("LIGHTHOUSE", "Deal request failed (non-fatal)", {
        cid,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Upload: text / JSON ───────────────────────────────────────────────────

  /**
   * Upload a text/JSON string to Lighthouse, push the CID on-chain, then
   * immediately request a Filecoin deal so the file is indexed by miners.
   */
  async upload(data: string, filename = "agent-log.json", mimeType = "application/json"): Promise<string> {
    if (!config.LIGHTHOUSE_API_KEY) {
      logger.warn("LIGHTHOUSE", "LIGHTHOUSE_API_KEY not set, skipping upload");
      return "QmSimulatedCID";
    }

    const response = await lighthouse.uploadText(data, config.LIGHTHOUSE_API_KEY, filename);
    const cid: string = response.data.Hash;
    const size = BigInt(response.data.Size ?? 0);
    const resolvedFilename: string = response.data.Name ?? filename;

    // Push CID to Filecoin Calibration via OnchainCID contract
    await this.pushCIDOnchain(cid, resolvedFilename, size, mimeType);

    // Proactively request a Filecoin deal so the file is not left queued
    await this.requestDeal(cid);

    return cid;
  }

  // ── Upload: binary (images, files) ────────────────────────────────────────

  /**
   * Upload raw binary data (e.g. a Gemini-generated image) directly to
   * Lighthouse IPFS. Returns the CID.
   *
   * Uses the Lighthouse IPFS node HTTP API with multipart/form-data so we
   * avoid writing a temp file to disk.
   */
  async uploadBuffer(
    base64Data: string,
    filename: string,
    mimeType: string
  ): Promise<string> {
    if (!config.LIGHTHOUSE_API_KEY) {
      logger.warn("LIGHTHOUSE", "LIGHTHOUSE_API_KEY not set, skipping buffer upload");
      return "QmSimulatedCID";
    }

    const buffer = Buffer.from(base64Data, "base64");
    const blob = new Blob([buffer], { type: mimeType });

    const form = new FormData();
    form.append("file", blob, filename);

    const res = await fetch(LIGHTHOUSE_NODE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.LIGHTHOUSE_API_KEY}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Lighthouse buffer upload failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { Hash: string; Name: string; Size: string };
    const cid = json.Hash;
    const size = BigInt(json.Size ?? 0);

    logger.info("LIGHTHOUSE", "Binary file uploaded to IPFS", { cid, filename, mimeType, size: size.toString() });

    // Push CID on-chain and request a deal
    await this.pushCIDOnchain(cid, filename, size, mimeType);
    await this.requestDeal(cid);

    return cid;
  }

  // ── Deal status ───────────────────────────────────────────────────────────

  /**
   * Check Filecoin deal status for a CID.
   * Returns null if the CID has no deal yet or on network error.
   */
  async getDealStatus(cid: string): Promise<unknown> {
    try {
      const res = await fetch(`${LIGHTHOUSE_DEAL_STATUS_URL}?cid=${cid}`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  async getFile(cid: string): Promise<unknown> {
    const response = await fetch(`${LIGHTHOUSE_GATEWAY}/${cid}`);
    return response.json();
  }

  getGatewayUrl(cid: string): string {
    return `${LIGHTHOUSE_GATEWAY}/${cid}`;
  }
}

export const lighthouseService = new LighthouseService();
