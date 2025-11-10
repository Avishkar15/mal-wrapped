import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';

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

const CLIENT_ID = process.env.NEXT_PUBLIC_MAL_CLIENT_ID;
const AUTH_URL = 'https://myanimelist.net/v1/oauth2/authorize';

export default function MALWrapped() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [animeList, setAnimeList] = useState([]);
  const [mangaList, setMangaList] = useState([]);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const slideRef = useRef(null);

  const slides = stats ? [
    { id: 'welcome' },
    { id: 'anime_log' },
    { id: 'total_watch_time' },
    { id: 'top_genres' },
    { id: 'favorite_anime' },
    { id: 'top_studios' },
    { id: 'seasonal_highlight' },
    { id: 'hidden_gems' },
    { id: 'manga_log' },
    { id: 'favorite_manga' },
    { id: 'top_authors' },
    { id: 'finale' },
  ] : [];

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const errorParam = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    const storedVerifier = localStorage.getItem('pkce_verifier');
    const storedToken = localStorage.getItem('mal_access_token');

    if (errorParam) {
      setError(`Authorization failed: ${errorDescription || errorParam}`);
      window.history.replaceState({}, document.title, window.location.pathname);
      localStorage.removeItem('pkce_verifier');
      return;
    }

    if (code && storedVerifier) {
      exchangeCodeForToken(code, storedVerifier);
    } else if (code && !storedVerifier) {
      setError('Authorization session expired. Please try connecting again.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (storedToken) {
      fetchUserData(storedToken);
    }
  }, []);

  async function exchangeCodeForToken(code, verifier) {
    setIsLoading(true);
    setError('');
    setLoadingProgress('Connecting to MAL...');
    
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      const response = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: verifier, redirect_uri: redirectUri }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || errorData.error || 'Authentication failed');
      }

      const data = await response.json();
      localStorage.setItem('mal_access_token', data.access_token);
      if (data.refresh_token) localStorage.setItem('mal_refresh_token', data.refresh_token);
      localStorage.removeItem('pkce_verifier');
      window.history.replaceState({}, document.title, window.location.pathname);

      await fetchUserData(data.access_token);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUserData(accessToken) {
    setIsLoading(true);
    setLoadingProgress('Fetching your profile...');
    
    try {
      const response = await fetch('/api/mal/user', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error('Failed to fetch user data');
      const data = await response.json();
      
      setUsername(data.name);
      setUserData(data);
      
      await fetchAnimeList(accessToken);
      await fetchMangaList(accessToken);
      
      setIsAuthenticated(true);
    } catch (err) {
      setError(err.message);
      localStorage.removeItem('mal_access_token');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchAnimeList(accessToken) {
    setLoadingProgress('Loading your anime list...');
    try {
      let allAnime = [];
      let offset = 0;
      const limit = 100;

      while (true) {
        const response = await fetch(`/api/mal/animelist?offset=${offset}&limit=${limit}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!response.ok) break;
        const data = await response.json();
        
        if (!data.data || data.data.length === 0) break;
        
        // Log first item structure for debugging
        if (allAnime.length === 0 && data.data.length > 0) {
          console.log('Sample anime item structure:', JSON.stringify(data.data[0], null, 2));
        }
        
        allAnime = [...allAnime, ...data.data];
        
        if (!data.paging?.next) break;
        offset += limit;
        setLoadingProgress(`Loaded ${allAnime.length} anime...`);
      }

      console.log(`Total anime loaded: ${allAnime.length}`);
      setAnimeList(allAnime);
      // Calculate stats with current anime, manga will be added later
      if (mangaList.length > 0) {
        calculateStats(allAnime, mangaList);
      } else {
        // Set initial stats with just anime
        calculateStats(allAnime, []);
      }
    } catch (err) {
      console.error('Error fetching anime list:', err);
      setError('Failed to load anime list. Please try again.');
    }
  }

  async function fetchMangaList(accessToken) {
    setLoadingProgress('Loading your manga list...');
    try {
      let allManga = [];
      let offset = 0;
      const limit = 100;

      while (true) {
        const response = await fetch(`/api/mal/mangalist?offset=${offset}&limit=${limit}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!response.ok) break;
        const data = await response.json();
        
        if (!data.data || data.data.length === 0) break;
        allManga = [...allManga, ...data.data];
        
        if (!data.paging?.next) break;
        offset += limit;
      }

      setMangaList(allManga);
      // Recalculate stats with both anime and manga
      calculateStats(animeList.length > 0 ? animeList : [], allManga);
    } catch (err) {
      console.error('Error fetching manga list:', err);
    }
  }

  function calculateStats(anime, manga) {
    const currentYear = 2025;
    
    console.log('Calculating stats for:', {
      animeCount: anime.length,
      mangaCount: manga.length,
      sampleAnime: anime.length > 0 ? anime[0] : null
    });
    
    // Filter anime from current year (completed in 2025)
    const thisYearAnime = anime.filter(item => {
      const finishDate = item.list_status?.finish_date;
      if (!finishDate) return false;
      try {
        return new Date(finishDate).getFullYear() === currentYear;
      } catch (e) {
        return false;
      }
    });

    // Get completed anime with ratings
    const completedAnime = anime.filter(item => {
      const status = item.list_status?.status;
      const score = item.list_status?.score;
      return status === 'completed' && score && score > 0;
    });
    
    console.log('Filtered anime:', {
      thisYearCount: thisYearAnime.length,
      completedCount: completedAnime.length
    });

    // Calculate genres
    const genreCounts = {};
    anime.forEach(item => {
      item.node?.genres?.forEach(genre => {
        genreCounts[genre.name] = (genreCounts[genre.name] || 0) + 1;
      });
    });

    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Calculate studios
    const studioCounts = {};
    anime.forEach(item => {
      item.node?.studios?.forEach(studio => {
        studioCounts[studio.name] = (studioCounts[studio.name] || 0) + 1;
      });
    });

    const topStudios = Object.entries(studioCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Top rated shows
    const topRated = completedAnime
      .sort((a, b) => b.list_status.score - a.list_status.score)
      .slice(0, 5);

    // Hidden gems (high rating, low popularity)
    const hiddenGems = completedAnime
      .filter(item => {
        const score = item.list_status.score;
        const popularity = item.node?.num_list_users || 0;
        return score >= 8 && popularity < 100000;
      })
      .sort((a, b) => {
        if (b.list_status.score !== a.list_status.score) {
          return b.list_status.score - a.list_status.score;
        }
        return (a.node?.num_list_users || 0) - (b.node?.num_list_users || 0);
      })
      .slice(0, 5);

    // Watch time calculation
    const totalEpisodes = anime.reduce((sum, item) => 
      sum + (item.list_status?.num_episodes_watched || 0), 0
    );
    const avgEpisodeLength = 24; // minutes
    const totalMinutes = totalEpisodes * avgEpisodeLength;
    const totalHours = Math.floor(totalMinutes / 60);

    // Seasonal highlight - find most active season
    const seasonalCounts = {};
    thisYearAnime.forEach(item => {
      const finishDate = item.list_status?.finish_date;
      if (finishDate) {
        const date = new Date(finishDate);
        const month = date.getMonth();
        let season = 'Winter';
        if (month >= 2 && month <= 4) season = 'Spring';
        else if (month >= 5 && month <= 7) season = 'Summer';
        else if (month >= 8 && month <= 10) season = 'Fall';
        const key = `${season} ${date.getFullYear()}`;
        seasonalCounts[key] = (seasonalCounts[key] || 0) + 1;
      }
    });
    const topSeasonal = Object.entries(seasonalCounts)
      .sort((a, b) => b[1] - a[1])[0];

    // Get seasonal highlight anime
    let seasonalAnime = null;
    if (topSeasonal) {
      const [seasonYear, count] = topSeasonal;
      const [season] = seasonYear.split(' ');
      const seasonAnime = thisYearAnime
        .filter(item => {
          const finishDate = item.list_status?.finish_date;
          if (!finishDate) return false;
          const date = new Date(finishDate);
          const month = date.getMonth();
          let itemSeason = 'Winter';
          if (month >= 2 && month <= 4) itemSeason = 'Spring';
          else if (month >= 5 && month <= 7) itemSeason = 'Summer';
          else if (month >= 8 && month <= 10) itemSeason = 'Fall';
          return itemSeason === season;
        })
        .sort((a, b) => (b.node?.mean || 0) - (a.node?.mean || 0))[0];
      
      if (seasonAnime) {
        seasonalAnime = {
          ...seasonAnime,
          season: seasonYear,
          count: count
        };
      }
    }

    // Manga stats
    const completedManga = manga.filter(item => 
      item.list_status?.status === 'completed' && item.list_status?.score > 0
    );

    const topManga = completedManga
      .sort((a, b) => b.list_status.score - a.list_status.score)
      .slice(0, 5);

    // Manga authors
    const authorCounts = {};
    manga.forEach(item => {
      item.node?.authors?.forEach(author => {
        const name = `${author.node?.first_name || ''} ${author.node?.last_name || ''}`.trim();
        if (name) {
          authorCounts[name] = (authorCounts[name] || 0) + 1;
        }
      });
    });

    const topAuthors = Object.entries(authorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const statsData = {
      thisYearAnime: thisYearAnime.length > 0 ? thisYearAnime : [],
      totalAnime: anime.length,
      totalManga: manga.length,
      topGenres: topGenres.length > 0 ? topGenres : [],
      topStudios: topStudios.length > 0 ? topStudios : [],
      topRated: topRated.length > 0 ? topRated : [],
      hiddenGems: hiddenGems.length > 0 ? hiddenGems : [],
      watchTime: totalHours,
      completedCount: completedAnime.length,
      topManga: topManga.length > 0 ? topManga : [],
      topAuthors: topAuthors.length > 0 ? topAuthors : [],
      seasonalAnime: seasonalAnime || null,
    };
    
    console.log('Calculated stats:', {
      totalAnime: statsData.totalAnime,
      topRatedCount: statsData.topRated.length,
      topGenresCount: statsData.topGenres.length,
      topStudiosCount: statsData.topStudios.length,
      hiddenGemsCount: statsData.hiddenGems.length,
      sampleAnime: statsData.topRated.length > 0 ? statsData.topRated[0] : null
    });
    
    setStats(statsData);
  }


  function getRedirectUri() {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
    return origin + normalizedPath;
  }

  async function handleDownloadPNG() {
    if (!slideRef.current || typeof window === 'undefined') return;
    
    setIsCapturing(true);
    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(slideRef.current, {
        backgroundColor: '#101010',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });
      
      const link = document.createElement('a');
      link.download = `mal-wrapped-${username || 'user'}-slide-${currentSlide + 1}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error generating PNG:', err);
      alert('Failed to download image. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }

  async function handleBegin() {
    if (typeof window === 'undefined') {
      setError('This feature requires a browser environment');
      return;
    }

    if (!CLIENT_ID || CLIENT_ID === '<your_client_id_here>') {
      setError('CLIENT_ID is not configured. Please set NEXT_PUBLIC_MAL_CLIENT_ID in Vercel.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const verifier = generateCodeVerifier();
      localStorage.setItem('pkce_verifier', verifier);

      const challenge = await pkceChallenge(verifier);
      const redirectUri = getRedirectUri();

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
    if (!slide || !stats) return null;

    const SlideLayout = ({ children, verticalText }) => (
      <div className="w-full h-full relative px-4 py-2 md:p-8 flex flex-col items-center justify-center">
        {verticalText && (
          <p className="absolute top-1/2 -left-2 md:-left-2 -translate-y-1/2 text-[#9EFF00]/50 font-bold uppercase tracking-[.3em] [writing-mode:vertical-lr] text-base">
            {verticalText}
          </p>
        )}
        <div className="w-full">
          {children}
        </div>
      </div>
    );

    const RankedListItem = ({ item, rank }) => {
      const isTop = rank === 1;
      return (
        <div className={`flex items-center p-3 border-b-2 transition-all duration-300 hover:bg-white/5 ${isTop ? 'border-[#9EFF00] bg-[#9EFF00]/10' : 'border-white/10'}`}>
          <div className={`text-3xl font-bold w-12 shrink-0 ${isTop ? 'text-[#9EFF00]' : 'text-white/60'}`}>#{rank}</div>
          <div className="flex-grow flex items-center gap-4 min-w-0">
            <div className="flex-grow min-w-0">
              <p className="font-bold text-white text-xl truncate">{item.name}</p>
              <p className="text-base text-white/50">{item.count} entries</p>
            </div>
          </div>
          {isTop && <span className="text-yellow-300 text-2xl ml-3 shrink-0">★</span>}
        </div>
      );
    };

    const MediaCard = ({ item, rank }) => (
      <div className="flex flex-col group">
        <div className="bg-black/50 border border-white/10 rounded-lg overflow-hidden group aspect-[2/3] relative transition-all duration-300 hover:border-[#9EFF00]/50 hover:shadow-lg hover:shadow-[#9EFF00]/10">
          {rank && (
            <div className="absolute top-2 right-2 z-10 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold text-lg">
              {rank}
            </div>
          )}
          {item.coverImage && (
            <img src={item.coverImage} alt={item.title} crossOrigin="anonymous" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="mt-2">
          <h3 className="font-bold text-white truncate text-base">{item.title}</h3>
          <div className="flex items-center text-base text-yellow-300">
            <span className="mr-1">★</span>
            <span>{item.userRating?.toFixed(1) || 'N/A'}</span>
          </div>
        </div>
      </div>
    );

    switch (slide.id) {
      case 'welcome':
        return (
          <SlideLayout verticalText="INITIALIZE">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-medium uppercase text-white/80 animate-pop-in animation-delay-100">MyAnimeList Wrapped</h2>
              <h1 className="text-7xl md:text-9xl font-bold uppercase text-[#9EFF00] my-4 animate-pop-in animation-delay-200">2025</h1>
              <p className="text-2xl md:text-3xl text-white animate-pop-in animation-delay-300">A look back at your year, <span className="text-[#9EFF00]">{username || 'a'}</span>.</p>
            </div>
          </SlideLayout>
        );

      case 'anime_log':
        return (
          <SlideLayout verticalText="ANIME-LOG">
            <h1 className="relative z-10 text-[2.5rem] md:text-[3.25rem] leading-tight font-bold uppercase tracking-widest text-[#9EFF00] border-b-2 border-[#9EFF00] pb-2 px-2 inline-block animate-pop-in animation-delay-100">
              2025 Anime Log
            </h1>
            <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-white/80 mt-3 animate-pop-in animation-delay-200">
              A look at the series you completed this year.
            </h2>
            <div className="mt-8 text-center animate-pop-in animation-delay-400">
              <p className="text-9xl md:text-[10rem] font-bold text-white">{stats.thisYearAnime.length}</p>
              <p className="text-3xl font-medium uppercase text-[#9EFF00] mt-2">Anime Series Watched</p>
            </div>
          </SlideLayout>
        );

      case 'total_watch_time':
        return (
          <SlideLayout verticalText="TIME-ANALYSIS">
            <h1 className="relative z-10 text-[2.5rem] md:text-[3.25rem] leading-tight font-bold uppercase tracking-widest text-[#9EFF00] border-b-2 border-[#9EFF00] pb-2 px-2 inline-block animate-pop-in animation-delay-100">
              Total Watch Time
            </h1>
            <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-white/80 mt-3 animate-pop-in animation-delay-200">
              How much time you spent in other worlds.
            </h2>
            <div className="mt-8 text-center animate-pop-in animation-delay-400">
              <p className="text-9xl md:text-[10rem] font-bold text-white">{stats.watchTime}</p>
              <p className="text-3xl font-medium uppercase text-[#9EFF00] mt-2">Hours of Anime Watched</p>
            </div>
          </SlideLayout>
        );

      case 'top_genres':
        return (
          <SlideLayout verticalText="GENRE-MATRIX">
            <h1 className="relative z-10 text-[2.5rem] md:text-[3.25rem] leading-tight font-bold uppercase tracking-widest text-[#9EFF00] border-b-2 border-[#9EFF00] pb-2 px-2 inline-block animate-pop-in animation-delay-100">
              Your Top Genres
            </h1>
            <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-white/80 mt-3 animate-pop-in animation-delay-200">
              The genres you explored the most.
            </h2>
            {stats.topGenres && stats.topGenres.length > 0 ? (
              <div className="mt-8 space-y-1 stagger-children">
                {stats.topGenres.map(([genre, count], idx) => (
                  <RankedListItem key={genre} item={{ name: genre, count }} rank={idx + 1} />
                ))}
              </div>
            ) : (
              <div className="mt-8 text-center text-white/50">No genre data available</div>
            )}
          </SlideLayout>
        );

      case 'favorite_anime':
        const topAnime = stats.topRated.slice(0, 5).map(item => ({
          id: item.node.id,
          title: item.node.title,
          coverImage: item.node.main_picture?.large || item.node.main_picture?.medium || '',
          userRating: item.list_status.score,
          studio: item.node.studios?.[0]?.name || '',
          genres: item.node.genres?.map(g => g.name) || []
        }));
        return (
          <SlideLayout verticalText="TOP-SELECTION">
            <h1 className="relative z-10 text-[2.5rem] md:text-[3.25rem] leading-tight font-bold uppercase tracking-widest text-[#9EFF00] border-b-2 border-[#9EFF00] pb-2 px-2 inline-block animate-pop-in animation-delay-100">
              Your Favorite Anime
            </h1>
            <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-white/80 mt-3 animate-pop-in animation-delay-200">
              The series you rated the highest.
            </h2>
            {topAnime && topAnime.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2 w-full justify-center stagger-children">
                {(() => {
                  const [featured, ...others] = topAnime;
                  return (
                    <>
                      <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden group transition-all duration-300 hover:border-[#9EFF00]/50 flex flex-row relative">
                        <div className="absolute top-2.5 right-2.5 z-10 w-9 h-9 bg-black text-white rounded-full flex items-center justify-center font-bold text-xl">1</div>
                        <div className="w-32 md:w-40 flex-shrink-0 aspect-[2/3] bg-black/50">
                          {featured.coverImage && (
                            <img src={featured.coverImage} crossOrigin="anonymous" alt={featured.title} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="p-3 flex flex-col justify-center flex-grow min-w-0">
                          <p className="text-base uppercase tracking-widest text-[#9EFF00] font-bold">#1 Favorite</p>
                          <h3 className="font-bold text-white text-lg md:text-2xl mt-1 leading-tight truncate">{featured.title}</h3>
                          {featured.studio && <p className="text-base md:text-lg text-[#9EFF00] truncate">{featured.studio}</p>}
                          <div className="flex items-center text-lg md:text-xl text-yellow-300 mt-2">
                            <span className="mr-2">★</span>
                            <span>{featured.userRating.toFixed(1)} / 10</span>
                          </div>
                          {featured.genres.length > 0 && (
                            <div className="mt-2 md:mt-3 flex flex-wrap gap-2">
                              {featured.genres.slice(0, 2).map(g => (
                                <span key={g} className="text-base uppercase tracking-wider bg-white/10 text-white/80 px-2 py-1 rounded">{g}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {others.length > 0 && (
                        <div className="grid grid-cols-4 gap-2 md:gap-3">
                          {others.map((anime, index) => (
                            <div key={anime.id}>
                              <div className="bg-black/50 border border-white/10 rounded-lg overflow-hidden group aspect-[4/5] relative transition-all duration-300 hover:border-[#9EFF00]/50">
                                <div className="absolute top-1.5 right-1.5 z-10 w-7 h-7 bg-black text-white rounded-full flex items-center justify-center font-bold text-base">{index + 2}</div>
                                {anime.coverImage && (
                                  <img src={anime.coverImage} alt={anime.title} crossOrigin="anonymous" className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="mt-1.5">
                                <h3 className="font-bold text-white truncate text-base leading-tight">{anime.title}</h3>
                                <div className="flex items-center text-base text-yellow-300">
                                  <span className="mr-1 shrink-0">★</span>
                                  <span>{anime.userRating.toFixed(1)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="mt-8 text-center text-white/50">No rated anime found. Rate some anime to see your favorites here!</div>
            )}
          </SlideLayout>
        );

      case 'top_studios':
        return (
          <SlideLayout verticalText="PRODUCTION">
            <h1 className="relative z-10 text-[2.5rem] md:text-[3.25rem] leading-tight font-bold uppercase tracking-widest text-[#9EFF00] border-b-2 border-[#9EFF00] pb-2 px-2 inline-block animate-pop-in animation-delay-100">
              Top Animation Studios
            </h1>
            <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-white/80 mt-3 animate-pop-in animation-delay-200">
              The studios that brought your favorites to life.
            </h2>
            {stats.topStudios && stats.topStudios.length > 0 ? (
              <div className="mt-8 space-y-1 stagger-children">
                {stats.topStudios.map(([studio, count], idx) => (
                  <RankedListItem key={studio} item={{ name: studio, count }} rank={idx + 1} />
                ))}
              </div>
            ) : (
              <div className="mt-8 text-center text-white/50">No studio data available</div>
            )}
          </SlideLayout>
        );

      case 'seasonal_highlight':
        const seasonalItem = stats.seasonalAnime ? {
          id: stats.seasonalAnime.node.id,
          title: stats.seasonalAnime.node.title,
          coverImage: stats.seasonalAnime.node.main_picture?.large || stats.seasonalAnime.node.main_picture?.medium || '',
          userRating: stats.seasonalAnime.node.mean || 0,
          studio: stats.seasonalAnime.node.studios?.[0]?.name || '',
          season: stats.seasonalAnime.season || ''
        } : null;
        return (
          <SlideLayout verticalText="HIGHLIGHT">
            <h1 className="relative z-10 text-[2.5rem] md:text-[3.25rem] leading-tight font-bold uppercase tracking-widest text-[#9EFF00] border-b-2 border-[#9EFF00] pb-2 px-2 inline-block animate-pop-in animation-delay-100">
              Seasonal Highlight
            </h1>
            <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-white/80 mt-3 animate-pop-in animation-delay-200">
              The top-rated show from a single season.
            </h2>
            {seasonalItem ? (
              <div className="mt-8 flex flex-col md:flex-row items-center gap-4 md:gap-8 stagger-children">
                <div className="w-36 md:w-52 shrink-0">
                  <MediaCard item={seasonalItem} />
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-3xl md:text-4xl font-bold text-white">{seasonalItem.title}</h3>
                  {seasonalItem.studio && <p className="text-xl md:text-2xl text-[#9EFF00] mt-1">{seasonalItem.studio}</p>}
                  {seasonalItem.season && <p className="text-lg md:text-xl text-white/70 mt-4">{seasonalItem.season}</p>}
                  <div className="flex items-center justify-center md:justify-start text-2xl md:text-3xl text-yellow-300 mt-2">
                    <span className="mr-2">★</span>
                    <span>{seasonalItem.userRating.toFixed(1)} / 10</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 text-center text-white/50">No seasonal data available</div>
            )}
          </SlideLayout>
        );

      case 'hidden_gems':
        const gems = stats.hiddenGems.slice(0, 3).map(item => ({
          id: item.node.id,
          title: item.node.title,
          coverImage: item.node.main_picture?.large || item.node.main_picture?.medium || '',
          userRating: item.list_status.score
        }));
        return (
          <SlideLayout verticalText="DEEP-CUTS">
            <h1 className="relative z-10 text-[2.5rem] md:text-[3.25rem] leading-tight font-bold uppercase tracking-widest text-[#9EFF00] border-b-2 border-[#9EFF00] pb-2 px-2 inline-block animate-pop-in animation-delay-100">
              Hidden Gems
            </h1>
            <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-white/80 mt-3 animate-pop-in animation-delay-200">
              Popularity-wise, these were deep cuts.
            </h2>
            {gems.length > 0 ? (
              <div className="mt-8 grid grid-cols-3 gap-3 md:gap-4 stagger-children">
                {gems.map((anime) => <MediaCard key={anime.id} item={anime} />)}
              </div>
            ) : (
              <div className="mt-8 text-center text-white/50">No hidden gems found</div>
            )}
          </SlideLayout>
        );

      case 'manga_log':
        return (
          <SlideLayout verticalText="MANGA-LOG">
            <h1 className="relative z-10 text-[2.5rem] md:text-[3.25rem] leading-tight font-bold uppercase tracking-widest text-[#9EFF00] border-b-2 border-[#9EFF00] pb-2 px-2 inline-block animate-pop-in animation-delay-100">
              2025 Manga Log
            </h1>
            <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-white/80 mt-3 animate-pop-in animation-delay-200">
              You didn't just watch, you read.
            </h2>
            <div className="mt-8 text-center animate-pop-in animation-delay-400">
              <p className="text-9xl md:text-[10rem] font-bold text-white">{stats.totalManga}</p>
              <p className="text-3xl font-medium uppercase text-[#9EFF00] mt-2">Manga Read</p>
            </div>
          </SlideLayout>
        );

      case 'favorite_manga':
        const topManga = stats.topManga.slice(0, 5).map(item => ({
          id: item.node.id,
          title: item.node.title,
          coverImage: item.node.main_picture?.large || item.node.main_picture?.medium || '',
          userRating: item.list_status.score,
          author: item.node.authors?.[0] ? `${item.node.authors[0].node?.first_name || ''} ${item.node.authors[0].node?.last_name || ''}`.trim() : '',
          genres: item.node.genres?.map(g => g.name) || []
        }));
        return (
          <SlideLayout verticalText="TOP-SELECTION">
            <h1 className="relative z-10 text-[2.5rem] md:text-[3.25rem] leading-tight font-bold uppercase tracking-widest text-[#9EFF00] border-b-2 border-[#9EFF00] pb-2 px-2 inline-block animate-pop-in animation-delay-100">
              Your Favorite Manga
            </h1>
            <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-white/80 mt-3 animate-pop-in animation-delay-200">
              The manga you rated the highest.
            </h2>
            {topManga && topManga.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2 w-full justify-center stagger-children">
                {(() => {
                  const [featured, ...others] = topManga;
                  return (
                    <>
                      <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden group transition-all duration-300 hover:border-[#9EFF00]/50 flex flex-row relative">
                        <div className="absolute top-2.5 right-2.5 z-10 w-9 h-9 bg-black text-white rounded-full flex items-center justify-center font-bold text-xl">1</div>
                        <div className="w-32 md:w-40 flex-shrink-0 aspect-[2/3] bg-black/50">
                          {featured.coverImage && (
                            <img src={featured.coverImage} crossOrigin="anonymous" alt={featured.title} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="p-3 flex flex-col justify-center flex-grow min-w-0">
                          <p className="text-base uppercase tracking-widest text-[#9EFF00] font-bold">#1 Favorite</p>
                          <h3 className="font-bold text-white text-lg md:text-2xl mt-1 leading-tight truncate">{featured.title}</h3>
                          {featured.author && <p className="text-base md:text-lg text-[#9EFF00] truncate">{featured.author}</p>}
                          <div className="flex items-center text-lg md:text-xl text-yellow-300 mt-2">
                            <span className="mr-2">★</span>
                            <span>{featured.userRating.toFixed(1)} / 10</span>
                          </div>
                          {featured.genres.length > 0 && (
                            <div className="mt-2 md:mt-3 flex flex-wrap gap-2">
                              {featured.genres.slice(0, 2).map(g => (
                                <span key={g} className="text-base uppercase tracking-wider bg-white/10 text-white/80 px-2 py-1 rounded">{g}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {others.length > 0 && (
                        <div className="grid grid-cols-4 gap-2 md:gap-3">
                          {others.map((manga, index) => (
                            <div key={manga.id}>
                              <div className="bg-black/50 border border-white/10 rounded-lg overflow-hidden group aspect-[4/5] relative transition-all duration-300 hover:border-[#9EFF00]/50">
                                <div className="absolute top-1.5 right-1.5 z-10 w-7 h-7 bg-black text-white rounded-full flex items-center justify-center font-bold text-base">{index + 2}</div>
                                {manga.coverImage && (
                                  <img src={manga.coverImage} alt={manga.title} crossOrigin="anonymous" className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="mt-1.5">
                                <h3 className="font-bold text-white truncate text-base leading-tight">{manga.title}</h3>
                                <div className="flex items-center text-base text-yellow-300">
                                  <span className="mr-1 shrink-0">★</span>
                                  <span>{manga.userRating.toFixed(1)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="mt-8 text-center text-white/50">No rated manga found. Rate some manga to see your favorites here!</div>
            )}
          </SlideLayout>
        );

      case 'top_authors':
        return (
          <SlideLayout verticalText="CREATORS">
            <h1 className="relative z-10 text-[2.5rem] md:text-[3.25rem] leading-tight font-bold uppercase tracking-widest text-[#9EFF00] border-b-2 border-[#9EFF00] pb-2 px-2 inline-block animate-pop-in animation-delay-100">
              Top Manga Authors
            </h1>
            <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-white/80 mt-3 animate-pop-in animation-delay-200">
              The authors whose work you read most.
            </h2>
            {stats.topAuthors && stats.topAuthors.length > 0 ? (
              <div className="mt-8 space-y-1 stagger-children">
                {stats.topAuthors.map(([author, count], idx) => (
                  <RankedListItem key={author} item={{ name: author, count }} rank={idx + 1} />
                ))}
              </div>
            ) : (
              <div className="mt-8 text-center text-white/50">No author data available</div>
            )}
          </SlideLayout>
        );

      case 'finale':
        return (
          <SlideLayout verticalText="FINAL-REPORT">
            <h1 className="relative z-10 text-[2.5rem] md:text-[3.25rem] leading-tight font-bold uppercase tracking-widest text-[#9EFF00] border-b-2 border-[#9EFF00] pb-2 px-2 inline-block animate-pop-in animation-delay-100">
              Year In Review
            </h1>
            <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-white/80 mt-3 animate-pop-in animation-delay-200">
              Your complete 2025 stats.
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-2 md:gap-3 text-white stagger-children">
              <div className="border border-white/20 p-2 rounded-lg col-span-1 flex flex-col">
                <h3 className="text-base font-bold uppercase text-[#9EFF00] mb-2 shrink-0">Top Anime</h3>
                <div className="space-y-1.5 min-h-0">
                  {stats.topRated.slice(0, 4).map((a, i) => (
                    <p key={a.node.id} className="bg-white/5 py-1 px-2 rounded truncate text-base">
                      <span className="font-bold text-white/50 w-6 inline-block">{i+1}.</span>{a.node.title}
                    </p>
                  ))}
                </div>
              </div>
              <div className="border border-white/20 p-2 rounded-lg col-span-1 flex flex-col">
                <h3 className="text-base font-bold uppercase text-[#9EFF00] mb-2 shrink-0">Top Manga</h3>
                <div className="space-y-1.5 min-h-0">
                  {stats.topManga.slice(0, 4).map((m, i) => (
                    <p key={m.node.id} className="bg-white/5 py-1 px-2 rounded truncate text-base">
                      <span className="font-bold text-white/50 w-6 inline-block">{i+1}.</span>{m.node.title}
                    </p>
                  ))}
                </div>
              </div>
              <div className="border border-white/20 p-3 rounded-lg col-span-1">
                <p className="text-base uppercase text-white/70">Time Spent</p>
                <p className="text-lg md:text-xl font-bold text-white">{stats.watchTime} Hours</p>
              </div>
              <div className="border border-white/20 p-3 rounded-lg col-span-1">
                <p className="text-base uppercase text-white/70">Favorite Studio</p>
                <p className="text-lg md:text-xl font-bold text-white truncate">{stats.topStudios?.[0]?.[0] || 'N/A'}</p>
              </div>
              <div className="border border-white/20 p-3 rounded-lg col-span-2">
                <p className="text-base uppercase text-white/70">Favorite Author</p>
                <p className="text-lg md:text-xl font-bold text-white truncate">{stats.topAuthors?.[0]?.[0] || 'N/A'}</p>
              </div>
            </div>
          </SlideLayout>
        );

      default:
        return null;
    }
  }

  return (
    <main className="bg-[#0A0A0A] text-white h-screen flex items-center justify-center p-2 selection:bg-[#9EFF00] selection:text-black relative overflow-hidden moving-grid-bg">
      <div ref={slideRef} className={`w-full max-w-5xl h-full bg-[#101010] border-2 border-white/10 rounded-xl shadow-2xl shadow-black/50 flex flex-col justify-center relative overflow-hidden ${isCapturing ? 'capturing' : ''}`}>
        <div className="z-10 w-full h-full flex flex-col items-center justify-center">
          {error && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg z-50">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="text-center">
              <div className="animate-pulse-fast text-[#9EFF00] mb-4 text-4xl">*</div>
              <h1 className="text-3xl text-white uppercase tracking-widest">{loadingProgress || 'Generating your report...'}</h1>
            </div>
          )}

          {!isAuthenticated && !isLoading && (
            <div className="text-center p-4">
              <div className="mb-4 animate-pop-in text-[#9EFF00] text-4xl">*</div>
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold uppercase tracking-wider text-[#9EFF00] animate-pop-in animation-delay-100">MyAnimeList</h1>
              <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold uppercase tracking-wider text-white animate-pop-in animation-delay-200">Wrapped 2025</h2>
              <p className="mt-4 text-lg text-white/70 max-w-md mx-auto animate-pop-in animation-delay-300">Enter your MyAnimeList username to see your year in review.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center animate-pop-in animation-delay-400">
                <button
                  onClick={handleBegin}
                  className="bg-[#9EFF00] text-black font-bold uppercase text-lg px-8 py-3 rounded-md hover:bg-white transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!CLIENT_ID || CLIENT_ID === '<your_client_id_here>'}
                >
                  Connect with MAL
                </button>
              </div>
            </div>
          )}

          {isAuthenticated && stats && slides.length > 0 && (
            <div className="w-full h-full flex flex-col">
              {/* Top Bar */}
              <div className="flex-shrink-0 px-4 md:px-8 pt-4 flex items-center justify-between gap-4">
                <div className="flex-grow flex items-center gap-2">
                  {slides.map((_, i) => {
                    const isCompleted = i < currentSlide;
                    const isActive = i === currentSlide;
                    return (
                      <div key={i} className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ease-out ${isActive ? 'bg-[#9EFF00]' : 'bg-white/50'}`} 
                          style={{ width: (isCompleted || isActive) ? '100%' : '0%' }} 
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex-shrink-0 flex items-center gap-2 md:gap-4">
                  <button onClick={handleDownloadPNG} className="p-2 md:p-3 text-white rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 transition" title="Download Slide">
                    <Download className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>
              </div>
              
              {/* Slide Content */}
              <div key={currentSlide} className={`w-full flex-grow flex items-center justify-center overflow-hidden py-2 ${!isCapturing && 'animate-pop-in'}`}>
                <SlideContent slide={slides[currentSlide]} />
              </div>
              
              {/* Bottom Controls */}
              <div className="flex-shrink-0 w-full px-4 md:px-6 pb-4 flex items-center justify-between">
                <button onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0} className="p-2 md:p-3 text-white rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 disabled:opacity-30 transition">
                  <ChevronLeft className="w-6 h-6"/>
                </button>
                
                <p className="text-white/50 text-base font-mono py-2 px-4 rounded-full bg-black/30 backdrop-blur-sm">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</p>

                {currentSlide === slides.length - 1 ? (
                  <button onClick={() => { setCurrentSlide(0); setIsAuthenticated(false); setStats(null); }} className="bg-[#9EFF00] text-black font-bold uppercase px-4 md:px-6 py-2 md:py-3 rounded-full hover:bg-white transition-colors duration-300 text-base animate-pop-in">
                    Restart
                  </button>
                ) : (
                  <button onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} className="p-2 md:p-3 text-white rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 transition">
                    <ChevronRight className="w-6 h-6"/>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
