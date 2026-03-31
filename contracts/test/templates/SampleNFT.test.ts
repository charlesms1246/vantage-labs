import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

async function deploySampleNFTFixture() {
  const [owner, addr1, addr2] = await ethers.getSigners();
  const SampleNFT = await ethers.getContractFactory("SampleNFT");
  const nft = await SampleNFT.deploy("VantageNFT", "VNFT");
  return { nft, owner, addr1, addr2 };
}

describe("SampleNFT", function () {
  describe("deployment", function () {
    it("should set name and symbol correctly", async function () {
      const { nft } = await loadFixture(deploySampleNFTFixture);
      expect(await nft.name()).to.equal("VantageNFT");
      expect(await nft.symbol()).to.equal("VNFT");
    });
  });

  describe("mint()", function () {
    it("should mint token starting at ID 1", async function () {
      const { nft, addr1 } = await loadFixture(deploySampleNFTFixture);
      const tx = await nft.mint(addr1.address, "ipfs://token1");
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l: any) => {
          try { return nft.interface.parseLog(l); } catch { return null; }
        })
        .find((e: any) => e?.name === "Transfer");
      expect(event!.args.tokenId).to.equal(1n);
    });

    it("should increment tokenId on successive mints", async function () {
      const { nft, addr1, addr2 } = await loadFixture(deploySampleNFTFixture);
      await nft.mint(addr1.address, "ipfs://token1");
      const tx = await nft.mint(addr2.address, "ipfs://token2");
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l: any) => {
          try { return nft.interface.parseLog(l); } catch { return null; }
        })
        .find((e: any) => e?.name === "Transfer");
      expect(event!.args.tokenId).to.equal(2n);
    });

    it("should set tokenURI correctly", async function () {
      const { nft, addr1 } = await loadFixture(deploySampleNFTFixture);
      await nft.mint(addr1.address, "ipfs://myToken");
      expect(await nft.tokenURI(1n)).to.equal("ipfs://myToken");
    });

    it("should set correct owner", async function () {
      const { nft, addr1 } = await loadFixture(deploySampleNFTFixture);
      await nft.mint(addr1.address, "ipfs://token1");
      expect(await nft.ownerOf(1n)).to.equal(addr1.address);
    });

    it("should revert if non-owner tries to mint", async function () {
      const { nft, addr1 } = await loadFixture(deploySampleNFTFixture);
      await expect(
        nft.connect(addr1).mint(addr1.address, "ipfs://token1")
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });

    it("should emit Transfer event on mint", async function () {
      const { nft, owner, addr1 } = await loadFixture(deploySampleNFTFixture);
      await expect(nft.mint(addr1.address, "ipfs://token1"))
        .to.emit(nft, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, 1n);
    });
  });

  describe("ERC-721 transfers", function () {
    it("should transfer NFT between accounts", async function () {
      const { nft, addr1, addr2 } = await loadFixture(deploySampleNFTFixture);
      await nft.mint(addr1.address, "ipfs://token1");
      await nft.connect(addr1).transferFrom(addr1.address, addr2.address, 1n);
      expect(await nft.ownerOf(1n)).to.equal(addr2.address);
    });

    it("should support ERC-721 interface", async function () {
      const { nft } = await loadFixture(deploySampleNFTFixture);
      expect(await nft.supportsInterface("0x80ac58cd")).to.be.true;
    });
  });
});
