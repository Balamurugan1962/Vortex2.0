export const getBaseApiUrl = () => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('vortex_api_url');
        // Force update if pointing to legacy 3002 port
        if (stored && stored.includes(':3002')) {
            localStorage.removeItem('vortex_api_url');
            return 'http://localhost:3001/api';
        }
        return stored || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    }
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
};

export const getAuthToken = () => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('vortex_auth_token');
    }
    return null;
};

export const setAuthToken = (token: string) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('vortex_auth_token', token);
    }
};

export const logout = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('vortex_auth_token');
    }
};

const authHeaders = () => {
    const token = getAuthToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export async function checkHealth(customUrl?: string) {
    const urlToUse = customUrl || getBaseApiUrl();
    try {
        const response = await fetch(`${urlToUse}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error('Backend responded with an error');
        }
        return await response.json();
    } catch (error) {
        console.error('API health check failed:', error);
        throw error;
    }
}

export async function login(email: string, password: string) {
    const response = await fetch(`${getBaseApiUrl()}/auth/login`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Login failed');
    }

    return await response.json();
}

export async function register(name: string, email: string, password: string, role?: string) {
    const response = await fetch(`${getBaseApiUrl()}/auth/register`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name, email, password, role })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Registration failed');
    }

    return await response.json();
}

export async function getMe() {
    const response = await fetch(`${getBaseApiUrl()}/auth/me`, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to fetch user profile');
    }

    return await response.json();
}

export async function getSettings() {
    const response = await fetch(`${getBaseApiUrl()}/settings`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    });

    if (!response.ok) {
        return { registration_enabled: true }; // default fallback 
    }

    return await response.json();
}

export async function getAdminUsers() {
    const response = await fetch(`${getBaseApiUrl()}/admin/users`, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to fetch users');
    }

    return await response.json();
}

export async function toggleRegistration(enabled: boolean) {
    const response = await fetch(`${getBaseApiUrl()}/admin/settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ registration_enabled: enabled })
    });

    if (!response.ok) {
        throw new Error('Failed to update registration settings');
    }

    return await response.json();
}

export async function deleteUser(id: string | number) {
    const response = await fetch(`${getBaseApiUrl()}/admin/users/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to delete user');
    }

    return await response.json();
}

// Integrity Log Functions
export async function recordIntegrityLog(logData: {
    user_email: string;
    exam_id?: string;
    submission_id?: number;
    violation_type: string;
    violation_timestamp: string;
    confidence?: number;
    frame_image_base64?: string;
    screen_capture?: string;
    keyboard_log?: string;
    metadata?: any;
    severity?: string;
}) {
    const response = await fetch(`${getBaseApiUrl()}/integrity/log`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(logData)
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to record integrity log');
    }

    return await response.json();
}

export async function getIntegrityLogs(examId: string, userEmail: string) {
    const response = await fetch(`${getBaseApiUrl()}/integrity/${examId}/${userEmail}`, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to fetch integrity logs');
    }

    return await response.json();
}

export async function getIntegritySummary(examId: string, userEmail: string) {
    const response = await fetch(`${getBaseApiUrl()}/integrity/summary/${examId}/${userEmail}`, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to fetch integrity summary');
    }

    return await response.json();
}

export async function getIntegrityFrame(logId: number) {
    const response = await fetch(`${getBaseApiUrl()}/integrity/frame/${logId}`, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to fetch frame');
    }

    return await response.json();
}

export async function getAllIntegrityLogs(examId: string) {
    const response = await fetch(`${getBaseApiUrl()}/integrity/all/${examId}`, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to fetch all integrity logs');
    }

    return await response.json();
}

// Activity Log Functions
export async function recordActivityLog(logData: {
    user_email: string;
    exam_id?: string;
    submission_id?: number;
    event_type: string;
    event_timestamp: string;
    question_id?: string;
    question_index?: number;
    event_data?: any;
}) {
    const response = await fetch(`${getBaseApiUrl()}/activity/log`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(logData)
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to record activity log');
    }

    return await response.json();
}

export async function recordActivityBatch(logs: any[]) {
    const response = await fetch(`${getBaseApiUrl()}/activity/batch`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ logs })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to record activity logs');
    }

    return await response.json();
}

export async function getActivityLogs(examId: string, userEmail: string) {
    const response = await fetch(`${getBaseApiUrl()}/activity/${examId}/${userEmail}`, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to fetch activity logs');
    }

    return await response.json();
}

export async function getActivitySummary(examId: string, userEmail: string) {
    const response = await fetch(`${getBaseApiUrl()}/activity/summary/${examId}/${userEmail}`, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to fetch activity summary');
    }

    return await response.json();
}
