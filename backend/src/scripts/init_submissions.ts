import { pool } from '../db';

async function initSubmissionsTable() {
    const sql = `
        CREATE TABLE IF NOT EXISTS submissions (
            id SERIAL PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL,
            exam_id VARCHAR(255) DEFAULT 'default',
            responses JSONB NOT NULL,
            violations INTEGER DEFAULT 0,
            violation_details JSONB,
            status VARCHAR(50) DEFAULT 'submitted',
            submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_email, exam_id)
        );
    `;
    try {
        await pool.query(sql);
        console.log('Submissions table created successfully');
        process.exit(0);
    } catch (err) {
        console.error('Error creating submissions table:', err);
        process.exit(1);
    }
}

initSubmissionsTable();
