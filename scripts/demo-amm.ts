import { network } from "hardhat";
import { ADDR } from "./addresses";

async function main() {
  const { ethers } = await network.connect();
  const [me] = await ethers.getSigners();
  const meAddr = await me.getAddress();

  const usdc = await ethers.getContractAt("MockUSDC", ADDR.USDC, me);
  const commit = await ethers.getContractAt("CommitmentToken", ADDR.COMMIT, me);
  const amm = await ethers.getContractAt("CommitmentAMM", ADDR.AMM, me);

  const usdcBal = await usdc.balanceOf(meAddr);
  const commitBal = await commit.balanceOf(meAddr);

  console.log("USDC balance:", usdcBal.toString());
  console.log("COMMIT balance:", commitBal.toString());

  // seed with up to 500 tokens each, but never more than you own
  const targetSeed = 500n * 1_000_000n;

  const seedUsdc = usdcBal < targetSeed ? usdcBal : targetSeed;
  const seedCommit = commitBal < targetSeed ? commitBal : targetSeed;

  if (seedUsdc === 0n || seedCommit === 0n) {
    throw new Error("Not enough USDC or COMMIT to seed. Run demo-invest first.");
  }

  console.log("Seeding AMM with:", seedUsdc.toString(), "USDC and", seedCommit.toString(), "COMMIT");

  await (await usdc.approve(ADDR.AMM, seedUsdc)).wait();
  await (await commit.approve(ADDR.AMM, seedCommit)).wait();
  await (await amm.seed(seedUsdc, seedCommit)).wait();

  // sell 100 COMMIT if possible
  const sell = 100n * 1_000_000n;
  if (commitBal < sell) {
    throw new Error("Not enough COMMIT to sell 100. Invest more or sell less.");
  }

  console.log("Selling 100 COMMIT...");
  await (await commit.approve(ADDR.AMM, sell)).wait();
  await (await amm.swapCommitForUsdc(sell, 1)).wait();

  console.log("AMM exit done (sold COMMIT for USDC)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});