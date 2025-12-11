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

        // Use REST API endpoint with correct filters for MAL ID
        const url = new URL('https://api.animethemes.moe/anime');
        url.searchParams.append('filter[has]', 'resources');
        url.searchParams.append('filter[site]', 'MyAnimeList');
        url.searchParams.append('filter[external_id]', malId.toString());
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
        
        // The API returns { anime: [...] }
        if (!data.anime || !Array.isArray(data.anime) || data.anime.length === 0) {
          console.log(`No anime found for MAL ID ${malId}`);
          continue;
        }

        const anime = data.anime[0];
        console.log(`Found anime: ${anime.name}, themes count: ${anime.animethemes?.length || 0}`);

        // Get OP (Opening) themes
        const opThemes = anime.animethemes?.filter(t => t.type === 'OP') || [];
        console.log(`OP themes found: ${opThemes.length}`);
        
        if (opThemes.length === 0) {
          console.log(`No OP themes found for ${anime.name}`);
          continue;
        }

        // Prefer OP1 (first opening), then OP2, etc.
        // Try to find a video with filename containing -OP1 first
        let selectedVideo = null;
        let selectedTheme = null;
        
        // First, try to find OP1 specifically
        const op1Theme = opThemes.find(t => t.slug === 'OP1') || opThemes[0];
        
        if (op1Theme && op1Theme.animethemeentries) {
          for (const entry of op1Theme.animethemeentries) {
            if (entry.videos && entry.videos.length > 0) {
              // Prefer video with filename containing -OP1, otherwise take first
              selectedVideo = entry.videos.find(v => v.filename && v.filename.includes('-OP1')) || entry.videos[0];
              if (selectedVideo) {
                selectedTheme = op1Theme;
                break;
              }
            }
          }
        }
        
        // If no video found, try other OP themes
        if (!selectedVideo) {
          for (const theme of opThemes) {
            if (theme.animethemeentries) {
              for (const entry of theme.animethemeentries) {
                if (entry.videos && entry.videos.length > 0) {
                  selectedVideo = entry.videos[0];
                  selectedTheme = theme;
                  break;
                }
              }
              if (selectedVideo) break;
            }
          }
        }
        
        if (selectedVideo && selectedVideo.filename) {
          // Construct audio URL using filename
          const audioUrl = `https://api.animethemes.moe/audio/${selectedVideo.filename}.ogg`;
          
          console.log(`Adding theme for ${anime.name}: ${audioUrl} (from ${selectedVideo.filename})`);
          themes.push({
            malId: parseInt(malId),
            animeName: anime.name,
            animeSlug: anime.slug,
            themeSlug: selectedTheme.slug,
            themeType: selectedTheme.type,
            videoUrl: audioUrl,
            basename: selectedVideo.basename,
            filename: selectedVideo.filename,
            isAudio: true
          });
        } else {
          console.log(`No video with filename found for ${anime.name}`);
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
