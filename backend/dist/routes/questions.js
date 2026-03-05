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
// Get all questions
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield db_1.pool.query('SELECT * FROM questions ORDER BY id ASC');
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
}));
// Save questions (replaces all existing questions for simplicity in this prototype)
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const questions = req.body;
    if (!Array.isArray(questions)) {
        return res.status(400).json({ error: 'Expected an array of questions' });
    }
    const client = yield db_1.pool.connect();
    try {
        yield client.query('BEGIN');
        // Clear existing questions for simplicity
        yield client.query('DELETE FROM questions');
        // Insert new questions
        for (const q of questions) {
            yield client.query(`INSERT INTO questions (exam_id, type, question, options, correct_answers) 
                 VALUES ($1, $2, $3, $4, $5)`, [
                q.exam_id || 'default',
                q.type,
                q.question || q.text, // Handle both frontend formats
                q.options ? JSON.stringify(q.options) : null,
                q.correctAnswers ? JSON.stringify(q.correctAnswers) : null
            ]);
        }
        yield client.query('COMMIT');
        res.json({ success: true, message: 'Questions saved successfully' });
    }
    catch (error) {
        yield client.query('ROLLBACK');
        console.error('Error saving questions:', error);
        res.status(500).json({ error: 'Failed to save questions' });
    }
    finally {
        client.release();
    }
}));
exports.default = router;
