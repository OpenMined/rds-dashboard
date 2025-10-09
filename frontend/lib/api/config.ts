/**
 * API Configuration utilities for managing the API base URL in multi-instance setups
 */

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || "";
  }

  // Check for stored override
  const storedUrl = sessionStorage.getItem('api_base_url');
  if (storedUrl) {
    return storedUrl;
  }

  // Calculate from frontend port in development
  if (process.env.NODE_ENV === 'development') {
    const frontendPort = parseInt(window.location.port || '3000');
    const backendPort = 8001 + (frontendPort - 3000);
    return `http://localhost:${backendPort}`;
  }

  return process.env.NEXT_PUBLIC_API_URL || "";
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
    const frontendPort = window.location.port || '3000';
    const stored = sessionStorage.getItem('api_base_url');

    console.log('=== API Configuration ===');
    console.log(`Frontend URL: ${window.location.origin}`);
    console.log(`Frontend Port: ${frontendPort}`);
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
