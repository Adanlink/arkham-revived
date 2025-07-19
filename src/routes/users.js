const express = require("express");
const {
    db,
    baseinventory,
    save
} = require("../db/database");
const {
    verifyToken
} = require("../middleware/auth");
const logger = require('../utils/logger');

const router = express.Router();

router.use(verifyToken);

router.get("/:user_id/:subpage?/:subpage2?", function(req, res) {
    const requestUrlUserId = req.params.user_id;
    const subpage = req.params.subpage;
    const subpage2 = req.params.subpage2;
    const authenticatedUserId = req.user.user_id;
    const authenticatedUuid = req.user.uuid;

    if (requestUrlUserId !== "me" && requestUrlUserId !== authenticatedUserId) {
        return res.status(403).send("Forbidden: Cannot access another user's data.");
    }

    const targetUuid = authenticatedUuid;

    logger.debug(`User data GET request for URL user_id: ${requestUrlUserId}, Authenticated UUID: ${authenticatedUuid}`);

    if (subpage === "profile" && subpage2 === "private") {
        const user = db.prepare("SELECT data FROM users WHERE uuid = ?").get(targetUuid);
        if (!user) {
            logger.error(`Profile GET: User ${targetUuid} not found.`);
            return res.status(404).send("User not found");
        }
        let profileData = { ...save
        };
        if (user.data) {
            try {
                profileData = JSON.parse(user.data);
            } catch (e) {
                logger.error(`Error parsing profile data for user ${targetUuid}:`, e);
            }
        } else {
            db.prepare("UPDATE users SET data = ? WHERE uuid = ?").run(JSON.stringify(profileData), targetUuid);
        }
        return res.json(profileData);
    } else if (subpage === "inventory") {
        const user = db.prepare("SELECT inventory FROM users WHERE uuid = ?").get(targetUuid);
        if (!user) {
            logger.error(`Inventory GET: User ${targetUuid} not found.`);
            return res.status(404).send("User not found");
        }
        let inventoryObject = { ...baseinventory
        };
        if (user.inventory) {
            try {
                inventoryObject = JSON.parse(user.inventory);
            } catch (e) {
                logger.error(`Error parsing inventory for user ${targetUuid}:`, e);
            }
        } else {
            db.prepare("UPDATE users SET inventory = ? WHERE uuid = ?").run(JSON.stringify(inventoryObject), targetUuid);
        }
        return res.json(inventoryObject);
    } else if (!subpage) {
        return res.json({
            "user_id": authenticatedUserId
        });
    }

    logger.debug(`Unimplemented GET endpoint: /users/${requestUrlUuid}/${subpage || ''}/${subpage2 || ''}`);
    res.status(404).json({
        message: "Resource not found or not implemented."
    });
});

router.put("/:user_id/:subpage?/:subpage2?", function(req, res) {
    const requestUrlUserId = req.params.user_id;
    const subpage = req.params.subpage;
    const subpage2 = req.params.subpage2;
    const authenticatedUserId = req.user.user_id;
    const authenticatedUuid = req.user.uuid;

    if (requestUrlUserId !== "me" && requestUrlUserId !== authenticatedUserId) {
        return res.status(403).send("Forbidden: Cannot modify another user's data.");
    }

    const targetUuid = authenticatedUuid;

    logger.debug(`User data PUT request for URL user_id: ${requestUrlUserId}, Authenticated UUID: ${authenticatedUuid}`);

    const userExists = db.prepare("SELECT uuid FROM users WHERE uuid = ?").get(targetUuid);
    if (!userExists) {
        logger.error(`User PUT: Target user ${targetUuid} not found.`);
        return res.status(404).send("User not found");
    }

    if (subpage === "wbnet" && requestUrlUserId === "me") {
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
        try {
            const profileJson = JSON.stringify(req.body);
            db.prepare("UPDATE users SET data = ? WHERE uuid = ?").run(profileJson, targetUuid);
            return res.status(204).send();
        } catch (e) {
            logger.error(`Error stringifying or updating profile data for user ${targetUuid}:`, e);
            return res.status(500).send("Internal server error: Could not update profile data.");
        }
    }

    logger.debug(`Unimplemented PUT endpoint: ${req.url}`);
    return res.status(404).json({
        message: "Resource for update not found or not implemented."
    });
});

module.exports = router;