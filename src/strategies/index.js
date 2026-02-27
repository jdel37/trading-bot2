'use strict';
const { STRATEGY } = require('../config');
const logger = require('../logger');

const strategies = {
    movingaverage: require('./movingAverage'),
    rsi: require('./rsi'),
    macd: require('./macd'),
};

const key = STRATEGY.toLowerCase().replace(/[^a-z]/g, '');

if (!strategies[key]) {
    logger.error(`Unknown strategy: "${STRATEGY}". Valid options: movingAverage, rsi, macd`);
    process.exit(1);
}

logger.info(`[Strategy] Using: ${STRATEGY}`);

module.exports = strategies[key];
