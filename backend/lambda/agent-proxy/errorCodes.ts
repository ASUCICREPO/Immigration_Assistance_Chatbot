/**
 * Error Code Enumeration
 * 
 * Standardized error codes for the immigration chatbot application.
 * These codes are returned to clients instead of detailed error messages
 * to prevent information leakage.
 */

export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  BEDROCK_ERROR = 'BEDROCK_ERROR',
  DYNAMODB_ERROR = 'DYNAMODB_ERROR'
}

/**
 * User-friendly error messages for each error code.
 * These messages are safe to display to end users.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.BAD_REQUEST]: 'Invalid request. Please check your input.',
  [ErrorCode.FORBIDDEN]: 'Access denied.',
  [ErrorCode.NOT_FOUND]: 'Resource not found.',
  [ErrorCode.RATE_LIMITED]: 'Too many requests. Please try again later.',
  [ErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable. Please try again later.',
  [ErrorCode.BEDROCK_ERROR]: 'AI service error. Please try again.',
  [ErrorCode.DYNAMODB_ERROR]: 'Database error. Please try again.'
};
