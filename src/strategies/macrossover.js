'use strict';
/**
 * Strategy: Quant-Optimized Trend System
 * BUY when:
 * 1. Trend Filter: EMA 50 > EMA 200
 * 2. Pullback Trigger: Close < EMA 21 (pullback to value)
 * 3. Rejection: Close > Open (bullish candle confirmation)
 */
const { ema, atr } = require('../utils/indicators');
const { STRATEGY_CONFIG } = require('../config');

function analyze(bars, position = null) {
    const { fastMA, slowMA, pullbackMA, atrPeriod, stopLossAtr } = STRATEGY_CONFIG.macrossover;

    // Need enough bars for 200 MA + ATR
    if (bars.length < slowMA + 1 || bars.length < atrPeriod + 1) {
        return { signal: 'HOLD', reason: 'Not enough data' };
    }

    const closes = bars.map(b => b.close);

    const fastMaNow = ema(closes, fastMA);
    const slowMaNow = ema(closes, slowMA);
    const pullbackMaNow = ema(closes, pullbackMA);
    const pullbackMaPrev = ema(closes.slice(0, -1), pullbackMA);
    const fastMaPrev = ema(closes.slice(0, -1), fastMA);

    const currentAtr = atr(bars, atrPeriod);

    if (!fastMaNow || !slowMaNow || !pullbackMaNow || !pullbackMaPrev || !fastMaPrev || currentAtr === null) {
        return { signal: 'HOLD', reason: 'Indicators not ready' };
    }

    const lastBar = bars[bars.length - 1];
    const currentPrice = lastBar.close;
    const currentOpen = lastBar.open;

    // 1. Structural Trend Filter
    const isUptrend = fastMaNow > slowMaNow;

    // 2. Value Pullback Trigger
    const isPullback = currentPrice < pullbackMaNow;

    // 3. Confirmation
    const isBullishCandle = currentPrice > currentOpen;

    const meta = {
        fastMA: fastMaNow.toFixed(4),
        slowMA: slowMaNow.toFixed(4),
        pullbackMA: pullbackMaNow.toFixed(4),
        atr: currentAtr.toFixed(4)
    };

    // Custom risk management if already in a position
    if (position) {
        const entryPrice = position.entryPrice;
        const stopLoss = entryPrice - (currentAtr * stopLossAtr);

        // Hard Stop Loss (1.5 ATR to absorb noise)
        if (currentPrice <= stopLoss) {
            return { signal: 'SELL', reason: `Stop Loss Hit (${stopLoss.toFixed(4)})`, ...meta };
        }

        // Dynamic Trailing Exit: Loss of short-term momentum (EMA 21 crosses down EMA 50)
        // Captures fat tails without limiting upside to a fixed TP
        const trailingExit = pullbackMaPrev >= fastMaPrev && pullbackMaNow < fastMaNow;
        if (trailingExit) {
            return { signal: 'SELL', reason: `Trailing Exit: MA${pullbackMA} crossed below MA${fastMA}`, ...meta };
        }

        return { signal: 'HOLD', reason: 'Position open, managing trailing risk', ...meta };
    }

    // Entry logic
    if (isUptrend && isPullback && isBullishCandle) {
        return { signal: 'BUY', reason: `Uptrend + Pullback to MA${pullbackMA} + Confirmation`, ...meta };
    }

    return { signal: 'HOLD', reason: 'Waiting for Pullback to Value', ...meta };
}

module.exports = { analyze };
