/**
 * Agent Proxy Lambda
 *
 * Handles translation and proxies requests to AWS Bedrock AgentCore runtime.
 * Uses Lambda response streaming for real-time agent interactions.
 *
 * Flow:
 * 1. Detect language from user input
 * 2. Translate to English if needed
 * 3. Invoke AgentCore runtime (processes English only)
 * 4. Translate response back to user language if needed
 * 5. Stream to frontend
 */
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import {
  TranslateClient,
  TranslateTextCommand,
} from '@aws-sdk/client-translate';
import {
  ComprehendClient,
  DetectDominantLanguageCommand,
} from '@aws-sdk/client-comprehend';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { handleError, formatClientError } from './errorHandler.js';
import { ErrorCode } from './errorCodes.js';
import { redactPII } from './piiRedactor.js';
const AGENT_RUNTIME_ARN = process.env.AGENT_RUNTIME_ARN || '';
const AGENT_QUALIFIER = process.env.AGENT_QUALIFIER || 'DEFAULT';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const RESOURCES_TABLE_NAME = process.env.RESOURCES_TABLE_NAME || 'immigration-chatbot-export-resources';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// Extract account ID from ARN (format: arn:aws:bedrock-agentcore:region:account-id:...)
function extractAccountId(arn: string): string {
  const parts = arn.split(':');
  return parts.length >= 5 ? parts[4] : '';
}

const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID || extractAccountId(AGENT_RUNTIME_ARN);

// Initialize AWS clients
const agentCoreClient = new BedrockAgentCoreClient({ region: AWS_REGION });
const translateClient = new TranslateClient({ region: AWS_REGION });
const comprehendClient = new ComprehendClient({ region: AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface InvocationRequest {
  inputs: Array<{ text?: string; image?: unknown; document?: unknown }>;
  stream: boolean;
  session_id: string;
  actor_id?: string;
  user_location?: string;
  user_language?: string;
}

interface APIGatewayEvent {
  body?: string;
  headers?: Record<string, string>;
  requestContext?: {
    http?: {
      method: string;
    };
  };
  httpMethod?: string;
}

// Type for Lambda streaming response
declare const awslambda: {
  streamifyResponse: (
    handler: (
      event: APIGatewayEvent,
      responseStream: NodeJS.WritableStream & {
        setContentType?: (type: string) => void;
      },
      context: unknown
    ) => Promise<void>
  ) => (event: APIGatewayEvent, context: unknown) => Promise<void>;
  HttpResponseStream: {
    from: (
      stream: NodeJS.WritableStream,
      metadata: {
        statusCode: number;
        headers: Record<string, string>;
      }
    ) => NodeJS.WritableStream;
  };
};


/**
 * Detect language from text using AWS Comprehend
 */
async function detectLanguage(text: string): Promise<string> {
  try {
    // Truncate to 100 bytes for efficient detection
    const truncated = Buffer.from(text).slice(0, 100).toString();
    
    const command = new DetectDominantLanguageCommand({
      Text: truncated,
    });
    
    const response = await comprehendClient.send(command);
    
    if (response.Languages && response.Languages.length > 0) {
      const dominant = response.Languages[0];
      if (dominant.Score && dominant.Score >= 0.7 && dominant.LanguageCode) {
        console.log(redactPII(`Detected language: ${dominant.LanguageCode} (confidence: ${dominant.Score})`));
        return dominant.LanguageCode;
      }
    }
  } catch (error) {
    console.error(redactPII('Language detection failed:'), error);
  }
  
  // Default to English
  return 'en';
}

/**
 * Translate text using AWS Translate
 */
async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  try {
    const command = new TranslateTextCommand({
      Text: text,
      SourceLanguageCode: sourceLanguage,
      TargetLanguageCode: targetLanguage,
    });
    
    const response = await translateClient.send(command);
    return response.TranslatedText || text;
  } catch (error) {
    console.error(redactPII(`Translation failed (${sourceLanguage} -> ${targetLanguage}):`), error);
    return text; // Return original on failure
  }
}

/**
 * Store translated resources to DynamoDB
 */
async function storeResourcesToDynamoDB(
  sessionId: string,
  resourcesByCategory: Record<string, any[]>,
  userLanguage: string
): Promise<void> {
  const currentTime = Math.floor(Date.now() / 1000);
  const ttlTimestamp = currentTime + (24 * 3600); // 24-hour TTL

  for (const [category, resources] of Object.entries(resourcesByCategory)) {
    for (const resource of resources) {
      if (!resource.id) continue;

      try {
        await docClient.send(new PutCommand({
          TableName: RESOURCES_TABLE_NAME,
          Item: {
            session_id: sessionId,
            resource_id: resource.id,
            category: category,
            resource: resource,
            user_language: userLanguage,
            created_at: currentTime,
            ttl: ttlTimestamp
          }
        }));
      } catch (error) {
        console.error(redactPII(`Failed to store resource ${resource.id}:`), error);
      }
    }
  }
  console.log(redactPII(`Stored resources for session ${sessionId} (language: ${userLanguage})`));
}

/**
 * Extract complete SSE events from a buffer
 * Returns complete events and any remaining incomplete data
 */
function extractCompleteSSEEvents(buffer: string): {
  completeEvents: string[];
  remaining: string;
} {
  const events: string[] = [];
  const parts = buffer.split('\n\n');

  // All parts except last are complete events
  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i].trim()) {
      events.push(parts[i] + '\n\n');
    }
  }

  // Last part may be incomplete
  return {
    completeEvents: events,
    remaining: parts[parts.length - 1],
  };
}

/**
 * Process SSE event: translate if needed AND store resources to DynamoDB
 * Resources are stored for ALL languages (English and non-English)
 */
async function translateSSEEvent(
  eventData: string,
  targetLanguage: string,
  sessionId: string
): Promise<string> {
  // Skip non-data events
  if (!eventData.startsWith('data: ')) {
    return eventData;
  }

  // Skip [DONE] marker - it's not JSON and doesn't need processing
  if (eventData.includes('[DONE]')) {
    return eventData;
  }

  try {
    // Remove "data: " prefix and trailing whitespace/delimiters
    let jsonStr = eventData.replace(/^data:\s*/i, '').trim();

    // Handle double-encoded JSON from AgentCore (string wrapped in quotes with escaped inner quotes)
    // If the string starts with a quote, it's JSON-encoded - parse once to get the raw string
    if (jsonStr.startsWith('"')) {
      try {
        jsonStr = JSON.parse(jsonStr);
      } catch {
        // Not valid JSON string encoding, continue with original
      }
    }

    // Extract only the JSON object portion (from first { to matching })
    // This removes any trailing \n\n or other SSE delimiters
    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonStr = jsonStr.substring(startIdx, endIdx + 1).trim();
    }

    const parsed = JSON.parse(jsonStr);
    let modified = false;

    // Handle geo_location_search - ALWAYS store to DynamoDB regardless of language
    if (parsed.type === 'tool-output-available' && parsed.toolName === 'geo_location_search' && Array.isArray(parsed.output)) {
      console.log(redactPII(`Processing geo_location_search output for session ${sessionId}, language: ${targetLanguage}`));

      for (let i = 0; i < parsed.output.length; i++) {
        const outputItem = parsed.output[i];
        if (outputItem.text) {
          try {
            const resourceData = JSON.parse(outputItem.text);
            if (resourceData.resources_by_category) {
              // Translate resource fields only if not English
              if (targetLanguage !== 'en') {
                for (const category of Object.keys(resourceData.resources_by_category)) {
                  const resources = resourceData.resources_by_category[category];
                  if (Array.isArray(resources)) {
                    for (const resource of resources) {
                      if (resource.name) {
                        resource.name = await translateText(resource.name, 'en', targetLanguage);
                      }
                      if (resource.additional_notes) {
                        resource.additional_notes = await translateText(resource.additional_notes, 'en', targetLanguage);
                      }
                    }
                  }
                }
                // Update the text with translated resources
                parsed.output[i].text = JSON.stringify(resourceData, null, 2);
                modified = true;
              }

              // ALWAYS store resources to DynamoDB (translated or not)
              console.log(redactPII(`Storing resources to DynamoDB for session ${sessionId}`));
              await storeResourcesToDynamoDB(sessionId, resourceData.resources_by_category, targetLanguage);
            }
          } catch (parseError) {
            console.error(redactPII('Failed to parse tool output text:'), parseError);
          }
        }
      }
    }

    // For English users, return original event data (no translation needed)
    if (targetLanguage === 'en') {
      return eventData;
    }

    // Translate other event types for non-English users
    if (parsed.type === 'text-delta' && parsed.delta) {
      parsed.delta = await translateText(parsed.delta, 'en', targetLanguage);
      modified = true;
    } else if (parsed.type === 'reasoning-delta' && parsed.delta) {
      parsed.delta = await translateText(parsed.delta, 'en', targetLanguage);
      modified = true;
    }

    // Return modified event or original
    return modified ? `data: ${JSON.stringify(parsed)}\n\n` : eventData;
  } catch (error) {
    console.error(redactPII('Failed to process SSE event:'), error);
    return eventData; // Return original on parse/process failure
  }
}

/**
 * Main streaming handler for agent invocations
 */
export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayEvent, responseStream, _context) => {
    // Generate correlation ID at the start of request for tracing
    const correlationId = randomUUID();
    
    // Log request start with correlation ID
    console.log(JSON.stringify({
      correlationId,
      level: 'INFO',
      message: 'Request started',
      timestamp: new Date().toISOString()
    }));
    
    try {
      // Handle CORS preflight
      const method = event.requestContext?.http?.method || event.httpMethod;
      if (method === 'OPTIONS') {
        responseStream = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Amz-Security-Token,X-Api-Key,X-Amz-Content-Sha256',
          },
        });
        responseStream.end();
        return;
      }

      let userLanguage = 'en';

      // Validate runtime ARN is configured
      if (!AGENT_RUNTIME_ARN) {
        throw new Error('Agent runtime not configured. Set AGENT_RUNTIME_ARN environment variable.');
      }

      // Validate account ID can be extracted or is provided
      if (!ACCOUNT_ID) {
        throw new Error('AWS Account ID not configured. Set AWS_ACCOUNT_ID environment variable or ensure AGENT_RUNTIME_ARN is a valid ARN.');
      }

      // Parse request body
      const body: InvocationRequest = JSON.parse(event.body || '{}');

      // Validate required fields
      if (!body.session_id) {
        const validationError = new Error('session_id is required');
        validationError.name = 'ValidationError';
        throw validationError;
      }

      // Validate session_id format (UUID v4)
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidV4Regex.test(body.session_id)) {
        const validationError = new Error('session_id must be a valid UUID v4');
        validationError.name = 'ValidationError';
        throw validationError;
      }

      // Extract text from inputs
      const textInput = body.inputs.find((i) => i.text)?.text || '';

      if (!textInput) {
        const validationError = new Error('No text input provided');
        validationError.name = 'ValidationError';
        throw validationError;
      }

      // Validate textInput length
      if (textInput.length < 1) {
        const validationError = new Error('textInput must be at least 1 character');
        validationError.name = 'ValidationError';
        throw validationError;
      }

      if (textInput.length > 5000) {
        const validationError = new Error('textInput must not exceed 5000 characters');
        validationError.name = 'ValidationError';
        throw validationError;
      }

      // Check for null bytes and control characters in textInput
      // Allow newlines (\n, \r), tabs (\t), but reject other control characters
      const hasNullBytes = textInput.includes('\0');
      const hasInvalidControlChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(textInput);
      
      if (hasNullBytes || hasInvalidControlChars) {
        const validationError = new Error('textInput contains invalid control characters');
        validationError.name = 'ValidationError';
        throw validationError;
      }

      // Validate user_location if provided
      if (body.user_location) {
        if (body.user_location.length > 200) {
          const validationError = new Error('user_location must not exceed 200 characters');
          validationError.name = 'ValidationError';
          throw validationError;
        }

        // Sanitize HTML/script tags from user_location
        const sanitizedLocation = body.user_location
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<[^>]+>/g, '');
        
        // Update the body with sanitized location
        body.user_location = sanitizedLocation;
      }

      // Detect language if not provided
      userLanguage = body.user_language || 'en';
      if (!body.user_language) {
        userLanguage = await detectLanguage(textInput);
        console.log(redactPII(`Language detected: ${userLanguage}`));
      }

      // Translate to English if needed
      let englishText = textInput;
      if (userLanguage !== 'en') {
        englishText = await translateText(textInput, userLanguage, 'en');
        console.log(redactPII(`Translated from ${userLanguage} to English`));
      }

      // Build payload for AgentCore (English only)
      const payload = {
        prompt: englishText,
        session_id: body.session_id,
        actor_id: body.actor_id,
        user_location: body.user_location,
      };

      console.log(redactPII(`Invoking AgentCore for session: ${body.session_id}`));

      // Convert payload to bytes
      const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf-8');

      // Invoke AgentCore runtime with streaming
      const command = new InvokeAgentRuntimeCommand({
        runtimeSessionId: body.session_id,
        agentRuntimeArn: AGENT_RUNTIME_ARN,
        accountId: ACCOUNT_ID,
        qualifier: AGENT_QUALIFIER,
        payload: payloadBytes,
      });

      const response = await agentCoreClient.send(command);

      // Set streaming response headers
      responseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
          'x-vercel-ai-ui-message-stream': 'v1',
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        },
      });

      // Stream response chunks (translate back if needed)
      if (response.response) {
        // Type assertion for the async iterable response
        const agentResponseStream = response.response as AsyncIterable<any>;

        // Buffer for incomplete SSE events (only used when translating)
        let sseBuffer = '';

        for await (const chunk of agentResponseStream) {
          let text = '';

          // Handle Buffer format from AgentCore SDK
          if (chunk && chunk.type === 'Buffer' && Array.isArray(chunk.data)) {
            text = Buffer.from(chunk.data).toString('utf-8');
          } else if (Buffer.isBuffer(chunk)) {
            text = chunk.toString('utf-8');
          } else if (chunk.chunk?.bytes) {
            text = Buffer.from(chunk.chunk.bytes).toString('utf-8');
          } else if (chunk.bytes) {
            text = Buffer.from(chunk.bytes).toString('utf-8');
          } else if (typeof chunk === 'string') {
            text = chunk;
          }

          if (text) {
            // Process SSE events (translate if needed, always store resources to DynamoDB)
            sseBuffer += text;
            const { completeEvents, remaining } = extractCompleteSSEEvents(sseBuffer);
            sseBuffer = remaining;

            // Process each complete event - handles translation and DynamoDB storage
            for (const event of completeEvents) {
              const processed = await translateSSEEvent(event, userLanguage, body.session_id);
              responseStream.write(processed);
            }
          }
        }

        // Flush any remaining buffer (handles edge case of stream ending mid-event)
        if (sseBuffer.trim()) {
          const processed = await translateSSEEvent(sseBuffer, userLanguage, body.session_id);
          responseStream.write(processed);
        }
      } else {
        console.log('No response stream from AgentCore');
      }

      responseStream.end();

      console.log(JSON.stringify({
        correlationId,
        level: 'INFO',
        message: `Completed streaming for session: ${body.session_id}`,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      // Handle errors with proper classification and logging
      const errorDetails = handleError(error as Error, correlationId);
      const clientError = formatClientError(errorDetails);
      
      // For streaming responses, we need to write the error to the stream
      try {
        responseStream = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: errorDetails.statusCode,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          },
        });

        responseStream.write(clientError.body);
        responseStream.end();
      } catch (streamError) {
        // If we can't write to the stream, log the error
        console.error(JSON.stringify({
          correlationId,
          level: 'ERROR',
          message: 'Failed to write error to response stream',
          error: streamError instanceof Error ? streamError.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }));
      }
    }
  }
);

/**
 * OPTIONS handler for CORS preflight requests
 * (Exported separately for API Gateway integration if needed)
 * Note: CORS is handled by Lambda URL configuration in CDK
 */
export const optionsHandler = async (_event: APIGatewayEvent) => {
  return {
    statusCode: 200,
    headers: {},
    body: '',
  };
};
