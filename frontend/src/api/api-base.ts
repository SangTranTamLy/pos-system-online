const DEFAULT_API_BASE_URL = "https://pos-system-online.onrender.com/api";

function normalizeApiBaseUrl(value?: string) {
  const rawBaseUrl = (value || DEFAULT_API_BASE_URL).trim();
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");

  return baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;
}

export const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL as string | undefined
);
