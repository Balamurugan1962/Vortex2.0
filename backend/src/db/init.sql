CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'student', -- 'student', 'instructor', 'admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Note: We can expand this with exam records, organization ids etc later.

CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    exam_id VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    question TEXT NOT NULL,
    options JSONB,
    correct_answers JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(255) PRIMARY KEY,
    value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings if they don't exist
INSERT INTO settings (key, value) 
VALUES ('registration_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

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
