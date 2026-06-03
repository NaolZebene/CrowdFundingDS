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

  const [admin, backer, trader, treasury] = await ethers.getSigners();
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

  const goal = 10n * USDC;
  await (
    await vault.createProject(
      treasury.address,
      2,
      "AMM Ready Project",
      "Local funded and auto-seeded AMM test project",
      "",
      "",
      "",
      goal,
      BigInt(Math.floor(Date.now() / 1000) + 60),
      0,  // default 60-day milestone window
    )
  ).wait();
  await (await vault.approveProject(1)).wait();

  await (await (usdc.connect(backer) as typeof usdc).approve(await vault.getAddress(), goal)).wait();
  await (await (vault.connect(backer) as typeof vault).invest(1, goal, "0x")).wait();
  await mine(120);
  await (await vault.claimInitialMilestoneRelease(1)).wait();

  const seeded = await amm.seeded(1);
  const ready = await vault.ammProjectReady(1);
  const poolUsdc = await amm.poolUsdc(1);
  const poolCommit = await amm.poolCommit(1);

  console.log("Project ready:", ready);
  console.log("AMM seeded:", seeded);
  console.log("Pool USDC:", ethers.formatUnits(poolUsdc, 6));
  console.log("Pool COMMIT:", ethers.formatUnits(poolCommit, 6));

  if (!ready || !seeded || poolUsdc === 0n || poolCommit === 0n) {
    throw new Error("AMM-ready project was not seeded correctly.");
  }

  const buyAmount = 1n * USDC;
  await (await (usdc.connect(trader) as typeof usdc).approve(await amm.getAddress(), buyAmount)).wait();
  const commitBefore = await commit.balanceOf(trader.address, 1);
  await (await (amm.connect(trader) as typeof amm).swapUsdcForCommit(1, buyAmount, 1n)).wait();
  const commitAfter = await commit.balanceOf(trader.address, 1);

  console.log("Trader received:", ethers.formatUnits(commitAfter - commitBefore, 6), "COMMIT");
  console.log("AMM-ready project smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
