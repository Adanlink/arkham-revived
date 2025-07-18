const express = require("express");
const getUuid = require("uuid-by-string");
const logger = require('../utils/logger');
const {
    db
} = require("../db/database");

const router = express.Router();

router.post("/token", function(req, res) {
    if (!req.headers.authorization) {
        logger.warn('Token request with missing authorization header');
        return res.status(400).send("Invalid authorization header: Missing");
    }
    const authParts = req.headers.authorization.split(" ");
    if (authParts[0] !== "Basic" || !req.body.ticket) {
        logger.warn('Token request with invalid authorization header or missing ticket');
        return res.status(400).send("Invalid authorization header or missing ticket");
    }

    const ticketHeader = req.body.ticket.replace(/[_|-]/g, "");
    let uuid;

    const userByTicket = db.prepare("SELECT uuid FROM users WHERE consoleticket = ?").get(ticketHeader);
    if (userByTicket) {
        uuid = userByTicket.uuid;
        logger.info(`Found user by ticket: ${uuid}`);
    } else {
        const userByIp = db.prepare("SELECT uuid FROM users WHERE ip = ?").get(req.ip);
        if (userByIp) {
            uuid = userByIp.uuid;
            logger.info(`Found user by IP: ${uuid}`);
        } else {
            uuid = getUuid(ticketHeader);
            logger.info(`Generated new UUID: ${uuid}`);
        }
    }

    const tokenResponse = {
        "token_type": "bearer",
        "access_token": uuid,
        "expires_in": 1000000,
        "refresh_token": "",
    };
    logger.info(`Responding with token for UUID: ${uuid}`);
    res.json(tokenResponse);
});

module.exports = router;
