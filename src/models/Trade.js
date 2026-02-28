'use strict';
const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
    symbol: { type: String, required: true },
    action: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: mongoose.Schema.Types.Mixed, required: true }, // can be number or 'position'
    ts: { type: Date, default: Date.now },
});

// Index for efficient querying by symbol or time
tradeSchema.index({ ts: -1 });
tradeSchema.index({ symbol: 1, ts: -1 });

module.exports = mongoose.model('Trade', tradeSchema);
