import express from 'express';
import { pool } from '../db';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = express.Router();

// POST /api/integrity/log - Record a violation during exam
router.post('/log', authenticateToken, async (req, res) => {
    const {
        user_email,
        exam_id = 'default',
        submission_id,
        violation_type,
        violation_timestamp,
        confidence = 0,
        frame_image_base64,
        screen_capture,
        keyboard_log,
        metadata,
        severity = 'medium'
    } = req.body;

    if (!user_email || !violation_type || !violation_timestamp) {
        console.warn('❌ Integrity log POST: Missing required fields', { user_email, violation_type, violation_timestamp });
        return res.status(400).json({ error: 'user_email, violation_type, and violation_timestamp are required' });
    }

    try {
        console.log(`📋 Recording integrity violation: ${violation_type} for ${user_email} (severity: ${severity})`);
        
        // Convert base64 to bytea if provided
        let frameImageBytea = null;
        if (frame_image_base64) {
            frameImageBytea = Buffer.from(frame_image_base64, 'base64');
        }

        const result = await pool.query(
            `INSERT INTO integrity_logs (
                user_email, exam_id, submission_id, violation_type, 
                violation_timestamp, confidence, frame_image, frame_image_base64,
                screen_capture, keyboard_log, metadata, severity
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, user_email, violation_type, violation_timestamp, confidence, severity, created_at`,
            [
                user_email,
                exam_id,
                submission_id || null,
                violation_type,
                new Date(violation_timestamp),
                confidence,
                frameImageBytea,
                frame_image_base64 || null,
                screen_capture || null,
                keyboard_log || null,
                JSON.stringify(metadata || {}),
                severity
            ]
        );

        console.log(`✅ Integrity log recorded with ID: ${result.rows[0].id}`);
        res.status(201).json({
            success: true,
            log: result.rows[0]
        });
    } catch (err) {
        console.error('❌ Error recording integrity log:', err);
        res.status(500).json({ error: 'Failed to record integrity log', details: (err instanceof Error) ? err.message : String(err) });
    }
});

// GET /api/integrity/:exam_id/:user_email - Get all violations for a student in an exam
router.get('/:exam_id/:user_email', ...requireAdmin, async (req, res) => {
    const { exam_id, user_email } = req.params;

    try {
        const result = await pool.query(
            `SELECT 
                id, user_email, exam_id, violation_type, 
                violation_timestamp, confidence, severity,
                frame_image_base64, created_at,
                metadata
            FROM integrity_logs 
            WHERE exam_id = $1 AND user_email = $2 
            ORDER BY violation_timestamp DESC`,
            [exam_id, user_email]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching integrity logs:', err);
        res.status(500).json({ error: 'Failed to fetch integrity logs' });
    }
});

// GET /api/integrity/summary/:exam_id/:user_email - Get violation summary for a student
router.get('/summary/:exam_id/:user_email', ...requireAdmin, async (req, res) => {
    const { exam_id, user_email } = req.params;

    try {
        // Get basic violation counts
        const summaryResult = await pool.query(
            `SELECT 
                COUNT(*) as total_violations,
                COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_severity,
                COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_severity,
                COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_severity,
                MIN(violation_timestamp) as first_violation,
                MAX(violation_timestamp) as last_violation
            FROM integrity_logs 
            WHERE exam_id = $1 AND user_email = $2`,
            [exam_id, user_email]
        );

        // Get violations grouped by type
        const typeResult = await pool.query(
            `SELECT violation_type, COUNT(*) as count
            FROM integrity_logs 
            WHERE exam_id = $1 AND user_email = $2
            GROUP BY violation_type`,
            [exam_id, user_email]
        );

        // Build violations_by_type object
        const violations_by_type: { [key: string]: number } = {};
        typeResult.rows.forEach(row => {
            violations_by_type[row.violation_type] = parseInt(row.count);
        });

        const summary = summaryResult.rows[0] || {};
        
        res.json({
            total_violations: parseInt(summary.total_violations || 0),
            high_severity: parseInt(summary.high_severity || 0),
            medium_severity: parseInt(summary.medium_severity || 0),
            low_severity: parseInt(summary.low_severity || 0),
            violations_by_type,
            first_violation: summary.first_violation || null,
            last_violation: summary.last_violation || null
        });
    } catch (err) {
        console.error('Error fetching integrity summary:', err);
        res.status(500).json({ error: 'Failed to fetch integrity summary' });
    }
});

// GET /api/integrity/frame/:log_id - Get a specific violation frame image
router.get('/frame/:log_id', ...requireAdmin, async (req, res) => {
    const { log_id } = req.params;

    try {
        const result = await pool.query(
            `SELECT frame_image_base64, violation_type, violation_timestamp 
            FROM integrity_logs 
            WHERE id = $1`,
            [log_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Log entry not found' });
        }

        const log = result.rows[0];
        res.json({
            frame_image: log.frame_image_base64,
            violation_type: log.violation_type,
            timestamp: log.violation_timestamp
        });
    } catch (err) {
        console.error('Error fetching frame image:', err);
        res.status(500).json({ error: 'Failed to fetch frame' });
    }
});

// GET /api/integrity/all/:exam_id - Get all violations for an exam (admin only)
router.get('/all/:exam_id', ...requireAdmin, async (req, res) => {
    const { exam_id } = req.params;

    try {
        const result = await pool.query(
            `SELECT 
                id, user_email, violation_type,
                violation_timestamp, confidence, severity,
                created_at
            FROM integrity_logs 
            WHERE exam_id = $1 
            ORDER BY violation_timestamp DESC`,
            [exam_id]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching all integrity logs:', err);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

export default router;
