'use strict';
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, errors } = format;
require('winston-mongodb');
const { MONGO_URI } = require('./config');

const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp}  ${level.padEnd(7)}  ${stack || message}`;
});

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat
    ),
    transports: process.env.VERCEL ? [
        new transports.Console({
            format: combine(
                colorize({ all: true }),
                timestamp({ format: 'HH:mm:ss' }),
                logFormat
            ),
        })
    ] : [
        new transports.Console({
            format: combine(
                colorize({ all: true }),
                timestamp({ format: 'HH:mm:ss' }),
                logFormat
            ),
        }),
        new transports.File({
            filename: 'logs/error.log',
            level: 'error',
        }),
        new transports.File({
            filename: 'logs/combined.log',
        }),
        new transports.MongoDB({
            db: MONGO_URI,
            collection: 'logs',
            level: 'info',
            format: format.combine(format.timestamp(), format.json())
        })
    ],
});

module.exports = logger;
