// arkham-revived
// Licensed under the MIT License
// Copyright (c) 2023 KiwifruitDev

require('dotenv').config();
const express = require("express");
const fse = require("fs-extra");
const http = require("http");
const logger = require('./src/utils/logger');
const {
    db
} = require("./src/db/database");
const {
    handleSoapRequest
} = require("./src/soap/service");
const authRouter = require("./src/routes/auth");
const filesRouter = require("./src/routes/files");
const storeRouter = require("./src/routes/store");
const usersRouter = require("./src/routes/users");

const HTTP_PORT = process.env.HTTP_PORT || 8080;

if (!fse.existsSync("./usercfg")) {
    if (fse.existsSync("./basecfg")) {
        fse.copySync("./basecfg", "./usercfg");
    } else {
        logger.warn("basecfg folder is missing! Re-install is recommended.");
        process.exit(1);
    }
}

const motd = JSON.parse(fse.readFileSync("./basecfg/motd.json"));
const app = express();
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
app.use(express.text({
    type: "text/xml"
}));

app.use((req, res, next) => {
    logger.info(`Request: ${req.method} ${req.url}`);
    if (process.env.LOG_LEVEL === 'verbose') {
        logger.debug({
            headers: req.headers,
            body: req.body
        }, 'Verbose request log');
    }
    next();
});

app.get("/motd", function(req, res) {
    res.json(motd);
});

app.use("/auth", authRouter);
app.use("/files", filesRouter);
app.use("/store", storeRouter);
app.use("/users", usersRouter);

app.all("/actions/:action", (req, res) => {
    logger.info(`Received request for unknown /actions endpoint: ${req.params.action}`);
    res.status(501).send("Not Implemented");
});

app.post("/CLS/WbAccountManagement.asmx", handleSoapRequest);
app.post("/CLS/WbSubscriptionManagement.asmx", handleSoapRequest);

const server = http.createServer(app);

server.listen(HTTP_PORT, () => {
    logger.info(`HTTP Server: Listening on port ${HTTP_PORT}`);
});

server.on("error", (err) => {
    logger.error("HTTP Server startup error:", err.message);
    process.exit(1);
});

const activeConnections = new Set();
server.on('connection', (connection) => {
    activeConnections.add(connection);
    connection.on('close', () => {
        activeConnections.delete(connection);
    });
});

function gracefulShutdown(signal) {
    logger.info(`${signal} received. Shutting down gracefully...`);

    server.close((err) => {
        if (err) {
            logger.error("Error during HTTP server shutdown:", err.message);
        } else {
            logger.info("HTTP server closed.");
        }

        if (db && typeof db.close === 'function') {
            const dbCloseTimeout = setTimeout(() => {
                logger.error("Database close timed out. Forcing exit.");
                process.exit(1);
            }, 5000);

            db.close((dbErr) => {
                clearTimeout(dbCloseTimeout);
                if (dbErr) {
                    logger.error("Error closing database:", dbErr.message);
                    process.exit(1);
                } else {
                    logger.info("Database connection closed.");
                    process.exit(0);
                }
            });
        } else {
            logger.info("Database connection not available or already closed.");
            process.exit(err ? 1 : 0);
        }
    });

    const connectionDestroyTimeout = 2000;
    setTimeout(() => {
        if (activeConnections.size > 0) {
            logger.info(`Forcing close of ${activeConnections.size} remaining connections after ${connectionDestroyTimeout}ms.`);
            activeConnections.forEach(connection => connection.destroy());
        }
    }, connectionDestroyTimeout);

    const forceExitTimeout = 10000;
    setTimeout(() => {
        logger.error("Graceful shutdown timed out. Forcing exit.");
        process.exit(1);
    }, forceExitTimeout).unref();
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("uncaughtException", (err, origin) => {
    logger.error({
        err,
        origin
    }, 'Uncaught Exception');
    gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error({
        reason,
        promise
    }, 'Unhandled Rejection');
    gracefulShutdown("unhandledRejection");
});
