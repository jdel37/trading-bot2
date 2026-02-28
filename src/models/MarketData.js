'use strict';
const mongoose = require('mongoose');

const marketDataSchema = new mongoose.Schema({
    symbol: { type: String, required: true },
    timeframe: { type: String, required: true },
    time: { type: Date, required: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, required: true },
});

// Index for efficient querying by symbol + timeframe + time
marketDataSchema.index({ symbol: 1, timeframe: 1, time: 1 }, { unique: true });

module.exports = mongoose.model('MarketData', marketDataSchema);
