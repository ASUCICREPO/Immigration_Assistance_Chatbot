import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from 'constructs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as amplify from "@aws-cdk/aws-amplify-alpha";
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

export interface ImmigrationChatBotBackendStackProps extends cdk.StackProps {
  resourceSuffix?: string;
}

export class ImmigrationChatBotBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: ImmigrationChatBotBackendStackProps) {
    super(scope, id, props);

    const suffix = props?.resourceSuffix || '';

    const githubToken = this.node.tryGetContext("githubToken");
    const githubOwner = this.node.tryGetContext("githubOwner");
    const githubRepo = this.node.tryGetContext("githubRepo");

    const githubToken_secret_manager = new secretsmanager.Secret(
      this,
      "GitHubToken",
      {
        secretName: `immigration-chatbot-github-token${suffix}`,
        description: "GitHub Personal Access Token for Amplify",
        secretStringValue: cdk.SecretValue.unsafePlainText(githubToken),
      }
    );

    const amplifyApp = new amplify.App(this, "AmplifyFrontendUI", {
      appName: `immigration-chatbot-frontend${suffix}`,
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: githubOwner,
        repository: githubRepo,
        oauthToken: githubToken_secret_manager.secretValue,
      }),
      buildSpec: cdk.aws_codebuild.BuildSpec.fromObjectToYaml({
        version: 1,
        applications: [
          {
            appRoot: "frontend",
            frontend: {
              phases: {
                preBuild: {
                  commands: ["npm ci"],
                },
                build: {
                  commands: ["npm run build"],
                },
              },
              artifacts: {
                baseDirectory: "out",
                files: ["**/*"],
              },
              cache: {
                paths: ["node_modules/**/*"],
              },
            },
          },
        ],
      }),
      platform: amplify.Platform.WEB, // Static site (not SSR)
    });

      const mainBranch = amplifyApp.addBranch("master", {
        autoBuild: true,
        stage: "PRODUCTION",
      });

    // Amplify URL for CORS configuration
    const amplifyUrl = `https://master.${amplifyApp.defaultDomain}`;

    // ========================================
    // Existing Resources (unchanged)
    // ========================================

    // DynamoDB table for storing chat resources with 24-hour TTL
    const resourcesTable = new dynamodb.Table(this, 'ResourcesTable', {
      tableName: `immigration-chatbot-export-resources${suffix}`,
      partitionKey: { name: 'session_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'resource_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // S3 bucket for font files (GoNotoKurrent universal font for multilingual PDF support)
    // Using timestamp to ensure unique bucket name
    const timestamp = Date.now();
    const fontsBucket = new s3.Bucket(this, 'FontsBucket', {
      bucketName: `immigration-chatbot-fonts-${timestamp}${suffix}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Deploy font files to S3 bucket
    new s3deploy.BucketDeployment(this, 'FontsDeployment', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../fonts'))],
      destinationBucket: fontsBucket,
    });

    // ========================================
    // AgentCore Docker Image (built by CDK)
    // ========================================
    // NOTE: After creating the AgentCore runtime manually in AWS Console,
    // you need to add these permissions to the runtime's IAM role:
    // - dynamodb:PutItem, GetItem, Query (for RESOURCES_TABLE_NAME)
    // - bedrock:InvokeModel (for the inference model)
    // - bedrock:InvokeModelWithResponseStream (for streaming responses)
    //
    // Memory is now handled by Strands SDK SummarizingConversationManager
    // (no external AgentCore Memory resource needed)

    const agentCoreImage = new ecrAssets.DockerImageAsset(this, 'AgentCoreImageAsset', {
      directory: path.join(__dirname, '../agents'),
      platform: ecrAssets.Platform.LINUX_ARM64,
    });

    // Get the image URI from CDK-managed Docker asset
    const agentCoreImageUri = agentCoreImage.imageUri;

    // ========================================
    // NEW: Agent Proxy Lambda (Streaming with Translation)
    // ========================================

    // Agent Proxy Lambda - TypeScript bundled automatically by CDK
    const agentProxyFunction = new lambdaNodejs.NodejsFunction(this, 'AgentProxyFunction', {
      functionName: `immigration-chatbot-agent-proxy${suffix}`,
      entry: path.join(__dirname, '../lambda/agent-proxy/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
      architecture: lambda.Architecture.ARM_64,
      bundling: {
        externalModules: ['@aws-sdk/*'], // Use Lambda runtime's AWS SDK
        minify: true,
        sourceMap: true,
      },
      environment: {
        AGENT_RUNTIME_ARN: 'INSERT MANUALLY HERE',
        AGENT_QUALIFIER: 'DEFAULT',
        RESOURCES_TABLE_NAME: resourcesTable.tableName,
        ALLOWED_ORIGIN: amplifyUrl,
      },
    });

    // Grant DynamoDB write permissions for storing translated resources
    resourcesTable.grantWriteData(agentProxyFunction);

    // Grant AgentCore invoke permissions
    agentProxyFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock-agentcore:InvokeAgentRuntime',
      ],
      resources: ['*'], // Will be scoped after AgentCore deployment
    }));

    // Grant translation and language detection permissions
    agentProxyFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'translate:TranslateText',
        'comprehend:DetectDominantLanguage',
      ],
      resources: ['*'],
    }));

    // ========================================
    // API Gateway REST API with Streaming Support
    // ========================================

    // Create REST API
    const api = new apigateway.RestApi(this, 'ChatbotApi', {
      restApiName: `immigration-chatbot-api${suffix}`,
      description: 'Immigration Chatbot API with streaming support and IAM authorization',
      binaryMediaTypes: ['application/pdf'],
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: [amplifyUrl, 'http://localhost:3000'],
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Amz-Security-Token',
          'X-Api-Key',
          'X-Amz-Content-Sha256',
        ],
        allowCredentials: false,
      },
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL], // Regional for 5-minute idle timeout
      },
    });

    // Create /invocations resource for streaming endpoint
    const invocationsResource = api.root.addResource('invocations');

    // Create IAM role for API Gateway to invoke Lambda
    const apiGatewayLambdaRole = new iam.Role(this, 'ApiGatewayLambdaRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      description: 'Role for API Gateway to invoke Lambda functions',
    });

    // Phase 3: Grant both InvokeFunction AND InvokeWithResponseStream.
    // API Gateway uses InvokeWithResponseStream when calling the streaming URI.
    agentProxyFunction.grantInvoke(apiGatewayLambdaRole);
    apiGatewayLambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['lambda:InvokeWithResponseStream'],
      resources: [agentProxyFunction.functionArn],
    }));

    // Phase 1: Use LambdaIntegration (AWS_PROXY type) instead of AwsIntegration (AWS type).
    // ResponseTransferMode: STREAM is only valid for AWS_PROXY or HTTP_PROXY integrations.
    // Proxy integrations do not support integrationResponses or methodResponses mappings.
    const streamingIntegration = new apigateway.LambdaIntegration(agentProxyFunction, {
      proxy: true,
      credentialsRole: apiGatewayLambdaRole,
    });

    // Add POST method with IAM authorization (no methodResponses — proxy handles that)
    invocationsResource.addMethod('POST', streamingIntegration, {
      authorizationType: apigateway.AuthorizationType.IAM,
    });

    // Phase 2: Override the URI to the streaming invocations path and enable STREAM mode.
    // TimeoutInMillis max for the property is 29000ms (the 15-min cap is stream duration,
    // not this field). Set to 29000 unless a service quota increase has been requested.
    const streamingIntegrationUri = `arn:aws:apigateway:${this.region}:lambda:path/2021-11-15/functions/${agentProxyFunction.functionArn}/response-streaming-invocations`;
    const cfnMethod = invocationsResource.node.findChild('POST').node.defaultChild as apigateway.CfnMethod;
    cfnMethod.addPropertyOverride('Integration.Uri', streamingIntegrationUri);
    cfnMethod.addPropertyOverride('Integration.ResponseTransferMode', 'STREAM');
    cfnMethod.addPropertyOverride('Integration.TimeoutInMillis', 29000);

    // ========================================
    // NEW: Export Resources Lambda (with bundled dependencies)
    // ========================================

    const exportResourcesFunction = new lambda.Function(this, 'ExportResourcesFunction', {
      functionName: `immigration-chatbot-export-resources${suffix}`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r lambda/export-resources/requirements.txt -t /asset-output && ' +
            'cp lambda/export-resources/*.py /asset-output/ && ' +
            'cp -r agents /asset-output/'
          ],
        },
      }),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      architecture: lambda.Architecture.ARM_64,
      environment: {
        RESOURCES_TABLE_NAME: resourcesTable.tableName,
        FONT_BUCKET_NAME: fontsBucket.bucketName,
        ALLOWED_ORIGIN: amplifyUrl,
      },
    });

    // Grant DynamoDB read permissions
    resourcesTable.grantReadData(exportResourcesFunction);

    // Grant S3 read permissions for font files
    fontsBucket.grantRead(exportResourcesFunction);

    // Grant permission to invoke the export Lambda
    exportResourcesFunction.grantInvoke(apiGatewayLambdaRole);

    // Create /export-resources/{sessionId} resource
    const exportResourcesResource = api.root.addResource('export-resources');
    const exportSessionResource = exportResourcesResource.addResource('{sessionId}');

    // Add GET method with IAM authorization for export
    exportSessionResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(exportResourcesFunction, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.IAM,
      }
    );

    // ========================================
    // Cognito Identity Pool for Anonymous Users
    // ========================================

    // Create Cognito Identity Pool with unauthenticated access enabled
    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `immigration-chatbot-identity-pool${suffix}`,
      allowUnauthenticatedIdentities: true, // Enable anonymous users
    });

    // Create IAM role for unauthenticated (anonymous) users
    const unauthenticatedRole = new iam.Role(this, 'UnauthenticatedRole', {
      roleName: `immigration-chatbot-unauth-role${suffix}`,
      description: 'Role for anonymous users to invoke API Gateway endpoints',
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    // Grant permission to invoke API Gateway endpoints
    unauthenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: [
          // Allow POST to /invocations
          `arn:aws:execute-api:${this.region}:${this.account}:${api.restApiId}/prod/POST/invocations`,
          // Allow GET to /export-resources/*
          `arn:aws:execute-api:${this.region}:${this.account}:${api.restApiId}/prod/GET/export-resources/*`,
        ],
      })
    );

    // Attach role to identity pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        unauthenticated: unauthenticatedRole.roleArn,
      },
    });

    // ========================================
    // AWS WAF: Web ACL with Rate-Based Rules for API Gateway
    // ========================================

    // Create WAF Web ACL for API Gateway (Regional scope)
    const webAcl = new wafv2.CfnWebACL(this, 'ChatbotWebACL', {
      scope: 'REGIONAL', // Changed from CLOUDFRONT to REGIONAL for API Gateway
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'ChatbotWebACL',
      },
      rules: [
        // Rule 0: AWS Managed IP Reputation List
        {
          name: 'AWSManagedIPReputation',
          priority: 0,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedIPReputation',
          },
        },
        // Rule 1: Blanket Rate-Based Rule (2000 requests per 5 minutes)
        {
          name: 'BlanketRateLimit',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'BlanketRateLimit',
          },
        },
        // Rule 2: Sensitive Endpoint Rate-Based Rule (100 requests per 5 minutes for /export-resources)
        {
          name: 'ExportRateLimit',
          priority: 2,
          statement: {
            rateBasedStatement: {
              limit: 100,
              aggregateKeyType: 'IP',
              scopeDownStatement: {
                byteMatchStatement: {
                  searchString: '/export-resources',
                  fieldToMatch: { uriPath: {} },
                  textTransformations: [{ priority: 0, type: 'NONE' }],
                  positionalConstraint: 'CONTAINS',
                },
              },
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'ExportRateLimit',
          },
        },
      ],
    });

    // ========================================
    // CloudWatch: SNS Topic and Alarms for Rate Limiting
    // ========================================

    // Create SNS topic for security alerts
    const securityAlertsTopic = new sns.Topic(this, 'SecurityAlertsTopic', {
      topicName: `immigration-chatbot-security-alerts${suffix}`,
      displayName: 'Immigration Chatbot Security Alerts',
    });

    // CloudWatch Alarm for Blanket Rate Limit (> 100 blocks in 5 minutes)
    const blanketRateLimitAlarm = new cloudwatch.Alarm(this, 'BlanketRateLimitAlarm', {
      alarmName: `immigration-chatbot-blanket-rate-limit${suffix}`,
      alarmDescription: 'Alert when blanket rate limit blocks exceed 100 in 5 minutes',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/WAFV2',
        metricName: 'BlockedRequests',
        dimensionsMap: {
          Rule: 'BlanketRateLimit',
          WebACL: `ChatbotWebACL${suffix}`,
          Region: this.region,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 100,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    // CloudWatch Alarm for Export Rate Limit (> 50 blocks in 5 minutes)
    const exportRateLimitAlarm = new cloudwatch.Alarm(this, 'ExportRateLimitAlarm', {
      alarmName: `immigration-chatbot-export-rate-limit${suffix}`,
      alarmDescription: 'Alert when export endpoint rate limit blocks exceed 50 in 5 minutes',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/WAFV2',
        metricName: 'BlockedRequests',
        dimensionsMap: {
          Rule: 'ExportRateLimit',
          WebACL: `ChatbotWebACL${suffix}`,
          Region: this.region,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 50,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    // Add SNS actions to alarms
    blanketRateLimitAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(securityAlertsTopic));
    exportRateLimitAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(securityAlertsTopic));

    // Associate WAF Web ACL with API Gateway
    // Must depend on the API deployment so the stage exists before association
    const webAclAssociation = new wafv2.CfnWebACLAssociation(this, 'ApiGatewayWebACLAssociation', {
      resourceArn: `arn:aws:apigateway:${this.region}::/restapis/${api.restApiId}/stages/prod`,
      webAclArn: webAcl.attrArn,
    });
    // Ensure the API stage is fully deployed before WAF association
    webAclAssociation.node.addDependency(api.deploymentStage);

    // ========================================
    // Set Amplify Environment Variables
    // ========================================

    // Add environment variables to Amplify branch for frontend build
    // Use API Gateway URLs with Cognito authentication
    mainBranch.addEnvironment('NEXT_PUBLIC_AGENT_PROXY_URL', api.url);
    mainBranch.addEnvironment('NEXT_PUBLIC_EXPORT_RESOURCES_URL', api.url);
    mainBranch.addEnvironment('NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID', identityPool.ref);
    mainBranch.addEnvironment('NEXT_PUBLIC_AWS_REGION', this.region);

    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'AmplifyAppUrl', {
      value: `https://master.${amplifyApp.defaultDomain}`,
      description: 'Amplify Frontend URL',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL (use for NEXT_PUBLIC_AGENT_PROXY_URL and NEXT_PUBLIC_EXPORT_RESOURCES_URL)',
    });

    new cdk.CfnOutput(this, 'ApiGatewayId', {
      value: api.restApiId,
      description: 'API Gateway REST API ID',
    });

    new cdk.CfnOutput(this, 'CognitoIdentityPoolId', {
      value: identityPool.ref,
      description: 'Cognito Identity Pool ID (use for NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID)',
    });

    new cdk.CfnOutput(this, 'CognitoRegion', {
      value: this.region,
      description: 'AWS Region for Cognito (use for NEXT_PUBLIC_AWS_REGION)',
    });

    new cdk.CfnOutput(this, 'AgentProxyFunctionName', {
      value: agentProxyFunction.functionName,
      description: 'Agent Proxy Lambda function name (for updating environment variables)',
    });

    new cdk.CfnOutput(this, 'AgentCoreEcrImageUri', {
      value: agentCoreImageUri,
      description: 'ECR Image URI for AgentCore (built by CDK, use in AWS Console when hosting agent runtime)',
    });

    new cdk.CfnOutput(this, 'ResourcesTableName', {
      value: resourcesTable.tableName,
      description: 'DynamoDB table name (set as RESOURCES_TABLE_NAME in AgentCore runtime)',
    });

    new cdk.CfnOutput(this, 'FontsBucketName', {
      value: fontsBucket.bucketName,
      description: 'S3 bucket for font files',
    });

    new cdk.CfnOutput(this, 'WebAclArn', {
      value: webAcl.attrArn,
      description: 'ARN of the WAF Web ACL protecting API Gateway',
    });

    new cdk.CfnOutput(this, 'SecurityAlertsTopicArn', {
      value: securityAlertsTopic.topicArn,
      description: 'ARN of the SNS topic for security alerts (subscribe to receive rate limit notifications)',
    });
  }
}
