// Reproduce the smoke-test flow locally against mocks with a 10 USDC tier.
const hre = require("hardhat");

async function main() {
  const [owner] = await hre.ethers.getSigners();
  const usdc = await hre.ethers.deployContract("MockUSDC");
  const factory = await hre.ethers.deployContract("MockV3Factory");
  const posMgr = await hre.ethers.deployContract("MockPositionManager");
  const pad = await hre.ethers.deployContract("ArcPadLaunchpad", [
    usdc, factory, posMgr, owner.address, owner.address,
  ]);

  await usdc.mint(owner.address, 100_000_000n);
  await usdc.approve(pad, hre.ethers.MaxUint256);
  await pad.setRaiseTarget(10_000_000n, true);

  const tx = await pad.createCoin(
    "Arc Smoke", "SMOKE", 2, 10_000_000n,
    hre.ethers.ZeroAddress, hre.ethers.ZeroAddress, hre.ethers.ZeroAddress
  );
  const rc = await tx.wait();
  const token = rc.logs
    .map((l) => { try { return pad.interface.parseLog(l); } catch { return null; } })
    .find((l) => l?.name === "CoinCreated").args.token;

  await pad.buy(token, 10_400_000n, 0);
  const c = await pad.coins(token);
  console.log("graduated:", c.graduated, "pool:", c.pool, "budget:", c.buybackBudget.toString());
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
