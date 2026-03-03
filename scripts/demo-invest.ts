import { network } from "hardhat";
import { ADDR } from "./addresses";

async function main() {
  const { ethers } = await network.connect();
  const [me] = await ethers.getSigners();
  const meAddr = await me.getAddress();

  const zk = await ethers.getContractAt("MockZKVerifier", ADDR.ZKVER, me);
  await (await zk.setKyc(meAddr, true)).wait();

  const usdc = await ethers.getContractAt("MockUSDC", ADDR.USDC, me);
  const vault = await ethers.getContractAt("CrowdVault", ADDR.VAULT, me);

  const amount = 1000n * 1_000_000n;
  await (await usdc.approve(ADDR.VAULT, amount)).wait();
  await (await vault.invest(amount, "0x")).wait();

  console.log("Invested 1000 mUSDC");
}

main().catch((e) => { console.error(e); process.exit(1); });