/**
 * PII Redaction Utility
 * 
 * Redacts personally identifiable information (PII) from text before logging.
 * This prevents sensitive user data from being stored in CloudWatch logs.
 */

/**
 * Redact PII patterns from text
 * 
 * Replaces the following patterns with redaction markers:
 * - Email addresses: [EMAIL_REDACTED]
 * - Phone numbers: [PHONE_REDACTED]
 * - SSN patterns: [SSN_REDACTED]
 * - Credit card numbers: [CARD_REDACTED]
 * 
 * @param text - The text to redact
 * @returns Text with PII patterns replaced by redaction markers
 */
export function redactPII(text: string): string {
  if (!text) {
    return text;
  }
  
  let redacted = text;
  
  // Redact email addresses
  // Matches: user@example.com, user.name+tag@example.co.uk
  redacted = redacted.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    '[EMAIL_REDACTED]'
  );
  
  // Redact phone numbers (various formats)
  // Matches: 123-456-7890, (123) 456-7890, 123.456.7890, 1234567890
  redacted = redacted.replace(
    /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    '[PHONE_REDACTED]'
  );
  
  // Redact SSN patterns
  // Matches: 123-45-6789
  redacted = redacted.replace(
    /\b\d{3}-\d{2}-\d{4}\b/g,
    '[SSN_REDACTED]'
  );
  
  // Redact credit card numbers
  // Matches: 1234 5678 9012 3456, 1234-5678-9012-3456, 1234567890123456
  redacted = redacted.replace(
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    '[CARD_REDACTED]'
  );
  
  return redacted;
}
