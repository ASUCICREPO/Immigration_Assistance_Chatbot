# Immigration Assistance Chatbot Architecture

Comprehensive technical architecture documentation for the Immigration Assistance Chatbot.

## Table of Contents

- [System Overview](#system-overview)
- [Component Architecture](#component-architecture)
- [Data Flows](#data-flows)
- [Translation Architecture](#translation-architecture)
- [Memory Architecture](#memory-architecture)
- [Streaming Architecture](#streaming-architecture)
- [Security Architecture](#security-architecture)
- [Resource Export System](#resource-export-system)
- [Technology Decisions](#technology-decisions)

## System Overview

![Architecture Diagram](assets/ARCHITECTURE%20DIAGRAM.svg)

The Immigration Assistance Chatbot is a multilingual AI-powered assistant that helps immigrants and refugees find local resources and services. The system is built on AWS using a serverless architecture with the following key characteristics:

- **Multilingual Support**: Supports 11+ languages with automatic translation
- **Real-time Streaming**: Server-Sent Events (SSE) for responsive chat experience
- **Scalable**: Serverless architecture scales automatically with demand
- **Conversation Memory**: Built-in conversation summarization for context preservation
- **Resource Export**: PDF generation with multilingual font support

## Component Architecture

### Frontend Layer

**Technology**: Next.js 14+ with App Router, React, TypeScript, Tailwind CSS

**Deployment**: AWS Amplify with automatic CI/CD from GitHub

**Key Responsibilities**:
- Render chat interface
- Handle user input and language selection
- Manage SSE connections for streaming
- Display resources in carousel/list view
- Trigger PDF exports
- Maintain session state

**Key Components**:
- `ChatInterface`: Main chat UI
- `useStreamingChat`: Custom hook for SSE streaming
- `LanguageContext`: Global language state
- `ResourceCarousel`: Resource display
- `LocationAutocomplete`: Location input

**Environment Variables**:
- `NEXT_PUBLIC_AGENT_PROXY_URL`: API Gateway URL for agent proxy (WAF-protected, IAM-authorized)
- `NEXT_PUBLIC_EXPORT_RESOURCES_URL`: API Gateway URL for export resources (WAF-protected, IAM-authorized)
- `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID`: Cognito Identity Pool ID for anonymous authentication
- `NEXT_PUBLIC_AWS_REGION`: AWS region for Cognito and API Gateway

### API Layer (Lambda Proxy)

**Technology**: Node.js 22, TypeScript, AWS SDK v3

**Deployment**: AWS Lambda invoked via API Gateway REST API (streaming enabled via `ResponseTransferMode: STREAM`)

**Key Responsibilities**:
- Language detection using AWS Comprehend
- Translation using AWS Translate (bidirectional)
- Request routing to AgentCore runtime
- SSE event translation during streaming
- Resource storage in DynamoDB
- Error handling and logging

**Configuration**:
- Memory: 1024 MB
- Timeout: 300 seconds (5 minutes)
- Architecture: ARM64
- Streaming: Enabled

### Agent Layer (AgentCore Runtime)

**Technology**: Python 3.12, Strands Agents SDK, AWS Bedrock AgentCore

**Deployment**: Docker container on AWS Bedrock AgentCore

**Key Responsibilities**:
- Process user requests in English
- Use tools to fetch information
- Maintain conversation memory
- Generate responses
- Store resources for export

**Tools Available**:
1. **Web Search**: Search the internet for information
2. **Geo Location Search**: Find local resources by location

**Configuration**:
- Platform: ARM64
- Network: PUBLIC
- Health Check: Port 8000
- Main Port: 8080

### Data Layer

**DynamoDB Table**:
- **Purpose**: Store translated resources for PDF export
- **Keys**: `session_id` (partition key), `resource_id` (sort key)
- **TTL**: 24 hours (automatic cleanup)
- **Item Attributes**: `session_id`, `resource_id`, `category`, `resource`, `user_language`, `created_at`, `ttl`
- **Note**: Resources are stored as individual items per resource. The `resources_by_category` structure is reconstructed at read time by the DynamoDB service.

**S3 Bucket**:
- **Purpose**: Store multilingual fonts for PDF generation
- **Contents**: `GoNotoKurrent-Regular.ttf`
- **Access**: Export Lambda has read permissions

**Conversation Manager**:
- **Purpose**: Maintain conversation context within sessions
- **Type**: Strands SDK SummarizingConversationManager
- **Features**: Automatic summarization of older messages, preservation of recent exchanges
- **Scope**: Per-session (not persisted across sessions)

### Export Layer (Export Lambda)

**Technology**: Python 3.12, ReportLab, AWS SDK

**Deployment**: AWS Lambda invoked via API Gateway REST API (binary media type `application/pdf` enabled)

**Key Responsibilities**:
- Retrieve resources from DynamoDB by session_id
- Generate PDF with multilingual font
- Return base64-encoded PDF
- Handle errors gracefully

**PDF Generation Flow**:
```
1. Receive session_id from frontend
2. Query DynamoDB for resources
3. Load GoNotoKurrent font from S3
4. Generate PDF with ReportLab
   - Title page
   - Resources by category
   - Contact information
5. Encode PDF as base64
6. Return JSON response
```

**Configuration**:
- Memory: 1024 MB
- Timeout: 30 seconds
- Architecture: ARM64

## Data Flows

### Request Flow

Complete flow from user input to agent response:

```
1. User types message in Spanish
   ↓
2. Frontend sends to Lambda Proxy
   - POST /
   - Body: { inputs: [{ text: "Necesito ayuda" }], session_id: "...", stream: true }
   ↓
3. Lambda Proxy detects language
   - AWS Comprehend: "es" (Spanish)
   ↓
4. Lambda Proxy translates to English
   - AWS Translate: "I need help"
   ↓
5. Lambda Proxy invokes AgentCore
   - POST to AgentCore runtime
   - Body: { inputs: [{ text: "I need help" }], session_id: "...", stream: true }
   ↓
6. AgentCore processes request
   - Strands agent analyzes intent
   - May call tools (geo_location_search, web_search)
   - Generates response in English
   ↓
7. AgentCore streams SSE events
   - start, text-delta, tool-input-available, tool-output-available, finish
   ↓
8. Lambda Proxy translates events
   - Translates text-delta events to Spanish
   - Stores resources in DynamoDB
   - Forwards events to frontend
   ↓
9. Frontend displays response
   - Updates UI character by character
   - Shows resources in carousel
   - Enables export button
```

### Translation Flow

Bidirectional translation between user language and English:

```
User Language → English (Request)
──────────────────────────────────

1. User message in target language
   ↓
2. Detect language (AWS Comprehend)
   - Input: "Necesito ayuda"
   - Output: { LanguageCode: "es", Score: 0.99 }
   ↓
3. Translate to English (AWS Translate)
   - SourceLanguageCode: "es"
   - TargetLanguageCode: "en"
   - Text: "Necesito ayuda"
   - Output: "I need help"
   ↓
4. Send to AgentCore in English


English → User Language (Response)
──────────────────────────────────

1. AgentCore responds in English
   ↓
2. Lambda Proxy receives SSE events
   - Event: text-delta
   - Data: { delta: "I can help you find..." }
   ↓
3. Translate delta to user language (AWS Translate)
   - SourceLanguageCode: "en"
   - TargetLanguageCode: "es"
   - Text: "I can help you find..."
   - Output: "Puedo ayudarte a encontrar..."
   ↓
4. Forward translated event to frontend
   - Event: text-delta
   - Data: { delta: "Puedo ayudarte a encontrar..." }
```

### Resource Storage Flow

How resources are stored for PDF export:

```
1. AgentCore calls geo_location_search tool
   - Returns JSON with resources_by_category
   ↓
2. AgentCore emits tool-output-available event
   - Contains resources data
   ↓
3. Lambda Proxy receives event
   ↓
4. Lambda Proxy stores in DynamoDB
   - Table: immigration-chatbot-export-resources
   - One item per resource:
     Item: {
       session_id: "session_123...",
       resource_id: "resource_abc...",
       category: "Medical",
       resource: { ... },
       user_language: "es",
       created_at: 1234567890,
       ttl: 1234567890 + 86400  // 24 hours
     }
   ↓
5. Lambda Proxy forwards event to frontend
   ↓
6. Frontend displays resources
   - Enables "Export Resources" button
```

### PDF Export Flow

How PDF export works:

```
1. User clicks "Export Resources" button
   ↓
2. Frontend sends request to Export Lambda via API Gateway
   - GET to API Gateway endpoint
   - Path: /export-resources/{session_id}
   - Request signed with SigV4 using Cognito temporary credentials
   ↓
3. Export Lambda queries DynamoDB
   - Query by session_id (partition key)
   - Retrieves all resource items and reconstructs resources_by_category structure
   - Gets user_language from item metadata
   ↓
4. Export Lambda loads font from S3
   - GetObject: GoNotoKurrent-Regular.ttf
   - Registers font with ReportLab
   ↓
5. Export Lambda generates PDF
   - Title page with logo
   - Resources organized by category
   - Contact information for each resource
   - Multilingual text rendering
   ↓
6. Export Lambda encodes PDF
   - Base64 encoding
   ↓
7. Export Lambda returns response
   - Returns API Gateway proxy response with base64-encoded PDF body
   - Headers: Content-Type: application/pdf, Content-Disposition: attachment
   - isBase64Encoded: true
   - API Gateway handles binary media type conversion
   ↓
8. Frontend receives PDF as binary blob
   - Converts to Blob object
   - Triggers browser download
```

## Translation Architecture

### Language Detection

**Service**: AWS Comprehend

**Process**:
1. Receive user message
2. Call `detectDominantLanguage` API
3. Get language code and confidence score
4. Use language code for translation

**Supported Languages**:
- English (en)
- Spanish (es)
- French (fr)
- Arabic (ar)
- Dari/Persian (fa-AF)
- Pashto (ps)
- Haitian Creole (ht)
- Portuguese (pt)
- Swahili (sw)
- Ukrainian (uk)
- Hindi (hi)

### Translation Service

**Service**: AWS Translate

**Features**:
- Real-time translation during conversations
- High accuracy for all supported languages
- Bidirectional translation (user language ↔ English)
- Preserves formatting and context

### SSE Event Translation

During streaming responses, text is translated in real-time as it's generated. Each small chunk of text (called a "delta") is translated immediately and sent to the frontend, creating a smooth multilingual streaming experience.

### Translation Caching

Resources are translated once and stored in DynamoDB to avoid re-translating the same content. This reduces translation API costs and improves response time for PDF exports.

## Conversation Memory Architecture

### Strands SDK Summarizing Conversation Manager

**Purpose**: Maintain conversation context efficiently within a single session

**Implementation**: Uses Strands SDK's built-in `SummarizingConversationManager`

**How It Works**:
- Automatically summarizes older portions of the conversation when context grows large
- Preserves recent messages in full detail for precise reference
- Balances context preservation with token efficiency
- No external storage required - all context managed in-memory

**Configuration**:
- **Summary Ratio**: 30% - When conversation history reaches a threshold, 30% of older messages are condensed into a summary
- **Preserve Recent Messages**: 10 - The last 10 messages are always kept in their original form

**Benefits**:
1. **Simplicity**: No external memory resource setup required
2. **Privacy**: Conversation context not persisted outside the session
3. **Performance**: In-memory context management for fast access
4. **Cost**: No additional AWS services or API calls needed

### Session Management

**Session ID Format**: Each conversation session has a unique identifier generated when the page loads and stored in the browser's session storage.

**Session Scope**: Conversation context is maintained only within the current session. When the session ends (browser closed, page refreshed with new session), context is reset.

**Actor ID**: Derived from the session ID for tracking purposes.

### Migration Note

This implementation replaces the previous AWS Bedrock AgentCore Memory system. The new approach:
- Eliminates the need for external memory resources
- Simplifies deployment (no memory setup steps)
- Reduces IAM permission requirements
- Still maintains effective conversation context through intelligent summarization

## Streaming Architecture

### Server-Sent Events (SSE)

**Protocol**: SSE over HTTPS

**Connection**:
- Frontend opens EventSource connection
- Lambda Proxy streams events
- Connection stays open until message complete

**Event Types**:

| Event Type              | Description            | Example Data                                |
| ----------------------- | ---------------------- | ------------------------------------------- |
| `start`                 | Message start          | `{ message_id: "msg_123" }`                 |
| `text-delta`            | Incremental text chunk | `{ delta: "Hello" }`                        |
| `tool-input-available`  | Tool being called      | `{ tool_name: "geo_location_search", ... }` |
| `tool-output-available` | Tool result            | `{ tool_name: "...", output: {...} }`       |
| `resources-available`   | Resources found        | `{ resources: [...] }`                      |
| `finish`                | Message complete       | `{ finish_reason: "stop" }`                 |
| `error`                 | Error occurred         | `{ error: "..." }`                          |

### Lambda Streaming via API Gateway

**Configuration**:
- API Gateway REST API with `ResponseTransferMode: STREAM` on the Lambda integration
- Lambda proxy integration (`AWS_PROXY`) with streaming invocations URI
- Content type set to Server-Sent Events
- Connection stays open until message is complete
- API Gateway timeout: 29 seconds (stream duration can extend beyond this)
- No caching to ensure fresh data

### Error Handling

**Connection Loss**: If the connection drops, the frontend automatically reconnects using the same session ID, allowing the conversation to continue seamlessly.

**Timeout**: Both Lambda and frontend have 5-minute timeouts. If exceeded, an error event is sent to the user.

**Partial Responses**: Text that was already received is displayed even if the connection drops, and users can retry to continue the conversation.

## Security Architecture

### Authentication and Authorization

**Cognito Identity Pool**: Provides anonymous authentication for frontend users. Users receive temporary AWS credentials via Cognito Identity Pool, which are used to sign API Gateway requests with SigV4.

**API Gateway IAM Authorization**: All API Gateway endpoints require IAM authorization. The frontend signs requests using SigV4 with temporary credentials from Cognito Identity Pool.

**Flow**:
1. Frontend obtains temporary AWS credentials from Cognito Identity Pool (unauthenticated access)
2. Frontend signs API Gateway requests with SigV4 using these credentials
3. API Gateway validates the SigV4 signature and checks IAM permissions
4. Unauthenticated role grants `execute-api:Invoke` on specific API Gateway resources only

### WAF Protection

**AWS WAF Web ACL**: Attached to the API Gateway stage (REGIONAL scope) with the following rules:
- **AWS Managed IP Reputation List**: Blocks requests from known malicious IPs
- **Blanket Rate Limit**: 2,000 requests per 5 minutes per IP
- **Export Rate Limit**: 100 requests per 5 minutes per IP for `/export-resources` endpoint

### CloudWatch Alarms and SNS Alerts

**SNS Topic**: `immigration-chatbot-security-alerts` for security notifications.

**Alarms**:
- Blanket rate limit blocks exceed 100 in 5 minutes
- Export endpoint rate limit blocks exceed 50 in 5 minutes

### IAM Roles and Permissions

**Lambda Proxy Execution Role**: Has permissions to invoke AgentCore runtime, use translation and language detection services, write to DynamoDB for resource storage, and create CloudWatch logs.

**AgentCore Runtime Execution Role**: Has permissions to invoke AI models, manage memory operations, read/write to DynamoDB for resources, and pull Docker images from ECR.

**Export Lambda Execution Role**: Has permissions to read from DynamoDB to retrieve resources and read from S3 to access font files for PDF generation.

**Unauthenticated Cognito Role**: Has permissions to invoke specific API Gateway endpoints only (`POST /invocations` and `GET /export-resources/*`).

### CORS Configuration

**API Gateway**: CORS is configured on the API Gateway REST API to accept requests from the Amplify frontend domain and `http://localhost:3000` (for development).

**Amplify**: Uses HTTPS only with automatic SSL certificates and supports custom domains.

### Data Security

**In Transit**: All data is encrypted using HTTPS with TLS 1.2 or higher. Certificate pinning ensures secure connections.

**At Rest**: DynamoDB tables and S3 buckets use encryption at rest to protect stored data.

**Session Security**: Session IDs are non-guessable random strings with no personally identifiable information. All stored data automatically expires after 24 hours.

## Resource Export System

### DynamoDB Storage

**Table Schema**: The table stores resources organized by category, along with the user's language preference, timestamp, and automatic expiration time. The session ID is used as the primary key for quick lookups.

**TTL Configuration**: Data automatically expires and is deleted after 24 hours using DynamoDB's built-in Time-To-Live feature, ensuring no stale data accumulates.

### PDF Generation

**Library**: ReportLab

**Font**: GoNotoKurrent-Regular.ttf
- Supports Latin, Cyrillic, Arabic, Devanagari scripts
- Covers all supported languages
- Stored in S3 for Lambda access

**PDF Structure**:
1. **Title Page**
   - Organization logo
   - Title: "Immigration Resources"
   - Generation date
   - Session ID

2. **Resources by Category**
   - Category heading
   - Resource cards with:
     - Name
     - Address
     - Phone
     - Website
     - Additional notes

3. **Footer**
   - Page numbers
   - Disclaimer text

**Multilingual Support**:
- Font supports all character sets
- Right-to-left text for Arabic
- Proper line breaking for all languages

### API Gateway Integration

**Configuration**: The Export Lambda is invoked via API Gateway REST API with a `GET /export-resources/{sessionId}` endpoint. IAM authorization (SigV4) is required. API Gateway is configured with `application/pdf` as a binary media type, enabling it to return the PDF as a binary response to the frontend.

**Response Format**: The Lambda returns an API Gateway proxy response with the base64-encoded PDF body, `Content-Type: application/pdf` header, and `isBase64Encoded: true`. API Gateway converts this to a binary PDF response that the frontend receives as a blob and triggers a browser download.

## Additional Resources

- [Deployment Guide](DEPLOYMENT.md)
- [Backend README](../backend/README.md)
- [Frontend README](../frontend/README.md)
- [Geo Location Upgrade Guide](GEO_LOCATION_UPGRADE.md)
- [AWS Bedrock AgentCore Documentation](https://docs.aws.amazon.com/bedrock-agentcore/)
- [Strands Agents Documentation](https://strandsagents.com/)
- [AWS Lambda Streaming Documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html)

## Summary

The Immigration Assistance Chatbot architecture is designed for:

- **Scalability**: Serverless components scale automatically
- **Reliability**: Managed services with high availability
- **Performance**: Streaming responses, ARM64 architecture
- **Maintainability**: Clear separation of concerns, modular design
- **Cost-Effectiveness**: Pay-per-use pricing, efficient resource usage
- **Security**: IAM roles, encryption, HTTPS everywhere
- **Multilingual**: Automatic translation, multilingual PDF support

The system successfully combines modern AI capabilities with practical infrastructure to deliver a responsive, multilingual chatbot for immigration assistance.
