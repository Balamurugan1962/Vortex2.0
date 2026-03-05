import express from 'express';
import { pool } from '../db';

const router = express.Router();

// GET /api/submissions - List all submissions (Instructor only)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM submissions 
            ORDER BY submitted_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching submissions:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/submissions/check - Check if a specific student has submitted
router.get('/check', async (req, res) => {
    const { email, exam_id = 'default' } = req.query;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const result = await pool.query(
            'SELECT id FROM submissions WHERE user_email = $1 AND exam_id = $2',
            [email, exam_id]
        );
        res.json({ hasSubmitted: result.rows.length > 0 });
    } catch (err) {
        console.error('Error checking submission status:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/submissions - Save a new submission
router.post('/', async (req, res) => {
    const { user_email, exam_id = 'default', responses, violations, violation_details } = req.body;

    if (!user_email || !responses) {
        return res.status(400).json({ error: 'User email and responses are required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO submissions (user_email, exam_id, responses, violations, violation_details) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [user_email, exam_id, JSON.stringify(responses), violations || 0, JSON.stringify(violation_details || {})]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        if (err.code === '23505') { // Unique constraint violation
            return res.status(409).json({ error: 'Submission already exists for this user' });
        }
        console.error('Error saving submission:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
