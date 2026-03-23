import { network } from "hardhat";

async function main() {
  const { ethers, networkName } = await network.connect();
  console.log("Network:", networkName);

  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  console.log("Deployer:", deployerAddr);

  // 1) MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const USDC = await usdc.getAddress();
  console.log("MockUSDC:", USDC);

  // 2) Treasury recipient (single-owner wallet)
  // Use the deployer EOA directly so OWNER2/OWNER3 are not required.
  const TREASURY = deployerAddr;
  console.log("Treasury (EOA):", TREASURY);

  // 3) CommitmentToken
  const CommitmentToken = await ethers.getContractFactory("CommitmentToken");
  const commit = await CommitmentToken.deploy(deployerAddr, "Nest Token", "NST");
  await commit.waitForDeployment();
  const COMMIT = await commit.getAddress();
  console.log("CommitmentToken:", COMMIT);

  // 4) MockLender
  const MockLender = await ethers.getContractFactory("MockLender");
  const lender = await MockLender.deploy(USDC);
  await lender.waitForDeployment();
  const LENDER = await lender.getAddress();
  console.log("MockLender:", LENDER);

  // 5) MockProgressOracle
  const Oracle = await ethers.getContractFactory("MockProgressOracle");
  const oracle = await Oracle.deploy();
  await oracle.waitForDeployment();
  const ORACLE = await oracle.getAddress();
  console.log("MockProgressOracle:", ORACLE);

  // 6) MockZKVerifier
  const ZK = await ethers.getContractFactory("MockZKVerifier");
  const zk = await ZK.deploy();
  await zk.waitForDeployment();
  const ZKVER = await zk.getAddress();
  console.log("MockZKVerifier:", ZKVER);

  // 7) CrowdVault
  const Vault = await ethers.getContractFactory("CrowdVault");
  const vault = await Vault.deploy(USDC, COMMIT);
  await vault.waitForDeployment();
  const VAULT = await vault.getAddress();
  console.log("CrowdVault:", VAULT);

  // 8) RevenueRouter
  const Router = await ethers.getContractFactory("RevenueRouter");
  const router = await Router.deploy(USDC, TREASURY, 1000); // 10% to backers
  await router.waitForDeployment();
  const ROUTER = await router.getAddress();
  console.log("RevenueRouter:", ROUTER);

  // 9) CommitmentAMM — now requires vault address
  const AMM = await ethers.getContractFactory("CommitmentAMM");
  const amm = await AMM.deploy(USDC, COMMIT, VAULT);
  await amm.waitForDeployment();
  const AMM_ADDR = await amm.getAddress();
  console.log("CommitmentAMM:", AMM_ADDR);

  // wire commit minter to vault
  await (await commit.setMinter(VAULT)).wait();
  console.log("CommitmentToken minter set to vault");

  // wire vault modules
  await (await vault.setLender(LENDER)).wait();
  await (await vault.setOracle(ORACLE)).wait();
  await (await vault.addZK(ZKVER)).wait();             // addZK (not setZk)
  await (await vault.setRevenueRouter(ROUTER)).wait(); // wire revenue router
  await (await vault.setReleaseFeeBps(100)).wait();    // 1% release fee
  console.log("Vault modules wired");

  // create first demo project — caller is founder (msg.sender)
  const fundingDeadline = 0; // use default (30 days)
  const tx = await vault.createProject(
    TREASURY,   // treasury
    3,          // milestoneCount
    "Demo Project",
    "Demo on-chain project description",
    "https://example.com/files",
    "ipfs://demo-project-metadata",
    10_000n * 1_000_000n, // fundingGoal: 10,000 USDC
    fundingDeadline
  );
  await tx.wait();
  console.log("Created demo project 1 (treasury:", TREASURY, ", milestones: 3)");

  // approve the project so backers can invest
  await (await vault.approveProject(1)).wait();
  console.log("Project 1 approved");

  // mint demo USDC to deployer
  await (await usdc.mint(deployerAddr, 20_000n * 1_000_000n)).wait();
  console.log("Minted 20,000 USDC to deployer");

  console.log("\n=== SAVE THESE ADDRESSES ===");
  console.log({
    USDC,
    TREASURY,
    COMMIT,
    LENDER,
    ORACLE,
    ZKVER,
    VAULT,
    ROUTER,
    AMM_ADDR,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
