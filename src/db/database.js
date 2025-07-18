const Database = require("better-sqlite3");
const fse = require("fs-extra");
const logger = require('../utils/logger');

const DEBUG = process.env.LOG_LEVEL === 'debug';
const WIPE_DB_ON_START = process.env.WIPE_DB_ON_START === 'true';

const db = new Database("./usercfg/database.db", {
    verbose: DEBUG ? logger.debug : null
});
db.pragma('journal_mode = WAL');

if (WIPE_DB_ON_START) {
    logger.info("Wiping users table as per configuration.");
    db.exec("DROP TABLE IF EXISTS users");
}

db.exec("CREATE TABLE IF NOT EXISTS users (uuid TEXT PRIMARY KEY, inventory TEXT, data TEXT, consoleid TEXT, consoleticket TEXT, ip TEXT)");

const baseinventory = JSON.parse(fse.readFileSync("./basecfg/inventory.json"));
const save = JSON.parse(fse.readFileSync("./basecfg/save.json"));

module.exports = {
    db,
    baseinventory,
    save
};
