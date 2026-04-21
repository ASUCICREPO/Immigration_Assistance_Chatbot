# Immigration Assistance Chatbot Frontend

Next.js frontend for the Immigration Assistance Chatbot with multilingual support, real-time streaming, and resource export.

## Overview

Modern React application built with Next.js 14+ App Router, featuring:
- Real-time streaming chat interface
- Automatic language detection and switching
- Multilingual UI (11+ languages)
- PDF resource export
- Session-based conversations
- Responsive design with Tailwind CSS

## Architecture

### Key Components

1. **ChatInterface** (`components/ChatInterface.tsx`)
   - Main chat UI component
   - Handles message display and input
   - Manages streaming responses
   - Displays resources in carousel
   - Integrates export functionality

2. **Streaming Hook** (`hooks/useStreamingChat.ts`)
   - Custom React hook for SSE streaming
   - Manages session ID generation
   - Handles message state
   - Processes streaming events
   - Error handling and reconnection

3. **Language Context** (`contexts/LanguageContext.tsx`)
   - Global language state management
   - Language switching functionality
   - i18n integration

4. **Location Context** (`contexts/LocationContext.tsx`)
   - User location state
   - Geolocation integration
   - Location autocomplete

5. **Resource Components**
   - `ResourceCarousel.tsx` - Swipeable resource display
   - `ResourcesDisplay.tsx` - Resource list view
   - `ResourcesDrawer.tsx` - Mobile drawer for resources

## Streaming Implementation

### Session Management

Session IDs are generated per page load and follow AgentCore format:
```typescript
// Format: session_<timestamp>_<random><random>
// Example: session_1234567890_abc123def456
const sessionId = `session_${Date.now()}_${randomString()}${randomString()}`;
```

- Minimum 33 characters (AgentCore requirement)
- Stored in sessionStorage
- New session on page refresh
- Same session for all messages in conversation

### SSE Event Handling

The frontend processes these event types from the backend:

| Event Type              | Description              |
| ----------------------- | ------------------------ |
| `start`                 | Message start            |
| `text-delta`            | Incremental text chunks  |
| `tool-input-available`  | Tool calling information |
| `tool-output-available` | Tool results             |
| `resources-available`   | Resources found          |
| `finish`                | Message complete         |
| `error`                 | Error occurred           |

### Streaming Flow

```
User sends message → Generate/reuse session_id → POST to Lambda Proxy
                                                          ↓
Frontend ← SSE events ← Lambda Proxy ← AgentCore Runtime
         ↓
    Update UI in real-time
```

## Multilingual Support

### Supported Languages

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

### Translation Flow

1. User selects language in UI
2. User types message in their language
3. Frontend sends message to Lambda Proxy
4. Lambda Proxy detects language and translates to English
5. AgentCore processes in English
6. Lambda Proxy translates response back to user language
7. Frontend displays translated response

### i18n Configuration

Translation files located in `public/locales/{language}/common.json`:
```json
{
  "welcome": "Welcome",
  "chat": {
    "placeholder": "Type your message...",
    "send": "Send"
  }
}
```

## PDF Export

### Export Flow

1. User clicks "Export Resources" button
2. Frontend sends session_id to Export Lambda
3. Export Lambda retrieves resources from DynamoDB
4. Generates PDF with multilingual font
5. Returns base64-encoded PDF
6. Frontend decodes and triggers download

### Implementation

```typescript
const handleExport = async () => {
  const response = await fetch(process.env.NEXT_PUBLIC_EXPORT_RESOURCES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId })
  });
  
  const data = await response.json();
  const blob = base64ToBlob(data.pdf, 'application/pdf');
  downloadBlob(blob, 'resources.pdf');
};
```

## Environment Variables

### Production (Amplify)

Automatically set by CDK during deployment:

| Variable                               | Description                                                          |
| -------------------------------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_AGENT_PROXY_URL`          | API Gateway URL for agent proxy (WAF-protected, IAM-authorized)      |
| `NEXT_PUBLIC_EXPORT_RESOURCES_URL`     | API Gateway URL for export resources (WAF-protected, IAM-authorized) |
| `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID` | Cognito Identity Pool ID for anonymous authentication                |
| `NEXT_PUBLIC_AWS_REGION`               | AWS region for Cognito and API Gateway                               |

### Local Development

Create `.env.local` file:

```bash
# Copy example file
cp .env.local.example .env.local

# Edit with your values (for local development, use localhost)
NEXT_PUBLIC_AGENT_PROXY_URL=http://localhost:3001
NEXT_PUBLIC_EXPORT_RESOURCES_URL=http://localhost:3002
```

## Local Development

### Setup

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.local.example .env.local
# Edit .env.local with your API URLs

# Run development server
npm run dev

# Open http://localhost:3000
```

### Development Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Type check
npm run type-check
```

## Deployment

### Amplify Deployment

The application is deployed to AWS Amplify with automatic CI/CD from GitHub.

**Automated Deployment Process (Recommended):**
1. Fork the repository to your GitHub account
2. Run `deploy.sh` script from AWS CloudShell (see [Deployment Guide](../docs/DEPLOYMENT.md))
3. CodeBuild automatically:
   - Creates Amplify app
   - Connects to your GitHub repository
   - Sets environment variables
   - Triggers initial build
4. Subsequent pushes to GitHub trigger automatic builds

**Manual Build Trigger:**
1. Navigate to AWS Console → Amplify
2. Select your app
3. Click "Run build"

**Environment Variables:**
- `NEXT_PUBLIC_AGENT_PROXY_URL` - Automatically set by CDK to API Gateway URL
- `NEXT_PUBLIC_EXPORT_RESOURCES_URL` - Automatically set by CDK to API Gateway URL
- `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID` - Automatically set by CDK to Cognito Identity Pool ID
- `NEXT_PUBLIC_AWS_REGION` - Automatically set by CDK to AWS Region

### Build Configuration

Amplify uses `amplify.yml` for build configuration:
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Home page
│   ├── globals.css         # Global styles
│   ├── icon.png            # App icon
│   └── favicon.ico         # Browser favicon
├── components/
│   ├── ChatInterface.tsx   # Main chat component
│   ├── Header.tsx          # App header
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── ResourceCarousel.tsx
│   ├── ResourcesDisplay.tsx
│   ├── ResourcesDrawer.tsx
│   ├── LocationAutocomplete.tsx
│   ├── ThinkingBlock.tsx
│   └── AmplifyConfigClient.tsx
├── hooks/
│   ├── useStreamingChat.ts # Streaming chat hook
│   ├── useGeolocation.ts   # Geolocation hook
│   └── useLocationSearch.ts
├── contexts/
│   ├── LanguageContext.tsx # Language state
│   └── LocationContext.tsx # Location state
├── lib/
│   ├── streamingClient.ts  # SSE client
│   ├── exportClient.ts     # PDF export client
│   └── i18n.ts             # i18n configuration
├── data/
│   ├── us-locations-tier1.ts
│   ├── us-locations-tier2.ts
│   └── us-locations-types.ts
├── public/
│   ├── locales/            # Translation files
│   ├── logo-red-black.png
│   ├── assistant-avatar.png
│   └── *.svg               # Icons
└── package.json
```

## Key Features

### Real-time Streaming

- Server-Sent Events (SSE) for real-time updates
- Character-by-character response display
- Automatic reconnection on connection loss
- Loading states and error handling

### Session Management

- Unique session ID per page load
- Session persistence in sessionStorage
- New conversation on page refresh
- Session ID sent with every request

### Resource Display

- Carousel view for resources
- Swipeable on mobile
- Category-based organization
- Contact information display
- Export to PDF functionality

### Responsive Design

- Mobile-first approach
- Tailwind CSS for styling
- Drawer navigation on mobile
- Touch-friendly interactions
- Optimized for all screen sizes

## Troubleshooting

### Common Issues

**Issue: API calls failing**
- Verify environment variables are set correctly
- Check API Gateway endpoints are accessible
- Review browser console for CORS errors
- Ensure Lambda Proxy is deployed and configured
- Verify Cognito Identity Pool ID and AWS Region are correct

**Issue: Streaming not working**
- Check browser supports EventSource API
- Verify API Gateway streaming integration is configured correctly
- Review network tab for SSE connection
- Check for firewall/proxy blocking SSE

**Issue: Translation not working**
- Verify language is selected in UI
- Check Lambda Proxy has translation permissions
- Review backend logs for translation errors
- Ensure language code is supported

**Issue: PDF export failing**
- Verify Export Lambda URL is correct
- Check session has resources to export
- Review Export Lambda logs
- Ensure DynamoDB has data for session

**Issue: Build failing on Amplify**
- Check build logs in Amplify Console
- Verify all dependencies are in package.json
- Ensure Node.js version is compatible
- Check environment variables are set

### Debug Mode

Enable debug logging:
```typescript
// In useStreamingChat.ts
const DEBUG = true;

if (DEBUG) {
  console.log('Event received:', event);
}
```

## Performance Optimization

- Static site generation where possible
- Image optimization with Next.js Image
- Code splitting with dynamic imports
- Lazy loading for heavy components
- Caching strategies for API calls

## Security

- HTTPS only via Amplify
- IAM authorization (SigV4) on API Gateway endpoints
- Cognito Identity Pool for anonymous authentication with temporary credentials
- WAF rate limiting and IP reputation protection on API Gateway
- CORS configured on API Gateway
- No sensitive data in client-side code
- Session IDs are non-guessable
- Input sanitization for user messages

## Additional Resources

- [Deployment Guide](../docs/DEPLOYMENT.md)
- [Backend README](../backend/README.md)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [AWS Amplify Documentation](https://docs.amplify.aws/)
