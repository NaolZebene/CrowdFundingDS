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

  const [admin, backer, treasury] = await ethers.getSigners();

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

  await (await router.setVault(await vault.getAddress())).wait();
  await (await commit.setMinter(await vault.getAddress())).wait();
  await (await lender.setWithdrawer(await vault.getAddress())).wait();
  await (await vault.setLender(await lender.getAddress())).wait();

  await (
    await vault.createProject(
      treasury.address,
      2,
      "Yield Test Project",
      "Local test project",
      "",
      "",
      "",
      100n * USDC,
      0,
      0,  // default 60-day milestone window
    )
  ).wait();
  await (await vault.approveProject(1)).wait();

  await (await (usdc.connect(backer) as typeof usdc).approve(await vault.getAddress(), 50n * USDC)).wait();
  await (await (vault.connect(backer) as typeof vault).invest(1, 50n * USDC, "0x")).wait();

  const seedYieldAmount = await lender.YIELD_AMOUNT();
  await (await usdc.approve(await lender.getAddress(), seedYieldAmount)).wait();
  await (await lender.addYield()).wait();
  await (await vault.harvestYield()).wait();

  const storedClaimable = await vault.claimableYield(backer.address);
  const pending = await vault.pendingYield(backer.address);
  console.log("Stored claimable before claim:", ethers.formatUnits(storedClaimable, 6), "USDC");
  console.log("Pending before claim:", ethers.formatUnits(pending, 6), "USDC");
  if (pending === 0n) throw new Error("Backer should have pending yield after harvest.");

  const before = await usdc.balanceOf(backer.address);
  await (await (vault.connect(backer) as typeof vault).claimYield()).wait();
  const after = await usdc.balanceOf(backer.address);

  console.log("Claimed:", ethers.formatUnits(after - before, 6), "USDC");
  console.log("Claim yield smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
