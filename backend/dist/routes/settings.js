"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
// Publicly check settings like whether registration is enabled
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield db_1.pool.query('SELECT key, value FROM settings');
        const settings = {};
        result.rows.forEach(row => {
            // parse booleans 
            settings[row.key] = row.value === 'true' ? true : (row.value === 'false' ? false : row.value);
        });
        // Default if not initialized
        if (settings['registration_enabled'] === undefined) {
            settings['registration_enabled'] = true;
        }
        res.json(settings);
    }
    catch (error) {
        console.error('Error fetching public settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
exports.default = router;
