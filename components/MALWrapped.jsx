import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Download, LogOut, Share2 } from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

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

// Framer Motion Animation Variants
const fadeSlideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const fadeIn100 = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
};

const fadeIn300 = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
};

const pulse = {
  animate: {
    opacity: [1, 0.5, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
};

const float = {
  animate: {
    y: [0, -20, 0],
    transition: {
      duration: 8,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
};

// Stagger container variants
const staggerContainer = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

// Hover animation variants
const hoverScale = {
  scale: 1.05,
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
};

const hoverImage = {
  scale: 1.1,
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
};

// Animated Number Component using Framer Motion
function AnimatedNumber({ value, duration = 1.5, className = '' }) {
  const numValue = Number(value) || 0;
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, {
    damping: 30,
    stiffness: 100,
    duration: duration * 1000
  });
  const display = useTransform(spring, (latest) => Math.floor(latest).toLocaleString());

  useEffect(() => {
    motionValue.set(numValue);
  }, [motionValue, numValue]);

  return (
    <motion.span 
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {display}
    </motion.span>
  );
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
  const [selectedYear, setSelectedYear] = useState(2025);
  const slideRef = useRef(null);

  const hasAnime = stats && stats.thisYearAnime && stats.thisYearAnime.length > 0;
  const hasManga = stats && mangaList && mangaList.length > 0;
  
  const slides = stats ? [
    { id: 'welcome' },
    { id: 'anime_count' },
    ...(hasAnime ? [
      { id: 'anime_time' },
      { id: 'top_genre' },
      { id: 'drumroll_anime' },
      { id: 'top_5_anime' },
      { id: 'top_studio' },
      { id: 'seasonal_highlights' },
      { id: 'hidden_gems_anime' },
      { id: 'didnt_land_anime' },
      { id: 'planned_anime' },
    ] : []),
    { id: 'manga_count' },
    ...(hasManga ? [
      { id: 'manga_time' },
      { id: 'top_manga_genre' },
      { id: 'drumroll_manga' },
      { id: 'top_5_manga' },
      { id: 'top_author' },
      { id: 'hidden_gems_manga' },
      { id: 'didnt_land_manga' },
      { id: 'planned_manga' },
    ] : []),
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
        const popularity = item.node?.num_list_users;
        return score >= 7 && popularity < 100000;
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

    // Seasonal highlights - group by anime that released during each season of the selected year
    const seasonalData = {
      Winter: { anime: [], episodes: 0, hours: 0 },
      Spring: { anime: [], episodes: 0, hours: 0 },
      Summer: { anime: [], episodes: 0, hours: 0 },
      Fall: { anime: [], episodes: 0, hours: 0 }
    };

    // Helper to capitalize season name (MAL returns lowercase)
    const capitalizeSeason = (season) => {
      if (!season) return null;
      return season.charAt(0).toUpperCase() + season.slice(1).toLowerCase();
    };

    thisYearAnime.forEach(item => {
      const startSeason = item.node?.start_season;
      if (startSeason && startSeason.season && startSeason.year) {
        // If a specific year is selected, only include anime that released in that year
        // If 'all' is selected, include all anime with start_season data
        if (currentYear === 'all' || startSeason.year === currentYear) {
          const season = capitalizeSeason(startSeason.season);
          if (season && seasonalData[season]) {
            seasonalData[season].anime.push(item);
            const episodes = item.list_status?.num_episodes_watched || 0;
            seasonalData[season].episodes += episodes;
            seasonalData[season].hours += Math.floor((episodes * 24) / 60);
          }
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
        const popularity = item.node?.num_list_users;
        return score >= 7 && popularity < 100000;
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
    // Normalize author names to avoid duplicates from spacing/case variations
    const normalizeAuthorName = (first, last) => {
      return `${(first || '').trim()} ${(last || '').trim()}`.trim().replace(/\s+/g, ' ');
    };
    
    const authorCounts = {};
    filteredManga.forEach(item => {
      item.node?.authors?.forEach(author => {
        const name = normalizeAuthorName(
          author.node?.first_name || '',
          author.node?.last_name || ''
        );
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

  function handleLogout() {
    if (window.confirm('Are you sure you want to log out?')) {
      localStorage.removeItem('mal_access_token');
      localStorage.removeItem('mal_refresh_token');
      setIsAuthenticated(false);
      setStats(null);
      setAnimeList([]);
      setMangaList([]);
      setUserData(null);
      setCurrentSlide(0);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  async function handleDownloadPNG() {
    if (!slideRef.current || typeof window === 'undefined') return;
    
    try {
      // Wait for all images to load
      const cardElement = slideRef.current;
      const images = cardElement.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = resolve; // Continue even if image fails
            // Timeout after 3 seconds
            setTimeout(resolve, 3000);
          });
        })
      );
      
      // Dynamically import snapdom
      const { snapdom } = await import('@zumer/snapdom');
      
      // Create a plugin to stop animations and hide navigation
      const capturePlugin = {
        name: 'mal-wrapped-capture',
        async afterClone(context) {
          const clonedDoc = context.clonedDocument;
          if (!clonedDoc) return;
          
          // Stop animations without touching filters
          const clonedElement = clonedDoc.querySelector('.slide-card') || clonedDoc.body;
          if (clonedElement) {
            clonedElement.style.animation = 'none';
            clonedElement.style.transition = 'none';
            clonedElement.style.animationPlayState = 'paused';
            
            const allElements = clonedElement.querySelectorAll('*');
            allElements.forEach(el => {
              // Stop CSS animations and transitions, but preserve all filter styles
              el.style.animation = 'none';
              el.style.transition = 'none';
              el.style.animationPlayState = 'paused';
              
              // Ensure visibility for non-filter elements
              if (!el.getAttribute('style')?.includes('filter')) {
                el.style.visibility = el.style.visibility || 'visible';
                
                // Ensure colors are visible
                if (el.classList.contains('text-white')) {
                  el.style.color = '#ffffff';
                }
              }
            });
          }
          
          // Hide all navigation and control bars in cloned document
          const flexShrinkBars = clonedDoc.querySelectorAll('.flex-shrink-0');
          flexShrinkBars.forEach(bar => {
            // Check if this is a control bar (has buttons, select, or progress indicators)
            const hasControls = bar.querySelector('button') || 
                               bar.querySelector('select') || 
                               bar.querySelectorAll('div[class*="rounded-full"]').length > 0 ||
                               bar.textContent.includes('/');
            if (hasControls) {
              bar.style.display = 'none';
            }
          });
          
          // Ensure all images are properly displayed with correct sizing
          const clonedImages = clonedDoc.querySelectorAll('img');
          clonedImages.forEach(img => {
            img.style.opacity = '1';
            img.style.visibility = 'visible';
            img.style.display = '';
            img.style.transform = 'none'; // Remove any transforms on images
            // Ensure images maintain their aspect ratio
            if (!img.style.width && !img.style.height) {
              const originalImg = Array.from(document.querySelectorAll('img')).find(
                origImg => origImg.src === img.src && origImg.alt === img.alt
              );
              if (originalImg) {
                const computedStyle = window.getComputedStyle(originalImg);
                img.style.width = computedStyle.width;
                img.style.height = computedStyle.height;
                img.style.objectFit = 'cover';
              }
            }
          });
        }
      };
      
      // Capture with snapdom
      const out = await snapdom(cardElement, {
        backgroundColor: '#0A0A0A',
        scale: 2,
        plugins: [capturePlugin]
      });
      
      // Export as PNG image element
      const png = await out.toPng();
      
      // Create download link
      const link = document.createElement('a');
      link.download = `mal-wrapped-${username || 'user'}-slide-${currentSlide + 1}.png`;
      link.href = png.src;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating PNG:', err);
      alert('Failed to download image. Please try again.');
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

  // Drumroll Slide Component (only drumroll and reveal #1)
  function DrumrollSlide({ type, topItem, verticalText }) {
    const [phase, setPhase] = useState(0); // 0: drumroll, 1: reveal #1
    
    useEffect(() => {
      const timer1 = setTimeout(() => setPhase(1), 2000);
      return () => {
        clearTimeout(timer1);
      };
    }, []);

    const SlideLayout = ({ children, verticalText }) => {
      // Random abstract shape type for visual variety (like Spotify)
      const shapeTypes = ['angular', 'pixelated', 'wavy'];
      const shapeType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)] || 'angular';
      
      return (
        <motion.div 
          className={`w-full h-full relative px-3 sm:px-4 md:p-6 lg:p-8 flex flex-col items-center justify-center slide-card overflow-hidden abstract-shapes abstract-shapes-${shapeType}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
        {verticalText && (
            <motion.p 
              className="absolute top-1/2 -left-2 md:-left-2 -translate-y-1/2 text-white/30 font-medium tracking-[.3em] [writing-mode:vertical-lr] text-xs sm:text-sm md:text-base z-10 pointer-events-none"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
            {verticalText}
            </motion.p>
          )}
          <motion.div 
            className="w-full relative z-10"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
          {children}
          </motion.div>
        </motion.div>
    );
    };

    const yearText = stats.selectedYear === 'all' ? 'of all time' : `of ${stats.selectedYear}`;

    return (
      <SlideLayout verticalText={verticalText}>
        {phase === 0 ? (
          <motion.div className="text-center relative overflow-hidden" {...fadeSlideUp} data-framer-motion>
            <motion.h1 className="number-xl font-regular text-white" {...pulse} data-framer-motion>{type === 'anime' ? '🎬' : '📚'}</motion.h1>
            <h2 className="body-md font-regular text-white mt-4">{type === 'anime' ? 'But one show rose above everything' : 'But one manga became your top read'}</h2>
          </motion.div>
        ) : phase === 1 && topItem ? (
          <motion.div className="text-center relative overflow-hidden" {...fadeSlideUp} data-framer-motion>
            <div className="flex flex-col items-center justify-center gap-4">
              <motion.div 
                className="w-32 md:w-48 aspect-[2/3] bg-transparent rounded-lg overflow-hidden" 
                style={{ boxSizing: 'border-box', border: '1px solid white' }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {topItem.node?.main_picture?.large && (
                  <motion.img 
                    src={topItem.node.main_picture.large} 
                    alt={topItem.node.title} 
                    crossOrigin="anonymous" 
                    className="w-full h-full object-cover rounded-lg"
                    whileHover={hoverImage}
                  />
                )}
              </motion.div>
              <div className="text-left">
                <h3 className="title-lg text-white font-semibold">{topItem.node?.title}</h3>
                {type === 'anime' && topItem.node?.studios?.[0]?.name && (
                  <p className="body-sm text-white/50  font-regular">{topItem.node.studios[0].name}</p>
                )}
                {type === 'manga' && topItem.node?.authors?.[0] && (
                  <p className="body-sm text-white/50  font-regular">
                    {`${topItem.node.authors[0].node?.first_name || ''} ${topItem.node.authors[0].node?.last_name || ''}`.trim()}
                  </p>
                )}
                <div className="flex items-left justify-left heading-sm text-yellow-300 font-semibold">
                  <span className="mr-2">★</span>
                  <span>{topItem.list_status?.score?.toFixed(1)} / 10</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="body-md font-regular text-white/50">No favorite {type} found</div>
        )}
      </SlideLayout>
    );
  }

  // Top 5 Slide Component (shows the top 5 list)
  function Top5Slide({ type, top5Items, verticalText }) {
    const SlideLayout = ({ children, verticalText }) => (
      <div className="w-full h-full relative px-3 sm:px-4 md:p-6 lg:p-8 flex flex-col items-center justify-center slide-card overflow-hidden">
        {verticalText && (
          <p className="absolute top-1/2 -left-2 md:-left-2 -translate-y-1/2 text-white/50 font-medium tracking-[.3em] [writing-mode:vertical-lr] text-xs sm:text-sm md:text-base z-10 pointer-events-none">
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

    if (top5Formatted.length === 0) {
      return (
        <SlideLayout verticalText={verticalText}>
          <div className="text-white/50">No favorite {type} found</div>
        </SlideLayout>
      );
    }

    return (
      <SlideLayout verticalText={verticalText}>
        <motion.div className="relative" {...fadeSlideUp} data-framer-motion>
            <motion.h2 className="body-md font-regular text-white text-center  relative z-10" {...fadeSlideUp} data-framer-motion>
              {type === 'anime' ? 'And these four followed closely behind' : 'And these four earned your highest ratings'}
            </motion.h2>
              <div className="mt-2 sm:mt-3 flex flex-col gap-1.5 sm:gap-2 w-full">
              {(() => {
                const [featured, ...others] = top5Formatted;
                return (
                  <>
                  <motion.div 
                    className="border-box-cyan rounded-xl overflow-hidden flex flex-row items-left relative w-full shadow-2xl" 
                    style={{ padding: '2px' }}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <motion.div 
                      className="bg-white/5 rounded-xl w-full h-full flex flex-row items-center"
                      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-white text-black rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm md:text-base shadow-lg">1</div>
                      {(() => {
                        const featuredUrl = featured.malId ? `https://myanimelist.net/anime/${featured.malId}` : (featured.mangaId ? `https://myanimelist.net/manga/${featured.mangaId}` : null);
                        const featuredImage = (
                          <motion.div 
                            className="border-box-cyan flex-shrink-0 rounded-xl overflow-hidden shadow-xl relative" 
                            style={{ boxSizing: 'border-box', aspectRatio: '2/3', maxHeight: '200px', padding: '2px' }}
                            transition={{ duration: 0.3 }}
                          >
                            <div className="bg-transparent rounded-xl w-full h-full overflow-hidden">
                            {featured.coverImage && (
                                <motion.img 
                                  src={featured.coverImage} 
                                  crossOrigin="anonymous" 
                                  alt={featured.title} 
                                  className="w-full h-full object-cover rounded-xl"
                                  whileHover={hoverImage}
                                />
                            )}
                            </div>
                          </motion.div>
                        );
                        return featuredUrl ? (
                          <a href={featuredUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                            {featuredImage}
                          </a>
                        ) : featuredImage;
                      })()}
                      <motion.div 
                        className="p-1.5 sm:p-2 flex flex-col justify-left flex-grow min-w-0 text-left"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                      >
                      <h3 className="title-md mt-1.5 sm:mt-2 truncate font-semibold text-white text-left">{featured.title}</h3>
                      {featured.studio && <p className="body-sm text-white truncate font-regular text-left">{featured.studio}</p>}
                      {featured.author && <p className="body-md text-white truncate font-medium text-left">{featured.author}</p>}
                      <div className="flex items-left justify-left body-sm text-yellow-300 mt-2 font-semibold">
                          <span className="mr-0.5 sm:mr-1">★</span>
                          <span>{featured.userRating.toFixed(1)} / 10</span>
                        </div>
                        {featured.genres.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 justify-left items-left">
                            {featured.genres.slice(0, 2).map(g => (
                            <motion.span 
                              key={g} 
                              className="border-box-cyan mono tracking-wider text-white px-2 py-0.5 rounded-lg font-regular" 
                              style={{ border: '1px solid rgba(255, 255, 255, 0.2)' }}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.3, delay: 0.3 }}
                            >
                              {g}
                            </motion.span>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
                  </motion.div>
                    {others.length > 0 && (
                    <motion.div 
                      className="grid grid-cols-4 gap-2 w-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delayChildren: 0.4, staggerChildren: 0.1 }}
                    >
                        {others.map((item, index) => {
                          const malUrl = item.malId ? `https://myanimelist.net/anime/${item.malId}` : (item.mangaId ? `https://myanimelist.net/manga/${item.mangaId}` : null);
                          const itemContent = (
                            <motion.div 
                              className="flex flex-col w-full min-w-0"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4 }}
                            >
                            <motion.div 
                              className="border-box-cyan rounded-xl overflow-hidden aspect-[2/3] relative w-full shadow-lg" 
                              style={{ boxSizing: 'border-box', maxHeight: '275px', padding: '2px' }}
                              transition={{ duration: 0.3 }}
                            >
                              <div className="bg-transparent rounded-xl w-full h-full overflow-hidden relative">
                                <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 z-10 w-5 h-5 sm:w-6 sm:h-6 bg-white text-black rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm shadow-md">{index + 2}</div>
                                {item.coverImage && (
                                  <motion.img 
                                    src={item.coverImage} 
                                    alt={item.title} 
                                    crossOrigin="anonymous" 
                                    className="w-full h-full object-cover rounded-xl"
                                    whileHover={hoverImage}
                                  />
                                )}
                              </div>
                            </motion.div>
                            <div className="mt-2 text-center w-full min-w-0">
                              <h3 className="title-sm truncate font-semibold text-white">{item.title}</h3>
                              <div className="flex items-center justify-center body-sm text-yellow-300 font-semibold">
                                  <span className="mr-0.5 sm:mr-1 shrink-0">★</span>
                                  <span>{item.userRating.toFixed(1)}</span>
                                </div>
                              </div>
                            </motion.div>
                          );
                          return (
                            <motion.div key={item.id} className="w-full min-w-0">
                              {malUrl ? (
                                <a href={malUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                  {itemContent}
                                </a>
                              ) : (
                                itemContent
                              )}
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    )}
                  </>
                );
              })()}
            </div>
            <motion.h2 className="body-sm font-regular text-white mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>A lineup only you could assemble</motion.h2>
        </motion.div>
      </SlideLayout>
    );
  }

  function SlideContent({ slide, mangaListData }) {
    if (!slide || !stats) return null;

    const SlideLayout = ({ children, verticalText, bgColor = 'black' }) => {
      // Random abstract shape type for visual variety (like Spotify)
      const shapeTypes = ['angular', 'pixelated', 'wavy'];
      const shapeType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)] || 'angular';
      
      // Spotify-like background colors with subtle tint (solid colors)
      const bgColorClasses = {
        black: 'bg-black',
        pink: 'bg-black',
        yellow: 'bg-black',
        blue: 'bg-black',
        green: 'bg-black',
        red: 'bg-black'
      };
      
      return (
        <motion.div 
          className={`w-full h-full relative px-2 sm:px-3 md:px-4 lg:px-6 py-2 sm:py-3 md:py-4 lg:py-6 flex flex-col items-center justify-center slide-card overflow-hidden abstract-shapes abstract-shapes-${shapeType} ${bgColorClasses[bgColor] || 'bg-black'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{ position: 'relative' }}
        >
        {verticalText && (
            <motion.p 
              className="absolute top-1/2 -left-2 md:-left-2 -translate-y-1/2 text-white/30 font-medium tracking-[.3em] [writing-mode:vertical-lr] text-xs sm:text-sm md:text-base z-20 pointer-events-none"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
            {verticalText}
            </motion.p>
          )}
          {/* Colorful abstract shapes background on all cards - animated */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
            {/* Large layered organic shape (left side) */}
            <motion.div 
              className="absolute left-0 top-1/2 -translate-y-1/2 w-96 h-96 opacity-60"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(255, 0, 100, 0.4) 0%, rgba(200, 0, 150, 0.3) 30%, rgba(100, 0, 200, 0.2) 60%, transparent 100%)',
                clipPath: 'polygon(0% 20%, 40% 0%, 100% 30%, 80% 70%, 40% 100%, 0% 80%)',
                filter: 'blur(80px)',
                willChange: 'transform, opacity'
              }}
              animate={{
                transform: ['rotate(-15deg) translateY(-50%)', 'rotate(-10deg) translateY(-50%)', 'rotate(-20deg) translateY(-50%)', 'rotate(-15deg) translateY(-50%)'],
                opacity: [0.6, 0.7, 0.5, 0.6]
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              data-framer-motion
              data-shape-blur
            ></motion.div>
            
            {/* Rainbow gradient rectangle (top right) */}
            <motion.div 
              className="absolute top-0 right-0 w-96 h-64 opacity-50"
              style={{
                background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.5) 0%, rgba(75, 0, 130, 0.4) 20%, rgba(0, 0, 255, 0.3) 40%, rgba(0, 255, 255, 0.3) 60%, rgba(0, 255, 0, 0.3) 80%, rgba(255, 255, 0, 0.4) 100%)',
                clipPath: 'polygon(20% 0%, 100% 0%, 100% 80%, 0% 100%)',
                filter: 'blur(70px)',
                willChange: 'transform, opacity'
              }}
              animate={{
                transform: ['translateY(0%)', 'translateY(-5%)', 'translateY(0%)'],
                opacity: [0.5, 0.6, 0.5]
              }}
              transition={{
                duration: 7,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              data-framer-motion
              data-shape-blur
            ></motion.div>
            
            {/* Purple glow (center) */}
            <motion.div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-40"
              style={{
                background: 'radial-gradient(circle, rgba(138, 43, 226, 0.3) 0%, rgba(75, 0, 130, 0.2) 50%, transparent 100%)',
                filter: 'blur(100px)',
                willChange: 'transform, opacity'
              }}
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.4, 0.5, 0.4]
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              data-framer-motion
              data-shape-blur
            ></motion.div>
            
            {/* Rainbow accent (bottom right) */}
            <motion.div 
              className="absolute bottom-1/4 right-1/4 w-80 h-80 opacity-50"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 0, 0, 0.3) 0%, rgba(255, 165, 0, 0.3) 25%, rgba(255, 255, 0, 0.3) 50%, rgba(0, 255, 0, 0.3) 75%, rgba(0, 0, 255, 0.3) 100%)',
                filter: 'blur(70px)',
                willChange: 'transform, opacity'
              }}
              animate={{
                transform: ['rotate(0deg)', 'rotate(10deg)', 'rotate(-10deg)', 'rotate(0deg)'],
                opacity: [0.5, 0.6, 0.5]
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              data-framer-motion
              data-shape-blur
            ></motion.div>
        </div>
          <motion.div 
            className="w-full relative z-20"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {children}
          </motion.div>
        </motion.div>
      );
    };

    // Image Carousel Component - Always carousel on all screen sizes
    const ImageCarousel = ({ items, maxItems = 20, showHover = true, showNames = false }) => {
      const [isHovered, setIsHovered] = useState(false);
      const [hoveredItem, setHoveredItem] = useState(null);
      const [scrollPosition, setScrollPosition] = useState(0);
      const [gapSize, setGapSize] = useState('2px');
      const [itemsPerView, setItemsPerView] = useState(3);
      
      // Deduplicate items by title AND ID to prevent repeats
      const uniqueItemsMap = new Map();
      items.forEach(item => {
        const title = item.title || '';
        const id = item.malId || item.mangaId || '';
        const uniqueKey = `${title}-${id}`;
        if (title && !uniqueItemsMap.has(uniqueKey)) {
          uniqueItemsMap.set(uniqueKey, item);
        }
      });
      const uniqueItems = Array.from(uniqueItemsMap.values());
      const visibleItems = uniqueItems.slice(0, maxItems);
      
      // Update gap size and items per view based on screen width
      useEffect(() => {
        const updateResponsive = () => {
          if (window.innerWidth >= 768) {
            setGapSize('2px');
            setItemsPerView(5);
          } else {
            setGapSize('2px');
            setItemsPerView(3);
          }
        };
        updateResponsive();
        window.addEventListener('resize', updateResponsive);
        return () => window.removeEventListener('resize', updateResponsive);
      }, []);
      
      const itemWidth = 100 / itemsPerView;
      
      // Only duplicate items if we have more items than can fit in viewport (for infinite scroll)
      // Otherwise, just show the unique items
      const shouldScroll = visibleItems.length > itemsPerView;
      const duplicatedItems = shouldScroll 
        ? [...visibleItems, ...visibleItems, ...visibleItems]
        : visibleItems;
      
      // Center items when there are fewer than itemsPerView
      const shouldCenter = !shouldScroll && visibleItems.length < itemsPerView;
      
      useEffect(() => {
        // Only animate if we have more items than viewport and not hovered
        if (visibleItems.length <= itemsPerView || isHovered) {
          return;
        }
        
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
          className="mt-2 sm:mt-3 overflow-hidden relative flex justify-center"
          style={{ 
            maskImage: shouldScroll ? 'none' : 'linear-gradient(to right, black 0%, black 100%)',
            WebkitMaskImage: shouldScroll ? 'none' : 'linear-gradient(to right, black 0%, black 100%)'
          }}
          onMouseEnter={() => showHover && setIsHovered(true)}
          onMouseLeave={() => {
            showHover && setIsHovered(false);
            setHoveredItem(null);
          }}
        >
          <div 
            className="flex"
            style={{ 
              transform: shouldScroll ? `translateX(-${scrollPosition}%)` : 'translateX(0)',
              willChange: shouldScroll ? 'transform' : 'auto',
              gap: gapSize,
              justifyContent: shouldCenter ? 'center' : 'flex-start',
              width: shouldCenter ? 'auto' : '100%'
            }}
          >
            {duplicatedItems.map((item, idx) => {
              const malUrl = getMALUrl(item);
              const actualIndex = idx % visibleItems.length;
              const uniqueKey = `${item.title || ''}-${item.malId || item.mangaId || idx}-${actualIndex}`;
              const content = (
                <motion.div 
                  className="flex flex-col flex-shrink-0 items-center w-full"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ 
                    duration: 0.4,
                    delay: (idx % visibleItems.length) * 0.05,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                >
                  <motion.div 
                    className="aspect-[2/3] w-full bg-transparent border border-white/5 rounded-lg overflow-hidden relative" 
                    style={{ maxHeight: '275px', maxWidth: '100%', boxSizing: 'border-box' }}
                    whileHover={{ borderColor: '#ffffff' }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {item.coverImage && (
                      <motion.img 
                        src={item.coverImage} 
                        alt={item.title || ''} 
                        crossOrigin="anonymous" 
                        className="w-full h-full object-cover rounded-lg"
                        whileHover={hoverImage}
                      />
                    )}
                    {showHover && hoveredItem === actualIndex && item.title && (
                      <motion.div 
                        className="absolute inset-0 bg-black/80 flex items-center justify-center p-2 z-10 rounded-lg"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p className="title-sm text-center">{item.title}</p>
                        {item.userRating && (
                          <div className="absolute bottom-2 right-2 text-yellow-300 body-sm font-medium">
                            ★ {item.userRating.toFixed(1)}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                  {showNames && item.title && (
                    <div className="mt-2 text-center">
                      <p className="title-sm truncate">{item.title}</p>
                      {item.userRating && (
                        <p className="body-sm text-yellow-300">★ {item.userRating.toFixed(1)}</p>
                      )}
                    </div>
                  )}
                </motion.div>
              );
              
              return (
                <div 
                  key={uniqueKey} 
                  className="relative group flex-shrink-0 flex justify-center" 
                  style={{ 
                    width: shouldCenter ? `${100 / itemsPerView}%` : `${itemWidth}%`,
                    minWidth: shouldCenter ? '120px' : 'auto',
                    maxWidth: shouldCenter ? '183px' : 'none'
                  }}
                  onMouseEnter={() => showHover && setHoveredItem(actualIndex)}
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
      const itemCount = visibleItems.length;
      
      // Dynamically set columns based on number of items
      // On mobile: max 3 columns, on larger screens: use item count (max 5)
      const getGridCols = () => {
        if (itemCount === 0) return 'grid-cols-1';
        if (itemCount === 1) return 'grid-cols-1';
        if (itemCount === 2) return 'grid-cols-2';
        if (itemCount === 3) return 'grid-cols-3';
        if (itemCount === 4) return 'grid-cols-2 sm:grid-cols-4';
        // 5 or more items
        return 'grid-cols-3 sm:grid-cols-5';
      };

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
        <div className="mt-4 flex justify-center w-full px-2">
          <div className={`grid ${getGridCols()} gap-4 place-items-center w-full max-w-4xl mx-auto`}>
          {visibleItems.map((item, idx) => {
            const malUrl = getMALUrl(item);
            const itemContent = (
                <motion.div 
                  className="flex flex-col items-center w-full"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.5,
                    delay: idx * 0.08,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                >
                  <motion.div 
                    className="aspect-[2/3] bg-transparent border border-white/5 rounded-lg overflow-hidden relative" 
                    style={{ maxHeight: '275px', maxWidth: '183px', width: '100%', boxSizing: 'border-box' }}
                    whileHover={{ borderColor: '#ffffff' }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                  {item.coverImage && (
                    <motion.img 
                      src={item.coverImage} 
                      alt={item.title || ''} 
                      crossOrigin="anonymous" 
                      className="w-full h-full object-cover rounded-lg"
                      whileHover={hoverImage}
                    />
                  )}
                </motion.div>
                {item.title && (
                    <div className="mt-2 text-center w-full px-1">
                      <p className="title-sm truncate">{item.title}</p>
                    {item.userRating && (
                      <p className="body-sm text-yellow-300">★ {item.userRating.toFixed(1)}</p>
                    )}
                  </div>
                )}
              </motion.div>
            );
            
            return (
                <motion.div key={idx} className="w-full flex justify-center">
                {malUrl ? (
                    <a href={malUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-full flex justify-center">
                    {itemContent}
                  </a>
                ) : (
                  itemContent
                )}
              </motion.div>
            );
          })}
          </div>
        </div>
      );
    };

    const RankedListItem = ({ item, rank }) => {
      const isTop = rank === 1;
      return (
        <motion.div 
          className={`flex items-center p-3 border-b ${isTop ? 'border-white/60 bg-white/5' : 'border-white/5'}`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ 
            duration: 0.4,
            delay: rank * 0.05,
            ease: [0.22, 1, 0.36, 1]
          }}
          whileHover={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            x: 5,
            transition: { duration: 0.2 }
          }}
        >
          <div className={`heading-md font-medium w-12 shrink-0 ${isTop ? 'text-white' : 'text-white/60'}`}>#{rank}</div>
          <div className="flex-grow flex items-center gap-2 min-w-0">
            <div className="flex-grow min-w-0">
              <p className="title-lg truncate">{item.name}</p>
              <p className="body-md text-white/50">{item.count} entries</p>
            </div>
          </div>
          {isTop && <span className="text-yellow-300 heading-md ml-3 shrink-0">★</span>}
        </motion.div>
      );
    };

    const MediaCard = ({ item, rank }) => (
      <motion.div 
        className="flex flex-col"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: rank * 0.05 }}
      >
        <motion.div 
          className="bg-transparent border border-white/5 rounded-lg overflow-hidden aspect-[2/3] relative" 
          style={{ boxSizing: 'border-box' }}
          whileHover={{ borderColor: '#ffffff' }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {rank && (
            <div className="absolute top-2 right-2 z-10 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-medium text-lg">
              {rank}
            </div>
          )}
          {item.coverImage && (
            <motion.img 
              src={item.coverImage} 
              alt={item.title} 
              crossOrigin="anonymous" 
              className="w-full h-full object-cover"
              whileHover={hoverImage}
            />
          )}
        </motion.div>
        <div className="mt-2">
          <h3 className="title-md truncate">{item.title}</h3>
          <div className="flex items-center body-md text-yellow-300">
            <span className="mr-1">★</span>
            <span>{item.userRating?.toFixed(1) || 'N/A'}</span>
          </div>
        </div>
      </motion.div>
    );

    switch (slide.id) {
      case 'welcome':
        return (
          <SlideLayout verticalText="INITIALIZE" bgColor="pink">
            <div className="text-center relative w-full h-full flex flex-col items-center justify-center">
              {/* Colorful abstract shapes background */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
                {/* Large layered organic shape (left side) */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-96 h-96 opacity-60" style={{
                  background: 'radial-gradient(ellipse at center, rgba(255, 0, 100, 0.4) 0%, rgba(200, 0, 150, 0.3) 30%, rgba(100, 0, 200, 0.2) 60%, transparent 100%)',
                  clipPath: 'polygon(0% 20%, 40% 0%, 100% 30%, 80% 70%, 40% 100%, 0% 80%)',
                  transform: 'rotate(-15deg)',
                  filter: 'blur(80px)'
                }}></div>
                
                {/* Rainbow gradient rectangle (top right) */}
                <div className="absolute top-0 right-0 w-96 h-64 opacity-50" style={{
                  background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.5) 0%, rgba(75, 0, 130, 0.4) 20%, rgba(0, 0, 255, 0.3) 40%, rgba(0, 255, 255, 0.3) 60%, rgba(0, 255, 0, 0.3) 80%, rgba(255, 255, 0, 0.4) 100%)',
                  clipPath: 'polygon(20% 0%, 100% 0%, 100% 80%, 0% 100%)',
                  filter: 'blur(70px)'
                }}></div>
                
                {/* Purple glow (center) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-40" style={{
                  background: 'radial-gradient(circle, rgba(138, 43, 226, 0.3) 0%, rgba(75, 0, 130, 0.2) 50%, transparent 100%)',
                  filter: 'blur(100px)'
                }}></div>
                
                {/* Rainbow accent (bottom right) */}
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 opacity-50" style={{
                  background: 'linear-gradient(135deg, rgba(255, 0, 0, 0.3) 0%, rgba(255, 165, 0, 0.3) 25%, rgba(255, 255, 0, 0.3) 50%, rgba(0, 255, 0, 0.3) 75%, rgba(0, 0, 255, 0.3) 100%)',
                  filter: 'blur(70px)'
                }}></div>
              </div>
              
              <div className="relative z-20">
              <motion.div {...fadeIn} data-framer-motion>
                  <div className="relative inline-block">
                    <h1 className="wrapped-brand text-white/60 mb-0 relative z-10" style={{ 
                      marginBottom: '-0.2em'
                    }}>
                      {stats.selectedYear === 'all' ? 'MyAnimeList' : 'MyAnimeList ' + stats.selectedYear}
                    </h1>
                    <h2 className="wrapped-title text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white relative z-10">
                      Wrapped
                    </h2>
                  </div>
                  <p className="text-lg font-semibold text-white mt-6">A look back at your {stats.selectedYear === 'all' ? 'anime journey' : 'year'}, <span className="text-white font-medium">{username || 'a'}</span>.</p>
              </motion.div>
              </div>
            </div>
          </SlideLayout>
        );

      case 'anime_count':
        if (stats.thisYearAnime.length === 0) {
          return (
            <SlideLayout verticalText="ANIME-LOG" bgColor="blue">
              <motion.div className="text-center relative z-10" {...fadeSlideUp} data-framer-motion>
                <h2 className="heading-md text-white mb-4">
                  You didn't watch any anime {stats.selectedYear === 'all' ? '' : 'in ' + stats.selectedYear}.
                </h2>
                <p className="body-md text-white/80 mb-6">
                  Log your watched anime on MyAnimeList to see your personalized wrapped!
                </p>
                <motion.a
                  href="https://myanimelist.net/panel.php?go=edit&type=anime"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-white text-black font-medium text-lg px-8 py-3 rounded-full hover:bg-gray-100 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Log Anime on MAL
                </motion.a>
              </motion.div>
            </SlideLayout>
          );
        }
        const animeCarouselItems = stats.thisYearAnime.map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          malId: item.node?.id
        }));
        return (
          <SlideLayout verticalText="ANIME-LOG" bgColor="blue">
            <motion.h2 className="body-md font-regular text-white text-center relative z-10" {...fadeSlideUp} data-framer-motion>
            {stats.selectedYear === 'all' ? 'Overall' : 'In ' + stats.selectedYear}, you binged through
            </motion.h2>
            <motion.div className="mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
              <p className="number-xl text-white ">
                <AnimatedNumber value={stats.thisYearAnime.length} /> anime
              </p>
              
            </motion.div>
            {animeCarouselItems.length > 0 && <div className="relative z-10"><ImageCarousel items={animeCarouselItems} maxItems={50} showHover={true} showNames={false} /></div>}
            <p className="body-sm text-white mt-4 text-center font-regular">Now that's dedication.</p>
          </SlideLayout>
        );

      case 'anime_time':
        return (
          <SlideLayout verticalText="TIME-ANALYSIS" bgColor="green">
            <motion.h2 className="body-md font-regular text-white  text-center relative z-10" {...fadeSlideUp} data-framer-motion>
            That adds up to
            </motion.h2>
            <motion.div className="mt-4 space-y-4 relative z-10" {...fadeSlideUp} data-framer-motion>
              <div className="text-center">
                <p className="number-lg text-white ">
                  <AnimatedNumber value={stats.totalEpisodes || 0} />
                </p>
                <p className="body-md text-white font-regular">episodes</p>
                <p className="body-sm text-white/50 mt-2 font-regular">and</p>
              </div>
              <div className="text-center">
                <p className="number-lg text-white ">
                  <AnimatedNumber value={stats.totalSeasons || 0} />
                </p>
                <p className="body-md text-white font-regular">seasons</p>
                <p className="body-sm text-white/50 mt-2 font-regular">or basically,</p>
              </div>
              <div className="text-center">
                {stats.watchDays > 0 ? (
                  <>
                    <p className="number-lg text-white ">
                      <AnimatedNumber value={stats.watchDays} />
                    </p>
                    <p className="body-md text-white font-medium">days</p>
                    <p className="body-sm text-white/50 mt-2 font-regular">of your life gone.</p>                  </>
                ) : (
                  <>
                    <p className="number-lg text-white ">
                      <AnimatedNumber value={stats.watchTime} />
                    </p>
                    <p className="heading-md text-white font-medium">hours</p>
                    <p className="body-sm text-white/50 mt-2 font-regular">of your life gone.</p>
                  </>
                )}
              </div>
            </motion.div>
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
          <SlideLayout verticalText="GENRE-MATRIX" bgColor="yellow">
            <motion.h2 className="body-md font-regular text-white text-center relative z-10" {...fadeSlideUp} data-framer-motion>
            But you kept coming back to the same genres
            </motion.h2>
            {topGenre ? (
              <>
                <motion.div className="mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
                  <p className="heading-lg font-semibold text-white ">1. {topGenre}</p>
                  <p className="mono text-white/50 font-regular">{stats.topGenres[0][1]} shows</p>
                </motion.div>
                {genreAnime.length > 0 && <div className="relative z-10"><ImageCarousel items={genreAnime} maxItems={30} showHover={true} showNames={false} /></div>}
                {otherGenres.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 relative z-10">
                    {otherGenres.map(([genreName, count], idx) => (
                      <motion.div key={idx} className="border-box-cyan text-center rounded-xl shadow-lg" style={{ padding: '2px' }} variants={staggerItem}>
                        <motion.div 
                          className="bg-white/5 rounded-xl p-2 h-full"
                          whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                          transition={{ duration: 0.2 }}
                        >
                          <p className="heading-sm font-semibold text-white">{idx + 2}. {genreName}</p>
                          <p className="mono text-white/50 font-regular">{count} shows</p>
                      </motion.div>
                      </motion.div>
                    ))}
                    
                  </div>
                  
                )}
                <motion.h2 className="body-sm font-regular text-white/50 mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>You know what you love
            </motion.h2>
              </>
              
            ) : (
              <div className="body-sm font-regular text-white/50 mt-4 text-center relative z-10">No genres topped your list this year</div>
            )}
            
          </SlideLayout>
        );

      case 'drumroll_anime':
        return <DrumrollSlide 
          type="anime" 
          topItem={stats.topRated.length > 0 ? stats.topRated[0] : null}
          verticalText="DRUMROLL"
        />;

      case 'top_5_anime':
        return <Top5Slide 
          type="anime" 
          top5Items={stats.topRated.slice(0, 5)}
          verticalText="TOP-5"
        />;


      case 'top_studio':
        const topStudio = stats.topStudios && stats.topStudios.length > 0 ? stats.topStudios[0][0] : null;
        const topStudioAnimeRaw = topStudio ? stats.thisYearAnime.filter(item => 
          item.node?.studios?.some(s => s.name === topStudio)
        ) : [];
        
        // Deduplicate anime by title to avoid showing the same work multiple times
        const topStudioAnimeMap = new Map();
        topStudioAnimeRaw.forEach(item => {
          const title = item.node?.title || '';
          if (title && !topStudioAnimeMap.has(title)) {
            topStudioAnimeMap.set(title, item);
          }
        });
        const topStudioAnime = Array.from(topStudioAnimeMap.values());
        
        const studioAnime = topStudioAnime.map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          malId: item.node?.id
        }));
        const otherStudios = stats.topStudios?.slice(1, 5) || [];
        return (
          <SlideLayout verticalText="PRODUCTION" bgColor="red">
            <div className="text-center relative">
            <motion.h2 className="body-md font-regular text-white text-center  relative z-10" {...fadeSlideUp} data-framer-motion>
            These studios made the most of what you loved
            </motion.h2>
            </div>
            {topStudio ? (
              <>
                <motion.div className="mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
                  <p className="heading-lg font-semibold text-white ">1. {topStudio}</p>
                  <p className="mono text-white/50 font-regular">{stats.topStudios[0][1]} shows watched</p>
                </motion.div>
                {studioAnime.length > 0 && (
                  <div className="relative z-10"><ImageCarousel items={studioAnime} maxItems={30} showHover={true} showNames={false} /></div>
                )}
                {otherStudios.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 relative z-10">
                    {otherStudios.map(([studioName, count], idx) => (
                      <motion.div key={idx} className="border-box-cyan text-center rounded-xl shadow-lg" style={{ padding: '2px' }} variants={staggerItem}>
                        <motion.div 
                          className="bg-white/5 rounded-xl p-2 h-full"
                          whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                          transition={{ duration: 0.2 }}
                        >
                          <p className="heading-sm font-semibold text-white truncate">{idx + 2}. {studioName}</p>
                          <p className="mono text-white/50 font-regular">{count} shows watched</p>
                      </motion.div>
                      </motion.div>
                    ))}
                  </div>
                  
                )}
                <motion.h2 className="body-sm font-regular text-white/50 text-center mt-4 relative z-10" {...fadeSlideUp} data-framer-motion>
                Loyalty this strong deserves acknowledgment
            </motion.h2>
              </>
            ) : (
              <motion.h2 className="body-md font-regular text-white/50 text-center  relative z-10" {...fadeSlideUp} data-framer-motion>
            No studio data available.
            </motion.h2>
            )}
          </SlideLayout>
        );

      case 'seasonal_highlights':
        const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];
        return (
          <SlideLayout verticalText="SEASONAL" bgColor="pink">
            <div className="text-center relative">
              <motion.h2 className="body-md font-regular text-white text-center  relative z-10" {...fadeSlideUp} data-framer-motion>
              Each season dropped something special
            </motion.h2>
            </div>
            <div className="mt-2 sm:mt-4 flex flex-col md:grid md:grid-cols-2 gap-1.5 sm:gap-2 relative z-10">
              {seasons.map(season => {
                const seasonData = stats.seasonalHighlights?.[season];
                if (!seasonData) return null;
                const highlight = seasonData.highlight;
                const seasonIndex = seasons.indexOf(season);
                return (
                  <motion.div 
                    key={season} 
                    className="border-box-cyan rounded-xl shadow-lg" 
                    style={{ padding: '2px' }}
                    variants={staggerItem}
                    initial="initial"
                    animate="animate"
                  >
                    <motion.div 
                      className="bg-black/20 rounded-xl p-1.5 sm:p-2 h-full"
                      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                      transition={{ duration: 0.2 }}
                    >
                      <h3 className="heading-md font-semibold text-white mb-1 sm:mb-2 text-sm sm:text-base">{season}</h3>
                    {highlight && (
                      <>
                          <div className="flex gap-1.5 sm:gap-2">
                            <motion.div 
                              className="border-box-cyan aspect-[2/3] rounded-xl overflow-hidden flex-shrink-0 shadow-md relative w-12 sm:w-16 md:w-20" 
                              style={{ boxSizing: 'border-box', padding: '2px' }}
                              transition={{ duration: 0.3 }}
                            >
                              <div className="bg-transparent rounded-xl w-full h-full overflow-hidden">
                            {highlight.node?.main_picture?.large && (
                                  <motion.img 
                                    src={highlight.node.main_picture.large} 
                                    alt={highlight.node.title} 
                                    crossOrigin="anonymous" 
                                    className="w-full h-full object-cover rounded-xl"
                                    whileHover={hoverImage}
                                  />
                            )}
                              </div>
                            </motion.div>
                          <div className="flex-1 min-w-0">
                              <p className="title-md truncate font-semibold text-white text-xs sm:text-sm md:text-base">{highlight.node?.title}</p>
                              <p className="body-md text-white truncate font-medium text-xs sm:text-sm">{highlight.node?.studios?.[0]?.name || ''}</p>
                              <p className="body-md text-yellow-300 mt-1 sm:mt-2 font-medium text-xs sm:text-sm">★ {highlight.list_status?.score || 'N/A'}</p>
                              <p className="body-sm text-white/80 mt-1 sm:mt-2 font-semibold text-xs sm:text-sm">{seasonData.totalAnime} anime</p>
                          </div>
                        </div>
                      </>
                    )}
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
            <motion.h2 className="body-sm font-regular text-white mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>What a ride that was.
            </motion.h2>
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
          <SlideLayout verticalText="HIDDEN-GEMS" bgColor="blue">
            <motion.h2 className="body-md font-regular text-white text-center  relative z-10" {...fadeSlideUp} data-framer-motion>
            You found some underrated gems most missed
            </motion.h2>
            {gems.length > 0 ? (
              <motion.div className="relative z-10" {...fadeSlideUp} data-framer-motion>
                <GridImages items={gems} maxItems={5} />
                <motion.h2 className="body-sm font-regular text-white mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>Certified sleeper agent.
            </motion.h2>
              </motion.div>
              
              
            ) : (
              <motion.div className="mt-4 text-center text-white/50" {...fadeSlideUp} data-framer-motion>No hidden gems found</motion.div>
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
          <SlideLayout verticalText="DIDNT-LAND" bgColor="red">
            <motion.h2 className="body-md font-regular text-white text-center relative z-10" {...fadeSlideUp} data-framer-motion>
            But hey, not everything was a win.
            </motion.h2>
            {didntLand.length > 0 ? (
              <motion.div className="relative z-10" {...fadeSlideUp} data-framer-motion>
                <GridImages items={didntLand} maxItems={5} />
              </motion.div>
            ) : (
              <motion.div className="mt-4  text-center text-white/50" {...fadeSlideUp} data-framer-motion>No data available</motion.div>
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
          <SlideLayout verticalText="PLANNED" bgColor="green">
            <div className="text-center relative">
              <motion.h1 className="relative z-10 heading-md text-white font-semibold pb-2 px-2 inline-block " {...fadeSlideUp} data-framer-motion>
                Planned to Watch
              </motion.h1>
            </div>
            <motion.h2 className="body-lg font-medium text-white mt-2 text-center  relative z-10" {...fadeSlideUp} data-framer-motion>
              5 shows you plan to watch {stats.selectedYear === 'all' ? '' : 'this year'}.
            </motion.h2>
            {plannedAnimeItems.length > 0 ? (
              <motion.div className="relative z-10" {...fadeSlideUp} data-framer-motion>
                <GridImages items={plannedAnimeItems} maxItems={5} />
              </motion.div>
            ) : (
              <motion.div className="mt-4 text-center text-white/50" {...fadeSlideUp} data-framer-motion>No planned anime found</motion.div>
            )}
          </SlideLayout>
        );


      case 'manga_count':
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
        
        if (allMangaItems.length === 0) {
          return (
            <SlideLayout verticalText="MANGA-LOG" bgColor="yellow">
              <motion.div className="text-center relative z-10" {...fadeSlideUp} data-framer-motion>
                <h2 className="heading-md text-white mb-4">
                  You didn't read any manga {stats.selectedYear === 'all' ? '' : 'in ' + stats.selectedYear}.
                </h2>
                <p className="body-md text-white/80 mb-6">
                  Log your read manga on MyAnimeList to see your personalized wrapped!
                </p>
                <motion.a
                  href="https://myanimelist.net/panel.php?go=edit&type=manga"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-white text-black font-medium text-lg px-8 py-3 rounded-full hover:bg-gray-100 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Log Manga on MAL
                </motion.a>
              </motion.div>
            </SlideLayout>
          );
        }
        
        return (
          <SlideLayout verticalText="MANGA-LOG" bgColor="yellow">
            <div className="text-center relative">
              <motion.h1 className="relative z-10 heading-md text-white font-semibold pb-2 px-2 inline-block " {...fadeSlideUp} data-framer-motion>
              {stats.selectedYear === 'all' ? 'All Time' : stats.selectedYear} Manga Read
            </motion.h1>
            </div>
            <motion.div className="mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
              <p className="number-xl text-white ">
                <AnimatedNumber value={stats.totalManga} />
              </p>
              <p className="heading-sm text-white mt-2 font-regular">Manga Series</p>
            </motion.div>
            {allMangaItems.length > 0 && <ImageCarousel items={allMangaItems} maxItems={50} showHover={true} showNames={false} />}
          </SlideLayout>
        );

      case 'manga_time':
        return (
          <SlideLayout verticalText="READING-TIME" bgColor="blue">
            <div className="text-center relative">
              <motion.h1 className="relative z-10 heading-md text-white font-semibold pb-2 px-2 inline-block " {...fadeSlideUp} data-framer-motion>
              Reading Stats
              </motion.h1>
            </div>
            <motion.div className="mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
              <div className="space-y-4">
                <div>
                  <p className="number-lg text-white ">
                    <AnimatedNumber value={stats.totalChapters || 0} />
                  </p>
                  <p className="heading-sm text-white mt-2 font-regular">Chapters</p>
                </div>
                <div>
                  <p className="number-lg text-white ">
                    <AnimatedNumber value={stats.totalVolumes || 0} />
                  </p>
                  <p className="heading-sm text-white mt-2 font-regular">Volumes</p>
                </div>
                {stats.mangaDays > 0 ? (
                  <div>
                    <p className="number-lg text-white ">
                      <AnimatedNumber value={stats.mangaDays} />
                    </p>
                    <p className="heading-sm text-white mt-2 font-regular">Days</p>
                    <p className="body-md text-white/80 mt-2 font-regular">(or <AnimatedNumber value={stats.mangaHours || 0} /> hours)</p>
                  </div>
                ) : (
                  <div>
                    <p className="number-lg text-white ">
                      <AnimatedNumber value={stats.mangaHours || 0} />
                    </p>
                    <p className="heading-md text-white mt-2 font-medium">Hours</p>
                  </div>
                )}
              </div>
            </motion.div>
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
          <SlideLayout verticalText="GENRE-MATRIX" bgColor="yellow">
            <div className="text-center relative">
              <motion.h1 className="relative z-10 heading-md text-white font-semibold pb-2 px-2 inline-block " {...fadeSlideUp} data-framer-motion>
              Most Read Genre
              </motion.h1>
            </div>
            {topMangaGenre ? (
              <>
                <motion.div className="mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
                  <p className="body-md text-white font-medium mb-2">#1</p>
                  <p className="heading-lg font-semibold text-white ">{topMangaGenre[0]}</p>
                  <p className="body-md text-white/80 mt-2 font-regular">{topMangaGenre[1]} entries</p>
                </motion.div>
                {mangaGenreItems.length > 0 && <div className="relative z-10"><ImageCarousel items={mangaGenreItems} maxItems={30} showHover={true} showNames={false} /></div>}
                {otherMangaGenres.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 relative z-10">
                    {otherMangaGenres.map(([genreName, count], idx) => (
                      <motion.div key={idx} className="border-box-cyan text-center rounded-xl shadow-lg" style={{ padding: '2px' }} variants={staggerItem}>
                        <motion.div 
                          className="bg-white/5 rounded-xl p-2 h-full"
                          whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                          transition={{ duration: 0.2 }}
                        >
                          <p className="body-sm text-white font-medium mb-2">#{idx + 2}</p>
                          <p className="heading-sm font-semibold text-white">{genreName}</p>
                          <p className="body-sm text-white/80 font-regular">{count} entries</p>
                      </motion.div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4 text-center text-white/50">No genre data available</div>
            )}
          </SlideLayout>
        );

      case 'drumroll_manga':
        return <DrumrollSlide 
          type="manga" 
          topItem={stats.topManga.length > 0 ? stats.topManga[0] : null}
          verticalText="DRUMROLL"
        />;

      case 'top_5_manga':
        return <Top5Slide 
          type="manga" 
          top5Items={stats.topManga.slice(0, 5)}
          verticalText="TOP-5"
        />;


      case 'top_author':
        const topAuthor = stats.topAuthors && stats.topAuthors.length > 0 ? stats.topAuthors[0][0] : null;
        const normalizeAuthorName = (first, last) => {
          return `${(first || '').trim()} ${(last || '').trim()}`.trim().replace(/\s+/g, ' ');
        };
        
        const topAuthorMangaRaw = topAuthor ? (mangaListData || []).filter(item => {
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
            const name = normalizeAuthorName(
              a.node?.first_name || '',
              a.node?.last_name || ''
            );
            return name === topAuthor;
          });
        }) : [];
        
        // Deduplicate manga by title to avoid showing the same work multiple times
        const topAuthorMangaMap = new Map();
        topAuthorMangaRaw.forEach(item => {
          const title = item.node?.title || '';
          if (title && !topAuthorMangaMap.has(title)) {
            topAuthorMangaMap.set(title, item);
          }
        });
        const topAuthorManga = Array.from(topAuthorMangaMap.values());
        
        const authorManga = topAuthorManga.map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          mangaId: item.node?.id
        }));
        const otherAuthors = stats.topAuthors?.slice(1, 5) || [];
        return (
          <SlideLayout verticalText="CREATORS" bgColor="pink">
            <div className="text-center relative">
              <motion.h1 className="relative z-10 heading-md text-white font-semibold pb-2 px-2 inline-block " {...fadeSlideUp} data-framer-motion>
                Your Favorite Author
              </motion.h1>
            </div>
            {topAuthor ? (
              <>
                <motion.div className="mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
                  <p className="body-md text-white font-medium mb-2">#1</p>
                  <p className="heading-lg font-semibold text-white ">{topAuthor}</p>
                  <p className="body-md text-white/80 mt-2 font-regular">{stats.topAuthors[0][1]} entries</p>
                </motion.div>
                {authorManga.length > 0 && (
                  <div className="relative z-10"><ImageCarousel items={authorManga} maxItems={30} showHover={true} showNames={false} /></div>
                )}
                {otherAuthors.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 relative z-10">
                    {otherAuthors.map(([authorName, count], idx) => (
                      <motion.div key={idx} className="border-box-cyan text-center rounded-xl shadow-lg" style={{ padding: '2px' }} variants={staggerItem}>
                        <motion.div 
                          className="bg-white/5 rounded-xl p-2 h-full"
                          whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                          transition={{ duration: 0.2 }}
                        >
                          <p className="body-sm text-white font-medium mb-2">#{idx + 2}</p>
                          <p className="heading-sm font-semibold text-white truncate">{authorName}</p>
                          <p className="body-sm text-white/80 font-regular">{count} entries</p>
                      </motion.div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4 text-center text-white/50">No author data available</div>
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
          <SlideLayout verticalText="HIDDEN-GEMS" bgColor="blue">
            <div className="text-center relative">
              <motion.h1 className="relative z-10 heading-md text-white font-semibold pb-2 px-2 inline-block " {...fadeSlideUp} data-framer-motion>
                Hidden Gems
              </motion.h1>
            </div>
            <motion.h2 className="body-md font-regular text-white mt-2 text-center  relative z-10" {...fadeSlideUp} data-framer-motion>
              High-rated manga with low popularity
            </motion.h2>
            {mangaGems.length > 0 ? (
              <motion.div {...fadeSlideUp} data-framer-motion>
                <GridImages items={mangaGems} maxItems={5} />
              </motion.div>
            ) : (
              <motion.div className="mt-4 text-center text-white/50" {...fadeSlideUp} data-framer-motion>No hidden gems found</motion.div>
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
          <SlideLayout verticalText="DIDNT-LAND" bgColor="red">
            <motion.h2 className="body-md font-regular text-white mt-2 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
            But even great readers hit a few misses, and these were the ones that didn’t click.
            </motion.h2>
            {mangaDidntLand.length > 0 ? (
              <motion.div {...fadeSlideUp} data-framer-motion>
                <GridImages items={mangaDidntLand} maxItems={5} />
              </motion.div>
            ) : (
              <motion.div className="body-md font-regular text-white/50 mt-2 text-center relative z-10" {...fadeSlideUp} data-framer-motion>No data available</motion.div>
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
          <SlideLayout verticalText="PLANNED" bgColor="green">
            <motion.h2 className="body-md font-regular text-white mt-2 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
              Mangas you planned to read {stats.selectedYear === 'all' ? '' : 'this year'}, but haven't yet.
            </motion.h2>
            {plannedMangaItems.length > 0 ? (
              <motion.div {...fadeSlideUp} data-framer-motion>
                <GridImages items={plannedMangaItems} maxItems={5} />
              </motion.div>
            ) : (
              <motion.div className="body-md font-regular text-white/50 mt-2 text-center relative z-10" {...fadeSlideUp} data-framer-motion>No planned manga found</motion.div>
            )}
          </SlideLayout>
        );


      case 'finale':
        const totalTimeSpent = stats.totalTimeSpent || 0;
        const totalDays = Math.floor(totalTimeSpent / 24);
        return (
          <SlideLayout verticalText="FINAL-REPORT" bgColor="blue">
            <div className="text-center relative">
              <motion.h1 className="relative z-10 heading-md text-white font-semibold pb-2 px-2 inline-block " {...fadeSlideUp} data-framer-motion>
              {stats.selectedYear === 'all' ? 'All Time' : stats.selectedYear} In Review
              </motion.h1>
            </div>
            <motion.div className="mt-2 sm:mt-4 flex flex-col gap-1 sm:gap-1.5 text-white w-full max-h-full overflow-hidden relative z-10" {...fadeSlideUp} data-framer-motion>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-1.5">
                <motion.div 
                  className="border-box-cyan rounded-xl flex flex-col shadow-lg" 
                  style={{ padding: '2px' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <motion.div 
                    className="bg-black/20 rounded-xl p-1.5 sm:p-2 flex flex-col h-full"
                    whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                    transition={{ duration: 0.2 }}
                  >
                  <p className="body-sm text-white mb-0.5 sm:mb-1 font-medium text-xs sm:text-sm">Top 5 Anime</p>
                  <div className="space-y-0 flex-grow">
                    {stats.topRated.slice(0, 5).map((a, i) => (
                        <p key={a.node.id} className="py-0 px-1 sm:px-2">
                          <span className="font-semibold text-white w-4 sm:w-6 inline-block text-xs sm:text-sm">{i+1}.</span><span className="heading-md text-white truncate font-medium text-xs sm:text-sm md:text-base">{a.node.title}</span>
                      </p>
                    ))}
                  </div>
                  </motion.div>
                </motion.div>
                <motion.div 
                  className="border-box-cyan rounded-xl flex flex-col shadow-lg" 
                  style={{ padding: '2px' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <motion.div 
                    className="bg-black/20 rounded-xl p-1.5 sm:p-2 flex flex-col h-full"
                    whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                    transition={{ duration: 0.2 }}
                  >
                  <p className="body-sm text-white mb-0.5 sm:mb-1 font-medium text-xs sm:text-sm">Top 5 Manga</p>
                  <div className="space-y-0 flex-grow">
                    {stats.topManga.slice(0, 5).map((m, i) => (
                        <p key={m.node.id} className="py-0 px-1 sm:px-2">
                          <span className="font-semibold text-white w-4 sm:w-6 inline-block text-xs sm:text-sm">{i+1}.</span><span className="heading-md text-white truncate font-medium text-xs sm:text-sm md:text-base">{m.node.title}</span>
                      </p>
                    ))}
                  </div>
                  </motion.div>
                </motion.div>
              </div>
              <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                <motion.div 
                  className="border-box-cyan rounded-xl shadow-lg" 
                  style={{ padding: '2px' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <motion.div 
                    className="bg-black/20 rounded-xl p-1.5 sm:p-2 h-full"
                    whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                    transition={{ duration: 0.2 }}
                  >
                  <p className="body-sm text-white mb-0.5 sm:mb-1 font-medium text-xs sm:text-sm">Episodes Watched</p>
                  <p className="number-md text-white  text-lg sm:text-xl md:text-2xl">
                    {stats.totalEpisodes || 0}
                  </p>
                  </motion.div>
                </motion.div>
                <motion.div 
                  className="border-box-cyan rounded-xl shadow-lg" 
                  style={{ padding: '2px' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <motion.div 
                    className="bg-black/20 rounded-xl p-1.5 sm:p-2 h-full"
                    whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                    transition={{ duration: 0.2 }}
                  >
                  <p className="body-sm text-white mb-0.5 sm:mb-1 font-medium text-xs sm:text-sm">Chapters Read</p>
                  <p className="number-md text-white  text-lg sm:text-xl md:text-2xl">
                    {stats.totalChapters || 0}
                  </p>
                  </motion.div>
                </motion.div>
                </div>
              <motion.div 
                className="border-box-cyan rounded-xl shadow-lg" 
                style={{ padding: '2px' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <motion.div 
                  className="bg-black/20 rounded-xl p-1.5 sm:p-2 h-full"
                  whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                  transition={{ duration: 0.2 }}
                >
                <p className="body-sm text-white mb-0.5 sm:mb-1 font-medium text-xs sm:text-sm">Total Time Spent</p>
                <p className="number-lg text-white  text-xl sm:text-2xl md:text-3xl">
                  {totalDays > 0 ? (
                    <>
                      {totalDays} Days
                      <span className="body-md text-white/80 ml-1 sm:ml-2 font-semibold text-xs sm:text-sm">({totalTimeSpent} hours)</span>
                    </>
                  ) : (
                    <>
                      {totalTimeSpent} Hours
                    </>
                  )}
                </p>
                </motion.div>
              </motion.div>
              <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                <motion.div 
                  className="border-box-cyan rounded-xl shadow-lg" 
                  style={{ padding: '2px' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <motion.div 
                    className="bg-black/20 rounded-xl p-1.5 sm:p-2 h-full"
                    whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                    transition={{ duration: 0.2 }}
                  >
                  <p className="body-sm text-white mb-0.5 sm:mb-1 font-medium text-xs sm:text-sm">Top Studio</p>
                  <p className="heading-md text-white truncate font-semibold text-xs sm:text-sm md:text-base">{stats.topStudios?.[0]?.[0] || 'N/A'}</p>
                  </motion.div>
                </motion.div>
                <motion.div 
                  className="border-box-cyan rounded-xl shadow-lg" 
                  style={{ padding: '2px' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <motion.div 
                    className="bg-black/20 rounded-xl p-1.5 sm:p-2 h-full"
                    whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                    transition={{ duration: 0.2 }}
                  >
                  <p className="body-sm text-white mb-0.5 sm:mb-1 font-medium text-xs sm:text-sm">Top Author</p>
                  <p className="heading-md text-white truncate font-semibold text-xs sm:text-sm md:text-base">{stats.topAuthors?.[0]?.[0] || 'N/A'}</p>
                  </motion.div>
                </motion.div>
                  </div>
            </motion.div>
          </SlideLayout>
        );

      default:
        return null;
    }
  }

  return (
    <motion.main 
      className="bg-black text-white w-screen flex items-center justify-center p-2 selection:bg-white selection:text-black relative overflow-hidden" 
      style={{ 
        height: '100dvh',
        backgroundColor: '#000000',
        backgroundImage: `
          linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }}
      animate={{
        backgroundPosition: ['0 0', '40px 40px']
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'linear'
      }}
      data-framer-motion
    >
      {/* Background floating anime elements - outside the card on grid bg */}
      {stats && isAuthenticated && slides.length > 0 && (
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden" style={{ zIndex: 0 }}>
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
                <motion.img
                  key={idx}
                  src={image}
                  alt=""
                  className="absolute w-24 h-36 md:w-32 md:h-48 object-cover rounded-lg blur-md"
                  style={{
                    ...pos,
                    rotate: `${pos.rotate}deg`,
                  }}
                  {...float}
                  data-framer-motion
                />
              );
            });
          })()}
        </div>
      )}
      <div ref={slideRef} className="w-full max-w-5xl bg-black rounded-2xl shadow-2xl shadow-black/50 flex flex-col justify-center relative overflow-hidden slide-card" style={{ zIndex: 10, height: '100dvh', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div className="z-10 w-full h-full flex flex-col items-center justify-center">
          {error && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg z-50">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="text-center">
              <motion.div className="text-white mb-4 text-4xl" {...pulse} data-framer-motion>*</motion.div>
              <h1 className="text-3xl text-white tracking-widest">{loadingProgress || 'Generating your report...'}</h1>
            </div>
          )}

          {!isAuthenticated && !isLoading && (
            <div className="text-center p-4 relative w-full h-full flex flex-col items-center justify-center">
              {/* Colorful abstract shapes background */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
                {/* Large layered organic shape (left side) */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-96 h-96 opacity-60 rounded-full" style={{
                  background: 'radial-gradient(ellipse at center, rgba(255, 0, 100, 0.4) 0%, rgba(200, 0, 150, 0.3) 30%, rgba(100, 0, 200, 0.2) 60%, transparent 100%)',
                  transform: 'rotate(-15deg)',
                  filter: 'blur(120px)'
                }}></div>
                
                {/* Rainbow gradient rectangle (top right) */}
                <div className="absolute top-0 right-0 w-96 h-64 opacity-50 rounded-3xl" style={{
                  background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.5) 0%, rgba(75, 0, 130, 0.4) 20%, rgba(0, 0, 255, 0.3) 40%, rgba(0, 255, 255, 0.3) 60%, rgba(0, 255, 0, 0.3) 80%, rgba(255, 255, 0, 0.4) 100%)',
                  filter: 'blur(120px)'
                }}></div>
                
                {/* Purple glow (center) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-40 rounded-full" style={{
                  background: 'radial-gradient(circle, rgba(138, 43, 226, 0.3) 0%, rgba(75, 0, 130, 0.2) 50%, transparent 100%)',
                  filter: 'blur(140px)'
                }}></div>
                
                {/* Rainbow accent (bottom right) */}
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 opacity-50 rounded-full" style={{
                  background: 'linear-gradient(135deg, rgba(255, 0, 0, 0.3) 0%, rgba(255, 165, 0, 0.3) 25%, rgba(255, 255, 0, 0.3) 50%, rgba(0, 255, 0, 0.3) 75%, rgba(0, 0, 255, 0.3) 100%)',
                  filter: 'blur(120px)'
                }}></div>
              </div>
              
              <div className="relative z-10">
                <motion.div {...fadeIn100} data-framer-motion>
                  <div className="relative inline-block">
                    <h1 className="wrapped-brand text-white/60 mb-0 relative z-10" style={{ 
                      marginBottom: '-0.2em'
                    }}>
                      MyAnimeList
                    </h1>
                    <h2 className="wrapped-title text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white relative z-10">
                      {selectedYear === 'all' ? 'Wrapped' : selectedYear + ' Wrapped'}
                    </h2>
                  </div>
                </motion.div>
                <motion.p className="mt-6 text-lg sm:text-xl text-white/80 max-w-md mx-auto" {...fadeIn300} data-framer-motion>Enter your MyAnimeList username to see your year in review.</motion.p>
              <motion.div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center" {...fadeIn} data-framer-motion>
                  <motion.button
                  onClick={handleBegin}
                    className="bg-white text-black font-medium text-lg px-8 py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!CLIENT_ID || CLIENT_ID === '<your_client_id_here>'}
                    whileHover={{ scale: 1.05, backgroundColor: '#f5f5f5' }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
              Connect with MAL
                  </motion.button>
                </motion.div>
              </div>
            </div>
          )}

          {isAuthenticated && stats && slides.length > 0 && (
            <div className="w-full h-full flex flex-col overflow-hidden">
              {/* Top Bar - Year Selector and Download */}
              <div className="flex-shrink-0 px-3 sm:px-4 md:px-6 pt-3 pb-2 flex items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="relative min-w-[120px] sm:min-w-[140px]">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                      className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-white rounded-full border-box-cyan transition-all rounded-lg text-xs sm:text-sm font-medium tracking-wider focus:outline-none appearance-none pr-8 sm:pr-10"
                      style={{ 
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#ffffff'
                      }}
                    >
                      <option value="2023" style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff' }}>2023</option>
                      <option value="2024" style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff' }}>2024</option>
                      <option value="2025" style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff' }}>2025</option>
                      <option value="all" style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff' }}>All Time</option>
                  </select>
                    <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <button onClick={handleDownloadPNG} className="p-1.5 sm:p-2 text-white rounded-full border-box-cyan transition-all" title="Download Slide">
                    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
                <button onClick={handleLogout} className="p-1.5 sm:p-2 text-white rounded-full border-box-cyan transition-all flex items-center gap-1.5 sm:gap-2" title="Logout">
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-sm font-medium hidden sm:inline">Logout</span>
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
                        className={`h-full rounded-full transition-all duration-500 ease-out ${isActive ? 'bg-white' : 'bg-white/30'}`} 
                        style={{ width: (isCompleted || isActive) ? '100%' : '0%' }} 
                      />
                    </div>
                  );
                })}
              </div>
              
              {/* Slide Content */}
              <div key={currentSlide} className="w-full flex-grow flex items-center justify-center overflow-y-auto py-2 sm:py-4">
                <div className="w-full h-full relative overflow-y-auto">
                  <SlideContent slide={slides[currentSlide]} mangaListData={mangaList} />
                </div>
              </div>
              
              {/* Bottom Controls */}
              <div className="flex-shrink-0 w-full px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 flex items-center justify-between gap-2">
              <button
                onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                disabled={currentSlide === 0}
                  className="p-1.5 sm:p-2 text-white rounded-full border-box-cyan disabled:opacity-30 transition-all"
              >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6"/>
              </button>
                
                <p className="text-white/60 text-xs sm:text-sm md:text-base font-mono py-1.5 sm:py-2 px-2 sm:px-4 rounded-full border-box-cyan ">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</p>

                {currentSlide === slides.length - 1 ? (
                  <motion.button
                    onClick={async () => {
                      try {
                        // First download the image
                        await handleDownloadPNG();
                        
                        // Then try to share using Web Share API
                        if (navigator.share && navigator.canShare) {
                          const shareData = {
                            title: `My ${stats?.selectedYear || '2024'} MAL Wrapped`,
                            text: `Check out my ${stats?.selectedYear || '2024'} MyAnimeList Wrapped! Check yours out at ${window.location.href}`,
                          };
                          
                          if (navigator.canShare(shareData)) {
                            await navigator.share(shareData);
                          }
                        }
                      } catch (error) {
                        // If share fails, user cancelled, or isn't supported - download already happened
                        if (error.name !== 'AbortError') {
                          console.log('Share not available or failed');
                        }
                      }
                    }}
                    className="p-1.5 sm:p-2 text-white rounded-full border-box-cyan transition-all flex items-center gap-1.5 sm:gap-2"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-xs sm:text-sm md:text-base font-medium">Share</span>
                  </motion.button>
                ) : (
                  <motion.button
                onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
                    className="p-1.5 sm:p-2 text-white rounded-full border-box-cyan"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ duration: 0.2 }}
              >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6"/>
              </motion.button>
                )}
            </div>
            </div>
        )}
      </div>
    </div>
    </motion.main>
  );
}