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
    const { offset = 0, limit = 100 } = req.query;
  
    try {
      const fields = [
        'list_status{status,score,start_date,finish_date,num_episodes_watched}',
        'genres{name}',
        'studios{name}',
        'start_season{year,season}',
        'mean',
        'num_list_users',
        'title',
        'main_picture',
        'id',
        'num_episodes',
        'opening_themes'
      ].join(',');
      
      const response = await fetch(
        `https://api.myanimelist.net/v2/users/@me/animelist?offset=${offset}&limit=${limit}&fields=${fields}&nsfw=true`, 
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
  
      const data = await response.json();
  
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