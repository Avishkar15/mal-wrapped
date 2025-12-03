const jikanjs = require('@mateoaranda/jikanjs');

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

  const { personId } = req.query;

  if (!personId) {
    return res.status(400).json({ error: 'Person ID is required' });
  }

  try {
    const personData = await jikanjs.loadPerson(personId);
    
    // Return the person's profile picture
    return res.status(200).json({
      picture: personData?.data?.images?.jpg?.image_url || null,
      name: personData?.data?.name || null
    });
  } catch (error) {
    console.error('Jikan API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch person data',
      message: error.message 
    });
  }
}

