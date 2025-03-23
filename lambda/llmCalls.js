const { TokenJS } = require('token.js');

exports.handler = async (event) => {
  try {
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