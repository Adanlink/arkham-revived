const express = require("express");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const {
    db,
    baseinventory,
    save
} = require("../db/database");

const router = express.Router();

router.post("/token", function(req, res) {
    if (!req.headers.authorization) {
        logger.warn('Token request with missing authorization header');
        return res.status(400).send("Invalid authorization header: Missing");
    }

    const authParts = req.headers.authorization.split(" ");
    if (authParts[0] !== "Basic" || authParts.length !== 2) {
        logger.warn('Token request with invalid authorization header format');
        return res.status(400).send("Invalid authorization header: Must be Basic auth");
    }

    const credentials = Buffer.from(authParts[1], 'base64').toString('utf-8').split(':');
    const uuid = credentials[0];
    const secret = credentials[1];

    if (!uuid || !secret) {
        logger.warn('Token request with missing UUID or secret in credentials');
        return res.status(400).send("Invalid credentials: UUID or secret missing");
    }

    let user = db.prepare("SELECT * FROM users WHERE uuid = ?").get(uuid);

    if (!user) {
        // If user does not exist, create them
        const newUserId = uuidv4();
        logger.info(`New user with UUID ${uuid}, creating database entry with user_id ${newUserId}.`);
        db.prepare("INSERT INTO users (uuid, user_id, secret, inventory, data) VALUES (?, ?, ?, ?, ?)")
            .run(uuid, newUserId, secret, JSON.stringify(baseinventory), JSON.stringify(save));
        user = {
            uuid,
            user_id: newUserId,
            secret
        }; // For JWT signing
    } else if (user.secret !== secret) {
        logger.warn(`Authentication failure for UUID ${uuid}: Incorrect secret.`);
        return res.status(401).send("Unauthorized: Incorrect secret");
    }

    const expiresIn = '365d'; // Token valid for 1 year
    const token = jwt.sign({
        uuid: user.uuid,
        user_id: user.user_id
    }, secret, {
        expiresIn
    });

    const tokenResponse = {
        "token_type": "bearer",
        "access_token": token,
        "expires_in": 31536000, // 1 year in seconds
        "refresh_token": "", // No refresh token for now
    };

    logger.info(`Successfully authenticated user ${uuid}. JWT token issued.`);
    res.json(tokenResponse);
});

module.exports = router;