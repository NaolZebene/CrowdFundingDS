import { network } from "hardhat";
import { ADDR } from "./addresses";

async function main() {
  const { ethers } = await network.connect();
  const [me] = await ethers.getSigners();

  const vault = await ethers.getContractAt("CrowdVault", ADDR.VAULT, me);

  await (await vault.veto()).wait();
  console.log("Veto sent");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});