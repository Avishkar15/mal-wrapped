export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filename } = req.query;

  if (!filename) {
    return res.status(400).json({ error: 'filename parameter is required' });
  }

  try {
    // First, try to get the metadata to get the actual audio link
    const metadataUrl = `https://api.animethemes.moe/audio/${filename}`;
    let audioUrl = null;

    try {
      const metadataResponse = await fetch(metadataUrl);
      if (metadataResponse.ok) {
        const metadata = await metadataResponse.json();
        if (metadata.audio && metadata.audio.link) {
          audioUrl = metadata.audio.link;
        }
      }
    } catch (error) {
      console.error('Failed to fetch metadata:', error);
    }

    // Fallback to direct URL if metadata fetch failed
    if (!audioUrl) {
      audioUrl = `https://a.animethemes.moe/${filename}`;
    }

    // Fetch the audio file from animethemes.moe (server-side, no CORS)
    const audioResponse = await fetch(audioUrl);

    if (!audioResponse.ok) {
      return res.status(audioResponse.status).json({ 
        error: `Failed to fetch audio: ${audioResponse.statusText}` 
      });
    }

    // Get the content type and length
    const contentType = audioResponse.headers.get('content-type') || 'audio/ogg';
    const contentLength = audioResponse.headers.get('content-length');

    // Set CORS headers to allow client-side access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // Stream the audio file to the client
    const audioBuffer = await audioResponse.arrayBuffer();
    res.status(200).send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error('Error proxying audio:', error);
    return res.status(500).json({ error: 'Failed to proxy audio file' });
  }
}
