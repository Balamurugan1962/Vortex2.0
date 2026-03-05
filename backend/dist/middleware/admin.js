"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = void 0;
const auth_1 = require("./auth");
exports.requireAdmin = [
    auth_1.authenticateToken,
    (req, res, next) => {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin role required.' });
        }
        next();
    }
];
