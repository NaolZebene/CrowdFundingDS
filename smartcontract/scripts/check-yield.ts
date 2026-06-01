import { network } from "hardhat";
import { ADDR } from "./addresses.js";

async function main() {
  const { ethers, networkName } = await network.connect();
  const [signer] = await ethers.getSigners();
  const user = process.env.YIELD_TEST_INVESTOR?.trim() || signer.address;

  const vault = await ethers.getContractAt(
    [
      "function lender() view returns (address)",
      "function totalRaised() view returns (uint256)",
      "function totalReleasedGlobal() view returns (uint256)",
      "function totalAmmSeededGlobal() view returns (uint256)",
      "function yieldIndex() view returns (uint256)",
      "function claimableYield(address) view returns (uint256)",
      "function pendingYield(address) view returns (uint256)",
      "function userProjects(address,uint256) view returns (uint256)",
    ],
    ADDR.VAULT,
  );
  const commit = await ethers.getContractAt(
    ["function balanceOf(address,uint256) view returns (uint256)"],
    ADDR.COMMIT,
  );
  const lenderAddr = await vault.lender();
  const lender = await ethers.getContractAt(
    [
      "function balance() view returns (uint256)",
      "function totalSupplied() view returns (uint256)",
      "function accruedYield() view returns (uint256)",
    ],
    lenderAddr,
  );
  const usdc = await ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)"],
    ADDR.USDC,
  );

  console.log("Network:", networkName);
  console.log("User:", user);
  console.log("Vault:", ADDR.VAULT);
  console.log("Lender:", lenderAddr);
  console.log("Vault totalRaised:", ethers.formatUnits(await vault.totalRaised(), 6), "USDC");
  console.log("Vault totalReleasedGlobal:", ethers.formatUnits(await vault.totalReleasedGlobal(), 6), "USDC");
  console.log("Vault totalAmmSeededGlobal:", ethers.formatUnits(await vault.totalAmmSeededGlobal(), 6), "USDC");
  console.log("Vault yieldIndex:", ethers.formatUnits(await vault.yieldIndex(), 18));
  console.log("Lender totalSupplied:", ethers.formatUnits(await lender.totalSupplied(), 6), "USDC");
  console.log("Lender accruedYield:", ethers.formatUnits(await lender.accruedYield(), 6), "USDC");
  console.log("Lender accounting balance:", ethers.formatUnits(await lender.balance(), 6), "USDC");
  console.log("Lender real USDC balance:", ethers.formatUnits(await usdc.balanceOf(lenderAddr), 6), "USDC");
  console.log("Stored claimable:", ethers.formatUnits(await vault.claimableYield(user), 6), "USDC");
  console.log("Pending claimable:", ethers.formatUnits(await vault.pendingYield(user), 6), "USDC");

  for (const id of [1, 3, 4, 5]) {
    const bal = await commit.balanceOf(user, id);
    console.log(`Project ${id} COMMIT:`, ethers.formatUnits(bal, 6));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
