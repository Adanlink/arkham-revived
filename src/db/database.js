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

db.exec("CREATE TABLE IF NOT EXISTS users (uuid TEXT PRIMARY KEY, secret TEXT, inventory TEXT, data TEXT)");

const columnCheck = db.prepare("PRAGMA table_info(users)").all();
const consoleIdColumnExists = columnCheck.some(column => column.name === 'consoleid');
const consoleTicketColumnExists = columnCheck.some(column => column.name === 'consoleticket');
const ipColumnExists = columnCheck.some(column => column.name === 'ip');

if (consoleIdColumnExists) {
    logger.info("Dropping 'consoleid' column from 'users' table as it is no longer used.");
    db.exec("ALTER TABLE users DROP COLUMN consoleid");
}

if (consoleTicketColumnExists) {
    logger.info("Dropping 'consoleticket' column from 'users' table as it is no longer used.");
    db.exec("ALTER TABLE users DROP COLUMN consoleticket");
}

if (ipColumnExists) {
    logger.info("Dropping 'ip' column from 'users' table as it is no longer used.");
    db.exec("ALTER TABLE users DROP COLUMN ip");
}

const baseinventory = JSON.parse(fse.readFileSync("./basecfg/inventory.json"));
const save = JSON.parse(fse.readFileSync("./basecfg/save.json"));

module.exports = {
    db,
    baseinventory,
    save
};
