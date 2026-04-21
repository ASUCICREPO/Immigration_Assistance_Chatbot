# Immigration Assistance Chatbot

The Immigration Assistance Chatbot is a multilingual AI-powered platform that helps individuals access critical immigration resources and guidance regardless of their native language. By leveraging AI and automatic translation, the chatbot breaks down language barriers and delivers real-time assistance in 11+ languages, translating complex immigration information into clear, actionable guidance. Users can find local resources faster, receive personalized support in their own language, and navigate the immigration system with greater confidence.

## Disclaimers
**Customers are responsible for making their own independent assessment of the information in this document.**
This document:

(a) is for informational purposes only,

(b) references AWS product offerings and practices, which are subject to change without notice,

(c) does not create any commitments or assurances from AWS and its affiliates, suppliers or licensors. AWS products or services are provided “as is” without warranties, representations, or conditions of any kind, whether express or implied. The responsibilities and liabilities of AWS to its customers are controlled by AWS agreements, and this document is not part of, nor does it modify, any agreement between AWS and its customers, and

(d) is not to be considered a recommendation or viewpoint of AWS.

Additionally, you are solely responsible for testing, security and optimizing all code and assets on GitHub repo, and all such code and assets should be considered:
(a) as-is and without warranties or representations of any kind,

(b) not suitable for production environments, or on production or other critical data, and

(c) to include shortcuts in order to support rapid prototyping such as, but not limited to, relaxed authentication and authorization and a lack of strict adherence to security best practices.

**All work produced is open source. More information can be found in this GitHub repo.**

## Architecture

![Architecture Diagram](docs/assets/ARCHITECTURE%20DIAGRAM.svg)

*The Immigration Assistance Chatbot architecture uses AWS Bedrock AgentCore for agent hosting, Lambda functions for translation and export, Next.js frontend on Amplify, and DynamoDB, and S3 for data storage.*

### Architecture Components

The system consists of the following key components:

- **Frontend (Next.js on AWS Amplify):** Static site with streaming chat interface and multilingual UI
- **API Gateway:** REST API with IAM authorization, WAF protection, and streaming support
- **Lambda Proxy:** Handles bidirectional translation and proxies requests to AgentCore
- **AgentCore Runtime:** AWS Bedrock AgentCore hosting the Strands agent with conversation memory
- **Export Lambda:** Generates multilingual PDF exports of resources
- **Cognito Identity Pool:** Provides anonymous authentication for frontend users (SigV4 signing)
- **WAF:** Rate limiting and IP reputation protection on API Gateway
- **DynamoDB:** Stores translated resources with 24-hour TTL
- **S3:** Stores multilingual font files for PDF generation
- **SNS/CloudWatch:** Security alerting for rate limit violations
- **AI Models:** AWS Bedrock with Amazon Nova 2 Lite model for natural language processing

### Translation Flow

The system implements a bidirectional translation flow to enable multilingual support while keeping AgentCore processing in English.

1. User sends message in their preferred language
2. Lambda Proxy detects language using AWS Comprehend
3. Lambda Proxy translates message to English using AWS Translate (if not already in English)
4. AgentCore processes request in English
5. Lambda Proxy translates response back to user's original language
6. User receives response in their original language

## Key Features

- **Multilingual Support (11+ Languages):** Automatic language detection and translation for Arabic, English, Spanish, French, Haitian Creole, Hindi, Pashto, Dari, Portuguese, Swahili, and Ukrainian
- **Real-time Streaming Responses:** Chunked AI response streaming using Server-Sent Events (SSE) for immediate user feedback
- **Conversation Memory:** Built-in conversation summarization for context preservation using Strands SDK
- **Resource Export to PDF:** Generate multilingual PDF documents with proper font support for all languages
- **Geo Location Search:** Find local immigration resources by location (currently mock implementation, ready for API integration)
- **Production Ready:** Complete CDK infrastructure, CloudWatch monitoring, error handling, and security best practices

## ⚠️ Important: Mock Data Notice

**Before deploying to production**, you must replace the mock geo location implementation with your internal resource API:

- **Current Status**: The `geo_location_search` tool uses hardcoded mock data for 4 Arizona cities only (Tempe, Scottsdale, Chandler, Gilbert)
- **Production Requirement**: Replace with your internal resource database API integration
- **Upgrade Guide**: See **[GEO_LOCATION_UPGRADE.md](docs/GEO_LOCATION_UPGRADE.md)** for complete step-by-step instructions
- **File to Update**: `backend/agents/tools/geo_location_search.py`

The upgrade guide provides:
- Detailed integration strategy with adapter pattern
- Geocoding API setup (Google Maps, Mapbox, etc.)
- Category mapping between your API and agent expectations
- Response transformation examples
- Testing procedures and migration path
- Error handling best practices

## Quick Start

For complete deployment instructions, see **[DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

### Prerequisites

- AWS Account with administrator privileges
- GitHub Account with ability to fork repositories
- GitHub Personal Access Token (PAT) with `repo` and `admin:repo_hook` scopes

### Deployment Overview

The deployment uses AWS CloudShell and CodeBuild for automated infrastructure provisioning:

1. **Fork the Repository** to your GitHub account

2. **Create GitHub Personal Access Token** with required scopes (`repo` and `admin:repo_hook`)

3. **Login to AWS CloudShell** in your AWS Console

4. **Clone Your Forked Repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/immigration-chatbot.git
   cd immigration-chatbot
   ```

5. **Run the Deployment Script:**
   ```bash
   bash deploy.sh
   ```
   Provide: GitHub repository URL, GitHub token, and choose `deploy` action

6. **Monitor CodeBuild Deployment** (15-20 minutes) - Creates all infrastructure automatically

7. **Host AgentCore Runtime** in AWS Console using the ECR image URI from CodeBuild output

8. **Update Lambda Proxy** with the AgentCore runtime ARN environment variable

9. **Verify Amplify Deployment** - Frontend auto-deploys from GitHub

For detailed step-by-step instructions, troubleshooting, and verification steps, see **[DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Project Structure

```
.
├── backend/                    # Backend infrastructure and services
│   ├── agents/
│   │   └── agentcore/         # AgentCore application
│   │       ├── app.py         # Main agent entrypoint with Strands SDK
│   │       ├── Dockerfile     # Container image for AgentCore runtime
│   │       ├── requirements.txt
│   │       ├── services/      # Business logic services
│   │       │   ├── dynamodb_service.py  # Resource storage
│   │       │   ├── pdf_service.py       # PDF generation
│   │       │   └── font_service.py      # Font management
│   │       ├── tools/         # Agent tools
│   │       │   └── geo_location_search.py  # Location search tool
│   │       └── prompts/       # Agent prompt templates
│   ├── lambda/
│   │   ├── agent-proxy/       # Translation proxy Lambda (TypeScript)
│   │   │   ├── index.ts       # Main handler with translation logic
│   │   │   └── package.json
│   │   └── export-resources/  # PDF export Lambda (Python)
│   │       ├── handler.py     # Export handler
│   │       └── requirements.txt
│   ├── lib/                   # CDK infrastructure definitions
│   │   └── immigration-chatbot-stack.ts
│   ├── scripts/               # Deployment and setup scripts
│   │   └── setup_memory.py    # AgentCore memory setup
│   ├── cdk.json              # CDK configuration
│   └── package.json          # CDK dependencies
│
├── frontend/                  # Next.js frontend application
│   ├── app/                   # Next.js App Router pages
│   │   ├── page.tsx          # Main chat page
│   │   ├── layout.tsx        # Root layout with providers
│   │   └── globals.css       # Global styles
│   ├── components/            # React components
│   │   ├── ChatInterface.tsx # Main chat UI with streaming
│   │   ├── ResourcesDisplay.tsx  # Resource cards
│   │   ├── LocationAutocomplete.tsx  # Location search
│   │   └── Header.tsx        # App header with language selector
│   ├── hooks/                 # Custom React hooks
│   │   ├── useStreamingChat.ts   # SSE streaming logic
│   │   └── useGeolocation.ts     # Location detection
│   ├── lib/                   # Client libraries
│   │   ├── streamingClient.ts    # SSE client
│   │   ├── exportClient.ts       # PDF export client
│   │   └── i18n.ts               # i18next configuration
│   ├── contexts/              # React contexts
│   │   ├── LanguageContext.tsx   # Language state
│   │   └── LocationContext.tsx   # Location state
│   ├── public/                # Static assets
│   │   └── locales/          # Translation files (11 languages)
│   └── package.json          # Frontend dependencies
│
├── docs/                      # Documentation
│   ├── DEPLOYMENT.md         # Deployment guide
│   ├── AGENTCORE_DEPLOYMENT.md  # AgentCore guide
│   └── assets/               # Diagrams and images
│       └── ARCHITECTURE DIAGRAM.svg
│
├── fonts/                     # Multilingual fonts
│   └── GoNotoKurrent-Regular.ttf  # Unicode font for PDFs
│
├── buildspec.yml             # AWS CodeBuild specification
├── deploy.sh                 # Deployment script
└── README.md                 # This file
```

### Key Directories Explained

- **backend/agents/agentcore/** - The core AI agent application built with Strands SDK, containerized for AgentCore runtime
- **backend/lambda/** - Serverless functions for translation proxy and PDF export
- **backend/lib/** - AWS CDK infrastructure code that provisions all AWS resources
- **frontend/** - Next.js application with streaming chat, multilingual UI, and resource display
- **docs/** - Comprehensive documentation for deployment, architecture, and development
- **fonts/** - Multilingual font files uploaded to S3 for PDF generation

## Documentation

### Deployment & Operations
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Complete step-by-step deployment guide with prerequisites, configuration, and troubleshooting
- **[AGENTCORE_DEPLOYMENT.md](docs/AGENTCORE_DEPLOYMENT.md)** - AgentCore-specific deployment details and configuration

### Development Guides
- **[Backend README](backend/README.md)** - Backend architecture, CDK stack, Lambda functions, and local development
- **[Frontend README](frontend/README.md)** - Frontend architecture, components, hooks, and local development

### Architecture & Integration
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Detailed system architecture, data flows, and technology decisions
- **[GEO_LOCATION_UPGRADE.md](docs/GEO_LOCATION_UPGRADE.md)** - Guide for integrating internal API with geo location tool

## Technology Stack

### Backend
- **AWS Bedrock AgentCore** - Managed agent runtime hosting with memory integration
- **Strands Agents SDK** - Agent framework for building AI agents
- **AWS Lambda (Node.js 22 & Python 3.12)** - Serverless compute for proxy and export functions
- **AWS Translate** - Automatic language translation (11+ languages)
- **AWS Comprehend** - Language detection
- **Amazon DynamoDB** - NoSQL database for resource storage with 24-hour TTL
- **Amazon S3** - Object storage for multilingual font files
- **AWS Bedrock (Amazon Nova 2 Lite)** - Large language model for agent responses

### Frontend
- **Next.js 14+** - React framework with App Router and static site generation
- **TypeScript** - Type-safe JavaScript for improved developer experience
- **Tailwind CSS** - Utility-first CSS framework for responsive design
- **Server-Sent Events (SSE)** - Real-time streaming protocol for chat responses
- **i18next** - Internationalization framework for UI translations

### Infrastructure
- **AWS CDK (TypeScript)** - Infrastructure as Code for reproducible deployments
- **AWS Amplify** - Frontend hosting with CI/CD from GitHub
- **Amazon API Gateway** - REST API with IAM authorization, streaming support, and WAF integration
- **Amazon Cognito** - Identity Pool for anonymous user authentication
- **AWS WAF** - Web Application Firewall with rate limiting and IP reputation rules
- **Docker** - Container images for AgentCore runtime (ARM64)
- **Amazon CloudWatch** - Logging, monitoring, alarms, and observability
- **Amazon SNS** - Security alert notifications
- **AWS IAM** - Identity and access management with least privilege roles

## Development

### Run Frontend Locally

```bash
cd frontend

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your API URLs

# Install and run
npm install
npm run dev

# Open http://localhost:3000
```

## Configuration

### Environment Variables

**AgentCore Runtime:**
- `RESOURCES_TABLE_NAME` - DynamoDB table name

Note: Conversation memory is managed by Strands SDK (no external configuration needed)

**Lambda Proxy:**
- `AGENT_RUNTIME_ARN` - AgentCore runtime ARN
- `AGENT_QUALIFIER` - Agent qualifier (default: DEFAULT)

**Export Lambda:**
- `RESOURCES_TABLE_NAME` - DynamoDB table name
- `FONT_BUCKET_NAME` - S3 bucket for fonts

**Frontend:**
- `NEXT_PUBLIC_AGENT_PROXY_URL` - API Gateway URL for agent proxy (WAF-protected, IAM-authorized)
- `NEXT_PUBLIC_EXPORT_RESOURCES_URL` - API Gateway URL for export resources (WAF-protected, IAM-authorized)
- `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID` - Cognito Identity Pool ID for anonymous authentication
- `NEXT_PUBLIC_AWS_REGION` - AWS region for Cognito and API Gateway

## Monitoring

### CloudWatch Logs

```bash
# AgentCore logs
aws logs tail /aws/bedrock-agentcore/immigration-chatbot-agent --follow

# Lambda Proxy logs
aws logs tail /aws/lambda/immigration-chatbot-agent-proxy --follow

# Export Lambda logs
aws logs tail /aws/lambda/immigration-chatbot-export-resources --follow
```

## Troubleshooting

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed troubleshooting guidance.

Common issues:
- **Translation not working:** Check Lambda Proxy has Translate/Comprehend permissions
- **PDF export failing:** Check font file exists in S3 bucket
- **Streaming issues:** Verify API Gateway streaming configuration and Lambda integration

## Changelog

### v2.0 — API Gateway & Cognito Architecture

This release replaces the previous Lambda Function URL + CloudFront architecture with API Gateway, Cognito Identity Pool, and WAF.

**API Layer**
- Replaced Lambda Function URLs with Amazon API Gateway REST API
- Streaming now uses API Gateway's `ResponseTransferMode: STREAM` with Lambda proxy integration
- PDF export uses API Gateway binary media type support (`application/pdf`) instead of a separate Function URL
- Lambda runtime upgraded from Node.js 18 to Node.js 22

**Authentication & Security**
- Added Amazon Cognito Identity Pool for anonymous user authentication
- All API endpoints now require IAM authorization (SigV4 signing) instead of open Function URLs with CORS-only protection
- Added AWS WAF Web ACL (REGIONAL) attached to API Gateway with three rules: AWS Managed IP Reputation List, blanket rate limit (2,000 req/5 min), and export endpoint rate limit (100 req/5 min)
- Added SNS topic (`immigration-chatbot-security-alerts`) and CloudWatch Alarms for rate limit violation notifications
- Removed `X-Origin-Verify` header pattern (no longer needed with IAM auth)

**Conversation Memory**
- Replaced AWS Bedrock AgentCore Memory with Strands SDK `SummarizingConversationManager`
- Memory is now in-process (no external memory resource to provision or configure)
- Eliminates external memory setup steps and reduces IAM permission requirements

**Data Layer**
- DynamoDB table now uses composite key (`session_id` partition key + `resource_id` sort key)
- Resources are stored as individual items per resource instead of a single aggregated item per session
- The `resources_by_category` structure is reconstructed at read time by the DynamoDB service

**Frontend**
- Added `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID` and `NEXT_PUBLIC_AWS_REGION` environment variables
- Frontend signs all API requests with SigV4 using temporary Cognito credentials
- Removed direct Lambda Function URL references

**Documentation**
- Corrected all references from CloudFront/Function URL to API Gateway across ARCHITECTURE.md, DEPLOYMENT.md, AGENTCORE_DEPLOYMENT.md, AWS_COST_ESTIMATE.md, and README files
- Added API Gateway, Cognito, and WAF pricing to cost estimate
- Fixed AgentCore Runtime cost calculation ($27.10 vs previously overstated $223.13)
- Added missing Step 11 to DEPLOYMENT.md (SNS subscription)
- Fixed AGENTCORE_DEPLOYMENT.md step numbering (Step 4 referenced non-existent Step 5)
- Linked ARCHITECTURE.md and GEO_LOCATION_UPGRADE.md (previously marked "Coming Soon")
