'use strict';
/**
 * Strategy: RSI (Relative Strength Index)
 * BUY  when RSI < oversold threshold (default 30)
 * SELL when RSI > overbought threshold (default 70)
 */
const { rsi: calcRSI } = require('../utils/indicators');
const { STRATEGY_CONFIG } = require('../config');

function analyze(bars) {
    const closes = bars.map(b => b.close);
    const { period, oversold, overbought } = STRATEGY_CONFIG.rsi;
    if (closes.length < period + 2) return { signal: 'HOLD', reason: 'Not enough data' };

    const rsiNow = calcRSI(closes, period);
    const rsiPrev = calcRSI(closes.slice(0, -1), period);

    if (rsiNow === null) return { signal: 'HOLD', reason: 'RSI not ready' };

    const meta = { rsi: rsiNow.toFixed(2) };

    // Cross below oversold from above (entering oversold zone)
    if (rsiPrev !== null && rsiPrev >= oversold && rsiNow < oversold) {
        return { signal: 'BUY', reason: `RSI entered oversold (${rsiNow.toFixed(2)} < ${oversold})`, ...meta };
    }
    // Cross above overbought from below (entering overbought zone)
    if (rsiPrev !== null && rsiPrev <= overbought && rsiNow > overbought) {
        return { signal: 'SELL', reason: `RSI entered overbought (${rsiNow.toFixed(2)} > ${overbought})`, ...meta };
    }
    // Extreme values (fallback if no crossing tracked)
    if (rsiNow < oversold) return { signal: 'BUY', reason: `RSI oversold (${rsiNow.toFixed(2)})`, ...meta };
    if (rsiNow > overbought) return { signal: 'SELL', reason: `RSI overbought (${rsiNow.toFixed(2)})`, ...meta };

    return { signal: 'HOLD', reason: `RSI neutral (${rsiNow.toFixed(2)})`, ...meta };
}

module.exports = { analyze };
