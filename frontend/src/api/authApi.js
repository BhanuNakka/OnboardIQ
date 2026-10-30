import api from './client.js';

export const loginRequest = async (credentials) => (await api.post('/auth/login', credentials)).data.data;
export const registerRequest = async (payload) => (await api.post('/auth/register', payload)).data.data;
export const currentUserRequest = async () => (await api.get('/auth/me')).data.data.user;
