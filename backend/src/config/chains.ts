import { ethers } from "ethers";
import { config } from "./env";

export const filecoinProvider = new ethers.JsonRpcProvider(config.FILECOIN_RPC);
export const flowProvider = new ethers.JsonRpcProvider(config.FLOW_RPC);

export const getDeployerWallet = (provider: ethers.Provider) => {
  if (!config.DEPLOYER_PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  return new ethers.Wallet(config.DEPLOYER_PRIVATE_KEY, provider);
};

export const chainIds = {
  filecoinCalibnet: 314159,
  flowTestnet: 545,
};
