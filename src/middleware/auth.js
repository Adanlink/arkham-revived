const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { db } = require('../db/database');

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send('Unauthorized: Missing or invalid token');
    }

    const token = authHeader.substring(7);
    const decoded_unverified = jwt.decode(token);
    if (!decoded_unverified || !decoded_unverified.uuid) {
        return res.status(401).send('Unauthorized: Invalid token payload');
    }

    const user = db.prepare("SELECT secret FROM users WHERE uuid = ?").get(decoded_unverified.uuid);
    if (!user) {
        return res.status(401).send('Unauthorized: User not found');
    }

    jwt.verify(token, user.secret, (err, decoded) => {
        if (err) {
            logger.warn(`JWT verification failed for token: ${token}. Error: ${err.message}`);
            return res.status(401).send('Unauthorized: Token verification failed');
        }
        req.user = decoded;
        next();
    });
}

module.exports = { verifyToken };
