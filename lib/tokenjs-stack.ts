import * as cdk from "aws-cdk-lib";
import { Stack, StackProps } from "aws-cdk-lib";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from "aws-cdk-lib/aws-iam"
import * as dotenv from "dotenv";

dotenv.config();

export class TokenJsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const apiGatewayLogRole = new iam.Role(this, "ApiGatewayCloudWatchRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      description: "IAM Role for API Gateway to push logs to CloudWatch",
    });

    apiGatewayLogRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonAPIGatewayPushToCloudWatchLogs")
    );

    const cfnAccount = new apigateway.CfnAccount(this, "ApiGatewayAccount", {
      cloudWatchRoleArn: apiGatewayLogRole.roleArn,
    });

    cfnAccount.node.addDependency(apiGatewayLogRole);

    const llmCallsLambda = new Function(this, "llmCallsHandler", {
      runtime: Runtime.NODEJS_22_X, 
      code: Code.fromAsset("lambda"), 
      handler: "llmCalls.handler", 
      timeout: cdk.Duration.seconds(60),
      // environment: {
      //   ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      //   GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      //   OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      // },
    });

    const gateway = new apigateway.RestApi(this, "tokenjsGateway", {
      restApiName: 'TokenJS AI Gateway',
      description: 'AI Gateway Prototype with TokenJS',
      apiKeySourceType: apigateway.ApiKeySourceType.HEADER,
      deployOptions: {
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(
          new cdk.aws_logs.LogGroup(this, 'TokenJsGatewayAccessLogs', {
            logGroupName: `/aws/apigateway/${id}/access-logs`,
            retention: cdk.aws_logs.RetentionDays.FOUR_MONTHS, // Customize retention period
            removalPolicy: cdk.RemovalPolicy.DESTROY // Or RETAIN
          })
        ),
        
        // Customize the access log format if needed
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields()
      }
    });

    gateway.node.addDependency(cfnAccount);

    const gatewayKey = new apigateway.ApiKey(this, 'GatewayKey', {
      apiKeyName: 'gateway-api-key',
      enabled: true,
    });

    const basicUsagePlan = gateway.addUsagePlan('BasicUsagePlan', {
      name: 'BasicUsagePlan',
      throttle: {
        rateLimit: 10, // 10 requests per second
        burstLimit: 20,
      },
    });

    basicUsagePlan.addApiKey(gatewayKey);
    basicUsagePlan.addApiStage({ stage: gateway.deploymentStage });

    // see the AWS console/CLI for the actual API key value
    new cdk.CfnOutput(this, 'GeneratedApiKeyId', {
      value: gatewayKey.keyId,
    });

    // storing all provider API keys in *one* secret
    const llmApiKeys = new secretsmanager.Secret(this, 'LLMProviderKeys', {
      secretName: 'llm-provider-api-keys',
      secretObjectValue: {
        ANTHROPIC_API_KEY: cdk.SecretValue.unsafePlainText('your-api-key'),
        GEMINI_API_KEY: cdk.SecretValue.unsafePlainText('your-api-key'),
        OPENAI_API_KEY: cdk.SecretValue.unsafePlainText('your-api-key'),
      },
    });
    
    llmApiKeys.grantRead(llmCallsLambda);

    const chatResource = gateway.root.addResource('chat');
    const llmsResource = chatResource.addResource('llms');

    const llmsIntegration = new apigateway.LambdaIntegration(llmCallsLambda, {
      proxy: true,
    });

    llmsResource.addMethod("POST", llmsIntegration, {
      apiKeyRequired: true,
    });
  }
}
