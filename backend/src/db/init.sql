CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'student', -- 'student', 'instructor', 'admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exams (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert a default exam if it doesn't exist
INSERT INTO exams (id, title, description)
VALUES ('default', 'General Assessment', 'Primary examination module for testing and evaluation.')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(255) PRIMARY KEY,
    value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings if they don't exist
INSERT INTO settings (key, value) 
VALUES ('registration_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    exam_id VARCHAR(255) REFERENCES exams(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    question TEXT NOT NULL,
    options JSONB,
    correct_answers JSONB,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    exam_id VARCHAR(255) DEFAULT 'default' REFERENCES exams(id),
    responses JSONB NOT NULL,
    violations INTEGER DEFAULT 0,
    violation_details JSONB,
    status VARCHAR(50) DEFAULT 'submitted',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_email, exam_id)
);

CREATE TABLE IF NOT EXISTS integrity_logs (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    exam_id VARCHAR(255) DEFAULT 'default' REFERENCES exams(id),
    submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
    violation_type VARCHAR(100) NOT NULL,
    violation_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    confidence FLOAT DEFAULT 0,
    frame_image BYTEA,
    frame_image_base64 TEXT,
    screen_capture BYTEA,
    keyboard_log TEXT,
    metadata JSONB,
    severity VARCHAR(50) DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_integrity_logs_user_exam ON integrity_logs(user_email, exam_id);
CREATE INDEX IF NOT EXISTS idx_integrity_logs_submission ON integrity_logs(submission_id);
CREATE INDEX IF NOT EXISTS idx_integrity_logs_timestamp ON integrity_logs(violation_timestamp);

CREATE TABLE IF NOT EXISTS exam_activity_logs (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    exam_id VARCHAR(255) DEFAULT 'default' REFERENCES exams(id),
    submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    question_id VARCHAR(50),
    question_index INTEGER,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_exam ON exam_activity_logs(user_email, exam_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_submission ON exam_activity_logs(submission_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON exam_activity_logs(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON exam_activity_logs(event_type);
