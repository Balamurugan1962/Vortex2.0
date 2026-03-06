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
// GET /api/exams - List all exams
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield db_1.pool.query(`
            SELECT * FROM exams 
            ORDER BY scheduled_at DESC
        `);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching exams:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// GET /api/exams/:id - Get specific exam details
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const result = yield db_1.pool.query('SELECT * FROM exams WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Exam not found' });
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Error fetching exam:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// POST /api/exams - Create a new exam
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, title, description, scheduled_at } = req.body;
    if (!id || !title) {
        return res.status(400).json({ error: 'ID and Title are required' });
    }
    try {
        const result = yield db_1.pool.query(`INSERT INTO exams (id, title, description, scheduled_at) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`, [id, title, description, scheduled_at || new Date()]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Exam ID already exists' });
        }
        console.error('Error creating exam:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// DELETE /api/exams/:id - Delete an exam and related data
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (id === 'default') {
        return res.status(403).json({ error: 'Cannot delete the default exam' });
    }
    const client = yield db_1.pool.connect();
    try {
        yield client.query('BEGIN');
        // 1. Delete associated submissions
        yield client.query('DELETE FROM submissions WHERE exam_id = $1', [id]);
        // 2. Delete associated questions
        yield client.query('DELETE FROM questions WHERE exam_id = $1', [id]);
        // 3. Delete the exam itself
        const result = yield client.query('DELETE FROM exams WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            yield client.query('ROLLBACK');
            return res.status(404).json({ error: 'Exam not found' });
        }
        yield client.query('COMMIT');
        res.json({ message: 'Exam and all associated data deleted successfully', exam: result.rows[0] });
    }
    catch (err) {
        yield client.query('ROLLBACK');
        console.error('Error deleting exam:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
    finally {
        client.release();
    }
}));
exports.default = router;
