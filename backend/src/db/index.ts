import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@db:5432/vortex',
});

export const initDb = async () => {
    const initSqlPath = path.join(process.cwd(), 'src', 'db', 'init.sql');
    const sql = fs.readFileSync(initSqlPath, 'utf8');

    const maxAttempts = 10;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await pool.query(sql);
            console.log('Database initialized successfully.');
            return;
        } catch (error) {
            const isLastAttempt = attempt === maxAttempts;
            console.error(`Failed to initialize database (attempt ${attempt}/${maxAttempts}):`, error);

            if (isLastAttempt) {
                throw error;
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }
};
