import { network } from "hardhat";
import { ADDR } from "./addresses";

async function main() {
  const { ethers } = await network.connect();
  const [me] = await ethers.getSigners();
  const meAddr = await me.getAddress();

  const commit = await ethers.getContractAt("CommitmentToken", ADDR.COMMIT, me);
  const amm = await ethers.getContractAt("CommitmentAMM", ADDR.AMM, me);

  const commitBal = await commit.balanceOf(meAddr);
  console.log("COMMIT balance:", commitBal.toString());

  const sell = 100n * 1_000_000n; // 100 COMMIT (6 decimals)
  if (commitBal < sell) throw new Error("Not enough COMMIT to sell 100");

  await (await commit.approve(ADDR.AMM, sell)).wait();
  await (await amm.swapCommitForUsdc(sell, 1)).wait();

  console.log("Sold 100 COMMIT for USDC");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
