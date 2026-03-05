import { Router } from 'express';
import { pool } from '../db';

const router = Router();

// Get all questions
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM questions ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
});

// Save questions (replaces all existing questions for simplicity in this prototype)
router.post('/', async (req, res) => {
    const questions = req.body;

    if (!Array.isArray(questions)) {
        return res.status(400).json({ error: 'Expected an array of questions' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Clear existing questions for simplicity
        await client.query('DELETE FROM questions');

        // Insert new questions
        for (const q of questions) {
            await client.query(
                `INSERT INTO questions (exam_id, type, question, options, correct_answers) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    q.exam_id || 'default',
                    q.type,
                    q.question || q.text, // Handle both frontend formats
                    q.options ? JSON.stringify(q.options) : null,
                    q.correctAnswers ? JSON.stringify(q.correctAnswers) : null
                ]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Questions saved successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving questions:', error);
        res.status(500).json({ error: 'Failed to save questions' });
    } finally {
        client.release();
    }
});

export default router;
