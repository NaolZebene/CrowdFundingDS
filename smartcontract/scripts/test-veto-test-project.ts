import { network } from "hardhat";

const USDC = 1_000_000n;
const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
] as const;

async function main() {
  const { ethers, networkName } = await network.connect();
  console.log("Network:", networkName);

  const [admin, founder, shareholder, treasury] = await ethers.getSigners();
  const mine = async (seconds: number) => {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  };

  const usdc = await ethers.getContractAt(ERC20_ABI, SEPOLIA_USDC);

  const CommitmentToken = await ethers.getContractFactory("CommitmentToken");
  const commit = await CommitmentToken.deploy(admin.address, "Nest Token", "NST");
  await commit.waitForDeployment();

  const MockLender = await ethers.getContractFactory("MockLender");
  const lender = await MockLender.deploy(SEPOLIA_USDC);
  await lender.waitForDeployment();

  const RevenueRouter = await ethers.getContractFactory("RevenueRouter");
  const router = await RevenueRouter.deploy(SEPOLIA_USDC);
  await router.waitForDeployment();

  const Vault = await ethers.getContractFactory("CrowdVault");
  const vault = await Vault.deploy(
    SEPOLIA_USDC,
    await commit.getAddress(),
    await router.getAddress()
  );
  await vault.waitForDeployment();

  const AMM = await ethers.getContractFactory("CommitmentAMM");
  const amm = await AMM.deploy(SEPOLIA_USDC, await commit.getAddress(), await vault.getAddress());
  await amm.waitForDeployment();

  await (await router.setVault(await vault.getAddress())).wait();
  await (await commit.setMinter(await vault.getAddress())).wait();
  await (await lender.setWithdrawer(await vault.getAddress())).wait();
  await (await vault.setLender(await lender.getAddress())).wait();
  await (await vault.setAMM(await amm.getAddress())).wait();

  const goal = 6n * USDC;

  await (
    await (vault.connect(founder) as typeof vault).createProject(
      treasury.address,
      3,
      "Veto Local Test",
      "Funded project ready for milestone veto testing",
      "",
      "",
      "",
      goal,
      BigInt(Math.floor(Date.now() / 1000) + 60),
      0,  // default 60-day milestone window
    )
  ).wait();
  await (await vault.approveProject(1)).wait();

  await (await (usdc.connect(founder) as typeof usdc).approve(await vault.getAddress(), goal)).wait();
  await (await (vault.connect(founder) as typeof vault).invest(1, goal, "0x")).wait();
  await mine(120);
  await (await (vault.connect(founder) as typeof vault).claimInitialMilestoneRelease(1)).wait();

  const voterStake = (goal * 4000n) / 10_000n;
  await (await (commit.connect(founder) as typeof commit).safeTransferFrom(founder.address, shareholder.address, 1, voterStake, "0x")).wait();

  await (await (vault.connect(founder) as typeof vault).verifyNextMilestone(1)).wait();
  await (await (vault.connect(founder) as typeof vault).requestRelease(1)).wait();
  await (await (vault.connect(shareholder) as typeof vault).veto(1)).wait();

  const project = await vault.projects(1);
  const vetoVotes = await vault.vetoVotes(1);

  console.log("Current milestone:", project.currentMilestone.toString());
  console.log("Release requested at:", project.releaseRequestedAt.toString());
  console.log("Veto votes:", ethers.formatUnits(vetoVotes, 6));
  console.log("Release vetoed:", project.releaseVetoed);

  if (project.currentMilestone !== 2n) throw new Error("Project should be on milestone 2.");
  if (project.releaseRequestedAt === 0n) throw new Error("Release request should be active.");
  if (!project.releaseVetoed) throw new Error("Shareholder veto should have crossed threshold.");

  console.log("Veto test project smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
