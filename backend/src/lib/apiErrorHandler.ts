/**
 * API Error Handler - Standardizes error responses across the API
 */

export enum ErrorCode {
  // Avatar errors
  AVATAR_NOT_FOUND = 'AVATAR_NOT_FOUND',
  AVATAR_CREATION_FAILED = 'AVATAR_CREATION_FAILED',
  AVATAR_ALREADY_EXISTS = 'AVATAR_ALREADY_EXISTS',
  
  // Training errors
  TRAINING_NOT_COMPLETE = 'TRAINING_NOT_COMPLETE',
  TRAINING_IN_PROGRESS = 'TRAINING_IN_PROGRESS',
  TRAINING_FAILED = 'TRAINING_FAILED',
  TRAINING_STATUS_CHECK_FAILED = 'TRAINING_STATUS_CHECK_FAILED',
  
  // Look generation errors
  LOOK_GENERATION_FAILED = 'LOOK_GENERATION_FAILED',
  LOOK_GENERATION_TIMEOUT = 'LOOK_GENERATION_TIMEOUT',
  INSUFFICIENT_CREDIT = 'INSUFFICIENT_CREDIT',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_IMAGE = 'INVALID_IMAGE',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // HeyGen API errors
  HEYGEN_API_ERROR = 'HEYGEN_API_ERROR',
  HEYGEN_API_TIMEOUT = 'HEYGEN_API_TIMEOUT',
  
  // Storage errors
  STORAGE_ERROR = 'STORAGE_ERROR',
  STORAGE_BUCKET_NOT_FOUND = 'STORAGE_BUCKET_NOT_FOUND',
  
  // Generic errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

export interface ApiErrorResponse {
  error: string
  code?: ErrorCode | string
  details?: any
  timestamp?: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: ErrorCode | string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }

  toJSON(): ApiErrorResponse {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Map HeyGen API errors to user-friendly messages and error codes
 */
export function mapHeyGenError(error: any): { message: string; code?: ErrorCode } {
  if (!error) {
    return { message: 'An unknown error occurred', code: ErrorCode.HEYGEN_API_ERROR }
  }

  const errorData = error.response?.data || error.data || {}
  const errorMessage = errorData.error?.message || errorData.error || errorData.message || error.message || 'HeyGen API error'
  const errorCode = errorData.error?.code || errorData.code

  // Map specific HeyGen error codes
  if (errorCode === 'insufficient_credit' || errorMessage.includes('Insufficient credit')) {
    return {
      message: 'Insufficient credit. Please add credits to your HeyGen account.',
      code: ErrorCode.INSUFFICIENT_CREDIT,
    }
  }

  if (errorMessage.includes('Model not found') || errorCode === 'invalid_parameter') {
    return {
      message: 'Avatar is not trained yet. Please wait for training to complete.',
      code: ErrorCode.TRAINING_NOT_COMPLETE,
    }
  }

  if (errorMessage.includes('timeout') || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return {
      message: 'Request to HeyGen API timed out. Please try again.',
      code: ErrorCode.HEYGEN_API_TIMEOUT,
    }
  }

  // Return generic HeyGen error
  return {
    message: errorMessage,
    code: ErrorCode.HEYGEN_API_ERROR,
  }
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage: string = 'An error occurred',
  defaultCode?: ErrorCode,
  defaultStatusCode: number = 500
): { statusCode: number; response: ApiErrorResponse } {
  // Handle ApiError instances
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      response: error.toJSON(),
    }
  }

  // Handle Error instances
  if (error instanceof Error) {
    // Check if it's an axios error
    if ((error as any).response) {
      const axiosError = error as any
      const statusCode = axiosError.response?.status || defaultStatusCode
      
      // Try to map HeyGen errors
      const mapped = mapHeyGenError(axiosError)
      
      return {
        statusCode,
        response: {
          error: mapped.message,
          code: mapped.code || defaultCode,
          details: process.env.NODE_ENV === 'development' ? {
            originalError: error.message,
            responseData: axiosError.response?.data,
          } : undefined,
          timestamp: new Date().toISOString(),
        },
      }
    }

    // Generic error
    return {
      statusCode: defaultStatusCode,
      response: {
        error: error.message || defaultMessage,
        code: defaultCode,
        timestamp: new Date().toISOString(),
      },
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      statusCode: defaultStatusCode,
      response: {
        error,
        code: defaultCode,
        timestamp: new Date().toISOString(),
      },
    }
  }

  // Unknown error type
  return {
    statusCode: defaultStatusCode,
    response: {
      error: defaultMessage,
      code: defaultCode || ErrorCode.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
    },
  }
}

/**
 * Log error with context
 */
export function logError(error: unknown, context: {
  userId?: string
  avatarId?: string
  operation?: string
  [key: string]: any
}): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  console.error(`[API Error] ${context.operation || 'Unknown operation'}:`, {
    error: errorMessage,
    stack: errorStack,
    context,
    timestamp: new Date().toISOString(),
  })
}

