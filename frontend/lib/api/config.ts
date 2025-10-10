/**
 * API Configuration utilities for managing the API base URL in multi-instance setups
 */

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return "";
  }

  // Check for stored override (for manual testing)
  const storedUrl = sessionStorage.getItem('api_base_url');
  if (storedUrl) {
    return storedUrl;
  }

  // Auto-detect based on environment
  const isDevMode = process.env.NEXT_PUBLIC_DEBUG === 'true';
  const currentPort = parseInt(window.location.port || '80');

  // Dev mode: Frontend on dev server, backend is frontend_port + 5000
  // Production: Backend serves frontend on same port (typically 8000+)
  if (isDevMode) {
    // Dev mode: calculate backend port
    const backendPort = currentPort + 5000;
    return `http://localhost:${backendPort}`;
  } else {
    // Production mode: backend on same port as frontend
    return window.location.origin;
  }
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
    const mode = process.env.NEXT_PUBLIC_DEBUG === 'true' ? 'dev' : 'production';

    console.log('=== API Configuration ===');
    console.log(`Mode: ${mode}`);
    console.log(`Frontend URL: ${window.location.origin}`);
    console.log(`Current API URL: ${current}`);
    console.log(`Stored Override: ${stored || 'none'}`);
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
