import api from './client.js';

export const listDocuments = async (applicationId) => (await api.get(`/applications/${encodeURIComponent(applicationId)}/documents`)).data.data;
export const listExtractions = async (applicationId) => (await api.get(`/applications/${encodeURIComponent(applicationId)}/extractions`)).data.data;
export async function uploadDocument(applicationId, documentType, file, onUploadProgress) {
  const form = new FormData(); form.append('documentType', documentType); form.append('file', file);
  return (await api.post(`/applications/${encodeURIComponent(applicationId)}/documents`, form, { onUploadProgress })).data.data.document;
}
