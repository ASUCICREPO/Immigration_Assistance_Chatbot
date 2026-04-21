import { useState, useCallback, useMemo, useRef } from 'react';
import { streamChatbotResponse, StreamEvent } from '@/lib/streamingClient';
import { ThinkTagParser, stripThinkTags } from '@/lib/thinkTagParser';

export interface Resource {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  additional_notes: string;
}

export interface ResourcesByCategory {
  [category: string]: Resource[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  reasoning?: {
    content: string;
    isComplete: boolean;
  };
  resources?: ResourcesByCategory;
}

export interface UseStreamingChatOptions {
  // Optional location string to use for location-based searches
  // If provided, this will be used instead of geolocation
  locationOverride?: string;
}

export function useStreamingChat(options: UseStreamingChatOptions = {}) {
  const { locationOverride } = options;

  // Generate a unique session ID once when the hook is created
  // This will be fresh on each page load (not persisted across refresh)
  // Using UUID v4 format as required by backend validation
  const sessionId = useMemo(() => {
    // Prefer secure, cryptographic randomness for session identifiers
    if (typeof window !== 'undefined' && window.crypto) {
      if (typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }

      if (typeof window.crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);

        // Per RFC 4122, set the version to 4 and the variant to 10x
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        return (
          hex.slice(0, 8) + '-' +
          hex.slice(8, 12) + '-' +
          hex.slice(12, 16) + '-' +
          hex.slice(16, 20) + '-' +
          hex.slice(20)
        );
      }
    }

    // If no secure crypto is available, fail fast rather than using Math.random().
    throw new Error('Secure crypto API is not available to generate a session ID.');
  }, []);

  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const contentParserRef = useRef<ThinkTagParser>(new ThinkTagParser());
  const reasoningParserRef = useRef<ThinkTagParser>(new ThinkTagParser());

  const sendMessage = useCallback(async (userInput: string) => {
    setIsStreaming(true);
    setError(null);

    // Add user message to history
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Create initial assistant message that will be updated as we stream
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);

    contentParserRef.current.reset();
    reasoningParserRef.current.reset();
    reasoningParserRef.current.setInThinkBlock(true);

    await streamChatbotResponse(
      [{ text: userInput }],
      sessionId,
      (event: StreamEvent) => {
        if (event.type === 'text-delta') {
          const segments = contentParserRef.current.processChunk(event.delta);
          for (const segment of segments) {
            if (segment.type === 'content') {
              setMessages(prev => {
                const updated = [...prev];
                const lastIndex = updated.length - 1;
                if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                  updated[lastIndex] = {
                    ...updated[lastIndex],
                    content: updated[lastIndex].content + segment.text,
                  };
                }
                return updated;
              });
            } else {
              // Reasoning content leaked through as text-delta
              setMessages(prev => {
                const updated = [...prev];
                const lastIndex = updated.length - 1;
                if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                  const currentReasoning = updated[lastIndex].reasoning || {
                    content: '',
                    isComplete: false,
                  };
                  updated[lastIndex] = {
                    ...updated[lastIndex],
                    reasoning: {
                      ...currentReasoning,
                      content: currentReasoning.content + segment.text,
                    },
                  };
                }
                return updated;
              });
            }
          }
        } else if (event.type === 'reasoning-start') {
          // Initialize reasoning block if it doesn't exist
          setMessages(prev => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;

            if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
              updated[lastIndex] = {
                ...updated[lastIndex],
                reasoning: updated[lastIndex].reasoning || {
                  content: '',
                  isComplete: false,
                },
              };
            }

            return updated;
          });
        } else if (event.type === 'reasoning-delta') {
          const segments = reasoningParserRef.current.processChunk(event.delta);
          for (const segment of segments) {
            if (segment.type === 'reasoning') {
              setMessages(prev => {
                const updated = [...prev];
                const lastIndex = updated.length - 1;
                if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                  const currentReasoning = updated[lastIndex].reasoning || {
                    content: '',
                    isComplete: false,
                  };
                  updated[lastIndex] = {
                    ...updated[lastIndex],
                    reasoning: {
                      ...currentReasoning,
                      content: currentReasoning.content + segment.text,
                    },
                  };
                }
                return updated;
              });
            } else {
              // Response text misclassified as reasoning by backend
              setMessages(prev => {
                const updated = [...prev];
                const lastIndex = updated.length - 1;
                if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                  updated[lastIndex] = {
                    ...updated[lastIndex],
                    content: updated[lastIndex].content + segment.text,
                  };
                }
                return updated;
              });
            }
          }
        } else if (event.type === 'reasoning-end') {
          // Reasoning block ended - add separator for multiple blocks
          setMessages(prev => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;

            if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
              const currentReasoning = updated[lastIndex].reasoning;
              if (currentReasoning) {
                updated[lastIndex] = {
                  ...updated[lastIndex],
                  reasoning: {
                    ...currentReasoning,
                    // Add double newline separator for multiple blocks
                    content: currentReasoning.content + '\n\n',
                  },
                };
              }
            }

            return updated;
          });
        } else if (event.type === 'tool-output-available') {
          // Capture geo_location_search tool outputs and extract resources
          if (event.toolName === 'geo_location_search') {
            try {

              let outputData: unknown = event.output;

              // Handle different output formats
              if (typeof event.output === 'string') {
                outputData = JSON.parse(event.output);
              } else if (Array.isArray(event.output) && event.output.length > 0) {
                // If output is an array (e.g., [{"text": "..."}]), extract the text
                const textContent = event.output.find((item: unknown) =>
                  typeof item === 'object' && item !== null && 'text' in item
                );
                if (textContent && typeof textContent === 'object' && textContent !== null && 'text' in textContent) {
                  outputData = JSON.parse((textContent as { text: string }).text);
                }
              }

              const resourcesByCategory = (outputData as { resources_by_category?: ResourcesByCategory }).resources_by_category;;

              if (resourcesByCategory) {
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIndex = updated.length - 1;

                  if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      resources: resourcesByCategory,
                    };
                  }

                  return updated;
                });
              }
            } catch (e) {
              console.error('Failed to parse geo_location_search output:', e);
              console.error('Raw output was:', event.output);
            }
          }
        } else if (event.type === 'finish') {
          // Flush any remaining buffered content from parsers
          const contentRemaining = contentParserRef.current.flush();
          const reasoningRemaining = reasoningParserRef.current.flush();

          setMessages(prev => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;

            if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
              let msg = { ...updated[lastIndex] };

              for (const seg of contentRemaining) {
                if (seg.type === 'content') {
                  msg.content += seg.text;
                } else {
                  const r = msg.reasoning || { content: '', isComplete: false };
                  msg.reasoning = { ...r, content: r.content + seg.text };
                }
              }
              for (const seg of reasoningRemaining) {
                if (seg.type === 'reasoning') {
                  const r = msg.reasoning || { content: '', isComplete: false };
                  msg.reasoning = { ...r, content: r.content + seg.text };
                } else {
                  msg.content += seg.text;
                }
              }

              // Final sanitization: strip any residual think tags
              msg.content = stripThinkTags(msg.content);
              if (msg.reasoning) {
                msg.reasoning = {
                  ...msg.reasoning,
                  content: stripThinkTags(msg.reasoning.content),
                  isComplete: true,
                };
              }

              updated[lastIndex] = msg;
            }

            return updated;
          });
        }
      },
      (err: Error) => {
        setError(err);
        setIsStreaming(false);
      },
      () => {
        setIsStreaming(false);
      },
      locationOverride
    );
  }, [sessionId, locationOverride]);

  // Aggregate all resources from all messages in the session
  const allResources = useMemo(() => {
    const aggregated: ResourcesByCategory = {};

    messages.forEach(message => {
      if (message.resources) {
        // Merge resources from this message
        Object.entries(message.resources).forEach(([category, resourceList]) => {
          if (!aggregated[category]) {
            aggregated[category] = [];
          }

          // Add new resources (avoid duplicates by ID)
          const existingIds = new Set(aggregated[category].map(r => r.id));
          resourceList.forEach(resource => {
            if (!existingIds.has(resource.id)) {
              aggregated[category].push(resource);
              existingIds.add(resource.id);
            }
          });
        });
      }
    });

    return aggregated;
  }, [messages]);

  return { sendMessage, messages, isStreaming, error, sessionId, allResources };
}
