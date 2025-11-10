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
  
  // Validate CLIENT_ID
  if (!CLIENT_ID) {
    console.error('CLIENT_ID is not set in environment variables');
    return res.status(500).json({ 
      error: 'Server configuration error',
      error_description: 'CLIENT_ID is not configured. Please set NEXT_PUBLIC_MAL_CLIENT_ID in Vercel environment variables.',
      message: 'CLIENT_ID is not configured'
    });
  }
  
  if (CLIENT_ID === '<your_client_id_here>' || CLIENT_ID.trim() === '') {
    console.error('CLIENT_ID is set but has invalid value');
    return res.status(500).json({ 
      error: 'Server configuration error',
      error_description: 'CLIENT_ID is set but has an invalid value. Please set a valid CLIENT_ID in Vercel environment variables.',
      message: 'CLIENT_ID has invalid value'
    });
  }
  
  // Log that CLIENT_ID is set (but don't log the actual value for security)
  console.log('CLIENT_ID is set, length:', CLIENT_ID.length);

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
      console.error('MAL API error:', {
        status: response.status,
        error: data.error,
        error_description: data.error_description
      });
      
      // Provide more helpful error messages
      let errorDescription = data.error_description || 'Unknown error';
      
      if (data.error === 'invalid_client') {
        errorDescription = 'Invalid CLIENT_ID. Please verify that NEXT_PUBLIC_MAL_CLIENT_ID is set correctly in Vercel environment variables and matches your MAL app Client ID.';
      } else if (data.error === 'invalid_grant') {
        errorDescription = 'Invalid authorization code. The code may have expired. Please try connecting again.';
      } else if (data.error === 'redirect_uri_mismatch') {
        errorDescription = `Redirect URI mismatch. Make sure your MAL app redirect URI is set to: ${redirect_uri}`;
      }
      
      return res.status(response.status).json({
        error: data.error || 'Token exchange failed',
        error_description: errorDescription,
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

