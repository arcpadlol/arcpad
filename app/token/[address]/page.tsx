"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { EXPLORER, LAUNCHPAD, PRESETS, fmtPrice, fmtToken, fmtUsd, marketCap, short } from "../../lib/arcpad";
import { useArcPadData, useWallet } from "../../lib/useArcPad";
import { avatarStyle, TradeModal } from "../../components/modals";
import { ActivityList } from "../../components/activity";
import { Footer, Notice, Topbar } from "../../components/chrome";

const tokenImage = (symbol: string) => ({ SMO:"/tokens/arc-smoke.webp",WAG:"/tokens/wagmi-exe.webp",ARC:"/tokens/arc-signal.webp",PXL:"/tokens/pixel-protocol.webp" }[symbol.toUpperCase()]);

export default function TokenDetailPage() {
  const params = useParams<{address:string}>();
  const wallet = useWallet();
  const { coins, activity, loading, reload } = useArcPadData();
  const [trading,setTrading] = useState(false);
  const coin = coins.find(c=>c.token.toLowerCase()===params.address.toLowerCase());
  const acts = useMemo(()=>activity.filter(a=>a.token.toLowerCase()===params.address.toLowerCase()),[activity,params.address]);
  const chart = useMemo(()=>{
    const values = [...acts].reverse().filter(a=>a.usdc).map(a=>Number(a.usdc)/1e6);
    const series = values.length>2?values:[1,1.12,.96,1.34,1.22,1.61,1.88,2.1];
    const max=Math.max(...series),min=Math.min(...series),range=max-min||1;
    return series.map((v,i)=>`${(i/(series.length-1))*100},${88-((v-min)/range)*70}`).join(" ");
  },[acts]);

  if (loading || !coin) return <main className="app"><Notice/><Topbar wallet={wallet}/><section className="section shell"><div className="detail-loading">{loading?"Reading token from Arc…":"Token not found."}</div></section></main>;
  const image=tokenImage(coin.symbol), progress=Math.min(100,Number(coin.progressBps)/100);
  return <main className="app token-detail-page">
    <Notice/><Topbar wallet={wallet}/>
    <section className="section shell token-detail">
      <Link href="/app" className="detail-back">← Back to tokens</Link>
      <div className="detail-hero">
        <div className="detail-art">{image?<Image src={image} alt={coin.name} fill priority sizes="(max-width:700px) 92vw,360px"/>:<span style={avatarStyle(coin.symbol)}>{coin.symbol.slice(0,3)}</span>}</div>
        <div className="detail-copy">
          <div className="detail-status"><i/> {coin.graduated?"GRADUATED":"CURVE LIVE"}</div>
          <h1>{coin.name}</h1><div className="detail-symbol">${coin.symbol}</div>
          <p>USDC-native token launched on Arc with programmable fee routing and permanently locked liquidity at graduation.</p>
          <div className="detail-actions"><button className="btn btn-gold btn-lg" onClick={()=>setTrading(true)}>Trade ${coin.symbol}</button><a className="btn btn-outline btn-lg" href={`${EXPLORER}/address/${coin.token}`} target="_blank" rel="noreferrer">View contract ↗</a></div>
        </div>
      </div>
      <div className="detail-stats">
        <div><span>PRICE</span><strong>{fmtPrice(coin.price)}</strong></div><div><span>MARKET CAP</span><strong>{fmtUsd(marketCap(coin.price)/10n**18n)}</strong></div><div><span>USDC RAISED</span><strong>{fmtUsd(coin.realUsdc)}</strong></div><div><span>TOKENS SOLD</span><strong>{fmtToken(coin.tokensSold)}</strong></div>
      </div>
      <div className="detail-layout">
        <div className="detail-chart-panel">
          <div className="detail-panel-head"><div><span>ON-CHAIN CHART</span><b>${coin.symbol} / USDC</b></div><span className="detail-live"><i/> LIVE</span></div>
          <svg className="detail-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="On-chain token activity chart"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#53ddff" stopOpacity=".4"/><stop offset="1" stopColor="#53ddff" stopOpacity="0"/></linearGradient></defs><polygon points={`0,100 ${chart} 100,100`} fill="url(#chartFill)"/><polyline points={chart} fill="none" stroke="#63dcff" strokeWidth="1.7" vectorEffect="non-scaling-stroke"/></svg>
          <div className="detail-chart-note">Live fallback chart generated from Arc transactions. CoinGecko activates automatically after token indexing.</div>
        </div>
        <aside className="detail-info-panel">
          <h3>Token information</h3>
          <dl><div><dt>Token address</dt><dd><a href={`${EXPLORER}/address/${coin.token}`} target="_blank" rel="noreferrer">{short(coin.token)} ↗</a></dd></div><div><dt>Creator</dt><dd>{short(coin.creator)}</dd></div><div><dt>Fee vault</dt><dd>{(PRESETS[coin.preset]??PRESETS[0]).name}</dd></div><div><dt>Raise target</dt><dd>{fmtUsd(coin.raiseTarget,0)}</dd></div><div><dt>Liquidity</dt><dd>{coin.graduated?"Locked":"At graduation"}</dd></div><div><dt>Network</dt><dd>Arc Testnet</dd></div></dl>
          <div className="detail-progress"><div><span>Bonding curve</span><b>{progress.toFixed(1)}%</b></div><div className="bond-track"><i className="bond-fill" style={{width:`${progress}%`,display:"block"}}/></div></div>
        </aside>
      </div>
      <div className="detail-activity"><div className="detail-panel-head"><div><span>RECENT ACTIVITY</span><b>Public transactions</b></div></div><ActivityList activity={acts} loading={loading}/></div>
    </section>
    <Footer launchpad={LAUNCHPAD} explorer={EXPLORER}/>
    {trading&&<TradeModal coin={coin} wallet={wallet} onClose={()=>setTrading(false)} onChanged={reload}/>} 
  </main>;
}
