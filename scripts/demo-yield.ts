import { network } from "hardhat";
import { ADDR } from "./addresses";

async function main() {
  const { ethers } = await network.connect();
  const [me] = await ethers.getSigners();

  const usdc = await ethers.getContractAt("MockUSDC", ADDR.USDC, me);
  const lender = await ethers.getContractAt("MockLender", ADDR.LENDER, me);
  const vault = await ethers.getContractAt("CrowdVault", ADDR.VAULT, me);

  const y = 50n * 1_000_000n; // 50 USDC
  await (await usdc.approve(ADDR.LENDER, y)).wait();
  await (await lender.addYield(y)).wait();

  await (await vault.harvestYield()).wait();
  await (await vault.claimYield()).wait();

  console.log(" Harvested + claimed yield");
}

main().catch((e) => { console.error(e); process.exit(1); });