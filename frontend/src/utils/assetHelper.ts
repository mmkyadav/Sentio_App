/**
 * Helper to dynamically resolve URL paths for uploaded assets (images, documents, avatars).
 * Handles external URLs (like Supabase, Cloudflare R2) and relative URLs (like /uploads/...).
 */
export const getAssetUrl = (path?: string): string => {
  if (!path) return '';
  
  // If the path is already a full URL, return it as is
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  
  // Clean prefix slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Get API Base URL from Vite environment variables or fallback to localhost
  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
  const cleanBase = API_BASE.endsWith('/') ? API_BASE : `${API_BASE}/`;
  
  return `${cleanBase}${cleanPath}`;
};
