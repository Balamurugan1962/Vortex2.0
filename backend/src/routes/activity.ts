import express from 'express';
import { pool } from '../db';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = express.Router();

// POST /api/activity/log - Record an activity event during exam
router.post('/log', authenticateToken, async (req, res) => {
    const {
        user_email,
        exam_id = 'default',
        submission_id,
        event_type,
        event_timestamp,
        question_id,
        question_index,
        event_data
    } = req.body;

    if (!user_email || !event_type || !event_timestamp) {
        return res.status(400).json({ error: 'user_email, event_type, and event_timestamp are required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO exam_activity_logs (
                user_email, exam_id, submission_id, event_type, 
                event_timestamp, question_id, question_index, event_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, user_email, event_type, event_timestamp, created_at`,
            [
                user_email,
                exam_id,
                submission_id || null,
                event_type,
                new Date(event_timestamp),
                question_id || null,
                question_index || null,
                JSON.stringify(event_data || {})
            ]
        );

        res.status(201).json({
            success: true,
            log: result.rows[0]
        });
    } catch (err) {
        console.error('Error recording activity log:', err);
        res.status(500).json({ error: 'Failed to record activity log' });
    }
});

// POST /api/activity/batch - Record multiple activity events at once
router.post('/batch', authenticateToken, async (req, res) => {
    const { logs } = req.body;

    if (!Array.isArray(logs) || logs.length === 0) {
        console.warn('❌ Activity batch POST: Invalid logs array', logs);
        return res.status(400).json({ error: 'logs array is required' });
    }

    try {
        console.log(`📥 Activity batch received: ${logs.length} logs from ${logs[0]?.user_email}`);
        
        const insertPromises = logs.map((log, idx) => {
            console.log(`  [${idx + 1}/${logs.length}] Saving ${log.event_type} for ${log.user_email}`);
            return pool.query(
                `INSERT INTO exam_activity_logs (
                    user_email, exam_id, submission_id, event_type, 
                    event_timestamp, question_id, question_index, event_data
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    log.user_email,
                    log.exam_id || 'default',
                    log.submission_id || null,
                    log.event_type,
                    new Date(log.event_timestamp),
                    log.question_id || null,
                    log.question_index || null,
                    JSON.stringify(log.event_data || {})
                ]
            );
        });

        await Promise.all(insertPromises);

        console.log(`✅ All ${logs.length} activity logs recorded successfully`);
        res.status(201).json({
            success: true,
            count: logs.length,
            message: `Successfully recorded ${logs.length} activity logs`
        });
    } catch (err) {
        console.error('❌ Error recording batch activity logs:', err);
        res.status(500).json({ error: 'Failed to record activity logs', details: (err instanceof Error) ? err.message : String(err) });
    }
});

// GET /api/activity/summary/:exam_id/:user_email - Get activity summary (MUST BE BEFORE generic route)
router.get('/summary/:exam_id/:user_email', ...requireAdmin, async (req, res) => {
    const { exam_id, user_email } = req.params;

    try {
        const statsResult = await pool.query(
            `SELECT 
                COUNT(*) as total_events,
                MIN(event_timestamp) as exam_started,
                MAX(event_timestamp) as exam_ended,
                COUNT(DISTINCT question_id) as questions_viewed
            FROM exam_activity_logs 
            WHERE exam_id = $1 AND user_email = $2`,
            [exam_id, user_email]
        );

        const eventTypesResult = await pool.query(
            `SELECT event_type, COUNT(*) as count
            FROM exam_activity_logs 
            WHERE exam_id = $1 AND user_email = $2
            GROUP BY event_type`,
            [exam_id, user_email]
        );

        const events_by_type: { [key: string]: number } = {};
        eventTypesResult.rows.forEach(row => {
            events_by_type[row.event_type] = parseInt(row.count);
        });

        const stats = statsResult.rows[0] || {};
        
        // Calculate exam duration
        let exam_duration_seconds = 0;
        if (stats.exam_started && stats.exam_ended) {
            const start = new Date(stats.exam_started);
            const end = new Date(stats.exam_ended);
            exam_duration_seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
        }

        res.json({
            total_events: parseInt(stats.total_events || 0),
            exam_started: stats.exam_started || null,
            exam_ended: stats.exam_ended || null,
            exam_duration_seconds,
            questions_viewed: parseInt(stats.questions_viewed || 0),
            events_by_type
        });
    } catch (err) {
        console.error('Error fetching activity summary:', err);
        res.status(500).json({ error: 'Failed to fetch activity summary' });
    }
});

// GET /api/activity/:exam_id/:user_email - Get all activity logs for a student
router.get('/:exam_id/:user_email', ...requireAdmin, async (req, res) => {
    const { exam_id, user_email } = req.params;

    try {
        const result = await pool.query(
            `SELECT 
                id, user_email, exam_id, event_type, 
                event_timestamp, question_id, question_index,
                event_data, created_at
            FROM exam_activity_logs 
            WHERE exam_id = $1 AND user_email = $2 
            ORDER BY event_timestamp ASC`,
            [exam_id, user_email]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching activity logs:', err);
        res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
});

export default router;
