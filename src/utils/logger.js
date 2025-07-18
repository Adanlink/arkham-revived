const pino = require('pino');
const rfs = require('rotating-file-stream');
const path = require('path');

const logDirectory = path.join(__dirname, '..', '..', 'logs');

// Ensure log directory exists
const fs = require('fs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

const stream = rfs.createStream('app.log', {
  size: '16M', // rotate every 16 MegaBytes
  interval: '1d', // rotate daily
  path: logDirectory,
  compress: 'gzip', // compress rotated files
  maxFiles: 365 // keep 365 days of logs
});

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: 'UTC:yyyy-mm-dd\'T\'HH:MM:ss\'Z\'',
    },
  },
}, stream);

module.exports = logger;
