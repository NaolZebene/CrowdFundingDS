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
  "function isAdmin(address) view returns (bool)",
  "function removeLiquidity(uint256)",
  "function seed(uint256,uint256,uint256)",
] as const;

const VAULT_ABI = [
  "function ammProjectReady(uint256) view returns (bool)",
] as const;

// Target price: $0.10 per token. Seed USDC = commit_balance * 0.10
const PRICE_PER_TOKEN = 0.10; // $0.10 per commit token

async function main() {
  const { ethers } = await network.connect();
  const [admin] = await ethers.getSigners();
  const adminAddr = await admin.getAddress();
  console.log("Admin:", adminAddr);

  const usdc   = await ethers.getContractAt(ERC20_ABI,  ADDR.USDC);
  const commit = await ethers.getContractAt(COMMIT_ABI, ADDR.COMMIT);
  const amm    = await ethers.getContractAt(AMM_ABI,    ADDR.AMM_ADDR);
  const vault  = await ethers.getContractAt(VAULT_ABI,  ADDR.VAULT);

  const isAdminFlag = await amm.isAdmin(adminAddr);
  if (!isAdminFlag) {
    console.error("Signer is not AMM admin. Cannot reseed.");
    process.exit(1);
  }

  const usdcBal = await usdc.balanceOf(adminAddr);
  console.log("USDC balance:", ethers.formatUnits(usdcBal, 6));

  const readyProjects: number[] = [];
  for (let id = 1; id <= 20; id++) {
    try {
      const ready = await vault.ammProjectReady(id);
      if (ready) readyProjects.push(id);
    } catch { break; }
  }
  console.log("AMM-ready projects:", readyProjects);

  // Approve USDC (blanket) and CommitToken
  const usdcAllowance = await usdc.allowance(adminAddr, ADDR.AMM_ADDR);
  if (usdcAllowance < usdcBal / 2n) {
    await (await usdc.approve(ADDR.AMM_ADDR, usdcBal)).wait();
    console.log("USDC approved");
  }
  const isApproved = await commit.isApprovedForAll(adminAddr, ADDR.AMM_ADDR);
  if (!isApproved) {
    await (await commit.setApprovalForAll(ADDR.AMM_ADDR, true)).wait();
    console.log("CommitToken approved");
  }

  for (const projectId of readyProjects) {
    const seededNow = await amm.seeded(projectId);
    if (seededNow) {
      console.log(`Project ${projectId}: removing liquidity...`);
      await (await amm.removeLiquidity(projectId)).wait();
    }

    const commitBal = await commit.balanceOf(adminAddr, projectId);
    if (commitBal === 0n) {
      console.warn(`Project ${projectId}: no commit tokens. Skipping.`);
      continue;
    }
    // Use all available commit tokens; derive USDC from target price
    const seedCommit = commitBal;
    const seedUsdc = BigInt(Math.floor(Number(commitBal) * PRICE_PER_TOKEN));
    if (seedUsdc === 0n) {
      console.warn(`Project ${projectId}: derived USDC too small. Skipping.`);
      continue;
    }
    console.log(`Project ${projectId}: seeding with ${ethers.formatUnits(seedUsdc, 6)} USDC + ${ethers.formatUnits(seedCommit, 6)} tokens @ $${PRICE_PER_TOKEN}...`);
    await (await amm.seed(projectId, seedUsdc, seedCommit)).wait();
    console.log(`Project ${projectId}: seeded ✓`);
  }

  console.log("\n✓ Reseed complete. Run simulate:amm-trades next.");
}

main().catch((e) => { console.error(e); process.exit(1); });
