export default async function handler(req, res) {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
  
    const accessToken = authHeader.replace('Bearer ', '');
  
    try {
      console.log('Fetching user data from MAL API...');
      
      const response = await fetch('https://api.myanimelist.net/v2/users/@me?fields=id,name,picture,anime_statistics,manga_statistics', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        console.error('MAL API error:', data);
        return res.status(response.status).json(data);
      }
  
      console.log('User data fetched successfully');
      return res.status(200).json(data);
    } catch (error) {
      console.error('User data fetch error:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }