import api from './client.js';

export const getMakerQueue = async (params = {}) => (await api.get('/officer/review-queue', { params })).data.data;
export const getMakerApplication = async (id) => (await api.get(`/officer/applications/${encodeURIComponent(id)}`)).data.data;
export const recommendApplication = async (id, payload) => (await api.post(`/officer/applications/${encodeURIComponent(id)}/recommend`, payload)).data.data;
export const getCheckerQueue = async (params = {}) => (await api.get('/checker/pending', { params })).data.data;
export const decideApplication = async (id, payload) => (await api.post(`/checker/applications/${encodeURIComponent(id)}/decision`, payload)).data.data;
