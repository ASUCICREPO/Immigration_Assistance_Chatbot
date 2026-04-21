/**
 * Error Handler
 * 
 * Provides error classification, detailed logging, and sanitized error responses.
 * Prevents information leakage while maintaining debuggability through CloudWatch logs.
 */

import { ErrorCode, ERROR_MESSAGES } from './errorCodes.js';

/**
 * Detailed error information for internal use and logging
 */
export interface ErrorDetails {
  errorCode: ErrorCode;
  statusCode: number;
  internalMessage: string;
  correlationId: string;
}

/**
 * Classify and handle errors with detailed logging
 * 
 * @param error - The error object to handle
 * @param correlationId - Unique identifier for request tracing
 * @returns ErrorDetails object with classified error information
 */
export function handleError(error: Error, correlationId: string): ErrorDetails {
  let errorCode: ErrorCode;
  let statusCode: number;
  
  // Classify error by type and message content
  if (error.name === 'ValidationError') {
    errorCode = ErrorCode.BAD_REQUEST;
    statusCode = 400;
  } else if (error.message.includes('Bedrock') || error.message.includes('AgentCore')) {
    errorCode = ErrorCode.BEDROCK_ERROR;
    statusCode = 502;
  } else if (error.message.includes('DynamoDB') || error.message.includes('dynamodb')) {
    errorCode = ErrorCode.DYNAMODB_ERROR;
    statusCode = 502;
  } else if (error.message.includes('rate limit') || error.message.includes('throttl')) {
    errorCode = ErrorCode.RATE_LIMITED;
    statusCode = 429;
  } else if (error.message.includes('not found') || error.message.includes('NotFound')) {
    errorCode = ErrorCode.NOT_FOUND;
    statusCode = 404;
  } else if (error.message.includes('forbidden') || error.message.includes('Forbidden')) {
    errorCode = ErrorCode.FORBIDDEN;
    statusCode = 403;
  } else if (error.message.includes('unavailable') || error.message.includes('timeout')) {
    errorCode = ErrorCode.SERVICE_UNAVAILABLE;
    statusCode = 503;
  } else {
    errorCode = ErrorCode.INTERNAL_ERROR;
    statusCode = 500;
  }
  
  // Log detailed error information to CloudWatch
  // This includes all internal details for debugging
  console.error(JSON.stringify({
    correlationId,
    errorCode,
    errorMessage: error.message,
    errorName: error.name,
    errorStack: error.stack,
    timestamp: new Date().toISOString(),
    level: 'ERROR'
  }));
  
  return {
    errorCode,
    statusCode,
    internalMessage: error.message,
    correlationId
  };
}

/**
 * Format error details into a sanitized client response
 * 
 * This function ensures that only safe, user-friendly information
 * is returned to clients. No stack traces, internal paths, or
 * detailed error messages are included.
 * 
 * @param errorDetails - The classified error details
 * @returns Sanitized response object safe for client consumption
 */
export function formatClientError(errorDetails: ErrorDetails) {
  return {
    statusCode: errorDetails.statusCode,
    body: JSON.stringify({
      errorCode: errorDetails.errorCode,
      message: ERROR_MESSAGES[errorDetails.errorCode],
      correlationId: errorDetails.correlationId
    })
  };
}
