export default async function handler(req, res) {
  // Set CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, code_verifier, redirect_uri } = req.body;

  if (!code || !code_verifier || !redirect_uri) {
    return res.status(400).json({ 
      error: 'Missing required parameters',
      required: ['code', 'code_verifier', 'redirect_uri']
    });
  }

  const CLIENT_ID = process.env.NEXT_PUBLIC_MAL_CLIENT_ID;

  if (!CLIENT_ID) {
    console.error('CLIENT_ID is not set in environment variables');
    return res.status(500).json({ 
      error: 'Server configuration error',
      error_description: 'CLIENT_ID is not configured. Please set NEXT_PUBLIC_MAL_CLIENT_ID in Vercel environment variables.',
      message: 'CLIENT_ID is not configured'
    });
  }

  try {
    console.log('Exchanging code for token...');
    
    const formData = new URLSearchParams({
      client_id: CLIENT_ID,
      code: code,
      code_verifier: code_verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirect_uri
    });

    const response = await fetch('https://myanimelist.net/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('MAL API error:', data);
      return res.status(response.status).json(data);
    }

    console.log('Token exchange successful');
    return res.status(200).json(data);
  } catch (error) {
    console.error('Token exchange error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}