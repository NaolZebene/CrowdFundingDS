import { network } from "hardhat";
import { ADDR } from "./addresses";

async function main() {
  const { ethers } = await network.connect();
  const [founder] = await ethers.getSigners();

  const oracle = await ethers.getContractAt("MockProgressOracle", ADDR.ORACLE, founder);
  const vault = await ethers.getContractAt("CrowdVault", ADDR.VAULT, founder);

  await (await oracle.setMilestoneOk(1, true)).wait();
  await (await vault.verifyNextMilestone()).wait();
  await (await vault.requestRelease()).wait();

  console.log("Milestone 1 verified + release requested ( veto window started)");
}

main().catch((e) => { console.error(e); process.exit(1); });