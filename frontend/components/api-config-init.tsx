"use client"

import { useEffect } from "react"
import { logApiConfig } from "@/lib/api/config"

/**
 * Initializes API configuration and logs it to console in development.
 * This component ensures the API URL is correctly calculated for multi-instance setups.
 */
export function ApiConfigInit() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Log the API configuration on mount
      logApiConfig()

      // Also log whenever the component updates (e.g., after navigation)
      console.log('[API Config] Initialized. Use window.apiConfig in console to debug.')
    }
  }, [])

  return null // This component doesn't render anything
}
