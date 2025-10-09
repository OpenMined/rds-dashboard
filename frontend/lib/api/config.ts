/**
 * API Configuration utilities for managing the API base URL in multi-instance setups
 */

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || "";
  }

  // Check for stored override (for manual testing)
  const storedUrl = sessionStorage.getItem('api_base_url');
  if (storedUrl) {
    return storedUrl;
  }

  // Use environment variable set by `just dev` (preferred)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // Fallback: calculate from frontend port using fixed relationship
  // Backend port is always frontend port + 5000
  const frontendPort = parseInt(window.location.port || '3000');
  const backendPort = frontendPort + 5000;
  return `http://localhost:${backendPort}`;
}

export function setApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('api_base_url', url);
    console.log(`[API Config] Set API base URL to: ${url}`);
  }
}

export function resetApiBaseUrl(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('api_base_url');
    console.log('[API Config] Reset API base URL to auto-detect');
  }
}

export function logApiConfig(): void {
  if (typeof window !== 'undefined') {
    const current = getApiBaseUrl();
    const stored = sessionStorage.getItem('api_base_url');

    console.log('=== API Configuration ===');
    console.log(`Frontend URL: ${window.location.origin}`);
    console.log(`Current API URL: ${current}`);
    console.log(`Stored Override: ${stored || 'none'}`);
    console.log(`Environment Variable: ${process.env.NEXT_PUBLIC_API_URL || 'not set'}`);
    console.log('========================');
  }
}

// Expose utilities globally for debugging
if (typeof window !== 'undefined') {
  (window as any).apiConfig = {
    get: getApiBaseUrl,
    set: setApiBaseUrl,
    reset: resetApiBaseUrl,
    log: logApiConfig,
  };
}
