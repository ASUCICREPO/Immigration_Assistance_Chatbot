# Immigration Assistance Chatbot Backend

Backend infrastructure for the Immigration Assistance Chatbot, built with AWS CDK, Lambda, and Bedrock AgentCore.

## Architecture

![Architecture Diagram](../docs/assets/ARCHITECTURE%20DIAGRAM.svg)

### Components

1. **AgentCore Runtime**
   - Hosts the Strands agent in AWS Bedrock AgentCore
   - Processes English-only requests
   - Uses Strands SDK SummarizingConversationManager for conversation context
   - Uses geo location search tool (currently mock implementation)

2. **Lambda Proxy (agent-proxy)**
   - Handles translation between user language and English
   - Detects language using AWS Comprehend
   - Translates using AWS Translate
   - Routes requests to AgentCore runtime
   - Streams responses back to frontend

3. **Export Lambda (export-resources)**
   - Generates PDF exports of resources
   - Retrieves translated resources from DynamoDB
   - Uses multilingual font from S3
   - Returns base64-encoded PDF via API Gateway (binary media type support)

4. **DynamoDB Table**
   - Stores translated resources with 24-hour TTL
   - Indexed by session_id
   - Automatically cleaned up after expiration

5. **S3 Bucket**
   - Stores GoNotoKurrent font for multilingual PDF support
   - Fonts automatically uploaded during CDK deployment

## CDK Stack

The infrastructure is defined in `lib/immigration-chatbot-stack.ts`.

### Resources Created

- **ECR Repository:** Stores AgentCore Docker image
- **Lambda Functions:**
  - Agent Proxy (Node.js 22, ARM64, 1024 MB)
  - Export Resources (Python 3.12, ARM64, 1024 MB)
- **API Gateway:** REST API with IAM auth, streaming, and WAF
- **Cognito Identity Pool:** Anonymous authentication for frontend
- **DynamoDB Table:** With TTL enabled (24 hours)
- **S3 Bucket:** For font storage
- **WAF Web ACL:** Rate limiting and IP reputation rules
- **SNS Topic:** Security alert notifications
- **CloudWatch Alarms:** Rate limit violation alerts
- **IAM Roles:** With least-privilege permissions
- **Amplify App:** Connected to GitHub repository
- **CloudFormation Outputs:** URLs and resource names

### Resource Naming

All resources are created with a unique suffix to avoid naming conflicts:
- Format: `immigration-chatbot-<resource>-<suffix>`
- Suffix is generated from stack name hash

## Lambda Proxy

### Translation Flow

```
User (Spanish) → Detect Language → Translate to English → AgentCore
                                                              ↓
User (Spanish) ← Translate to Spanish ← Process in English ←─┘
```

### Implementation

- **Runtime:** Node.js 22
- **Architecture:** ARM64
- **Memory:** 1024 MB
- **Timeout:** 5 minutes
- **Streaming:** Enabled via API Gateway REST API with `ResponseTransferMode: STREAM`

### Key Features

- Language detection with AWS Comprehend
- Translation with AWS Translate
- SSE event translation during streaming
- Resource storage in DynamoDB
- Error handling and logging

### Environment Variables

| Variable            | Description                        |
| ------------------- | ---------------------------------- |
| `AGENT_RUNTIME_ARN` | AgentCore runtime ARN              |
| `AGENT_QUALIFIER`   | Agent qualifier (default: DEFAULT) |

## Export Lambda

### PDF Generation

- Uses ReportLab for PDF generation
- Supports multilingual text with GoNotoKurrent font
- Retrieves resources from DynamoDB by session_id
- Returns base64-encoded PDF

### Implementation

- **Runtime:** Python 3.12
- **Architecture:** ARM64
- **Memory:** 1024 MB
- **Timeout:** 30 seconds

### Environment Variables

| Variable               | Description         |
| ---------------------- | ------------------- |
| `RESOURCES_TABLE_NAME` | DynamoDB table name |
| `FONT_BUCKET_NAME`     | S3 bucket for fonts |

## AgentCore Docker Image

### Build Process

The CDK stack automatically:
1. Builds Docker image from `agents/agentcore/`
2. Pushes to ECR repository
3. Outputs ECR URI for manual AgentCore hosting

### Dockerfile

- **Base Image:** Python 3.12 slim
- **Platform:** ARM64
- **User:** bedrock_agentcore (UID 1000)
- **Ports:** 8080 (main), 8000 (health)
- **Instrumentation:** OpenTelemetry

### Dependencies

See `agents/agentcore/requirements.txt`:
- `bedrock-agentcore-runtime`
- `strands-agents`
- `strands-tools-agent-core-memory`
- Service modules (DynamoDB, PDF, Font, Translation)

## Local Development

### Build Docker Image Locally

```bash
cd agents

# Build image
docker build -t agentcore-local .

# Run with environment variables
docker run -p 8080:8080 \
  -e AWS_REGION=us-east-1 \
  -e RESOURCES_TABLE_NAME=your-table-name \
  agentcore-local
```

**Note:** The AgentCore container is designed to run on AWS Bedrock AgentCore runtime. Local execution is limited and primarily useful for testing the Docker build process. For full functionality, deploy to AWS Bedrock AgentCore.

### Test Lambda Functions Locally

**Agent Proxy:**
```bash
cd lambda/agent-proxy

# Install dependencies
npm install

# Build TypeScript
npm run build

# Test locally (requires AWS credentials)
node dist/index.js
```

**Export Lambda:**
```bash
cd lambda/export-resources

# Install dependencies
pip install -r requirements.txt

# Test locally
python handler.py
```

## Deployment

### Automated Deployment via CodeBuild

The recommended deployment method uses AWS CodeBuild for automation:

1. Fork the repository to your GitHub account
2. Create a GitHub Personal Access Token
3. Run `deploy.sh` script from AWS CloudShell
4. Monitor CodeBuild deployment in AWS Console

See the [Deployment Guide](../docs/DEPLOYMENT.md) for complete step-by-step instructions.

### Manual CDK Deployment (Alternative)

For local development or manual deployment:

```bash
# Install dependencies
npm install

# Bootstrap CDK (first time only)
npx cdk bootstrap

# Deploy stack
npx cdk deploy
```

**Note:** The automated CodeBuild deployment is preferred as it handles:
- Docker image building and pushing to ECR
- CDK bootstrapping and deployment
- Font upload to S3
- Amplify app creation and configuration

### View CloudFormation Outputs

```bash
# List outputs
aws cloudformation describe-stacks \
  --stack-name ImmigrationChatbotStack \
  --query 'Stacks[0].Outputs'
```

### Update Lambda Configuration

After AgentCore runtime is hosted:

```bash
# Update Agent Proxy environment variables
aws lambda update-function-configuration \
  --function-name immigration-chatbot-agent-proxy \
  --environment Variables="{AGENT_RUNTIME_ARN=<arn>,AGENT_QUALIFIER=DEFAULT}"
```

## Monitoring

### CloudWatch Logs

```bash
# Agent Proxy logs
aws logs tail /aws/lambda/immigration-chatbot-agent-proxy --follow

# Export Lambda logs
aws logs tail /aws/lambda/immigration-chatbot-export-resources --follow

# AgentCore logs (after hosting)
aws logs tail /aws/bedrock-agentcore/immigration-chatbot-agent --follow
```

### Key Metrics

- Lambda invocations, errors, duration
- DynamoDB read/write capacity
- S3 GET requests
- Bedrock token usage
- Translation API calls

## Environment Variables

### AgentCore Runtime

Set these when hosting the runtime in AWS Console:

| Variable               | Required | Description         |
| ---------------------- | -------- | ------------------- |
| `AWS_REGION`           | Yes      | AWS region          |
| `RESOURCES_TABLE_NAME` | Yes      | DynamoDB table name |

**Note:** Memory is managed by Strands SDK (no external configuration needed)

### Lambda Proxy

Set after AgentCore is hosted:

| Variable            | Required | Description                        |
| ------------------- | -------- | ---------------------------------- |
| `AGENT_RUNTIME_ARN` | Yes      | AgentCore runtime ARN              |
| `AGENT_QUALIFIER`   | No       | Agent qualifier (default: DEFAULT) |

### Export Lambda

Automatically set by CDK:

| Variable               | Required | Description         |
| ---------------------- | -------- | ------------------- |
| `RESOURCES_TABLE_NAME` | Yes      | DynamoDB table name |
| `FONT_BUCKET_NAME`     | Yes      | S3 bucket name      |

## Troubleshooting

### CDK Deployment Issues

**Issue: Docker build fails**
- Ensure Docker is running
- Check Docker has access to `agents/agentcore/` directory
- Try building manually: `docker build -f agents/agentcore/Dockerfile .`

**Issue: ECR push fails**
- Verify AWS credentials have ECR permissions
- Check ECR repository exists
- Try manual push to test credentials

### Lambda Issues

**Issue: Agent Proxy timeout**
- Check AgentCore runtime is responding
- Verify `AGENT_RUNTIME_ARN` is correct
- Review CloudWatch logs for errors

**Issue: Export Lambda fails**
- Verify DynamoDB table exists and has data
- Check S3 bucket has font file
- Ensure Lambda has read permissions

### AgentCore Issues

**Issue: Image not found**
- Verify ECR URI is correct
- Check image was pushed successfully
- Ensure execution role has ECR permissions


## Additional Resources

- [Deployment Guide](../docs/DEPLOYMENT.md)
- [AgentCore Deployment Guide](../docs/AGENTCORE_DEPLOYMENT.md)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Bedrock AgentCore Documentation](https://docs.aws.amazon.com/bedrock-agentcore/)
