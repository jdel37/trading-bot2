'use strict';
const ti = require('technicalindicators');

// Normalize a value between 0 and 1 given min and max
function normalize(val, min, max) {
    if (max === min) return 0.5;
    const n = (val - min) / (max - min);
    return Math.max(0, Math.min(1, n)); // Clamp between 0 and 1
}

// Convert a raw candlestick array into an array of normalized features
function prepareFeatures(bars) {
    if (bars.length < 50) return [];

    const closes = bars.map(b => b.close);
    const volumes = bars.map(b => b.volume);

    // Calculate Indicators
    const rsi = ti.RSI.calculate({ values: closes, period: 14 });
    const macd = ti.MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
    const emaFast = ti.EMA.calculate({ values: closes, period: 9 });
    const emaSlow = ti.EMA.calculate({ values: closes, period: 21 });

    // We align arrays to the end
    const len = macd.length;
    const alignedBars = bars.slice(-len);
    const alignedRsi = rsi.slice(-len);
    const alignedEmaFast = emaFast.slice(-len);
    const alignedEmaSlow = emaSlow.slice(-len);

    // Find min/max for normalization over the window
    const minClose = Math.min(...alignedBars.map(b => b.close));
    const maxClose = Math.max(...alignedBars.map(b => b.close));
    const minVol = Math.min(...alignedBars.map(b => b.volume));
    const maxVol = Math.max(...alignedBars.map(b => b.volume));

    const features = [];

    for (let i = 0; i < len; i++) {
        // We need previous bar context, so skip first few if needed, but min/max handles it ok
        const bar = alignedBars[i];

        // 1. Normalized Close
        const nClose = normalize(bar.close, minClose, maxClose);
        // 2. Normalized Volume
        const nVol = normalize(bar.volume, minVol, maxVol);
        // 3. RSI (already 0-100, just divide by 100)
        const nRsi = alignedRsi[i] / 100;
        // 4. EMA Spread indicator (-1 to 1 space mostly, normalize to 0-1)
        const emaDiff = alignedEmaFast[i] - alignedEmaSlow[i];
        const nEmaDiff = normalize(emaDiff, -maxClose * 0.05, maxClose * 0.05); // Rough bounds
        // 5. MACD Histogram (Normalize rough bounds)
        const hist = macd[i].histogram || 0;
        const nHist = normalize(hist, -maxClose * 0.02, maxClose * 0.02);

        features.push([nClose, nVol, nRsi, nEmaDiff, nHist]);
    }

    return features;
}

// Create Training Data pairs { input: [...], output: [0 or 1] }
// We try to predict if the price goes UP in the next `futureTicks`
function buildTrainingSet(features, rawBars, futureTicks = 3) {
    const trainingData = [];
    const alignedBars = rawBars.slice(-features.length);

    for (let i = 0; i < features.length - futureTicks; i++) {
        const currentClose = alignedBars[i].close;
        const futureClose = alignedBars[i + futureTicks].close;

        // Output 1 if price went up, 0 if it went down or flat
        const didGoUp = futureClose > currentClose ? 1 : 0;

        // LSTM expects array of arrays (or consecutive steps). 
        // For simplicity, we feed a window of 5 previous steps into the net for each datapoint.
        const windowSize = 5;
        if (i >= windowSize) {
            const sequence = features.slice(i - windowSize + 1, i + 1);
            trainingData.push({
                input: sequence,
                output: [didGoUp]
            });
        }
    }
    return trainingData;
}

module.exports = { normalize, prepareFeatures, buildTrainingSet };
