/** Базовый URL бэкенда (без /api). Для Docker: REACT_APP_API_ORIGIN=http://backend:8080 */
export const API_ORIGIN = process.env.REACT_APP_API_ORIGIN || 'http://localhost:8080';

export function fileAbsoluteUrl(pathOrFilename) {
  if (!pathOrFilename) return null;
  const u = String(pathOrFilename).trim();
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/api/files/')) return `${API_ORIGIN}${u}`;
  if (!u.startsWith('/')) return `${API_ORIGIN}/api/files/${u}`;
  return `${API_ORIGIN}${u}`;
}
