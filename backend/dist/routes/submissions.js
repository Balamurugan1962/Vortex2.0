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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const router = express_1.default.Router();
// GET /api/submissions - List all submissions (Instructor only)
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield db_1.pool.query(`
            SELECT * FROM submissions 
            ORDER BY submitted_at DESC
        `);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching submissions:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// GET /api/submissions/check - Check if a specific student has submitted
router.get('/check', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, exam_id = 'default' } = req.query;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    try {
        const result = yield db_1.pool.query('SELECT id FROM submissions WHERE user_email = $1 AND exam_id = $2', [email, exam_id]);
        res.json({ hasSubmitted: result.rows.length > 0 });
    }
    catch (err) {
        console.error('Error checking submission status:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// POST /api/submissions - Save a new submission
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { user_email, exam_id = 'default', responses, violations, violation_details } = req.body;
    if (!user_email || !responses) {
        return res.status(400).json({ error: 'User email and responses are required' });
    }
    try {
        const result = yield db_1.pool.query(`INSERT INTO submissions (user_email, exam_id, responses, violations, violation_details) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`, [user_email, exam_id, JSON.stringify(responses), violations || 0, JSON.stringify(violation_details || {})]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        if (err.code === '23505') { // Unique constraint violation
            return res.status(409).json({ error: 'Submission already exists for this user' });
        }
        console.error('Error saving submission:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
exports.default = router;
