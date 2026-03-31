import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployIdentityFixture } from "./fixtures/deployFixture";
import { signSetAgentWallet } from "./helpers/signatures";

describe("IdentityRegistry", function () {
  // ─── register() ────────────────────────────────────────────────────────────

  describe("register()", function () {
    it("should return agentId starting at 1", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      const tx = await identityRegistry.connect(addr1).register("ipfs://agent1");
      const receipt = await tx.wait();
      // parse Registered event
      const event = receipt!.logs
        .map((l: any) => {
          try { return identityRegistry.interface.parseLog(l); } catch { return null; }
        })
        .find((e: any) => e?.name === "Registered");
      expect(event!.args.agentId).to.equal(1n);
    });

    it("should increment agentId on successive registrations", async function () {
      const { identityRegistry, addr1, addr2 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      const tx2 = await identityRegistry.connect(addr2).register("ipfs://agent2");
      const receipt = await tx2.wait();
      const event = receipt!.logs
        .map((l: any) => {
          try { return identityRegistry.interface.parseLog(l); } catch { return null; }
        })
        .find((e: any) => e?.name === "Registered");
      expect(event!.args.agentId).to.equal(2n);
    });

    it("should emit Registered event with correct args", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      await expect(identityRegistry.connect(addr1).register("ipfs://agentURI"))
        .to.emit(identityRegistry, "Registered")
        .withArgs(1n, addr1.address, "ipfs://agentURI");
    });

    it("should mint ERC-721 token to caller", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      expect(await identityRegistry.ownerOf(1n)).to.equal(addr1.address);
    });

    it("should set tokenURI correctly", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://myAgent");
      expect(await identityRegistry.tokenURI(1n)).to.equal("ipfs://myAgent");
    });

    it("nextAgentId() should reflect registrations", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      expect(await identityRegistry.nextAgentId()).to.equal(1n);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      expect(await identityRegistry.nextAgentId()).to.equal(2n);
    });
  });

  // ─── registerWithMetadata() ─────────────────────────────────────────────────

  describe("registerWithMetadata()", function () {
    it("should register and store metadata entries", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      const metadata = [
        { key: "role", value: ethers.toUtf8Bytes("trader") },
        { key: "model", value: ethers.toUtf8Bytes("gpt-4o") },
      ];
      await identityRegistry.connect(addr1).registerWithMetadata("ipfs://agent1", metadata);
      const roleBytes = await identityRegistry.getMetadata(1n, "role");
      expect(ethers.toUtf8String(roleBytes)).to.equal("trader");
    });

    it("should emit MetadataSet events for each entry", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      const metadata = [
        { key: "role", value: ethers.toUtf8Bytes("analyst") },
      ];
      await expect(
        identityRegistry.connect(addr1).registerWithMetadata("ipfs://agent1", metadata)
      )
        .to.emit(identityRegistry, "MetadataSet")
        .withArgs(1n, "role", ethers.toUtf8Bytes("analyst"));
    });

    it("should emit Registered event", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      await expect(
        identityRegistry.connect(addr1).registerWithMetadata("ipfs://agent1", [])
      )
        .to.emit(identityRegistry, "Registered")
        .withArgs(1n, addr1.address, "ipfs://agent1");
    });

    it("should work with empty metadata array", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).registerWithMetadata("ipfs://agent1", []);
      expect(await identityRegistry.ownerOf(1n)).to.equal(addr1.address);
    });
  });

  // ─── setAgentURI() ─────────────────────────────────────────────────────────

  describe("setAgentURI()", function () {
    it("should allow owner to update URI", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://old");
      await identityRegistry.connect(addr1).setAgentURI(1n, "ipfs://new");
      expect(await identityRegistry.tokenURI(1n)).to.equal("ipfs://new");
    });

    it("should emit URIUpdated event", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://old");
      await expect(identityRegistry.connect(addr1).setAgentURI(1n, "ipfs://new"))
        .to.emit(identityRegistry, "URIUpdated")
        .withArgs(1n, "ipfs://new");
    });

    it("should revert for non-owner", async function () {
      const { identityRegistry, addr1, addr2 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://old");
      await expect(
        identityRegistry.connect(addr2).setAgentURI(1n, "ipfs://new")
      ).to.be.revertedWith("IdentityRegistry: not agent owner");
    });
  });

  // ─── setMetadata() ─────────────────────────────────────────────────────────

  describe("setMetadata()", function () {
    it("should store metadata for owner", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      await identityRegistry.connect(addr1).setMetadata(1n, "role", ethers.toUtf8Bytes("dev"));
      const value = await identityRegistry.getMetadata(1n, "role");
      expect(ethers.toUtf8String(value)).to.equal("dev");
    });

    it("should emit MetadataSet event", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      await expect(
        identityRegistry.connect(addr1).setMetadata(1n, "role", ethers.toUtf8Bytes("dev"))
      )
        .to.emit(identityRegistry, "MetadataSet")
        .withArgs(1n, "role", ethers.toUtf8Bytes("dev"));
    });

    it("should revert for non-owner", async function () {
      const { identityRegistry, addr1, addr2 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      await expect(
        identityRegistry.connect(addr2).setMetadata(1n, "role", ethers.toUtf8Bytes("dev"))
      ).to.be.revertedWith("IdentityRegistry: not agent owner");
    });

    it("should revert when using 'agentWallet' key", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      await expect(
        identityRegistry
          .connect(addr1)
          .setMetadata(1n, "agentWallet", ethers.toUtf8Bytes("test"))
      ).to.be.revertedWith("IdentityRegistry: use setAgentWallet for wallet key");
    });
  });

  // ─── getMetadata() ─────────────────────────────────────────────────────────

  describe("getMetadata()", function () {
    it("should return empty bytes for unset key", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      const value = await identityRegistry.getMetadata(1n, "nonexistent");
      expect(value).to.equal("0x");
    });

    it("should revert for nonexistent agent", async function () {
      const { identityRegistry } = await loadFixture(deployIdentityFixture);
      await expect(
        identityRegistry.getMetadata(999n, "key")
      ).to.be.revertedWith("IdentityRegistry: agent does not exist");
    });
  });

  // ─── setAgentWallet() ──────────────────────────────────────────────────────

  describe("setAgentWallet()", function () {
    async function registerAndGetSetupData() {
      const { identityRegistry, owner, addr1, addr2 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      const agentId = 1n;
      const network = await ethers.provider.getNetwork();
      const chainId = network.chainId;
      const nonce = await identityRegistry.getNonce(agentId);
      const deadline = BigInt(await time.latest()) + 3600n;
      return { identityRegistry, owner, addr1, addr2, agentId, chainId, nonce, deadline };
    }

    it("should set agent wallet with valid signature", async function () {
      const { identityRegistry, addr1, addr2, agentId, chainId, nonce, deadline } =
        await registerAndGetSetupData();
      const sig = await signSetAgentWallet(addr1, agentId, addr2.address, deadline, nonce, chainId);
      await identityRegistry.connect(addr1).setAgentWallet(agentId, addr2.address, deadline, sig);
      expect(await identityRegistry.getAgentWallet(agentId)).to.equal(addr2.address);
    });

    it("should increment nonce after setAgentWallet", async function () {
      const { identityRegistry, addr1, addr2, agentId, chainId, nonce, deadline } =
        await registerAndGetSetupData();
      const sig = await signSetAgentWallet(addr1, agentId, addr2.address, deadline, nonce, chainId);
      await identityRegistry.connect(addr1).setAgentWallet(agentId, addr2.address, deadline, sig);
      expect(await identityRegistry.getNonce(agentId)).to.equal(1n);
    });

    it("should revert if caller is not agent owner", async function () {
      const { identityRegistry, addr1, addr2, agentId, chainId, nonce, deadline } =
        await registerAndGetSetupData();
      const sig = await signSetAgentWallet(addr2, agentId, addr2.address, deadline, nonce, chainId);
      await expect(
        identityRegistry.connect(addr2).setAgentWallet(agentId, addr2.address, deadline, sig)
      ).to.be.revertedWith("IdentityRegistry: not agent owner");
    });

    it("should revert with expired deadline", async function () {
      const { identityRegistry, addr1, addr2, agentId, chainId, nonce } =
        await registerAndGetSetupData();
      const expiredDeadline = BigInt(await time.latest()) - 1n;
      const sig = await signSetAgentWallet(
        addr1, agentId, addr2.address, expiredDeadline, nonce, chainId
      );
      await expect(
        identityRegistry.connect(addr1).setAgentWallet(agentId, addr2.address, expiredDeadline, sig)
      ).to.be.revertedWith("IdentityRegistry: signature expired");
    });

    it("should revert with invalid signature", async function () {
      const { identityRegistry, addr1, addr2, agentId, chainId, nonce, deadline } =
        await registerAndGetSetupData();
      // sign with wrong signer (addr2 instead of addr1)
      const sig = await signSetAgentWallet(addr2, agentId, addr2.address, deadline, nonce, chainId);
      await expect(
        identityRegistry.connect(addr1).setAgentWallet(agentId, addr2.address, deadline, sig)
      ).to.be.revertedWith("IdentityRegistry: invalid signature");
    });

    it("should revert if same signature used twice (replay protection)", async function () {
      const { identityRegistry, addr1, addr2, agentId, chainId, nonce, deadline } =
        await registerAndGetSetupData();
      const sig = await signSetAgentWallet(addr1, agentId, addr2.address, deadline, nonce, chainId);
      await identityRegistry.connect(addr1).setAgentWallet(agentId, addr2.address, deadline, sig);
      // replay same sig — nonce changed so sig is invalid
      await expect(
        identityRegistry.connect(addr1).setAgentWallet(agentId, addr2.address, deadline, sig)
      ).to.be.revertedWith("IdentityRegistry: invalid signature");
    });
  });

  // ─── getAgentWallet() ──────────────────────────────────────────────────────

  describe("getAgentWallet()", function () {
    it("should return zero address when not set", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      expect(await identityRegistry.getAgentWallet(1n)).to.equal(ethers.ZeroAddress);
    });
  });

  // ─── getNonce() ────────────────────────────────────────────────────────────

  describe("getNonce()", function () {
    it("should return 0 for a fresh agent", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      expect(await identityRegistry.getNonce(1n)).to.equal(0n);
    });
  });

  // ─── ERC-721 interface support ─────────────────────────────────────────────

  describe("ERC-721 supportsInterface", function () {
    it("should support ERC-721 interface (0x80ac58cd)", async function () {
      const { identityRegistry } = await loadFixture(deployIdentityFixture);
      expect(await identityRegistry.supportsInterface("0x80ac58cd")).to.be.true;
    });

    it("should support ERC-165 interface (0x01ffc9a7)", async function () {
      const { identityRegistry } = await loadFixture(deployIdentityFixture);
      expect(await identityRegistry.supportsInterface("0x01ffc9a7")).to.be.true;
    });

    it("should not support unknown interface", async function () {
      const { identityRegistry } = await loadFixture(deployIdentityFixture);
      expect(await identityRegistry.supportsInterface("0xdeadbeef")).to.be.false;
    });
  });

  // ─── ERC-721 transfers ─────────────────────────────────────────────────────

  describe("ERC-721 transfers", function () {
    it("should allow transfer of agent NFT", async function () {
      const { identityRegistry, addr1, addr2 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      await identityRegistry.connect(addr1).transferFrom(addr1.address, addr2.address, 1n);
      expect(await identityRegistry.ownerOf(1n)).to.equal(addr2.address);
    });

    it("should allow safeTransferFrom to EOA", async function () {
      const { identityRegistry, addr1, addr2 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      await identityRegistry
        .connect(addr1)
        ["safeTransferFrom(address,address,uint256)"](addr1.address, addr2.address, 1n);
      expect(await identityRegistry.ownerOf(1n)).to.equal(addr2.address);
    });

    it("should allow safeTransferFrom to contract implementing IERC721Receiver", async function () {
      const { identityRegistry, addr1 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      const MockReceiver = await ethers.getContractFactory("MockERC721Receiver");
      const receiver = await MockReceiver.deploy();
      await identityRegistry
        .connect(addr1)
        ["safeTransferFrom(address,address,uint256)"](
          addr1.address,
          await receiver.getAddress(),
          1n
        );
      expect(await identityRegistry.ownerOf(1n)).to.equal(await receiver.getAddress());
    });

    it("new owner can update URI after transfer", async function () {
      const { identityRegistry, addr1, addr2 } = await loadFixture(deployIdentityFixture);
      await identityRegistry.connect(addr1).register("ipfs://agent1");
      await identityRegistry.connect(addr1).transferFrom(addr1.address, addr2.address, 1n);
      await identityRegistry.connect(addr2).setAgentURI(1n, "ipfs://updated");
      expect(await identityRegistry.tokenURI(1n)).to.equal("ipfs://updated");
    });
  });
});
