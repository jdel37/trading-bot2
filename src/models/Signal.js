'use strict';
const mongoose = require('mongoose');

const signalSchema = new mongoose.Schema({
    symbol: { type: String, required: true },
    signal: { type: String, required: true }, // 'BUY', 'SELL', 'HOLD'
    reason: { type: String },
    price: { type: Number, required: true },
    rsi: { type: Number },
    emaFast: { type: Number },
    emaSlow: { type: Number },
    histogram: { type: Number },
    ts: { type: Date, default: Date.now },
});

// Index for efficient querying by symbol or time
signalSchema.index({ ts: -1 });
signalSchema.index({ symbol: 1, ts: -1 });

module.exports = mongoose.model('Signal', signalSchema);
