/**
 * React Query configuration constants
 */
export const QUERY_CONFIG = {
  /**
   * Auto-refetch interval in milliseconds
   * Set to false to disable auto-refetching
   */
  REFETCH_INTERVAL: 5000, // 5 seconds

  /**
   * Whether to refetch when the browser window regains focus
   */
  REFETCH_ON_WINDOW_FOCUS: true,
} as const
