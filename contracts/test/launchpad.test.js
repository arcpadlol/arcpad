const { expect } = require("chai");
const { ethers } = require("hardhat");

const U = (n) => ethers.parseUnits(n.toString(), 6); // USDC 6d
const T = (n) => ethers.parseUnits(n.toString(), 18); // token 18d

const TOTAL_SUPPLY = T(1_000_000_000);
const CURVE_SUPPLY = T(800_000_000);
const V_TOKEN_0 = T(1_080_000_000);
const RAISE_TARGET = U(10_000); // tier used across the tests
const V_USDC_0 = (RAISE_TARGET * 7n) / 20n; // 3,500 USDC virtual reserve
const K = V_USDC_0 * V_TOKEN_0;
const BPS = 10_000n;
const VAULT_FEE = 100n;
const PLATFORM_FEE = 50n;
const TOTAL_FEE = VAULT_FEE + PLATFORM_FEE;

const ceilDiv = (a, b) => (a + b - 1n) / b;

// Mirror of the contract's buy math.
function quoteBuy(vU, vT, sold, usdcIn) {
  const fee = (usdcIn * TOTAL_FEE) / BPS;
  let net = usdcIn - fee;
  let newVU = vU + net;
  let out = vT - ceilDiv(K, newVU);
  const remaining = CURVE_SUPPLY - sold;
  let refund = 0n;
  if (out >= remaining) {
    out = remaining;
    newVU = ceilDiv(K, vT - remaining);
    net = newVU - vU;
    let gross = ceilDiv(net * BPS, BPS - TOTAL_FEE);
    if (gross > usdcIn) gross = usdcIn;
    refund = usdcIn - gross;
  }
  return { out, refund, newVU, net };
}

describe("CitizenLaunchpad", () => {
  let owner, treasury, alice, bob, bounty;
  let usdc, factory, posMgr, pad;

  beforeEach(async () => {
    [owner, treasury, alice, bob, bounty] = await ethers.getSigners();
    usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    factory = await (await ethers.getContractFactory("MockV3Factory")).deploy();
    posMgr = await (
      await ethers.getContractFactory("MockPositionManager")
    ).deploy();
    pad = await (
      await ethers.getContractFactory("CitizenLaunchpad")
    ).deploy(usdc, factory, posMgr, treasury.address, owner.address);

    for (const who of [alice, bob]) {
      await usdc.mint(who.address, U(50_000));
      await usdc.connect(who).approve(pad, ethers.MaxUint256);
    }
  });

  async function createCoin(preset = 0, from = alice, target = RAISE_TARGET) {
    const tx = await pad
      .connect(from)
      .createCoin("Arc Cat", "ACAT", preset, target, bounty.address, ethers.ZeroAddress, ethers.ZeroAddress);
    const rc = await tx.wait();
    const log = rc.logs.find((l) => l.fragment?.name === "CoinCreated");
    return log.args.token;
  }

  it("creates a coin: fee charged, 1B supply held by launchpad", async () => {
    const token = await createCoin();
    const erc = await ethers.getContractAt("CitizenToken", token);
    expect(await erc.totalSupply()).to.equal(TOTAL_SUPPLY);
    expect(await erc.balanceOf(pad)).to.equal(TOTAL_SUPPLY);
    expect(await pad.claimableFees(treasury.address)).to.equal(U(0.01));
    const c = await pad.coins(token);
    expect(c.creator).to.equal(alice.address);
    expect(c.virtualUsdc).to.equal(V_USDC_0);
    expect(c.virtualToken).to.equal(V_TOKEN_0);
    expect(await pad.coinCount()).to.equal(1);
  });

  it("buys along the curve with correct math and fee routing (Grow)", async () => {
    const token = await createCoin(0); // Grow
    const erc = await ethers.getContractAt("CitizenToken", token);
    const usdcIn = U(100);
    const q = quoteBuy(V_USDC_0, V_TOKEN_0, 0n, usdcIn);

    const [viewOut] = await pad.quoteBuy(token, usdcIn);
    expect(viewOut).to.equal(q.out);

    await expect(pad.connect(bob).buy(token, usdcIn, q.out))
      .to.emit(pad, "Trade")
      .withArgs(token, bob.address, true, usdcIn, q.out);
    expect(await erc.balanceOf(bob.address)).to.equal(q.out);

    // fee = 1.5 USDC: platform 0.5, vault 1.0 split 37.5/37.5/25
    const fee = (usdcIn * TOTAL_FEE) / BPS;
    const platformCut = (fee * PLATFORM_FEE) / TOTAL_FEE;
    const vault = fee - platformCut;
    const toCreator = (vault * 3750n) / BPS;
    const toBounty = (vault * 3750n) / BPS;
    const toTreasuryWallet = (vault * 2500n) / BPS; // defaults to creator
    expect(await pad.claimableFees(bounty.address)).to.equal(toBounty);
    // creator gets creator share + coin-treasury share (wallet defaulted)
    expect(await pad.claimableFees(alice.address)).to.equal(
      toCreator + toTreasuryWallet
    );
    expect(await pad.claimableFees(treasury.address)).to.equal(
      U(0.01) + platformCut
    );

    const c = await pad.coins(token);
    expect(c.tokensSold).to.equal(q.out);
    expect(c.realUsdc).to.equal(q.net);
  });

  it("sells back to the curve for slightly less (fees)", async () => {
    const token = await createCoin();
    const erc = await ethers.getContractAt("CitizenToken", token);
    await pad.connect(bob).buy(token, U(500), 0);
    const bal = await erc.balanceOf(bob.address);

    const quoted = await pad.quoteSell(token, bal);
    await erc.connect(bob).approve(pad, bal);
    const before = await usdc.balanceOf(bob.address);
    await pad.connect(bob).sell(token, bal, quoted);
    const got = (await usdc.balanceOf(bob.address)) - before;

    expect(got).to.equal(quoted);
    expect(got).to.be.lt(U(500));
    expect(got).to.be.gt(U(485)); // ~3% round trip cost max

    const c = await pad.coins(token);
    expect(c.tokensSold).to.equal(0n);
    expect(c.virtualToken).to.equal(V_TOKEN_0);
  });

  it("reverts on slippage and unknown coins", async () => {
    const token = await createCoin();
    await expect(
      pad.connect(bob).buy(token, U(100), T(1_000_000_000))
    ).to.be.revertedWithCustomError(pad, "SlippageExceeded");
    await expect(
      pad.connect(bob).buy(bob.address, U(100), 0)
    ).to.be.revertedWithCustomError(pad, "UnknownCoin");
  });

  it("graduates: refund, locked LP at continuity price, fees routed", async () => {
    const token = await createCoin();
    const erc = await ethers.getContractAt("CitizenToken", token);
    const usdcIn = U(20_000);
    const q = quoteBuy(V_USDC_0, V_TOKEN_0, 0n, usdcIn);
    expect(q.out).to.equal(CURVE_SUPPLY);
    expect(q.refund).to.be.gt(0n);

    const before = await usdc.balanceOf(bob.address);
    await expect(pad.connect(bob).buy(token, usdcIn, 0)).to.emit(
      pad,
      "Graduated"
    );
    expect(before - (await usdc.balanceOf(bob.address))).to.equal(
      usdcIn - q.refund
    );

    const c = await pad.coins(token);
    expect(c.graduated).to.equal(true);
    expect(c.pool).to.not.equal(ethers.ZeroAddress);
    expect(c.lpTokenId).to.equal(1n);

    // continuity: usdcToLp = 200M * vUend / vTend
    const vUend = ceilDiv(K, V_TOKEN_0 - CURVE_SUPPLY);
    const lpTokens = TOTAL_SUPPLY - CURVE_SUPPLY;
    const expectedUsdcToLp =
      (lpTokens * vUend) / (V_TOKEN_0 - CURVE_SUPPLY);
    const a0 = await posMgr.lastAmount0();
    const a1 = await posMgr.lastAmount1();
    const usdcAddr = (await usdc.getAddress()).toLowerCase();
    const [lpUsdc, lpTok] =
      usdcAddr < token.toLowerCase() ? [a0, a1] : [a1, a0];
    expect(lpTok).to.equal(lpTokens);
    expect(lpUsdc).to.equal(expectedUsdcToLp);

    // pool got initialized at that ratio
    const pool = await ethers.getContractAt("MockV3Pool", c.pool);
    const [sqrtPrice] = await pool.slot0();
    expect(sqrtPrice).to.be.gt(0n);

    // trading on the curve is closed now
    await expect(
      pad.connect(bob).buy(token, U(10), 0)
    ).to.be.revertedWithCustomError(pad, "AlreadyGraduated");

    // launchpad kept no tokens (dust burned) and no orphan USDC accounting
    expect(await erc.balanceOf(pad)).to.equal(0n);
  });

  it("pre-creates and locks the graduation pool at creation", async () => {
    // C-1 fix: the pool is created and initialized at the deterministic final
    // price inside createCoin, so nobody can seed it at a bogus price and loot
    // the locked liquidity at graduation.
    const token = await createCoin();
    const c = await pad.coins(token);
    expect(c.pool).to.not.equal(ethers.ZeroAddress);

    const pool = await ethers.getContractAt("MockV3Pool", c.pool);
    const [sqrtPrice] = await pool.slot0();
    expect(sqrtPrice).to.be.gt(0n);

    // an outsider cannot re-initialize it to a different price
    await expect(pool.connect(alice).initialize(123n)).to.be.revertedWith(
      "already init"
    );
  });

  it("Burn preset accrues buyback budget and burns supply pre-graduation", async () => {
    const token = await createCoin(2); // Burn
    const erc = await ethers.getContractAt("CitizenToken", token);
    await pad.connect(bob).buy(token, U(1_000), 0);

    const fee = (U(1_000) * TOTAL_FEE) / BPS;
    const vault = fee - (fee * PLATFORM_FEE) / TOTAL_FEE;
    const expectedBudget = (vault * 6250n) / BPS;
    let c = await pad.coins(token);
    expect(c.buybackBudget).to.equal(expectedBudget);

    const supplyBefore = await erc.totalSupply();
    await expect(pad.connect(bob).executeBuyback(token, expectedBudget, 0)).to.emit(
      pad,
      "Buyback"
    );
    expect(await erc.totalSupply()).to.be.lt(supplyBefore);
    c = await pad.coins(token);
    expect(c.buybackBudget).to.equal(0n);

    await expect(
      pad.connect(bob).executeBuyback(token, 1n, 0)
    ).to.be.revertedWithCustomError(pad, "BudgetExceeded");
  });

  it("executes post-graduation buyback through the pool", async () => {
    const token = await createCoin(2); // Burn
    const erc = await ethers.getContractAt("CitizenToken", token);
    await pad.connect(bob).buy(token, U(20_000), 0); // graduates
    const c = await pad.coins(token);
    expect(c.graduated).to.equal(true);
    expect(c.buybackBudget).to.be.gt(0n);

    // fund the mock pool so it can pay out tokens
    await erc.connect(bob).transfer(c.pool, T(3_000_000));

    const supplyBefore = await erc.totalSupply();
    await pad.connect(alice).executeBuyback(token, c.buybackBudget, 0);
    expect(await erc.totalSupply()).to.be.lt(supplyBefore);
  });

  it("collects LP fees, burns token side, splits USDC side", async () => {
    const token = await createCoin(0);
    const erc = await ethers.getContractAt("CitizenToken", token);
    await pad.connect(bob).buy(token, U(20_000), 0); // graduates

    // simulate accrued pool fees inside the position manager
    await usdc.mint(posMgr, U(150));
    await erc.connect(bob).transfer(posMgr, T(10_000));
    const usdcAddr = (await usdc.getAddress()).toLowerCase();
    const [t0, t1, a0, a1] =
      usdcAddr < token.toLowerCase()
        ? [usdc, token, U(150), T(10_000)]
        : [token, usdc, T(10_000), U(150)];
    await posMgr.setCollectAmounts(t0, t1, a0, a1);

    const treasBefore = await pad.claimableFees(treasury.address);
    const supplyBefore = await erc.totalSupply();
    await expect(pad.collectPoolFees(token)).to.emit(pad, "PoolFeesCollected");

    expect(await erc.totalSupply()).to.equal(supplyBefore - T(10_000));
    const platformCut = (U(150) * PLATFORM_FEE) / TOTAL_FEE;
    expect(await pad.claimableFees(treasury.address)).to.be.gte(
      treasBefore + platformCut
    );
  });

  it("lets recipients claim accrued fees", async () => {
    const token = await createCoin(0);
    await pad.connect(bob).buy(token, U(1_000), 0);
    const claimable = await pad.claimableFees(alice.address);
    expect(claimable).to.be.gt(0n);
    const before = await usdc.balanceOf(alice.address);
    await pad.connect(alice).claimFees();
    expect((await usdc.balanceOf(alice.address)) - before).to.equal(claimable);
    await expect(
      pad.connect(alice).claimFees()
    ).to.be.revertedWithCustomError(pad, "ZeroAmount");
  });

  it("pause blocks create and buy but never sell or claim", async () => {
    const token = await createCoin(0);
    const erc = await ethers.getContractAt("CitizenToken", token);
    await pad.connect(bob).buy(token, U(100), 0);
    await pad.connect(owner).pause();

    await expect(pad.connect(bob).buy(token, U(100), 0)).to.be.reverted;
    await expect(createCoin()).to.be.reverted;

    const bal = await erc.balanceOf(bob.address);
    await erc.connect(bob).approve(pad, bal);
    await pad.connect(bob).sell(token, bal, 0); // still works
    await pad.connect(alice).claimFees(); // still works
  });

  it("enforces raise-target tiers and scales the curve to them", async () => {
    await expect(
      pad
        .connect(alice)
        .createCoin("X", "X", 0, U(7_777), ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(pad, "InvalidRaiseTarget");

    // a 3k coin graduates after ~3,046 USDC gross (3,000 net + 1.5% fee)
    const token = await createCoin(0, alice, U(3_000));
    await pad.connect(bob).buy(token, U(3_100), 0);
    const c = await pad.coins(token);
    expect(c.graduated).to.equal(true);
    expect(c.realUsdc).to.be.closeTo(U(3_000), U(1));

    // regression: a tiny tier must graduate without overflowing the
    // sqrt price math (extreme USDC/token ratio)
    await pad.connect(owner).setRaiseTarget(U(10), true);
    const tiny = await createCoin(0, alice, U(10));
    await pad.connect(bob).buy(tiny, U(11), 0);
    expect((await pad.coins(tiny)).graduated).to.equal(true);

    // owner can add and remove tiers
    await pad.connect(owner).setRaiseTarget(U(50_000), true);
    expect(await pad.allowedRaiseTargets(U(50_000))).to.equal(true);
    await expect(pad.connect(alice).setRaiseTarget(U(1), true)).to.be.reverted;
  });

  it("owner can edit fees within the hard cap", async () => {
    await pad.connect(owner).setFees(200, 100);
    expect(await pad.vaultFeeBps()).to.equal(200);
    expect(await pad.platformFeeBps()).to.equal(100);
    await expect(
      pad.connect(owner).setFees(400, 200)
    ).to.be.revertedWithCustomError(pad, "FeeTooHigh");
    await expect(pad.connect(alice).setFees(10, 10)).to.be.reverted;
  });

  it("caps the graduation fee at continuity break-even and floors raise tiers", async () => {
    // L-2: graduation fee cannot be raised past 3%, so the pool always opens
    // at the exact final curve price.
    await pad.connect(owner).setGraduationFeeBps(300);
    expect(await pad.graduationFeeBps()).to.equal(300);
    await expect(
      pad.connect(owner).setGraduationFeeBps(400)
    ).to.be.revertedWithCustomError(pad, "FeeTooHigh");

    // L-1: raise targets below the minimum (which would zero the virtual
    // reserve) are rejected.
    await expect(
      pad.connect(owner).setRaiseTarget(1n, true)
    ).to.be.revertedWithCustomError(pad, "InvalidRaiseTarget");
    await pad.connect(owner).setRaiseTarget(U(1), true); // exactly the floor
    expect(await pad.allowedRaiseTargets(U(1))).to.equal(true);
  });
});
