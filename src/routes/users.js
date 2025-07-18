const express = require("express");
const {
    db,
    baseinventory,
    save
} = require("../db/database");
const logger = require('../utils/logger');

const router = express.Router();
const DEBUG = process.env.LOG_LEVEL === 'debug';

router.get("/:uuid/:subpage?/:subpage2?", function(req, res) {
    const requestUrlUuid = req.params.uuid;
    const subpage = req.params.subpage;
    const subpage2 = req.params.subpage2;

    if (!req.headers.authorization) {
        return res.status(401).send("Unauthorized: Missing Authorization header");
    }
    const authParts = req.headers.authorization.split(" ");
    if (authParts[0] !== "Bearer" || !authParts[1]) {
        return res.status(401).send("Unauthorized: Invalid Authorization header format");
    }
    const authenticatedUuid = authParts[1];

    logger.debug(`User data GET request for URL UUID: ${requestUrlUuid}, Authenticated UUID: ${authenticatedUuid}`);

    if (requestUrlUuid !== "me") {
        if (subpage === "profile" && requestUrlUuid === authenticatedUuid) {
            if (subpage2 === "private") {
                const user = db.prepare("SELECT data FROM users WHERE uuid = ?").get(authenticatedUuid);
                if (!user) {
                    console.error(`Profile GET: User ${authenticatedUuid} not found.`);
                    return res.status(404).send("User not found");
                }
                let profileData = { ...save
                };
                if (user.data) {
                    try {
                        profileData = JSON.parse(user.data);
                    } catch (e) {
                        console.error(`Error parsing profile data for user ${authenticatedUuid}:`, e);
                    }
                } else {
                    db.prepare("UPDATE users SET data = ? WHERE uuid = ?").run(JSON.stringify(profileData), authenticatedUuid);
                }
                return res.json(profileData);
            } else {
                logger.debug(`Unimplemented GET endpoint: /users/${requestUrlUuid}/${subpage}/${subpage2 || ''}`);
                return res.status(404).json({
                    message: "Profile sub-resource not found or not implemented."
                });
            }
        } else if (requestUrlUuid !== authenticatedUuid) {
            return res.status(403).send("Forbidden: Cannot access another user's data.");
        }
    }

    if (!subpage) {
        return res.json({
            "user_id": authenticatedUuid
        });
    }

    if (subpage === "inventory") {
        const user = db.prepare("SELECT inventory FROM users WHERE uuid = ?").get(authenticatedUuid);
        if (!user) {
            console.error(`Inventory GET: User ${authenticatedUuid} not found.`);
            return res.status(404).send("User not found");
        }
        let inventoryObject = { ...baseinventory
        };
        if (user.inventory) {
            try {
                inventoryObject = JSON.parse(user.inventory);
            } catch (e) {
                console.error(`Error parsing inventory for user ${authenticatedUuid}:`, e);
            }
        } else {
            db.prepare("UPDATE users SET inventory = ? WHERE uuid = ?").run(JSON.stringify(inventoryObject), authenticatedUuid);
        }
        return res.json(inventoryObject);
    }

    logger.debug(`Unimplemented GET endpoint: ${req.url}`);
    res.status(404).json({
        message: "Resource not found or not implemented."
    });
});

router.put("/:uuid/:subpage?/:subpage2?", function(req, res) {
    const requestUrlUuid = req.params.uuid;
    const subpage = req.params.subpage;
    const subpage2 = req.params.subpage2;

    if (!req.headers.authorization) {
        return res.status(401).send("Unauthorized: Missing Authorization header");
    }
    const authParts = req.headers.authorization.split(" ");
    if (authParts[0] !== "Bearer" || !authParts[1]) {
        return res.status(401).send("Unauthorized: Invalid Authorization header format");
    }
    const authenticatedUuid = authParts[1];

    logger.debug(`User data PUT request for URL UUID: ${requestUrlUuid}, Authenticated UUID: ${authenticatedUuid}`);

    if (requestUrlUuid !== "me" && requestUrlUuid !== authenticatedUuid) {
        return res.status(403).send("Forbidden: Cannot modify another user's data.");
    }
    const targetUuid = (requestUrlUuid === "me") ? authenticatedUuid : requestUrlUuid;

    const userExists = db.prepare("SELECT uuid FROM users WHERE uuid = ?").get(targetUuid);
    if (!userExists) {
        console.error(`User PUT: Target user ${targetUuid} not found.`);
        return res.status(404).send("User not found");
    }

    if (subpage === "wbnet" && requestUrlUuid === "me") {
        logger.debug("WBNet link attempt:", req.body);
        return res.json({
            message: "No WBNet user linked",
            code: 2600,
        });
    }

    if (subpage === "profile" && subpage2 === "private") {
        if (!req.body || !req.body.data || typeof req.body.data.AccountXPLevel === 'undefined') {
            return res.status(400).send("Invalid request body: Missing required fields (e.g., data.AccountXPLevel)");
        }

        const updatedData = req.body;
        /*if (updatedData.data.AccountXPLevel < 24) {
            updatedData.data.AccountXPLevel = 24;
            logger.info(`User ${targetUuid}: AccountXPLevel adjusted to 24.`);
        }
        if (updatedData.data.baneXPLevel < 24) {
            updatedData.data.baneXPLevel = 24;
            logger.info(`User ${targetUuid}: baneXPLevel adjusted to 24.`);
        }
        if (updatedData.data.jokerXPLevel < 24) {
            updatedData.data.jokerXPLevel = 24;
            logger.info(`User ${targetUuid}: jokerXPLevel adjusted to 24.`);
        }*/

        try {
            const profileJson = JSON.stringify(updatedData);
            db.prepare("UPDATE users SET data = ? WHERE uuid = ?").run(profileJson, targetUuid);
            return res.status(204).send();
        } catch (e) {
            console.error(`Error stringifying or updating profile data for user ${targetUuid}:`, e);
            return res.status(500).send("Internal server error: Could not update profile data.");
        }
    }

    logger.debug(`Unimplemented PUT endpoint: ${req.url}`);
    return res.status(404).json({
        message: "Resource for update not found or not implemented."
    });
});

module.exports = router;
