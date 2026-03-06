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

        // Demo Admin
        await pool.query(
            `INSERT INTO users (name, email, password_hash, role) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (email) DO NOTHING`,
            ['Demo Admin', 'admin@demo.com', passwordHash, 'admin']
        );

        console.log('Successfully seeded demo accounts!');
        console.log('Admin: admin@demo.com / password123');
        console.log('Instructor: instructor@demo.com / password123');
        console.log('Student: student@demo.com / password123');

        console.log('\nSeeding VX-DEMO exam with 6 MCQ questions...');

        // Create VX-DEMO exam
        const examId = 'VX-DEMO';
        await pool.query(
            `INSERT INTO exams (id, title, description, status) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (id) DO NOTHING`,
            [
                examId,
                'Vortex Demo Examination',
                'Comprehensive demo exam with multiple choice questions',
                'active'
            ]
        );

        // Question 1: MCQ - Geography
        await pool.query(
            `INSERT INTO questions (exam_id, type, question, options, correct_answers) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT DO NOTHING`,
            [
                examId,
                'multiple-choice',
                'What is the capital of France?',
                JSON.stringify(['Paris', 'London', 'Berlin', 'Madrid']),
                JSON.stringify([0])
            ]
        );

        // Question 2: MCQ - Science
        await pool.query(
            `INSERT INTO questions (exam_id, type, question, options, correct_answers) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT DO NOTHING`,
            [
                examId,
                'multiple-choice',
                'What is the chemical formula for water?',
                JSON.stringify(['H2O', 'CO2', 'O2', 'H2O2']),
                JSON.stringify([0])
            ]
        );

        // Question 3: MCQ - Math
        await pool.query(
            `INSERT INTO questions (exam_id, type, question, options, correct_answers) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT DO NOTHING`,
            [
                examId,
                'multiple-choice',
                'What is 15 multiplied by 8?',
                JSON.stringify(['120', '110', '130', '140']),
                JSON.stringify([0])
            ]
        );

        // Question 4: MCQ - History
        await pool.query(
            `INSERT INTO questions (exam_id, type, question, options, correct_answers) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT DO NOTHING`,
            [
                examId,
                'multiple-choice',
                'In which year did the Titanic sink?',
                JSON.stringify(['1912', '1905', '1920', '1898']),
                JSON.stringify([0])
            ]
        );

        // Question 5: MCQ - Technology
        await pool.query(
            `INSERT INTO questions (exam_id, type, question, options, correct_answers) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT DO NOTHING`,
            [
                examId,
                'multiple-choice',
                'Which programming language is known as the "language of the web"?',
                JSON.stringify(['JavaScript', 'Python', 'Java', 'C++']),
                JSON.stringify([0])
            ]
        );

        // Question 6: MCQ - Biology
        await pool.query(
            `INSERT INTO questions (exam_id, type, question, options, correct_answers) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT DO NOTHING`,
            [
                examId,
                'multiple-choice',
                'How many chambers does a human heart have?',
                JSON.stringify(['4', '2', '3', '6']),
                JSON.stringify([0])
            ]
        );

        console.log('Successfully created VX-DEMO exam with 6 MCQ questions!');
        console.log('Exam ID: VX-DEMO');
        console.log('Questions: 6 Multiple Choice Questions');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding demo accounts:', error);
        process.exit(1);
    }
};

seedDatabase();
