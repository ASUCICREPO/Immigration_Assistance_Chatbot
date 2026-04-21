"""
Error Handler

Provides error classification, detailed logging, and sanitized error responses.
Prevents information leakage while maintaining debuggability through CloudWatch logs.
"""

import json
import re
import traceback
from datetime import datetime
from typing import Dict, Any
from error_codes import ErrorCode, ERROR_MESSAGES


class ErrorDetails:
    """Detailed error information for internal use and logging."""
    
    def __init__(self, error_code: ErrorCode, status_code: int, 
                 internal_message: str, correlation_id: str):
        self.error_code = error_code
        self.status_code = status_code
        self.internal_message = internal_message
        self.correlation_id = correlation_id


def redact_pii(text: str) -> str:
    """
    Redact PII patterns from text.
    
    Replaces the following patterns with redaction markers:
    - Email addresses: [EMAIL_REDACTED]
    - Phone numbers: [PHONE_REDACTED]
    - SSN patterns: [SSN_REDACTED]
    - Credit card numbers: [CARD_REDACTED]
    
    Args:
        text: The text to redact
        
    Returns:
        Text with PII patterns replaced by redaction markers
    """
    if not text:
        return text
    
    redacted = text
    
    # Redact email addresses
    # Matches: user@example.com, user.name+tag@example.co.uk
    redacted = re.sub(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        '[EMAIL_REDACTED]',
        redacted
    )
    
    # Redact phone numbers (various formats)
    # Matches: 123-456-7890, (123) 456-7890, 123.456.7890, 1234567890
    redacted = re.sub(
        r'\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b',
        '[PHONE_REDACTED]',
        redacted
    )
    
    # Redact SSN patterns
    # Matches: 123-45-6789
    redacted = re.sub(
        r'\b\d{3}-\d{2}-\d{4}\b',
        '[SSN_REDACTED]',
        redacted
    )
    
    # Redact credit card numbers
    # Matches: 1234 5678 9012 3456, 1234-5678-9012-3456, 1234567890123456
    redacted = re.sub(
        r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b',
        '[CARD_REDACTED]',
        redacted
    )
    
    return redacted


def handle_error(error: Exception, correlation_id: str) -> ErrorDetails:
    """
    Classify and handle errors with detailed logging.
    
    Args:
        error: The exception to handle
        correlation_id: Unique identifier for request tracing
        
    Returns:
        ErrorDetails object with classified error information
    """
    error_message = str(error)
    error_type = type(error).__name__
    
    # Classify error by type and message content
    if error_type == 'ValidationError' or 'validation' in error_message.lower():
        error_code = ErrorCode.BAD_REQUEST
        status_code = 400
    elif 'bedrock' in error_message.lower() or 'agentcore' in error_message.lower():
        error_code = ErrorCode.BEDROCK_ERROR
        status_code = 502
    elif 'dynamodb' in error_message.lower():
        error_code = ErrorCode.DYNAMODB_ERROR
        status_code = 502
    elif 'rate limit' in error_message.lower() or 'throttl' in error_message.lower():
        error_code = ErrorCode.RATE_LIMITED
        status_code = 429
    elif 'not found' in error_message.lower() or error_type == 'NotFoundError':
        error_code = ErrorCode.NOT_FOUND
        status_code = 404
    elif 'forbidden' in error_message.lower() or error_type == 'ForbiddenError':
        error_code = ErrorCode.FORBIDDEN
        status_code = 403
    elif 'unavailable' in error_message.lower() or 'timeout' in error_message.lower():
        error_code = ErrorCode.SERVICE_UNAVAILABLE
        status_code = 503
    else:
        error_code = ErrorCode.INTERNAL_ERROR
        status_code = 500
    
    # Get stack trace
    stack_trace = ''.join(traceback.format_exception(type(error), error, error.__traceback__))
    
    # Redact PII from error message and stack trace before logging
    redacted_message = redact_pii(error_message)
    redacted_stack = redact_pii(stack_trace)
    
    # Log detailed error information to CloudWatch
    # This includes all internal details for debugging
    log_entry = {
        'correlationId': correlation_id,
        'errorCode': error_code.value,
        'errorMessage': redacted_message,
        'errorType': error_type,
        'errorStack': redacted_stack,
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'level': 'ERROR'
    }
    
    print(json.dumps(log_entry))
    
    return ErrorDetails(
        error_code=error_code,
        status_code=status_code,
        internal_message=error_message,
        correlation_id=correlation_id
    )


def format_client_error(error_details: ErrorDetails, allowed_origin: str = "*") -> Dict[str, Any]:
    """
    Format error details into a sanitized client response.
    
    This function ensures that only safe, user-friendly information
    is returned to clients. No stack traces, internal paths, or
    detailed error messages are included.
    
    Args:
        error_details: The classified error details
        allowed_origin: Value for Access-Control-Allow-Origin header
        
    Returns:
        Sanitized response dict safe for client consumption
    """
    return {
        'statusCode': error_details.status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowed_origin,
            'Access-Control-Allow-Methods': 'GET,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Amz-Security-Token,X-Api-Key,X-Amz-Content-Sha256',
        },
        'body': json.dumps({
            'errorCode': error_details.error_code.value,
            'message': ERROR_MESSAGES[error_details.error_code],
            'correlationId': error_details.correlation_id
        })
    }
