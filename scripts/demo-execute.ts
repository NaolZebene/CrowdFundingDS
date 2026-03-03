import { network } from "hardhat";
import { ADDR } from "./addresses";

async function main() {
  const { ethers } = await network.connect();
  const [me] = await ethers.getSigners();

  const vault = await ethers.getContractAt("CrowdVault", ADDR.VAULT, me);

  console.log("Trying to execute release...");

  await (await vault.executeRelease()).wait();

  console.log("Executed");
}

main().catch((e) => {
  console.error("Execution blocked ");
  process.exit(0);
});
