import express from 'express';
import { pool } from '../db';

const router = express.Router();

// GET /api/exams - List all exams
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM exams 
            ORDER BY scheduled_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching exams:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/exams/:id - Get specific exam details
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM exams WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Exam not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching exam:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/exams - Create a new exam
router.post('/', async (req, res) => {
    const { id, title, description, scheduled_at } = req.body;

    if (!id || !title) {
        return res.status(400).json({ error: 'ID and Title are required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO exams (id, title, description, scheduled_at) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [id, title, description, scheduled_at || new Date()]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Exam ID already exists' });
        }
        console.error('Error creating exam:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/exams/:id - Delete an exam and related data
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    if (id === 'default') {
        return res.status(403).json({ error: 'Cannot delete the default exam' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Delete associated submissions
        await client.query('DELETE FROM submissions WHERE exam_id = $1', [id]);

        // 2. Delete associated questions
        await client.query('DELETE FROM questions WHERE exam_id = $1', [id]);

        // 3. Delete the exam itself
        const result = await client.query('DELETE FROM exams WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Exam not found' });
        }

        await client.query('COMMIT');
        res.json({ message: 'Exam and all associated data deleted successfully', exam: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting exam:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

export default router;
