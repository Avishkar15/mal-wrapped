export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    // YouTube Data API v3 search
    // Note: You'll need to add your YouTube Data API key to environment variables
    // Get one at: https://console.cloud.google.com/apis/credentials
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    
    if (!YOUTUBE_API_KEY) {
      // Fallback: return null if no API key is configured
      // The frontend will fall back to genre-based music
      return res.status(200).json({ videoId: null, message: 'YouTube API key not configured' });
    }

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'YouTube API error' });
    }

    if (data.items && data.items.length > 0) {
      const videoId = data.items[0].id.videoId;
      return res.status(200).json({ videoId });
    }

    return res.status(200).json({ videoId: null });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

