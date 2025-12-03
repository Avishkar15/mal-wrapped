export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
  
    const accessToken = authHeader.replace('Bearer ', '');
    const { personId } = req.query;
  
    if (!personId) {
      return res.status(400).json({ error: 'Person ID is required' });
    }
  
    try {
      console.log(`Fetching person data for ID: ${personId}...`);
      
      const response = await fetch(
        `https://api.myanimelist.net/v2/people/${personId}?fields=id,first_name,last_name,main_picture`, 
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
  
      const data = await response.json();
  
      if (!response.ok) {
        console.error('MAL API error:', data);
        return res.status(response.status).json(data);
      }
  
      console.log(`Person data fetched successfully`);
      return res.status(200).json(data);
    } catch (error) {
      console.error('Person data fetch error:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }

