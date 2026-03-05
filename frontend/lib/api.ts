export const getBaseApiUrl = () => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('vortex_api_url') || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
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
export async function getInstructorExams() {
    const response = await fetch(`${getBaseApiUrl()}/exams/instructor`, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to fetch exams');
    }

    return await response.json();
}

export async function createExam(examData: any) {
    const response = await fetch(`${getBaseApiUrl()}/exams`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(examData)
    });

    if (!response.ok) {
        throw new Error('Failed to create exam');
    }

    return await response.json();
}

export async function getExamBundle(code: string) {
    const response = await fetch(`${getBaseApiUrl()}/exams/bundle/${code}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to download exam package');
    }

    return await response.json();
}

export async function submitExamAnswers(examId: number, answers: any) {
    const response = await fetch(`${getBaseApiUrl()}/exams/submissions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ exam_id: examId, answers })
    });

    if (!response.ok) {
        throw new Error('Failed to submit exam');
    }

    return await response.json();
}
