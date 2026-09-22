exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
  
    try {
      const { prompt, image } = JSON.parse(event.body);
      const apiKey = process.env.GEMINI_API_KEY;
  
      if (!apiKey) {
        return { 
          statusCode: 500, 
          body: JSON.stringify({ error: 'GEMINI_API_KEY environment variable is missing.' }) 
        };
      }
  
      const parts = [{ text: prompt }];
  
      if (image && image.b64) {
        parts.push({
          inline_data: {
            mime_type: image.mime || 'image/jpeg',
            data: image.b64
          }
        });
      }
  
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }] })
        }
      );
  
      if (!response.ok) {
        const errText = await response.text();
        return { statusCode: response.status, body: JSON.stringify({ error: errText }) };
      }
  
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      };
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: err.message })
      };
    }
  };