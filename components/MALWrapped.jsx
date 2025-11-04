import React, { useState, useEffect } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';

export default function MALWrapped() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const slides = userData ? [
    { id: 'welcome' },
    { id: 'total_anime' },
    { id: 'genres' },
    { id: 'studio' },
    { id: 'watch_time' },
    { id: 'seasonal' },
    { id: 'top_rated' },
    { id: 'hidden_gems' },
    { id: 'community' },
    { id: 'manga' },
    { id: 'finale' }
  ] : [];

  useEffect(() => {
    // Check if user just returned from OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      handleOAuthCallback(code);
    }

    // Check if already authenticated
    const token = localStorage.getItem('mal_access_token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleOAuthCallback = async (code) => {
    setIsLoading(true);
    try {
      // Exchange code for token via your API route
      const response = await fetch('/api/mal-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      const data = await response.json();
      
      if (data.access_token) {
        localStorage.setItem('mal_access_token', data.access_token);
        setIsAuthenticated(true);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        // Auto-fetch data
        fetchMALData();
      }
    } catch (err) {
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startOAuth = () => {
    const clientId = 'YOUR_MAL_CLIENT_ID'; // Replace with your Client ID
    const redirectUri = window.location.origin + window.location.pathname;
    const codeChallenge = generateCodeChallenge();
    
    localStorage.setItem('mal_code_challenge', codeChallenge);
    
    const authUrl = `https://myanimelist.net/v1/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=plain`;
    
    window.location.href = authUrl;
  };

  const generateCodeChallenge = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let challenge = '';
    for (let i = 0; i < 128; i++) {
      challenge += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return challenge;
  };

  const fetchMALData = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('mal_access_token');
      
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Fetch anime list via your API route
      const animeResponse = await fetch('/api/mal-data?type=anime', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!animeResponse.ok) {
        if (animeResponse.status === 401) {
          localStorage.removeItem('mal_access_token');
          setIsAuthenticated(false);
          throw new Error('Session expired. Please login again.');
        }
        throw new Error('Failed to fetch anime data');
      }

      const animeData = await animeResponse.json();
      
      // Fetch manga list
      const mangaResponse = await fetch('/api/mal-data?type=manga', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const mangaData = mangaResponse.ok ? await mangaResponse.json() : { data: [] };

      // Process 2024 data
      const currentYear = 2024;
      const anime2024 = (animeData.data || []).filter(item => {
        if (!item.list_status?.finish_date) return false;
        const year = new Date(item.list_status.finish_date).getFullYear();
        return year === currentYear;
      });

      const manga2024 = (mangaData.data || []).filter(item => {
        if (!item.list_status?.finish_date) return false;
        const year = new Date(item.list_status.finish_date).getFullYear();
        return year === currentYear;
      });

      if (anime2024.length === 0) {
        setError('No completed anime found for 2024. Make sure to mark anime as completed with finish dates!');
        setIsLoading(false);
        return;
      }

      // Calculate stats
      const totalAnimeWatched = anime2024.length;

      // Top genres
      const genreCounts = {};
      anime2024.forEach(item => {
        item.node?.genres?.forEach(genre => {
          genreCounts[genre.name] = (genreCounts[genre.name] || 0) + 1;
        });
      });
      const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      // Favorite studio
      const studioCounts = {};
      anime2024.forEach(item => {
        item.node?.studios?.forEach(studio => {
          studioCounts[studio.name] = (studioCounts[studio.name] || 0) + 1;
        });
      });
      const favoriteStudio = Object.entries(studioCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Various Studios';

      // Watch time
      const totalEpisodes = anime2024.reduce((sum, item) => sum + (item.node?.num_episodes || 12), 0);
      const watchTimeHours = Math.round((totalEpisodes * 24) / 60);

      // Seasonal discovery
      const seasonCounts = { Winter: 0, Spring: 0, Summer: 0, Fall: 0 };
      anime2024.forEach(item => {
        const finishDate = item.list_status?.finish_date;
        if (finishDate) {
          const month = new Date(finishDate).getMonth() + 1;
          if (month >= 1 && month <= 3) seasonCounts.Winter++;
          else if (month >= 4 && month <= 6) seasonCounts.Spring++;
          else if (month >= 7 && month <= 9) seasonCounts.Summer++;
          else seasonCounts.Fall++;
        }
      });
      const seasonalDiscovery = Object.entries(seasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Fall';

      // Top rated anime
      const topRatedAnime = anime2024
        .filter(item => (item.list_status?.score || 0) > 0)
        .sort((a, b) => (b.list_status?.score || 0) - (a.list_status?.score || 0))
        .slice(0, 3)
        .map(item => item.node.title);

      // Hidden gems
      const hiddenGems = anime2024
        .filter(item => (item.list_status?.score || 0) >= 8 && (item.node?.mean || 10) < 7.5)
        .slice(0, 2)
        .map(item => item.node.title);

      // Community match
      let matchCount = 0;
      let totalCount = 0;
      anime2024.forEach(item => {
        const userScore = item.list_status?.score || 0;
        const malScore = item.node?.mean || 0;
        if (userScore > 0 && malScore > 0) {
          totalCount++;
          if (Math.abs(userScore - malScore) <= 1.5) matchCount++;
        }
      });
      const communityMatch = totalCount > 0 ? Math.round((matchCount / totalCount) * 100) : 0;

      // Manga stats
      const authorCounts = {};
      manga2024.forEach(item => {
        item.node?.authors?.forEach(author => {
          const name = `${author.first_name || ''} ${author.last_name || ''}`.trim();
          authorCounts[name] = (authorCounts[name] || 0) + 1;
        });
      });
      const topAuthor = Object.entries(authorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Various Authors';

      const topManga = manga2024
        .filter(item => (item.list_status?.score || 0) > 0)
        .sort((a, b) => (b.list_status?.score || 0) - (a.list_status?.score || 0))
        .slice(0, 3)
        .map(item => item.node.title);

      setUserData({
        username: 'You',
        year: 2024,
        totalAnimeWatched,
        topGenres: topGenres.length > 0 ? topGenres : ['Action', 'Drama', 'Comedy'],
        favoriteStudio,
        watchTimeHours,
        seasonalDiscovery,
        topRatedAnime: topRatedAnime.length > 0 ? topRatedAnime : ['Rate your anime!'],
        hiddenGems: hiddenGems.length > 0 ? hiddenGems : ['Keep exploring!'],
        communityMatch,
        mangaStats: {
          totalRead: manga2024.length,
          topAuthor,
          topManga: topManga.length > 0 ? topManga : ['Rate your manga!']
        }
      });
      setUsername('You');
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Failed to fetch data.');
    } finally {
      setIsLoading(false);
    }
  };

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const resetWrapped = () => {
    setUserData(null);
    setCurrentSlide(0);
    setError('');
  };

  const logout = () => {
    localStorage.removeItem('mal_access_token');
    setIsAuthenticated(false);
    setUserData(null);
    setCurrentSlide(0);
  };

  if (!userData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-black text-white mb-3" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em'}}>
              2024 Wrapped
            </h1>
            <p className="text-gray-400 text-base">Your year in anime</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {!isAuthenticated ? (
            <div>
              <button
                onClick={startOAuth}
                disabled={isLoading}
                className="w-full bg-green-500 text-black font-bold py-4 px-8 rounded-full hover:bg-green-400 transition-all disabled:opacity-50 text-base mb-4"
                style={{fontFamily: 'system-ui, -apple-system, sans-serif'}}
              >
                {isLoading ? 'Connecting...' : 'Connect MyAnimeList'}
              </button>
              
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <p className="text-yellow-400 text-sm mb-3 font-semibold">⚠️ Setup Required</p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  This requires MAL API credentials. You need to:<br/>
                  1. Create a MAL API client at myanimelist.net/apiconfig<br/>
                  2. Add your Client ID to the code<br/>
                  3. Create API routes (see instructions below)
                </p>
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={fetchMALData}
                disabled={isLoading}
                className="w-full bg-green-500 text-black font-bold py-4 px-8 rounded-full hover:bg-green-400 transition-all disabled:opacity-50 text-base mb-3"
                style={{fontFamily: 'system-ui, -apple-system, sans-serif'}}
              >
                {isLoading ? 'Loading your data...' : 'Generate My Wrapped'}
              </button>
              
              <button
                onClick={logout}
                className="w-full bg-gray-700 text-white font-semibold py-3 px-6 rounded-full hover:bg-gray-600 transition-all text-sm"
              >
                Disconnect Account
              </button>
            </div>
          )}

          <p className="text-gray-600 text-xs mt-6 text-center">
            Make sure anime have finish dates set for 2024
          </p>
        </div>
      </div>
    );
  }

  const renderSlide = () => {
    const slide = slides[currentSlide];
    
    switch (slide.id) {
      case 'welcome':
        return (
          <div className="text-left">
            <h2 className="text-7xl md:text-8xl font-black text-white mb-6" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.03em', lineHeight: '0.95'}}>
              Your 2024<br/>Wrapped
            </h2>
            <p className="text-gray-400 text-lg font-medium">{username}</p>
          </div>
        );
      
      case 'total_anime':
        return (
          <div className="text-left">
            <p className="text-gray-400 text-lg mb-4 font-medium">You finished</p>
            <h2 className="text-9xl font-black mb-6" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #1DB954 0%, #1ed760 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
              {userData.totalAnimeWatched}
            </h2>
            <p className="text-white text-3xl font-bold">anime this year</p>
          </div>
        );
      
      case 'genres':
        return (
          <div className="text-left">
            <h2 className="text-5xl md:text-6xl font-black text-white mb-8" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.03em'}}>
              Your top<br/>genres were
            </h2>
            <div className="space-y-6">
              {userData.topGenres.map((genre, idx) => (
                <div key={idx}>
                  <p className="text-6xl md:text-7xl font-black" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.03em', background: idx === 0 ? 'linear-gradient(135deg, #1DB954 0%, #1ed760 100%)' : idx === 1 ? 'linear-gradient(135deg, #9b59b6 0%, #e74c3c 100%)' : 'linear-gradient(135deg, #3498db 0%, #2ecc71 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
                    {genre}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'studio':
        return (
          <div className="text-left">
            <p className="text-gray-400 text-lg mb-6 font-medium">You watched the most from</p>
            <h2 className="text-6xl md:text-7xl font-black text-white mb-4" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.03em', lineHeight: '1'}}>
              {userData.favoriteStudio}
            </h2>
          </div>
        );
      
      case 'watch_time':
        return (
          <div className="text-left">
            <p className="text-gray-400 text-lg mb-4 font-medium">You spent</p>
            <h2 className="text-9xl font-black mb-4" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
              {userData.watchTimeHours}
            </h2>
            <p className="text-white text-3xl font-bold mb-3">hours</p>
            <p className="text-gray-400 text-lg">watching anime</p>
          </div>
        );
      
      case 'seasonal':
        return (
          <div className="text-left">
            <p className="text-gray-400 text-lg mb-6 font-medium">You discovered the most in</p>
            <h2 className="text-8xl md:text-9xl font-black" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
              {userData.seasonalDiscovery}
            </h2>
          </div>
        );
      
      case 'top_rated':
        return (
          <div className="text-left">
            <h2 className="text-5xl md:text-6xl font-black text-white mb-10" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.03em'}}>
              Your top<br/>anime of 2024
            </h2>
            <div className="space-y-6">
              {userData.topRatedAnime.slice(0, 3).map((anime, idx) => (
                <div key={idx} className="flex items-start gap-6">
                  <span className="text-5xl font-black text-gray-700 mt-1">{idx + 1}</span>
                  <p className="text-3xl md:text-4xl font-bold text-white leading-tight" style={{fontFamily: 'system-ui, -apple-system, sans-serif'}}>
                    {anime}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'hidden_gems':
        return (
          <div className="text-left">
            <h2 className="text-5xl md:text-6xl font-black text-white mb-10" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.03em'}}>
              Hidden gems<br/>you found
            </h2>
            <div className="space-y-6">
              {userData.hiddenGems.map((gem, idx) => (
                <p key={idx} className="text-3xl md:text-4xl font-bold" style={{fontFamily: 'system-ui, -apple-system, sans-serif', background: 'linear-gradient(135deg, #FA8BFF 0%, #2BD2FF 50%, #2BFF88 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
                  {gem}
                </p>
              ))}
            </div>
          </div>
        );
      
      case 'community':
        return (
          <div className="text-left">
            <p className="text-gray-400 text-lg mb-4 font-medium">Your taste matched the community</p>
            <h2 className="text-9xl font-black mb-4" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
              {userData.communityMatch}%
            </h2>
            <p className="text-white text-2xl font-bold">of the time</p>
          </div>
        );
      
      case 'manga':
        return (
          <div className="text-left">
            <h2 className="text-5xl md:text-6xl font-black text-white mb-10" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.03em'}}>
              You also read
            </h2>
            <div className="mb-8">
              <p className="text-8xl font-black mb-2" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
                {userData.mangaStats.totalRead}
              </p>
              <p className="text-2xl font-bold text-white">manga</p>
            </div>
            <p className="text-gray-400 text-base mb-2">Top author</p>
            <p className="text-2xl font-bold text-white mb-6">{userData.mangaStats.topAuthor}</p>
            {userData.mangaStats.topManga[0] !== 'Rate your manga!' && (
              <div>
                <p className="text-gray-400 text-base mb-3">Top titles</p>
                {userData.mangaStats.topManga.slice(0, 2).map((manga, idx) => (
                  <p key={idx} className="text-xl font-semibold text-white mb-2">{manga}</p>
                ))}
              </div>
            )}
          </div>
        );
      
      case 'finale':
        return (
          <div className="text-center">
            <Sparkles className="w-20 h-20 text-green-500 mx-auto mb-8" />
            <h2 className="text-6xl md:text-7xl font-black text-white mb-8" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.03em'}}>
              That's a wrap
            </h2>
            <p className="text-gray-400 text-xl mb-12 font-medium">
              Thanks for another year of anime
            </p>
            <button
              onClick={resetWrapped}
              className="bg-white text-black font-bold py-4 px-10 rounded-full hover:scale-105 transition-transform text-base"
              style={{fontFamily: 'system-ui, -apple-system, sans-serif'}}
            >
              Back to Home
            </button>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="min-h-[70vh] flex flex-col justify-between">
          <div className="flex-1 flex items-center">
            {renderSlide()}
          </div>
          
          {currentSlide < slides.length - 1 && (
            <button
              onClick={nextSlide}
              className="mt-12 flex items-center gap-3 text-white font-bold text-base hover:gap-4 transition-all"
              style={{fontFamily: 'system-ui, -apple-system, sans-serif'}}
            >
              Next
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
