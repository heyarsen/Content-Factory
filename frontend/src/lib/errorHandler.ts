/**
 * Centralized error handling utility for consistent error formatting and display
 */

export interface ApiError {
  message: string
  status?: number
  code?: string
  response?: {
    status?: number
    data?: {
      error?: string | { message?: string; code?: string }
      message?: string
    }
  }
}

export interface ErrorHandlingOptions {
  /**
   * Whether to show a toast notification to the user
   * @default true
   */
  showToast?: boolean
  /**
   * Whether to log the error to console
   * @default true
   */
  logError?: boolean
  /**
   * Custom error message to use instead of extracted message
   */
  customMessage?: string
  /**
   * Whether this is a silent error (no user notification)
   * @default false
   */
  silent?: boolean
}

/**
 * Extracts a user-friendly error message from various error formats
 */
export function extractErrorMessage(error: unknown): string {
  if (!error) {
    return 'An unexpected error occurred'
  }

  // Handle Error objects
  if (error instanceof Error) {
    const apiError = error as ApiError

    // Check for API response errors
    if (apiError.response?.data) {
      const data = apiError.response.data

      // Handle nested error objects
      if (data.error) {
        if (typeof data.error === 'string') {
          return data.error
        }
        if (typeof data.error === 'object' && data.error.message) {
          return data.error.message
        }
      }

      // Check for message field
      if (data.message) {
        return data.message
      }
    }

    // Check for specific error codes
    if (apiError.code === 'ECONNABORTED' || apiError.code === 'ETIMEDOUT') {
      return 'Request timed out. Please try again.'
    }
    if (apiError.code === 'ERR_NETWORK' || apiError.message === 'Network Error') {
      return 'Network error. Please check your connection.'
    }

    // Use error message if available
    if (apiError.message) {
      return apiError.message
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error
  }

  // Fallback
  return 'An unexpected error occurred'
}

/**
 * Determines if an error should be shown to the user or logged silently
 */
export function shouldShowError(error: unknown): boolean {
  if (!error) return false

  const apiError = error as ApiError

  // Don't show network errors during polling (they're expected)
  if (apiError.code === 'ECONNABORTED' || apiError.code === 'ETIMEDOUT') {
    // Only show if it's not a polling request
    const url = (apiError as any).config?.url || ''
    if (url.includes('/generation-status') || url.includes('/training-status')) {
      return false
    }
  }

  // Show 4xx and 5xx errors
  if (apiError.response?.status) {
    const status = apiError.response.status
    if (status >= 400 && status < 600) {
      return true
    }
  }

  // Show errors with messages
  if (extractErrorMessage(error) !== 'An unexpected error occurred') {
    return true
  }

  return false
}

/**
 * Handles errors consistently across the application
 */
export function handleError(
  error: unknown,
  options: ErrorHandlingOptions = {}
): string {
  const {
    logError = true,
    customMessage,
    silent = false,
  } = options

  const errorMessage = customMessage || extractErrorMessage(error)

  // Log error if requested
  if (logError && !silent) {
    console.error('Error handled:', {
      message: errorMessage,
      error,
      stack: error instanceof Error ? error.stack : undefined,
    })
  }

  // Return message for caller to handle (e.g., show toast)
  return errorMessage
}

/**
 * Formats error for specific error types (HeyGen API, etc.)
 */
export function formatSpecificError(error: unknown): string {
  const apiError = error as ApiError
  const errorData = apiError.response?.data
  const errorObj = errorData?.error
  const errorCode = typeof errorObj === 'object' && errorObj?.code 
    ? errorObj.code 
    : typeof errorObj === 'string' 
      ? undefined 
      : (errorObj as any)?.code

  // Handle 402 Payment Required (insufficient credits)
  if (apiError.response?.status === 402) {
    const message = extractErrorMessage(error)
    // If the error message mentions credits, use it directly
    if (message.toLowerCase().includes('credit')) {
      return message
    }
    return 'Insufficient credits. Please add credits to continue.'
  }

  // Avatar/video provider specific errors
  if (errorCode === 'insufficient_credit' || 
      extractErrorMessage(error).includes('Insufficient credit')) {
    return 'Insufficient credit. Please add credits to your avatar provider account.'
  }

  // Storage bucket errors
  const message = extractErrorMessage(error)
  if (message.includes('bucket') || message.includes('Bucket')) {
    return 'Storage bucket not configured. Please contact support to set up avatar storage.'
  }

  // Timeout errors
  if (message.includes('timeout') || apiError.code === 'ECONNABORTED') {
    return 'Request timed out. Please try again.'
  }

  // Return default formatted message
  return extractErrorMessage(error)
}
