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

db.exec("CREATE TABLE IF NOT EXISTS users (uuid TEXT PRIMARY KEY, inventory TEXT, data TEXT, consoleid TEXT, consoleticket TEXT)");

// Check if the 'ip' column exists in the 'users' table
const columnCheck = db.prepare("PRAGMA table_info(users)").all();
const ipColumnExists = columnCheck.some(column => column.name === 'ip');

// If the 'ip' column exists, drop it
if (ipColumnExists) {
    db.exec("ALTER TABLE users DROP COLUMN ip");
    logger.info("Dropped 'ip' column from 'users' table.");
}

const baseinventory = JSON.parse(fse.readFileSync("./basecfg/inventory.json"));
const save = JSON.parse(fse.readFileSync("./basecfg/save.json"));

module.exports = {
    db,
    baseinventory,
    save
};
