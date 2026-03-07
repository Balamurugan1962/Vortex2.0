import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@db:5432/vortex',
});

export const initDb = async (retries = 5, delay = 5000) => {
    while (retries > 0) {
        try {
            const initSqlPath = path.join(process.cwd(), 'src', 'db', 'init.sql');
            const sql = fs.readFileSync(initSqlPath, 'utf8');
            await pool.query(sql);
            console.log('Database initialized successfully.');
            return;
        } catch (error) {
            retries -= 1;
            console.error(`Database initialization attempt failed. Retries left: ${retries}`);
            if (retries === 0) {
                console.error('Final database initialization failure:', error);
                throw error;
            }
            await new Promise(res => setTimeout(res, delay));
        }
    }
};
