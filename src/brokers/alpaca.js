'use strict';
const Alpaca = require('@alpacahq/alpaca-trade-api');
const { EventEmitter } = require('events');
const { ALPACA, TIMEFRAME } = require('../config');
const logger = require('../logger');

const alpaca = new Alpaca({
    keyId: ALPACA.keyId,
    secretKey: ALPACA.secretKey,
    baseUrl: ALPACA.baseUrl,
    paper: ALPACA.paper,
});

// ── WebSocket Client ───────────────────────────────────────
const wsEvents = new EventEmitter();

function connectWS(symbols) {
    const cryptoSymbols = symbols.filter(s => s.includes('/'));
    const stockSymbols = symbols.filter(s => !s.includes('/'));

    // Stocks Data Stream
    if (stockSymbols.length > 0) {
        const mx = alpaca.data_stream_v2;
        mx.connect();
        mx.onConnect(() => {
            logger.info('[Alpaca WS] Connected to Stocks Data Stream');
            mx.subscribeForBars(stockSymbols);
        });
        mx.onError((err) => { logger.error(`[Alpaca WS] Stock Stream Error: ${err}`); });
        mx.onStockBar((bar) => {
            wsEvents.emit('bar', {
                symbol: bar.Symbol,
                time: bar.Timestamp,
                open: bar.OpenPrice,
                high: bar.HighPrice,
                low: bar.LowPrice,
                close: bar.ClosePrice,
                volume: bar.Volume,
            });
        });
    }

    // Crypto Data Stream
    if (cryptoSymbols.length > 0) {
        // En alpaca-trade-api moderno, el stream a veces necesita ser instanciado o se accede diferente.
        // Alpaca crypto stream is typically accessible via alpaca.crypto_stream_v2
        if (alpaca.crypto_stream_v2) {
            const cx = alpaca.crypto_stream_v2;
            cx.connect();
            cx.onConnect(() => {
                logger.info('[Alpaca WS] Connected to Crypto Data Stream');
                cx.subscribeForBars(cryptoSymbols);
            });
            cx.onError((err) => { logger.error(`[Alpaca WS] Crypto Stream Error: ${err}`); });
            cx.onCryptoBar((bar) => {
                wsEvents.emit('bar', {
                    symbol: bar.Symbol,
                    time: bar.Timestamp,
                    open: bar.OpenPrice,
                    high: bar.HighPrice,
                    low: bar.LowPrice,
                    close: bar.ClosePrice,
                    volume: bar.Volume,
                });
            });
        } else {
            logger.warn('[Alpaca WS] Crypto stream v2 not available on this SDK version');
        }
    }
}

// ── Account ────────────────────────────────────────────────
async function getAccount() {
    const acc = await alpaca.getAccount();
    return {
        equity: parseFloat(acc.equity),
        cash: parseFloat(acc.cash),
        buyingPower: parseFloat(acc.buying_power),
        pnl: parseFloat(acc.equity) - parseFloat(acc.last_equity),
    };
}

// ── Positions ──────────────────────────────────────────────
async function getPositions() {
    const positions = await alpaca.getPositions();
    return positions.map(p => ({
        symbol: p.symbol,
        qty: parseFloat(p.qty),
        side: p.side,
        entryPrice: parseFloat(p.avg_entry_price),
        currentPrice: parseFloat(p.current_price),
        pnl: parseFloat(p.unrealized_pl),
        pnlPct: parseFloat(p.unrealized_plpc) * 100,
    }));
}

// ── Market Data ────────────────────────────────────────────
/**
 * Fetch OHLCV bars for a symbol.
 * Alpaca uses "BTC/USD" for crypto, "AAPL" for stocks.
 * Returns array of { time, open, high, low, close, volume }
 */
async function getBars(symbol, limit = 100) {
    const isCrypto = symbol.includes('/');

    try {
        if (isCrypto) {
            // Crypto bars via Alpaca Crypto Data API
            const resp = await alpaca.getCryptoBars(
                [symbol],
                {
                    timeframe: TIMEFRAME,
                    limit,
                }
            );
            const bars = resp.get ? resp.get(symbol) : (resp[symbol] || []);
            return bars.map(b => ({
                time: b.Timestamp || b.t,
                open: b.OpenPrice || b.Open || b.o,
                high: b.HighPrice || b.High || b.h,
                low: b.LowPrice || b.Low || b.l,
                close: b.ClosePrice || b.Close || b.c,
                volume: b.Volume || b.v,
            }));
        } else {
            // Stock / ETF bars
            const barsResp = alpaca.getBarsV2(
                symbol,
                {
                    timeframe: TIMEFRAME,
                    limit,
                    feed: 'iex',
                }
            );
            const bars = [];
            for await (const b of barsResp) {
                bars.push({
                    time: b.Timestamp || b.t,
                    open: b.OpenPrice || b.o,
                    high: b.HighPrice || b.h,
                    low: b.LowPrice || b.l,
                    close: b.ClosePrice || b.c,
                    volume: b.Volume || b.v,
                });
            }
            return bars.slice(-limit);
        }
    } catch (err) {
        logger.error(`[Alpaca] getBars(${symbol}) failed: ${err.message}`);
        return [];
    }
}

// ── Latest Price ───────────────────────────────────────────
async function getLatestPrice(symbol) {
    try {
        const bars = await getBars(symbol, 1);
        return bars.length > 0 ? bars[bars.length - 1].close : null;
    } catch {
        return null;
    }
}

// ── Orders ─────────────────────────────────────────────────
/**
 * Place a market order.
 * @param {string} symbol
 * @param {number} qty
 * @param {'buy'|'sell'} side
 */
async function placeOrder(symbol, qty, side) {
    if (qty <= 0) {
        logger.warn(`[Alpaca] Skipping ${side} order for ${symbol}: qty=${qty} too small`);
        return null;
    }

    const isCrypto = symbol.includes('/');
    // Alpaca expects crypto as "BTCUSD" for orders
    const orderSymbol = isCrypto ? symbol.replace('/', '') : symbol;

    try {
        const order = await alpaca.createOrder({
            symbol: orderSymbol,
            qty: qty.toFixed(isCrypto ? 6 : 0),
            side,
            type: 'market',
            time_in_force: isCrypto ? 'gtc' : 'day',
        });

        logger.info(`[Alpaca] Order placed: ${side.toUpperCase()} ${qty} ${symbol} | id=${order.id}`);
        return order;
    } catch (err) {
        logger.error(`[Alpaca] placeOrder error (${side} ${symbol}): ${err.message}`);
        return null;
    }
}

/**
 * Close an open position for a symbol.
 */
async function closePosition(symbol) {
    const closeSymbol = symbol.replace('/', '');
    try {
        await alpaca.closePosition(closeSymbol);
        logger.info(`[Alpaca] Position closed: ${symbol}`);
    } catch (err) {
        logger.warn(`[Alpaca] closePosition(${symbol}): ${err.message}`);
    }
}

module.exports = { getAccount, getPositions, getBars, getLatestPrice, placeOrder, closePosition, wsEvents, connectWS };
