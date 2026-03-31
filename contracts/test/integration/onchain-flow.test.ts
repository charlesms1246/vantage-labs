import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";

describe("On-Chain Flow EVM Integration Tests (Flow Testnet)", function () {
  this.timeout(180000);

  let deployer: any;
  let addresses: any;
  let sampleToken: any;
  let sampleNFT: any;
  let tippingContract: any;

  before(async function () {
    [deployer] = await ethers.getSigners();

    addresses = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../deployments/flow-testnet.json"),
        "utf-8"
      )
    );

    sampleToken = await ethers.getContractAt(
      "SampleToken",
      addresses.contracts.SampleToken
    );

    sampleNFT = await ethers.getContractAt(
      "SampleNFT",
      addresses.contracts.SampleNFT
    );

    tippingContract = await ethers.getContractAt(
      "TippingContract",
      addresses.contracts.TippingContract
    );

    console.log(`Deployer: ${deployer.address}`);
    console.log(`SampleToken: ${addresses.contracts.SampleToken}`);
    console.log(`SampleNFT: ${addresses.contracts.SampleNFT}`);
    console.log(`TippingContract: ${addresses.contracts.TippingContract}`);
  });

  it("should verify SampleToken name='Vantage Token' and symbol='VTG'", async function () {
    const name = await sampleToken.name();
    const symbol = await sampleToken.symbol();
    console.log(`  Token name: ${name}, symbol: ${symbol}`);
    expect(name).to.equal("Vantage Token");
    expect(symbol).to.equal("VTG");
  });

  it("should mint 100 tokens to deployer and verify balance increased", async function () {
    const balanceBefore = await sampleToken.balanceOf(deployer.address);
    console.log(`  Balance before mint: ${ethers.formatEther(balanceBefore)} VTG`);

    const mintAmount = ethers.parseEther("100");
    const tx = await sampleToken.mint(deployer.address, mintAmount);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);

    const balanceAfter = await sampleToken.balanceOf(deployer.address);
    console.log(`  Balance after mint: ${ethers.formatEther(balanceAfter)} VTG`);
    expect(balanceAfter).to.equal(balanceBefore + mintAmount);
  });

  it("should transfer 10 tokens to a deterministic address and verify balance decreased", async function () {
    const recipient = ethers.Wallet.createRandom().address;
    const transferAmount = ethers.parseEther("10");

    const balanceBefore = await sampleToken.balanceOf(deployer.address);

    const tx = await sampleToken.transfer(recipient, transferAmount);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);

    const balanceAfter = await sampleToken.balanceOf(deployer.address);
    const recipientBalance = await sampleToken.balanceOf(recipient);

    console.log(`  Transferred ${ethers.formatEther(transferAmount)} VTG to ${recipient}`);
    console.log(`  Recipient balance: ${ethers.formatEther(recipientBalance)} VTG`);
    expect(balanceAfter).to.equal(balanceBefore - transferAmount);
    expect(recipientBalance).to.equal(transferAmount);
  });

  it("should mint an NFT and verify receipt.status=1 and tokenURI", async function () {
    const nftURI = "ipfs://QmTestNFT123";
    const tx = await sampleNFT.mint(deployer.address, nftURI);
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);

    // Get the tokenId from the return value or events
    // The mint function returns tokenId; check Transfer event
    const transferEvent = receipt.logs
      .map((log: any) => {
        try {
          return sampleNFT.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e: any) => e && e.name === "Transfer");

    expect(transferEvent, "Transfer event not found").to.not.be.null;
    const tokenId = transferEvent.args.tokenId;
    console.log(`  Minted NFT tokenId: ${tokenId}`);
    expect(tokenId).to.be.gte(1n);

    const storedURI = await sampleNFT.tokenURI(tokenId);
    console.log(`  NFT tokenURI: ${storedURI}`);
    expect(storedURI).to.equal(nftURI);
  });

  it("should send a tip of 0.001 FLOW to deployer address (self-tip) and verify tipsFor increases", async function () {
    const tipAmount = ethers.parseEther("0.001");
    const tipsBefore = await tippingContract.tipsFor(deployer.address);
    console.log(`  Tips before: ${ethers.formatEther(tipsBefore)} FLOW`);

    const tx = await tippingContract.tip(deployer.address, { value: tipAmount });
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);

    const tipsAfter = await tippingContract.tipsFor(deployer.address);
    console.log(`  Tips after: ${ethers.formatEther(tipsAfter)} FLOW`);
    expect(tipsAfter).to.equal(tipsBefore + tipAmount);
  });

  it("should withdraw tips and verify receipt.status=1", async function () {
    // Ensure there are tips to withdraw (from previous test)
    const tipsBalance = await tippingContract.tipsFor(deployer.address);
    if (tipsBalance === 0n) {
      // Send a tip first
      const tipAmount = ethers.parseEther("0.001");
      await (await tippingContract.tip(deployer.address, { value: tipAmount })).wait();
    }

    const tx = await tippingContract.withdraw();
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
    console.log(`  Withdraw successful, gas used: ${receipt.gasUsed}`);

    const tipsAfterWithdraw = await tippingContract.tipsFor(deployer.address);
    expect(tipsAfterWithdraw).to.equal(0n);
    console.log(`  Tips after withdraw: ${ethers.formatEther(tipsAfterWithdraw)} FLOW`);
  });
});
