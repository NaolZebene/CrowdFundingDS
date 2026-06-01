import { network } from "hardhat";

const USDC = 1_000_000n;

async function main() {
  const { ethers, networkName } = await network.connect();
  console.log("Network:", networkName);

  const [admin, backer, treasury] = await ethers.getSigners();

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

  await (await usdc.mint(backer.address, 100n * USDC)).wait();
  await (await usdc.mint(admin.address, 10n * USDC)).wait();

  await (
    await vault.createProject(
      treasury.address,
      2,
      "Yield Test Project",
      "Local test project",
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

  await (await usdc.approve(await lender.getAddress(), 5n * USDC)).wait();
  await (await lender.fundReserve(5n * USDC)).wait();
  await (await lender.dripReserveYield()).wait();
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
