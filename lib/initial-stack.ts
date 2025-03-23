import { Stack, StackProps } from "aws-cdk-lib";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dotenv from "dotenv";

dotenv.config();

export class InitialStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const anthropicLambda = new Function(this, "anthropicHandler", {
      runtime: Runtime.NODEJS_22_X, 
      code: Code.fromAsset("lambda"), 
      handler: "anthropic.handler", 
      environment: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      },
    });
    
    const openaiLambda = new Function(this, "openaiHandler", {
      runtime: Runtime.NODEJS_22_X, 
      code: Code.fromAsset("lambda"), 
      handler: "openai.handler", 
      environment: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      },
    });

    const gateway = new apigateway.RestApi(this, "aiGateway", {
      restApiName: 'AI Gateway',
      description: 'AI Gateway Initial Prototype',
    });

    const chatResource = gateway.root.addResource('chat');
    const openaiResource = chatResource.addResource('openai');
    const anthropicResource = chatResource.addResource('anthropic');

    const openaiRequestTemplate = `
    #set($inputRoot = $input.path('$'))
    {
      "model": "$inputRoot.model",
      "message": "$inputRoot.message"
      #if($inputRoot.max_tokens != '')
      , "max_completion_tokens": $inputRoot.max_tokens
      #end
    }
    `;

    const anthropicRequestTemplate = `
    #set($inputRoot = $input.path('$'))
    {
      "model": "$inputRoot.model",
      "message": "$inputRoot.message",
      "max_tokens": $inputRoot.max_tokens
    }
    `;

    const openaiResponseTemplate = `
    #set($bodyJson = $util.parseJson($input.body))
    {
      "id": "$util.escapeJavaScript($bodyJson.id)",
      "model": "$util.escapeJavaScript($bodyJson.model)",
      "content": "$util.escapeJavaScript($bodyJson.choices[0].message.content)",
      "finish_reason": "$util.escapeJavaScript($bodyJson.choices[0].finish_reason)",
      "usage": {
        "total_tokens": $bodyJson.usage.total_tokens,
        "prompt_tokens": $bodyJson.usage.prompt_tokens,
        "completion_tokens": $bodyJson.usage.completion_tokens
      }
    }
    `;

    const anthropicResponseTemplate = `
    #set($bodyJson = $util.parseJson($input.body))
    #set($inputTokens = $bodyJson.usage.input_tokens)
    #set($outputTokens = $bodyJson.usage.output_tokens)
    #set($totalTokens = $inputTokens + $outputTokens)
    {
      "id": "$util.escapeJavaScript($bodyJson.id)",
      "model": "$util.escapeJavaScript($bodyJson.model)",
      "content": "$util.escapeJavaScript($bodyJson.content[0].text)",
      "finish_reason": "$util.escapeJavaScript($bodyJson.stop_reason)",
      "usage": {
        "total_tokens": $totalTokens,
        "prompt_tokens": $inputTokens,
        "completion_tokens": $outputTokens
      }
    }
    `;

    const openaiIntegration = new apigateway.LambdaIntegration(openaiLambda, {
      proxy: false,
      passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      requestTemplates: {
        'application/json': openaiRequestTemplate,
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseTemplates: {
            'application/json': openaiResponseTemplate,
          },
        },
        {
          selectionPattern: '(4\\d{2})',
          statusCode: '400',
          responseTemplates: {
            'application/json': 'Error: $input.path(\'$.errorMessage\')',
          },
        },
        {
          selectionPattern: '(5\\d{2})',
          statusCode: '500',
          responseTemplates: {
            'application/json': 'Error: $input.path(\'$.errorMessage\')',
          },
        },
      ],
    });

    const anthropicIntegration = new apigateway.LambdaIntegration(anthropicLambda, {
      proxy: false,
      passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      requestTemplates: {
        'application/json': anthropicRequestTemplate,
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseTemplates: {
            'application/json': anthropicResponseTemplate,
          },
        },
        {
          selectionPattern: '(4\\d{2})',
          statusCode: '400',
          responseTemplates: {
            'application/json': 'Error: $input.path(\'$.errorMessage\')',
          },
        },
        {
          selectionPattern: '(5\\d{2})',
          statusCode: '500',
          responseTemplates: {
            'application/json': 'Error: $input.path(\'$.errorMessage\')',
          },
        },
      ],
    });
    
    openaiResource.addMethod('POST', openaiIntegration, {
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '400' },
        { statusCode: '500' }
      ],
    });

    anthropicResource.addMethod('POST', anthropicIntegration, {
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '400' },
        { statusCode: '500' }
      ],
    });
  }
}
