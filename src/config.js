'use strict';
require('dotenv').config();

// ── Validation helper ──────────────────────────────────────
function require_env(name) {
  const val = process.env[name];
  if (!val || val.startsWith('your_')) {
    throw new Error(`Missing required env variable: ${name}\nCopy .env.example → .env and fill in your values.`);
  }
  return val;
}

// ── Broker ─────────────────────────────────────────────────
const BROKER = (process.env.BROKER || 'alpaca').toLowerCase();

// ── Alpaca ─────────────────────────────────────────────────
const ALPACA = {
  keyId:     require_env('ALPACA_API_KEY'),
  secretKey: require_env('ALPACA_API_SECRET'),
  baseUrl:   process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
  paper:     (process.env.ALPACA_BASE_URL || '').includes('paper') || process.env.TRADING_MODE !== 'live',
};

// ── Binance ────────────────────────────────────────────────
const BINANCE = {
  apiKey:    process.env.BINANCE_API_KEY || '',
  apiSecret: process.env.BINANCE_API_SECRET || '',
};

// ── Symbols ────────────────────────────────────────────────
const SYMBOLS = (process.env.SYMBOLS || 'BTC/USD,ETH/USD').split(',').map(s => s.trim());

// ── Market data ────────────────────────────────────────────
const TIMEFRAME   = process.env.TIMEFRAME   || '5Min';
const BAR_LIMIT   = parseInt(process.env.BAR_LIMIT || '100', 10);
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/5 * * * *';

// ── Strategy ───────────────────────────────────────────────
const STRATEGY = (process.env.STRATEGY || 'rsi').toLowerCase();
const STRATEGY_CONFIG = {
  ema: {
    fast: parseInt(process.env.EMA_FAST || '9',  10),
    slow: parseInt(process.env.EMA_SLOW || '21', 10),
  },
  rsi: {
    period:     parseInt(process.env.RSI_PERIOD      || '14', 10),
    oversold:   parseInt(process.env.RSI_OVERSOLD    || '30', 10),
    overbought: parseInt(process.env.RSI_OVERBOUGHT  || '70', 10),
  },
  macd: {
    fast:   parseInt(process.env.MACD_FAST   || '12', 10),
    slow:   parseInt(process.env.MACD_SLOW   || '26', 10),
    signal: parseInt(process.env.MACD_SIGNAL || '9',  10),
  },
};

// ── Risk management ────────────────────────────────────────
const RISK = {
  riskPerTrade:   parseFloat(process.env.RISK_PER_TRADE   || '0.02'),
  stopLossPct:    parseFloat(process.env.STOP_LOSS_PCT    || '0.03'),
  takeProfitPct:  parseFloat(process.env.TAKE_PROFIT_PCT  || '0.06'),
  maxPositions:   parseInt(process.env.MAX_POSITIONS      || '5', 10),
};

// ── Server ─────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);

module.exports = {
  BROKER, ALPACA, BINANCE,
  SYMBOLS, TIMEFRAME, BAR_LIMIT, CRON_SCHEDULE,
  STRATEGY, STRATEGY_CONFIG,
  RISK, PORT,
};
