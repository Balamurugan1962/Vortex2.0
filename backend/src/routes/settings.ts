import { Router } from 'express';
import { pool } from '../db';

const router = Router();

// Publicly check settings like whether registration is enabled
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT key, value FROM settings');

        const settings: Record<string, any> = {};
        result.rows.forEach(row => {
            // parse booleans 
            settings[row.key] = row.value === 'true' ? true : (row.value === 'false' ? false : row.value);
        });

        // Default if not initialized
        if (settings['registration_enabled'] === undefined) {
            settings['registration_enabled'] = true;
        }

        res.json(settings);
    } catch (error) {
        console.error('Error fetching public settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
