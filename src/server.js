'use strict';
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const logger = require('./logger');
const { PORT } = require('./config');
const bot = require('./bot');
const connectDB = require('./db/connection');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ── Static dashboard ───────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'dashboard')));

// ── REST: current state snapshot ──────────────────────────
app.get('/api/state', (req, res) => {
    res.json(bot.state);
});

// ── Vercel Cron Endpoint ──────────────────────────────────
app.get('/api/cron', async (req, res) => {
    try {
        if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        await bot.tick();
        res.status(200).json({ success: true, message: 'Tick executed' });
    } catch (err) {
        logger.error(`[Cron] Error: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── WebSocket: push state to all clients ──────────────────
function broadcast(data) {
    const payload = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

bot.botEvents.on('state', (state) => {
    broadcast({ type: 'STATE_UPDATE', data: state });
});

wss.on('connection', (ws) => {
    logger.info('[WS] Dashboard client connected');
    // Send current state immediately on connect
    ws.send(JSON.stringify({ type: 'STATE_UPDATE', data: bot.state }));

    ws.on('close', () => logger.info('[WS] Dashboard client disconnected'));
});

// ── Start server + bot ─────────────────────────────────────
if (require.main === module) {
    server.listen(PORT, async () => {
        logger.info(`[Server] Dashboard running at http://localhost:${PORT}`);
        await connectDB();
        bot.start();
    });
}

// ── Graceful shutdown ──────────────────────────────────────
process.on('SIGINT', () => { logger.info('[Server] Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => { logger.info('[Server] Shutting down...'); process.exit(0); });

module.exports = app;
