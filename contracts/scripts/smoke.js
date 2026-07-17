// End-to-end smoke test on Arc testnet against the live deployment:
// mini raise tier -> create coin -> buy through graduation on the real
// UNITFLOW V3 -> post-graduation buyback through the real pool -> cleanup.
const hre = require("hardhat");

const PAD = process.env.PAD || "0xdf155bA386ab42cBBD0EE043cf9f6bA17E7A3ac3";
const USDC = "0x3600000000000000000000000000000000000000";
const TIER = BigInt(process.env.TIER || 10_000_000); // mini tier for testing

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const pad = await hre.ethers.getContractAt("ArcPadLaunchpad", PAD);
  const usdc = await hre.ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDC
  );

  console.log("Balance:", hre.ethers.formatUnits(await usdc.balanceOf(signer.address), 6), "USDC");

  console.log("1) allow mini tier + approve USDC...");
  await (await pad.setRaiseTarget(TIER, true)).wait();
  await (await usdc.approve(PAD, hre.ethers.MaxUint256)).wait();

  console.log("2) create coin (Burn preset)...");
  const tx = await pad.createCoin(
    "Arc Smoke", "SMOKE", 2, TIER,
    hre.ethers.ZeroAddress, hre.ethers.ZeroAddress, hre.ethers.ZeroAddress
  );
  const rc = await tx.wait();
  const token = rc.logs
    .map((l) => { try { return pad.interface.parseLog(l); } catch { return null; } })
    .find((l) => l?.name === "CoinCreated").args.token;
  console.log("   token:", token);

  console.log("3) buy to graduate...");
  await (await pad.buy(token, (TIER * 106n) / 100n, 0)).wait();

  let c = await pad.coins(token);
  console.log("   graduated:", c.graduated);
  console.log("   pool:", c.pool);
  console.log("   lpTokenId:", c.lpTokenId.toString());
  console.log("   buybackBudget:", hre.ethers.formatUnits(c.buybackBudget, 6), "USDC");

  if (c.buybackBudget > 0n) {
    console.log("4) post-graduation buyback through the real pool...");
    await (await pad.executeBuyback(token, c.buybackBudget)).wait();
    c = await pad.coins(token);
    console.log("   buybackBudget now:", c.buybackBudget.toString());
  }

  console.log("5) cleanup: remove mini tier...");
  await (await pad.setRaiseTarget(TIER, false)).wait();

  console.log("Done. Pool:", `https://testnet.arcscan.app/address/${c.pool}`);
  console.log("Token:", `https://testnet.arcscan.app/token/${token}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
