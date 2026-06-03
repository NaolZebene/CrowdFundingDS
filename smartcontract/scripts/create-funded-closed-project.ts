import { network } from "hardhat";
import { ADDR } from "./addresses.js";

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
] as const;

function envBigInt(name: string, fallback: bigint): bigint {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new Error(`${name} must be greater than zero.`);
  return parsed;
}

async function main() {
  const { ethers, networkName } = await network.connect();
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();

  const goalUsdc = process.env.TEST_PROJECT_GOAL_USDC ?? "5";
  const goal = ethers.parseUnits(goalUsdc, 6);
  const milestones = envBigInt("TEST_PROJECT_MILESTONES", 3n);
  const treasury = process.env.TEST_PROJECT_TREASURY?.trim() || ADDR.TREASURY;

  console.log("Network:", networkName);
  console.log("Vault:", ADDR.VAULT);
  console.log("AMM:", ADDR.AMM_ADDR);
  console.log("Founder/backer:", deployerAddr);
  console.log("Goal:", goalUsdc, "USDC");

  const usdc = await ethers.getContractAt(ERC20_ABI, ADDR.USDC);
  const vault = await ethers.getContractAt("CrowdVault", ADDR.VAULT);
  const amm = await ethers.getContractAt("CommitmentAMM", ADDR.AMM_ADDR);

  if ((await vault.amm()).toLowerCase() !== ADDR.AMM_ADDR.toLowerCase()) {
    await (await vault.setAMM(ADDR.AMM_ADDR)).wait();
    console.log("Vault AMM wired:", ADDR.AMM_ADDR);
  }

  const balance = await usdc.balanceOf(deployerAddr);
  if (balance < goal) {
    throw new Error(
      `Deployer needs at least ${goalUsdc} Sepolia USDC. Current balance: ${ethers.formatUnits(balance, 6)} USDC.`,
    );
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const createTx = await vault.createProject(
    treasury,
    milestones,
    process.env.TEST_PROJECT_NAME ?? "AMM Test Market",
    process.env.TEST_PROJECT_DESCRIPTION ?? "Funded and closed test project for AMM trading.",
    process.env.TEST_PROJECT_FILES ?? "https://example.com/test-market-files",
    process.env.TEST_PROJECT_ICON ?? "",
    process.env.TEST_PROJECT_METADATA ?? "ipfs://amm-test-market",
    goal,
    deadline,
    0,  // default 60-day milestone window
  );
  const createReceipt = await createTx.wait();
  const created = createReceipt?.logs
    .map((log: { topics: readonly string[]; data: string }) => {
      try {
        return vault.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((log: { name?: string } | null) => log?.name === "ProjectCreated");

  const projectId = created?.args?.projectId ?? await vault.projectCount();
  console.log("Created project:", projectId.toString());

  await (await vault.approveProject(projectId)).wait();
  console.log("Approved project:", projectId.toString());

  const allowance = await usdc.allowance(deployerAddr, ADDR.VAULT);
  if (allowance < goal) {
    await (await usdc.approve(ADDR.VAULT, goal)).wait();
    console.log("Approved vault USDC spend:", goalUsdc);
  }

  await (await vault.invest(projectId, goal, "0x")).wait();
  console.log("Funded project to goal. First milestone released and AMM auto-seed attempted.");

  if (!(await amm.seeded(projectId))) {
    await (await vault.seedAmmPool(projectId)).wait();
    console.log("Triggered permissionless AMM seed.");
  }

  console.log("AMM seeded:", await amm.seeded(projectId));
  console.log("Pool USDC:", ethers.formatUnits(await amm.poolUsdc(projectId), 6));
  console.log("Pool COMMIT:", ethers.formatUnits(await amm.poolCommit(projectId), 6));
  console.log("Ready for /amm.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
