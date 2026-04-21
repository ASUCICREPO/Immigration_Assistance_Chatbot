/**
 * Error Handler for Frontend
 * 
 * Maps backend error codes to user-friendly messages and handles error display logic.
 * This ensures users never see raw error codes or technical details.
 */

/**
 * Error codes from backend (must match backend/lambda/agent-proxy/errorCodes.ts)
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
 * These messages are displayed to end users.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.BAD_REQUEST]: 'Invalid request. Please check your input.',
  [ErrorCode.FORBIDDEN]: 'Access denied.',
  [ErrorCode.NOT_FOUND]: 'Resource not found.',
  [ErrorCode.RATE_LIMITED]: 'You are sending requests too quickly. Please wait a moment and try again.',
  [ErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable. Please try again later.',
  [ErrorCode.BEDROCK_ERROR]: 'AI service error. Please try again.',
  [ErrorCode.DYNAMODB_ERROR]: 'Database error. Please try again.'
};

/**
 * Backend error response structure
 */
export interface BackendErrorResponse {
  errorCode: ErrorCode;
  message: string;
  correlationId?: string;
}

/**
 * User-facing error information
 */
export interface UserError {
  message: string;
  correlationId?: string;
  canRetry: boolean;
}

/**
 * Maps a backend error code to a user-friendly error message.
 * 
 * @param errorCode - The error code from the backend
 * @returns User-friendly error message
 */
export function getErrorMessage(errorCode: ErrorCode): string {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR];
}

/**
 * Parses a backend error response and returns user-facing error information.
 * 
 * @param response - The fetch Response object
 * @returns Promise resolving to UserError with message and correlation ID
 */
export async function parseBackendError(response: Response): Promise<UserError> {
  // Handle rate limiting
  if (response.status === 429) {
    return {
      message: ERROR_MESSAGES[ErrorCode.RATE_LIMITED],
      canRetry: true
    };
  }

  // Try to parse JSON error response
  try {
    const errorData: BackendErrorResponse = await response.json();
    
    // Check if error code is valid
    if (errorData.errorCode && errorData.errorCode in ERROR_MESSAGES) {
      return {
        message: getErrorMessage(errorData.errorCode),
        correlationId: errorData.correlationId,
        canRetry: isRetryableError(errorData.errorCode)
      };
    }

    // If backend provided a message, use it
    if (errorData.message) {
      return {
        message: errorData.message,
        correlationId: errorData.correlationId,
        canRetry: true
      };
    }
  } catch (parseError) {
    // JSON parsing failed, fall through to generic error
  }

  // Generic error based on status code
  if (response.status >= 500) {
    return {
      message: ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR],
      canRetry: true
    };
  } else if (response.status === 403) {
    return {
      message: ERROR_MESSAGES[ErrorCode.FORBIDDEN],
      canRetry: false
    };
  } else if (response.status === 404) {
    return {
      message: ERROR_MESSAGES[ErrorCode.NOT_FOUND],
      canRetry: false
    };
  } else {
    return {
      message: ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR],
      canRetry: true
    };
  }
}

/**
 * Determines if an error is retryable based on the error code.
 * 
 * @param errorCode - The error code
 * @returns true if the error is retryable, false otherwise
 */
export function isRetryableError(errorCode: ErrorCode): boolean {
  const retryableErrors = [
    ErrorCode.RATE_LIMITED,
    ErrorCode.SERVICE_UNAVAILABLE,
    ErrorCode.BEDROCK_ERROR,
    ErrorCode.DYNAMODB_ERROR,
    ErrorCode.INTERNAL_ERROR
  ];
  
  return retryableErrors.includes(errorCode);
}

/**
 * Formats an error message for display to the user.
 * Includes correlation ID if available for support purposes.
 * 
 * @param userError - The user error object
 * @returns Formatted error message string
 */
export function formatErrorForDisplay(userError: UserError): string {
  let message = userError.message;
  
  if (userError.correlationId) {
    message += ` (Reference ID: ${userError.correlationId})`;
  }
  
  return message;
}

/**
 * Handles a fetch error and returns a user-friendly error message.
 * This is the main entry point for error handling in the frontend.
 * 
 * @param error - The error object (Error or Response)
 * @returns Promise resolving to formatted error message
 */
export async function handleFetchError(error: Error | Response): Promise<string> {
  // If it's a Response object, parse the backend error
  if (error instanceof Response) {
    const userError = await parseBackendError(error);
    return formatErrorForDisplay(userError);
  }
  
  // If it's an Error object, use the message directly
  // (these are typically network errors or client-side errors)
  return error.message || ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR];
}
