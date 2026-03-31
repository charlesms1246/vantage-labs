import { ethers } from "ethers";

const FLOW_RPC = "https://testnet.evm.nodes.onflow.org";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

const SampleTokenABI = require("../../contracts/abis/SampleToken.json");
const SampleNFTABI = require("../../contracts/abis/SampleNFT.json");
const TippingContractABI = require("../../contracts/abis/TippingContract.json");

const flowAddresses = {
  SampleToken: "0xb3Df63Ac5Ec5648d2E764a7C579148F29858E99D",
  SampleNFT: "0x558298297E714312D5670dBe4dbc15E1D240a811",
  TippingContract: "0x96A4978752D0fC8FccDe3c168A6a9E1c20B62330",
};

describe("Flow EVM Execution Integration", () => {
  let provider: ethers.JsonRpcProvider;
  let wallet: ethers.Wallet;
  let sampleToken: ethers.Contract;
  let sampleNFT: ethers.Contract;
  let tippingContract: ethers.Contract;

  beforeAll(async () => {
    provider = new ethers.JsonRpcProvider(FLOW_RPC);
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    sampleToken = new ethers.Contract(flowAddresses.SampleToken, SampleTokenABI, wallet);
    sampleNFT = new ethers.Contract(flowAddresses.SampleNFT, SampleNFTABI, wallet);
    tippingContract = new ethers.Contract(flowAddresses.TippingContract, TippingContractABI, wallet);
  });

  describe("Token Operations", () => {
    it("should read token name and symbol", async () => {
      const name = await sampleToken.name();
      const symbol = await sampleToken.symbol();
      expect(name).toBe("Vantage Token");
      expect(symbol).toBe("VTG");
    });

    it("should mint tokens and verify balance", async () => {
      const recipient = ethers.Wallet.createRandom().address;
      const amount = ethers.parseEther("10");
      const tx = await sampleToken.mint(recipient, amount);
      await tx.wait();
      const balance = await sampleToken.balanceOf(recipient);
      expect(balance).toBe(amount);
    });

    it("should transfer tokens between addresses", async () => {
      const recipient = ethers.Wallet.createRandom().address;
      const amount = ethers.parseEther("5");
      // Mint first
      await (await sampleToken.mint(wallet.address, ethers.parseEther("100"))).wait();
      const balanceBefore = await sampleToken.balanceOf(recipient);
      await (await sampleToken.transfer(recipient, amount)).wait();
      const balanceAfter = await sampleToken.balanceOf(recipient);
      expect(balanceAfter - balanceBefore).toBe(amount);
    });
  });

  describe("NFT Minting (note: mint() not safeMint())", () => {
    it("should mint NFT with tokenURI", async () => {
      const tokenURI = "ipfs://QmVantageNFTIntegrationTest";
      const tx = await sampleNFT.mint(wallet.address, tokenURI);
      const receipt = await tx.wait();
      expect(receipt.status).toBe(1);
    });

    it("should return correct tokenURI after minting", async () => {
      // Get the latest minted tokenId by querying Transfer events
      const filter = sampleNFT.filters.Transfer(ethers.ZeroAddress, wallet.address);
      const events = await sampleNFT.queryFilter(filter);
      if (events.length > 0) {
        const lastEvent = events[events.length - 1] as any;
        const tokenId = lastEvent.args.tokenId;
        const uri = await sampleNFT.tokenURI(tokenId);
        expect(uri).toMatch(/^ipfs:\/\//);
      }
    });
  });

  describe("Tipping Contract", () => {
    it("should accept a tip", async () => {
      const creator = ethers.Wallet.createRandom().address;
      const tipAmount = ethers.parseEther("0.001");
      const tx = await tippingContract.tip(creator, { value: tipAmount });
      const receipt = await tx.wait();
      expect(receipt.status).toBe(1);
    });

    it("should track tip amounts correctly", async () => {
      const creator = ethers.Wallet.createRandom().address;
      const tipAmount = ethers.parseEther("0.002");
      await (await tippingContract.tip(creator, { value: tipAmount })).wait();
      const tipsBalance = await tippingContract.tipsFor(creator);
      expect(tipsBalance).toBe(tipAmount);
    });
  });

  describe("flowService integration", () => {
    it("should prepareTxData correctly", () => {
      const { flowService } = require("../../src/services/flow");
      const txData = flowService.prepareTxData("swap", { from: "ETH", to: "FLOW", amount: "1.0" });
      expect(txData).toHaveProperty("action", "swap");
      expect(txData).toHaveProperty("chainId", 545);
      expect(txData).toHaveProperty("network", "flow-evm-testnet");
    });

    it("should get wallet balance via flowService", async () => {
      const { flowService } = require("../../src/services/flow");
      const balance = await flowService.getBalance(wallet.address);
      expect(typeof balance).toBe("bigint");
    });
  });
});
