import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Sparkles, Loader2 } from 'lucide-react';

// Helper for PKCE plain code challenge
function generateCodeVerifier(length = 128) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function sha256(plain) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('sha256 requires browser environment'));
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a) {
  let str = '';
  const bytes = new Uint8Array(a);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkceChallenge(verifier) {
  const hashed = await sha256(verifier);
  return base64urlencode(hashed);
}

const CLIENT_ID = '<your_client_id_here>';
const AUTH_URL = 'https://myanimelist.net/v1/oauth2/authorize';
const TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';

// Data processing functions
function processAnimeData(animeList) {
  const genreCount = {};
  const studioCount = {};
  const seasonalData = {};
  const ratedAnime = [];
  const hiddenGems = [];
  const currentYear = new Date().getFullYear();

  animeList.forEach(anime => {
    const node = anime.node || anime;
    const listStatus = anime.list_status;
    
    // Process genres
    if (node.genres) {
      node.genres.forEach(genre => {
        genreCount[genre.name] = (genreCount[genre.name] || 0) + 1;
      });
    }

    // Process studios
    if (node.studios) {
      node.studios.forEach(studio => {
        studioCount[studio.name] = (studioCount[studio.name] || 0) + 1;
      });
    }

    // Process seasonal data (anime completed in 2024/2025)
    if (listStatus?.finish_date) {
      const finishDate = new Date(listStatus.finish_date);
      if (finishDate.getFullYear() === currentYear || finishDate.getFullYear() === currentYear - 1) {
        const season = getSeason(finishDate);
        const key = `${season} ${finishDate.getFullYear()}`;
        seasonalData[key] = (seasonalData[key] || 0) + 1;
      }
    }

    // Process rated anime
    if (listStatus?.score && listStatus.score > 0) {
      ratedAnime.push({
        title: node.title,
        score: listStatus.score,
        picture: node.main_picture?.medium || node.main_picture?.large,
        id: node.id,
      });
    }

    // Process hidden gems (high community score but low popularity)
    if (node.mean && node.num_scoring_users && node.num_scoring_users < 50000 && node.mean >= 7.5) {
      hiddenGems.push({
        title: node.title,
        score: node.mean,
        picture: node.main_picture?.medium || node.main_picture?.large,
        id: node.id,
        popularity: node.num_scoring_users,
      });
    }
  });

  // Get top genre
  const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

  // Get top studio
  const topStudio = Object.entries(studioCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

  // Get top seasonal period
  const topSeasonal = Object.entries(seasonalData).sort((a, b) => b[1] - a[1])[0] || null;

  // Get top rated (sorted by user score)
  const topRated = ratedAnime.sort((a, b) => b.score - a.score).slice(0, 5);

  // Get hidden gem (sorted by score, then by low popularity)
  const hiddenGem = hiddenGems.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.popularity - b.popularity;
  })[0];

  return {
    topGenre,
    topStudio,
    topSeasonal,
    topRated,
    hiddenGem,
    genreCount,
    studioCount,
  };
}

function processMangaData(mangaList) {
  const totalManga = mangaList.length;
  const completedManga = mangaList.filter(m => m.list_status?.status === 'completed').length;
  
  return {
    totalManga,
    completedManga,
  };
}

function getSeason(date) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'Spring';
  if (month >= 6 && month <= 8) return 'Summer';
  if (month >= 9 && month <= 11) return 'Fall';
  return 'Winter';
}

function formatDays(days) {
  if (days < 1) return `${Math.round(days * 24)} hours`;
  if (days < 365) return `${Math.round(days)} days`;
  const years = Math.floor(days / 365);
  const remainingDays = Math.round(days % 365);
  if (years === 1) return `${years} year, ${remainingDays} days`;
  return `${years} years, ${remainingDays} days`;
}

export default function MALWrapped() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [userData, setUserData] = useState(null);
  const [animeList, setAnimeList] = useState([]);
  const [mangaList, setMangaList] = useState([]);
  const [processedData, setProcessedData] = useState(null);
  const [mangaData, setMangaData] = useState(null);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pkceVerifier, setPkceVerifier] = useState(null);

  const slides = userData && processedData ? [
    { id: 'welcome' },
    { id: 'total_anime' },
    { id: 'genres' },
    { id: 'studio' },
    { id: 'watch_time' },
    { id: 'top_rated' },
    { id: 'hidden_gems' },
    ...(processedData.topSeasonal ? [{ id: 'seasonal' }] : []),
    { id: 'community' },
    ...(mangaData && mangaData.totalManga > 0 ? [{ id: 'manga' }] : []),
    { id: 'finale' },
  ] : [];

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const storedVerifier = window.localStorage.getItem('pkce_verifier');
    const storedToken = window.localStorage.getItem('mal_access_token');

    if (code && storedVerifier) {
      exchangeCodeForToken(code, storedVerifier);
    } else if (storedToken) {
      // Check if token is still valid and fetch data
      fetchUserData(storedToken);
    }
  }, []);

  async function exchangeCodeForToken(code, verifier) {
    if (typeof window === 'undefined') return;

    setIsLoading(true);
    setError('');
    const redirectUri = window.location.origin + window.location.pathname;
    
    try {
      const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          code,
          code_verifier: verifier,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error('Failed to exchange code for token');
      }

      const data = await response.json();
      window.localStorage.setItem('mal_access_token', data.access_token);
      window.localStorage.removeItem('pkce_verifier');

      window.history.replaceState({}, document.title, window.location.pathname);

      await fetchUserData(data.access_token);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUserData(accessToken) {
    if (typeof window === 'undefined') return;

    setIsLoading(true);
    setLoadingProgress('Fetching your profile...');
    try {
      const response = await fetch('https://api.myanimelist.net/v2/users/@me?fields=id,name,picture,anime_statistics,manga_statistics', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.localStorage.removeItem('mal_access_token');
          throw new Error('Session expired. Please reconnect.');
        }
        throw new Error('Failed to fetch user data');
      }

      const data = await response.json();
      setUsername(data.name);
      setUserData(data);
      setIsAuthenticated(true);

      // Fetch anime list
      setLoadingProgress('Loading your anime list...');
      const anime = await fetchAnimeList(accessToken);
      setAnimeList(anime);
      setProcessedData(processAnimeData(anime));

      // Fetch manga list if user has manga
      if (data.manga_statistics?.num_items > 0) {
        setLoadingProgress('Loading your manga list...');
        const manga = await fetchMangaList(accessToken);
        setMangaList(manga);
        setMangaData(processMangaData(manga));
      }

      setLoadingProgress('');
    } catch (err) {
      setError(err.message || 'Failed to fetch user data');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchAnimeList(accessToken) {
    let allAnime = [];
    let offset = 0;
    const limit = 100;
    
    try {
      while (true) {
        const fields = [
          'list_status{status,score,start_date,finish_date}',
          'genres{name}',
          'studios{name}',
          'start_season{year,season}',
          'mean',
          'num_scoring_users',
          'title',
          'main_picture',
          'id'
        ].join(',');

        const response = await fetch(
          `https://api.myanimelist.net/v2/users/@me/animelist?fields=${fields}&limit=${limit}&offset=${offset}&nsfw=true`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          break;
        }

        const data = await response.json();
        allAnime = allAnime.concat(data.data || []);
        
        if (!data.paging?.next) break;
        offset += limit;
        
        // Update progress
        setLoadingProgress(`Loaded ${allAnime.length} anime...`);
      }
    } catch (err) {
      console.error('Error fetching anime list:', err);
    }
    
    return allAnime;
  }

  async function fetchMangaList(accessToken) {
    let allManga = [];
    let offset = 0;
    const limit = 100;
    
    try {
      while (true) {
        const fields = [
          'list_status{status,score}',
          'title',
          'main_picture',
          'id'
        ].join(',');

        const response = await fetch(
          `https://api.myanimelist.net/v2/users/@me/mangalist?fields=${fields}&limit=${limit}&offset=${offset}&nsfw=true`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          break;
        }

        const data = await response.json();
        allManga = allManga.concat(data.data || []);
        
        if (!data.paging?.next) break;
        offset += limit;
      }
    } catch (err) {
      console.error('Error fetching manga list:', err);
    }
    
    return allManga;
  }

  async function handleBegin() {
    if (typeof window === 'undefined') {
      setError('This feature requires a browser environment');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const verifier = generateCodeVerifier();
      setPkceVerifier(verifier);
      window.localStorage.setItem('pkce_verifier', verifier);

      const challenge = await pkceChallenge(verifier);
      const redirectUri = window.location.origin + window.location.pathname;

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      });

      window.location.href = `${AUTH_URL}?${params.toString()}`;
    } catch (err) {
      setError(err.message || 'Failed to initiate OAuth');
      setIsLoading(false);
    }
  }

  function SlideContent({ slide }) {
    if (!slide || !userData || !processedData) return null;
    const stats = userData.anime_statistics || {};
    const currentYear = new Date().getFullYear();

    switch (slide.id) {
      case 'welcome':
        return (
          <div className="animate-fade-in space-y-6">
            {userData.picture && (
              <img 
                src={userData.picture} 
                alt={username}
                className="w-24 h-24 rounded-full mx-auto border-4 border-violet-400 shadow-lg"
              />
            )}
            <h2 className="text-5xl font-extrabold mb-4 text-shadow-lg">
              Hi, <span className="gradient-text">{username}</span>!
            </h2>
            <p className="text-2xl text-violet-200">Let's see what you've been watching...</p>
            <div className="mt-8">
              <Sparkles size={48} className="mx-auto text-pink-400 animate-pulse" />
            </div>
          </div>
        );

      case 'total_anime':
        return (
          <div className="animate-scale-in space-y-4">
            <h2 className="text-3xl font-bold mb-6 text-violet-200">You've watched</h2>
            <div className="text-8xl font-black gradient-text text-shadow-lg mb-4">
              {stats.num_items || 0}
            </div>
            <p className="text-2xl text-pink-300 font-semibold">anime titles!</p>
            <p className="text-lg text-gray-300 mt-4">That's a lot of adventures! 🎌</p>
          </div>
        );

      case 'genres':
        return (
          <div className="animate-slide-up space-y-6">
            <h2 className="text-4xl font-bold mb-2 text-violet-200">Your Favorite Genre</h2>
            <div className="text-6xl font-black text-pink-400 text-shadow-lg mb-4">
              {processedData.topGenre}
            </div>
            <p className="text-xl text-gray-300">
              You watched {processedData.genreCount[processedData.topGenre] || 0} {processedData.topGenre.toLowerCase()} anime!
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {Object.entries(processedData.genreCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([genre, count]) => (
                  <span key={genre} className="px-4 py-2 bg-violet-600/30 rounded-full text-sm">
                    {genre} ({count})
                  </span>
                ))}
            </div>
          </div>
        );

      case 'studio':
        return (
          <div className="animate-slide-up space-y-6">
            <h2 className="text-4xl font-bold mb-2 text-violet-200">Your Most Watched Studio</h2>
            <div className="text-5xl font-black text-violet-400 text-shadow-lg mb-4">
              {processedData.topStudio}
            </div>
            <p className="text-xl text-gray-300">
              You've watched {processedData.studioCount[processedData.topStudio] || 0} anime from {processedData.topStudio}!
            </p>
            <p className="text-lg text-pink-300 mt-4">Their animation never disappoints ✨</p>
          </div>
        );

      case 'watch_time':
        const daysWatched = stats.num_days_watched || 0;
        return (
          <div className="animate-scale-in space-y-6">
            <h2 className="text-4xl font-bold mb-4 text-violet-200">Total Watch Time</h2>
            <div className="text-7xl font-black text-pink-400 text-shadow-lg mb-2">
              {Math.round(daysWatched)}
            </div>
            <p className="text-3xl text-pink-300 font-bold">days</p>
            <p className="text-xl text-gray-300 mt-4">
              That's {formatDays(daysWatched)} spent in anime worlds! 🌍
            </p>
            <div className="mt-6 text-lg text-violet-300">
              <p>Episodes watched: {stats.num_episodes || 0}</p>
            </div>
          </div>
        );

      case 'top_rated':
        const topAnime = processedData.topRated[0];
        return (
          <div className="animate-slide-up space-y-6">
            <h2 className="text-4xl font-bold mb-4 text-violet-200">Your Top Rated Anime</h2>
            {topAnime && (
              <>
                {topAnime.picture && (
                  <img 
                    src={topAnime.picture} 
                    alt={topAnime.title}
                    className="w-48 h-64 object-cover rounded-lg mx-auto shadow-2xl border-4 border-pink-400"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                <div className="text-4xl font-bold text-pink-400 text-shadow-lg mt-4">
                  {topAnime.title}
                </div>
                <div className="text-3xl text-violet-300">
                  {'⭐'.repeat(Math.min(topAnime.score, 10))} {topAnime.score}/10
                </div>
                <p className="text-xl text-gray-300 mt-4">A masterpiece in your eyes! 👑</p>
                {processedData.topRated.length > 1 && (
                  <div className="mt-6 text-sm text-violet-400">
                    <p>Top 5: {processedData.topRated.slice(0, 5).map(a => a.title).join(', ')}</p>
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 'hidden_gems':
        const gem = processedData.hiddenGem;
        return (
          <div className="animate-slide-up space-y-6">
            <h2 className="text-4xl font-bold mb-4 text-violet-200">Hidden Gem You Found</h2>
            {gem ? (
              <>
                {gem.picture && (
                  <img 
                    src={gem.picture} 
                    alt={gem.title}
                    className="w-48 h-64 object-cover rounded-lg mx-auto shadow-2xl border-4 border-violet-400"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                <div className="text-4xl font-bold text-violet-400 text-shadow-lg mt-4">
                  {gem.title}
                </div>
                <div className="text-2xl text-pink-300">
                  Community Score: {gem.score.toFixed(2)}/10
                </div>
                <p className="text-xl text-gray-300 mt-4">Underrated but unforgettable 💎</p>
                <p className="text-sm text-violet-400">
                  Only {gem.popularity.toLocaleString()} users scored this gem
                </p>
              </>
            ) : (
              <p className="text-xl text-gray-300">Keep exploring to find hidden gems!</p>
            )}
          </div>
        );

      case 'seasonal':
        const seasonal = processedData.topSeasonal;
        return (
          <div className="animate-slide-down space-y-6">
            <h2 className="text-4xl font-bold mb-4 text-violet-200">Your Busiest Season</h2>
            {seasonal && (
              <>
                <div className="text-5xl font-black text-pink-400 text-shadow-lg mb-4">
                  {seasonal[0]}
                </div>
                <div className="text-3xl text-violet-300 mb-4">
                  You completed {seasonal[1]} anime!
                </div>
                <p className="text-xl text-gray-300">That season was packed! 🎬</p>
              </>
            )}
          </div>
        );

      case 'community':
        return (
          <div className="animate-scale-in space-y-6">
            <h2 className="text-4xl font-bold mb-4 text-violet-200">Your Progress</h2>
            <div className="grid grid-cols-2 gap-6 mt-8">
              <div className="bg-violet-600/30 rounded-xl p-6">
                <div className="text-4xl font-black text-pink-400 mb-2">
                  {stats.num_items_completed || 0}
                </div>
                <p className="text-lg text-violet-200">Completed</p>
              </div>
              <div className="bg-pink-600/30 rounded-xl p-6">
                <div className="text-4xl font-black text-violet-400 mb-2">
                  {stats.num_items_watching || 0}
                </div>
                <p className="text-lg text-pink-200">Watching</p>
              </div>
              <div className="bg-blue-600/30 rounded-xl p-6">
                <div className="text-4xl font-black text-blue-400 mb-2">
                  {stats.num_items_on_hold || 0}
                </div>
                <p className="text-lg text-blue-200">On Hold</p>
              </div>
              <div className="bg-yellow-600/30 rounded-xl p-6">
                <div className="text-4xl font-black text-yellow-400 mb-2">
                  {stats.num_items_dropped || 0}
                </div>
                <p className="text-lg text-yellow-200">Dropped</p>
              </div>
            </div>
            <p className="text-xl text-gray-300 mt-6">Keep going, otaku! 🎌</p>
          </div>
        );

      case 'manga':
        return (
          <div className="animate-slide-up space-y-6">
            <h2 className="text-4xl font-bold mb-4 text-violet-200">Manga Corner</h2>
            {mangaData && (
              <>
                <div className="text-6xl font-black text-pink-400 text-shadow-lg mb-4">
                  {mangaData.totalManga}
                </div>
                <p className="text-2xl text-violet-300">manga titles in your list!</p>
                <p className="text-xl text-gray-300 mt-4">
                  You've completed {mangaData.completedManga} of them 📚
                </p>
                <p className="text-lg text-pink-300 mt-6">You're a true weeb! 🎌</p>
              </>
            )}
          </div>
        );

      case 'finale':
        return (
          <div className="animate-bounce-in space-y-6">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-5xl font-extrabold gradient-text text-shadow-lg mb-4">
              Thank you for using MAL Wrapped {currentYear}!
            </h2>
            <p className="text-2xl text-violet-200 mb-6">
              Share your results and let's make {currentYear + 1} even more anime-packed!
            </p>
            <div className="flex gap-4 justify-center mt-8">
              <Sparkles size={32} className="text-pink-400 animate-pulse" />
              <Sparkles size={32} className="text-violet-400 animate-pulse" />
              <Sparkles size={32} className="text-blue-400 animate-pulse" />
            </div>
          </div>
        );

      default:
        return <div className="mb-6"><p>More stats coming soon...</p></div>;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-violet-900 to-pink-900 flex items-center justify-center p-4">
      <div className="bg-black/60 backdrop-blur-md rounded-3xl shadow-2xl p-8 md:p-12 text-white w-full max-w-4xl text-center border border-violet-700/50">
        {error && (
          <div className="bg-red-600/90 p-4 rounded-xl mb-6 animate-shake border border-red-400">
            <p className="font-semibold">{error}</p>
          </div>
        )}
        
        {isLoading && (
          <div className="space-y-4 py-8">
            <Loader2 size={48} className="mx-auto text-violet-400 animate-spin" />
            <p className="text-xl text-violet-200 animate-pulse">{loadingProgress || 'Loading your data...'}</p>
            <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4">
              <div className="bg-gradient-to-r from-pink-500 to-violet-500 h-2.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        )}

        {!isAuthenticated && !userData && !isLoading && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex justify-center">
              <Sparkles size={64} className="text-violet-300 animate-bounce" />
            </div>
            <h1 className="text-6xl md:text-7xl font-extrabold text-white mb-4 text-shadow-lg">
              MAL Wrapped <span className="gradient-text">{new Date().getFullYear()}</span>
            </h1>
            <p className="text-2xl md:text-3xl text-violet-200 mb-2">Your year in anime</p>
            <p className="text-lg text-gray-300 mb-8">Discover your anime statistics and favorite titles!</p>
            <button 
              onClick={handleBegin} 
              className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 px-10 py-4 text-xl rounded-full font-bold shadow-2xl transition-all transform hover:scale-105 active:scale-95"
            >
              Connect with MyAnimeList
            </button>
            <p className="text-sm text-gray-400 mt-6">
              Secure OAuth authentication • Your data stays private
            </p>
          </div>
        )}

        {isAuthenticated && userData && processedData && !isLoading && slides.length > 0 && (
          <>
            <div key={currentSlide} className="min-h-[400px] flex items-center justify-center">
              <SlideContent slide={slides[currentSlide]} />
            </div>
            <div className="flex gap-4 justify-center mt-10">
              <button
                className="p-3 rounded-full bg-violet-600/70 hover:bg-violet-600 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all transform hover:scale-110 active:scale-95 flex items-center gap-2"
                onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                disabled={currentSlide === 0}
              >
                <ChevronLeft size={20} />
                <span className="hidden sm:inline">Prev</span>
              </button>
              <div className="flex items-center gap-2 px-4">
                <span className="text-sm text-gray-400">{currentSlide + 1}</span>
                <span className="text-gray-600">/</span>
                <span className="text-sm text-gray-400">{slides.length}</span>
              </div>
              <button
                className="p-3 px-6 rounded-full bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all transform hover:scale-110 active:scale-95 flex items-center gap-2 font-semibold"
                onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
                disabled={currentSlide === slides.length - 1}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="flex gap-2 mt-6 justify-center flex-wrap">
              {slides.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => setCurrentSlide(idx)}
                  className={
                    "w-3 h-3 rounded-full transition-all " +
                    (idx === currentSlide 
                      ? 'bg-pink-400 w-8 scale-110' 
                      : 'bg-gray-600 hover:bg-gray-500')
                  }
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {isAuthenticated && userData && processedData && !isLoading && slides.length === 0 && (
          <div className="py-12 space-y-4">
            <p className="text-2xl text-violet-200">No anime data found</p>
            <p className="text-gray-400">Start adding anime to your MyAnimeList to see your wrapped!</p>
          </div>
        )}
      </div>
    </div>
  );
}
