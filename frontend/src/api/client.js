import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  timeout: 20000,
  headers: { Accept: 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('onboardiq.token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('onboardiq.token')) {
      localStorage.removeItem('onboardiq.token');
      window.dispatchEvent(new CustomEvent('onboardiq:session-expired'));
    }
    return Promise.reject(error);
  }
);

export function getApiError(error) {
  const data = error?.response?.data;
  if (!error?.response) return 'Unable to reach the OnboardIQ API. Check that the backend is running.';
  const details = data?.error?.details?.map((item) => item.issue).filter(Boolean).join(' ');
  return details || data?.message || 'The request could not be completed.';
}

export default api;
