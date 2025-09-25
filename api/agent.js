// api/agent.js
import { fetchKlines, computeFeatures } from '../utils/features.js';

export default async function handler(req, res){
  try{
    const symbol = (req.query.symbol || 'BTCUSDT').toUpperCase();
    const { klines, source } = await fetchKlines(symbol, "15m", 300);
    const { features, heuristic } = computeFeatures(klines);

    let advice = { ...heuristic, rationale: `Heuristic from ${source}` };

    if (process.env.OPENAI_API_KEY){
      const prompt = `
Ты — риск-осознанный советчик для Binance Futures. На входе фичи (MA50, EMA200, RSI14, MACD_hist, last).
Верни JSON { "side":"LONG|SHORT|NEUTRAL", "confidence":0..1, "rationale":"...", "risk":{"sl":number|null,"tp":number|null} }.
Фичи: ${JSON.stringify(features)}
Бейзлайн: ${JSON.stringify(heuristic)}
      `.trim();

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are a concise, risk-aware crypto futures advisor." },
            { role: "user", content: prompt }
          ]
        })
      });
      if (r.ok){
        const j = await r.json();
        try{ advice = JSON.parse(j.choices[0].message.content); }catch(_){}
      }
    }

    res.status(200).json({ ok:true, symbol, advice });
  }catch(e){
    res.status(500).json({ ok:false, error: e?.message || 'agent error' });
  }
}
