import { network } from "hardhat";

const USDC = "0xdEbA548daCe3343489441b640CF8c6D228bcCA8F";
const VAULT = "0x95BBF0EB51bC618FC0d21868e98e4c6956723DDB";

async function main() {
  const { ethers, networkName } = await network.connect();
  console.log("Network:", networkName);

  const [me] = await ethers.getSigners();
  const myAddr = await me.getAddress();
  console.log("Using wallet:", myAddr);

  // Minimal ABIs
  const usdcAbi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address who) external view returns (uint256)",
  ];
  const vaultAbi = [
    "function invest(uint256 amount) external",
    "function totalRaised() external view returns (uint256)",
    "function invested(address who) external view returns (uint256)",
  ];

  const usdc = new ethers.Contract(USDC, usdcAbi, me);
  const vault = new ethers.Contract(VAULT, vaultAbi, me);

  // Invest 100 mUSDC (6 decimals)
  const amount = 100n * 1_000_000n;

  const bal = await usdc.balanceOf(myAddr);
  console.log("mUSDC balance:", bal.toString());

  console.log("Approving vault...");
  await (await usdc.approve(VAULT, amount)).wait();

  console.log("Investing...");
  await (await vault.invest(amount)).wait();

  console.log("Done.");
  console.log("Vault totalRaised:", (await vault.totalRaised()).toString());
  console.log("My invested:", (await vault.invested(myAddr)).toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});