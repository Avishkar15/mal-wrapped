export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { malIds } = req.body;

  if (!malIds || !Array.isArray(malIds) || malIds.length === 0) {
    return res.status(400).json({ error: 'malIds array is required' });
  }

  try {
    const themes = [];
    
    // Query animethemes.moe REST API for each anime
    for (const malId of malIds) {
      try {
        console.log(`Fetching themes for MAL ID: ${malId}`);

        // Use REST API endpoint with filters for MAL ID
        // Include themes, entries, and videos in the response
        const url = new URL('https://api.animethemes.moe/api/anime');
        url.searchParams.append('filter[has]', 'resources.mappings');
        url.searchParams.append('filter[resources.mappings.externalSite]', 'myanimelist');
        url.searchParams.append('filter[resources.mappings.externalId]', malId.toString());
        url.searchParams.append('include', 'animethemes.animethemeentries.videos');

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`Failed to fetch themes for MAL ID ${malId}: ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        
        // Handle different possible response structures
        // The API might return { anime: [...] } or { data: { anime: [...] } } or just an array
        let animeArray = [];
        if (Array.isArray(data)) {
          animeArray = data;
        } else if (data.anime) {
          animeArray = Array.isArray(data.anime) ? data.anime : [data.anime];
        } else if (data.data?.anime) {
          animeArray = Array.isArray(data.data.anime) ? data.data.anime : [data.data.anime];
        }
        
        if (animeArray.length === 0) {
          console.log(`No anime found for MAL ID ${malId}`);
          continue;
        }

        const anime = animeArray[0];
        console.log(`Found anime: ${anime.name}, themes count: ${anime.animethemes?.length || 0}`);

        // Get OP (Opening) themes, prefer first one
        // Handle both animethemes (REST) and themes (GraphQL) property names
        const themesList = anime.animethemes || anime.themes || [];
        const opThemes = themesList.filter(t => t.type === 'OP') || [];
        console.log(`OP themes found: ${opThemes.length}`);
        
        if (opThemes.length > 0) {
          const theme = opThemes[0];
          // Handle both animethemeentries (REST) and entries (GraphQL) property names
          const entries = theme.animethemeentries || theme.entries || [];
          const entry = entries[0];
          
          if (!entry) {
            console.log(`No entries found for theme ${theme.slug}`);
            continue;
          }
          
          console.log(`Entry videos count: ${entry.videos?.length || 0}`);
          
          // Try to find audio file first, then fallback to video
          const audioFile = entry.videos?.find(v => 
            v.tags?.includes('audio') || 
            v.basename?.includes('.mp3') || 
            v.basename?.includes('.m4a') ||
            v.basename?.includes('.ogg')
          );
          
          const video = audioFile || 
            entry.videos?.find(v => v.tags?.includes('720p') || v.tags?.includes('1080p')) || 
            entry.videos?.[0];
          
          if (video?.link) {
            console.log(`Adding theme for ${anime.name}: ${video.link}`);
            themes.push({
              malId: parseInt(malId),
              animeName: anime.name,
              animeSlug: anime.slug,
              themeSlug: theme.slug,
              themeType: theme.type,
              videoUrl: video.link,
              basename: video.basename,
              isAudio: !!audioFile
            });
          } else {
            console.log(`No video link found for ${anime.name}`);
          }
        } else {
          console.log(`No OP themes found for ${anime.name}`);
        }
      } catch (error) {
        console.error(`Error fetching themes for MAL ID ${malId}:`, error);
        continue;
      }
    }

    return res.status(200).json({ themes });
  } catch (error) {
    console.error('Error in animethemes API:', error);
    return res.status(500).json({ error: 'Failed to fetch anime themes' });
  }
}
