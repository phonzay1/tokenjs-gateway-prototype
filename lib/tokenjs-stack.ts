import * as cdk from "aws-cdk-lib";
import { Stack, StackProps } from "aws-cdk-lib";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
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
      environment: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      },
    });

    const gateway = new apigateway.RestApi(this, "tokenjsGateway", {
      restApiName: 'TokenJS AI Gateway',
      description: 'AI Gateway Prototype with TokenJS',
      deployOptions: {
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
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

    const chatResource = gateway.root.addResource('chat');
    const llmsResource = chatResource.addResource('llms');

    // const llmsRequestTemplate = `
    // #set($inputRoot = $input.path('$'))
    // {
    //   "provider": "$inputRoot.provider",  
    //   "model": "$inputRoot.model",
    //   "message": "$inputRoot.message"
    // }
    // `;

    // const llmsResponseTemplate = `#set($inputRoot = $input.path('$'))
    // $input.json('$.body')`;

    // const llmsIntegration = new apigateway.LambdaIntegration(llmCallsLambda, {
    //   proxy: false,
    //   passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
    //   requestTemplates: {
    //     'application/json': llmsRequestTemplate,
    //   },
    //   integrationResponses: [
    //     {
    //       statusCode: '200',
    //       responseTemplates: {
    //         'application/json': llmsResponseTemplate,
    //       },
    //     },
    //     {
    //       selectionPattern: '(4\\d{2})',
    //       statusCode: '400',
    //       responseTemplates: {
    //         'application/json': 'Error: $input.path(\'$.errorMessage\')',
    //       },
    //     },
    //     {
    //       selectionPattern: '(5\\d{2})',
    //       statusCode: '500',
    //       responseTemplates: {
    //         'application/json': 'Error: $input.path(\'$.errorMessage\')',
    //       },
    //     },
    //   ],
    // });

    
    // llmsResource.addMethod('POST', llmsIntegration, {
    //   methodResponses: [
    //     { statusCode: '200' },
    //     { statusCode: '400' },
    //     { statusCode: '500' }
    //   ],
    // });

    const llmsIntegration = new apigateway.LambdaIntegration(llmCallsLambda, {
      proxy: true,
    });

    llmsResource.addMethod("POST", llmsIntegration);
  }
}
