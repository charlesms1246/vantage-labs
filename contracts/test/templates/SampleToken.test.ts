import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

async function deploySampleTokenFixture() {
  const [owner, addr1, addr2] = await ethers.getSigners();
  const SampleToken = await ethers.getContractFactory("SampleToken");
  const initialSupply = ethers.parseEther("1000000");
  const token = await SampleToken.deploy("VantageToken", "VTK", initialSupply);
  return { token, owner, addr1, addr2, initialSupply };
}

describe("SampleToken", function () {
  describe("deployment", function () {
    it("should set name and symbol correctly", async function () {
      const { token } = await loadFixture(deploySampleTokenFixture);
      expect(await token.name()).to.equal("VantageToken");
      expect(await token.symbol()).to.equal("VTK");
    });

    it("should mint initial supply to deployer", async function () {
      const { token, owner, initialSupply } = await loadFixture(deploySampleTokenFixture);
      expect(await token.balanceOf(owner.address)).to.equal(initialSupply);
    });

    it("should have 18 decimals", async function () {
      const { token } = await loadFixture(deploySampleTokenFixture);
      expect(await token.decimals()).to.equal(18);
    });

    it("total supply equals initial supply", async function () {
      const { token, initialSupply } = await loadFixture(deploySampleTokenFixture);
      expect(await token.totalSupply()).to.equal(initialSupply);
    });
  });

  describe("mint()", function () {
    it("should allow owner to mint tokens", async function () {
      const { token, addr1 } = await loadFixture(deploySampleTokenFixture);
      const amount = ethers.parseEther("500");
      await token.mint(addr1.address, amount);
      expect(await token.balanceOf(addr1.address)).to.equal(amount);
    });

    it("should revert for non-owner", async function () {
      const { token, addr1, addr2 } = await loadFixture(deploySampleTokenFixture);
      await expect(
        token.connect(addr1).mint(addr2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("should increase total supply", async function () {
      const { token, initialSupply, addr1 } = await loadFixture(deploySampleTokenFixture);
      const amount = ethers.parseEther("100");
      await token.mint(addr1.address, amount);
      expect(await token.totalSupply()).to.equal(initialSupply + amount);
    });
  });

  describe("burn()", function () {
    it("should allow holder to burn tokens", async function () {
      const { token, owner, initialSupply } = await loadFixture(deploySampleTokenFixture);
      const burnAmount = ethers.parseEther("100");
      await token.burn(burnAmount);
      expect(await token.balanceOf(owner.address)).to.equal(initialSupply - burnAmount);
    });

    it("should decrease total supply", async function () {
      const { token, initialSupply } = await loadFixture(deploySampleTokenFixture);
      const burnAmount = ethers.parseEther("50");
      await token.burn(burnAmount);
      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("should revert when burning more than balance", async function () {
      const { token, addr1 } = await loadFixture(deploySampleTokenFixture);
      await expect(
        token.connect(addr1).burn(ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });

  describe("transfer()", function () {
    it("should transfer tokens between accounts", async function () {
      const { token, owner, addr1 } = await loadFixture(deploySampleTokenFixture);
      const amount = ethers.parseEther("100");
      await token.transfer(addr1.address, amount);
      expect(await token.balanceOf(addr1.address)).to.equal(amount);
    });

    it("should emit Transfer event", async function () {
      const { token, owner, addr1 } = await loadFixture(deploySampleTokenFixture);
      const amount = ethers.parseEther("100");
      await expect(token.transfer(addr1.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, amount);
    });
  });

  describe("approve() and transferFrom()", function () {
    it("should allow approved spender to transfer tokens", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(deploySampleTokenFixture);
      const amount = ethers.parseEther("200");
      await token.approve(addr1.address, amount);
      await token.connect(addr1).transferFrom(owner.address, addr2.address, amount);
      expect(await token.balanceOf(addr2.address)).to.equal(amount);
    });
  });
});
