import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { requireAdmin } from '../middleware/admin';

const router = Router();

// Protect all admin routes
router.use(requireAdmin);

// Get all users
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin creates a user
router.post('/users', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: 'Name, email, password, and role are required' });
        }

        const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const result = await pool.query(
            'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
            [name, email, passwordHash, role]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin deletes a user
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        // Prevent admin logic from deleting itself safely
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully', id: userId });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get registration setting
router.get('/settings', async (req, res) => {
    try {
        const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['registration_enabled']);
        res.json({ registration_enabled: result.rows[0]?.value === 'true' });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update registration setting
router.put('/settings', async (req, res) => {
    try {
        const { registration_enabled } = req.body;

        if (typeof registration_enabled !== 'boolean') {
            return res.status(400).json({ error: 'registration_enabled must be a boolean' });
        }

        await pool.query(
            `INSERT INTO settings (key, value) 
             VALUES ($1, $2) 
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
            ['registration_enabled', registration_enabled ? 'true' : 'false']
        );

        res.json({ message: 'Settings updated successfully', registration_enabled });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
