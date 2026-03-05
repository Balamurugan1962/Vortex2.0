import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/vortex',
});

// Test raw DB connection route
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'ok', time: result.rows[0].now });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Database connection failed' });
    }
});

// Example route
app.get('/api', (req, res) => {
    res.json({ message: 'Welcome to Vortex API' });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
