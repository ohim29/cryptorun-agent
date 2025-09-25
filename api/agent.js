// api/agent.js
export default async function handler(req, res){
  try{
    const symbol = (req.query.symbol || 'BTCUSDT').toUpperCase();
    const base = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=300`;
    const paths = [
      { url: base, tag:'FUTURES' },
      { url: `https://cors.isomorphic-git.org/${base}`, tag:'proxy:isomorphic-git' },
      { url: `https://corsproxy.io/?${encodeURIComponent(base)}`, tag:'proxy:corsproxy.io' },
      { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(base)}`, tag:'proxy:allorigins' },
      { url: `https://r.jina.ai/http://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=300`, tag:'proxy:r.jina.ai' },
    ];

    async function fetchKlines(){
      let lastErr = null, tried = [];
      for (const p of paths){
        try{
          const r = await fetch(p.url, { cache:'no-store' });
          if(!r.ok) throw new Error(`${p.tag}: HTTP ${r.status}`);
          const txt = await r.text();
          let js;
          try { js = JSON.parse(txt); }
          catch(e){ throw new Error(`${p.tag}: not JSON (got: ${txt.slice(0,40).replace(/\s+/g,' ')}...)`); }
          if (Array.isArray(js)) return { js, source:p.tag };
          throw new Error(`${p.tag}: JSON is not an array`);
        }catch(e){
          lastErr = e;
          tried.push(String(e.message||e));
        }
      }
      const err = new Error(lastErr?.message || 'fetchKlines failed');
      err.tried = tried;
      throw err;
    }

    function sma(a,p){ const t=a.slice(-p); return t.reduce((x,y)=>x+y,0)/(t.length||1); }
    function ema(a,p){ const k=2/(p+1); let e=a[0]; for(let i=1;i<a.length;i++) e=a[i]*k+e*(1-k); return e; }
    function macdHist(a, fa=12, sl=26, sg=9){
      const ser=(v,p)=>{ const k=2/(p+1); let e=v[0], out=[e]; for(let i=1;i<v.length;i++){ e=v[i]*k+e*(1-k); out.push(e);} return out; };
      const ef=ser(a,fa), es=ser(a,sl); const m=ef.map((v,i)=>v-es[i]); const s=ser(m,sg); return m.at(-1)-s.at(-1);
    }
    function rsi(a,p=14){
      if (a.length < p+2) return NaN;
      let g=0,l=0; for(let i=1;i<=p;i++){ const c=a[i]-a[i-1]; if(c>=0) g+=c; else l-=c; }
      for(let i=p+1;i<a.length;i++){ const c=a[i]-a[i-1]; g=(g*(p-1)+(c>0?c:0))/p; l=(l*(p-1)+(c<0?-c:0))/p; }
      const rs=g/(l||1e-9); return 100-100/(1+rs);
    }

    const { js:klines, source } = await fetchKlines();
    const closes = klines.map(k=>+k[4]);
    const last   = closes.at(-1);
    const MA50   = closes.length>=50  ? sma(closes,50)  : NaN;
    const EMA200 = closes.length>=200 ? ema(closes,200) : ema(closes, Math.min(200, closes.length-1));
    const MACD_H = macdHist(closes);
    const RSI14  = rsi(closes,14);

    const factors = []; let scoreL=0, scoreS=0;
    if (Number.isFinite(MA50) && Number.isFinite(EMA200)){
      if (last>MA50 && last>EMA200){ scoreL+=2; factors.push('Above MA50 & EMA200'); }
      if (last<MA50 && last<EMA200){ scoreS+=2; factors.push('Below MA50 & EMA200'); }
    }
    if (Number.isFinite(MACD_H)){
      if (MACD_H>0){ scoreL+=1; factors.push('MACD hist > 0'); }
      if (MACD_H<0){ scoreS+=1; factors.push('MACD hist < 0'); }
    }
    if (Number.isFinite(RSI14)){
      if (RSI14>70){ scoreS+=1; factors.push('RSI>70'); }
      if (RSI14<30){ scoreL+=1; factors.push('RSI<30'); }
    }

    let side='NEUTRAL', confidence=0.45;
    if (scoreL - scoreS >= 2){ side='LONG'; confidence=0.65; }
    else if (scoreS - scoreL >= 2){ side='SHORT'; confidence=0.65; }
    const sl = side==='LONG' ? last*0.99 : (side==='SHORT' ? last*1.01 : null);

    res.status(200).json({
      ok:true, symbol,
      advice:{ side, confidence, rationale:`Heuristic from ${source}`, risk:{ sl, tp:null } }
    });
  }catch(e){
    res.status(500).json({
      ok:false,
      error: e?.message || 'agent error',
      tried: e?.tried || undefined
    });
  }
}
