'use strict';
/**
 * Strategy: MACD (Moving Average Convergence Divergence)
 * BUY  when MACD line crosses above signal line (bullish crossover)
 * SELL when MACD line crosses below signal line (bearish crossover)
 */
const { macd: calcMACD } = require('../utils/indicators');
const { STRATEGY_CONFIG } = require('../config');

function analyze(closes) {
    const { fast, slow, signal } = STRATEGY_CONFIG.macd;
    const needed = slow + signal + 2;
    if (closes.length < needed) return { signal: 'HOLD', reason: 'Not enough data' };

    const current = calcMACD(closes, fast, slow, signal);
    const previous = calcMACD(closes.slice(0, -1), fast, slow, signal);

    if (!current || !previous) return { signal: 'HOLD', reason: 'MACD not ready' };

    const meta = {
        macdLine: current.macdLine.toFixed(4),
        signalLine: current.signalLine.toFixed(4),
        histogram: current.histogram.toFixed(4),
    };

    // Bullish crossover: MACD was below signal, now above
    const bullishCross = previous.macdLine <= previous.signalLine && current.macdLine > current.signalLine;
    // Bearish crossover: MACD was above signal, now below
    const bearishCross = previous.macdLine >= previous.signalLine && current.macdLine < current.signalLine;

    if (bullishCross) return { signal: 'BUY', reason: 'MACD bullish crossover', ...meta };
    if (bearishCross) return { signal: 'SELL', reason: 'MACD bearish crossover', ...meta };

    return { signal: 'HOLD', reason: 'No MACD crossover', ...meta };
}

module.exports = { analyze };
