import { network } from "hardhat";
import { ADDR } from "./addresses";

async function main() {
  const { ethers } = await network.connect();

  const usdc = await ethers.getContractAt("MockUSDC", ADDR.USDC);

  const vaultBal = await usdc.balanceOf(ADDR.VAULT);
  const treasuryBal = await usdc.balanceOf(ADDR.TREASURY);

  console.log("Vault USDC:", vaultBal.toString());
  console.log("Treasury USDC:", treasuryBal.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

