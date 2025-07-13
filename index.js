// arkham-revived
// Licensed under the MIT License
// Copyright (c) 2023 KiwifruitDev

// Load environment variables from .env file
require('dotenv').config();

// Imports
const express = require("express");
const fse = require("fs-extra");
const Database = require("better-sqlite3");
const getUuid = require("uuid-by-string");
const http = require("http");
const xmljs = require("xml-js");
const js2xml = xmljs.js2xml;
const xml2js = xmljs.xml2js;

// Configuration from environment variables
const HTTP_PORT = process.env.HTTP_PORT || 8080;
const DEBUG = process.env.DEBUG === 'true';
const WIPE_DB_ON_START = process.env.WIPE_DB_ON_START === 'true';

// If usercfg folder doesn't exist, copy basecfg to usercfg
if(!fse.existsSync("./usercfg")) {
    if(fse.existsSync("./basecfg")) {
        fse.copySync("./basecfg", "./usercfg");
    } else {
        // Warn user
        console.log("WARNING: basecfg folder is missing! Re-install is recommended.");
        process.exit(1);
    }
}
// Load usercfg data (excluding config.json)
const motd = JSON.parse(fse.readFileSync("./usercfg/motd.json"));
const store = JSON.parse(fse.readFileSync("./usercfg/store.json"));
const credits = JSON.parse(fse.readFileSync("./usercfg/credits.json"));
const catalog = JSON.parse(fse.readFileSync("./usercfg/catalog.json"));
const save = JSON.parse(fse.readFileSync("./usercfg/save.json"));
const netvars = fse.readFileSync("./usercfg/netvars.dat").toString("base64");
const baseinventory = JSON.parse(fse.readFileSync("./usercfg/inventory.json"));

// Database
// Initialize Better-SQLite3 database instance.
// Verbose logging can be enabled via config for debugging.
const db = new Database("./usercfg/database.db", { verbose: DEBUG ? console.log : null });
// Enable Write-Ahead Logging for better concurrency and performance.
db.pragma('journal_mode = WAL');

// Conditionally wipe the users table on startup if configured.
// This is useful for development or testing environments.
if(WIPE_DB_ON_START)
{
    console.log("Wiping users table as per configuration.");
    db.exec("DROP TABLE IF EXISTS users"); // Use IF EXISTS for safety
}

// Create users table if it doesn't already exist.
// Defines the schema for storing user data.
db.exec("CREATE TABLE IF NOT EXISTS users (uuid TEXT PRIMARY KEY, inventory TEXT, data TEXT, consoleid TEXT, consoleticket TEXT, ip TEXT)");

// Create Express application instance.
const app = express();
// Middleware to parse JSON request bodies.
app.use(express.json());
// Middleware to parse URL-encoded request bodies.
app.use(express.urlencoded({ extended: true }));
// Middleware to parse plain text request bodies, specifically for XML.
app.use(express.text({ type: "text/xml" }));

// Log incoming requests if debug mode is enabled.
// Provides visibility into server traffic for debugging.
if(DEBUG) {
    app.use((req, res, next) => {
        console.log(`Request: ${req.method} ${req.url}`);
        next();
    });
}

// Endpoint: /files/netvars.dat
// Serves game information, apparently encoded in base64.
app.get("/files/netvars.dat", function(req, res) {
    const response = {
        "data": netvars, // Loaded from ./usercfg/netvars.dat
    };
    res.json(response);
});

// Endpoint: /auth/token
// Handles user authentication, likely based on a game ticket (e.g., from Steam).
// Returns a UUID (as an access token) for the user.
app.post("/auth/token", function(req, res) {
    if (!req.headers.authorization) {
        return res.status(400).send("Invalid authorization header: Missing");
    }
    const authParts = req.headers.authorization.split(" ");
    if (authParts[0] !== "Basic" || !req.body.ticket) { // Also check for ticket presence
        return res.status(400).send("Invalid authorization header or missing ticket");
    }

    const ticketHeader = req.body.ticket.replace(/[_|-]/g, ""); // Simplify replacement
    let uuid;

    // Attempt to find user by console ticket first.
    const userByTicket = db.prepare("SELECT uuid FROM users WHERE consoleticket = ?").get(ticketHeader);
    if (userByTicket) {
        uuid = userByTicket.uuid;
    } else {
        // If not found by ticket, try to find by IP address.
        // Note: Using IP for identification can be unreliable due to dynamic IPs, proxies, etc.
        const userByIp = db.prepare("SELECT uuid FROM users WHERE ip = ?").get(req.ip);
        if (userByIp) {
            uuid = userByIp.uuid;
        } else {
            // If no existing user found, generate a new UUID based on the ticket.
            uuid = getUuid(ticketHeader);
        }
    }

    const tokenResponse = {
        "token_type": "bearer",
        "access_token": uuid,
        "expires_in": 1000000, // A very long expiry time
        "refresh_token": "", // Refresh token not implemented
    };
    res.json(tokenResponse);
});

// Endpoint: /motd
// Serves the Message of the Day. Parameters are ignored, returns a static response.
app.get("/motd", function(req, res) {
    res.json(motd); // Loaded from ./usercfg/motd.json
});

// Endpoint: /store/catalog/general
// Serves the game's item catalog.
app.get("/store/catalog/general", function(req, res) {
    res.json(catalog); // Loaded from ./usercfg/catalog.json
});

// Endpoint: /store/offers
// Serves store offers. Differentiates based on 'vendor' query parameter.
app.get("/store/offers", function(req, res) {
    // Vendor ID 4 seems to be for credits, others for general store items.
    if (req.query.vendor == 4) {
        res.json(credits); // Loaded from ./usercfg/credits.json
    } else {
        res.json(store); // Loaded from ./usercfg/store.json
    }
});

// Endpoint: /store/vouchers/transactions
// Handles voucher redemption POST requests from the game.
app.post("/store/vouchers/transactions", function(req, res) {
    // A predefined list of "free" or valid voucher IDs.
    const validVouchers = [
        "e8fd70ec-f3ec-519b-8b57-70518c4c4f74",
        "640144eb-7862-5186-90d0-606211ec2271",
        "54d80a04-cfbc-51a4-91a1-a88a5c96e7ea",
        "82a9febc-5f11-57db-8464-2ed2b4df74f9",
    ];
    if (!req.body.voucher_id || !validVouchers.includes(req.body.voucher_id)) {
        return res.status(400).send("Invalid or missing voucher ID");
    }
    // The transaction ID is simply the voucher ID in this implementation.
    const transactionId = req.body.voucher_id;
    const response = {
        "transaction_id": transactionId,
    };
    res.status(201).json(response); // 201 Created
});

// Endpoint: /store/purchases/transactions
// Handles purchase transaction POST requests from the game.
app.post("/store/purchases/transactions", function(req, res) {
    if (!req.body.offer_id) {
        return res.status(400).send("Missing offer_id in request body");
    }
    // The transaction ID is the offer_id in this implementation.
    const transactionId = req.body.offer_id;
    const response = {
        "transaction_id": transactionId,
    };
    res.status(201).json(response); // 201 Created
});

// Shared logic for processing transactions (both vouchers and purchases).
// This function updates user inventory based on the transaction.
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

    const uuid = authParts[1]; // User's UUID from Bearer token.

    // Verify user exists.
    const userExists = db.prepare("SELECT uuid FROM users WHERE uuid = ?").get(uuid);
    if (!userExists) {
        console.error(`Transaction Error: UUID ${uuid} not found in database.`);
        return res.status(500).send("Internal server error: User not found");
    }

    console.log(`Processing transaction: ${transactionId} for user: ${uuid}`);

    const unlocks = { "items": {} }; // Items to be unlocked by this transaction.
    // TODO: The current switch statement only has one case and might need expansion for real items.
    // This section seems to handle specific transaction IDs to grant items.
    try {
        switch(transactionId) {
            case "2f93daeb-d68f-4b28-80f4-ace882587a13": // Example: "Assortment of consumables"
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
            // Add more cases here for other transaction IDs and their corresponding items.
            default:
                console.log(`Transaction ID ${transactionId} does not correspond to a specific item unlock rule.`);
                // For generic purchases, the client might expect an empty items list or specific item based on offer_id.
                // This part needs to be aligned with how offer_ids map to catalog items.
                break;
        }
    } catch (e) {
        console.error(`Error processing transaction switch for ${transactionId}:`, e);
        // Decide if to send error or continue with empty unlocks
    }

    // Retrieve current user inventory.
    const inventoryRow = db.prepare("SELECT inventory FROM users WHERE uuid = ?").get(uuid);
    let currentUserInventory = { ...baseinventory }; // Start with base inventory.
    if (inventoryRow && inventoryRow.inventory) {
        try {
            currentUserInventory = JSON.parse(inventoryRow.inventory);
        } catch (e) {
            console.error(`Error parsing inventory for user ${uuid}:`, e);
            // Potentially reset to base inventory or return an error.
            // For now, we'll proceed with baseinventory if parsing fails.
        }
    }

    // Add unlocked items to the user's inventory.
    if (!currentUserInventory.inventory) currentUserInventory.inventory = {}; // Ensure inventory object exists
    for (const itemId in unlocks.items) {
        currentUserInventory.inventory[itemId] = (currentUserInventory.inventory[itemId] || 0) + unlocks.items[itemId];
    }

    // Update the user's inventory in the database.
    try {
        const updatedInventoryJson = JSON.stringify(currentUserInventory);
        db.prepare("UPDATE users SET inventory = ? WHERE uuid = ?").run(updatedInventoryJson, uuid);
    } catch (e) {
        console.error(`Error stringifying or updating inventory for user ${uuid}:`, e);
        return res.status(500).send("Internal server error: Could not update inventory.");
    }

    res.status(201).json(unlocks); // 201 Created with the list of unlocked items.
}

// Endpoint: /store/vouchers/:transactionid
// Handles voucher redemption PUT requests.
app.put("/store/vouchers/:transactionid", processTransaction);

// Endpoint: /store/purchases/:transactionid
// Handles purchase completion PUT requests.
app.put("/store/purchases/:transactionid", processTransaction);


// Endpoint: /users/:uuid/:subpage?/:subpage2? (GET)
// Retrieves user-specific data, like profile or inventory.
app.get("/users/:uuid/:subpage?/:subpage2?", function(req, res) {
    const requestUrlUuid = req.params.uuid; // Use req.params for route parameters
    const subpage = req.params.subpage;
    const subpage2 = req.params.subpage2;

    if (!req.headers.authorization) {
        return res.status(401).send("Unauthorized: Missing Authorization header"); // 401 for auth issues
    }
    const authParts = req.headers.authorization.split(" ");
    if (authParts[0] !== "Bearer" || !authParts[1]) {
        return res.status(401).send("Unauthorized: Invalid Authorization header format");
    }
    const authenticatedUuid = authParts[1]; // UUID from the token

    if (DEBUG) {
        console.log(`User data GET request for URL UUID: ${requestUrlUuid}, Authenticated UUID: ${authenticatedUuid}`);
    }

    if (requestUrlUuid === "me") { // "me" refers to the authenticated user
        if (!subpage) {
            // Return basic user info (just UUID)
            return res.json({ "user_id": authenticatedUuid });
        } else if (subpage === "inventory") {
            const user = db.prepare("SELECT inventory FROM users WHERE uuid = ?").get(authenticatedUuid);
            if (!user) {
                console.error(`Inventory GET: User ${authenticatedUuid} not found.`);
                return res.status(404).send("User not found");
            }
            let inventoryObject = { ...baseinventory }; // Default to base inventory
            if (user.inventory) {
                try {
                    inventoryObject = JSON.parse(user.inventory);
                } catch (e) {
                    console.error(`Error parsing inventory for user ${authenticatedUuid}:`, e);
                    // Fallback to base inventory or handle error
                }
            } else {
                // If no inventory record, create one with base inventory
                db.prepare("UPDATE users SET inventory = ? WHERE uuid = ?").run(JSON.stringify(inventoryObject), authenticatedUuid);
            }
            return res.json(inventoryObject);
        }
    } else if (subpage === "profile" && requestUrlUuid === authenticatedUuid) { // Can only access own profile
        if (subpage2 === "private") {
            const user = db.prepare("SELECT data FROM users WHERE uuid = ?").get(authenticatedUuid);
            if (!user) {
                console.error(`Profile GET: User ${authenticatedUuid} not found.`);
                return res.status(404).send("User not found");
            }
            let profileData = { ...save }; // Default to base save data
            if (user.data) {
                try {
                    profileData = JSON.parse(user.data);
                } catch (e) {
                    console.error(`Error parsing profile data for user ${authenticatedUuid}:`, e);
                }
            } else {
                // If no profile data, create one with base save data
                db.prepare("UPDATE users SET data = ? WHERE uuid = ?").run(JSON.stringify(profileData), authenticatedUuid);
            }
            return res.json(profileData);
        } else {
            console.log(`Unimplemented GET endpoint: /users/${requestUrlUuid}/${subpage}/${subpage2 || ''}`);
            return res.status(404).json({ message: "Profile sub-resource not found or not implemented." });
        }
    } else if (requestUrlUuid !== authenticatedUuid) {
        return res.status(403).send("Forbidden: Cannot access another user's data.");
    }

    // Fallback for unimplemented paths
    console.log(`Unimplemented GET endpoint: ${req.url}`);
    res.status(404).json({ message: "Resource not found or not implemented." });
});

// Endpoint: /users/:uuid/:subpage?/:subpage2? (PUT)
// Updates user-specific data.
app.put("/users/:uuid/:subpage?/:subpage2?", function(req, res) {
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

    if (DEBUG) {
        console.log(`User data PUT request for URL UUID: ${requestUrlUuid}, Authenticated UUID: ${authenticatedUuid}`);
    }

    // Users can only modify their own data.
    if (requestUrlUuid !== "me" && requestUrlUuid !== authenticatedUuid) {
        return res.status(403).send("Forbidden: Cannot modify another user's data.");
    }
    // Resolve "me" to the authenticated user's UUID for database operations.
    const targetUuid = (requestUrlUuid === "me") ? authenticatedUuid : requestUrlUuid;

    // Ensure user exists before attempting update
    const userExists = db.prepare("SELECT uuid FROM users WHERE uuid = ?").get(targetUuid);
    if (!userExists) {
        console.error(`User PUT: Target user ${targetUuid} not found.`);
        return res.status(404).send("User not found");
    }

    if (subpage === "wbnet" && requestUrlUuid === "me") { // Specific handling for /users/me/wbnet
        console.log("WBNet link attempt:", req.body);
        // This seems to be a placeholder for linking a WBNet account.
        return res.json({
            message: "No WBNet user linked", // Or "WBNet linking not supported."
            code: 2600, // Specific error code from the game?
        });
    } else if (subpage === "profile" && subpage2 === "private") {
        // Validate request body structure, especially for critical fields like AccountXPLevel.
        if (!req.body || !req.body.data || typeof req.body.data.AccountXPLevel === 'undefined') {
            return res.status(400).send("Invalid request body: Missing required fields (e.g., data.AccountXPLevel)");
        }

        // Ensure minimum XP levels are met as per game logic.
        // These seem to be anti-cheat or progression rules.
        const updatedData = req.body; // Assume req.body is the full private profile structure
        if (updatedData.data.AccountXPLevel < 24) {
            updatedData.data.AccountXPLevel = 24;
            console.log(`User ${targetUuid}: AccountXPLevel adjusted to 24.`);
        }
        if (updatedData.data.baneXPLevel < 24) { // Assuming these fields exist
            updatedData.data.baneXPLevel = 24;
            console.log(`User ${targetUuid}: baneXPLevel adjusted to 24.`);
        }
        if (updatedData.data.jokerXPLevel < 24) { // Assuming these fields exist
            updatedData.data.jokerXPLevel = 24;
            console.log(`User ${targetUuid}: jokerXPLevel adjusted to 24.`);
        }

        try {
            const profileJson = JSON.stringify(updatedData);
            db.prepare("UPDATE users SET data = ? WHERE uuid = ?").run(profileJson, targetUuid);
            return res.status(204).send(); // Standard success response for PUT with no content body
        } catch (e) {
            console.error(`Error stringifying or updating profile data for user ${targetUuid}:`, e);
            return res.status(500).send("Internal server error: Could not update profile data.");
        }
    } else {
        console.log(`Unimplemented PUT endpoint: ${req.url}`);
        return res.status(404).json({ message: "Resource for update not found or not implemented." });
    }
});

// Endpoint: /actions/:action
// This endpoint is noted as "Unknown..." - currently not implemented.
// Consider adding a placeholder or logging if requests hit this.
app.all("/actions/:action", (req, res) => {
    console.log(`Received request for unknown /actions endpoint: ${req.params.action}`);
    res.status(501).send("Not Implemented"); // 501 Not Implemented
});


// SOAP Service Implementation
// This section handles SOAP requests, which are XML-based.

// Dummy function for logging SOAP calls, can be expanded for actual logic.
function logSoapCall(functionName, args) {
    if (DEBUG) {
        console.log(`SOAP Call: ${functionName}`);
        console.log("Arguments:", args);
    }
}

// Object containing handlers for different SOAP actions.
const soapServiceMethods = {
    LookupWbid: function(args) {
        logSoapCall("LookupWbid", args);
        // Expected arguments: args.realm, args.title, args.uniqueId, args.consoleTicket, args.consoleId, args.ip
        // Logic to associate a console ID with a WBID (represented by a UUID here).
        if (args.title === "OZZY" && args.uniqueId && args.consoleTicket && args.consoleId) {
            const ticketHeader = args.consoleTicket.replace(/[\/\+]/g, ""); // Clean ticket
            const uuid = getUuid(ticketHeader); // Generate UUID from ticket

            const existingUser = db.prepare("SELECT * FROM users WHERE consoleid = ?").get(args.consoleId);
            if (!existingUser) {
                // New user: insert into database.
                db.prepare("INSERT INTO users (uuid, inventory, data, consoleid, consoleticket, ip) VALUES (?, ?, ?, ?, ?, ?)")
                  .run(uuid, JSON.stringify(baseinventory), JSON.stringify(save), args.consoleId, ticketHeader, args.ip);
                console.log(`SOAP: New user created for consoleId ${args.consoleId}, UUID ${uuid}`);
            } else {
                // Existing user: update ticket, UUID, and IP.
                db.prepare("UPDATE users SET consoleticket = ?, uuid = ?, ip = ? WHERE consoleid = ?")
                  .run(ticketHeader, uuid, args.ip, args.consoleId);
                console.log(`SOAP: User updated for consoleId ${args.consoleId}, UUID ${uuid}`);
            }
            // The game might expect a specific response structure, which is currently empty.
            // Example of a possible response field:
            // return { LookupWbidResult: `${args.realm}_${args.consoleId}@example.com` };
        }
        return {}; // Default empty response if conditions not met or no specific result needed.
    },
    AssociateWbid: function(args) { logSoapCall("AssociateWbid", args); return {}; },
    DisassociateWbid: function(args) { logSoapCall("DisassociateWbid", args); return {}; },
    CreateAccount: function(args) { logSoapCall("CreateAccount", args); return {}; },
    CreateAccountAndAssociate: function(args) { logSoapCall("CreateAccountAndAssociate", args); return {}; },
    ResetPassword: function(args) { logSoapCall("ResetPassword", args); return {}; },
    StartWBPasswordReset: function(args) { logSoapCall("StartWBPasswordReset", args); return {}; },
    StartWBPasswordResetFromConsole: function(args) { logSoapCall("StartWBPasswordResetFromConsole", args); return {}; },
    FinishWBPasswordReset: function(args) { logSoapCall("FinishWBPasswordReset", args); return {}; },
    GetSubscriptionInformation: function(args) {
        logSoapCall("GetSubscriptionInformation", args);
        // Provides dummy subscription information based on consoleId.
        // This might be related to DLC or online access entitlements.
        if (!args.consoleId) return { Error: "Missing consoleId" }; // Basic validation
        return {
            GetSubscriptionInformationResult: {
                WbidAccountId: getUuid(args.consoleId + ":accountid_sub"), // Ensure unique IDs
                SubscriptionId: getUuid(args.consoleId + ":subscriptionid_sub"),
                AccountId: getUuid(args.consoleId + ":accountid_sub_detail"),
                Entitlements: [] // Placeholder for entitlements array
            }
        };
    }
};

// Generic SOAP request handler.
// Parses the incoming XML, calls the appropriate service method, and formats the XML response.
function handleSoapRequest(req, res) {
    let requestData;
    try {
        requestData = xml2js(req.body, { compact: false }); // Use non-compact for detailed parsing
    } catch (e) {
        console.error("SOAP Error: Invalid XML request:", e);
        return res.status(400).type('text/xml').send(buildSoapFault("Client", "Invalid XML format"));
    }

    // Navigate through the SOAP envelope to find the method name and arguments.
    // This parsing can be complex and error-prone due to XML verbosity.
    let methodName, methodArgs = {};
    try {
        const bodyContent = requestData.elements[0].elements.find(el => el.name === "soap:Body").elements[0];
        methodName = bodyContent.name;
        if (bodyContent.elements) {
            bodyContent.elements.forEach(argEl => {
                if (argEl.elements && argEl.elements.length > 0 && argEl.elements[0].type === 'text') {
                    methodArgs[argEl.name] = argEl.elements[0].text;
                } else {
                     methodArgs[argEl.name] = null; // Handle elements without text content
                }
            });
        }
    } catch (e) {
        console.error("SOAP Error: Could not parse method name or arguments from request:", e);
        return res.status(500).type('text/xml').send(buildSoapFault("Server", "Error parsing SOAP request structure"));
    }

    methodArgs.ip = req.ip; // Add client IP to arguments for service methods.

    let resultData;
    let fault = false;

    if (soapServiceMethods[methodName]) {
        try {
            resultData = soapServiceMethods[methodName](methodArgs);
            if (resultData && Object.keys(resultData).length === 0 && methodName !== "LookupWbid" && methodName !== "AssociateWbid" && methodName !== "DisassociateWbid" && methodName !== "CreateAccount" && methodName !== "CreateAccountAndAssociate" && methodName !== "ResetPassword" && methodName !== "StartWBPasswordReset" && methodName !== "StartWBPasswordResetFromConsole" && methodName !== "FinishWBPasswordReset") { // Some methods might legitimately return empty
                // Consider if empty result is an error or expected for this method.
                // For now, only GetSubscriptionInformation returning empty would be a clear fault.
                if (methodName === "GetSubscriptionInformation") {
                    console.warn(`SOAP: Method ${methodName} returned empty, treating as fault.`);
                    fault = true;
                }
            }
        } catch (e) {
            console.error(`SOAP Error: Exception in method ${methodName}:`, e);
            resultData = { ErrorMessage: e.message }; // Include error in response if possible
            fault = true;
        }
    } else {
        console.warn(`SOAP: Unhandled method called: ${methodName}`);
        fault = true; // Method not found.
    }

    res.type('text/xml');
    if (fault) {
        // For some faults, the game expects a specific structure.
        // This is a generic fault, customize if needed per method.
        const faultCode = soapServiceMethods[methodName] ? "Server" : "Client.MethodNotFound";
        const faultString = soapServiceMethods[methodName] ? `Error processing ${methodName}` : `Method ${methodName} not found.`;
        return res.status(500).send(buildSoapFault(faultCode, faultString, resultData ? JSON.stringify(resultData.ErrorMessage || resultData) : "No additional details."));
    } else {
        // Build successful SOAP response.
        const responseXml = buildSoapResponse(methodName, resultData);
        return res.status(200).send(responseXml);
    }
}

// Helper to build a SOAP success response XML string.
function buildSoapResponse(methodName, resultData) {
    const responseBody = {};
    responseBody[methodName + "Response"] = resultData; // e.g., { LookupWbidResponse: { ... } }

    const soapEnvelope = {
        declaration: { attributes: { version: "1.0", encoding: "utf-8" } },
        elements: [{
            type: "element",
            name: "soap:Envelope",
            attributes: {
                "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
                "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
                "xmlns:soap": "http://schemas.xmlsoap.org/soap/envelope/"
            },
            elements: [{
                type: "element",
                name: "soap:Body",
                elements: [js2xml({element: responseBody}, {compact:false}).elements[0]] // Convert resultData to XML structure
            }]
        }]
    };
    try {
        return js2xml(soapEnvelope, { compact: false, spaces: DEBUG ? 2 : 0 }); // Pretty print if debug
    } catch (e) {
        console.error("SOAP Error: Failed to serialize success response:", e);
        // Fallback to a generic server fault if serialization fails
        return buildSoapFault("Server", "Failed to serialize SOAP response.");
    }
}


// Helper to build a SOAP Fault XML string.
function buildSoapFault(faultCode, faultString, detail = "") {
    const faultStructure = {
        "soap:Fault": {
            faultcode: `soap:${faultCode}`, // e.g., soap:Server or soap:Client
            faultstring: faultString,
            detail: detail
        }
    };
    // The game might expect a very specific fault structure for ticket expiry.
    // This is a generic one.
    if (faultString.includes("SteamTicketInformation ticket has expired")) {
        faultStructure["soap:Fault"] = { // Overwrite with specific structure if needed
            "soap:Code": {"_text": "soap:Receiver"},
            "soap:Reason": {"_text": "Unhandled exception ---> The provided SteamTicketInformation ticket has expired."},
            "soap:Node": {"_text": "Turbine.Ams.Steam.SteamAuthenticationProvider.ValidateExternalTicket_worker"},
            "detail": {
                "exceptiontype": {"_text": "Turbine.Security.TicketExpiredException"},
                "errorcode": {"_text": "0xA01B000C"}
            }
        };
    }

    const soapEnvelope = {
        declaration: { attributes: { version: "1.0", encoding: "utf-8" } },
        elements: [{
            type: "element",
            name: "soap:Envelope",
            attributes: {
                "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
                "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
                "xmlns:soap": "http://schemas.xmlsoap.org/soap/envelope/"
            },
            elements: [{
                type: "element",
                name: "soap:Body",
                elements: [ { type: "element", name: "soap:Fault", elements: js2xml(faultStructure['soap:Fault'], {compact:false}).elements } ]
            }]
        }]
    };
     try {
        return js2xml(soapEnvelope, { compact: false, spaces: DEBUG ? 2 : 0 });
    } catch (e) {
        console.error("SOAP Error: Failed to serialize FAULT response:", e);
        // Ultimate fallback if even fault serialization fails
        return "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap:Body><soap:Fault><faultcode>soap:Server</faultcode><faultstring>Internal server error during fault serialization.</faultstring></soap:Fault></soap:Body></soap:Envelope>";
    }
}

// Register SOAP endpoints.
app.post("/CLS/WbAccountManagement.asmx", handleSoapRequest);
app.post("/CLS/WbSubscriptionManagement.asmx", handleSoapRequest);


// SERVER SETUP AND GRACEFUL SHUTDOWN

// Create the HTTP server instance using the Express app.
// This server will handle all incoming HTTP requests.
const server = http.createServer(app);

// Start listening on the HTTP port specified in the configuration.
server.listen(HTTP_PORT, () => {
    // Log a message indicating the server is listening, if debug mode is enabled.
    if (DEBUG) {
        console.log(`HTTP Server: Listening on port ${HTTP_PORT}`);
    }
});

// Error handling for the server (e.g., if the port is already in use).
server.on("error", (err) => {
    console.error("HTTP Server startup error:", err.message);
    // Exit the process with an error code, as the server cannot start.
    process.exit(1);
});

// Store active connections to allow for graceful shutdown.
// A Set is used to efficiently add and remove connections.
const activeConnections = new Set();
server.on('connection', (connection) => {
    activeConnections.add(connection);
    // When a connection is closed, remove it from the active set.
    connection.on('close', () => {
        activeConnections.delete(connection);
    });
});

// Implements graceful shutdown logic for the application.
// This function is called when the process receives a termination signal.
function gracefulShutdown(signal) {
    console.log(`${signal} received. Shutting down gracefully...`);

    // 1. Stop accepting new incoming connections.
    server.close((err) => {
        if (err) {
            // Log an error if the server fails to close, but proceed with shutdown.
            console.error("Error during HTTP server shutdown:", err.message);
        } else {
            console.log("HTTP server closed.");
        }

        // 2. Close the database connection.
        // Check if the database object exists and has a close method.
        if (db && typeof db.close === 'function') {
            const dbCloseTimeout = setTimeout(() => {
                console.error("Database close timed out. Forcing exit.");
                process.exit(1);
            }, 5000); // 5 seconds for DB to close

            db.close((dbErr) => {
                clearTimeout(dbCloseTimeout);
                if (dbErr) {
                    console.error("Error closing database:", dbErr.message);
                    process.exit(1); // Exit with error if database closing fails.
                } else {
                    console.log("Database connection closed.");
                    process.exit(0); // Exit successfully after all cleanup.
                }
            });
        } else {
            // If there's no database or it's already closed, exit.
            console.log("Database connection not available or already closed.");
            process.exit(err ? 1 : 0); // Exit based on server close status.
        }
    });

    // 3. Forcefully close any remaining active connections after a brief period.
    // This ensures that the shutdown process doesn't hang indefinitely.
    const connectionDestroyTimeout = 2000; // Give connections 2 seconds to close naturally
    setTimeout(() => {
        if (activeConnections.size > 0) {
            console.log(`Forcing close of ${activeConnections.size} remaining connections after ${connectionDestroyTimeout}ms.`);
            activeConnections.forEach(connection => connection.destroy());
        }
    }, connectionDestroyTimeout);

    // 4. Fallback timeout to ensure the process exits if server.close() or db.close() hangs.
    const forceExitTimeout = 10000; // Total 10 seconds for graceful shutdown.
    setTimeout(() => {
        console.error("Graceful shutdown timed out. Forcing exit.");
        process.exit(1);
    }, forceExitTimeout);
}

// Listen for common termination signals to trigger graceful shutdown.
process.on("SIGINT", () => gracefulShutdown("SIGINT")); // Ctrl+C
process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // kill command

// Handle uncaught exceptions by initiating a graceful shutdown.
// This is crucial for cleaning up resources before the process terminates unexpectedly.
process.on("uncaughtException", (err, origin) => {
    console.error(`Uncaught Exception at: ${origin}, error: ${err.message}`);
    console.error(err.stack); // Log the stack trace for debugging.
    gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections by initiating a graceful shutdown.
// Similar to uncaught exceptions, this ensures cleanup on unhandled promise errors.
process.on("unhandledRejection", (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown("unhandledRejection");
});
