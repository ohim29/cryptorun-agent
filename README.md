# Agent Backend Starter (Futures-only)

Готовый /api/agent для фронта «Объёмы». Работает сразу без ключей (rules-only),
а если добавить `OPENAI_API_KEY` — подключает ChatGPT (LLM mode).

## Деплой на Vercel
1) Импортируй проект, нажми Deploy.
2) (Опционально) в Settings→Env Variables добавь:
   - OPENAI_API_KEY
   - OPENAI_MODEL = gpt-4o-mini
3) Проверка:
   https://<project>.vercel.app/api/agent?symbol=BTCUSDT

## Деплой на Cloudflare Workers
1) Залей `worker.js` и папку `utils/`.
2) Добавь секреты: OPENAI_API_KEY (и OPENAI_MODEL).
3) `wrangler deploy`

## JSON-ответ
{
  "ok": true,
  "symbol": "BTCUSDT",
  "advice": {
    "side": "LONG|SHORT|NEUTRAL",
    "confidence": 0.0,
    "rationale": "string",
    "risk": { "sl": null, "tp": null }
  }
}

Собрано: 2025-09-25T13:54:37
