const hre = require("hardhat");

// UNITFLOW (Uniswap V3 compatible) infrastructure on Arc testnet, verified
// on-chain 2026-07-16 (bytecode present, standard fee tiers live).
const ARC_TESTNET = {
  usdc: "0x3600000000000000000000000000000000000000",
  v3Factory: "0xAb6A8AAb7d490007634ef59d424b5d89688a1971",
  positionManager: "0x77c39eB310BE31e60068CE29855F83359bf85fc4",
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const treasury = process.env.PROTOCOL_TREASURY || deployer.address;
  console.log("Deployer:", deployer.address);
  console.log("Protocol treasury:", treasury);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Gas balance (USDC, 18d native):", hre.ethers.formatEther(balance));

  const args = [
    ARC_TESTNET.usdc,
    ARC_TESTNET.v3Factory,
    ARC_TESTNET.positionManager,
    treasury,
    deployer.address,
  ];
  const pad = await hre.ethers.deployContract("CitizenLaunchpad", args);
  await pad.waitForDeployment();
  const addr = await pad.getAddress();
  console.log("CitizenLaunchpad:", addr);
  console.log("Explorer:", `https://testnet.arcscan.app/address/${addr}`);

  // Always verify immediately (house rule).
  console.log("Verifying on Arcscan...");
  try {
    await hre.run("verify:verify", { address: addr, constructorArguments: args });
    console.log("Verified.");
  } catch (err) {
    console.error("Verification failed, retry manually with:");
    console.error(
      `npx hardhat verify --network arcTestnet ${addr} ${args.join(" ")}`
    );
    console.error(String(err.message || err));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
