export type StreamEvent =
  | { type: 'start'; messageId: string }
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'text-end'; id: string }
  | { type: 'reasoning-start'; id: string }
  | { type: 'reasoning-delta'; id: string; delta: string }
  | { type: 'reasoning-end'; id: string }
  | { type: 'tool-input-available'; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool-output-available'; toolCallId: string; toolName: string; output: unknown }
  | { type: 'finish' };

import { parseBackendError, formatErrorForDisplay } from './errorHandler';
import { signRequest } from './sigv4Signer';

export async function streamChatbotResponse(
  inputs: Array<{ text?: string; image?: unknown; document?: unknown }>,
  sessionId: string,
  onChunk: (event: StreamEvent) => void,
  onError: (error: Error) => void,
  onComplete: () => void,
  userLocation?: string
) {
  // Use CloudFront endpoint (WAF-protected, origin-verified)
  const apiUrl = process.env.NEXT_PUBLIC_AGENT_PROXY_URL;

  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_AGENT_PROXY_URL not configured');
  }

  const stripDataPrefix = (value: string) => value.replace(/^data:\s*/i, '').trim();

  const parseSsePayload = (line: string): StreamEvent | '[DONE]' => {
    let payload: unknown = stripDataPrefix(line);

    for (let attempt = 0; attempt < 5; attempt++) {
      if (typeof payload === 'string') {
        const trimmed = stripDataPrefix(payload);

        if (trimmed === '[DONE]') {
          return '[DONE]';
        }

        try {
          payload = JSON.parse(trimmed);
          continue;
        } catch (parseError) {
          console.error('Failed to parse SSE payload segment:', parseError, trimmed);
          throw parseError;
        }
      } else {
        return payload as StreamEvent;
      }
    }

    throw new Error('Unable to parse SSE payload after multiple attempts');
  };

  try {
    const requestBody = JSON.stringify({
      inputs: inputs,
      stream: true,
      session_id: sessionId,
      user_location: userLocation || null,
    });

    // Sign the request with Cognito credentials
    const { url, headers, body } = await signRequest(
      `${apiUrl}/invocations`,
      'POST',
      requestBody,
      { 'Accept': 'text/event-stream' }
    );

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      // Parse backend error and throw with user-friendly message
      const userError = await parseBackendError(response);
      const errorMessage = formatErrorForDisplay(userError);
      throw new Error(errorMessage);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        onComplete();
        break;
      }

      // Decode the raw bytes
      let chunk = decoder.decode(value, { stream: true });

      // Unwrap JSON-encoded string from Lambda (each chunk arrives as a JSON string)
      try {
        const unwrapped = JSON.parse(chunk);
        if (typeof unwrapped === 'string') {
          chunk = unwrapped;
        }
      } catch {
        // Not JSON-encoded, use as-is
      }

      buffer += chunk;
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsedEvent = parseSsePayload(line);

            if (parsedEvent === '[DONE]') {
              onComplete();
              return;
            }
            onChunk(parsedEvent);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
        else{
          console.warn('Unexpected SSE line format:', line);
        }
      }
    }
  } catch (error) {
    onError(error as Error);
  }
}
