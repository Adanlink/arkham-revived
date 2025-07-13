const getUuid = require("uuid-by-string");
const xmljs = require("xml-js");
const js2xml = xmljs.js2xml;
const xml2js = xmljs.xml2js;
const {
    db,
    baseinventory,
    save
} = require("../db/database");

const DEBUG = process.env.DEBUG === 'true';

function logSoapCall(functionName, args) {
    if (DEBUG) {
        console.log(`SOAP Call: ${functionName}`);
        console.log("Arguments:", args);
    }
}

const soapServiceMethods = {
    LookupWbid: function(args) {
        logSoapCall("LookupWbid", args);
        if (args.title === "OZZY" && args.uniqueId && args.consoleTicket && args.consoleId) {
            const ticketHeader = args.consoleTicket.replace(/[\/\+]/g, "");
            const uuid = getUuid(ticketHeader);

            const existingUser = db.prepare("SELECT * FROM users WHERE consoleid = ?").get(args.consoleId);
            if (!existingUser) {
                db.prepare("INSERT INTO users (uuid, inventory, data, consoleid, consoleticket, ip) VALUES (?, ?, ?, ?, ?, ?)")
                    .run(uuid, JSON.stringify(baseinventory), JSON.stringify(save), args.consoleId, ticketHeader, args.ip);
                console.log(`SOAP: New user created for consoleId ${args.consoleId}, UUID ${uuid}`);
            } else {
                db.prepare("UPDATE users SET consoleticket = ?, uuid = ?, ip = ? WHERE consoleid = ?")
                    .run(ticketHeader, uuid, args.ip, args.consoleId);
                console.log(`SOAP: User updated for consoleId ${args.consoleId}, UUID ${uuid}`);
            }
        }
        return {};
    },
    AssociateWbid: function(args) {
        logSoapCall("AssociateWbid", args);
        return {};
    },
    DisassociateWbid: function(args) {
        logSoapCall("DisassociateWbid", args);
        return {};
    },
    CreateAccount: function(args) {
        logSoapCall("CreateAccount", args);
        return {};
    },
    CreateAccountAndAssociate: function(args) {
        logSoapCall("CreateAccountAndAssociate", args);
        return {};
    },
    ResetPassword: function(args) {
        logSoapCall("ResetPassword", args);
        return {};
    },
    StartWBPasswordReset: function(args) {
        logSoapCall("StartWBPasswordReset", args);
        return {};
    },
    StartWBPasswordResetFromConsole: function(args) {
        logSoapCall("StartWBPasswordResetFromConsole", args);
        return {};
    },
    FinishWBPasswordReset: function(args) {
        logSoapCall("FinishWBPasswordReset", args);
        return {};
    },
    GetSubscriptionInformation: function(args) {
        logSoapCall("GetSubscriptionInformation", args);
        if (!args.consoleId) return {
            Error: "Missing consoleId"
        };
        return {
            GetSubscriptionInformationResult: {
                WbidAccountId: getUuid(args.consoleId + ":accountid_sub"),
                SubscriptionId: getUuid(args.consoleId + ":subscriptionid_sub"),
                AccountId: getUuid(args.consoleId + ":accountid_sub_detail"),
                Entitlements: []
            }
        };
    }
};

function buildSoapResponse(methodName, resultData) {
    const responseBody = {};
    responseBody[methodName + "Response"] = resultData;

    const soapEnvelope = {
        declaration: {
            attributes: {
                version: "1.0",
                encoding: "utf-8"
            }
        },
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
                elements: [js2xml({
                    element: responseBody
                }, {
                    compact: false
                }).elements[0]]
            }]
        }]
    };
    try {
        return js2xml(soapEnvelope, {
            compact: false,
            spaces: DEBUG ? 2 : 0
        });
    } catch (e) {
        console.error("SOAP Error: Failed to serialize success response:", e);
        return buildSoapFault("Server", "Failed to serialize SOAP response.");
    }
}

function buildSoapFault(faultCode, faultString, detail = "") {
    const faultStructure = {
        "soap:Fault": {
            faultcode: `soap:${faultCode}`,
            faultstring: faultString,
            detail: detail
        }
    };
    if (faultString.includes("SteamTicketInformation ticket has expired")) {
        faultStructure["soap:Fault"] = {
            "soap:Code": {
                "_text": "soap:Receiver"
            },
            "soap:Reason": {
                "_text": "Unhandled exception ---> The provided SteamTicketInformation ticket has expired."
            },
            "soap:Node": {
                "_text": "Turbine.Ams.Steam.SteamAuthenticationProvider.ValidateExternalTicket_worker"
            },
            "detail": {
                "exceptiontype": {
                    "_text": "Turbine.Security.TicketExpiredException"
                },
                "errorcode": {
                    "_text": "0xA01B000C"
                }
            }
        };
    }

    const soapEnvelope = {
        declaration: {
            attributes: {
                version: "1.0",
                encoding: "utf-8"
            }
        },
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
                elements: [{
                    type: "element",
                    name: "soap:Fault",
                    elements: js2xml(faultStructure['soap:Fault'], {
                        compact: false
                    }).elements
                }]
            }]
        }]
    };
    try {
        return js2xml(soapEnvelope, {
            compact: false,
            spaces: DEBUG ? 2 : 0
        });
    } catch (e) {
        console.error("SOAP Error: Failed to serialize FAULT response:", e);
        return "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap:Body><soap:Fault><faultcode>soap:Server</faultcode><faultstring>Internal server error during fault serialization.</faultstring></soap:Fault></soap:Body></soap:Envelope>";
    }
}

function handleSoapRequest(req, res) {
    let requestData;
    try {
        requestData = xml2js(req.body, {
            compact: false
        });
    } catch (e) {
        console.error("SOAP Error: Invalid XML request:", e);
        return res.status(400).type('text/xml').send(buildSoapFault("Client", "Invalid XML format"));
    }

    let methodName, methodArgs = {};
    try {
        const bodyContent = requestData.elements[0].elements.find(el => el.name === "soap:Body").elements[0];
        methodName = bodyContent.name;
        if (bodyContent.elements) {
            bodyContent.elements.forEach(argEl => {
                if (argEl.elements && argEl.elements.length > 0 && argEl.elements[0].type === 'text') {
                    methodArgs[argEl.name] = argEl.elements[0].text;
                } else {
                    methodArgs[argEl.name] = null;
                }
            });
        }
    } catch (e) {
        console.error("SOAP Error: Could not parse method name or arguments from request:", e);
        return res.status(500).type('text/xml').send(buildSoapFault("Server", "Error parsing SOAP request structure"));
    }

    methodArgs.ip = req.ip;

    let resultData;
    let fault = false;

    if (soapServiceMethods[methodName]) {
        try {
            resultData = soapServiceMethods[methodName](methodArgs);
            if (resultData && Object.keys(resultData).length === 0 && methodName !== "LookupWbid" && methodName !== "AssociateWbid" && methodName !== "DisassociateWbid" && methodName !== "CreateAccount" && methodName !== "CreateAccountAndAssociate" && methodName !== "ResetPassword" && methodName !== "StartWBPasswordReset" && methodName !== "StartWBPasswordResetFromConsole" && methodName !== "FinishWBPasswordReset") {
                if (methodName === "GetSubscriptionInformation") {
                    console.warn(`SOAP: Method ${methodName} returned empty, treating as fault.`);
                    fault = true;
                }
            }
        } catch (e) {
            console.error(`SOAP Error: Exception in method ${methodName}:`, e);
            resultData = {
                ErrorMessage: e.message
            };
            fault = true;
        }
    } else {
        console.warn(`SOAP: Unhandled method called: ${methodName}`);
        fault = true;
    }

    res.type('text/xml');
    if (fault) {
        const faultCode = soapServiceMethods[methodName] ? "Server" : "Client.MethodNotFound";
        const faultString = soapServiceMethods[methodName] ? `Error processing ${methodName}` : `Method ${methodName} not found.`;
        return res.status(500).send(buildSoapFault(faultCode, faultString, resultData ? JSON.stringify(resultData.ErrorMessage || resultData) : "No additional details."));
    }

    const responseXml = buildSoapResponse(methodName, resultData);
    return res.status(200).send(responseXml);
}

module.exports = {
    handleSoapRequest
};
