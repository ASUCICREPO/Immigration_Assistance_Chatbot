# Immigration Assistance Chatbot Deployment Guide

Complete step-by-step guide for deploying the Immigration Assistance Chatbot with AWS Bedrock AgentCore runtime using AWS CloudShell and CodeBuild.

## Architecture Overview

![Architecture Diagram](assets/ARCHITECTURE%20DIAGRAM.svg)

The system consists of:

- **Frontend:** Next.js application on AWS Amplify (auto-deploys from GitHub)
- **API Gateway:** REST API with IAM authorization, WAF protection, and streaming support
- **Lambda Proxy:** Handles translation and routes to AgentCore
- **AgentCore Runtime:** Hosts the Strands agent (English-only processing)
- **Export Lambda:** Generates multilingual PDF exports
- **Cognito Identity Pool:** Provides anonymous authentication for frontend users
- **DynamoDB:** Stores translated resources with 24-hour TTL
- **S3:** Stores multilingual fonts for PDF generation
- **WAF:** Rate limiting and IP reputation protection on API Gateway
- **SNS/CloudWatch:** Security alerting for rate limit violations

## Prerequisites

### Required Accounts and Permissions

- **GitHub Account** with ability to fork repositories
- **AWS Account** with administrator privileges
- **GitHub Personal Access Token (PAT)** - See [Creating a GitHub PAT Guide](#creating-a-github-personal-access-token) below

### AWS Services Used

The deployment will create resources in:

- CloudFormation (stack creation)
- Lambda (function creation and configuration)
- API Gateway (REST API with streaming and IAM auth)
- Cognito (Identity Pool for anonymous authentication)
- IAM (role creation)
- ECR (container registry)
- DynamoDB (table creation)
- S3 (bucket creation)
- Amplify (app creation)
- CodeBuild (deployment automation)
- Bedrock AgentCore (runtime hosting)
- WAF (Web ACL with rate limiting)
- SNS (security alert notifications)
- CloudWatch (alarms and monitoring)

## Deployment Steps

### Step 1: Fork the Repository

1. Navigate to the Immigration Assistance Chatbot repository on GitHub
2. Click the **"Fork"** button in the top-right corner
3. Select your GitHub account as the destination
4. Wait for the fork to complete
5. **Save your forked repository URL** (e.g., `https://github.com/YOUR_USERNAME/immigration-chatbot`)

### Step 2: Create a GitHub Personal Access Token

You need a GitHub PAT to allow AWS Amplify to access your forked repository.

1. Go to GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Configure the token:
   - **Note:** `Immigration Chatbot Deployment`
   - **Expiration:** Choose appropriate duration (90 days recommended)
   - **Scopes:** Select the following:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `admin:repo_hook` (Full control of repository hooks)
4. Click **"Generate token"**
5. **Copy and save the token immediately** - you won't be able to see it again!

### Step 3: Login to AWS CloudShell

1. Login to your AWS account with administrator privileges
2. Navigate to **AWS CloudShell** (icon in top navigation bar, or search for "CloudShell")
3. Wait for CloudShell to initialize (this may take a minute)

### Step 4: Clone Your Forked Repository

In CloudShell, run:

```bash
git clone https://github.com/YOUR_USERNAME/immigration-chatbot.git
cd immigration-chatbot
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### Step 5: Run the Deployment Script

Execute the deployment script:

```bash
bash deploy.sh
```

The script will prompt you for the following information:

1. **GitHub repository URL:** Enter your forked repository URL
   - Example: `https://github.com/YOUR_USERNAME/immigration-chatbot`

2. **Confirm detected owner/repo:** Type `y` to confirm

3. **GitHub Token:** Paste your GitHub Personal Access Token from Step 2

4. **Action:** Type `deploy` to deploy the infrastructure

The script will:

- Create an IAM service role for CodeBuild
- Create a CodeBuild project with your repository
- Start the build process automatically

### Step 6: Monitor CodeBuild Deployment

1. Navigate to **AWS Console → CodeBuild → Build projects**
2. Find your project (named `ImmigrationChatbot-YYYYMMDDHHMMSS`)
3. Click on the project name
4. Click on the running build to view logs
5. Monitor the build progress - this will take approximately 15-20 minutes

The CodeBuild process will:

- Install dependencies (Node.js, Python, CDK)
- Bootstrap CDK
- Build the AgentCore Docker image
- Push the image to ECR
- Deploy the CDK stack (Amplify app, Lambda functions, DynamoDB, S3, fonts)
- Output important values for next steps

**Save these CloudFormation outputs from the build logs:**

- `AgentCoreEcrImageUri` - ECR image URI for AgentCore (use when hosting agent runtime)
- `ApiGatewayUrl` - API Gateway URL (use for `NEXT_PUBLIC_AGENT_PROXY_URL` and `NEXT_PUBLIC_EXPORT_RESOURCES_URL`)
- `ApiGatewayId` - API Gateway REST API ID
- `CognitoIdentityPoolId` - Cognito Identity Pool ID (use for `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID`)
- `CognitoRegion` - AWS Region for Cognito (use for `NEXT_PUBLIC_AWS_REGION`)
- `AgentProxyFunctionName` - Agent Proxy Lambda function name
- `ResourcesTableName` - DynamoDB table name
- `FontsBucketName` - S3 bucket name
- `WebAclArn` - WAF Web ACL ARN
- `SecurityAlertsTopicArn` - SNS topic ARN for security alerts

### Step 7: Wait for CodeBuild to Complete

Wait for the CodeBuild deployment to finish successfully. You can monitor progress in the CodeBuild console.

Once complete, the build logs will show:

```
✅  ImmigrationChatbotStack

Outputs:
ImmigrationChatbotStack.AgentCoreEcrImageUri = ...
ImmigrationChatbotStack.ApiGatewayUrl = ...
ImmigrationChatbotStack.ApiGatewayId = ...
ImmigrationChatbotStack.CognitoIdentityPoolId = ...
ImmigrationChatbotStack.CognitoRegion = ...
...
```

### Step 8: Host AgentCore Runtime

Host the agent runtime in AWS Console using the Docker image built by CodeBuild:

1. Navigate to **AWS Console → Amazon Bedrock AgentCore → Agent Runtime**
2. Click **"Host agent"**
3. Configure:
   - **Agent name:** `immigration-chatbot-agent`
   - **Container image:** Use `AgentCoreEcrRepoUri` from Step 6 output
   - **Execution role:** Create new role or select existing with required permissions
   - **Network mode:** PUBLIC

4. **Set Environment Variables:**

   | Variable               | Value                        |
   | ---------------------- | ---------------------------- |
   | `AWS_REGION`           | `us-east-1` (or your region) |
   | `RESOURCES_TABLE_NAME` | Value from Step 6 output     |

   **Note:** Conversation memory is now managed by Strands SDK SummarizingConversationManager (no external configuration needed)

5. Click **Create**

**Required IAM Permissions for Execution Role:**

- `bedrock:InvokeModel`
- `bedrock:InvokeModelWithResponseStream`
- `dynamodb:PutItem`, `dynamodb:GetItem`, `dynamodb:Query`
- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
- `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`

**Save the Agent Runtime ARN** from the runtime details page.

### Step 9: Update Lambda Environment Variables

Update the Lambda Proxy with the AgentCore runtime ARN:

**Via AWS Console:**

1. Navigate to **AWS Console → Lambda**
2. Find the Lambda function (name will include `agent-proxy`)
3. Go to **Configuration → Environment variables**
4. Click **Edit**
5. Add/Update:
   - `AGENT_RUNTIME_ARN` = Agent Runtime ARN from Step 8
   - `AGENT_QUALIFIER` = `DEFAULT`
6. Click **Save**

### Step 10: Verify Amplify Deployment and Environment Variables

Check that the Amplify app deployed successfully with the correct environment variables:

1. Navigate to **AWS Console → AWS Amplify**
2. Find your app (name will include your repository name)
3. Verify the deployment status shows **"Deployed"**
4. Go to **App Settings → Environment variables**
5. Verify the following environment variables are set:
   - `NEXT_PUBLIC_AGENT_PROXY_URL` = API Gateway URL from Step 6 (e.g., `https://abc123.execute-api.us-east-1.amazonaws.com/prod/`)
   - `NEXT_PUBLIC_EXPORT_RESOURCES_URL` = API Gateway URL from Step 6 (same URL as above)
   - `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID` = Cognito Identity Pool ID from Step 6
   - `NEXT_PUBLIC_AWS_REGION` = AWS Region from Step 6 (e.g., `us-east-1`)
6. If the environment variables are not set or incorrect:
   - Click **Edit** and update them manually using the values from Step 6
   - Click **Save**
   - Trigger a new build by clicking **Run build**
7. **Copy the Amplify app URL** (e.g., `https://master.xxxxx.amplifyapp.com`)

**Important:** The frontend uses API Gateway URLs with IAM authorization (SigV4 signing via Cognito Identity Pool) to ensure:
- WAF protection against DDoS and rate limiting
- IAM-based authentication for all API requests
- CORS headers are properly configured

### Step 11: Subscribe to Security Alerts (Optional)

1. Navigate to **SNS → Topics**
2. Find `immigration-chatbot-security-alerts` topic
3. Click **Create subscription**
4. Choose protocol (Email, SMS, etc.)
5. Enter your endpoint and confirm subscription

### Step 12: Open and Test the Application

1. Open the Amplify URL from Step 10 in your browser
2. The chatbot interface should load
3. Test the chat functionality (see Verification section below)

**Note:** All requests from the frontend are signed with SigV4 using temporary credentials from Cognito Identity Pool. API Gateway validates the signature and WAF provides rate limiting protection.

## Verification

### 1. Test Chat Functionality (English)

1. Open your Amplify URL in a browser
2. Type a message: `"Hello, I need immigration help"`
3. Verify you receive a streaming response from the agent
4. Check that the response is relevant to immigration assistance

### 2. Test Translation (Spanish)

1. Click the language selector and choose **Spanish**
2. Type a message: `"Necesito ayuda con inmigración"`
3. Verify you receive a response in Spanish
4. The system should:
   - Detect Spanish input
   - Translate to English for AgentCore
   - Translate response back to Spanish
   - Display Spanish response to you

### 3. Test PDF Export

1. Have a conversation that generates resource recommendations. Example: `Please help me find some medical help near me.`
2. Open the resources drawer (bottom right).
3. Click the **"Export Resources"** button
4. Verify a PDF file downloads
5. Open the PDF and verify:
   - Resources are listed correctly
   - Multilingual characters render properly
   - Formatting is correct

### 4. Test Session Persistence

1. Send a message and receive a response
2. Refresh the page
3. Send another message
4. Verify the agent remembers context from before the refresh

## Creating a GitHub Personal Access Token

Detailed guide for creating a GitHub PAT:

### Step-by-Step Instructions

1. **Login to GitHub**
   - Go to [github.com](https://github.com) and sign in

2. **Navigate to Settings**
   - Click your profile picture (top-right)
   - Click **"Settings"**

3. **Access Developer Settings**
   - Scroll down the left sidebar
   - Click **"Developer settings"** (at the bottom)

4. **Generate New Token**
   - Click **"Personal access tokens"**
   - Click **"Tokens (classic)"**
   - Click **"Generate new token"** → **"Generate new token (classic)"**

5. **Configure Token**
   - **Note:** Enter a descriptive name (e.g., `Immigration Chatbot Deployment`)
   - **Expiration:** Select duration (90 days recommended, or custom)
   - **Select scopes:**
     - ✅ `repo` - Full control of private repositories
       - This includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`
     - ✅ `admin:repo_hook` - Full control of repository hooks
       - This includes: `write:repo_hook`, `read:repo_hook`

6. **Generate and Save**
   - Click **"Generate token"** at the bottom
   - **IMPORTANT:** Copy the token immediately
   - Store it securely (password manager recommended)
   - You won't be able to see it again!

### Token Security Best Practices

- Never commit tokens to Git repositories
- Don't share tokens in chat or email
- Use tokens with minimum required permissions
- Set expiration dates on tokens
- Revoke tokens when no longer needed
- Rotate tokens periodically

### Troubleshooting Token Issues

**Issue: Token not working**

- Verify you selected the correct scopes (`repo` and `admin:repo_hook`)
- Check token hasn't expired
- Ensure you copied the entire token (no spaces or truncation)

**Issue: Need to regenerate token**

- Go to GitHub → Settings → Developer settings → Personal access tokens
- Find your token and click **"Regenerate token"**
- Update the token in your deployment

## Troubleshooting

### CodeBuild Issues

**Issue: CodeBuild project creation failed**

- Verify you have administrator privileges in AWS
- Check IAM permissions for CodeBuild service role
- Ensure GitHub token is valid and has correct scopes
- Review CloudShell output for specific error messages

**Issue: CodeBuild deployment failing**

- Check CodeBuild logs in AWS Console
- Common causes:
  - Docker build failures (check Dockerfile syntax)
  - CDK bootstrap not completed
  - Insufficient IAM permissions
  - Resource limits exceeded
- View detailed logs: CodeBuild → Build projects → Select project → Build history → View logs

**Issue: GitHub connection failed**

- Verify GitHub token has `repo` and `admin:repo_hook` scopes
- Check token hasn't expired
- Ensure repository URL is correct
- Try regenerating the GitHub token

### AgentCore Issues

**Issue: AgentCore not receiving requests**

- Verify `AGENT_RUNTIME_ARN` is correct in Lambda environment variables
- Check Lambda has `bedrock-agentcore:InvokeAgentRuntime` permission
- View AgentCore logs in CloudWatch: `/aws/bedrock-agentcore/<agent-name>`
- Ensure AgentCore runtime status is "Active"


**Issue: Import errors in AgentCore**

- Ensure Docker image was built correctly by CodeBuild
- Check ECR image exists and is accessible
- Verify execution role has ECR permissions
- Review CodeBuild logs for Docker build errors

### Lambda Proxy Issues

**Issue: Translation not working**

- Verify Lambda has `translate:TranslateText` permission
- Verify Lambda has `comprehend:DetectDominantLanguage` permission
- Check CloudWatch logs: `/aws/lambda/<function-name>`
- Test with English-only input first to isolate translation issues

**Issue: CORS errors**

- Verify Amplify domain is in CORS allowed origins on API Gateway
- Check API Gateway CORS preflight configuration
- Ensure requests are going to the API Gateway URL
- Update CDK if needed and redeploy via CodeBuild

**Issue: Lambda timeout**

- Check Lambda timeout setting (should be 300 seconds for streaming)
- Review CloudWatch logs for performance issues
- Verify AgentCore runtime is responding

### Export Lambda Issues

**Issue: PDF export failing**

- Verify Export Lambda has DynamoDB read permissions
- Check S3 bucket has font file uploaded
- Review Export Lambda logs: `/aws/lambda/<export-function-name>`
- Verify `RESOURCES_TABLE_NAME` environment variable is set

**Issue: Multilingual characters not rendering**

- Verify GoNotoKurrent font is in S3 bucket
- Check `FONT_BUCKET_NAME` environment variable is set
- Ensure Export Lambda has S3 read permissions
- Verify font file was uploaded during CDK deployment

### Amplify Issues

**Issue: Amplify build failing**

- Check build logs in Amplify Console
- Verify all dependencies are in `package.json`
- Ensure environment variables are set correctly
- Check Node.js version compatibility (should be 18+)

**Issue: Environment variables not set or incorrect**

- CDK should set them automatically during deployment to API Gateway URLs
- Manually verify in Amplify Console:
  - App Settings → Environment variables
  - Should see `NEXT_PUBLIC_AGENT_PROXY_URL`, `NEXT_PUBLIC_EXPORT_RESOURCES_URL`, `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID`, and `NEXT_PUBLIC_AWS_REGION`
  - URL values should be API Gateway URLs (e.g., `https://abc123.execute-api.us-east-1.amazonaws.com/prod/`)
- If missing or incorrect:
  - Get values from CloudFormation outputs (Step 6)
  - Add/update them manually in Amplify Console
  - Trigger a new build

**Issue: Amplify not auto-deploying from GitHub**

- Verify GitHub connection in Amplify Console
- Check branch configuration (should be `master` or your default branch)
- Verify GitHub token has correct permissions
- Try triggering a manual build first

### API Gateway and WAF Issues

**Issue: API Gateway returning 403 errors**

- If the request is unsigned or improperly signed, API Gateway returns 403 Forbidden
- Verify Cognito Identity Pool ID and AWS Region are correctly configured in the frontend
- Check that the unauthenticated role has `execute-api:Invoke` permission on the correct API Gateway resources
- Check WAF Web ACL metrics in CloudWatch:
  - Navigate to CloudWatch → Metrics → WAFV2
  - Look for `BlockedRequests` metric
  - Check if rate limits are being triggered
- Review API Gateway access logs (if enabled) for detailed error information

**Issue: Rate limiting blocking legitimate traffic**

- Review WAF rules in AWS Console:
  - Navigate to WAF & Shield → Web ACLs
  - Select your Web ACL
  - Review rule metrics and sampled requests
- Adjust rate limits if needed:
  - Update CDK stack with new limits
  - Redeploy via CodeBuild
- Subscribe to SNS topic for rate limit alerts:
  - Navigate to SNS → Topics
  - Find `immigration-chatbot-security-alerts` topic
  - Create subscription (email or SMS)

**Issue: CORS errors with API Gateway**

- Verify CORS configuration on API Gateway:
  - Navigate to API Gateway → Select your API → Resources
  - Check OPTIONS method responses include correct CORS headers
  - Verify allowed origins include your Amplify URL and `http://localhost:3000`
- Check that requests are going to the API Gateway URL
- Verify the frontend is signing requests correctly with SigV4

### General Troubleshooting Steps

1. **Check CloudWatch Logs**
   - All services log to CloudWatch
   - Look for error messages and stack traces
   - Filter logs by time range to find relevant entries

2. **Verify Environment Variables**
   - Double-check all environment variables are set correctly
   - Ensure no typos in ARNs or resource names
   - Verify values match CloudFormation outputs

3. **Test Components Individually**
   - Test AgentCore runtime directly
   - Test Lambda functions via AWS Console
   - Test Amplify app separately from backend

4. **Review IAM Permissions**
   - Ensure all roles have required permissions
   - Check trust relationships are correct
   - Verify resource-based policies allow access

## Environment Variables Reference

### AgentCore Runtime
| Variable               | Required | Description         | Example                                |
| ---------------------- | -------- | ------------------- | -------------------------------------- |
| `RESOURCES_TABLE_NAME` | Yes      | DynamoDB table name | `immigration-chatbot-export-resources` |

**Note:** Conversation memory is managed by Strands SDK SummarizingConversationManager (no external configuration needed)

### Lambda Proxy
| Variable            | Required | Description           | Example                         |
| ------------------- | -------- | --------------------- | ------------------------------- |
| `AGENT_RUNTIME_ARN` | Yes      | AgentCore runtime ARN | `arn:aws:bedrock-agentcore:...` |
| `AGENT_QUALIFIER`   | No       | Agent qualifier       | `DEFAULT`                       |

### Export Lambda
| Variable               | Required | Description         | Example                                |
| ---------------------- | -------- | ------------------- | -------------------------------------- |
| `RESOURCES_TABLE_NAME` | Yes      | DynamoDB table name | `immigration-chatbot-export-resources` |
| `FONT_BUCKET_NAME`     | Yes      | S3 bucket for fonts | `immigration-chatbot-fonts-bucket`     |

### Frontend (Amplify)
| Variable                               | Required | Description                     | Example                                                    |
| -------------------------------------- | -------- | ------------------------------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_AGENT_PROXY_URL`          | Yes      | API Gateway URL for Agent Proxy | `https://abc123.execute-api.us-east-1.amazonaws.com/prod/` |
| `NEXT_PUBLIC_EXPORT_RESOURCES_URL`     | Yes      | API Gateway URL for Export      | `https://abc123.execute-api.us-east-1.amazonaws.com/prod/` |
| `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID` | Yes      | Cognito Identity Pool ID        | `us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`           |
| `NEXT_PUBLIC_AWS_REGION`               | Yes      | AWS Region for Cognito and API  | `us-east-1`                                                |

**Note:** The frontend uses API Gateway URLs with IAM authorization. Requests are signed with SigV4 using temporary credentials from Cognito Identity Pool. WAF provides rate limiting and IP reputation protection on the API Gateway stage.

## Monitoring

### CloudWatch Logs

View logs for each component:

```bash
# AgentCore logs
aws logs tail /aws/bedrock-agentcore/immigration-chatbot-agent --follow

# Lambda Proxy logs (replace with actual function name)
aws logs tail /aws/lambda/<agent-proxy-function-name> --follow

# Export Lambda logs (replace with actual function name)
aws logs tail /aws/lambda/<export-function-name> --follow
```

### Key Metrics to Monitor

- Lambda invocations and errors
- Lambda duration and memory usage
- Bedrock token usage and costs
- DynamoDB read/write capacity
- Amplify build success rate
- AgentCore runtime health and response times
- **API Gateway request count and error rates (4xx, 5xx)**
- **WAF blocked requests and rate limit triggers**

### CloudWatch Dashboards

Create a custom dashboard to monitor all components:

1. Navigate to **CloudWatch → Dashboards**
2. Create a new dashboard
3. Add widgets for:
   - Lambda errors and invocations
   - WAF blocked requests by rule
   - API Gateway 4xx and 5xx errors
   - DynamoDB throttled requests
   - AgentCore runtime metrics

### WAF Monitoring

Monitor WAF metrics to detect attacks:

```bash
# View WAF blocked requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/WAFV2 \
  --metric-name BlockedRequests \
  --dimensions Name=Rule,Value=BlanketRateLimit Name=WebACL,Value=<web-acl-id> \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T23:59:59Z \
  --period 300 \
  --statistics Sum
```

### Security Alerts

Subscribe to the SNS topic for security alerts:

1. Navigate to **SNS → Topics**
2. Find `immigration-chatbot-security-alerts` topic
3. Click **Create subscription**
4. Choose protocol (Email, SMS, etc.)
5. Enter your endpoint
6. Confirm subscription

You'll receive alerts when:
- Blanket rate limit blocks exceed 100 in 5 minutes
- Export endpoint rate limit blocks exceed 50 in 5 minutes

### CodeBuild Monitoring

Monitor deployment builds:

1. Navigate to **AWS Console → CodeBuild → Build projects**
2. Select your project
3. View **Build history** for past deployments
4. Click on individual builds to view detailed logs
5. Set up CloudWatch alarms for build failures if needed

## Cleanup

To remove all resources:

### Step 1: Delete AgentCore Resources

1. Navigate to **AWS Console → Bedrock → AgentCore → Agent Runtime**
2. Select your runtime and click **Delete**
3. Navigate to **Memory** and delete memory resources (optional)

### Step 2: Run Destroy via CodeBuild

```bash
# In CloudShell, from the repository directory
bash deploy.sh
```

When prompted:

- Enter your GitHub repository URL
- Confirm owner/repo
- Enter GitHub token
- Type `destroy` when asked for action

This will:

- Create a new CodeBuild project for destruction
- Run `cdk destroy` to remove all CloudFormation resources
- Clean up Lambda functions, DynamoDB, S3, Amplify, API Gateway, Cognito, WAF, etc.

### Step 4: Manual Cleanup (if needed)

If CodeBuild destroy fails, manually delete:

1. **CloudFormation Stack:**
   - AWS Console → CloudFormation → Select stack → Delete

2. **CodeBuild Projects:**
   - AWS Console → CodeBuild → Build projects → Delete projects

3. **S3 Buckets (if not empty):**
   ```bash
   aws s3 rm s3://<bucket-name> --recursive
   aws s3 rb s3://<bucket-name>
   ```

4. **ECR Repositories:**
   ```bash
   aws ecr delete-repository --repository-name <repo-name> --force
   ```

**Note:** Some resources may have retention policies or deletion protection enabled. Check CloudFormation stack settings for details.

## Additional Resources

- [AgentCore Deployment Guide](AGENTCORE_DEPLOYMENT.md) - Detailed AgentCore-specific instructions
- [Backend README](../backend/README.md) - Backend architecture and development
- [Frontend README](../frontend/README.md) - Frontend architecture and development
- [AWS Bedrock AgentCore Documentation](https://docs.aws.amazon.com/bedrock-agentcore/)
- [Strands Agents Documentation](https://strandsagents.com/)
- [AWS CodeBuild Documentation](https://docs.aws.amazon.com/codebuild/)
- [AWS CloudShell Documentation](https://docs.aws.amazon.com/cloudshell/)

## Support

For issues:

- Check CloudWatch logs for detailed error messages
- Review troubleshooting section above
- Verify all environment variables are set correctly
- Ensure IAM permissions are in place
- Check CodeBuild logs for deployment errors
- Verify GitHub token is valid and has correct scopes

## Summary

This deployment uses AWS CloudShell and CodeBuild to automate the infrastructure deployment with API Gateway and WAF for security:

1. **Fork** the repository to your GitHub account
2. **Create** a GitHub Personal Access Token
3. **Login** to AWS CloudShell
4. **Clone** your forked repository
5. **Run** `deploy.sh` script
6. **Monitor** CodeBuild deployment
7. **Configure** AgentCore runtime manually
8. **Update** Lambda environment variables
9. **Verify** Amplify deployment and API Gateway URLs
10. **Test** the application

The CodeBuild automation handles:
- CDK deployment
- Docker image building for AgentCore
- Infrastructure provisioning (API Gateway, Lambda, DynamoDB, S3, Cognito, WAF)
- API Gateway REST API with IAM authorization and streaming support
- WAF Web ACL with rate limiting rules
- Security monitoring with CloudWatch alarms and SNS alerts

**Security Architecture:**
- Frontend → API Gateway (WAF protection + IAM auth via SigV4) → Lambda → AgentCore
- Cognito Identity Pool provides temporary credentials for anonymous users
- WAF blocks malicious traffic and enforces rate limits
- API Gateway validates SigV4 signatures before processing requests
