import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

async function deployTippingContractFixture() {
  const [owner, creator, tipper, tipper2] = await ethers.getSigners();
  const TippingContract = await ethers.getContractFactory("TippingContract");
  const tipping = await TippingContract.deploy();
  return { tipping, owner, creator, tipper, tipper2 };
}

describe("TippingContract", function () {
  describe("tip()", function () {
    it("should accept ETH tip and update tipsFor", async function () {
      const { tipping, creator, tipper } = await loadFixture(deployTippingContractFixture);
      const amount = ethers.parseEther("1");
      await tipping.connect(tipper).tip(creator.address, { value: amount });
      expect(await tipping.tipsFor(creator.address)).to.equal(amount);
    });

    it("should emit TipReceived event", async function () {
      const { tipping, creator, tipper } = await loadFixture(deployTippingContractFixture);
      const amount = ethers.parseEther("0.5");
      await expect(
        tipping.connect(tipper).tip(creator.address, { value: amount })
      )
        .to.emit(tipping, "TipReceived")
        .withArgs(creator.address, tipper.address, amount);
    });

    it("should accumulate tips from multiple tippers", async function () {
      const { tipping, creator, tipper, tipper2 } = await loadFixture(deployTippingContractFixture);
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("2");
      await tipping.connect(tipper).tip(creator.address, { value: amount1 });
      await tipping.connect(tipper2).tip(creator.address, { value: amount2 });
      expect(await tipping.tipsFor(creator.address)).to.equal(amount1 + amount2);
    });

    it("should revert when no ETH sent", async function () {
      const { tipping, creator, tipper } = await loadFixture(deployTippingContractFixture);
      await expect(
        tipping.connect(tipper).tip(creator.address, { value: 0 })
      ).to.be.revertedWith("TippingContract: no value sent");
    });

    it("should revert when tipping zero address", async function () {
      const { tipping, tipper } = await loadFixture(deployTippingContractFixture);
      await expect(
        tipping.connect(tipper).tip(ethers.ZeroAddress, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("TippingContract: zero address");
    });

    it("should allow self-tipping", async function () {
      const { tipping, tipper } = await loadFixture(deployTippingContractFixture);
      const amount = ethers.parseEther("0.1");
      await tipping.connect(tipper).tip(tipper.address, { value: amount });
      expect(await tipping.tipsFor(tipper.address)).to.equal(amount);
    });
  });

  describe("withdraw()", function () {
    it("should allow creator to withdraw their tips", async function () {
      const { tipping, creator, tipper } = await loadFixture(deployTippingContractFixture);
      const amount = ethers.parseEther("2");
      await tipping.connect(tipper).tip(creator.address, { value: amount });

      const balanceBefore = await ethers.provider.getBalance(creator.address);
      const tx = await tipping.connect(creator).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(creator.address);

      expect(balanceAfter).to.be.closeTo(balanceBefore + amount, gasUsed + ethers.parseEther("0.001"));
    });

    it("should zero out tipsFor after withdrawal", async function () {
      const { tipping, creator, tipper } = await loadFixture(deployTippingContractFixture);
      await tipping.connect(tipper).tip(creator.address, { value: ethers.parseEther("1") });
      await tipping.connect(creator).withdraw();
      expect(await tipping.tipsFor(creator.address)).to.equal(0n);
    });

    it("should emit TipWithdrawn event", async function () {
      const { tipping, creator, tipper } = await loadFixture(deployTippingContractFixture);
      const amount = ethers.parseEther("1.5");
      await tipping.connect(tipper).tip(creator.address, { value: amount });
      await expect(tipping.connect(creator).withdraw())
        .to.emit(tipping, "TipWithdrawn")
        .withArgs(creator.address, amount);
    });

    it("should revert when nothing to withdraw", async function () {
      const { tipping, creator } = await loadFixture(deployTippingContractFixture);
      await expect(tipping.connect(creator).withdraw()).to.be.revertedWith(
        "TippingContract: nothing to withdraw"
      );
    });

    it("should allow multiple creators to withdraw independently", async function () {
      const { tipping, creator, tipper, tipper2 } = await loadFixture(deployTippingContractFixture);
      await tipping.connect(tipper).tip(creator.address, { value: ethers.parseEther("1") });
      await tipping.connect(tipper).tip(tipper2.address, { value: ethers.parseEther("2") });

      await tipping.connect(creator).withdraw();
      expect(await tipping.tipsFor(creator.address)).to.equal(0n);
      // tipper2 tips still intact
      expect(await tipping.tipsFor(tipper2.address)).to.equal(ethers.parseEther("2"));
    });
  });

  describe("tipsFor()", function () {
    it("should return 0 for address with no tips", async function () {
      const { tipping, creator } = await loadFixture(deployTippingContractFixture);
      expect(await tipping.tipsFor(creator.address)).to.equal(0n);
    });
  });
});
