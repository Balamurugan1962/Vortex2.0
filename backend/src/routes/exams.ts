import express from 'express';
import { pool } from '../db';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = express.Router();

// Helper to generate a random access code
const generateAccessCode = () => {
    return 'VX-' + Math.random().toString(36).substring(2, 7).toUpperCase();
};

// Create a new exam
router.post('/', authenticateToken, async (req, res) => {
    const { title, description, duration, total_marks, questions } = req.body;
    const instructor_id = (req as any).user.id;
    const access_code = generateAccessCode();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const examResult = await client.query(
            'INSERT INTO exams (title, description, duration, total_marks, access_code, instructor_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [title, description, duration, total_marks, access_code, instructor_id]
        );

        const examId = examResult.rows[0].id;

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            await client.query(
                'INSERT INTO questions (exam_id, type, text, options, correct_answers, order_index) VALUES ($1, $2, $3, $4, $5, $6)',
                [examId, q.type, q.text, q.options, q.correctAnswers, i]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ ...examResult.rows[0], questions_count: questions.length });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating exam:', error);
        res.status(500).json({ error: 'Failed to create exam' });
    } finally {
        client.release();
    }
});

// Get exam bundle for student (Public but requires valid code)
router.get('/bundle/:code', async (req, res) => {
    const { code } = req.params;

    try {
        const examResult = await pool.query('SELECT * FROM exams WHERE access_code = $1', [code]);
        if (examResult.rows.length === 0) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        const exam = examResult.rows[0];
        const questionsResult = await pool.query('SELECT * FROM questions WHERE exam_id = $1 ORDER BY order_index ASC', [exam.id]);

        // Remove correct answers from the bundle for security
        const questions = questionsResult.rows.map(q => {
            const { correct_answers, ...rest } = q;
            return rest;
        });

        res.json({
            ...exam,
            questions
        });
    } catch (error) {
        console.error('Error fetching bundle:', error);
        res.status(500).json({ error: 'Failed to fetch exam bundle' });
    }
});

// Submit exam results with server-side grading
router.post('/submissions', authenticateToken, async (req, res) => {
    const { exam_id, answers } = req.body; // answers: { [question_id]: answer }
    const student_id = (req as any).user.id;

    try {
        // Fetch correct answers for grading
        const questionsResult = await pool.query(
            'SELECT id, type, correct_answers FROM questions WHERE exam_id = $1',
            [exam_id]
        );

        let score = 0;
        const questions = questionsResult.rows;

        for (const q of questions) {
            const studentAnswer = answers[q.id];
            if (studentAnswer === undefined) continue;

            const correctAnswers = q.correct_answers; // This is a JSONB array/object from DB

            if (q.type === 'MCQ' || q.type === 'Scenario') {
                // For MCQ, studentAnswer is an index, correctAnswers should be [index]
                if (Array.isArray(correctAnswers) && studentAnswer === correctAnswers[0]) {
                    score++;
                }
            } else if (q.type === 'Multi-select') {
                // For Multi-select, studentAnswer is array of indices, correctAnswers is array of indices
                if (Array.isArray(studentAnswer) && Array.isArray(correctAnswers)) {
                    const isCorrect = studentAnswer.length === correctAnswers.length &&
                        studentAnswer.every(val => correctAnswers.includes(val));
                    if (isCorrect) score++;
                }
            } else if (q.type === 'Short Answer') {
                // For Short Answer, case-insensitive match
                if (typeof studentAnswer === 'string' && Array.isArray(correctAnswers)) {
                    if (correctAnswers.some(ans => ans.toString().toLowerCase().trim() === studentAnswer.toLowerCase().trim())) {
                        score++;
                    }
                }
            }
            // Long Answer/Scenario might need manual grading or LLM, setting to 0 for now or basic match
        }

        const result = await pool.query(
            'INSERT INTO submissions (exam_id, student_id, answers, score) VALUES ($1, $2, $3, $4) RETURNING *',
            [exam_id, student_id, answers, score]
        );

        res.status(201).json({
            ...result.rows[0],
            message: 'Exam submitted and graded successfully'
        });
    } catch (error) {
        console.error('Error submitting exam:', error);
        res.status(500).json({ error: 'Failed to submit exam' });
    }
});

// Get all exams for an instructor
router.get('/instructor', authenticateToken, async (req, res) => {
    const instructor_id = (req as any).user.id;
    try {
        const result = await pool.query('SELECT * FROM exams WHERE instructor_id = $1 ORDER BY created_at DESC', [instructor_id]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch exams' });
    }
});

export default router;
