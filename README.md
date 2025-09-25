# Agent Backend Starter — Patched (Futures-only)

Фикс для твоей ошибки:
- 451/403: Vercel принудительно в регионы США (в vercel.json).
- "not JSON": убрали все браузерные прокси, только прямой запрос к FUTURES.
- ENV `FAPI_BASE`: можно задать свой проксирующий домен, если стандартный хост заблокирован провайдером.

## Vercel
1) Импортируй проект и Deploy.
2) Настройки → Env Vars (по желанию):
   - FAPI_BASE = https://<твой-прокси-домен> (проксирует к https://fapi.binance.com)
   - OPENAI_API_KEY (+ OPENAI_MODEL) для LLM-режима
3) Проверка: https://<project>.vercel.app/api/agent?symbol=BTCUSDT

Собрано: 2025-09-25T14:28:19
