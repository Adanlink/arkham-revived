// arkham-revived
// Licensed under the MIT License
// Copyright (c) 2023 KiwifruitDev

require('dotenv').config();
const express = require("express");
const fse = require("fs-extra");
const http = require("http");
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
const DEBUG = process.env.DEBUG === 'true';

if (!fse.existsSync("./usercfg")) {
    if (fse.existsSync("./basecfg")) {
        fse.copySync("./basecfg", "./usercfg");
    } else {
        console.log("WARNING: basecfg folder is missing! Re-install is recommended.");
        process.exit(1);
    }
}

const motd = JSON.parse(fse.readFileSync("./usercfg/motd.json"));
const app = express();
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
app.use(express.text({
    type: "text/xml"
}));

if (DEBUG) {
    app.use((req, res, next) => {
        console.log(`Request: ${req.method} ${req.url}`);
        next();
    });
}

app.get("/motd", function(req, res) {
    res.json(motd);
});

app.use("/auth", authRouter);
app.use("/files", filesRouter);
app.use("/store", storeRouter);
app.use("/users", usersRouter);

app.all("/actions/:action", (req, res) => {
    console.log(`Received request for unknown /actions endpoint: ${req.params.action}`);
    res.status(501).send("Not Implemented");
});

app.post("/CLS/WbAccountManagement.asmx", handleSoapRequest);
app.post("/CLS/WbSubscriptionManagement.asmx", handleSoapRequest);

const server = http.createServer(app);

server.listen(HTTP_PORT, () => {
    if (DEBUG) {
        console.log(`HTTP Server: Listening on port ${HTTP_PORT}`);
    }
});

server.on("error", (err) => {
    console.error("HTTP Server startup error:", err.message);
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
    console.log(`${signal} received. Shutting down gracefully...`);

    server.close((err) => {
        if (err) {
            console.error("Error during HTTP server shutdown:", err.message);
        } else {
            console.log("HTTP server closed.");
        }

        if (db && typeof db.close === 'function') {
            const dbCloseTimeout = setTimeout(() => {
                console.error("Database close timed out. Forcing exit.");
                process.exit(1);
            }, 5000);

            db.close((dbErr) => {
                clearTimeout(dbCloseTimeout);
                if (dbErr) {
                    console.error("Error closing database:", dbErr.message);
                    process.exit(1);
                } else {
                    console.log("Database connection closed.");
                    process.exit(0);
                }
            });
        } else {
            console.log("Database connection not available or already closed.");
            process.exit(err ? 1 : 0);
        }
    });

    const connectionDestroyTimeout = 2000;
    setTimeout(() => {
        if (activeConnections.size > 0) {
            console.log(`Forcing close of ${activeConnections.size} remaining connections after ${connectionDestroyTimeout}ms.`);
            activeConnections.forEach(connection => connection.destroy());
        }
    }, connectionDestroyTimeout);

    const forceExitTimeout = 10000;
    setTimeout(() => {
        console.error("Graceful shutdown timed out. Forcing exit.");
        process.exit(1);
    }, forceExitTimeout).unref();
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("uncaughtException", (err, origin) => {
    console.error(`Uncaught Exception at: ${origin}, error: ${err.message}`);
    console.error(err.stack);
    gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown("unhandledRejection");
});
