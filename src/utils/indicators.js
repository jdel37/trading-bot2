'use strict';
/**
 * Pure technical analysis indicator implementations.
 * All functions accept arrays of numbers (closing prices unless noted).
 */

/**
 * Simple Moving Average
 */
function sma(data, period) {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Exponential Moving Average
 */
function ema(data, period) {
    if (data.length < period) return null;
    const k = 2 / (period + 1);
    let result = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
        result = data[i] * k + result * (1 - k);
    }
    return result;
}

/**
 * Relative Strength Index (RSI)
 * Returns the latest RSI value (0–100).
 */
function rsi(data, period = 14) {
    if (data.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = data[i] - data[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        const gain = diff >= 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
}

/**
 * MACD — Moving Average Convergence Divergence
 * Returns { macdLine, signalLine, histogram }
 */
function macd(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (data.length < slowPeriod + signalPeriod) return null;

    // Build EMA arrays
    const kFast = 2 / (fastPeriod + 1);
    const kSlow = 2 / (slowPeriod + 1);
    const kSignal = 2 / (signalPeriod + 1);

    // Seed EMAs using SMA
    let emaFast = data.slice(0, fastPeriod).reduce((a, b) => a + b, 0) / fastPeriod;
    let emaSlow = data.slice(0, slowPeriod).reduce((a, b) => a + b, 0) / slowPeriod;

    const macdLine = [];

    for (let i = slowPeriod; i < data.length; i++) {
        // Update slow from the beginning
        if (i < slowPeriod) continue;
        if (i === slowPeriod) {
            emaFast = data.slice(i - fastPeriod, i).reduce((a, b) => a + b, 0) / fastPeriod;
        } else {
            emaFast = data[i] * kFast + emaFast * (1 - kFast);
        }
        emaSlow = data[i] * kSlow + emaSlow * (1 - kSlow);
        macdLine.push(emaFast - emaSlow);
    }

    if (macdLine.length < signalPeriod) return null;

    let signalLine = macdLine.slice(0, signalPeriod).reduce((a, b) => a + b, 0) / signalPeriod;
    for (let i = signalPeriod; i < macdLine.length; i++) {
        signalLine = macdLine[i] * kSignal + signalLine * (1 - kSignal);
    }

    const currentMACD = macdLine[macdLine.length - 1];
    const prevMACD = macdLine.length > 1 ? macdLine[macdLine.length - 2] : null;

    return {
        macdLine: currentMACD,
        signalLine,
        histogram: currentMACD - signalLine,
        prevMacdLine: prevMACD,
    };
}

/**
 * Bollinger Bands
 * Returns { upper, middle, lower }
 */
function bollingerBands(data, period = 20, stdDevMult = 2) {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    const middle = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, v) => sum + Math.pow(v - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    return {
        upper: middle + stdDevMult * stdDev,
        middle,
        lower: middle - stdDevMult * stdDev,
    };
}

module.exports = { sma, ema, rsi, macd, bollingerBands };
