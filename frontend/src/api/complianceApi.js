import api from './client.js';

export const getComplianceDashboard = async (params = {}) => (await api.get('/compliance/dashboard', { params })).data.data;
export const getAuditHistory = async (id, params = {}) => (await api.get(`/compliance/audit/${encodeURIComponent(id)}`, { params })).data.data;
export async function downloadDecisions(params = {}) {
  const response = await api.get('/compliance/decisions/export', { params, responseType: 'blob' });
  const url = URL.createObjectURL(response.data); const link = document.createElement('a');
  link.href = url; link.download = 'decisions.csv'; link.click(); URL.revokeObjectURL(url);
}
