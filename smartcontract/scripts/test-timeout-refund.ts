import { network } from "hardhat";

const USDC = 1_000_000n;
const DAY = 86_400;

async function main() {
  const { ethers, networkName } = await network.connect();
  console.log("Network:", networkName);

  const [admin, backer, treasury] = await ethers.getSigners();
  const mine = async (seconds: number) => {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  };

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const CommitmentToken = await ethers.getContractFactory("CommitmentToken");
  const commit = await CommitmentToken.deploy(admin.address, "Nest Token", "NST");
  await commit.waitForDeployment();

  const MockLender = await ethers.getContractFactory("MockLender");
  const lender = await MockLender.deploy(await usdc.getAddress());
  await lender.waitForDeployment();

  const Vault = await ethers.getContractFactory("CrowdVault");
  const vault = await Vault.deploy(await usdc.getAddress(), await commit.getAddress());
  await vault.waitForDeployment();

  await (await commit.setMinter(await vault.getAddress())).wait();
  await (await vault.setLender(await lender.getAddress())).wait();

  const goal = 10n * USDC;
  await (await usdc.mint(backer.address, goal)).wait();

  await (
    await vault.createProject(
      treasury.address,
      2,
      "Timeout Refund Project",
      "Local timeout/refund test project",
      "",
      "",
      goal,
      0,
      7 * DAY,
    )
  ).wait();
  await (await vault.approveProject(1)).wait();

  await (await (usdc.connect(backer) as typeof usdc).approve(await vault.getAddress(), goal)).wait();
  await (await (vault.connect(backer) as typeof vault).invest(1, goal, "0x")).wait();

  await mine(8 * DAY);
  await (await (vault.connect(backer) as typeof vault).triggerMilestoneTimeout(1)).wait();
  await (await (vault.connect(backer) as typeof vault).voteTimeout(1, true)).wait();
  await mine(3 * DAY + 60);
  await (await vault.executeTimeoutOutcome(1)).wait();

  if (await vault.hasVotedTimeout(1, backer.address)) {
    throw new Error("Timeout voter state did not reset after extension.");
  }

  await mine(8 * DAY);
  await (await (vault.connect(backer) as typeof vault).triggerMilestoneTimeout(1)).wait();
  await (await (vault.connect(backer) as typeof vault).voteTimeout(1, false)).wait();
  await mine(3 * DAY + 60);
  await (await vault.executeTimeoutOutcome(1)).wait();

  const project = await vault.projects(1);
  if (!project.projectDead) throw new Error("Project should be dead after refund vote wins.");

  const before = await usdc.balanceOf(backer.address);
  await (await (vault.connect(backer) as typeof vault).claimTimeoutRefund(1)).wait();
  const after = await usdc.balanceOf(backer.address);
  const refunded = after - before;

  console.log("Refunded:", ethers.formatUnits(refunded, 6), "USDC");
  if (refunded !== goal / 2n) {
    throw new Error(`Expected refund of ${ethers.formatUnits(goal / 2n, 6)} USDC.`);
  }

  const tokenBal = await commit.balanceOf(backer.address, 1);
  if (tokenBal !== 0n) throw new Error("CommitTokens should be burned after timeout refund.");

  console.log("Timeout refund smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
