import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@db:5432/vortex',
});

export const initDb = async () => {
    try {
        const initSqlPath = path.join(process.cwd(), 'src', 'db', 'init.sql');
        const sql = fs.readFileSync(initSqlPath, 'utf8');
        await pool.query(sql);
        console.log('Database initialized successfully.');
    } catch (error) {
        console.error('Failed to initialize database:', error);
    }
};
