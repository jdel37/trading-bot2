'use strict';
/**
 * Main bot orchestration loop.
 * Runs on a cron schedule fetching market data, computing signals,
 * applying risk management, and executing orders.
 */
require('dotenv').config();
const cron = require('node-cron');
const logger = require('./logger');
const { SYMBOLS, CRON_SCHEDULE, BROKER, BAR_LIMIT } = require('./config');
const { calcPositionSize, canOpenPosition, checkExit } = require('./risk/riskManager');
const strategy = require('./strategies/index');

// ── Broker adapter (dynamic) ───────────────────────────────
const broker = BROKER === 'binance'
    ? require('./brokers/binance')
    : require('./brokers/alpaca');

// ── Shared state (broadcast to dashboard) ─────────────────
const state = {
    running: false,
    lastTick: null,
    account: { equity: 0, cash: 0, buyingPower: 0, pnl: 0 },
    positions: [],
    signals: [],   // ring buffer of recent signals
    trades: [],   // ring buffer of executed trades
    errors: [],
};

const MAX_LOG_ENTRIES = 50;

function pushSignal(entry) {
    state.signals.unshift({ ...entry, ts: new Date().toISOString() });
    if (state.signals.length > MAX_LOG_ENTRIES) state.signals.pop();
}

function pushTrade(entry) {
    state.trades.unshift({ ...entry, ts: new Date().toISOString() });
    if (state.trades.length > MAX_LOG_ENTRIES) state.trades.pop();
}

// ── Event emitter for WebSocket broadcast ─────────────────
const { EventEmitter } = require('events');
const botEvents = new EventEmitter();

// ── Main tick ──────────────────────────────────────────────
async function tick() {
    state.running = true;
    state.lastTick = new Date().toISOString();

    try {
        // 1. Fetch account info
        state.account = await broker.getAccount();
        logger.info(`[Bot] Equity: $${state.account.equity.toFixed(2)} | P&L: $${state.account.pnl.toFixed(2)}`);

        // 2. Fetch open positions
        state.positions = await broker.getPositions();

        // 3. Check stop-loss / take-profit on existing positions
        for (const pos of state.positions) {
            const currentPrice = await broker.getLatestPrice(pos.symbol);
            if (!currentPrice) continue;
            const exit = checkExit(pos, currentPrice);
            if (exit) {
                logger.warn(`[Bot] Closing ${pos.symbol} (${exit})`);
                await broker.closePosition(pos.symbol);
                pushTrade({ symbol: pos.symbol, action: `CLOSE (${exit})`, price: currentPrice, qty: pos.qty });
            }
        }

        // 4. Re-fetch positions after closes
        state.positions = await broker.getPositions();
        const openSymbols = new Set(state.positions.map(p => p.symbol.replace('/', '')));

        // 5. Evaluate each symbol
        for (const symbol of SYMBOLS) {
            try {
                const bars = await broker.getBars(symbol, BAR_LIMIT);
                if (!bars || bars.length < 30) {
                    logger.warn(`[Bot] Not enough bars for ${symbol} (got ${bars?.length || 0})`);
                    continue;
                }

                const cleanSymbol = symbol.replace('/', '');
                const alreadyOpen = openSymbols.has(cleanSymbol) || openSymbols.has(symbol);
                const currentPosition = state.positions.find(p => p.symbol === symbol || p.symbol.replace('/', '') === cleanSymbol);

                const result = strategy.analyze(bars, currentPosition);
                const lastPrice = bars[bars.length - 1].close;

                logger.info(`[Signal] ${symbol} → ${result.signal} | ${result.reason} | Price: ${lastPrice.toFixed(4)}`);
                pushSignal({ symbol, ...result, price: lastPrice });

                if (result.signal === 'BUY' && !alreadyOpen) {
                    if (!canOpenPosition(state.positions.length)) {
                        logger.warn(`[Risk] Max positions (${state.positions.length}) reached, skipping ${symbol}`);
                        continue;
                    }
                    const qty = calcPositionSize(state.account.equity, lastPrice);
                    if (qty > 0) {
                        const order = await broker.placeOrder(symbol, qty, 'buy');
                        if (order) {
                            pushTrade({ symbol, action: 'BUY', price: lastPrice, qty: qty.toFixed(6) });
                            openSymbols.add(cleanSymbol);
                        }
                    }
                } else if (result.signal === 'SELL' && alreadyOpen) {
                    await broker.closePosition(symbol);
                    pushTrade({ symbol, action: 'SELL/CLOSE', price: lastPrice, qty: 'position' });
                    openSymbols.delete(cleanSymbol);
                }
            } catch (err) {
                logger.error(`[Bot] Error processing ${symbol}: ${err.message}`);
                state.errors.unshift({ symbol, message: err.message, ts: new Date().toISOString() });
                if (state.errors.length > 20) state.errors.pop();
            }
        }
    } catch (err) {
        logger.error(`[Bot] Tick error: ${err.message}`);
        state.errors.unshift({ message: err.message, ts: new Date().toISOString() });
    }

    // Broadcast updated state
    botEvents.emit('state', state);
}

// ── Start ──────────────────────────────────────────────────
function start() {
    logger.info(`[Bot] Starting — Broker: ${BROKER.toUpperCase()} | Symbols: ${SYMBOLS.join(', ')}`);
    logger.info(`[Bot] Schedule: "${CRON_SCHEDULE}"`);

    // Run immediately on start
    tick().catch(err => logger.error(`[Bot] Initial tick failed: ${err.message}`));

    // Then run on cron
    cron.schedule(CRON_SCHEDULE, () => {
        tick().catch(err => logger.error(`[Bot] Cron tick failed: ${err.message}`));
    });
}

module.exports = { start, tick, state, botEvents };
