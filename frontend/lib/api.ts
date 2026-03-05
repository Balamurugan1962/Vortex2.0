export const getBaseApiUrl = () => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('vortex_api_url') || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    }
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
};

export async function checkHealth(customUrl?: string) {
    const urlToUse = customUrl || getBaseApiUrl();
    try {
        const response = await fetch(`${urlToUse}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            // Reduce timeout if possible or just use standard fetch
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
