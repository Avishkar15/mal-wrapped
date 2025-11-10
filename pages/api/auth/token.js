export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, code_verifier, redirect_uri } = req.body;

  // Validate required parameters
  if (!code || !code_verifier || !redirect_uri) {
    return res.status(400).json({ 
      error: 'Missing required parameters',
      required: ['code', 'code_verifier', 'redirect_uri']
    });
  }

  const CLIENT_ID = process.env.NEXT_PUBLIC_MAL_CLIENT_ID;
  
  if (!CLIENT_ID || CLIENT_ID === '<your_client_id_here>') {
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'CLIENT_ID is not configured'
    });
  }

  try {
    const tokenUrl = 'https://myanimelist.net/v1/oauth2/token';
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        code,
        code_verifier,
        grant_type: 'authorization_code',
        redirect_uri,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error || 'Token exchange failed',
        error_description: data.error_description,
        details: data
      });
    }

    // Return the token to the client
    return res.status(200).json(data);
  } catch (error) {
    console.error('Token exchange error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

