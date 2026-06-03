import { network } from "hardhat";
import { ADDR } from "./addresses.js";

const USDC_DECIMALS = 6n;

function parseUsdc(value: string): bigint {
  const [whole, fraction = ""] = value.trim().split(".");
  const paddedFraction = fraction.padEnd(Number(USDC_DECIMALS), "0").slice(0, Number(USDC_DECIMALS));
  return BigInt(whole || "0") * 10n ** USDC_DECIMALS + BigInt(paddedFraction || "0");
}

async function main() {
  const amountInput = process.env.SEED_YIELD_USDC?.trim();

  if (!amountInput) {
    throw new Error(
      "Nothing to do. Examples:\n" +
      "  SEED_YIELD_USDC=0.01 npm run seed:yield",
    );
  }

  const directYieldAmount = parseUsdc(amountInput);
  if (amountInput && directYieldAmount <= 0n) throw new Error("SEED_YIELD_USDC must be greater than 0.");

  const { ethers, networkName } = await network.connect();
  const [sender] = await ethers.getSigners();
  const vault = await ethers.getContractAt("CrowdVault", ADDR.VAULT);
  const lender = await vault.lender();
  const investor = process.env.YIELD_TEST_INVESTOR?.trim();

  if (lender === ethers.ZeroAddress) {
    throw new Error("Vault has no lender connected.");
  }

  const usdc = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function approve(address,uint256) returns (bool)",
    ],
    ADDR.USDC,
  );
  const lenderContract = await ethers.getContractAt(
    [
      "function addYield()",
      "function YIELD_AMOUNT() view returns (uint256)",
      "function accruedYield() view returns (uint256)",
    ],
    lender,
  );

  console.log("Network:", networkName);
  console.log("Sender:", sender.address);
  console.log("Lender:", lender);
  console.log("Current accrued yield:", ethers.formatUnits(await lenderContract.accruedYield(), 6), "USDC");

  const balance = await usdc.balanceOf(sender.address);
  if (balance < directYieldAmount) {
    throw new Error(`Not enough USDC. Sender has ${ethers.formatUnits(balance, 6)} USDC.`);
  }

  const contractYieldAmount = await lenderContract.YIELD_AMOUNT();
  if (directYieldAmount !== contractYieldAmount) {
    throw new Error(`MockLender uses a fixed yield amount of ${ethers.formatUnits(contractYieldAmount, 6)} USDC.`);
  }
  console.log("Seeding direct yield:", ethers.formatUnits(contractYieldAmount, 6), "USDC");
  await (await usdc.approve(lender, contractYieldAmount)).wait();
  await (await lenderContract.addYield()).wait();
  console.log("Direct yield added to lender.");

  try {
    await (await vault.harvestYield()).wait();
    console.log("Yield harvested into vault index.");
  } catch (e: any) {
    if (e?.message?.includes("yield")) {
      console.log("Skipped harvestYield: lender accruedYield is less than requested amount (vault may have no projects yet).");
    } else {
      throw e;
    }
  }
  console.log("Remaining accrued yield:", ethers.formatUnits(await lenderContract.accruedYield(), 6), "USDC");

  if (investor) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(investor)) {
      throw new Error("YIELD_TEST_INVESTOR must be a valid address.");
    }
    const pending = await vault.pendingYield(investor);
    const stored = await vault.claimableYield(investor);
    console.log("Investor:", investor);
    console.log("Stored claimable:", ethers.formatUnits(stored, 6), "USDC");
    console.log("Pending claimable:", ethers.formatUnits(pending, 6), "USDC");
    console.log("Investor can now claim from the Portfolio page or by calling CrowdVault.claimYield().");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
