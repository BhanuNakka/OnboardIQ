import api from './client.js';

export const listMine = async (params = {}) => (await api.get('/applications/mine', { params })).data.data;
export const listAll = async (params = {}) => (await api.get('/applications', { params })).data.data;
export const getApplication = async (applicationId) => (await api.get(`/applications/${encodeURIComponent(applicationId)}`)).data.data.application;
export const createApplication = async (payload) => (await api.post('/applications', payload)).data.data.application;
export const updateApplication = async (applicationId, payload) => (await api.patch(`/applications/${encodeURIComponent(applicationId)}`, payload)).data.data.application;
export const submitApplication = async (applicationId) => (await api.post(`/applications/${encodeURIComponent(applicationId)}/submit`, {})).data.data;
export const getDecision = async (applicationId) => (await api.get(`/applications/${encodeURIComponent(applicationId)}/decision`)).data.data.decision;
