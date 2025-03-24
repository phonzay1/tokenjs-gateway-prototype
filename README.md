# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Prototype Implementation

This prototype:
- Transforms requests and responses using the TokenJS library.

- Requires an API key to send requests to the API Gateway. This key will be dynamically
generated. To get the value of this key, you can either use the `aws` CLI utility
or the AWS console:
  - via AWS console:
    - Navigate to the AWS API Gateway console
    - Click on "API Keys" in the left-hand side navigation menu
    - Find the key named "gateway-api-key", and click on it for more information
  - via CLI:
    - execute the command `aws apigateway get-api-keys --include-values`
- To use the API key when making requests to the API Gateway: include the request
header "x-api-key: <YOUR_GENERATED_API_KEY>"