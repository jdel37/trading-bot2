'use strict';
require('dotenv').config();
const connectDB = require('./db/connection');
const MarketData = require('./models/MarketData');
const logger = require('./logger');
const { SYMBOLS, STRATEGY, STRATEGY_CONFIG, RISK, TIMEFRAME } = require('./config');
const strategy = require('./strategies/index');
const { checkExit, canOpenPosition, calcPositionSize } = require('./risk/riskManager');

// ── Broker adapter (dynamic) ───────────────────────────────
const BROKER = (process.env.BROKER || 'alpaca').toLowerCase();
const broker = BROKER === 'binance' ? require('./brokers/binance') : require('./brokers/alpaca');

const INITIAL_CAPITAL = 10000;

async function fetchHistoricalData(symbol, limit = 1000) {
    logger.info(`[Backtest] Fetching historical data for ${symbol}...`);
    const bars = await broker.getBars(symbol, limit);
    if (!bars || bars.length === 0) return [];

    try {
        const bulkOps = bars.map(b => ({
            updateOne: {
                filter: { symbol, timeframe: TIMEFRAME, time: new Date(b.time) },
                update: { $set: { open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume } },
                upsert: true
            }
        }));
        await MarketData.bulkWrite(bulkOps);
        logger.info(`[Backtest] Cached ${bars.length} bars for ${symbol}`);
    } catch (err) {
        logger.warn(`[Backtest] DB cache warning: ${err.message}`);
    }
    return bars;
}

async function runBacktest() {
    await connectDB();
    logger.info(`\n==== STARTING BACKTEST ====`);
    logger.info(`Strategy: ${STRATEGY.toUpperCase()} | Symbols: ${SYMBOLS.join(', ')}`);
    logger.info(`Initial Capital: $${INITIAL_CAPITAL}\n`);

    let totalEquity = INITIAL_CAPITAL;
    let positions = [];
    let trades = [];

    for (const symbol of SYMBOLS) {
        // Fetch up to 2000 bars
        const bars = await fetchHistoricalData(symbol, 2000);
        if (bars.length < 50) {
            logger.warn(`[Backtest] Not enough data for ${symbol}. Skipping.`);
            continue;
        }

        logger.info(`[Backtest] Analyzing ${bars.length} bars for ${symbol}...`);

        let position = null; // simulate a single position per symbol

        // Loop chronologically, feeding a window of data to the strategy
        for (let i = 50; i < bars.length; i++) {
            const currentWindow = bars.slice(i - 50, i + 1);
            const currentBar = bars[i];
            const currentPrice = currentBar.close;

            // Check exit first
            if (position) {
                // Update unrealized pnl roughly
                position.currentPrice = currentPrice;
                position.pnl = (currentPrice - position.entryPrice) * position.qty;
                position.pnlPct = (position.pnl / (position.entryPrice * position.qty)) * 100;

                const exitReason = checkExit(position, currentPrice);
                if (exitReason) {
                    trades.push({ symbol, action: `SELL (${exitReason})`, price: currentPrice, time: currentBar.time, pnl: position.pnl });
                    totalEquity += position.pnl; // add realized pnl to equity
                    position = null;
                }
            }

            // Analyze signal
            const result = strategy.analyze(currentWindow, position);

            if (result.signal === 'BUY' && !position) {
                const qty = calcPositionSize(totalEquity, currentPrice);
                if (qty > 0) {
                    position = {
                        symbol,
                        side: 'long',
                        qty,
                        entryPrice: currentPrice,
                        currentPrice: currentPrice,
                        pnl: 0,
                        pnlPct: 0
                    };
                    trades.push({ symbol, action: 'BUY', price: currentPrice, time: currentBar.time, qty });
                }
            } else if (result.signal === 'SELL' && position) {
                // Manual sell signal override
                position.pnl = (currentPrice - position.entryPrice) * position.qty;
                trades.push({ symbol, action: 'SELL (Signal)', price: currentPrice, time: currentBar.time, pnl: position.pnl });
                totalEquity += position.pnl;
                position = null;
            }
        }

        // Close dangling position at the end of the data
        if (position) {
            position.pnl = (bars[bars.length - 1].close - position.entryPrice) * position.qty;
            trades.push({ symbol, action: 'SELL (End of Data)', price: bars[bars.length - 1].close, time: bars[bars.length - 1].time, pnl: position.pnl });
            totalEquity += position.pnl;
        }
    }

    // Print Report
    const winTrades = trades.filter(t => t.pnl > 0);
    const lossTrades = trades.filter(t => t.pnl <= 0);
    const winRate = trades.length > 0 ? (winTrades.length / (winTrades.length + lossTrades.length)) * 100 : 0;
    const finalReturn = ((totalEquity - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

    console.log(`\n==== BACKTEST REPORT ====`);
    console.log(`Total Trades: ${trades.filter(t => t.action.includes('SELL')).length}`);
    console.log(`Win Rate: ${winRate.toFixed(2)}% (${winTrades.length} W / ${lossTrades.length} L)`);
    console.log(`Starting Equity: $${INITIAL_CAPITAL.toFixed(2)}`);
    console.log(`Final Equity: $${totalEquity.toFixed(2)}`);
    console.log(`Total Return: ${finalReturn.toFixed(2)}%`);
    console.log(`=========================\n`);

    process.exit(0);
}

runBacktest();
