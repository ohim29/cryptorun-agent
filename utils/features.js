// utils/features.js
export async function fetchKlines(symbol, interval="15m", limit=300){
  const base = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const paths = [
    { url: base, tag: 'FUTURES' },
    { url: `https://cors.isomorphic-git.org/${base}`, tag: 'proxy:isomorphic-git' },
    { url: `https://corsproxy.io/?${encodeURIComponent(base)}`, tag: 'proxy:corsproxy.io' },
    { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(base)}`, tag: 'proxy:allorigins' },
    { url: `https://r.jina.ai/http://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, tag: 'proxy:r.jina.ai' }
  ];
  let lastErr=null;
  for (const p of paths){
    try{
      const r = await fetch(p.url, { cache: 'no-store' });
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const js = await r.json();
      if(Array.isArray(js)) return { klines: js, source: p.tag };
    }catch(e){ lastErr = e; }
  }
  throw lastErr || new Error('fetchKlines failed');
}

function sma(a, p){
  const t = a.slice(-p);
  return t.reduce((x,y)=>x+y,0) / (t.length||1);
}
function ema(a, p){
  const k = 2/(p+1); let e = a[0];
  for(let i=1;i<a.length;i++) e = a[i]*k + e*(1-k);
  return e;
}
function macdHist(a, fa=12, sl=26, sg=9){
  const ser = (v,p)=>{
    const k=2/(p+1); let e=v[0], out=[e];
    for(let i=1;i<v.length;i++){ e=v[i]*k+e*(1-k); out.push(e); }
    return out;
  };
  const ef = ser(a,fa), es = ser(a,sl);
  const m = ef.map((v,i)=>v-es[i]);
  const s = ser(m,sg);
  return m.at(-1) - s.at(-1);
}
function rsi(a, p=14){
  if (a.length < p+2) return NaN;
  let g=0,l=0;
  for(let i=1;i<=p;i++){ const c=a[i]-a[i-1]; if(c>=0) g+=c; else l-=c; }
  for(let i=p+1;i<a.length;i++){
    const c=a[i]-a[i-1];
    g=(g*(p-1)+(c>0?c:0))/p; l=(l*(p-1)+(c<0?-c:0))/p;
  }
  const rs=g/(l||1e-9); return 100-100/(1+rs);
}

export function computeFeatures(klines){
  const closes = klines.map(k=>+k[4]);
  const last = closes.at(-1);
  const MA50   = closes.length>=50  ? sma(closes,50)  : NaN;
  const EMA200 = closes.length>=200 ? ema(closes,200) : ema(closes, Math.min(200, closes.length-1));
  const MACD_H = macdHist(closes);
  const RSI14  = rsi(closes,14);

  const feats = { last, MA50, EMA200, MACD_H, RSI14, now: Date.now() };
  const factors = [];
  let scoreLong=0, scoreShort=0;

  if (Number.isFinite(MA50) && Number.isFinite(EMA200)){
    if(last>MA50 && last>EMA200){ scoreLong+=2; factors.push('Above MA50 & EMA200'); }
    if(last<MA50 && last<EMA200){ scoreShort+=2; factors.push('Below MA50 & EMA200'); }
  }
  if (Number.isFinite(MACD_H)){
    if(MACD_H>0){ scoreLong+=1; factors.push('MACD hist > 0'); }
    if(MACD_H<0){ scoreShort+=1; factors.push('MACD hist < 0'); }
  }
  if (Number.isFinite(RSI14)){
    if(RSI14>70){ scoreShort+=1; factors.push('RSI>70 (overbought)'); }
    if(RSI14<30){ scoreLong+=1; factors.push('RSI<30 (oversold)'); }
  }

  let side='NEUTRAL', confidence=0.45;
  if (scoreLong - scoreShort >= 2){ side='LONG'; confidence=0.65; }
  else if (scoreShort - scoreLong >= 2){ side='SHORT'; confidence=0.65; }

  const sl = side==='LONG' ? last*0.99 : (side==='SHORT' ? last*1.01 : null);

  return { features: feats, heuristic:{ side, confidence, factors, risk:{ sl, tp:null } } };
}
