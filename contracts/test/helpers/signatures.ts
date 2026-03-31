import { ethers } from "hardhat";
import type { Signer } from "ethers";

export async function signSetAgentWallet(
  signer: Signer,
  agentId: bigint,
  newWallet: string,
  deadline: bigint,
  nonce: bigint,
  chainId: bigint
): Promise<string> {
  const messageHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "uint256", "uint256", "uint256"],
    [agentId, newWallet, deadline, nonce, chainId]
  );
  // ethers v6: signMessage hashes with EthSignedMessage prefix automatically
  return signer.signMessage(ethers.getBytes(messageHash));
}
