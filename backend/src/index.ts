import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool, initDb } from './db';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import settingsRoutes from './routes/settings';
import questionsRoutes from './routes/questions';
import submissionsRoutes from './routes/submissions';
import examsRoutes from './routes/exams';

dotenv.config();

console.log('Starting Vortex Backend...');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Database
initDb();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/exams', examsRoutes);
console.log('Registered /api/questions, /api/submissions, /api/exams');

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
