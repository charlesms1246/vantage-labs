import { ethers } from "hardhat";

export async function deployIdentityFixture() {
  const [owner, addr1, addr2] = await ethers.getSigners();
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  return { identityRegistry, owner, addr1, addr2 };
}

export async function deployFullSystemFixture() {
  const { identityRegistry, owner, addr1, addr2 } = await deployIdentityFixture();
  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy();
  await reputationRegistry.initialize(await identityRegistry.getAddress());
  const VantageAgentRegistry = await ethers.getContractFactory("VantageAgentRegistry");
  const vantageRegistry = await VantageAgentRegistry.deploy(await identityRegistry.getAddress());
  return { identityRegistry, reputationRegistry, vantageRegistry, owner, addr1, addr2 };
}
