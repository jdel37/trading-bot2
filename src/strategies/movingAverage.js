'use strict';
/**
 * Strategy: EMA Crossover
 * BUY  when fast EMA crosses above slow EMA
 * SELL when fast EMA crosses below slow EMA
 */
const { ema } = require('../utils/indicators');
const { STRATEGY_CONFIG } = require('../config');

function analyze(bars) {
    const closes = bars.map(b => b.close);
    const { fast, slow } = STRATEGY_CONFIG.ema;
    if (closes.length < slow + 1) return { signal: 'HOLD', reason: 'Not enough data' };

    const emaFastNow = ema(closes, fast);
    const emaSlowNow = ema(closes, slow);
    const emaFastPrev = ema(closes.slice(0, -1), fast);
    const emaSlowPrev = ema(closes.slice(0, -1), slow);

    if (!emaFastNow || !emaSlowNow || !emaFastPrev || !emaSlowPrev) {
        return { signal: 'HOLD', reason: 'Indicator not ready' };
    }

    const crossedUp = emaFastPrev <= emaSlowPrev && emaFastNow > emaSlowNow;
    const crossedDown = emaFastPrev >= emaSlowPrev && emaFastNow < emaSlowNow;

    const meta = {
        emaFast: emaFastNow.toFixed(4),
        emaSlow: emaSlowNow.toFixed(4),
    };

    if (crossedUp) return { signal: 'BUY', reason: `EMA${fast} crossed above EMA${slow}`, ...meta };
    if (crossedDown) return { signal: 'SELL', reason: `EMA${fast} crossed below EMA${slow}`, ...meta };
    return { signal: 'HOLD', reason: 'No crossover', ...meta };
}

module.exports = { analyze };
