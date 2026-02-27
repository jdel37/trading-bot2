'use strict';
const { RISK } = require('../config');
const logger = require('../logger');

/**
 * Calculate how many units to buy given current equity and price.
 * Never risks more than RISK_PER_TRADE % of total equity per trade.
 */
function calcPositionSize(equity, price) {
    if (!price || price <= 0) return 0;
    const maxRisk = equity * RISK.riskPerTrade;
    const qty = maxRisk / price;
    return qty;
}

/**
 * Check if we are allowed to open a new position
 * given the current number of open positions.
 */
function canOpenPosition(currentPositions) {
    return currentPositions < RISK.maxPositions;
}

/**
 * Compute stop-loss and take-profit prices for an entry.
 */
function calcLevels(entryPrice, side = 'buy') {
    if (side === 'buy') {
        return {
            stopLoss: entryPrice * (1 - RISK.stopLossPct),
            takeProfit: entryPrice * (1 + RISK.takeProfitPct),
        };
    } else {
        return {
            stopLoss: entryPrice * (1 + RISK.stopLossPct),
            takeProfit: entryPrice * (1 - RISK.takeProfitPct),
        };
    }
}

/**
 * Check if an open position has hit stop-loss or take-profit.
 * Returns 'STOP_LOSS' | 'TAKE_PROFIT' | null
 */
function checkExit(position, currentPrice) {
    const { stopLoss, takeProfit } = calcLevels(position.entryPrice, position.side);

    if (position.side === 'long' || position.side === 'buy') {
        if (currentPrice <= stopLoss) {
            logger.warn(`[Risk] ${position.symbol} hit STOP-LOSS @ ${currentPrice.toFixed(4)} (limit: ${stopLoss.toFixed(4)})`);
            return 'STOP_LOSS';
        }
        if (currentPrice >= takeProfit) {
            logger.info(`[Risk] ${position.symbol} hit TAKE-PROFIT @ ${currentPrice.toFixed(4)} (target: ${takeProfit.toFixed(4)})`);
            return 'TAKE_PROFIT';
        }
    }
    return null;
}

module.exports = { calcPositionSize, canOpenPosition, calcLevels, checkExit };
