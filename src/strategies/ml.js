'use strict';

const ti = require('technicalindicators');
const { loadModel, predict } = require('../ml/model');
const { prepareFeatures } = require('../ml/dataUtils');

module.exports = {
    analyze: (bars, currentPosition) => {
        if (!bars || bars.length < 50) return { signal: 'HOLD', reason: 'Not enough data' };

        loadModel(); // ensure brain.js weights are loaded in memory if available

        const closes = bars.map(b => b.close);
        const lastPrice = closes[closes.length - 1];

        // 1. Technical Analysis Base
        const rsiInput = { values: closes, period: 14 };
        const rawRsi = ti.RSI.calculate(rsiInput);
        const currentRsi = rawRsi[rawRsi.length - 1];

        // 2. ML Prediction
        const features = prepareFeatures(bars);
        if (features.length < 5) return { signal: 'HOLD', reason: 'Not enough features to predict' };

        const confidence = predict(features);
        // brain.js output ranges. Typically near 0 for DOWN, near 1 for UP in our setup.

        // 3. Hybrid Strategy
        let signal = 'HOLD';
        let reason = `RSI=${currentRsi.toFixed(1)} LSTM=${confidence.toFixed(2)}`;

        // Confidence > 0.6 means the neural net expects it to go UP
        if (confidence > 0.60 && currentRsi < 70) {
            signal = 'BUY';
        }
        // Confidence < 0.4 means DOWN
        else if (confidence < 0.40 && currentPosition) {
            signal = 'SELL';
        }
        // Stop-loss or extreme overbought override
        else if (currentPosition && currentRsi > 80) {
            signal = 'SELL';
            reason += ' (Overbought Override)';
        }

        return {
            signal,
            reason
        };
    }
};
