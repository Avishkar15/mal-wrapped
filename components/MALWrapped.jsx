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

function pkceChallenge(verifier) {
  // MAL API only supports 'plain' method, not S256
  // For plain method, code_challenge is the code_verifier itself
  return verifier;
}

const CLIENT_ID = process.env.NEXT_PUBLIC_MAL_CLIENT_ID;
const AUTH_URL = 'https://myanimelist.net/v1/oauth2/authorize';

// Animated Number Component
function AnimatedNumber({ value, duration = 1500, className = '' }) {
  const [count, setCount] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const numValue = Number(value) || 0;
    if (numValue === 0) {
      setCount(0);
      return;
    }
    let startTime = null;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      setCount(Math.floor(percentage * numValue));
      if (progress < duration) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setCount(numValue);
      }
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{count.toLocaleString()}</span>;
}

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
  const [selectedYear, setSelectedYear] = useState(2025);
  const slideRef = useRef(null);

  const slides = stats ? [
    { id: 'welcome' },
    { id: 'anime_count' },
    { id: 'anime_time' },
    { id: 'top_genre' },
    { id: 'drumroll_anime' },
    { id: 'top_studio' },
    { id: 'seasonal_highlights' },
    { id: 'hidden_gems_anime' },
    { id: 'didnt_land_anime' },
    { id: 'planned_anime' },
    { id: 'manga_count' },
    { id: 'manga_time' },
    { id: 'top_manga_genre' },
    { id: 'drumroll_manga' },
    { id: 'top_author' },
    { id: 'hidden_gems_manga' },
    { id: 'didnt_land_manga' },
    { id: 'planned_manga' },
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
      const redirectUri = getRedirectUri();
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
      
      const animeData = await fetchAnimeList(accessToken);
      await fetchMangaList(accessToken, animeData);
      
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
      // Set initial stats with just anime (manga will be added later)
      calculateStats(allAnime, []);
      return allAnime;
    } catch (err) {
      console.error('Error fetching anime list:', err);
      setError('Failed to load anime list. Please try again.');
      return [];
    }
  }

  async function fetchMangaList(accessToken, animeData = []) {
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
      // Use the passed animeData or fall back to state (shouldn't be needed)
      const animeToUse = animeData.length > 0 ? animeData : animeList;
      // Recalculate with current year selection
      calculateStats(animeToUse, allManga);
    } catch (err) {
      console.error('Error fetching manga list:', err);
    }
  }

  function calculateStats(anime, manga) {
    const currentYear = selectedYear;
    
    console.log('Calculating stats for:', {
      animeCount: anime.length,
      mangaCount: manga.length,
      selectedYear: currentYear,
      sampleAnime: anime.length > 0 ? anime[0] : null
    });
    
    // Filter anime based on selected year
    // Use finish_date if available, otherwise use start_date or updated_at
    const filteredAnime = currentYear === 'all' ? anime : anime.filter(item => {
      const finishDate = item.list_status?.finish_date;
      const startDate = item.list_status?.start_date;
      const updatedAt = item.list_status?.updated_at;
      
      // Try finish_date first, then start_date, then updated_at
      let dateToCheck = finishDate || startDate || updatedAt;
      if (!dateToCheck) return false;
      
      try {
        const year = new Date(dateToCheck).getFullYear();
        return year === currentYear;
      } catch (e) {
        return false;
      }
    });

    const thisYearAnime = filteredAnime;

    // Get anime with ratings (completed or watching) from filtered list
    const ratedAnime = thisYearAnime.filter(item => {
      const status = item.list_status?.status;
      const score = item.list_status?.score;
      return (status === 'completed' || status === 'watching') && score && score > 0;
    });

    // Get completed anime for specific stats
    const completedAnime = thisYearAnime.filter(item => {
      const status = item.list_status?.status;
      const score = item.list_status?.score;
      return status === 'completed' && score && score > 0;
    });
    
    console.log('Filtered anime:', {
      thisYearCount: thisYearAnime.length,
      completedCount: completedAnime.length
    });

    // Calculate genres (from filtered anime)
    const genreCounts = {};
    thisYearAnime.forEach(item => {
      item.node?.genres?.forEach(genre => {
        genreCounts[genre.name] = (genreCounts[genre.name] || 0) + 1;
      });
    });

    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Calculate studios (from filtered anime)
    const studioCounts = {};
    thisYearAnime.forEach(item => {
      item.node?.studios?.forEach(studio => {
        studioCounts[studio.name] = (studioCounts[studio.name] || 0) + 1;
      });
    });

    const topStudios = Object.entries(studioCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Top rated shows (from rated anime, not just completed)
    const topRated = ratedAnime
      .sort((a, b) => b.list_status.score - a.list_status.score)
      .slice(0, 5);
    
    // Lowest rated shows (completed only, with ratings 6 or below) - deduplicate by title
    const lowestRatedRaw = completedAnime
      .filter(item => item.list_status.score > 0 && item.list_status.score <= 6)
      .sort((a, b) => a.list_status.score - b.list_status.score);
    const lowestRatedMap = new Map();
    lowestRatedRaw.forEach(item => {
      const title = item.node?.title || '';
      if (title && !lowestRatedMap.has(title)) {
        lowestRatedMap.set(title, item);
      }
    });
    const lowestRated = Array.from(lowestRatedMap.values()).slice(0, 5);
    
    // Planned to watch (status: plan_to_watch) - deduplicate by title
    const plannedAnimeRaw = thisYearAnime
      .filter(item => item.list_status?.status === 'plan_to_watch');
    const plannedAnimeMap = new Map();
    plannedAnimeRaw.forEach(item => {
      const title = item.node?.title || '';
      if (title && !plannedAnimeMap.has(title)) {
        plannedAnimeMap.set(title, item);
      }
    });
    const plannedAnime = Array.from(plannedAnimeMap.values()).slice(0, 5);

    // Hidden gems (high rating, low popularity) - 3 items, deduplicate by title
    const hiddenGemsRaw = completedAnime
      .filter(item => {
        const score = item.list_status.score;
        const popularity = item.node?.num_list_users || 0;
        return score >= 5 && popularity < 200000;
      })
      .sort((a, b) => {
        if (b.list_status.score !== a.list_status.score) {
          return b.list_status.score - a.list_status.score;
        }
        return (a.node?.num_list_users || 0) - (b.node?.num_list_users || 0);
      });
    const hiddenGemsMap = new Map();
    hiddenGemsRaw.forEach(item => {
      const title = item.node?.title || '';
      if (title && !hiddenGemsMap.has(title)) {
        hiddenGemsMap.set(title, item);
      }
    });
    const hiddenGems = Array.from(hiddenGemsMap.values()).slice(0, 3);

    // Watch time calculation (from filtered anime)
    const totalEpisodes = thisYearAnime.reduce((sum, item) => 
      sum + (item.list_status?.num_episodes_watched || 0), 0
    );
    // Calculate unique seasons
    const uniqueSeasons = new Set();
    thisYearAnime.forEach(item => {
      if (item.node?.start_season?.year && item.node?.start_season?.season) {
        uniqueSeasons.add(`${item.node.start_season.year}-${item.node.start_season.season}`);
      }
    });
    const totalSeasons = uniqueSeasons.size;
    const avgEpisodeLength = 24; // minutes
    const totalMinutes = totalEpisodes * avgEpisodeLength;
    const totalHours = Math.floor(totalMinutes / 60);

    // Seasonal highlights - group by all 4 seasons
    const getSeason = (date) => {
      const month = date.getMonth();
      if (month >= 0 && month <= 1) return 'Winter';
      if (month >= 2 && month <= 4) return 'Spring';
      if (month >= 5 && month <= 7) return 'Summer';
      if (month >= 8 && month <= 10) return 'Fall';
      return 'Winter';
    };

    const seasonalData = {
      Winter: { anime: [], episodes: 0, hours: 0 },
      Spring: { anime: [], episodes: 0, hours: 0 },
      Summer: { anime: [], episodes: 0, hours: 0 },
      Fall: { anime: [], episodes: 0, hours: 0 }
    };

    thisYearAnime.forEach(item => {
      const finishDate = item.list_status?.finish_date || item.list_status?.start_date || item.list_status?.updated_at;
      if (finishDate) {
        try {
          const date = new Date(finishDate);
          const season = getSeason(date);
          seasonalData[season].anime.push(item);
          const episodes = item.list_status?.num_episodes_watched || 0;
          seasonalData[season].episodes += episodes;
          seasonalData[season].hours += Math.floor((episodes * 24) / 60);
        } catch (e) {
          // Skip invalid dates
        }
      }
    });

    // Get top anime for each season
    const seasonalHighlights = {};
    ['Winter', 'Spring', 'Summer', 'Fall'].forEach(season => {
      if (seasonalData[season].anime.length > 0) {
        const topAnime = seasonalData[season].anime
          .sort((a, b) => (b.list_status?.score || 0) - (a.list_status?.score || 0))[0];
        seasonalHighlights[season] = {
          highlight: topAnime,
          totalAnime: seasonalData[season].anime.length,
          totalEpisodes: seasonalData[season].episodes,
          totalHours: seasonalData[season].hours
        };
      }
    });

    // Manga stats - filter by year
    const filteredManga = currentYear === 'all' ? manga : manga.filter(item => {
      const finishDate = item.list_status?.finish_date;
      const startDate = item.list_status?.start_date;
      const updatedAt = item.list_status?.updated_at;
      
      let dateToCheck = finishDate || startDate || updatedAt;
      if (!dateToCheck) return false;
      
      try {
        const year = new Date(dateToCheck).getFullYear();
        return year === currentYear;
      } catch (e) {
        return false;
      }
    });

    // Get manga with ratings (completed or reading)
    const ratedManga = filteredManga.filter(item => {
      const status = item.list_status?.status;
      const score = item.list_status?.score;
      return (status === 'completed' || status === 'reading') && score && score > 0;
    });

    const completedManga = filteredManga.filter(item => 
      item.list_status?.status === 'completed' && item.list_status?.score > 0
    );

    const topManga = ratedManga
      .sort((a, b) => b.list_status.score - a.list_status.score)
      .slice(0, 5);
    
    // Lowest rated manga (6 or below)
    const lowestRatedMangaRaw = completedManga
      .filter(item => item.list_status.score > 0 && item.list_status.score <= 6)
      .sort((a, b) => a.list_status.score - b.list_status.score);
    const lowestRatedMangaMap = new Map();
    lowestRatedMangaRaw.forEach(item => {
      const title = item.node?.title || '';
      if (title && !lowestRatedMangaMap.has(title)) {
        lowestRatedMangaMap.set(title, item);
      }
    });
    const lowestRatedManga = Array.from(lowestRatedMangaMap.values()).slice(0, 5);
    
    // Hidden gems manga (high rating, low popularity) - 3 items, deduplicate by title
    const hiddenGemsMangaRaw = completedManga
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
      });
    const hiddenGemsMangaMap = new Map();
    hiddenGemsMangaRaw.forEach(item => {
      const title = item.node?.title || '';
      if (title && !hiddenGemsMangaMap.has(title)) {
        hiddenGemsMangaMap.set(title, item);
      }
    });
    const hiddenGemsManga = Array.from(hiddenGemsMangaMap.values()).slice(0, 3);
    
    // Planned to read - deduplicate by title
    const plannedMangaRaw = filteredManga
      .filter(item => item.list_status?.status === 'plan_to_read');
    const plannedMangaMap = new Map();
    plannedMangaRaw.forEach(item => {
      const title = item.node?.title || '';
      if (title && !plannedMangaMap.has(title)) {
        plannedMangaMap.set(title, item);
      }
    });
    const plannedManga = Array.from(plannedMangaMap.values()).slice(0, 5);
    
    // Calculate manga chapters/volumes and time
    const totalChapters = filteredManga.reduce((sum, item) => 
      sum + (item.list_status?.num_chapters_read || 0), 0
    );
    const totalVolumes = filteredManga.reduce((sum, item) => 
      sum + (item.list_status?.num_volumes_read || 0), 0
    );
    // Estimate: 5 minutes per chapter, 20 minutes per volume
    const mangaMinutes = (totalChapters * 5) + (totalVolumes * 20);
    const mangaHours = Math.floor(mangaMinutes / 60);
    const mangaDays = Math.floor(mangaHours / 24);

    // Manga authors (from filtered manga)
    const authorCounts = {};
    filteredManga.forEach(item => {
      item.node?.authors?.forEach(author => {
        const name = `${author.node?.first_name || ''} ${author.node?.last_name || ''}`.trim();
        if (name) {
          authorCounts[name] = (authorCounts[name] || 0) + 1;
        }
      });
    });

    // Deduplicate authors - only keep unique entries
    const uniqueAuthorCounts = {};
    Object.entries(authorCounts).forEach(([name, count]) => {
      if (!uniqueAuthorCounts[name]) {
        uniqueAuthorCounts[name] = count;
      }
    });
    
    const topAuthors = Object.entries(uniqueAuthorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const statsData = {
      thisYearAnime: thisYearAnime.length > 0 ? thisYearAnime : [],
      totalAnime: thisYearAnime.length,
      totalManga: filteredManga.length,
      topGenres: topGenres.length > 0 ? topGenres : [],
      topStudios: topStudios.length > 0 ? topStudios : [],
      topRated: topRated.length > 0 ? topRated : [],
      hiddenGems: hiddenGems.length > 0 ? hiddenGems : [],
      hiddenGemsManga: hiddenGemsManga.length > 0 ? hiddenGemsManga : [],
      watchTime: totalHours,
      watchDays: Math.floor(totalHours / 24),
      completedCount: completedAnime.length,
      topManga: topManga.length > 0 ? topManga : [],
      topAuthors: topAuthors.length > 0 ? topAuthors : [],
      seasonalHighlights: seasonalHighlights,
      selectedYear: currentYear,
      lowestRatedAnime: lowestRated.length > 0 ? lowestRated : [],
      plannedAnime: plannedAnime.length > 0 ? plannedAnime : [],
      lowestRatedManga: lowestRatedManga.length > 0 ? lowestRatedManga : [],
      plannedManga: plannedManga.length > 0 ? plannedManga : [],
      totalChapters: totalChapters,
      totalVolumes: totalVolumes,
      mangaHours: mangaHours,
      mangaDays: mangaDays,
      totalEpisodes: totalEpisodes,
      totalSeasons: totalSeasons,
      totalTimeSpent: totalHours + mangaHours, // Combined time in hours
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
      // Wait a bit to ensure animations are complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      // Get the main card container
      const cardElement = slideRef.current;
      
      // Capture with all animations stopped
      const canvas = await html2canvas(cardElement, {
        backgroundColor: '#101010',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: false,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: document.documentElement.offsetHeight,
        onclone: (clonedDoc) => {
          // Stop all animations in cloned document
          const clonedElement = clonedDoc.querySelector('.slide-card');
          if (clonedElement) {
            clonedElement.style.animation = 'none';
            clonedElement.style.transform = 'none';
            const allElements = clonedElement.querySelectorAll('*');
            allElements.forEach(el => {
              el.style.animation = 'none';
              el.style.transform = 'none';
            });
          }
        }
      });
      
      const link = document.createElement('a');
      link.download = `mal-wrapped-${username || 'user'}-slide-${currentSlide + 1}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating PNG:', err);
      alert('Failed to download image. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }

  // Recalculate stats when year changes
  useEffect(() => {
    if (animeList.length > 0 || mangaList.length > 0) {
      calculateStats(animeList, mangaList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

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
        code_challenge_method: 'plain',
      });

      window.location.href = `${AUTH_URL}?${params.toString()}`;
    } catch (err) {
      setError(err.message || 'Failed to initiate OAuth');
      setIsLoading(false);
    }
  }

  // Drumroll to Top 5 Slide Component
  function DrumrollToTop5Slide({ type, topItem, top5Items, verticalText }) {
    const [phase, setPhase] = useState(0); // 0: drumroll, 1: reveal #1, 2: show top 5
    
    useEffect(() => {
      const timer1 = setTimeout(() => setPhase(1), 2000);
      const timer2 = setTimeout(() => setPhase(2), 5000);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }, []);

    const SlideLayout = ({ children, verticalText }) => (
      <div className="w-full h-full relative px-3 sm:px-4 md:p-6 lg:p-8 flex flex-col items-center justify-center slide-card overflow-hidden">
        {verticalText && (
          <p className="absolute top-1/2 -left-2 md:-left-2 -translate-y-1/2 text-[#3B82F6]/50 font-bold uppercase tracking-[.3em] [writing-mode:vertical-lr] text-xs sm:text-sm md:text-base z-10 pointer-events-none">
            {verticalText}
          </p>
        )}
        <div className="w-full relative z-10">
          {children}
        </div>
      </div>
    );

    const top5Formatted = top5Items.map(item => ({
      id: item.node.id,
      title: item.node.title,
      coverImage: item.node.main_picture?.large || item.node.main_picture?.medium || '',
      userRating: item.list_status.score,
      studio: type === 'anime' ? (item.node.studios?.[0]?.name || '') : '',
      author: type === 'manga' ? (`${item.node.authors?.[0]?.node?.first_name || ''} ${item.node.authors?.[0]?.node?.last_name || ''}`.trim()) : '',
      genres: item.node.genres?.map(g => g.name) || [],
      malId: type === 'anime' ? item.node.id : null,
      mangaId: type === 'manga' ? item.node.id : null
    }));

    const yearText = stats.selectedYear === 'all' ? 'of all time' : `of ${stats.selectedYear}`;

    return (
      <SlideLayout verticalText={verticalText}>
        {phase === 0 ? (
          <div className="text-center relative overflow-hidden animate-fade-slide-up">
            <h1 className="text-6xl md:text-8xl font-bold uppercase text-[#3B82F6] animate-pulse">{type === 'anime' ? '🎬' : '📚'}</h1>
            <h2 className="text-3xl md:text-5xl font-bold uppercase text-white mt-8">Your favorite {type === 'anime' ? 'anime' : 'manga'} {yearText} is...</h2>
          </div>
        ) : phase === 1 && topItem ? (
          <div className="text-center relative overflow-hidden animate-fade-slide-up">
            <h1 className="text-3xl md:text-4xl font-bold uppercase text-[#3B82F6] mb-6">Your #1 Favorite</h1>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">
              <div className="w-32 md:w-48 aspect-[2/3] bg-transparent border border-[#3B82F6] rounded-lg overflow-hidden group transition-all duration-300" style={{ boxSizing: 'border-box' }}>
                {topItem.node?.main_picture?.large && (
                  <img 
                    src={topItem.node.main_picture.large} 
                    alt={topItem.node.title} 
                    crossOrigin="anonymous" 
                    className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-110" 
                  />
                )}
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-3xl md:text-5xl font-bold text-white mb-2">{topItem.node?.title}</h3>
                {type === 'anime' && topItem.node?.studios?.[0]?.name && (
                  <p className="text-xl md:text-2xl text-[#3B82F6] mb-4">{topItem.node.studios[0].name}</p>
                )}
                {type === 'manga' && topItem.node?.authors?.[0] && (
                  <p className="text-xl md:text-2xl text-[#3B82F6] mb-4">
                    {`${topItem.node.authors[0].node?.first_name || ''} ${topItem.node.authors[0].node?.last_name || ''}`.trim()}
                  </p>
                )}
                <div className="flex items-center justify-center md:justify-start text-3xl md:text-4xl text-yellow-300">
                  <span className="mr-2">★</span>
                  <span>{topItem.list_status?.score?.toFixed(1)} / 10</span>
                </div>
              </div>
            </div>
          </div>
        ) : phase === 2 && top5Formatted.length > 0 ? (
          <div className="animate-fade-slide-up">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              Your Favorite {type === 'anime' ? 'Anime' : 'Manga'}
            </h1>
            <h2 className="body-lg font-semibold uppercase text-white/80 mt-2 sm:mt-3 animate-fade-slide-up whitespace-nowrap">
              The {type === 'anime' ? 'series' : 'manga'} you rated the highest.
            </h2>
            <div className="mt-2 flex flex-col gap-2 w-full">
              {(() => {
                const [featured, ...others] = top5Formatted;
                return (
                  <>
                    <div className="bg-white/3 border border-white/5 rounded-lg overflow-hidden group transition-all duration-300 hover:border-[#3B82F6]/40 hover:bg-white/5 flex flex-row items-center relative w-full">
                      <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10 w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 bg-black text-white rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs md:text-sm">1</div>
                      {(() => {
                        const featuredUrl = featured.malId ? `https://myanimelist.net/anime/${featured.malId}` : (featured.mangaId ? `https://myanimelist.net/manga/${featured.mangaId}` : null);
                        const featuredImage = (
                          <div className="flex-shrink-0 bg-transparent border border-white/5 rounded-lg overflow-hidden group transition-all duration-300 hover:border-[#3B82F6]/60" style={{ boxSizing: 'border-box', aspectRatio: '2/3', maxHeight: '270px' }}>
                            {featured.coverImage && (
                              <img src={featured.coverImage} crossOrigin="anonymous" alt={featured.title} className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-110" />
                            )}
                          </div>
                        );
                        return featuredUrl ? (
                          <a href={featuredUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                            {featuredImage}
                          </a>
                        ) : featuredImage;
                      })()}
                      <div className="p-2 flex flex-col justify-center flex-grow min-w-0 text-left">
                        <p className="text-[10px] sm:text-xs md:text-sm uppercase tracking-widest text-[#3B82F6] font-bold">#1 Favorite</p>
                        <h3 className="font-bold text-white text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1 leading-tight truncate">{featured.title}</h3>
                        {featured.studio && <p className="text-[10px] sm:text-xs md:text-sm text-[#3B82F6] truncate">{featured.studio}</p>}
                        {featured.author && <p className="text-[10px] sm:text-xs md:text-sm text-[#3B82F6] truncate">{featured.author}</p>}
                        <div className="flex items-center text-xs sm:text-sm md:text-base text-yellow-300 mt-0.5 sm:mt-1">
                          <span className="mr-0.5 sm:mr-1">★</span>
                          <span>{featured.userRating.toFixed(1)} / 10</span>
                        </div>
                        {featured.genres.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {featured.genres.slice(0, 2).map(g => (
                              <span key={g} className="text-[10px] sm:text-xs uppercase tracking-wider bg-white/10 text-white/80 px-1 sm:px-1.5 py-0.5 rounded">{g}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {others.length > 0 && (
                      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 w-full">
                        {others.map((item, index) => {
                          const malUrl = item.malId ? `https://myanimelist.net/anime/${item.malId}` : (item.mangaId ? `https://myanimelist.net/manga/${item.mangaId}` : null);
                          const itemContent = (
                            <div className="flex flex-col w-full min-w-0">
                              <div className="bg-transparent border border-white/5 rounded-lg overflow-hidden group aspect-[2/3] relative transition-all duration-300 hover:border-[#3B82F6]/60 w-full" style={{ boxSizing: 'border-box', maxHeight: '270px' }}>
                                <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 z-10 w-4 h-4 sm:w-5 sm:h-5 bg-black text-white rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs">{index + 2}</div>
                                {item.coverImage && (
                                  <img src={item.coverImage} alt={item.title} crossOrigin="anonymous" className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-110" />
                                )}
                              </div>
                              <div className="mt-1 text-left w-full min-w-0">
                                <h3 className="font-bold text-white text-xs sm:text-sm md:text-base truncate leading-tight">{item.title}</h3>
                                <div className="flex items-center text-xs sm:text-sm md:text-base text-yellow-300">
                                  <span className="mr-0.5 sm:mr-1 shrink-0">★</span>
                                  <span>{item.userRating.toFixed(1)}</span>
                                </div>
                              </div>
                            </div>
                          );
                          return (
                            <div key={item.id} className="w-full min-w-0">
                              {malUrl ? (
                                <a href={malUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                  {itemContent}
                                </a>
                              ) : (
                                itemContent
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="text-white/50">No favorite {type} found</div>
        )}
      </SlideLayout>
    );
  }

  function SlideContent({ slide, mangaListData }) {
    if (!slide || !stats) return null;

    const SlideLayout = ({ children, verticalText }) => (
      <div className="w-full h-full relative px-3 sm:px-4 md:p-6 lg:p-8 flex flex-col items-center justify-center slide-card overflow-hidden">
        {verticalText && (
          <p className="absolute top-1/2 -left-2 md:-left-2 -translate-y-1/2 text-[#3B82F6]/50 font-bold uppercase tracking-[.3em] [writing-mode:vertical-lr] text-xs sm:text-sm md:text-base z-10 pointer-events-none">
            {verticalText}
          </p>
        )}
        <div className="w-full relative z-10">
          {children}
        </div>
      </div>
    );

    // Image Carousel Component - Always carousel on all screen sizes
    const ImageCarousel = ({ items, maxItems = 20, showHover = true, showNames = false }) => {
      const [isHovered, setIsHovered] = useState(false);
      const [hoveredItem, setHoveredItem] = useState(null);
      const [scrollPosition, setScrollPosition] = useState(0);
      const [gapSize, setGapSize] = useState('2px');
      const [itemsPerView, setItemsPerView] = useState(3);
      const [maxHeight, setMaxHeight] = useState(null);
      
      // Deduplicate items by title to prevent repeats
      const uniqueItemsMap = new Map();
      items.forEach(item => {
        const title = item.title || '';
        if (title && !uniqueItemsMap.has(title)) {
          uniqueItemsMap.set(title, item);
        }
      });
      const uniqueItems = Array.from(uniqueItemsMap.values());
      const visibleItems = uniqueItems.slice(0, maxItems);
      
      // Duplicate items for infinite loop
      const duplicatedItems = [...visibleItems, ...visibleItems, ...visibleItems];
      
      // Update gap size and items per view based on screen width
      useEffect(() => {
        const updateResponsive = () => {
          if (window.innerWidth >= 768) {
            setGapSize('2px');
            setItemsPerView(5);
            setMaxHeight('270px');
          } else {
            setGapSize('2px');
            setItemsPerView(3);
            setMaxHeight(null);
          }
        };
        updateResponsive();
        window.addEventListener('resize', updateResponsive);
        return () => window.removeEventListener('resize', updateResponsive);
      }, []);
      
      const itemWidth = 100 / itemsPerView;
      
      useEffect(() => {
        if (visibleItems.length <= itemsPerView || isHovered) return;
        
        const scrollSpeed = 0.15;
        let animationFrame;
        
        const animate = () => {
          setScrollPosition((prev) => {
            const maxScroll = (visibleItems.length * itemWidth);
            const next = prev + scrollSpeed;
            if (next >= maxScroll) {
              return 0;
            }
            return next;
          });
          animationFrame = requestAnimationFrame(animate);
        };
        
        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
      }, [visibleItems.length, itemsPerView, isHovered, itemWidth]);

      const getMALUrl = (item) => {
        if (item.malId) {
          return `https://myanimelist.net/anime/${item.malId}`;
        }
        if (item.mangaId) {
          return `https://myanimelist.net/manga/${item.mangaId}`;
        }
        return null;
      };

      if (visibleItems.length === 0) return null;

      return (
        <div 
          className="mt-6 overflow-hidden relative"
          onMouseEnter={() => showHover && setIsHovered(true)}
          onMouseLeave={() => {
            showHover && setIsHovered(false);
            setHoveredItem(null);
          }}
        >
          <div 
            className="flex"
            style={{ 
              transform: `translateX(-${scrollPosition}%)`,
              willChange: 'transform',
              gap: gapSize
            }}
          >
            {duplicatedItems.map((item, idx) => {
              const malUrl = getMALUrl(item);
              const content = (
                <div className="flex flex-col flex-shrink-0">
                  <div className="aspect-[2/3] w-28 sm:w-32 md:w-40 bg-transparent border border-white/5 rounded-lg overflow-hidden transition-all duration-300 relative group-hover:border-[#3B82F6]/60" style={{ ...(maxHeight && { maxHeight }), boxSizing: 'border-box' }}>
                    {item.coverImage && (
                      <img 
                        src={item.coverImage} 
                        alt={item.title || ''} 
                        crossOrigin="anonymous" 
                        className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-110"
                      />
                    )}
                    {showHover && hoveredItem === (idx % visibleItems.length) && item.title && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-2 z-10 transition-opacity duration-300 rounded-lg">
                        <p className="text-white body-sm font-bold text-center leading-tight">{item.title}</p>
                        {item.userRating && (
                          <div className="absolute bottom-2 right-2 text-yellow-300 body-sm font-bold">
                            ★ {item.userRating.toFixed(1)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {showNames && item.title && (
                    <div className="mt-2 text-left">
                      <p className="body-sm font-bold text-white truncate">{item.title}</p>
                      {item.userRating && (
                        <p className="body-sm text-yellow-300">★ {item.userRating.toFixed(1)}</p>
                      )}
                    </div>
                  )}
                </div>
              );
              
              return (
                <div 
                  key={idx} 
                  className="relative group flex-shrink-0" 
                  style={{ width: `${itemWidth}%` }}
                  onMouseEnter={() => showHover && setHoveredItem(idx % visibleItems.length)}
                  onMouseLeave={() => showHover && setHoveredItem(null)}
                >
                  {malUrl ? (
                    <a href={malUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      {content}
                    </a>
                  ) : (
                    content
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    // Grid Image Component for hidden gems, didn't land, and planned sections
    const GridImages = ({ items, maxItems = 5 }) => {
      const visibleItems = items.slice(0, maxItems);

      const getMALUrl = (item) => {
        if (item.malId) {
          return `https://myanimelist.net/anime/${item.malId}`;
        }
        if (item.mangaId) {
          return `https://myanimelist.net/manga/${item.mangaId}`;
        }
        return null;
      };

      if (visibleItems.length === 0) return null;

      return (
        <div className="mt-6 grid grid-cols-3 sm:grid-cols-5 gap-3">
          {visibleItems.map((item, idx) => {
            const malUrl = getMALUrl(item);
            const itemContent = (
              <div className="flex flex-col">
                <div className="aspect-[2/3] bg-transparent border border-white/5 rounded-lg overflow-hidden transition-all duration-300 relative group-hover:border-[#3B82F6]/60">
                  {item.coverImage && (
                    <img 
                      src={item.coverImage} 
                      alt={item.title || ''} 
                      crossOrigin="anonymous" 
                      className="w-full h-full object-cover rounded-lg transition-transform duration-300 group-hover:scale-110"
                    />
                  )}
                </div>
                {item.title && (
                  <div className="mt-2 text-left">
                    <p className="body-sm font-bold text-white truncate">{item.title}</p>
                    {item.userRating && (
                      <p className="body-sm text-yellow-300">★ {item.userRating.toFixed(1)}</p>
                    )}
                  </div>
                )}
              </div>
            );
            
            return (
              <div key={idx} className="group">
                {malUrl ? (
                  <a href={malUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    {itemContent}
                  </a>
                ) : (
                  itemContent
                )}
              </div>
            );
          })}
        </div>
      );
    };

    const RankedListItem = ({ item, rank }) => {
      const isTop = rank === 1;
      return (
        <div className={`flex items-center p-3 border-b transition-all duration-300 hover:bg-white/5 ${isTop ? 'border-[#3B82F6]/60 bg-[#3B82F6]/5' : 'border-white/5'}`}>
          <div className={`text-3xl font-bold w-12 shrink-0 ${isTop ? 'text-[#3B82F6]' : 'text-white/60'}`}>#{rank}</div>
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
        <div className="bg-transparent border border-white/5 rounded-lg overflow-hidden group aspect-[2/3] relative transition-all duration-300 hover:border-[#3B82F6]/60" style={{ boxSizing: 'border-box' }}>
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
              <div className="animate-fade-in">
                <h2 className="text-3xl md:text-4xl font-medium uppercase text-white/80">MyAnimeList Wrapped</h2>
                <h1 className="text-7xl md:text-9xl font-bold uppercase text-[#3B82F6] my-4">{stats.selectedYear === 'all' ? 'ALL TIME' : stats.selectedYear}</h1>
                <p className="text-2xl md:text-3xl text-white">A look back at your {stats.selectedYear === 'all' ? 'anime journey' : 'year'}, <span className="text-[#3B82F6]">{username || 'a'}</span>.</p>
              </div>
            </div>
          </SlideLayout>
        );

      case 'anime_count':
        const animeCarouselItems = stats.thisYearAnime.map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          malId: item.node?.id
        }));
        return (
          <SlideLayout verticalText="ANIME-LOG">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              {stats.selectedYear === 'all' ? 'All Time' : stats.selectedYear} Anime Watched
            </h1>
            <div className="mt-4 sm:mt-6 text-center animate-fade-slide-up">
              <p className="number-xl text-white">
                <AnimatedNumber value={stats.thisYearAnime.length} />
              </p>
              <p className="heading-sm uppercase text-[#3B82F6] mt-1 sm:mt-2">Anime Series</p>
            </div>
            {animeCarouselItems.length > 0 && <ImageCarousel items={animeCarouselItems} maxItems={50} showHover={true} showNames={false} />}
          </SlideLayout>
        );

      case 'anime_time':
        return (
          <SlideLayout verticalText="TIME-ANALYSIS">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              Anime Stats
            </h1>
            <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6 animate-fade-slide-up">
              <div className="text-center">
                <p className="number-lg text-white">
                  <AnimatedNumber value={stats.totalEpisodes || 0} />
                </p>
                <p className="heading-sm uppercase text-[#3B82F6] mt-2">Episodes</p>
              </div>
              <div className="text-center">
                <p className="number-lg text-white">
                  <AnimatedNumber value={stats.totalSeasons || 0} />
                </p>
                <p className="heading-sm uppercase text-[#3B82F6] mt-2">Seasons</p>
              </div>
              <div className="text-center">
                {stats.watchDays > 0 ? (
                  <>
                    <p className="number-lg text-white">
                      <AnimatedNumber value={stats.watchDays} />
                    </p>
                    <p className="text-2xl font-medium uppercase text-[#3B82F6] mt-2">Days</p>
                    <p className="text-xl text-white/70 mt-2">or <AnimatedNumber value={stats.watchTime} /> hours</p>
                  </>
                ) : (
                  <>
                    <p className="number-lg text-white">
                      <AnimatedNumber value={stats.watchTime} />
                    </p>
                    <p className="text-2xl font-medium uppercase text-[#3B82F6] mt-2">Hours</p>
                  </>
                )}
              </div>
            </div>
          </SlideLayout>
        );

      case 'top_genre':
        const topGenre = stats.topGenres && stats.topGenres.length > 0 ? stats.topGenres[0][0] : null;
        const topGenreAnimeRaw = topGenre ? stats.thisYearAnime.filter(item => 
          item.node?.genres?.some(g => g.name === topGenre)
        ) : [];
        // Deduplicate by title
        const topGenreAnimeMap = new Map();
        topGenreAnimeRaw.forEach(item => {
          const title = item.node?.title || '';
          if (title && !topGenreAnimeMap.has(title)) {
            topGenreAnimeMap.set(title, item);
          }
        });
        const topGenreAnime = Array.from(topGenreAnimeMap.values());
        const genreAnime = topGenreAnime.map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          malId: item.node?.id
        }));
        const otherGenres = stats.topGenres?.slice(1, 5) || [];
        return (
          <SlideLayout verticalText="GENRE-MATRIX">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              Most Watched Genre
            </h1>
            {topGenre ? (
              <>
                <div className="mt-4 sm:mt-6 text-center animate-fade-slide-up">
                  <p className="body-sm text-[#3B82F6] font-bold mb-1 sm:mb-2">#1</p>
                  <p className="heading-xl font-bold text-[#3B82F6] uppercase">{topGenre}</p>
                  <p className="body-md text-white/70 mt-1 sm:mt-2">{stats.topGenres[0][1]} anime</p>
                </div>
                {genreAnime.length > 0 && <ImageCarousel items={genreAnime} maxItems={30} showHover={true} showNames={false} />}
                {otherGenres.length > 0 && (
                  <div className="mt-4 sm:mt-6 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                    {otherGenres.map(([genreName, count], idx) => (
                      <div key={idx} className="text-center p-2 sm:p-3 border border-white/5 rounded-lg bg-white/2 animate-fade-slide-up hover:bg-white/5 transition-colors">
                        <p className="body-sm text-[#3B82F6] font-bold mb-1">#{idx + 2}</p>
                        <p className="heading-sm font-bold text-[#3B82F6]">{genreName}</p>
                        <p className="body-sm text-white/70">{count} anime</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-8 text-center text-white/50">No genre data available</div>
            )}
          </SlideLayout>
        );

      case 'drumroll_anime':
        return <DrumrollToTop5Slide 
          type="anime" 
          topItem={stats.topRated.length > 0 ? stats.topRated[0] : null}
          top5Items={stats.topRated.slice(0, 5)}
          verticalText="DRUMROLL"
        />;


      case 'top_studio':
        const topStudio = stats.topStudios && stats.topStudios.length > 0 ? stats.topStudios[0][0] : null;
        const topStudioAnime = topStudio ? stats.thisYearAnime.filter(item => 
          item.node?.studios?.some(s => s.name === topStudio)
        ) : [];
        // Use first anime from studio as representation
        const topStudioRepresentation = topStudioAnime.length > 0 ? topStudioAnime[0] : null;
        const studioAnime = topStudioAnime.map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          malId: item.node?.id
        }));
        const otherStudios = stats.topStudios?.slice(1, 5) || [];
        return (
          <SlideLayout verticalText="PRODUCTION">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              Favorite Studio
            </h1>
            {topStudio ? (
              <>
                <div className="mt-4 sm:mt-6 flex items-center justify-center gap-3 sm:gap-4 animate-fade-slide-up">
                  <div className="text-left">
                    <p className="text-sm text-[#3B82F6] font-bold mb-2">#1</p>
                    <p className="text-4xl md:text-6xl font-bold text-[#3B82F6]">{topStudio}</p>
                    <p className="text-xl text-white/70 mt-2">{stats.topStudios[0][1]} anime</p>
                  </div>
                </div>
                {studioAnime.length > 0 && (
                  <ImageCarousel items={studioAnime} maxItems={30} showHover={true} showNames={false} />
                )}
                {otherStudios.length > 0 && (
                  <div className="mt-4 sm:mt-6 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                    {otherStudios.map(([studioName, count], idx) => (
                      <div key={idx} className="text-center p-2 sm:p-3 border border-white/5 rounded-lg bg-white/2 animate-fade-slide-up hover:bg-white/5 transition-colors">
                        <p className="body-sm text-[#3B82F6] font-bold mb-1">#{idx + 2}</p>
                        <p className="heading-sm font-bold text-[#3B82F6] truncate">{studioName}</p>
                        <p className="body-sm text-white/70">{count} anime</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-6 sm:mt-8 text-center text-white/50 animate-fade-slide-up">No studio data available</div>
            )}
          </SlideLayout>
        );

      case 'seasonal_highlights':
        const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];
        return (
          <SlideLayout verticalText="SEASONAL">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              Seasonal Highlights
            </h1>
            <div className="mt-4 sm:mt-6 flex flex-col md:grid md:grid-cols-2 gap-2 sm:gap-3">
              {seasons.map(season => {
                const seasonData = stats.seasonalHighlights?.[season];
                if (!seasonData) return null;
                const highlight = seasonData.highlight;
                const seasonIndex = seasons.indexOf(season);
                return (
                  <div key={season} className="bg-white/3 border border-white/5 rounded-lg p-2 sm:p-3 animate-fade-slide-up hover:bg-white/5 transition-colors">
                    <h3 className="heading-md font-bold text-[#3B82F6] mb-2">{season}</h3>
                    {highlight && (
                      <>
                        <div className="flex gap-2 sm:gap-3">
                          <div className="w-12 sm:w-16 aspect-[2/3] bg-transparent border border-white/5 rounded overflow-hidden flex-shrink-0 group transition-all duration-300 hover:border-[#3B82F6]/60" style={{ boxSizing: 'border-box' }}>
                            {highlight.node?.main_picture?.large && (
                              <img src={highlight.node.main_picture.large} alt={highlight.node.title} crossOrigin="anonymous" className="w-full h-full object-cover rounded transition-transform duration-300 group-hover:scale-110" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white text-xs sm:text-sm md:text-base truncate">{highlight.node?.title}</p>
                            <p className="text-xs text-[#3B82F6] truncate">{highlight.node?.studios?.[0]?.name || ''}</p>
                            <p className="text-xs sm:text-sm md:text-base text-yellow-300 mt-1">★ {highlight.list_status?.score || 'N/A'}</p>
                            <p className="body-sm text-white/70 mt-1">{seasonData.totalAnime} anime</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </SlideLayout>
        );

      case 'hidden_gems_anime':
        const gems = stats.hiddenGems.slice(0, 3).map(item => ({
          title: item.node.title,
          coverImage: item.node.main_picture?.large || item.node.main_picture?.medium || '',
          userRating: item.list_status.score,
          malId: item.node.id
        }));
        return (
          <SlideLayout verticalText="HIDDEN-GEMS">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              Hidden Gems
            </h1>
            <h2 className="body-lg font-semibold uppercase text-white/80 mt-2 sm:mt-3 animate-fade-slide-up whitespace-nowrap">
              High-rated anime with low popularity
            </h2>
            {gems.length > 0 ? (
              <div className="animate-fade-slide-up">
                <GridImages items={gems} maxItems={5} />
              </div>
            ) : (
              <div className="mt-6 sm:mt-8 text-center text-white/50 animate-fade-slide-up">No hidden gems found</div>
            )}
          </SlideLayout>
        );

      case 'didnt_land_anime':
        const didntLand = stats.lowestRatedAnime.slice(0, 5).map(item => ({
          title: item.node.title,
          coverImage: item.node.main_picture?.large || item.node.main_picture?.medium || '',
          userRating: item.list_status.score,
          malId: item.node.id
        }));
        return (
          <SlideLayout verticalText="DIDNT-LAND">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              Didn't Land
            </h1>
            <h2 className="body-lg font-semibold uppercase text-white/80 mt-2 sm:mt-3 animate-fade-slide-up whitespace-nowrap">
              5 shows you rated the lowest
            </h2>
            {didntLand.length > 0 ? (
              <div className="animate-fade-slide-up">
                <GridImages items={didntLand} maxItems={5} />
              </div>
            ) : (
              <div className="mt-6 sm:mt-8 text-center text-white/50 animate-fade-slide-up">No data available</div>
            )}
          </SlideLayout>
        );

      case 'planned_anime':
        const plannedAnimeItems = stats.plannedAnime.slice(0, 5).map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          malId: item.node?.id
        }));
        return (
          <SlideLayout verticalText="PLANNED">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              Planned to Watch
            </h1>
            <h2 className="body-lg font-semibold uppercase text-white/80 mt-2 sm:mt-3 animate-fade-slide-up whitespace-nowrap">
              5 shows you plan to watch {stats.selectedYear === 'all' ? '' : 'this year'}.
            </h2>
            {plannedAnimeItems.length > 0 ? (
              <div className="animate-fade-slide-up">
                <GridImages items={plannedAnimeItems} maxItems={5} />
              </div>
            ) : (
              <div className="mt-6 sm:mt-8 text-center text-white/50 animate-fade-slide-up">No planned anime found</div>
            )}
          </SlideLayout>
        );


      case 'manga_count':
        const mangaCarouselItems = stats.thisYearAnime.filter(item => {
          // Get manga from filtered list - need to check if we have manga data
          return false; // This will be fixed when we have manga data structure
        }).map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || ''
        }));
        // Get manga from stats - we need to access filtered manga
        const allMangaItems = (mangaListData || []).filter(item => {
          if (stats.selectedYear === 'all') return true;
          const finishDate = item.list_status?.finish_date;
          const startDate = item.list_status?.start_date;
          const updatedAt = item.list_status?.updated_at;
          let dateToCheck = finishDate || startDate || updatedAt;
          if (!dateToCheck) return false;
          try {
            const year = new Date(dateToCheck).getFullYear();
            return year === stats.selectedYear;
          } catch (e) {
            return false;
          }
        }).map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          mangaId: item.node?.id
        }));
        return (
          <SlideLayout verticalText="MANGA-LOG">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              {stats.selectedYear === 'all' ? 'All Time' : stats.selectedYear} Manga Read
            </h1>
            <div className="mt-4 sm:mt-6 text-center animate-fade-slide-up">
              <p className="number-xl text-white">
                <AnimatedNumber value={stats.totalManga} />
              </p>
              <p className="heading-sm uppercase text-[#3B82F6] mt-2">Manga Series</p>
            </div>
            {allMangaItems.length > 0 && <ImageCarousel items={allMangaItems} maxItems={50} showHover={true} showNames={false} />}
          </SlideLayout>
        );

      case 'manga_time':
        return (
          <SlideLayout verticalText="READING-TIME">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              Reading Stats
            </h1>
            <div className="mt-4 sm:mt-6 text-center animate-fade-slide-up">
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <p className="number-lg text-white">
                    <AnimatedNumber value={stats.totalChapters || 0} />
                  </p>
                  <p className="heading-sm uppercase text-[#3B82F6] mt-1 sm:mt-2">Chapters</p>
                </div>
                <div>
                  <p className="number-lg text-white">
                    <AnimatedNumber value={stats.totalVolumes || 0} />
                  </p>
                  <p className="heading-sm uppercase text-[#3B82F6] mt-1 sm:mt-2">Volumes</p>
                </div>
                {stats.mangaDays > 0 ? (
                  <div>
                    <p className="number-lg text-white">
                      <AnimatedNumber value={stats.mangaDays} />
                    </p>
                    <p className="heading-sm uppercase text-[#3B82F6] mt-1 sm:mt-2">Days</p>
                    <p className="body-md text-white/70 mt-1 sm:mt-2">or <AnimatedNumber value={stats.mangaHours || 0} /> hours</p>
                  </div>
                ) : (
                  <div>
                    <p className="number-lg text-white">
                      <AnimatedNumber value={stats.mangaHours || 0} />
                    </p>
                    <p className="heading-sm uppercase text-[#3B82F6] mt-1 sm:mt-2">Hours</p>
                  </div>
                )}
              </div>
            </div>
          </SlideLayout>
        );

      case 'top_manga_genre':
        const mangaGenres = {};
        (mangaListData || []).forEach(item => {
          if (stats.selectedYear !== 'all') {
            const finishDate = item.list_status?.finish_date;
            const startDate = item.list_status?.start_date;
            const updatedAt = item.list_status?.updated_at;
            let dateToCheck = finishDate || startDate || updatedAt;
            if (!dateToCheck) return;
            try {
              const year = new Date(dateToCheck).getFullYear();
              if (year !== stats.selectedYear) return;
            } catch (e) {
              return;
            }
          }
          item.node?.genres?.forEach(genre => {
            mangaGenres[genre.name] = (mangaGenres[genre.name] || 0) + 1;
          });
        });
        const topMangaGenre = Object.entries(mangaGenres).sort((a, b) => b[1] - a[1])[0];
        const topMangaGenreList = Object.entries(mangaGenres).sort((a, b) => b[1] - a[1]);
        const topMangaGenreAnimeRaw = topMangaGenre ? (mangaListData || []).filter(item => {
          if (stats.selectedYear !== 'all') {
            const finishDate = item.list_status?.finish_date;
            const startDate = item.list_status?.start_date;
            const updatedAt = item.list_status?.updated_at;
            let dateToCheck = finishDate || startDate || updatedAt;
            if (!dateToCheck) return false;
            try {
              const year = new Date(dateToCheck).getFullYear();
              if (year !== stats.selectedYear) return false;
            } catch (e) {
              return false;
            }
          }
          return item.node?.genres?.some(g => g.name === topMangaGenre[0]);
        }) : [];
        // Deduplicate by title
        const topMangaGenreAnimeMap = new Map();
        topMangaGenreAnimeRaw.forEach(item => {
          const title = item.node?.title || '';
          if (title && !topMangaGenreAnimeMap.has(title)) {
            topMangaGenreAnimeMap.set(title, item);
          }
        });
        const topMangaGenreAnime = Array.from(topMangaGenreAnimeMap.values());
        const mangaGenreItems = topMangaGenreAnime.map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          mangaId: item.node?.id
        }));
        const otherMangaGenres = topMangaGenreList.slice(1, 5);
        return (
          <SlideLayout verticalText="GENRE-MATRIX">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              Most Read Genre
            </h1>
            {topMangaGenre ? (
              <>
                <div className="mt-4 sm:mt-6 text-center animate-fade-slide-up">
                  <p className="body-sm text-[#3B82F6] font-bold mb-1 sm:mb-2">#1</p>
                  <p className="heading-xl font-bold text-[#3B82F6] uppercase">{topMangaGenre[0]}</p>
                  <p className="body-md text-white/70 mt-1 sm:mt-2">{topMangaGenre[1]} manga</p>
                </div>
                {mangaGenreItems.length > 0 && <ImageCarousel items={mangaGenreItems} maxItems={30} showHover={true} showNames={false} />}
                {otherMangaGenres.length > 0 && (
                  <div className="mt-4 sm:mt-6 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                    {otherMangaGenres.map(([genreName, count], idx) => (
                      <div key={idx} className="text-center p-3 border border-white/10 rounded-lg">
                        <p className="text-sm text-[#3B82F6] font-bold mb-1">#{idx + 2}</p>
                        <p className="text-lg md:text-xl font-bold text-[#3B82F6]">{genreName}</p>
                        <p className="text-sm text-white/70">{count} manga</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-8 text-center text-white/50">No genre data available</div>
            )}
          </SlideLayout>
        );

      case 'drumroll_manga':
        return <DrumrollToTop5Slide 
          type="manga" 
          topItem={stats.topManga.length > 0 ? stats.topManga[0] : null}
          top5Items={stats.topManga.slice(0, 5)}
          verticalText="DRUMROLL"
        />;


      case 'top_author':
        const topAuthor = stats.topAuthors && stats.topAuthors.length > 0 ? stats.topAuthors[0][0] : null;
        const topAuthorManga = topAuthor ? (mangaListData || []).filter(item => {
          if (stats.selectedYear !== 'all') {
            const finishDate = item.list_status?.finish_date;
            const startDate = item.list_status?.start_date;
            const updatedAt = item.list_status?.updated_at;
            let dateToCheck = finishDate || startDate || updatedAt;
            if (!dateToCheck) return false;
            try {
              const year = new Date(dateToCheck).getFullYear();
              if (year !== stats.selectedYear) return false;
            } catch (e) {
              return false;
            }
          }
          return item.node?.authors?.some(a => {
            const name = `${a.node?.first_name || ''} ${a.node?.last_name || ''}`.trim();
            return name === topAuthor;
          });
        }) : [];
        // Use first manga from author as representation
        const topAuthorRepresentation = topAuthorManga.length > 0 ? topAuthorManga[0] : null;
        const authorManga = topAuthorManga.map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          mangaId: item.node?.id
        }));
        const otherAuthors = stats.topAuthors?.slice(1, 5) || [];
        return (
          <SlideLayout verticalText="CREATORS">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              Favorite Author
            </h1>
            {topAuthor ? (
              <>
                <div className="mt-4 sm:mt-6 flex items-center justify-center gap-3 sm:gap-4 animate-fade-slide-up">
                  <div className="text-left">
                    <p className="text-sm text-[#3B82F6] font-bold mb-2">#1</p>
                    <p className="text-4xl md:text-6xl font-bold text-[#3B82F6]">{topAuthor}</p>
                    <p className="text-xl text-white/70 mt-2">{stats.topAuthors[0][1]} manga</p>
                  </div>
                </div>
                {authorManga.length > 0 && (
                  <ImageCarousel items={authorManga} maxItems={30} showHover={true} showNames={false} />
                )}
                {otherAuthors.length > 0 && (
                  <div className="mt-4 sm:mt-6 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                    {otherAuthors.map(([authorName, count], idx) => (
                      <div key={idx} className="text-center p-2 sm:p-3 border border-white/5 rounded-lg bg-white/2 animate-fade-slide-up hover:bg-white/5 transition-colors">
                        <p className="body-sm text-[#3B82F6] font-bold mb-1">#{idx + 2}</p>
                        <p className="heading-sm font-bold text-[#3B82F6] truncate">{authorName}</p>
                        <p className="body-sm text-white/70">{count} manga</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-8 text-center text-white/50">No author data available</div>
            )}
          </SlideLayout>
        );

      case 'hidden_gems_manga':
        const mangaGems = stats.hiddenGemsManga.slice(0, 5).map(item => ({
          title: item.node.title,
          coverImage: item.node.main_picture?.large || item.node.main_picture?.medium || '',
          userRating: item.list_status.score,
          mangaId: item.node.id
        }));
        return (
          <SlideLayout verticalText="HIDDEN-GEMS">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              Hidden Gems
            </h1>
            <h2 className="body-lg font-semibold uppercase text-white/80 mt-2 sm:mt-3 animate-fade-slide-up whitespace-nowrap">
              High-rated manga with low popularity
            </h2>
            {mangaGems.length > 0 ? (
              <div className="animate-fade-slide-up">
                <GridImages items={mangaGems} maxItems={5} />
              </div>
            ) : (
              <div className="mt-6 sm:mt-8 text-center text-white/50 animate-fade-slide-up">No hidden gems found</div>
            )}
          </SlideLayout>
        );

      case 'didnt_land_manga':
        const mangaDidntLand = stats.lowestRatedManga.slice(0, 5).map(item => ({
          title: item.node.title,
          coverImage: item.node.main_picture?.large || item.node.main_picture?.medium || '',
          userRating: item.list_status.score,
          mangaId: item.node.id
        }));
        return (
          <SlideLayout verticalText="DIDNT-LAND">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              Didn't Land
            </h1>
            <h2 className="body-lg font-semibold uppercase text-white/80 mt-2 sm:mt-3 animate-fade-slide-up whitespace-nowrap">
              5 manga you rated the lowest
            </h2>
            {mangaDidntLand.length > 0 ? (
              <div className="animate-fade-slide-up">
                <GridImages items={mangaDidntLand} maxItems={5} />
              </div>
            ) : (
              <div className="mt-6 sm:mt-8 text-center text-white/50 animate-fade-slide-up">No data available</div>
            )}
          </SlideLayout>
        );

      case 'planned_manga':
        const plannedMangaItems = stats.plannedManga.slice(0, 5).map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          mangaId: item.node?.id
        }));
        return (
          <SlideLayout verticalText="PLANNED">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              Planned to Read
            </h1>
            <h2 className="body-lg font-semibold uppercase text-white/80 mt-2 sm:mt-3 animate-fade-slide-up whitespace-nowrap">
              5 manga you plan to read {stats.selectedYear === 'all' ? '' : 'this year'}.
            </h2>
            {plannedMangaItems.length > 0 ? (
              <div className="animate-fade-slide-up">
                <GridImages items={plannedMangaItems} maxItems={5} />
              </div>
            ) : (
              <div className="mt-6 sm:mt-8 text-center text-white/50 animate-fade-slide-up">No planned manga found</div>
            )}
          </SlideLayout>
        );


      case 'finale':
        const totalTimeSpent = stats.totalTimeSpent || 0;
        const totalDays = Math.floor(totalTimeSpent / 24);
        return (
          <SlideLayout verticalText="FINAL-REPORT">
            <h1 className="relative z-10 heading-lg uppercase text-[#3B82F6] border-b border-[#3B82F6]/60 pb-1 sm:pb-2 px-2 inline-block whitespace-nowrap animate-fade-slide-up">
              {stats.selectedYear === 'all' ? 'All Time' : stats.selectedYear} In Review
            </h1>
            <div className="mt-6 flex flex-col gap-3 text-white animate-fade-slide-up w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-white/5 p-3 rounded-lg flex flex-col bg-white/2 hover:bg-white/5 transition-colors">
                  <h3 className="heading-sm text-[#3B82F6] mb-3">Top 5 Anime</h3>
                  <div className="space-y-2 flex-grow">
                    {stats.topRated.slice(0, 5).map((a, i) => (
                        <p key={a.node.id} className="body-sm truncate bg-white/3 py-1.5 px-2 rounded hover:bg-white/5 transition-colors">
                        <span className="font-bold text-[#3B82F6] w-6 inline-block">{i+1}.</span>{a.node.title}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="border border-white/5 p-3 rounded-lg flex flex-col bg-white/2 hover:bg-white/5 transition-colors">
                  <h3 className="heading-sm text-[#3B82F6] mb-3">Top 5 Manga</h3>
                  <div className="space-y-2 flex-grow">
                    {stats.topManga.slice(0, 5).map((m, i) => (
                        <p key={m.node.id} className="body-sm truncate bg-white/3 py-1.5 px-2 rounded hover:bg-white/5 transition-colors">
                        <span className="font-bold text-[#3B82F6] w-6 inline-block">{i+1}.</span>{m.node.title}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-white/5 p-3 rounded-lg bg-white/2 hover:bg-white/5 transition-colors">
                  <p className="body-sm text-white/70 mb-2">Episodes Watched</p>
                  <p className="number-md text-white">
                    <AnimatedNumber value={stats.totalEpisodes || 0} duration={1000} />
                  </p>
                </div>
                <div className="border border-white/5 p-3 rounded-lg bg-white/2 hover:bg-white/5 transition-colors">
                  <p className="body-sm text-white/70 mb-2">Chapters Read</p>
                  <p className="number-md text-white">
                    <AnimatedNumber value={stats.totalChapters || 0} duration={1000} />
                  </p>
                </div>
              </div>
              <div className="border border-white/5 p-3 rounded-lg bg-white/2 hover:bg-white/5 transition-colors">
                <p className="body-sm text-white/70 mb-2">Total Time Spent</p>
                <p className="number-lg text-white">
                  {totalDays > 0 ? (
                    <>
                      <AnimatedNumber value={totalDays} duration={1000} /> Days
                      <span className="body-md text-white/70 ml-2">({totalTimeSpent} hours)</span>
                    </>
                  ) : (
                    <>
                      <AnimatedNumber value={totalTimeSpent} duration={1000} /> Hours
                    </>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-white/5 p-3 rounded-lg bg-white/2 hover:bg-white/5 transition-colors">
                  <p className="body-sm text-white/70 mb-2">Top Studio</p>
                  <p className="heading-sm text-white truncate">{stats.topStudios?.[0]?.[0] || 'N/A'}</p>
                </div>
                <div className="border border-white/5 p-3 rounded-lg bg-white/2 hover:bg-white/5 transition-colors">
                  <p className="body-sm text-white/70 mb-2">Top Author</p>
                  <p className="heading-sm text-white truncate">{stats.topAuthors?.[0]?.[0] || 'N/A'}</p>
                </div>
              </div>
            </div>
          </SlideLayout>
        );

      default:
        return null;
    }
  }

  return (
    <main className="bg-[#0A0A0A] text-white w-screen flex items-center justify-center p-2 selection:bg-[#3B82F6] selection:text-white relative overflow-hidden moving-grid-bg" style={{ height: '100dvh' }}>
      {/* Background floating anime elements - outside the card on grid bg */}
      {stats && isAuthenticated && slides.length > 0 && (
        <div className="absolute inset-0 pointer-events-none opacity-5 overflow-hidden" style={{ zIndex: 0 }}>
          {(() => {
            const slideId = slides[currentSlide]?.id;
            let bgItems = [];
            if (slideId?.includes('anime') || slideId === 'top_genre' || slideId === 'top_studio' || slideId === 'seasonal_highlights') {
              bgItems = stats.thisYearAnime?.slice(0, 6) || [];
            } else if (slideId?.includes('manga') || slideId === 'top_manga_genre' || slideId === 'top_author') {
              bgItems = (mangaList || []).slice(0, 6);
            } else {
              bgItems = [...(stats.thisYearAnime?.slice(0, 3) || []), ...(mangaList?.slice(0, 3) || [])];
            }
            return bgItems.map((item, idx) => {
              const image = item.node?.main_picture?.large || item.node?.main_picture?.medium;
              if (!image) return null;
              const positions = [
                { top: '10%', left: '5%', rotate: -12 },
                { top: '50%', right: '5%', rotate: 15 },
                { bottom: '10%', left: '20%', rotate: -8 },
                { bottom: '15%', right: '15%', rotate: 10 },
                { top: '30%', left: '15%', rotate: 20 },
                { bottom: '30%', right: '10%', rotate: -15 }
              ];
              const pos = positions[idx % positions.length];
              return (
                <img
                  key={idx}
                  src={image}
                  alt=""
                  className="absolute w-24 h-36 md:w-32 md:h-48 object-cover rounded-lg blur-md"
                  style={{
                    ...pos,
                    transform: `rotate(${pos.rotate}deg)`,
                    animation: `float 8s ease-in-out infinite`,
                  }}
                />
              );
            });
          })()}
        </div>
      )}
      <div ref={slideRef} className={`w-full max-w-5xl bg-[#101010] border border-white/5 rounded-xl shadow-2xl shadow-black/50 flex flex-col justify-center relative overflow-hidden ${isCapturing ? 'capturing' : ''}`} style={{ zIndex: 10, height: '100dvh' }}>
        <div className="z-10 w-full h-full flex flex-col items-center justify-center">
          {error && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg z-50">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="text-center">
              <div className="animate-pulse-fast text-[#3B82F6] mb-4 text-4xl">*</div>
              <h1 className="text-3xl text-white uppercase tracking-widest">{loadingProgress || 'Generating your report...'}</h1>
            </div>
          )}

          {!isAuthenticated && !isLoading && (
            <div className="text-center p-4">
              <div className="mb-4 animate-fade-in text-[#3B82F6] text-4xl">*</div>
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold uppercase tracking-wider text-[#3B82F6] animate-fade-in100">MyAnimeList</h1>
              <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold uppercase tracking-wider text-white animate-fade-in">Wrapped 2025</h2>
              <p className="mt-4 text-lg text-white/70 max-w-md mx-auto animate-fade-in300">Enter your MyAnimeList username to see your year in review.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
                <button
                  onClick={handleBegin}
                  className="bg-[#3B82F6] text-white font-bold uppercase text-lg px-8 py-3 rounded-md hover:bg-[#2563EB] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!CLIENT_ID || CLIENT_ID === '<your_client_id_here>'}
                >
              Connect with MAL
            </button>
              </div>
            </div>
          )}

          {isAuthenticated && stats && slides.length > 0 && (
            <div className="w-full h-full flex flex-col overflow-hidden">
              {/* Top Bar - Year Selector and Download */}
              <div className="flex-shrink-0 px-3 sm:px-4 md:px-6 pt-3 pb-2 flex items-center justify-end gap-2 sm:gap-3">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 bg-black/50 border border-[#3B82F6]/50 text-[#3B82F6] rounded-md text-xs sm:text-sm font-bold uppercase tracking-wider focus:outline-none focus:border-[#3B82F6] transition-all hover:bg-black/70"
                >
                  <option value="2023">2023</option>
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="all">ALL TIME</option>
                </select>
                <button onClick={handleDownloadPNG} className="p-1.5 sm:p-2 text-white rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 transition-all" title="Download Slide">
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
              
              {/* Progress Bar */}
              <div className="flex-shrink-0 px-3 sm:px-4 md:px-6 pb-3 flex items-center gap-1 sm:gap-2">
                {slides.map((_, i) => {
                  const isCompleted = i < currentSlide;
                  const isActive = i === currentSlide;
                  return (
                    <div key={i} className="flex-1 h-1 sm:h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ease-out ${isActive ? 'bg-[#3B82F6]' : 'bg-white/30'}`} 
                        style={{ width: (isCompleted || isActive) ? '100%' : '0%' }} 
                      />
                    </div>
                  );
                })}
              </div>
              
              {/* Slide Content */}
              <div key={currentSlide} className="w-full flex-grow flex items-center justify-center overflow-hidden py-2 sm:py-4">
                <div className="w-full h-full relative overflow-hidden">
                  <SlideContent slide={slides[currentSlide]} mangaListData={mangaList} />
                </div>
              </div>
              
              {/* Bottom Controls */}
              <div className="flex-shrink-0 w-full px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 flex items-center justify-between gap-2">
              <button
                onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                disabled={currentSlide === 0}
                  className="p-1.5 sm:p-2 text-white rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 disabled:opacity-30 transition-all"
              >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6"/>
              </button>
                
                <p className="text-white/60 text-xs sm:text-sm md:text-base font-mono py-1.5 sm:py-2 px-2 sm:px-4 rounded-full bg-black/20 backdrop-blur-sm whitespace-nowrap">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</p>

                {currentSlide === slides.length - 1 ? (
              <button
                    onClick={() => { setCurrentSlide(0); setIsAuthenticated(false); setStats(null); }} 
                    className="bg-[#3B82F6] text-white font-bold uppercase px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-3 rounded-full hover:bg-[#2563EB] transition-all text-xs sm:text-sm md:text-base"
                  >
                    Restart
                  </button>
                ) : (
                  <button
                onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
                    className="p-1.5 sm:p-2 text-white rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-all"
              >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6"/>
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