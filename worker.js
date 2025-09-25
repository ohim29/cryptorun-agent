// worker.js
import { fetchKlines, computeFeatures } from './utils/features.js';

export default {
  async fetch(request, env, ctx) {
    try{
      const url = new URL(request.url);
      const symbol = (url.searchParams.get('symbol') || 'BTCUSDT').toUpperCase();
      const { klines, source } = await fetchKlines(symbol, "15m", 300);
      const { features, heuristic } = computeFeatures(klines);

      let advice = { ...heuristic, rationale: `Heuristic from ${source}` };

      if (env.OPENAI_API_KEY){
        const prompt = `Фичи: ${JSON.stringify(features)}; Бейзлайн: ${JSON.stringify(heuristic)}. Верни чистый JSON с полями side, confidence, rationale, risk(sl,tp).`;
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: env.OPENAI_MODEL || "gpt-4o-mini",
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [{ role:"system", content:"You are a concise, risk-aware crypto futures advisor." },
                       { role:"user", content: prompt }]
          })
        });
        if (r.ok){
          const j = await r.json();
          try{ advice = JSON.parse(j.choices[0].message.content); }catch(_){}
        }
      }

      return new Response(JSON.stringify({ ok:true, symbol, advice }), { headers:{ "Content-Type": "application/json" } });
    }catch(e){
      return new Response(JSON.stringify({ ok:false, error: e?.message || 'agent error' }), { status:500, headers:{ "Content-Type":"application/json" } });
    }
  }
}
