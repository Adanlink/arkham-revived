const express = require("express");
const fse = require("fs-extra");
const {
    db,
    baseinventory
} = require("../db/database");

const router = express.Router();
const catalog = JSON.parse(fse.readFileSync("./basecfg/catalog.json"));
const credits = JSON.parse(fse.readFileSync("./basecfg/credits.json"));
const store = JSON.parse(fse.readFileSync("./basecfg/store.json"));

router.get("/catalog/general", function(req, res) {
    res.json(catalog);
});

router.get("/offers", function(req, res) {
    if (req.query.vendor == 4) {
        res.json(credits);
    } else {
        res.json(store);
    }
});

router.post("/vouchers/transactions", function(req, res) {
    const validVouchers = [
        "e8fd70ec-f3ec-519b-8b57-70518c4c4f74",
        "640144eb-7862-5186-90d0-606211ec2271",
        "54d80a04-cfbc-51a4-91a1-a88a5c96e7ea",
        "82a9febc-5f11-57db-8464-2ed2b4df74f9",
    ];
    if (!req.body.voucher_id || !validVouchers.includes(req.body.voucher_id)) {
        return res.status(400).send("Invalid or missing voucher ID");
    }
    const transactionId = req.body.voucher_id;
    const response = {
        "transaction_id": transactionId,
    };
    res.status(201).json(response);
});

router.post("/purchases/transactions", function(req, res) {
    if (!req.body.offer_id) {
        return res.status(400).send("Missing offer_id in request body");
    }
    const transactionId = req.body.offer_id;
    const response = {
        "transaction_id": transactionId,
    };
    res.status(201).json(response);
});

function processTransaction(req, res) {
    const transactionId = req.params.transactionid;
    if (!transactionId) {
        return res.status(400).send("Invalid transaction ID: Missing");
    }
    if (!req.headers.authorization) {
        return res.status(400).send("Invalid authorization header: Missing");
    }
    const authParts = req.headers.authorization.split(" ");
    if (authParts[0] !== "Bearer" || !authParts[1]) {
        return res.status(400).send("Invalid authorization header: Malformed or missing token");
    }

    const uuid = authParts[1];

    const userExists = db.prepare("SELECT uuid FROM users WHERE uuid = ?").get(uuid);
    if (!userExists) {
        console.error(`Transaction Error: UUID ${uuid} not found in database.`);
        return res.status(500).send("Internal server error: User not found");
    }

    console.log(`Processing transaction: ${transactionId} for user: ${uuid}`);

    const unlocks = {
        "items": {}
    };
    try {
        switch (transactionId) {
            case "2f93daeb-d68f-4b28-80f4-ace882587a13":
                const consumableItems = [];
                for (const key in catalog.items) {
                    const item = catalog.items[key];
                    if (item.data && item.data.gangland_is_consumable == "1") {
                        consumableItems.push(key);
                    }
                }
                if (consumableItems.length > 0) {
                    const numConsumablesToGrant = 5;
                    for (let i = 0; i < numConsumablesToGrant; i++) {
                        const randomItem = consumableItems[Math.floor(Math.random() * consumableItems.length)];
                        unlocks.items[randomItem] = (unlocks.items[randomItem] || 0) + 1;
                    }
                }
                break;
            default:
                console.log(`Transaction ID ${transactionId} does not correspond to a specific item unlock rule.`);
                break;
        }
    } catch (e) {
        console.error(`Error processing transaction switch for ${transactionId}:`, e);
    }

    const inventoryRow = db.prepare("SELECT inventory FROM users WHERE uuid = ?").get(uuid);
    let currentUserInventory = { ...baseinventory
    };
    if (inventoryRow && inventoryRow.inventory) {
        try {
            currentUserInventory = JSON.parse(inventoryRow.inventory);
        } catch (e) {
            console.error(`Error parsing inventory for user ${uuid}:`, e);
        }
    }

    if (!currentUserInventory.inventory) currentUserInventory.inventory = {};
    for (const itemId in unlocks.items) {
        currentUserInventory.inventory[itemId] = (currentUserInventory.inventory[itemId] || 0) + unlocks.items[itemId];
    }

    try {
        const updatedInventoryJson = JSON.stringify(currentUserInventory);
        db.prepare("UPDATE users SET inventory = ? WHERE uuid = ?").run(updatedInventoryJson, uuid);
    } catch (e) {
        console.error(`Error stringifying or updating inventory for user ${uuid}:`, e);
        return res.status(500).send("Internal server error: Could not update inventory.");
    }

    res.status(201).json(unlocks);
}

router.put("/vouchers/:transactionid", processTransaction);
router.put("/purchases/:transactionid", processTransaction);

module.exports = router;
