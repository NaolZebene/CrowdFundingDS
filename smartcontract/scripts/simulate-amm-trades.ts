import { network } from "hardhat";
import { ADDR } from "./addresses";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
] as const;

const COMMIT_ABI = [
  "function balanceOf(address,uint256) view returns (uint256)",
  "function setApprovalForAll(address,bool) returns (bool)",
  "function isApprovedForAll(address,address) view returns (bool)",
] as const;

const AMM_ABI = [
  "function seeded(uint256) view returns (bool)",
  "function poolUsdc(uint256) view returns (uint256)",
  "function poolCommit(uint256) view returns (uint256)",
  "function swapUsdcForCommit(uint256,uint256,uint256) returns (uint256)",
  "function swapCommitForUsdc(uint256,uint256,uint256) returns (uint256)",
  "function getAmountOut(uint256,uint256,uint256) view returns (uint256)",
] as const;

const VAULT_ABI = [
  "function ammProjectReady(uint256) view returns (bool)",
  "function seeded(uint256) view returns (bool)",
] as const;

// 120 rounds → fills many hourly buckets with varied price action
const ROUNDS = 120;
const MIN_SWAP_USDC = 5_000n;   // 0.005 USDC
const MAX_SWAP_USDC = 30_000n;  // 0.030 USDC
const DELAY_MS = 0;

// Seeded random for reproducible-ish price waves
let _seed = Date.now();
function rand() {
  _seed = (_seed * 1664525 + 1013904223) & 0xffffffff;
  return Math.abs(_seed) / 0xffffffff;
}
function randBetween(min: bigint, max: bigint): bigint {
  return min + BigInt(Math.floor(rand() * Number(max - min)));
}

async function sleep(ms: number) {
  if (ms > 0) return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { ethers } = await network.connect();
  const [trader] = await ethers.getSigners();
  const traderAddr = await trader.getAddress();
  console.log("Trader:", traderAddr);

  const usdc   = await ethers.getContractAt(ERC20_ABI,   ADDR.USDC);
  const commit = await ethers.getContractAt(COMMIT_ABI,  ADDR.COMMIT);
  const amm    = await ethers.getContractAt(AMM_ABI,     ADDR.AMM_ADDR);
  const vault  = await ethers.getContractAt(VAULT_ABI,   ADDR.VAULT);

  // ── find all AMM-ready seeded projects ──────────────────────────
  const readyProjects: number[] = [];
  for (let id = 1; id <= 20; id++) {
    try {
      const [ready, seededFlag] = await Promise.all([
        vault.ammProjectReady(id),
        amm.seeded(id),
      ]);
      if (ready && seededFlag) readyProjects.push(id);
    } catch {
      break; // past projectCount
    }
  }

  if (readyProjects.length === 0) {
    console.error("No AMM-ready seeded projects found. Run deploy first.");
    process.exit(1);
  }
  console.log("AMM-ready projects:", readyProjects);

  const usdcBal = await usdc.balanceOf(traderAddr);
  console.log("Trader USDC balance:", ethers.formatUnits(usdcBal, 6));

  // Approve AMM to spend USDC (large blanket allowance)
  const allowance = await usdc.allowance(traderAddr, ADDR.AMM_ADDR);
  const blanket = usdcBal;
  if (allowance < blanket / 2n) {
    console.log("Approving USDC for AMM...");
    await (await usdc.approve(ADDR.AMM_ADDR, blanket)).wait();
  }

  // Approve AMM to transfer CommitTokens (ERC-1155)
  const isApproved = await commit.isApprovedForAll(traderAddr, ADDR.AMM_ADDR);
  if (!isApproved) {
    console.log("Setting CommitToken approval for AMM...");
    await (await commit.setApprovalForAll(ADDR.AMM_ADDR, true)).wait();
  }

  // Trend phases: every 20 rounds switch between bullish / bearish / sideways
  // bullish  → buy more, sell less   → price drifts up
  // bearish  → buy less, sell more   → price drifts down
  // sideways → balanced buys/sells   → price consolidates
  const phases = ["bullish", "sideways", "bearish", "sideways", "bullish", "bearish"] as const;

  // ── simulate ROUNDS rounds ───────────────────────────────────────
  for (let round = 1; round <= ROUNDS; round++) {
    const phase = phases[Math.floor((round - 1) / 20) % phases.length];
    console.log(`\n── Round ${round}/${ROUNDS} [${phase}] ──`);

    for (const projectId of readyProjects) {
      const rUsdc   = await amm.poolUsdc(projectId);
      const rCommit = await amm.poolCommit(projectId);

      // Randomise buy size within safe bounds
      const buySize = randBetween(MIN_SWAP_USDC, MAX_SWAP_USDC);

      // ── BUY ──────────────────────────────────────────────────────
      try {
        const minOut  = await amm.getAmountOut(buySize, rUsdc, rCommit);
        const slipped = (minOut * 95n) / 100n;
        await (await amm.swapUsdcForCommit(projectId, buySize, slipped)).wait();
        const price = Number(buySize) / Number(minOut);
        console.log(`  P${projectId} BUY  ${ethers.formatUnits(buySize, 6)} USDC @ $${price.toFixed(4)}`);
      } catch (e: unknown) {
        console.warn(`  P${projectId} BUY failed:`, (e as Error).message?.slice(0, 60));
        continue;
      }

      // ── SELL — fraction depends on phase ─────────────────────────
      // bullish: sell 20–40% back  │  sideways: 40–60%  │  bearish: 60–90%
      const sellFractionMin = phase === "bullish" ? 0.20 : phase === "sideways" ? 0.40 : 0.60;
      const sellFractionMax = phase === "bullish" ? 0.40 : phase === "sideways" ? 0.60 : 0.90;
      const sellFraction = sellFractionMin + rand() * (sellFractionMax - sellFractionMin);

      // Occasionally skip the sell entirely in bullish phase (~25% chance)
      if (phase === "bullish" && rand() < 0.25) {
        console.log(`  P${projectId} HOLD (no sell this round)`);
        continue;
      }

      try {
        const commitBal = await commit.balanceOf(traderAddr, projectId);
        if (commitBal === 0n) continue;
        const sellAmt = BigInt(Math.floor(Number(commitBal) * sellFraction));
        if (sellAmt === 0n) continue;
        const rU2     = await amm.poolUsdc(projectId);
        const rC2     = await amm.poolCommit(projectId);
        const minUsdc = await amm.getAmountOut(sellAmt, rC2, rU2);
        const slipped = (minUsdc * 95n) / 100n;
        await (await amm.swapCommitForUsdc(projectId, sellAmt, slipped)).wait();
        console.log(`  P${projectId} SELL ${ethers.formatUnits(sellAmt, 6)} tokens → ${ethers.formatUnits(minUsdc, 6)} USDC`);
      } catch (e: unknown) {
        console.warn(`  P${projectId} SELL failed:`, (e as Error).message?.slice(0, 60));
      }
    }
    await sleep(DELAY_MS);
  }

  console.log("\n✓ AMM trade simulation complete.");
  console.log("The subgraph will index these swaps into PoolHourData/PoolDayData.");
  console.log("Chart data will appear once the subgraph syncs (~1-2 min).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
