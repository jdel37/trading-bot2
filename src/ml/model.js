'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const brain = require('brain.js/dist/index');

const connectDB = require('../db/connection');
const MarketData = require('../models/MarketData');
const logger = require('../logger');
const { prepareFeatures, buildTrainingSet, normalize } = require('./dataUtils');

const MODEL_PATH = path.join(__dirname, 'model_weights.json');

// Brain.js LSTM Network
const net = new brain.recurrent.LSTMTimeStep({
    inputSize: 5,
    hiddenLayers: [10, 10],
    outputSize: 1
});

async function trainModel(symbol = 'BTC/USD', limit = 2000) {
    logger.info(`[ML Train] Connecting to DB...`);
    await connectDB();

    logger.info(`[ML Train] Fetching last ${limit} bars of ${symbol}...`);
    const bars = await MarketData.find({ symbol }).sort({ time: 1 }).limit(limit).lean();

    if (bars.length < 100) {
        logger.error(`[ML Train] Not enough data in MongoDB. Run Backtest first to cache data.`);
        process.exit(1);
    }

    logger.info(`[ML Train] Preparing features and normalizing dataset...`);
    const features = prepareFeatures(bars);

    // Future ticks to predict ahead: 3 bars
    const trainingData = buildTrainingSet(features, bars, 3);
    logger.info(`[ML Train] Created ${trainingData.length} training examples.`);

    logger.info(`[ML Train] Training LSTM network (this might take a few minutes)...`);

    // Train the network
    net.train(trainingData, {
        iterations: 100, // keep low for quick demo, increase for production
        errorThresh: 0.05,
        log: (stats) => console.log(stats),
        logPeriod: 10,
        learningRate: 0.01
    });

    // Save
    const modelData = net.toJSON();
    fs.writeFileSync(MODEL_PATH, JSON.stringify(modelData));

    logger.info(`[ML Train] Training complete. Saved to ${MODEL_PATH}`);
    process.exit(0);
}

// ── ML Prediction Runner ───────────────────────────────────
let loadedNet = null;

function loadModel() {
    if (loadedNet) return loadedNet;
    if (fs.existsSync(MODEL_PATH)) {
        loadedNet = new brain.recurrent.LSTMTimeStep({
            inputSize: 5,
            hiddenLayers: [10, 10],
            outputSize: 1
        });
        const modelData = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
        loadedNet.fromJSON(modelData);
        logger.info(`[ML] Model loaded from disk.`);
        return loadedNet;
    }
    return null;
}

function predict(features) {
    if (!loadedNet) {
        logger.warn(`[ML] Model not built yet. Run 'npm run train' first.`);
        return 0.5; // neutral confidence
    }

    // We pass the last 5 sequences to predict the next step
    const inputWindow = features.slice(-5);
    const output = loadedNet.run(inputWindow);
    // output is either an array [val] or a raw value depending on brain.js version
    return Array.isArray(output) ? output[0] : output;
}

// ── Run directly ───────────────────────────────────────────
if (require.main === module) {
    trainModel('BTC/USD', 2000).catch(err => {
        logger.error(`[ML Train Error] ${err.message}`);
        process.exit(1);
    });
}

module.exports = { trainModel, loadModel, predict };
