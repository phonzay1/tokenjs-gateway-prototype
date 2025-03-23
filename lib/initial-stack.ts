import { Stack, StackProps } from "aws-cdk-lib";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dotenv from "dotenv";

dotenv.config();

export class InitialStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

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

    const responseTemplate = `#set($inputRoot = $input.path('$'))
    $input.json('$.body')`;

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
            'application/json': responseTemplate,
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
  }
}
