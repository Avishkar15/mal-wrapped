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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to fetch themes for MAL ID ${malId}: ${response.status} ${response.statusText}`);
          console.error(`Error response: ${errorText.substring(0, 500)}`);
          console.error(`Request URL: ${url.toString()}`);
          continue;
        }

        const data = await response.json();
        
        // Debug: log the full response structure
        console.log(`Response for MAL ID ${malId}:`, JSON.stringify(data, null, 2).substring(0, 1000));
        
        // Check if it's JSON:API format with included resources
        let animeArray = [];
        if (data.data && Array.isArray(data.data)) {
          // JSON:API format - data is in data array, relationships in included
          animeArray = data.data;
          console.log(`Using JSON:API format, found ${animeArray.length} anime in data array`);
        } else if (data.anime && Array.isArray(data.anime)) {
          // Standard format
          animeArray = data.anime;
          console.log(`Using standard format, found ${animeArray.length} anime`);
        } else if (Array.isArray(data)) {
          // Direct array
          animeArray = data;
          console.log(`Using direct array format, found ${animeArray.length} anime`);
        }
        
        if (animeArray.length === 0) {
          console.log(`No anime found for MAL ID ${malId}. Response keys:`, Object.keys(data));
          continue;
        }
        
        const anime = animeArray[0];
        console.log(`Found anime: ${anime.name || anime.attributes?.name || 'Unknown'}, themes count: ${(anime.animethemes || anime.relationships?.animethemes?.data || []).length}`);
        console.log(`Anime keys:`, Object.keys(anime));
        
        // Handle JSON:API format - resolve relationships from included array
        let animethemes = [];
        if (anime.relationships && data.included) {
          // JSON:API format - need to resolve relationships
          const themeIds = anime.relationships.animethemes?.data?.map(r => r.id) || [];
          animethemes = themeIds.map(id => {
            return data.included.find(item => item.type === 'animetheme' && item.id === id);
          }).filter(Boolean);
          console.log(`Resolved ${animethemes.length} themes from included array`);
        } else if (anime.animethemes) {
          animethemes = Array.isArray(anime.animethemes) ? anime.animethemes : [anime.animethemes];
        }
        
        if (animethemes.length > 0) {
          console.log(`First theme structure:`, JSON.stringify(animethemes[0], null, 2).substring(0, 500));
        }

        // Get OP (Opening) themes
        // Handle both direct format and JSON:API format
        const opThemes = animethemes.filter(t => {
          const type = t.type || t.attributes?.type;
          return type === 'OP';
        });
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
        const op1Theme = opThemes.find(t => {
          const slug = t.slug || t.attributes?.slug;
          return slug === 'OP1';
        }) || opThemes[0];
        
        const selectedThemeSlug = op1Theme?.slug || op1Theme?.attributes?.slug || 'unknown';
        console.log(`Selected theme: ${selectedThemeSlug}`);
        
        // Get entries - handle both direct format and JSON:API
        let entries = [];
        if (op1Theme?.animethemeentries) {
          entries = Array.isArray(op1Theme.animethemeentries) ? op1Theme.animethemeentries : [op1Theme.animethemeentries];
        } else if (op1Theme?.relationships?.animethemeentries?.data && data.included) {
          // JSON:API format - resolve entries from included
          const entryIds = op1Theme.relationships.animethemeentries.data.map(r => r.id);
          entries = entryIds.map(id => {
            return data.included.find(item => item.type === 'animethemeentry' && item.id === id);
          }).filter(Boolean);
        }
        
        console.log(`Theme entries: ${entries.length}`);
        
        if (entries.length > 0) {
          for (const entry of entries) {
            // Get videos - handle both direct format and JSON:API
            let videos = [];
            if (entry.videos) {
              videos = Array.isArray(entry.videos) ? entry.videos : [entry.videos];
            } else if (entry.relationships?.videos?.data && data.included) {
              // JSON:API format - resolve videos from included
              const videoIds = entry.relationships.videos.data.map(r => r.id);
              videos = videoIds.map(id => {
                return data.included.find(item => item.type === 'video' && item.id === id);
              }).filter(Boolean);
            }
            
            console.log(`Entry has ${videos.length} videos`);
            if (videos.length > 0) {
              // Log video structure
              const firstVideo = videos[0];
              const videoData = firstVideo.attributes || firstVideo;
              console.log(`First video:`, JSON.stringify(videoData, null, 2).substring(0, 300));
              
              // Prefer video with filename containing -OP1, otherwise take first
              selectedVideo = videos.find(v => {
                const filename = v.filename || v.attributes?.filename;
                return filename && filename.includes('-OP1');
              }) || videos[0];
              
              if (selectedVideo) {
                selectedTheme = op1Theme;
                const filename = selectedVideo.filename || selectedVideo.attributes?.filename;
                console.log(`Selected video filename: ${filename}`);
                break;
              }
            }
          }
        }
        
        // If no video found, try other OP themes
        if (!selectedVideo) {
          console.log(`Trying other OP themes...`);
          for (const theme of opThemes) {
            let themeEntries = [];
            if (theme.animethemeentries) {
              themeEntries = Array.isArray(theme.animethemeentries) ? theme.animethemeentries : [theme.animethemeentries];
            } else if (theme.relationships?.animethemeentries?.data && data.included) {
              const entryIds = theme.relationships.animethemeentries.data.map(r => r.id);
              themeEntries = entryIds.map(id => {
                return data.included.find(item => item.type === 'animethemeentry' && item.id === id);
              }).filter(Boolean);
            }
            
            for (const entry of themeEntries) {
              let videos = [];
              if (entry.videos) {
                videos = Array.isArray(entry.videos) ? entry.videos : [entry.videos];
              } else if (entry.relationships?.videos?.data && data.included) {
                const videoIds = entry.relationships.videos.data.map(r => r.id);
                videos = videoIds.map(id => {
                  return data.included.find(item => item.type === 'video' && item.id === id);
                }).filter(Boolean);
              }
              
              if (videos.length > 0) {
                selectedVideo = videos[0];
                selectedTheme = theme;
                const filename = selectedVideo.filename || selectedVideo.attributes?.filename;
                const slug = theme.slug || theme.attributes?.slug;
                console.log(`Selected video from theme ${slug}, filename: ${filename}`);
                break;
              }
            }
            if (selectedVideo) break;
          }
        }
        
        // Extract data from selectedVideo (handle both direct and JSON:API format)
        const videoFilename = selectedVideo?.filename || selectedVideo?.attributes?.filename;
        const videoBasename = selectedVideo?.basename || selectedVideo?.attributes?.basename;
        const animeName = anime.name || anime.attributes?.name;
        const animeSlug = anime.slug || anime.attributes?.slug;
        const themeSlug = selectedTheme?.slug || selectedTheme?.attributes?.slug;
        const themeType = selectedTheme?.type || selectedTheme?.attributes?.type;
        
        if (selectedVideo && videoFilename) {
          // Construct audio URL using filename
          const audioUrl = `https://api.animethemes.moe/audio/${videoFilename}.ogg`;
          
          console.log(`Adding theme for ${animeName}: ${audioUrl} (from ${videoFilename})`);
            themes.push({
              malId: parseInt(malId),
            animeName: animeName,
            animeSlug: animeSlug,
            themeSlug: themeSlug,
            themeType: themeType,
            videoUrl: audioUrl,
            basename: videoBasename,
            filename: videoFilename,
            isAudio: true
          });
        } else {
          console.log(`No video with filename found for ${animeName}. Selected video:`, selectedVideo);
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
