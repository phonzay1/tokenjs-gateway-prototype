const { TokenJS } = require('token.js');
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const SECRET_NAME = 'llm-provider-api-keys';

let cachedApiKeys = null;

async function loadApiKeys() {
  if (cachedApiKeys) return cachedApiKeys; 

  const secretsManager = new SecretsManagerClient();
  const command = new GetSecretValueCommand({ SecretId: SECRET_NAME });
  const response = await secretsManager.send(command);

  cachedApiKeys = JSON.parse(response.SecretString);

  // return cachedApiKeys;
}

exports.handler = async (event) => {
  try {
    await loadApiKeys();

    // process.env.ANTHROPIC_API_KEY = cachedApiKeys.ANTHROPIC_API_KEY || null;
    // process.env.OPENAI_API_KEY = cachedApiKeys.OPENAI_API_KEY || null;
    // process.env.GEMINI_API_KEY = cachedApiKeys.GEMINI_API_KEY || null;
    process.env = cachedApiKeys;
    
    const body = JSON.parse(event.body);

    const tokenjs = new TokenJS();

    const completion = await tokenjs.chat.completions.create({
      provider: body.provider,
      model: body.model,
      messages: [
        {
          role: 'user',
          content: `${body.message}`,
        },
      ],
    });

    return {
      statusCode: 200,
      body: JSON.stringify(completion),
    };
    // return completion;
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.response?.status || 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};