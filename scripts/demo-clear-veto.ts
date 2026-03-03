import { network } from "hardhat";
import { ADDR } from "./addresses";

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const { ethers, networkName } = await network.connect();
  console.log("Network:", networkName);

  // owner1 = deployer signer from PRIVATE_KEY
  const [owner1] = await ethers.getSigners();
  const owner1Addr = await owner1.getAddress();
  console.log("Owner1:", owner1Addr);

  // owner2 signer created from private key
  const owner2 = new ethers.Wallet(reqEnv("OWNER2_PK"), ethers.provider);
  const owner2Addr = await owner2.getAddress();
  console.log("Owner2:", owner2Addr);

  const vault = await ethers.getContractAt("CrowdVault", ADDR.VAULT, owner1);
  const msig = await ethers.getContractAt("TreasuryMultiSigV2", ADDR.TREASURY, owner1);

  // Encode call: vault.clearVeto()
  const data = vault.interface.encodeFunctionData("clearVeto", []);

  console.log("Proposing multisig call: vault.clearVeto()");
  const proposeTx = await msig.propose(ADDR.VAULT, 0, data);
  const proposeRc = await proposeTx.wait();

  // txId is last element: txns.length - 1, but easiest is read length
  const txCount = await msig.txns.length; // NOTE: Solidity public array => function txns(uint) exists, but length isn't exposed
  // Hardhat can't read .length like that. We'll compute txId by reading event instead.
  // We'll parse Proposed event:
  const proposedEvent = proposeRc?.logs
    .map((l: any) => {
      try { return msig.interface.parseLog(l); } catch { return null; }
    })
    .find((p: any) => p && p.name === "Proposed");

  if (!proposedEvent) throw new Error("Could not find Proposed event to get txId");
  const txId = proposedEvent.args.txId as bigint;
  console.log("txId:", txId.toString());

  console.log("Owner1 approving...");
  await (await msig.approve(txId)).wait();

  console.log("Owner2 approving...");
  const msigAsOwner2 = msig.connect(owner2);
  await (await msigAsOwner2.approve(txId)).wait();

  console.log("Executing...");
  await (await msig.execute(txId)).wait();

  console.log(" Veto cleared via multisig");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
