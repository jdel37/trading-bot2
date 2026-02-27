# QuantBot — Quantitative Trading Bot

A professional quant trading bot for **crypto, stocks, and forex** using [Alpaca Markets](https://alpaca.markets) as the primary broker.

## ✅ Features
- **Unified broker** — Alpaca supports crypto (BTC, ETH…), stocks (AAPL, TSLA…), and forex (EUR/USD…) under one API
- **3 Strategies** — EMA Crossover, RSI Reversal, MACD Momentum (switchable via env var)
- **Risk Management** — position sizing, stop-loss, take-profit, max positions cap
- **Real-time Dashboard** — premium dark UI at `http://localhost:3000` with live charts, signal feed, and trade log
- **Paper trading by default** — safe to run with zero real money

---

## 🔑 API Keys Required

### 1. Alpaca Markets (Required)
1. Create a free account at **[app.alpaca.markets](https://app.alpaca.markets)**
2. Go to **Paper Trading → API Keys → Generate New Key**
3. Copy your `API Key ID` and `Secret Key`

| Variable | Description |
|---|---|
| `ALPACA_API_KEY` | Your Alpaca API Key ID |
| `ALPACA_API_SECRET` | Your Alpaca Secret Key |
| `ALPACA_BASE_URL` | `https://paper-api.alpaca.markets` (paper) or `https://api.alpaca.markets` (live) |

### 2. Binance (Optional — crypto only)
Only needed if `BROKER=binance` in your `.env`.
1. Go to **[binance.com → Account → API Management](https://www.binance.com/en/my/settings/api-management)**
2. Create a new API key, enable **Spot & Margin Trading**

| Variable | Description |
|---|---|
| `BINANCE_API_KEY` | Your Binance API Key |
| `BINANCE_API_SECRET` | Your Binance Secret Key |

---

## 🚀 Setup

```bash
# 1. Install dependencies
cd /Users/juanda/Documents/tradingbot
npm install

# 2. Configure environment
cp .env.example .env
# Open .env and fill in your ALPACA_API_KEY and ALPACA_API_SECRET

# 3. Start the bot + dashboard
npm start

# 4. Open the dashboard
open http://localhost:3000
```

---

## ⚙️ Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `BROKER` | `alpaca` | `alpaca` or `binance` |
| `TRADING_MODE` | `paper` | `paper` or `live` |
| `SYMBOLS` | `BTC/USD,ETH/USD,AAPL,TSLA` | Comma-separated symbols |
| `TIMEFRAME` | `5Min` | Bar timeframe |
| `CRON_SCHEDULE` | `*/5 * * * *` | How often the bot runs |
| `STRATEGY` | `rsi` | `rsi`, `movingAverage`, or `macd` |
| `RISK_PER_TRADE` | `0.02` | Max % of equity per trade (2%) |
| `STOP_LOSS_PCT` | `0.03` | Stop-loss % below entry (3%) |
| `TAKE_PROFIT_PCT` | `0.06` | Take-profit % above entry (6%) |
| `MAX_POSITIONS` | `5` | Max simultaneous positions |
| `PORT` | `3000` | Dashboard server port |

---

## 📈 Strategies

### RSI (Default)
Buys when RSI < 30 (oversold), sells when RSI > 70 (overbought).
```
STRATEGY=rsi
RSI_PERIOD=14
RSI_OVERSOLD=30
RSI_OVERBOUGHT=70
```

### EMA Crossover
Buys when fast EMA crosses above slow EMA, sells on reverse.
```
STRATEGY=movingAverage
EMA_FAST=9
EMA_SLOW=21
```

### MACD
Buys on bullish MACD/signal crossover, sells on bearish crossover.
```
STRATEGY=macd
MACD_FAST=12
MACD_SLOW=26
MACD_SIGNAL=9
```

---

## 🗂 Project Structure

```
tradingbot/
├── .env.example          ← Copy to .env, fill in keys
├── package.json
├── src/
│   ├── bot.js            ← Main cron loop
│   ├── server.js         ← Express + WebSocket server
│   ├── config.js         ← Env config
│   ├── logger.js         ← Winston logger
│   ├── brokers/
│   │   ├── alpaca.js     ← Alpaca adapter
│   │   └── binance.js    ← Binance adapter
│   ├── strategies/
│   │   ├── movingAverage.js
│   │   ├── rsi.js
│   │   └── macd.js
│   ├── risk/
│   │   └── riskManager.js
│   └── utils/
│       └── indicators.js ← EMA, RSI, MACD, Bollinger Bands
└── dashboard/
    ├── index.html        ← Dashboard UI
    ├── style.css
    └── app.js            ← WebSocket client + Chart.js
```

---

## ⚠️ Risk Disclaimer

> Trading bots carry real financial risk when connected to live accounts. Start with paper trading. Past strategy performance does not guarantee future results. Never invest more than you can afford to lose.

---

## 📝 Logs

Logs are written to:
- `logs/combined.log` — all logs
- `logs/error.log` — errors only
