export function maskPan(value) {
  if (!value || value.length !== 10) return value;
  return `${value.slice(0, 3)}XXXXX${value.slice(-2)}`;
}
export function publicApplication(application, { includeFullPan = false } = {}) {
  const result = application.toObject ? application.toObject() : structuredClone(application);
  if (!includeFullPan && result.personalDetails) result.personalDetails.panNumber = maskPan(result.personalDetails.panNumber);
  delete result.__v;
  return result;
}
