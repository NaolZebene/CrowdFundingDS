import { network } from "hardhat";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

async function main() {
  const { ethers, networkName } = await network.connect();
  console.log("Network:", networkName);

  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  console.log("Deployer:", deployerAddr);

  const owner2 = requiredEnv("OWNER2");
  const owner3 = requiredEnv("OWNER3");
  console.log("Multisig owner2:", owner2);
  console.log("Multisig owner3:", owner3);

  // 1) MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const USDC = await usdc.getAddress();
  console.log("MockUSDC:", USDC);

  // 2) TreasuryMultiSigV2 (2-of-3)
  const TreasuryV2 = await ethers.getContractFactory("TreasuryMultiSigV2");
  const owners = [deployerAddr, owner2, owner3];
  const treasury = await TreasuryV2.deploy(owners, 2);
  await treasury.waitForDeployment();
  const TREASURY = await treasury.getAddress();
  console.log("TreasuryMultiSigV2:", TREASURY);

  // 3) Commitment token (minter = deployer temporarily)
  const CommitmentToken = await ethers.getContractFactory("CommitmentToken");
  const commit = await CommitmentToken.deploy(deployerAddr);
  await commit.waitForDeployment();
  const COMMIT = await commit.getAddress();
  console.log("CommitmentToken:", COMMIT);

  // 4) Lender mock
  const MockLender = await ethers.getContractFactory("MockLender");
  const lender = await MockLender.deploy(USDC);
  await lender.waitForDeployment();
  const LENDER = await lender.getAddress();
  console.log("MockLender:", LENDER);

  // 5) Oracle mock
  const Oracle = await ethers.getContractFactory("MockProgressOracle");
  const oracle = await Oracle.deploy();
  await oracle.waitForDeployment();
  const ORACLE = await oracle.getAddress();
  console.log("MockProgressOracle:", ORACLE);

  // 6) ZK mock
  const ZK = await ethers.getContractFactory("MockZKVerifier");
  const zk = await ZK.deploy();
  await zk.waitForDeployment();
  const ZKVER = await zk.getAddress();
  console.log("MockZKVerifier:", ZKVER);

  // 7) Vault (treasury = multisig V2)
  const milestoneCount = 5;
  const Vault = await ethers.getContractFactory("CrowdVault");
  const vault = await Vault.deploy(USDC, TREASURY, COMMIT, milestoneCount);
  await vault.waitForDeployment();
  const VAULT = await vault.getAddress();
  console.log("CrowdVault:", VAULT);

  // set commit minter to vault
  await (await commit.setMinter(VAULT)).wait();

  // wire modules
  await (await vault.setLender(LENDER)).wait();
  await (await vault.setOracle(ORACLE)).wait();
  await (await vault.setZk(ZKVER)).wait();

  // 8) AMM
  const AMM = await ethers.getContractFactory("CommitmentAMM");
  const amm = await AMM.deploy(USDC, COMMIT);
  await amm.waitForDeployment();
  const AMM_ADDR = await amm.getAddress();
  console.log("CommitmentAMM:", AMM_ADDR);

  // 9) Revenue router
  const Router = await ethers.getContractFactory("RevenueRouter");
  const router = await Router.deploy(USDC, TREASURY, 1000);
  await router.waitForDeployment();
  const ROUTER = await router.getAddress();
  console.log("RevenueRouter:", ROUTER);

  // Mint demo USDC
  await (await usdc.mint(deployerAddr, 20_000n * 1_000_000n)).wait();
  console.log("Minted 20,000 mUSDC to deployer");

  console.log("\n=== SAVE THESE ADDRESSES ===");
  console.log({
    USDC,
    TREASURY,
    COMMIT,
    LENDER,
    ORACLE,
    ZKVER,
    VAULT,
    AMM_ADDR,
    ROUTER
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});