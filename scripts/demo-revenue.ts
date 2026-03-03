import { network } from "hardhat";
import { ADDR } from "./addresses";

async function main() {
  const { ethers } = await network.connect();
  const [me] = await ethers.getSigners();
  const meAddr = await me.getAddress();

  const usdc = await ethers.getContractAt("MockUSDC", ADDR.USDC, me);
  const commit = await ethers.getContractAt("CommitmentToken", ADDR.COMMIT, me);
  const router = await ethers.getContractAt("RevenueRouter", ADDR.ROUTER, me);

  const w = await commit.balanceOf(meAddr);
  await (await router.setWeights([meAddr], [w])).wait();

  const revenue = 500n * 1_000_000n;
  await (await usdc.approve(ADDR.ROUTER, revenue)).wait();
  await (await router.onRevenue(revenue)).wait();

  await (await router.claim()).wait();

  console.log(" Revenue sent + claimed");
}

main().catch((e) => { console.error(e); process.exit(1); });