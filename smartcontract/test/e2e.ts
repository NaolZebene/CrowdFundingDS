/**
 * CrowdVault — Full End-to-End Test Suite
 * Runs entirely on the in-process Hardhat network (no Sepolia, no keys needed).
 *
 * Covers:
 *  ✓ Deployment & wiring
 *  ✓ Project creation (with & without funding goal)
 *  ✓ Admin approval flow
 *  ✓ Invest flow (USDC approve → invest → CommitToken minted)
 *  ✓ KYC / ZK verifier gating (MockZKVerifier)
 *  ✓ Funding deadline passed → initial milestone release + AMM seed
 *  ✓ Milestone verification → requestRelease → approval/veto → executeRelease
 *  ✓ Veto flow (30% stake threshold)
 *  ✓ Refund flow (deadline passed, goal not met)
 *  ✓ Yield farming (seeded MockLender yield + harvestYield + claimYield)
 *  ✓ AMM swap (buy & sell CommitToken via CommitmentAMM)
 *  ✓ Revenue router (release fee)
 *  ✓ WorldIDVerifierAdapter rejects bad proof gracefully
 *  ✓ Admin transfer (two-step)
 */

import { network } from "hardhat";

/* eslint-disable @typescript-eslint/no-explicit-any */

function ok(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  const { ethers } = await network.connect();

  const U6   = (n: number) => ethers.parseUnits(String(n), 6);
  const fmt6 = (v: bigint)  => Number(ethers.formatUnits(v, 6)).toFixed(4);
  const mine = async (s: number) => {
    await ethers.provider.send("evm_increaseTime", [s]);
    await ethers.provider.send("evm_mine", []);
  };

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  CrowdVault E2E Test Suite — Hardhat local network");
  console.log("══════════════════════════════════════════════════════\n");

  const [deployer, founder, investor1, investor2, treasury, stranger] =
    await ethers.getSigners();

  /* ══════════════════════════════════════════════════════
   * 1. DEPLOYMENT
   * ══════════════════════════════════════════════════════ */
  console.log("► [1] Deploying contracts…");

  // MockUSDC — no constructor args
  const usdcC = await ethers.getContractFactory("MockUSDC");
  const usdc  = (await (await usdcC.deploy()).waitForDeployment()) as any;
  const USDC  = await usdc.getAddress();

  await usdc.mint(investor1.address, U6(10_000));
  await usdc.mint(investor2.address, U6(10_000));
  await usdc.mint(stranger.address, U6(1_000));
  await usdc.mint(deployer.address,  U6(50_000));

  // MockLender
  const lenderC = await ethers.getContractFactory("MockLender");
  const lender  = (await (await lenderC.deploy(USDC)).waitForDeployment()) as any;
  const LENDER  = await lender.getAddress();

  // MockZKVerifier
  const zkC      = await ethers.getContractFactory("MockZKVerifier");
  const zkVerifier = (await (await zkC.deploy()).waitForDeployment()) as any;
  const ZKVER    = await zkVerifier.getAddress();

  // CommitmentToken
  const commitC = await ethers.getContractFactory("CommitmentToken");
  const commit  = (await (await commitC.deploy(deployer.address, "Test Commit", "TST")).waitForDeployment()) as any;
  const COMMIT  = await commit.getAddress();

  // CrowdVault
  const vaultC = await ethers.getContractFactory("CrowdVault");
  const vault  = (await (await vaultC.deploy(USDC, COMMIT)).waitForDeployment()) as any;
  const VAULT  = await vault.getAddress();

  // RevenueRouter(usdc_, treasury_, backersBps_)
  const routerC = await ethers.getContractFactory("RevenueRouter");
  const router  = (await (await routerC.deploy(USDC, treasury.address, 5000n)).waitForDeployment()) as any;
  const ROUTER  = await router.getAddress();

  // CommitmentAMM
  const ammC = await ethers.getContractFactory("CommitmentAMM");
  const amm  = (await (await ammC.deploy(USDC, COMMIT, VAULT)).waitForDeployment()) as any;
  const AMM  = await amm.getAddress();

  // Wire
  await commit.setMinter(VAULT);
  await vault.setLender(LENDER);
  await vault.addZK(ZKVER);
  await vault.setRevenueRouter(ROUTER);
  await vault.setAMM(AMM);
  await vault.setReleaseFeeBps(100n); // 1%

  console.log("  ✓ All contracts deployed & wired");

  /* ══════════════════════════════════════════════════════
   * 2. PROJECT CREATION & APPROVAL
   * ══════════════════════════════════════════════════════ */
  console.log("\n► [2] Project creation & approval…");

  const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);

  // Project A: goal-based (3 milestones, 1000 USDC, 1-day deadline)
  await (vault.connect(founder) as any).createProject(
    treasury.address, 3n,
    "Project Alpha", "Goal-based project", "", "ipfs://alpha",
    U6(1_000), now + 86400n, 0n
  );
  ok((await vault.projectCount()) === 1n, "Project A created (id=1)");

  // Project B: no-goal (2 milestones, no deadline)
  await (vault.connect(founder) as any).createProject(
    treasury.address, 2n,
    "Project Beta", "No-goal open project", "", "ipfs://beta",
    0n, 0n, 0n
  );
  ok((await vault.projectCount()) === 2n, "Project B created (id=2)");

  // Project C: refund test (goal 5000 USDC, 30-day deadline — mined past before refund)
  await (vault.connect(founder) as any).createProject(
    treasury.address, 1n,
    "Project Charlie", "Refund test project", "", "ipfs://charlie",
    U6(5_000), now + 30n * 86400n, 0n
  );
  ok((await vault.projectCount()) === 3n, "Project C created (id=3)");

  await vault.approveProject(1n);
  await vault.approveProject(2n);
  ok((await vault.projects(1n)).approved, "Project A approved");
  ok((await vault.projects(2n)).approved, "Project B approved");

  /* ══════════════════════════════════════════════════════
   * 3. INVEST FLOW
   * ══════════════════════════════════════════════════════ */
  console.log("\n► [3] Invest flow…");

  await (usdc.connect(investor1) as any).approve(VAULT, U6(400));
  await (vault.connect(investor1) as any).invest(1n, U6(400), "0x");
  const commitBal1: bigint = await commit.balanceOf(investor1.address, 1n);
  ok(commitBal1 === U6(400), `investor1 received ${fmt6(commitBal1)} CommitTokens`);

  // investor2 hits goal, but funding should remain open until deadline
  await (usdc.connect(investor2) as any).approve(VAULT, U6(600));
  await (vault.connect(investor2) as any).invest(1n, U6(600), "0x");
  const commitBal2: bigint = await commit.balanceOf(investor2.address, 1n);
  ok(commitBal2 === U6(600), `investor2 received ${fmt6(commitBal2)} CommitTokens`);

  await (usdc.connect(investor1) as any).approve(VAULT, U6(100));
  await (vault.connect(investor1) as any).invest(1n, U6(100), "0x");

  let projA = await vault.projects(1n);
  ok(projA.totalRaised === U6(1_100), "Project A accepts overfunding before deadline");
  ok(projA.currentMilestone === 0n, "No milestone release before funding deadline");
  ok(projA.totalReleased === 0n, "No funds released before funding deadline");
  ok(!(await amm.seeded(1n)), "AMM pool is not seeded before funding deadline");

  let earlyClaimRejected = false;
  try {
    await (vault.connect(founder) as any).claimInitialMilestoneRelease(1n);
  } catch { earlyClaimRejected = true; }
  ok(earlyClaimRejected, "Initial release is blocked before funding deadline");

  await mine(2 * 86400);
  await (vault.connect(founder) as any).claimInitialMilestoneRelease(1n);
  projA = await vault.projects(1n);
  ok(projA.currentMilestone === 1n, "Milestone 1 unlocked after deadline acceptance");
  ok(projA.totalReleased > 0n, `Initial milestone funds released: ${fmt6(projA.totalReleased)} USDC`);
  ok(await amm.seeded(1n), "AMM pool seeded after funding deadline acceptance");

  /* ══════════════════════════════════════════════════════
   * 4. ZK VERIFIER GATING
   * ══════════════════════════════════════════════════════ */
  console.log("\n► [4] ZK verifier gating…");

  await (usdc.connect(investor1) as any).approve(VAULT, U6(100));
  await (vault.connect(investor1) as any).invest(2n, U6(100), "0x");
  ok(true, "Invest with empty proof accepted (ZK optional)");

  const kycProof = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "bytes"],
    [ZKVER, "0x"]
  );

  let didRevert = false;
  try {
    await (usdc.connect(stranger) as any).approve(VAULT, U6(50));
    await (vault.connect(stranger) as any).invest(2n, U6(50), kycProof);
  } catch { didRevert = true; }
  ok(didRevert, "Invest with non-empty proof rejects unapproved KYC user");

  await zkVerifier.setKyc(stranger.address, true);
  await (usdc.connect(stranger) as any).approve(VAULT, U6(50));
  await (vault.connect(stranger) as any).invest(2n, U6(50), kycProof);
  ok((await commit.balanceOf(stranger.address, 2n) as bigint) === U6(50), "Invest with approved KYC proof succeeds");

  /* ══════════════════════════════════════════════════════
   * 5. MILESTONE VERIFICATION → RELEASE
   * ══════════════════════════════════════════════════════ */
  console.log("\n► [5] Milestone verification → release…");

  await (vault.connect(founder) as any).verifyNextMilestone(1n);
  ok((await vault.projects(1n)).currentMilestone === 2n, "Milestone 2 verified");

  await (vault.connect(founder) as any).requestRelease(1n);
  ok((await vault.projects(1n)).releaseRequestedAt > 0n, "Release requested for milestone 2");

  const treasuryBefore: bigint = await usdc.balanceOf(treasury.address);
  await (vault.connect(investor1) as any).approveRelease(1n);
  const released = (await usdc.balanceOf(treasury.address) as bigint) - treasuryBefore;
  ok(released > 0n, `Milestone 2 released early after 30% approval: ${fmt6(released)} USDC to treasury`);
  ok((await vault.projects(1n)).releaseRequestedAt === 0n, "Release request closed automatically after approval threshold");

  /* ══════════════════════════════════════════════════════
   * 6. VETO FLOW (30% stake threshold)
   * ══════════════════════════════════════════════════════ */
  console.log("\n► [6] Veto flow…");

  await (vault.connect(founder) as any).verifyNextMilestone(1n);
  ok((await vault.projects(1n)).currentMilestone === 3n, "Milestone 3 verified");

  await (vault.connect(founder) as any).requestRelease(1n);
  // investor1 = 400 USDC commit / 1000 total = 40% ≥ 30% threshold → veto
  await (vault.connect(investor1) as any).veto(1n);
  ok((await vault.projects(1n)).releaseVetoed, "Veto triggered (40% stake ≥ 30% threshold)");

  let vetoRejected = false;
  try {
    await mine(3 * 86400 + 60);
    await (vault.connect(stranger) as any).executeRelease(1n);
  } catch { vetoRejected = true; }
  ok(vetoRejected, "executeRelease blocked while vetoed");

  await (vault.connect(treasury) as any).clearVeto(1n);
  ok(!(await vault.projects(1n)).releaseVetoed, "Veto cleared by treasury");

  /* ══════════════════════════════════════════════════════
   * 7. REFUND FLOW
   * ══════════════════════════════════════════════════════ */
  console.log("\n► [7] Refund flow…");

  let investUnapprovedFailed = false;
  try {
    await (usdc.connect(investor1) as any).approve(VAULT, U6(100));
    await (vault.connect(investor1) as any).invest(3n, U6(100), "0x");
  } catch { investUnapprovedFailed = true; }
  ok(investUnapprovedFailed, "Invest blocked on unapproved project");

  await vault.approveProject(3n);
  await (usdc.connect(investor1) as any).approve(VAULT, U6(200));
  await (vault.connect(investor1) as any).invest(3n, U6(200), "0x");
  ok((await vault.projects(3n)).totalRaised === U6(200), "Invested 200 USDC in Project C");

  await mine(31 * 86400); // mine past 30-day Project C deadline

  const inv1Before: bigint = await usdc.balanceOf(investor1.address);
  await (vault.connect(investor1) as any).refund(3n);
  const inv1After: bigint = await usdc.balanceOf(investor1.address);
  ok(inv1After > inv1Before, `Refund received: ${fmt6(inv1After - inv1Before)} USDC`);
  ok((await commit.balanceOf(investor1.address, 3n) as bigint) === 0n, "CommitTokens burned after refund");

  /* ══════════════════════════════════════════════════════
   * 8. YIELD FARMING
   * ══════════════════════════════════════════════════════ */
  console.log("\n► [8] Yield farming (seeded MockLender yield)…");

  const seededYield = U6(5);
  await (usdc.connect(deployer) as any).approve(LENDER, seededYield);
  await (lender.connect(deployer) as any).addYield(seededYield);
  const lenderBal: bigint = await lender.balance();
  const tvl = (await vault.totalRaised() as bigint)
            - (await vault.totalReleasedGlobal() as bigint)
            - (await vault.totalAmmSeededGlobal() as bigint);
  const accrued = lenderBal > tvl ? lenderBal - tvl : 0n;
  ok(accrued >= seededYield, `Lender seeded yield: ${fmt6(accrued)} USDC`);

  await vault.harvestYield();
  const yieldIdx: bigint = await vault.yieldIndex();
  ok(yieldIdx > ethers.parseUnits("1", 18), `Yield index increased: ${yieldIdx}`);

  const p1: bigint = await vault.pendingYield(investor1.address);
  const p2: bigint = await vault.pendingYield(investor2.address);
  ok(p1 > 0n, `investor1 pending yield: ${fmt6(p1)} USDC`);
  ok(p2 > 0n, `investor2 pending yield: ${fmt6(p2)} USDC`);

  const inv2Before: bigint = await usdc.balanceOf(investor2.address);
  await (vault.connect(investor2) as any).claimYield();
  const inv2Claimed = (await usdc.balanceOf(investor2.address) as bigint) - inv2Before;
  ok(inv2Claimed > 0n, `investor2 claimed yield: ${fmt6(inv2Claimed)} USDC`);

  /* ══════════════════════════════════════════════════════
   * 9. AMM SWAP (buy & sell CommitToken)
   * ══════════════════════════════════════════════════════ */
  console.log("\n► [9] AMM swap…");

  const rUsdc:   bigint = await amm.poolUsdc(1n);
  const rCommit: bigint = await amm.poolCommit(1n);
  ok(rUsdc > 0n && rCommit > 0n, `AMM reserves — USDC: ${fmt6(rUsdc)}, Commit: ${fmt6(rCommit)}`);

  // BUY: investor1 swaps 50 USDC for CommitTokens
  const cbBefore: bigint = await commit.balanceOf(investor1.address, 1n);
  const swapIn = U6(50);
  const minOut: bigint = await amm.getAmountOut(swapIn, rUsdc, rCommit);
  await (usdc.connect(investor1) as any).approve(AMM, swapIn);
  await (amm.connect(investor1) as any).swapUsdcForCommit(1n, swapIn, (minOut * 95n) / 100n);
  const cbAfter: bigint = await commit.balanceOf(investor1.address, 1n);
  ok(cbAfter > cbBefore, `AMM BUY: received ${fmt6(cbAfter - cbBefore)} CommitTokens`);

  // SELL: investor1 sells half back
  const toSell = (cbAfter - cbBefore) / 2n;
  if (toSell > 0n) {
    const rU2: bigint = await amm.poolUsdc(1n);
    const rC2: bigint = await amm.poolCommit(1n);
    const uOut: bigint = await amm.getAmountOut(toSell, rC2, rU2);
    const ubBefore: bigint = await usdc.balanceOf(investor1.address);
    await (commit.connect(investor1) as any).setApprovalForAll(AMM, true);
    await (amm.connect(investor1) as any).swapCommitForUsdc(1n, toSell, (uOut * 95n) / 100n);
    const ubAfter: bigint = await usdc.balanceOf(investor1.address);
    ok(ubAfter > ubBefore, `AMM SELL: received ${fmt6(ubAfter - ubBefore)} USDC`);
  }

  /* ══════════════════════════════════════════════════════
   * 10. REVENUE ROUTER (release fee)
   * ══════════════════════════════════════════════════════ */
  console.log("\n► [10] Revenue router (release fee)…");

  // Milestone 3 release (veto was cleared earlier)
  await (vault.connect(founder) as any).requestRelease(1n);
  await mine(3 * 86400 + 60);
  await (vault.connect(stranger) as any).executeRelease(1n);
  ok(true, "Milestone 3 released — revenue router received fee without revert");

  /* ══════════════════════════════════════════════════════
   * 11. WORLDID ADAPTER — malformed proof rejection
   * ══════════════════════════════════════════════════════ */
  console.log("\n► [11] WorldIDVerifierAdapter — malformed proof rejection…");

  const wiaC    = await ethers.getContractFactory("WorldIDVerifierAdapter");
  const dummyWR = ethers.Wallet.createRandom().address;
  const adapter = (await (await wiaC.deploy(dummyWR, "app_test", "invest")).waitForDeployment()) as any;

  let adapterRejected = false;
  try {
    await adapter.verify(investor1.address, ethers.toUtf8Bytes("not_a_real_proof"));
  } catch { adapterRejected = true; }
  ok(adapterRejected, "WorldIDVerifierAdapter reverts on malformed proof (expected)");

  /* ══════════════════════════════════════════════════════
   * 12. ADMIN TRANSFER (two-step)
   * ══════════════════════════════════════════════════════ */
  console.log("\n► [12] Admin transfer (two-step)…");

  await vault.transferAdmin(stranger.address);
  ok((await vault.pendingAdmin()) === stranger.address, "Pending admin set");

  let wrongAccept = false;
  try { await (vault.connect(investor1) as any).acceptAdmin(); } catch { wrongAccept = true; }
  ok(wrongAccept, "acceptAdmin rejected for non-pending admin");

  await (vault.connect(stranger) as any).acceptAdmin();
  ok((await vault.admin()) === stranger.address, "Admin transferred to stranger");

  await (vault.connect(stranger) as any).transferAdmin(deployer.address);
  await (vault.connect(deployer) as any).acceptAdmin();
  ok((await vault.admin()) === deployer.address, "Admin transferred back to deployer");

  /* ══════════════════════════════════════════════════════
   * SUMMARY
   * ══════════════════════════════════════════════════════ */
  console.log("\n══════════════════════════════════════════════════════");
  console.log("  ✅ ALL TESTS PASSED");
  console.log("══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n❌ TEST FAILED:", err.message ?? err);
  process.exit(1);
});
