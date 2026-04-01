import { Tool } from "@langchain/core/tools";
import { ethers } from "ethers";
import { lighthouseService } from "../services/lighthouse";
import { flowProvider, getDeployerWallet } from "../config/chains";

export class GenerateContractTool extends Tool {
  name = "generate_contract";
  description =
    "Generate Solidity smart contract code from a specification. Input: JSON with 'spec' field describing the contract.";

  async _call(input: string): Promise<string> {
    let spec = input;
    try {
      spec = JSON.parse(input).spec || input;
    } catch {}
    // Template-based generation — Claude model does the heavy lifting via LLM
    return JSON.stringify({
      spec,
      template: "ERC20",
      solidity: "// Generated contract based on spec\n// Full implementation via Rishi's model",
      note: "Rishi uses OpenRouter Nemotron for actual code generation via LLM response",
    });
  }
}

export class DeployContractTool extends Tool {
  name = "deploy_contract";
  description =
    "Deploy a smart contract to Flow EVM Testnet using the deployer wallet. Input: JSON with 'bytecode' (hex, required), 'abi' (array, required), 'constructorArgs' (array, optional), and 'label' (string, optional) for identification. Returns deployed contract address and txHash.";

  async _call(input: string): Promise<string> {
    let parsed: {
      bytecode: string;
      abi: ethers.InterfaceAbi;
      constructorArgs?: unknown[];
      label?: string;
    };

    try {
      parsed = JSON.parse(input);
    } catch {
      return JSON.stringify({ error: "Invalid JSON input", hint: "Provide bytecode, abi, and optional constructorArgs" });
    }

    const { bytecode, abi, constructorArgs = [], label = "UnnamedContract" } = parsed;

    if (!bytecode || !abi) {
      return JSON.stringify({ error: "Missing required fields: bytecode and abi" });
    }

    try {
      const wallet = getDeployerWallet(flowProvider);
      const factory = new ethers.ContractFactory(abi, bytecode, wallet);
      const contract = await factory.deploy(...constructorArgs);
      await contract.waitForDeployment();

      const address = await contract.getAddress();
      const deployTx = contract.deploymentTransaction();
      const txHash = deployTx?.hash ?? "unknown";

      // Store deployment proof on Lighthouse
      const proof = JSON.stringify({
        label,
        address,
        txHash,
        network: "flow-evm-testnet",
        chainId: 545,
        deployedBy: await wallet.getAddress(),
        timestamp: new Date().toISOString(),
        abi,
      });
      const proofCid = await lighthouseService.upload(proof);

      return JSON.stringify({
        success: true,
        label,
        address,
        txHash,
        network: "flow-evm-testnet",
        chainId: 545,
        explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
        contractUrl: `https://evm-testnet.flowscan.io/address/${address}`,
        proofCid,
        proofUrl: lighthouseService.getGatewayUrl(proofCid),
      });
    } catch (err) {
      return JSON.stringify({ error: (err as Error).message });
    }
  }
}

export class StoreProofTool extends Tool {
  name = "store_proof";
  description =
    "Store compilation proof on Filecoin. Input: JSON with 'bytecode' and 'metadata'. Returns CID.";

  async _call(input: string): Promise<string> {
    const cid = await lighthouseService.upload(input);
    return JSON.stringify({ cid, stored: true, url: lighthouseService.getGatewayUrl(cid) });
  }
}
