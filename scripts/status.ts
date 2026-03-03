import { network } from "hardhat";
import { ADDR } from "./addresses";

async function main() {
  const { ethers } = await network.connect();
  const [me] = await ethers.getSigners();
  const meAddr = await me.getAddress();

  console.log("Signer:", meAddr);
  console.log("USDC  :", ADDR.USDC);
  console.log("COMMIT:", ADDR.COMMIT);
  console.log("VAULT :", ADDR.VAULT);

  const usdc = await ethers.getContractAt("MockUSDC", ADDR.USDC, me);
  const commit = await ethers.getContractAt("CommitmentToken", ADDR.COMMIT, me);
  const vault = await ethers.getContractAt("CrowdVault", ADDR.VAULT, me);

  console.log("USDC balance    :", (await usdc.balanceOf(meAddr)).toString());
  console.log("COMMIT balance  :", (await commit.balanceOf(meAddr)).toString());
  console.log("COMMIT supply   :", (await commit.totalSupply()).toString());

  console.log("Vault totalRaised :", (await vault.totalRaised()).toString());
  console.log("Vault principalOf :", (await vault.principalOf(meAddr)).toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
