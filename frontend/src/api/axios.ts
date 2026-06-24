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

export default api;
