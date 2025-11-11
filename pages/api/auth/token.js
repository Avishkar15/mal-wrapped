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
    console.error('Missing parameters:', { 
      has_code: !!code, 
      has_verifier: !!code_verifier, 
      has_redirect_uri: !!redirect_uri 
    });
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
      redirect_uri: normalizedRedirectUri
    });

    console.log('Token exchange request:', {
      redirect_uri: normalizedRedirectUri,
      code_length: code.length,
      verifier_length: code_verifier.length,
      client_id_set: !!CLIENT_ID
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
      console.error('MAL API error (non-JSON):', text);
      return res.status(response.status).json({ 
        error: 'invalid_request',
        error_description: text || 'Unknown error',
        status: response.status
      });
    }

    if (!response.ok) {
      console.error('MAL API error:', {
        status: response.status,
        statusText: response.statusText,
        error: data.error,
        error_description: data.error_description,
        message: data.message,
        redirect_uri: redirect_uri,
        has_code: !!code,
        has_verifier: !!code_verifier,
        client_id_length: CLIENT_ID?.length
      });
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