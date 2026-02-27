'use strict';
/**
 * Binance adapter — optional crypto-only fallback.
 * Uses REST endpoints only (no WebSocket here).
 */
const Binance = require('node-binance-api');
const { BINANCE } = require('../config');
const logger = require('../logger');

const client = new Binance().options({
    APIKEY: BINANCE.apiKey,
    APISECRET: BINANCE.apiSecret,
    useServerTime: true,
    recvWindow: 60000,
});

// Normalize Binance symbol: "BTC/USD" → "BTCUSDT" (Binance uses USDT)
function normalizeSymbol(symbol) {
    return symbol.replace('/', '').replace('USD', 'USDT');
}

async function getAccount() {
    return new Promise((resolve, reject) => {
        client.balance((err, balances) => {
            if (err) return reject(new Error(err.body));
            const usdt = balances['USDT'] ? parseFloat(balances['USDT'].available) : 0;
            resolve({ equity: usdt, cash: usdt, buyingPower: usdt, pnl: 0 });
        });
    });
}

async function getPositions() {
    // Binance doesn't have "positions" for spot; return empty for now
    return [];
}

async function getBars(symbol, limit = 100) {
    const bnSymbol = normalizeSymbol(symbol);
    return new Promise((resolve, reject) => {
        client.candlesticks(bnSymbol, '5m', (err, ticks) => {
            if (err) return reject(new Error(err.body));
            const bars = ticks.slice(-limit).map(t => ({
                time: new Date(t[0]),
                open: parseFloat(t[1]),
                high: parseFloat(t[2]),
                low: parseFloat(t[3]),
                close: parseFloat(t[4]),
                volume: parseFloat(t[5]),
            }));
            resolve(bars);
        }, { limit });
    });
}

async function getLatestPrice(symbol) {
    const bars = await getBars(symbol, 1);
    return bars.length > 0 ? bars[bars.length - 1].close : null;
}

async function placeOrder(symbol, qty, side) {
    const bnSymbol = normalizeSymbol(symbol);
    return new Promise((resolve, reject) => {
        if (side === 'buy') {
            client.marketBuy(bnSymbol, qty, (err, response) => {
                if (err) { logger.error(`[Binance] Buy error: ${err.body}`); return resolve(null); }
                logger.info(`[Binance] BUY ${qty} ${symbol}`);
                resolve(response);
            });
        } else {
            client.marketSell(bnSymbol, qty, (err, response) => {
                if (err) { logger.error(`[Binance] Sell error: ${err.body}`); return resolve(null); }
                logger.info(`[Binance] SELL ${qty} ${symbol}`);
                resolve(response);
            });
        }
    });
}

async function closePosition(symbol) {
    // For Binance: just sell whatever you have
    logger.warn(`[Binance] closePosition not implemented — sell manually or track qty`);
}

module.exports = { getAccount, getPositions, getBars, getLatestPrice, placeOrder, closePosition };
