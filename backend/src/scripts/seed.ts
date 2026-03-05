import { pool, initDb } from '../db';
import bcrypt from 'bcryptjs';

const seedDatabase = async () => {
    try {
        console.log('Initializing database schema...');
        await initDb();

        console.log('Seeding demo accounts...');

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('password123', salt);

        // Demo Instructor
        await pool.query(
            `INSERT INTO users (name, email, password_hash, role) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (email) DO NOTHING`,
            ['Demo Instructor', 'instructor@demo.com', passwordHash, 'instructor']
        );

        // Demo Student
        await pool.query(
            `INSERT INTO users (name, email, password_hash, role) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (email) DO NOTHING`,
            ['Demo Student', 'student@demo.com', passwordHash, 'student']
        );

        console.log('Successfully seeded demo accounts!');
        console.log('Instructor: instructor@demo.com / password123');
        console.log('Student: student@demo.com / password123');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding demo accounts:', error);
        process.exit(1);
    }
};

seedDatabase();
