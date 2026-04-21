  # AgentCore Runtime Deployment Guide

This guide covers deploying the Immigration Assistance Chatbot to AWS Bedrock AgentCore Runtime with Lambda proxy pattern.

**Note:** This guide assumes you've already completed the automated deployment using `deploy.sh` and CodeBuild as described in [DEPLOYMENT.md](DEPLOYMENT.md). This document provides additional details specific to AgentCore configuration.

## Architecture Overview

![Architecture Diagram](assets//ARCHITECTURE%20DIAGRAM.svg)

## Prerequisites

1. **Completed automated deployment** using `deploy.sh` script (see [DEPLOYMENT.md](DEPLOYMENT.md))
2. **CodeBuild deployment finished** successfully with all CloudFormation outputs saved
3. **AWS Console access** for manual AgentCore configuration

---

## Step 1: Infrastructure Already Deployed

The `deploy.sh` script and CodeBuild process have already:

✅ Built and pushed the AgentCore Docker image to ECR  
✅ Created Lambda functions (Agent Proxy and Export Resources)  
✅ Created DynamoDB table with TTL enabled  
✅ Created S3 bucket and uploaded font files  
✅ Created Amplify app with environment variables  

**You should have saved these CloudFormation outputs from CodeBuild logs:**

| Output                  | Description                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `AgentCoreEcrImageUri`  | ECR Image URI for AgentCore                                                                |
| `ApiGatewayUrl`         | API Gateway URL (for `NEXT_PUBLIC_AGENT_PROXY_URL` and `NEXT_PUBLIC_EXPORT_RESOURCES_URL`) |
| `ApiGatewayId`          | API Gateway REST API ID                                                                    |
| `CognitoIdentityPoolId` | Cognito Identity Pool ID (for `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID`)                      |
| `CognitoRegion`         | AWS Region (for `NEXT_PUBLIC_AWS_REGION`)                                                  |
| `ResourcesTableName`    | DynamoDB table name                                                                        |
| `FontsBucketName`       | S3 bucket for fonts                                                                        |

---

## Step 2: Create IAM Execution Role

Create an IAM role for AgentCore with this trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "bedrock-agentcore.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

Attach a policy with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/immigration-chatbot-export-resources"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer"
      ],
      "Resource": "*"
    }
  ]
}
```

**Save the Role ARN** for the next step.

---

## Step 3: Host Agent Runtime (Manual)

1. Navigate to **AWS Console → Amazon Bedrock AgentCore → Agent Runtime**
2. Click **"Host agent"**
3. Configure:
   - **Agent name:** `immigration-chatbot-agent`
   - **Container image:** Use the `AgentCoreEcrRepoUri` from Step 1
   - **Execution role:** Select the IAM role from Step 2
   - **Network mode:** PUBLIC

4. **Set Environment Variables:**

   | Variable               | Value                                  |
   | ---------------------- | -------------------------------------- |
   | `AWS_REGION`           | `us-east-1`                            |
   | `RESOURCES_TABLE_NAME` | `immigration-chatbot-export-resources` |

   **Note:** Conversation memory is handled by Strands SDK (no external configuration needed)

5. Click **Create**

**Save the Agent Runtime ARN**

---

## Step 4: Configure Lambda Proxy

Update the Agent Proxy Lambda with the Agent Runtime ARN:

1. Navigate to **AWS Console → Lambda → immigration-chatbot-agent-proxy**
2. Go to **Configuration → Environment variables**
3. Update: `AGENT_RUNTIME_ARN` = Agent Runtime ARN from Step 3

---

## Step 6: Verify Frontend Deployment

The frontend is automatically deployed by AWS Amplify from your GitHub repository.

**Environment variables are automatically set by CDK:**
- `NEXT_PUBLIC_AGENT_PROXY_URL` - Set to API Gateway URL
- `NEXT_PUBLIC_EXPORT_RESOURCES_URL` - Set to API Gateway URL
- `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID` - Set to Cognito Identity Pool ID
- `NEXT_PUBLIC_AWS_REGION` - Set to AWS Region

**To verify:**
1. Navigate to **AWS Console → AWS Amplify**
2. Find your app (includes your repository name)
3. Verify deployment status shows **"Deployed"**
4. Copy the Amplify app URL (e.g., `https://master.xxxxx.amplifyapp.com`)

If not deployed, click **"Run build"** to trigger a build.

---

## Verification

### Test AgentCore Directly

```bash
aws bedrock-agentcore invoke-agent-runtime \
  --agent-runtime-arn <AGENT_RUNTIME_ARN> \
  --payload '{"prompt": "Hello, what services can you help me find?", "session_id": "test-session-123456789012345"}' \
  --region us-east-1
```

### Test via Frontend Application

The API Gateway endpoints require IAM authorization (SigV4 signing). To test the full system:

1. **Open the Amplify URL** in your browser (from Step 6)
2. **Test English conversation:**
   - Type: `"Hello, I need immigration help"`
   - Verify you receive a streaming response
3. **Test Translation (Spanish):**
   - Click the language selector and choose Spanish
   - Type: `"Necesito ayuda con inmigración"`
   - Verify you receive a response in Spanish
4. **Test Resource Export:**
   - Have a conversation that generates resources
   - Open the resources drawer (bottom right)
   - Click "Export Resources" button
   - Verify PDF downloads with correct multilingual formatting

**Note:** Direct curl requests to API Gateway endpoints will fail with 403 Forbidden because they require IAM authorization (SigV4 signing). All testing must be done through the Amplify frontend (which signs requests using Cognito credentials) or from `http://localhost:3000` during local development.

---

## Monitoring and Debugging

### AgentCore Logs
CloudWatch Log Group: `/aws/bedrock-agentcore/<agent-name>`

### Lambda Proxy Logs
```bash
aws logs tail /aws/lambda/immigration-chatbot-agent-proxy --follow
```

### Export Lambda Logs
```bash
aws logs tail /aws/lambda/immigration-chatbot-export-resources --follow
```

---

## Troubleshooting

### AgentCore not receiving requests
- Verify `AGENT_RUNTIME_ARN` is correct in Lambda proxy
- Check Lambda has `bedrock-agentcore:InvokeAgentRuntime` permission
- View AgentCore logs in CloudWatch

### Translation not working
- Translation is handled by Lambda proxy, NOT AgentCore
- Verify Lambda has `translate:TranslateText` and `comprehend:DetectDominantLanguage` permissions

### Resources not exporting (PDF)
- Verify Export Lambda has DynamoDB read permissions
- Check S3 bucket has font file uploaded
- Review Export Lambda logs


### Import errors in AgentCore
- Ensure Docker image was built from `backend/agents/` directory
- Check CDK deployed correctly

---

## Environment Variables Reference

### AgentCore Runtime
| Variable               | Required | Description                  |
| ---------------------- | -------- | ---------------------------- |
| `RESOURCES_TABLE_NAME` | Yes      | DynamoDB table for resources |

**Note:** Memory is managed by Strands SDK SummarizingConversationManager (no external configuration needed)

### Lambda Proxy
| Variable            | Required | Description                          |
| ------------------- | -------- | ------------------------------------ |
| `AGENT_RUNTIME_ARN` | Yes      | AgentCore runtime ARN                |
| `AGENT_QUALIFIER`   | No       | Agent qualifier (default: `DEFAULT`) |

---

## Cleanup

To remove all resources:

### Step 1: Delete AgentCore Resources (Manual)

1. Navigate to **AWS Console → Bedrock → AgentCore → Agent Runtime**
2. Select your runtime and click **Delete**
3. Navigate to **Memory** and delete memory resources (optional)

### Step 2: Run Automated Cleanup

Use the `deploy.sh` script to automatically destroy all infrastructure:

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
- Clean up Lambda functions, DynamoDB, S3, Amplify, ECR, etc.

### Step 3: Manual Cleanup (if needed)

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

**Note:** Some resources may have retention policies. Check CloudFormation stack settings for details.
