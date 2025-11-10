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

  async function handleDownloadPNG() {
    if (!slideRef.current || typeof window === 'undefined') return;
    
    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(slideRef.current, {
        backgroundColor: '#000000',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });
      
      const link = document.createElement('a');
      link.download = `mal-wrapped-${slides[currentSlide].id}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error generating PNG:', err);
      alert('Failed to download image. Please try again.');
    }
  }

  function getRedirectUri() {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
    return origin + normalizedPath;
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

    switch (slide.id) {
      case 'welcome':
        return (
          <div ref={slideRef} className="slide-container">
            <div className="progress-bar">
              {slides.map((_, idx) => (
                <div key={idx} className={`progress-dash ${idx === currentSlide ? 'active' : ''}`} />
              ))}
            </div>
            <button className="download-btn" onClick={handleDownloadPNG}>
              <Download size={20} />
            </button>
            <div className="slide-content welcome-slide">
              <h1 className="main-title">MYANIMELIST WRAPPED</h1>
              <div className="year-display">2025</div>
              <p className="subtitle">A look back at your year, <span className="highlight">a.</span></p>
            </div>
            <div className="slide-nav">
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
                <ChevronLeft size={24} />
              </button>
              <span className="slide-counter">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        );

      case 'anime_log':
        return (
          <div ref={slideRef} className="slide-container">
            <div className="progress-bar">
              {slides.map((_, idx) => (
                <div key={idx} className={`progress-dash ${idx === currentSlide ? 'active' : ''}`} />
              ))}
            </div>
            <button className="download-btn" onClick={handleDownloadPNG}>
              <Download size={20} />
            </button>
            <div className="slide-content">
              <h2 className="section-title">2025 ANIME LOG</h2>
              <div className="title-underline"></div>
              <p className="section-subtitle">A LOOK AT THE SERIES YOU COMPLETED THIS YEAR.</p>
              <div className="stat-number">{stats.thisYearAnime.length}</div>
              <div className="stat-label">ANIME SERIES WATCHED</div>
            </div>
            <div className="slide-nav">
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
                <ChevronLeft size={24} />
              </button>
              <span className="slide-counter">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        );

      case 'total_watch_time':
        return (
          <div ref={slideRef} className="slide-container">
            <div className="progress-bar">
              {slides.map((_, idx) => (
                <div key={idx} className={`progress-dash ${idx === currentSlide ? 'active' : ''}`} />
              ))}
            </div>
            <button className="download-btn" onClick={handleDownloadPNG}>
              <Download size={20} />
            </button>
            <div className="slide-content">
              <h2 className="section-title">TOTAL WATCH TIME</h2>
              <div className="title-underline"></div>
              <p className="section-subtitle">HOW MUCH TIME YOU SPENT IN OTHER WORLDS.</p>
              <div className="stat-number">{stats.watchTime}</div>
              <div className="stat-label">HOURS OF ANIME WATCHED</div>
            </div>
            <div className="slide-nav">
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
                <ChevronLeft size={24} />
              </button>
              <span className="slide-counter">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        );

      case 'top_genres':
        return (
          <div ref={slideRef} className="slide-container">
            <div className="progress-bar">
              {slides.map((_, idx) => (
                <div key={idx} className={`progress-dash ${idx === currentSlide ? 'active' : ''}`} />
              ))}
            </div>
            <button className="download-btn" onClick={handleDownloadPNG}>
              <Download size={20} />
            </button>
            <div className="slide-content">
              <h2 className="section-title">YOUR TOP GENRES</h2>
              <div className="title-underline"></div>
              <p className="section-subtitle">THE GENRES YOU EXPLORED THE MOST.</p>
              {stats.topGenres && stats.topGenres.length > 0 ? (
                <div className="ranked-list">
                  {stats.topGenres.map(([genre, count], idx) => (
                    <div key={genre} className={`ranked-item ${idx === 0 ? 'highlighted' : ''}`}>
                      <span className="rank-number">#{idx + 1}</span>
                      <span className="rank-name">{genre}</span>
                      <span className="rank-count">{count} entries</span>
                      {idx === 0 && <span className="star-icon">★</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">No genre data available</div>
              )}
            </div>
            <div className="slide-nav">
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
                <ChevronLeft size={24} />
              </button>
              <span className="slide-counter">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        );

      case 'favorite_anime':
        const topAnime = stats.topRated.slice(0, 5);
        return (
          <div ref={slideRef} className="slide-container">
            <div className="progress-bar">
              {slides.map((_, idx) => (
                <div key={idx} className={`progress-dash ${idx === currentSlide ? 'active' : ''}`} />
              ))}
            </div>
            <button className="download-btn" onClick={handleDownloadPNG}>
              <Download size={20} />
            </button>
            <div className="slide-content">
              <h2 className="section-title">YOUR FAVORITE ANIME</h2>
              <div className="title-underline"></div>
              <p className="section-subtitle">THE SERIES YOU RATED THE HIGHEST.</p>
              {topAnime && topAnime.length > 0 ? (
                <>
                  <div className="featured-card">
                    <div className="featured-image">
                      {topAnime[0]?.node?.main_picture?.large && (
                        <img src={topAnime[0].node.main_picture.large} alt={topAnime[0].node.title || 'Anime'} />
                      )}
                      {!topAnime[0]?.node?.main_picture?.large && (
                        <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="featured-content">
                      <div className="featured-tag">#1 FAVORITE</div>
                      <div className="featured-title">{topAnime[0].node?.title || 'Unknown'}</div>
                      {topAnime[0].node?.studios?.[0] && (
                        <div className="featured-studio">{topAnime[0].node.studios[0].name}</div>
                      )}
                      <div className="featured-rating">
                        <span className="star">★</span> {topAnime[0].list_status?.score || 'N/A'}/10
                      </div>
                      {topAnime[0].node?.genres && topAnime[0].node.genres.length > 0 && (
                        <div className="featured-genres">
                          {topAnime[0].node.genres.slice(0, 2).map(genre => (
                            <span key={genre.name} className="genre-tag">{genre.name.toUpperCase()}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rank-badge">1</div>
                  </div>
                  {topAnime.length > 1 && (
                    <div className="anime-grid">
                      {topAnime.slice(1, 5).map((item, idx) => (
                        <div key={item.node?.id || idx} className="anime-card">
                          {item.node?.main_picture?.medium ? (
                            <img src={item.node.main_picture.medium} alt={item.node.title || 'Anime'} />
                          ) : (
                            <div style={{ width: '100%', aspectRatio: '2/3', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.75rem' }}>
                              No Image
                            </div>
                          )}
                          <div className="anime-title">{item.node?.title || 'Unknown'}</div>
                          <div className="anime-rating">
                            <span className="star">★</span> {item.list_status?.score || 'N/A'}
                          </div>
                          <div className="rank-badge-small">{idx + 2}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="no-data">No rated anime found. Rate some anime to see your favorites here!</div>
              )}
            </div>
            <div className="slide-nav">
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
                <ChevronLeft size={24} />
              </button>
              <span className="slide-counter">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        );

      case 'top_studios':
        return (
          <div ref={slideRef} className="slide-container">
            <div className="progress-bar">
              {slides.map((_, idx) => (
                <div key={idx} className={`progress-dash ${idx === currentSlide ? 'active' : ''}`} />
              ))}
            </div>
            <button className="download-btn" onClick={handleDownloadPNG}>
              <Download size={20} />
            </button>
            <div className="slide-content">
              <h2 className="section-title">TOP ANIMATION STUDIOS</h2>
              <div className="title-underline"></div>
              <p className="section-subtitle">THE STUDIOS THAT BROUGHT YOUR FAVORITES TO LIFE.</p>
              {stats.topStudios && stats.topStudios.length > 0 ? (
                <div className="ranked-list">
                  {stats.topStudios.map(([studio, count], idx) => (
                    <div key={studio} className={`ranked-item ${idx === 0 ? 'highlighted' : ''}`}>
                      <span className="rank-number">#{idx + 1}</span>
                      <span className="rank-name">{studio}</span>
                      <span className="rank-count">{count} entries</span>
                      {idx === 0 && <span className="star-icon">★</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">No studio data available</div>
              )}
            </div>
            <div className="slide-nav">
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
                <ChevronLeft size={24} />
              </button>
              <span className="slide-counter">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        );

      case 'seasonal_highlight':
        return (
          <div ref={slideRef} className="slide-container">
            <div className="progress-bar">
              {slides.map((_, idx) => (
                <div key={idx} className={`progress-dash ${idx === currentSlide ? 'active' : ''}`} />
              ))}
            </div>
            <button className="download-btn" onClick={handleDownloadPNG}>
              <Download size={20} />
            </button>
            <div className="slide-content">
              <h2 className="section-title">SEASONAL HIGHLIGHT</h2>
              <div className="title-underline"></div>
              <p className="section-subtitle">THE TOP-RATED SHOW FROM A SINGLE SEASON.</p>
              {stats.seasonalAnime ? (
                <div className="seasonal-featured">
                  <div className="seasonal-image">
                    {stats.seasonalAnime.node.main_picture?.large && (
                      <img src={stats.seasonalAnime.node.main_picture.large} alt={stats.seasonalAnime.node.title} />
                    )}
                  </div>
                  <div className="seasonal-content">
                    <div className="seasonal-title">{stats.seasonalAnime.node.title}</div>
                    {stats.seasonalAnime.node.studios?.[0] && (
                      <div className="seasonal-studio">{stats.seasonalAnime.node.studios[0].name}</div>
                    )}
                    <div className="seasonal-season">{stats.seasonalAnime.season}</div>
                    <div className="seasonal-rating">
                      <span className="star">★</span> {stats.seasonalAnime.node.mean?.toFixed(1) || 'N/A'} / 10
                    </div>
                  </div>
                </div>
              ) : (
                <div className="no-data">No seasonal data available</div>
              )}
            </div>
            <div className="slide-nav">
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
                <ChevronLeft size={24} />
              </button>
              <span className="slide-counter">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        );

      case 'hidden_gems':
        return (
          <div ref={slideRef} className="slide-container">
            <div className="progress-bar">
              {slides.map((_, idx) => (
                <div key={idx} className={`progress-dash ${idx === currentSlide ? 'active' : ''}`} />
              ))}
            </div>
            <button className="download-btn" onClick={handleDownloadPNG}>
              <Download size={20} />
            </button>
            <div className="slide-content">
              <h2 className="section-title">HIDDEN GEMS</h2>
              <div className="title-underline"></div>
              <p className="section-subtitle">POPULARITY-WISE, THESE WERE DEEP CUTS.</p>
              {stats.hiddenGems.length > 0 ? (
                <div className="gems-grid">
                  {stats.hiddenGems.slice(0, 3).map((item) => (
                    <div key={item.node.id} className="gem-card">
                      {item.node.main_picture?.large && (
                        <img src={item.node.main_picture.large} alt={item.node.title} />
                      )}
                      <div className="gem-title">{item.node.title}</div>
                      <div className="gem-rating">
                        <span className="star">★</span> {item.list_status.score}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">No hidden gems found</div>
              )}
            </div>
            <div className="slide-nav">
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
                <ChevronLeft size={24} />
              </button>
              <span className="slide-counter">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        );

      case 'manga_log':
        return (
          <div ref={slideRef} className="slide-container">
            <div className="progress-bar">
              {slides.map((_, idx) => (
                <div key={idx} className={`progress-dash ${idx === currentSlide ? 'active' : ''}`} />
              ))}
            </div>
            <button className="download-btn" onClick={handleDownloadPNG}>
              <Download size={20} />
            </button>
            <div className="slide-content">
              <h2 className="section-title">2025 MANGA LOG</h2>
              <div className="title-underline"></div>
              <p className="section-subtitle">YOU DIDN'T JUST WATCH, YOU READ.</p>
              <div className="stat-number">{stats.totalManga}</div>
              <div className="stat-label">MANGA READ</div>
            </div>
            <div className="slide-nav">
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
                <ChevronLeft size={24} />
              </button>
              <span className="slide-counter">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        );

      case 'favorite_manga':
        return (
          <div ref={slideRef} className="slide-container">
            <div className="progress-bar">
              {slides.map((_, idx) => (
                <div key={idx} className={`progress-dash ${idx === currentSlide ? 'active' : ''}`} />
              ))}
            </div>
            <button className="download-btn" onClick={handleDownloadPNG}>
              <Download size={20} />
            </button>
            <div className="slide-content">
              <h2 className="section-title">YOUR FAVORITE MANGA</h2>
              <div className="title-underline"></div>
              <p className="section-subtitle">THE MANGA YOU RATED THE HIGHEST.</p>
              {stats.topManga && stats.topManga.length > 0 ? (
                <>
                  <div className="featured-card">
                    <div className="featured-image">
                      {stats.topManga[0]?.node?.main_picture?.large && (
                        <img src={stats.topManga[0].node.main_picture.large} alt={stats.topManga[0].node.title || 'Manga'} />
                      )}
                      {!stats.topManga[0]?.node?.main_picture?.large && (
                        <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="featured-content">
                      <div className="featured-tag">#1 FAVORITE</div>
                      <div className="featured-title">{stats.topManga[0].node?.title || 'Unknown'}</div>
                      {stats.topManga[0].node?.authors?.[0] && (
                        <div className="featured-studio">
                          {stats.topManga[0].node.authors[0].node?.first_name} {stats.topManga[0].node.authors[0].node?.last_name}
                        </div>
                      )}
                      <div className="featured-rating">
                        <span className="star">★</span> {stats.topManga[0].list_status?.score || 'N/A'}/10
                      </div>
                      {stats.topManga[0].node?.genres && stats.topManga[0].node.genres.length > 0 && (
                        <div className="featured-genres">
                          {stats.topManga[0].node.genres.slice(0, 2).map(genre => (
                            <span key={genre.name} className="genre-tag">{genre.name.toUpperCase()}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rank-badge">1</div>
                  </div>
                  {stats.topManga.length > 1 && (
                    <div className="anime-grid">
                      {stats.topManga.slice(1, 5).map((item, idx) => (
                        <div key={item.node?.id || idx} className="anime-card">
                          {item.node?.main_picture?.medium ? (
                            <img src={item.node.main_picture.medium} alt={item.node.title || 'Manga'} />
                          ) : (
                            <div style={{ width: '100%', aspectRatio: '2/3', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.75rem' }}>
                              No Image
                            </div>
                          )}
                          <div className="anime-title">{item.node?.title || 'Unknown'}</div>
                          <div className="anime-rating">
                            <span className="star">★</span> {item.list_status?.score || 'N/A'}
                          </div>
                          <div className="rank-badge-small">{idx + 2}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="no-data">No rated manga found. Rate some manga to see your favorites here!</div>
              )}
            </div>
            <div className="slide-nav">
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
                <ChevronLeft size={24} />
              </button>
              <span className="slide-counter">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        );

      case 'top_authors':
        return (
          <div ref={slideRef} className="slide-container">
            <div className="progress-bar">
              {slides.map((_, idx) => (
                <div key={idx} className={`progress-dash ${idx === currentSlide ? 'active' : ''}`} />
              ))}
            </div>
            <button className="download-btn" onClick={handleDownloadPNG}>
              <Download size={20} />
            </button>
            <div className="slide-content">
              <h2 className="section-title">TOP MANGA AUTHORS</h2>
              <div className="title-underline"></div>
              <p className="section-subtitle">THE AUTHORS WHOSE WORK YOU READ MOST.</p>
              {stats.topAuthors && stats.topAuthors.length > 0 ? (
                <div className="ranked-list">
                  {stats.topAuthors.map(([author, count], idx) => (
                    <div key={author} className={`ranked-item ${idx === 0 ? 'highlighted' : ''}`}>
                      <span className="rank-number">#{idx + 1}</span>
                      <span className="rank-name">{author}</span>
                      <span className="rank-count">{count} entries</span>
                      {idx === 0 && <span className="star-icon">★</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">No author data available</div>
              )}
            </div>
            <div className="slide-nav">
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
                <ChevronLeft size={24} />
              </button>
              <span className="slide-counter">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))} disabled={currentSlide === slides.length - 1}>
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        );

      case 'finale':
        return (
          <div ref={slideRef} className="slide-container">
            <div className="progress-bar">
              {slides.map((_, idx) => (
                <div key={idx} className={`progress-dash ${idx === currentSlide ? 'active' : ''}`} />
              ))}
            </div>
            <button className="download-btn" onClick={handleDownloadPNG}>
              <Download size={20} />
            </button>
            <div className="slide-content finale-slide">
              <h1 className="main-title">THANK YOU</h1>
              <div className="year-display">2025</div>
              <p className="subtitle">Thanks for using MAL Wrapped!</p>
              <p className="finale-text">Share your results and let's make 2026 even more anime-packed!</p>
            </div>
            <div className="slide-nav">
              <button className="nav-arrow" onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}>
                <ChevronLeft size={24} />
              </button>
              <span className="slide-counter">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
              <button className="nav-arrow" onClick={() => setCurrentSlide(0)}>
                RESTART
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <>
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          background: #000000;
          color: #ffffff;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          overflow-x: hidden;
        }

        .slide-container {
          width: 100%;
          min-height: 100vh;
          background: #000000;
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 2rem;
        }

        .progress-bar {
          display: flex;
          gap: 0.5rem;
          padding: 1.5rem 0 1rem 0;
          position: absolute;
          top: 0;
          left: 2rem;
          z-index: 10;
        }

        .progress-dash {
          width: 40px;
          height: 3px;
          background: #666666;
          transition: all 0.3s ease;
        }

        .progress-dash.active {
          background: #00FF00;
          box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
        }

        .download-btn {
          position: absolute;
          top: 1.5rem;
          right: 2rem;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #ffffff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          z-index: 10;
        }

        .download-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
        }

        .slide-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 4rem 2rem;
          animation: fadeIn 0.6s ease-in;
        }

        .welcome-slide {
          text-align: center;
        }

        .main-title {
          font-family: 'Inter', sans-serif;
          font-size: 3rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.1em;
          margin-bottom: 2rem;
          text-transform: uppercase;
          animation: slideUp 0.8s ease-out;
        }

        .year-display {
          font-family: 'Space Mono', monospace;
          font-size: 12rem;
          font-weight: 700;
          color: #00FF00;
          line-height: 1;
          margin: 2rem 0;
          text-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
          animation: scaleIn 1s ease-out;
        }

        .subtitle {
          font-family: 'Inter', sans-serif;
          font-size: 1.25rem;
          color: #ffffff;
          margin-top: 1rem;
          animation: fadeIn 1.2s ease-in;
        }

        .subtitle .highlight {
          color: #00FF00;
        }

        .section-title {
          font-family: 'Space Mono', monospace;
          font-size: 3.5rem;
          font-weight: 700;
          color: #00FF00;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
          animation: slideDown 0.6s ease-out;
        }

        .title-underline {
          width: 200px;
          height: 2px;
          background: #00FF00;
          margin-bottom: 1.5rem;
          animation: slideDown 0.8s ease-out;
        }

        .section-subtitle {
          font-family: 'Inter', sans-serif;
          font-size: 1rem;
          color: #CCCCCC;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 3rem;
          animation: fadeIn 1s ease-in;
        }

        .stat-number {
          font-family: 'Space Mono', monospace;
          font-size: 10rem;
          font-weight: 700;
          color: #ffffff;
          line-height: 1;
          margin: 2rem 0;
          animation: scaleIn 0.8s ease-out;
        }

        .stat-label {
          font-family: 'Space Mono', monospace;
          font-size: 2rem;
          font-weight: 700;
          color: #00FF00;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          animation: fadeIn 1.2s ease-in;
        }

        .ranked-list {
          width: 100%;
          max-width: 800px;
          display: flex;
          flex-direction: column;
          gap: 0;
          margin-top: 2rem;
        }

        .ranked-item {
          display: flex;
          align-items: center;
          padding: 1.5rem 2rem;
          border-bottom: 1px solid #333333;
          animation: slideUp 0.6s ease-out;
          animation-fill-mode: both;
        }

        .ranked-item:nth-child(1) { animation-delay: 0.1s; }
        .ranked-item:nth-child(2) { animation-delay: 0.2s; }
        .ranked-item:nth-child(3) { animation-delay: 0.3s; }
        .ranked-item:nth-child(4) { animation-delay: 0.4s; }
        .ranked-item:nth-child(5) { animation-delay: 0.5s; }

        .ranked-item.highlighted {
          background: #1a3a1a;
          border-left: 3px solid #00FF00;
          border-bottom: 1px solid #00FF00;
        }

        .rank-number {
          font-family: 'Space Mono', monospace;
          font-size: 2rem;
          font-weight: 700;
          color: #00FF00;
          min-width: 80px;
        }

        .ranked-item.highlighted .rank-number {
          color: #00FF00;
        }

        .rank-name {
          font-family: 'Inter', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff;
          flex: 1;
          margin-left: 2rem;
        }

        .rank-count {
          font-family: 'Inter', sans-serif;
          font-size: 1rem;
          color: #999999;
          margin-right: 2rem;
        }

        .star-icon {
          color: #FFD700;
          font-size: 1.5rem;
        }

        .featured-card {
          position: relative;
          display: flex;
          width: 100%;
          max-width: 900px;
          background: #1a1a1a;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 2rem;
          animation: slideUp 0.8s ease-out;
        }

        .featured-image {
          width: 300px;
          height: 400px;
          flex-shrink: 0;
        }

        .featured-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .featured-content {
          flex: 1;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .featured-tag {
          font-family: 'Space Mono', monospace;
          font-size: 0.875rem;
          color: #00FF00;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 1rem;
        }

        .featured-title {
          font-family: 'Inter', sans-serif;
          font-size: 2.5rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 0.5rem;
        }

        .featured-studio {
          font-family: 'Inter', sans-serif;
          font-size: 1.25rem;
          color: #00FF00;
          margin-bottom: 1rem;
        }

        .featured-rating {
          font-family: 'Inter', sans-serif;
          font-size: 1.5rem;
          color: #ffffff;
          margin-bottom: 1rem;
        }

        .star {
          color: #FFD700;
        }

        .featured-genres {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .genre-tag {
          font-family: 'Inter', sans-serif;
          font-size: 0.75rem;
          padding: 0.25rem 0.75rem;
          background: #333333;
          color: #CCCCCC;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .rank-badge {
          position: absolute;
          top: 1rem;
          right: 1rem;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: #ffffff;
          color: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .anime-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          width: 100%;
          max-width: 900px;
        }

        .anime-card {
          position: relative;
          background: #1a1a1a;
          border-radius: 8px;
          overflow: hidden;
          animation: slideUp 0.6s ease-out;
          animation-fill-mode: both;
        }

        .anime-card:nth-child(1) { animation-delay: 0.2s; }
        .anime-card:nth-child(2) { animation-delay: 0.3s; }
        .anime-card:nth-child(3) { animation-delay: 0.4s; }
        .anime-card:nth-child(4) { animation-delay: 0.5s; }

        .anime-card img {
          width: 100%;
          aspect-ratio: 2/3;
          object-fit: cover;
        }

        .anime-title {
          font-family: 'Inter', sans-serif;
          font-size: 0.875rem;
          font-weight: 600;
          color: #ffffff;
          padding: 0.75rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .anime-rating {
          font-family: 'Inter', sans-serif;
          font-size: 0.875rem;
          color: #ffffff;
          padding: 0 0.75rem 0.75rem 0.75rem;
        }

        .rank-badge-small {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #ffffff;
          color: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
          font-size: 0.875rem;
          font-weight: 700;
        }

        .seasonal-featured {
          display: flex;
          width: 100%;
          max-width: 800px;
          gap: 2rem;
          align-items: center;
          animation: slideUp 0.8s ease-out;
        }

        .seasonal-image {
          width: 200px;
          height: 280px;
          flex-shrink: 0;
          border-radius: 8px;
          overflow: hidden;
        }

        .seasonal-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .seasonal-content {
          flex: 1;
        }

        .seasonal-title {
          font-family: 'Inter', sans-serif;
          font-size: 2rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 0.5rem;
        }

        .seasonal-studio {
          font-family: 'Inter', sans-serif;
          font-size: 1.25rem;
          color: #00FF00;
          margin-bottom: 0.5rem;
        }

        .seasonal-season {
          font-family: 'Inter', sans-serif;
          font-size: 1rem;
          color: #ffffff;
          margin-bottom: 1rem;
        }

        .seasonal-rating {
          font-family: 'Inter', sans-serif;
          font-size: 1.5rem;
          color: #ffffff;
        }

        .gems-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          width: 100%;
          max-width: 1000px;
          margin-top: 2rem;
        }

        .gem-card {
          background: #1a1a1a;
          border-radius: 8px;
          overflow: hidden;
          animation: slideUp 0.6s ease-out;
          animation-fill-mode: both;
        }

        .gem-card:nth-child(1) { animation-delay: 0.1s; }
        .gem-card:nth-child(2) { animation-delay: 0.2s; }
        .gem-card:nth-child(3) { animation-delay: 0.3s; }

        .gem-card img {
          width: 100%;
          aspect-ratio: 2/3;
          object-fit: cover;
        }

        .gem-title {
          font-family: 'Inter', sans-serif;
          font-size: 1rem;
          font-weight: 600;
          color: #ffffff;
          padding: 1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .gem-rating {
          font-family: 'Inter', sans-serif;
          font-size: 1rem;
          color: #ffffff;
          padding: 0 1rem 1rem 1rem;
        }

        .no-data {
          font-family: 'Inter', sans-serif;
          font-size: 1.5rem;
          color: #666666;
          margin-top: 3rem;
        }

        .slide-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2rem 0;
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 2rem;
        }

        .nav-arrow {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #ffffff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .nav-arrow:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
        }

        .nav-arrow:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .slide-counter {
          font-family: 'Space Mono', monospace;
          font-size: 1rem;
          color: #999999;
        }

        .finale-slide {
          text-align: center;
        }

        .finale-text {
          font-family: 'Inter', sans-serif;
          font-size: 1.25rem;
          color: #CCCCCC;
          margin-top: 2rem;
          max-width: 600px;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @media (max-width: 768px) {
          .year-display {
            font-size: 6rem;
          }

          .stat-number {
            font-size: 5rem;
          }

          .section-title {
            font-size: 2rem;
          }

          .main-title {
            font-size: 2rem;
          }

          .anime-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .gems-grid {
            grid-template-columns: 1fr;
          }

          .featured-card {
            flex-direction: column;
          }

          .featured-image {
            width: 100%;
            height: 300px;
          }

          .seasonal-featured {
            flex-direction: column;
          }

          .seasonal-image {
            width: 100%;
            height: 300px;
          }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#000000' }}>
        {error && (
          <div style={{
            position: 'fixed',
            top: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(220, 38, 38, 0.9)',
            padding: '1rem 2rem',
            borderRadius: '8px',
            color: '#ffffff',
            zIndex: 1000,
            maxWidth: '90%',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {isLoading && (
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '3px solid #333333',
              borderTopColor: '#00FF00',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ color: '#00FF00', fontFamily: 'Space Mono, monospace', fontSize: '1rem' }}>
              {loadingProgress || 'Loading...'}
            </p>
          </div>
        )}

        {!isAuthenticated && !isLoading && (
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <h1 style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '4rem',
              fontWeight: 700,
              color: '#00FF00',
              marginBottom: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              MYANIMELIST WRAPPED
            </h1>
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: '8rem',
              fontWeight: 700,
              color: '#00FF00',
              lineHeight: 1,
              marginBottom: '2rem',
              textShadow: '0 0 30px rgba(0, 255, 0, 0.5)'
            }}>
              2025
            </div>
            <p style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '1.25rem',
              color: '#CCCCCC',
              marginBottom: '3rem'
            }}>
              Enter your MyAnimeList username to see your year in review.
            </p>
            <button
              onClick={handleBegin}
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#000000',
                background: '#00FF00',
                border: 'none',
                padding: '1rem 3rem',
                borderRadius: '8px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'scale(1.05)';
                e.target.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.5)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = 'none';
              }}
              disabled={!CLIENT_ID || CLIENT_ID === '<your_client_id_here>'}
            >
              GENERATE
            </button>
          </div>
        )}

        {isAuthenticated && stats && (
          <SlideContent slide={slides[currentSlide]} />
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
