import { network } from "hardhat";
import { ADDR } from "./addresses";

async function main() {
  const { ethers } = await network.connect();
  const commit = await ethers.getContractAt(
    ["function balanceOf(address,uint256) view returns (uint256)"],
    ADDR.COMMIT,
  );
  const amm = await ethers.getContractAt(
    [
      "function poolUsdc(uint256) view returns (uint256)",
      "function poolCommit(uint256) view returns (uint256)",
      "function seeded(uint256) view returns (bool)",
    ],
    ADDR.AMM_ADDR,
  );
  const [signer] = await ethers.getSigners();
  const admin = await signer.getAddress();
  for (const id of [3, 4, 5]) {
    const bal = await commit.balanceOf(admin, id);
    const seeded = await amm.seeded(id);
    const pu = await amm.poolUsdc(id);
    const pc = await amm.poolCommit(id);
    console.log(`Project ${id}: admin_bal=${ethers.formatUnits(bal, 6)} seeded=${seeded} pool_usdc=${ethers.formatUnits(pu, 6)} pool_commit=${ethers.formatUnits(pc, 6)}`);
  }
}
main().catch(console.error);
