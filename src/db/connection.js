'use strict';
const mongoose = require('mongoose');
const logger = require('../logger');
const { MONGO_URI } = require('../config');

async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI);
        logger.info(`[DB] Connected to MongoDB at ${MONGO_URI}`);
    } catch (err) {
        logger.error(`[DB] Connection error: ${err.message}`);
        process.exit(1);
    }
}

mongoose.connection.on('disconnected', () => {
    logger.warn('[DB] MongoDB disconnected');
});

module.exports = connectDB;
