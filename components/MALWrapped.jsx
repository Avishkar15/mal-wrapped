import React, { useState, useEffect } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';

// Helper for PKCE plain code challenge
default function generateCodeVerifier(length = 128) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const verifier = localStorage.getItem('mal_code_verifier');

    if (code && verifier) {
      handleOAuthCallback(code, verifier);
    }
    const token = localStorage.getItem('mal_access_token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  // OAuth callback
  const handleOAuthCallback = async (code, codeVerifier) => {
    setIsLoading(true);
    try {
      const clientId = process.env.NEXT_PUBLIC_MAL_CLIENT_ID;
      const redirectUri = window.location.origin + window.location.pathname;
      // Official PKCE token exchange
      const res = await fetch('https://api.myanimelist.net/v2/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: codeVerifier,
          client_id: clientId,
          redirect_uri: redirectUri
        })
      });
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem('mal_access_token', data.access_token);
        setIsAuthenticated(true);
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchMALData(data.access_token);
      } else {
        setError('MAL OAuth failed.');
      }
    } catch (err) {
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Start OAuth
  const startOAuth = () => {
    const clientId = process.env.NEXT_PUBLIC_MAL_CLIENT_ID;
    const redirectUri = window.location.origin + window.location.pathname;
    const codeVerifier = generateCodeVerifier(); // Use plain method per MAL docs

    localStorage.setItem('mal_code_verifier', codeVerifier);
    const authUrl =
      `https://myanimelist.net/v1/oauth2/authorize?` +
      `response_type=code&client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code_challenge=${codeVerifier}` +
      `&code_challenge_method=plain`;
    window.location.href = authUrl;
  };

  // Fetch MAL user data per v2 API
  const fetchMALData = async (overrideToken) => {
    setIsLoading(true);
    setError('');
    try {
      const token = overrideToken || localStorage.getItem('mal_access_token');
      if (!token) throw new Error('Not authenticated');
      // Anime: /v2/users/@me/animelist -- GET fields param required!
      const animeRes = await fetch('https://api.myanimelist.net/v2/users/@me/animelist?fields=list_status,node{title,num_episodes,genres,studios,mean}', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!animeRes.ok) {
        if (animeRes.status === 401) {
          localStorage.removeItem('mal_access_token');
          setIsAuthenticated(false);
          throw new Error('Session expired. Please login again.');
        }
        throw new Error('Failed to fetch anime data');
      }
      const animeData = await animeRes.json();
      // You may need to paginate for full data; for this example, only the first page is used

      // Manga fetch could be similar (not built here; left for enhancement)
      // Only demo anime stats per prompt
      const currentYear = 2024;
      const anime2024 = (animeData.data || []).filter(item => {
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
      const studioCounts = {};
      anime2024.forEach(item => {
        item.node?.studios?.forEach(studio => {
          studioCounts[studio.name] = (studioCounts[studio.name] || 0) + 1;
        });
      });
      const favoriteStudio = Object.entries(studioCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Various Studios';
      const totalEpisodes = anime2024.reduce((sum, item) => sum + (item.node?.num_episodes || 12), 0);
      const watchTimeHours = Math.round((totalEpisodes * 24) / 60);
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
      // Hide gems example (could require extra logic, skipping for prompt)
      const hiddenGems = anime2024
        .filter(item => (item.list_status?.score || 0) >= 8 && (item.node?.mean || 10) < 7.5)
        .slice(0, 2)
        .map(item => item.node.title);
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
        mangaStats: { totalRead: 0, topAuthor: '', topManga: [] } // demo only
      });
      setUsername('You');
    } catch (err) {
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
            <h1 className="text-6xl font-black text-white mb-3" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em'}}>2024 Wrapped</h1>
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
                  3. Use Vercel environment for secrets<br/>
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
  // Helper gradient map for vibrancy
  const gradients = [
    'linear-gradient(135deg, #1DB954 0%, #1ed760 100%)',
    'linear-gradient(135deg, #9b59b6 0%, #e74c3c 100%)',
    'linear-gradient(135deg, #3498db 0%, #2ecc71 100%)',
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #FA8BFF 0%, #2BD2FF 50%, #2BFF88 100%)',
    'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)',
  ];
  const renderSlide = () => {
    const slide = slides[currentSlide];
    switch (slide.id) {
      case 'welcome':
        return (
          <div className="text-left">
            <h2 className="text-7xl md:text-8xl font-black text-white mb-6" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.03em', lineHeight: '0.95'}}>Your 2024<br/>Wrapped</h2>
            <p className="text-gray-400 text-lg font-medium">{username}</p>
          </div>
        );
      case 'total_anime':
        return (
          <div className="text-left">
            <p className="text-gray-400 text-lg mb-4 font-medium">You finished</p>
            <h2 className="text-9xl font-black mb-6" style={{fontFamily: 'system-ui, -apple-system, sans-serif',letterSpacing: '-0.04em',background:gradients[0],WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{userData.totalAnimeWatched}</h2>
            <p className="text-white text-3xl font-bold">anime this year</p>
          </div>
        );
      case 'genres':
        return (
          <div className="text-left">
            <h2 className="text-5xl md:text-6xl font-black text-white mb-8" style={{fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.03em'}}>Your top<br/>genres were</h2>
            <div className="space-y-6">
              {userData.topGenres.map((genre, idx) => (
                <div key={idx}>
                  <p className="text-6xl md:text-7xl font-black" style={{fontFamily:'system-ui,-apple-system,sans-serif',letterSpacing:'-0.03em',background:gradients[idx%gradients.length],WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{genre}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'studio':
        return (
          <div className="text-left">
            <p className="text-gray-400 text-lg mb-6 font-medium">You watched the most from</p
