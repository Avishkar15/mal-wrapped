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

  // Normalize redirect_uri (remove trailing slash if present, except for root)
  let normalizedRedirectUri = redirect_uri;
  if (normalizedRedirectUri.endsWith('/') && normalizedRedirectUri !== 'https://' + req.headers.host + '/') {
    normalizedRedirectUri = normalizedRedirectUri.slice(0, -1);
  }

  const CLIENT_ID = process.env.NEXT_PUBLIC_MAL_CLIENT_ID;
  const CLIENT_SECRET = process.env.MAL_CLIENT_SECRET;

  if (!CLIENT_ID) {
    return res.status(500).json({ 
      error: 'Server configuration error',
      error_description: 'CLIENT_ID is not configured. Please set NEXT_PUBLIC_MAL_CLIENT_ID in Vercel environment variables.',
      message: 'CLIENT_ID is not configured'
    });
  }

  if (!CLIENT_SECRET) {
    return res.status(500).json({ 
      error: 'Server configuration error',
      error_description: 'CLIENT_SECRET is not configured. Please set MAL_CLIENT_SECRET in Vercel environment variables. Web apps require a client secret.',
      message: 'CLIENT_SECRET is not configured'
    });
  }

  try {
    const formData = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      code_verifier: code_verifier,
      grant_type: 'authorization_code',
      redirect_uri: normalizedRedirectUri
    });

    const response = await fetch('https://myanimelist.net/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    let data;
    try {
      data = await response.json();
    } catch (e) {
      // If response is not JSON, try to get text
      const text = await response.text();
      return res.status(response.status).json({ 
        error: 'invalid_request',
        error_description: text || 'Unknown error',
        status: response.status
      });
    }

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}