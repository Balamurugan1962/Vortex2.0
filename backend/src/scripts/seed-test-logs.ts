import { pool } from '../db/index';

// Sample base64 image (1x1 transparent PNG)
const SAMPLE_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function seedTestLogs() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const userEmail = 'student@demo.com';
        const examId = 'default';

        console.log('🌱 Seeding test data...');

        // Check if user exists
        const userCheck = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [userEmail]
        );

        if (userCheck.rows.length === 0) {
            console.error('❌ User not found. Run npm run seed first!');
            await client.query('ROLLBACK');
            return;
        }

        // Create a test submission
        const submissionRes = await client.query(
            `INSERT INTO submissions (user_email, exam_id, responses, violations, violation_details, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_email, exam_id) DO UPDATE SET status = 'submitted'
             RETURNING id`,
            [
                userEmail,
                examId,
                JSON.stringify({ '1': 'A', '2': 'C', '3': 'B' }),
                3,
                JSON.stringify({ phone_detected: 1, eyes_off_screen: 2 }),
                'submitted'
            ]
        );

        const submissionId = submissionRes.rows[0]?.id;
        console.log(`✅ Created submission: ${submissionId}`);

        // Insert integrity logs (violations)
        const violationTypes = [
            { type: 'phone_detected', severity: 'high', confidence: 0.95 },
            { type: 'eyes_off_screen', severity: 'medium', confidence: 0.87 },
            { type: 'eyes_off_screen', severity: 'medium', confidence: 0.92 }
        ];

        for (let i = 0; i < violationTypes.length; i++) {
            const v = violationTypes[i];
            await client.query(
                `INSERT INTO integrity_logs 
                 (user_email, exam_id, submission_id, violation_type, violation_timestamp, confidence, 
                  frame_image_base64, metadata, severity)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    userEmail,
                    examId,
                    submissionId,
                    v.type,
                    new Date(Date.now() - (violationTypes.length - i) * 60000).toISOString(),
                    v.confidence,
                    SAMPLE_IMAGE,
                    JSON.stringify({ camera_id: 'builtin', frame_number: 100 + i }),
                    v.severity
                ]
            );
        }

        console.log(`✅ Inserted ${violationTypes.length} integrity violations`);

        // Insert activity logs
        const now = new Date();
        const activities = [
            {
                event_type: 'EXAM_STARTED',
                offset: 0,
                event_data: { exam_id: examId, total_questions: 3 }
            },
            {
                event_type: 'QUESTION_VIEWED',
                offset: 5000,
                event_data: { question_id: 1, question_index: 0, question_text: 'What is 2+2?' }
            },
            {
                event_type: 'ANSWER_CHANGED',
                offset: 15000,
                event_data: { question_id: 1, answer: 'A', previous_answer: null }
            },
            {
                event_type: 'TIME_SPENT_ON_QUESTION',
                offset: 35000,
                event_data: { question_id: 1, time_spent_ms: 30000 }
            },
            {
                event_type: 'QUESTION_VIEWED',
                offset: 40000,
                event_data: { question_id: 2, question_index: 1, question_text: 'What is 5*3?' }
            },
            {
                event_type: 'ANSWER_CHANGED',
                offset: 50000,
                event_data: { question_id: 2, answer: 'C', previous_answer: null }
            },
            {
                event_type: 'TIME_SPENT_ON_QUESTION',
                offset: 65000,
                event_data: { question_id: 2, time_spent_ms: 25000 }
            },
            {
                event_type: 'QUESTION_VIEWED',
                offset: 70000,
                event_data: { question_id: 3, question_index: 2, question_text: 'What is 10/2?' }
            },
            {
                event_type: 'ANSWER_CHANGED',
                offset: 80000,
                event_data: { question_id: 3, answer: 'B', previous_answer: null }
            },
            {
                event_type: 'TIME_SPENT_ON_QUESTION',
                offset: 95000,
                event_data: { question_id: 3, time_spent_ms: 25000 }
            },
            {
                event_type: 'EXAM_SUBMITTED',
                offset: 100000,
                event_data: {
                    reason: 'completed',
                    total_questions: 3,
                    questions_answered: 3,
                    total_violations: 3,
                    exam_duration_ms: 100000
                }
            }
        ];

        for (const activity of activities) {
            const eventTime = new Date(now.getTime() - 100000 + activity.offset);
            await client.query(
                `INSERT INTO exam_activity_logs 
                 (user_email, exam_id, submission_id, event_type, event_timestamp, question_id, event_data)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    userEmail,
                    examId,
                    submissionId,
                    activity.event_type,
                    eventTime.toISOString(),
                    activity.event_data.question_id || null,
                    JSON.stringify(activity.event_data)
                ]
            );
        }

        console.log(`✅ Inserted ${activities.length} activity logs`);

        await client.query('COMMIT');
        console.log('\n✅ Test data seeded successfully!');
        console.log(`📊 View at: http://localhost:3000/admin/user-profile?email=${userEmail}`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error seeding test data:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seedTestLogs();
