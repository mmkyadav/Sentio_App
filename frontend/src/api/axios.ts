import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject the custom Gemini API key if present in localStorage
api.interceptors.request.use((config) => {
  const customKey = localStorage.getItem('sentio_gemini_key');
  if (customKey && config.headers) {
    config.headers['x-gemini-key'] = customKey;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor to auto-logout on stale sessions (e.g. database resets returning 404 for current user)
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && error.response.status === 404) {
    const currentUrl = error.config.url || '';
    const storedUserStr = localStorage.getItem('sentio_user');
    if (storedUserStr) {
      try {
        const storedUser = JSON.parse(storedUserStr);
        const username = storedUser.username;
        if (currentUrl.includes(`/api/users/${username}`)) {
          console.warn("Current user profile not found in database. Logging out...");
          localStorage.removeItem('sentio_user');
          // Force page reload to auth screen
          window.location.href = '/auth';
        }
      } catch (e) {
        console.error("Error parsing stored user during 404 check", e);
      }
    }
  }
  return Promise.reject(error);
});

export default api;
