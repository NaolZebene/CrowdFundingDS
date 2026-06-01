import { network } from "hardhat";
import { ADDR } from "./addresses.js";

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
] as const;

function envBool(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === "true" || value === "1" || value === "yes";
}

function envBigInt(name: string, fallback: bigint): bigint {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new Error(`${name} must be greater than zero.`);
  return parsed;
}

async function main() {
  const { ethers, networkName } = await network.connect();
  const [founder] = await ethers.getSigners();
  const founderAddr = await founder.getAddress();

  const goalUsdc = process.env.VETO_TEST_GOAL_USDC ?? "6";
  const goal = ethers.parseUnits(goalUsdc, 6);
  const milestones = envBigInt("VETO_TEST_MILESTONES", 3n);
  if (milestones < 2n) throw new Error("VETO_TEST_MILESTONES must be at least 2.");

  const treasury = process.env.VETO_TEST_TREASURY?.trim() || founderAddr;
  const shareholder = process.env.VETO_TEST_SHAREHOLDER?.trim();
  const shareholderStakeBps = envBigInt("VETO_TEST_SHAREHOLDER_BPS", 4000n);
  const autoOpenSecondMilestone = envBool("VETO_TEST_OPEN_RELEASE", false);

  console.log("Network:", networkName);
  console.log("Vault:", ADDR.VAULT);
  console.log("Founder:", founderAddr);
  console.log("Treasury:", treasury);
  console.log("Goal:", goalUsdc, "USDC");
  console.log("Milestones:", milestones.toString());

  const usdc = await ethers.getContractAt(ERC20_ABI, ADDR.USDC);
  const vault = await ethers.getContractAt("CrowdVault", ADDR.VAULT);
  const commit = await ethers.getContractAt("CommitmentToken", ADDR.COMMIT);

  if ((await vault.amm()).toLowerCase() !== ADDR.AMM_ADDR.toLowerCase()) {
    await (await vault.setAMM(ADDR.AMM_ADDR)).wait();
    console.log("Vault AMM wired:", ADDR.AMM_ADDR);
  }

  const balance = await usdc.balanceOf(founderAddr);
  if (balance < goal) {
    throw new Error(
      `Founder needs at least ${goalUsdc} Sepolia USDC. Current balance: ${ethers.formatUnits(balance, 6)} USDC.`,
    );
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const createTx = await vault.createProject(
    treasury,
    milestones,
    process.env.VETO_TEST_NAME ?? "Veto Milestone Test Project",
    process.env.VETO_TEST_DESCRIPTION ?? "Funded project for testing milestone release requests and shareholder veto voting.",
    process.env.VETO_TEST_FILES ?? "https://example.com/veto-test-files",
    process.env.VETO_TEST_METADATA ?? "ipfs://veto-milestone-test",
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

  const allowance = await usdc.allowance(founderAddr, ADDR.VAULT);
  if (allowance < goal) {
    await (await usdc.approve(ADDR.VAULT, goal)).wait();
    console.log("Approved vault USDC spend:", goalUsdc);
  }

  await (await vault.invest(projectId, goal, "0x")).wait();
  console.log("Funded to goal. Milestone 1 was released automatically.");

  if (shareholder && shareholder.toLowerCase() !== founderAddr.toLowerCase()) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(shareholder)) {
      throw new Error("VETO_TEST_SHAREHOLDER must be a valid address.");
    }
    const stake = (goal * shareholderStakeBps) / 10_000n;
    await (await commit.safeTransferFrom(founderAddr, shareholder, projectId, stake, "0x")).wait();
    console.log(
      "Transferred shareholder veto stake:",
      ethers.formatUnits(stake, 6),
      "COMMIT to",
      shareholder,
    );
  } else {
    console.log("No separate VETO_TEST_SHAREHOLDER set. Founder wallet keeps the CommitTokens.");
  }

  if (autoOpenSecondMilestone) {
    await (await vault.verifyNextMilestone(projectId)).wait();
    await (await vault.requestRelease(projectId)).wait();
    console.log("Opened milestone 2 release request. Shareholders can veto for the next 3 days.");
  } else {
    console.log("Ready for founder flow: verifyNextMilestone(projectId), then requestRelease(projectId).");
  }

  const project = await vault.projects(projectId);
  console.log("Project state:");
  console.log("  id:", projectId.toString());
  console.log("  currentMilestone:", project.currentMilestone.toString());
  console.log("  totalRaised:", ethers.formatUnits(project.totalRaised, 6), "USDC");
  console.log("  totalReleased:", ethers.formatUnits(project.totalReleased, 6), "USDC");
  console.log("  releasable:", ethers.formatUnits(await vault.releasable(projectId), 6), "USDC");
  console.log("  releaseRequestedAt:", project.releaseRequestedAt.toString());
  console.log("  releaseVetoed:", project.releaseVetoed);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
