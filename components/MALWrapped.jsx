import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Download, LogOut, Share2, Github, Youtube, Linkedin, Instagram, ExternalLink, Copy } from 'lucide-react';
import { motion } from 'framer-motion';

// MyAnimeList Icon Component
const MyAnimeListIcon = ({ size = 20, className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fill="currentColor" d="M8.273 7.247v8.423l-2.103-.003v-5.216l-2.03 2.404l-1.989-2.458l-.02 5.285H.001L0 7.247h2.203l1.865 2.545l2.015-2.546l2.19.001zm8.628 2.069l.025 6.335h-2.365l-.008-2.871h-2.8c.07.499.21 1.266.417 1.779c.155.381.298.751.583 1.128l-1.705 1.125c-.349-.636-.622-1.337-.878-2.082a9.296 9.296 0 0 1-.507-2.179c-.085-.75-.097-1.471.107-2.212a3.908 3.908 0 0 1 1.161-1.866c.313-.293.749-.5 1.1-.687c.351-.187.743-.264 1.107-.359a7.405 7.405 0 0 1 1.191-.183c.398-.034 1.107-.066 2.39-.028l.545 1.749H14.51c-.593.008-.878.001-1.341.209a2.236 2.236 0 0 0-1.278 1.92l2.663.033l.038-1.81h2.309zm3.992-2.099v6.627l3.107.032l-.43 1.775h-4.807V7.187l2.13.03z"/>
  </svg>
);

const smoothEase = [0.25, 0.1, 0.25, 1];


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
  transition: { duration: 0.6, ease: smoothEase }
};

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.6, ease: smoothEase }
};

const fadeIn100 = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.2, ease: smoothEase }
};

const fadeIn300 = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.4, ease: smoothEase }
};

const pulse = {
  animate: {
    opacity: [1, 0.5, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: smoothEase
    }
  }
};

const float = {
  animate: {
    y: [0, -20, 0],
    transition: {
      duration: 8,
      repeat: Infinity,
      ease: smoothEase
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
      ease: smoothEase
    }
  }
};


const hoverImage = {
  scale: 1.1,
  transition: { duration: 0.3, ease: smoothEase }
};

// Animated Number Component using Framer Motion
function AnimatedNumber({ value, duration = 1.5, className = '' }) {
  const numValue = Number(value) || 0;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Reset to 0 when value changes
    setDisplayValue(0);
    
    // Animate to the target value
    const startTime = Date.now();
    const startValue = 0;
    const endValue = numValue;
    let animationFrameId;
    let cancelled = false;
    
    const animate = () => {
      if (cancelled) return;
      
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      
      // Gentler ease-out function: starts fast, slows down but not too much
      // Using quadratic ease-out instead of cubic for less extreme slowdown
      const eased = 1 - Math.pow(1 - progress, 2);
      
      const currentValue = startValue + (endValue - startValue) * eased;
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        // Ensure we end exactly at the target value
        setDisplayValue(endValue);
      }
    };
    
    animationFrameId = requestAnimationFrame(animate);
    
    return () => {
      cancelled = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [numValue, duration]);

  return (
    <motion.span 
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: smoothEase }}
    >
      {Math.floor(displayValue).toLocaleString()}
    </motion.span>
  );
}

function getComparisonCopy(percentage, nounPlural) {
  if (!percentage || percentage <= 0) return null;
  const isAboveAverage = percentage >= 100;
  return {
    prefix: isAboveAverage ? "That's " : "That's only ",
    suffix: isAboveAverage
      ? ` ${nounPlural} more compared to other MAL users. You’re leaving the crowd behind!`
      : ` ${nounPlural} compared to other MAL users. Don’t worry, every hero has a slower arc!`
  };
}

function getCompletionDays(startDate, finishDate) {
  if (!startDate || !finishDate) return null;
  const start = new Date(startDate);
  const end = new Date(finishDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = end.getTime() - start.getTime();
  if (diff < 0) return null;
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function MALWrapped() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [loadingProgressPercent, setLoadingProgressPercent] = useState(0);
  const [animeList, setAnimeList] = useState([]);
  const [mangaList, setMangaList] = useState([]);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const shareMenuRef = useRef(null);
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
      // { id: 'top_studio' },
      { id: 'seasonal_highlights' },
      { id: 'hidden_gems_anime' },
      { id: 'didnt_land_anime' },
      { id: 'planned_anime' },
      ...(stats.milestones && stats.milestones.length > 0 && stats.thisYearMilestone ? [{ id: 'milestones' }] : []),
    ] : []),
    { id: 'anime_to_manga_transition' },
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
    ...(stats.badges && stats.badges.length > 0 ? [{ id: 'badges' }] : []),
    ...(stats.characterTwin ? [{ id: 'character_twin' }] : []),
    { id: 'finale' },
  ] : [];

  
const bottomGradientBackground = 'linear-gradient(to top, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, .4) 25%, rgba(0, 0, 0, 0.2) 60%, rgba(0, 0, 0, .4) 80%, rgba(0, 0, 0, 1) 100%)';
  // Get website URL for watermark
  const websiteUrl = typeof window !== 'undefined' 
    ? window.location.origin.replace(/^https?:\/\//, '').toUpperCase()
    : 'MAL-WRAPPED.VERCEL.APP';

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
    setLoadingProgressPercent(10);
    
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
    setLoadingProgressPercent(20);
    
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
    setLoadingProgressPercent(25);
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
        
        allAnime = [...allAnime, ...data.data];
        setLoadingProgress(`Loaded ${allAnime.length} anime...`);
        
        // Update progress: 25% to 60% for anime loading
        if (data.paging?.next) {
          // Estimate progress based on items loaded (assume roughly similar batch sizes)
          // Use a logarithmic scale to slow down as we approach the end
          const estimatedProgress = Math.min(0.95, 1 - Math.pow(0.9, allAnime.length / 100));
          const animeProgress = 25 + (35 * estimatedProgress);
          setLoadingProgressPercent(Math.min(animeProgress, 60));
        } else {
          setLoadingProgressPercent(60);
        }
        
        if (!data.paging?.next) break;
        offset += limit;
      }

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
    setLoadingProgressPercent(65);
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
        setLoadingProgress(`Loaded ${allManga.length} manga...`);
        
        // Update progress: 65% to 95% for manga loading
        if (data.paging?.next) {
          // Estimate progress based on items loaded (assume roughly similar batch sizes)
          // Use a logarithmic scale to slow down as we approach the end
          const estimatedProgress = Math.min(0.95, 1 - Math.pow(0.9, allManga.length / 100));
          const mangaProgress = 65 + (30 * estimatedProgress);
          setLoadingProgressPercent(Math.min(mangaProgress, 95));
        } else {
          setLoadingProgressPercent(95);
        }
        
        if (!data.paging?.next) break;
        offset += limit;
      }
      
      setLoadingProgressPercent(100);

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
    
    // Helper function to deduplicate items by title
    const deduplicateByTitle = (items) => {
      const map = new Map();
      items.forEach(item => {
        const title = item.node?.title || '';
        if (title && !map.has(title)) {
          map.set(title, item);
        }
      });
      return Array.from(map.values());
    };
    
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
    const lowestRated = deduplicateByTitle(
      completedAnime
        .filter(item => item.list_status.score > 0 && item.list_status.score <= 6)
        .sort((a, b) => a.list_status.score - b.list_status.score)
    ).slice(0, 5);
    
    // Planned to watch (status: plan_to_watch) - deduplicate by title
    const plannedAnime = deduplicateByTitle(
      thisYearAnime.filter(item => item.list_status?.status === 'plan_to_watch')
    ).slice(0, 5);

    // Hidden gems (high rating, low popularity) - combine with rarest for merged slide
    const hiddenGemsRaw = completedAnime
      .filter(item => {
        const score = item.list_status.score;
        const popularity = item.node?.num_list_users ?? Number.MAX_SAFE_INTEGER;
        return score >= 7.5 && popularity < 75000;
      })
      .sort((a, b) => {
        if (b.list_status.score !== a.list_status.score) {
          return b.list_status.score - a.list_status.score;
        }
        const popularityA = a.node?.num_list_users ?? Number.MAX_SAFE_INTEGER;
        const popularityB = b.node?.num_list_users ?? Number.MAX_SAFE_INTEGER;
        return popularityA - popularityB;
      });
    const hiddenGems = deduplicateByTitle(hiddenGemsRaw).slice(0, 3);

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
    const lowestRatedManga = deduplicateByTitle(
      completedManga
        .filter(item => item.list_status.score > 0 && item.list_status.score <= 6)
        .sort((a, b) => a.list_status.score - b.list_status.score)
    ).slice(0, 5);
    
    // Hidden gems manga (high rating, low popularity) - 3 items, deduplicate by title
    const hiddenGemsMangaRaw = completedManga
      .filter(item => {
        const score = item.list_status.score;
        const popularity = item.node?.num_list_users ?? Number.MAX_SAFE_INTEGER;
        return score >= 8 && popularity < 50000;
      })
      .sort((a, b) => {
        if (b.list_status.score !== a.list_status.score) {
          return b.list_status.score - a.list_status.score;
        }
        const popularityA = a.node?.num_list_users ?? Number.MAX_SAFE_INTEGER;
        const popularityB = b.node?.num_list_users ?? Number.MAX_SAFE_INTEGER;
        return popularityA - popularityB;
      });
    const hiddenGemsManga = deduplicateByTitle(hiddenGemsMangaRaw).slice(0, 3);
    
    // Planned to read - deduplicate by title
    const plannedManga = deduplicateByTitle(
      filteredManga.filter(item => item.list_status?.status === 'plan_to_read')
    ).slice(0, 5);
    
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

    // ========== NEW UNIQUE FEATURES ==========
    
    // 1. Milestones & Achievements
    // Calculate total completed anime across all time (for milestone detection)
    const allCompletedAnime = anime.filter(item => item.list_status?.status === 'completed');
    const totalCompletedAnime = allCompletedAnime.length;
    const milestones = [];
    if (totalCompletedAnime >= 100) {
      milestones.push({ type: '100_completed', count: 100 });
    }
    if (totalCompletedAnime >= 250) {
      milestones.push({ type: '250_completed', count: 250 });
    }
    if (totalCompletedAnime >= 500) {
      milestones.push({ type: '500_completed', count: 500 });
    }
    if (totalCompletedAnime >= 1000) {
      milestones.push({ type: '1000_completed', count: 1000 });
    }
    
    // Check if user hit a milestone this year
    // Sort all completed anime by finish date to find which one was the milestone
    const sortedCompletedAnime = allCompletedAnime
      .filter(item => item.list_status?.finish_date)
      .sort((a, b) => {
        const dateA = new Date(a.list_status?.finish_date || 0);
        const dateB = new Date(b.list_status?.finish_date || 0);
        return dateA - dateB;
      });
    
    const thisYearMilestone = milestones.find(m => {
      // Check if the m.count-th completed anime was finished this year
      if (sortedCompletedAnime.length < m.count) return false;
      const milestoneItem = sortedCompletedAnime[m.count - 1];
      if (!milestoneItem) return false;
      const finishDate = milestoneItem.list_status?.finish_date;
      if (!finishDate) return false;
      try {
        const year = new Date(finishDate).getFullYear();
        return year === currentYear;
      } catch (e) {
        return false;
      }
    });

    // 2. Rarity Features - Hidden gems: least members (below threshold), sorted by user rating descending
    const HIDDEN_GEM_THRESHOLD = 70000;
    const allRareAnime = completedAnime
      .map(item => ({
        ...item,
        popularity: item.node?.num_list_users ?? Number.MAX_SAFE_INTEGER,
        score: item.list_status.score
      }))
      .filter(item => item.popularity <= HIDDEN_GEM_THRESHOLD) // Only members below threshold
      .sort((a, b) => {
        // Sort by user rating descending, then by popularity (least members first)
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.popularity - b.popularity;
      });
    
    const rareAnimeGems = deduplicateByTitle(allRareAnime).slice(0, 3);
    
    const allRareManga = completedManga
      .map(item => ({
        ...item,
        popularity: item.node?.num_list_users ?? Number.MAX_SAFE_INTEGER,
        score: item.list_status.score
      }))
      .filter(item => item.popularity <= HIDDEN_GEM_THRESHOLD)
      .sort((a, b) => {
        // Sort by user rating descending, then by popularity (least members first)
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.popularity - b.popularity;
      });
    
    const rareMangaGems = deduplicateByTitle(allRareManga).slice(0, 3);
    
    // Count hidden gems (rarer than threshold across anime + manga)
    const hiddenGemsCount = [...completedAnime, ...completedManga].filter(item => {
      const popularity = item.node?.num_list_users ?? Number.MAX_SAFE_INTEGER;
      return popularity <= HIDDEN_GEM_THRESHOLD;
    }).length;

    const hiddenGemsAnimeCount = [...completedAnime].filter(item => {
      const popularity = item.node?.num_list_users ?? Number.MAX_SAFE_INTEGER;
      return popularity <= HIDDEN_GEM_THRESHOLD;
    }).length;

    const hiddenGemsMangaCount = [...completedManga].filter(item => {
      const popularity = item.node?.num_list_users ?? Number.MAX_SAFE_INTEGER;
      return popularity <= HIDDEN_GEM_THRESHOLD;
    }).length;



    // 3. Streak Calculation (consecutive days watching)
    const watchDates = new Set();
    thisYearAnime.forEach(item => {
      const startDate = item.list_status?.start_date;
      const finishDate = item.list_status?.finish_date;
      const updatedAt = item.list_status?.updated_at;
      
      // Get all dates when user was active
      [startDate, finishDate, updatedAt].forEach(dateStr => {
        if (dateStr) {
          try {
            const date = new Date(dateStr);
            const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            watchDates.add(dateKey);
          } catch (e) {
            // Ignore invalid dates
          }
        }
      });
    });
    
    // Calculate longest streak
    const sortedDates = Array.from(watchDates).sort();
    let longestStreak = 0;
    let currentStreak = 0;
    let lastDate = null;
    
    sortedDates.forEach(dateStr => {
      const currentDate = new Date(dateStr);
      if (lastDate) {
        const daysDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
        if (daysDiff === 1) {
          currentStreak++;
        } else {
          longestStreak = Math.max(longestStreak, currentStreak);
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      lastDate = currentDate;
    });
    longestStreak = Math.max(longestStreak, currentStreak);

    // 4. Badge System - New badge definitions, only top 2
    const badgeCandidates = [];
    
    // The Hunter - Hidden gems (10+ rare anime/manga)
    if (hiddenGemsCount >= 10) {
      badgeCandidates.push({ 
        type: 'the_hunter', 
        name: 'The Hunter',
        description: `Gon seeks the rarest finds, and so do you. You’ve uncovered ${hiddenGemsCount} hidden gems most fans miss.`,
        score: hiddenGemsCount * 10
      });
    }
    
    // The Explorer - 20+ genres and authors
    const uniqueGenres = new Set();
    thisYearAnime.forEach(item => {
      item.node?.genres?.forEach(genre => uniqueGenres.add(genre.name));
    });
    // Add manga genres to the same set to avoid duplication
    filteredManga.forEach(item => {
      item.node?.genres?.forEach(genre => uniqueGenres.add(genre.name));
    });
    const uniqueAuthors = new Set();
    filteredManga.forEach(item => {
      item.node?.authors?.forEach(author => {
        const name = `${(author.node?.first_name || '').trim()} ${(author.node?.last_name || '').trim()}`.trim();
        if (name) uniqueAuthors.add(name);
      });
    });
    if (uniqueGenres.size >= 20 || uniqueAuthors.size >= 20) {
      const descText = uniqueGenres.size >= 20 && uniqueAuthors.size >= 20
        ? `Like Luffy, you crave adventure! This year, you explored ${uniqueGenres.size} genres and ${uniqueAuthors.size} authors`
        : uniqueGenres.size >= 20
        ? `Like Luffy, you crave adventure! This year, you explored ${uniqueGenres.size} genres`
        : `Like Luffy, you crave adventure! This year, you explored ${uniqueAuthors.size} authors`;
      
      badgeCandidates.push({ 
        type: 'the_explorer', 
        name: 'The Explorer',
        description: `${descText}.`,
        score: uniqueGenres.size + uniqueAuthors.size
      });
    }
    
    // The Archivist - 100+ completed anime and manga combined
    const totalCompleted = completedAnime.length + completedManga.length;
    if (totalCompleted >= 100) {
      badgeCandidates.push({ 
        type: 'the_archivist', 
        name: 'The Archivist',
        description: `Myne’s love of stories is endless, and yours is too. You’ve finished ${totalCompleted} titles!`,
        score: totalCompleted
      });
    }
    
    // The Strategist - 20+ planned to watch/read
    const totalPlanned = plannedAnime.length + plannedManga.length;
    if (totalPlanned >= 20) {
      badgeCandidates.push({ 
        type: 'the_strategist', 
        name: 'The Strategist',
        description: `Like Light, you plan every move. With ${totalPlanned} titles in your queue, you’re already two steps ahead.`,
        score: totalPlanned
      });
    }
    
    // The Sprinter - Completed a title within 1-3 days
    if (totalEpisodes >= 1000 || totalChapters >= 2000) {
      const bingeThresholdDays = 3;
      const bingeAnimeCandidates = thisYearAnime
        .map(item => {
          const episodes = item.list_status?.num_episodes_watched || 0;
          const days = getCompletionDays(item.list_status?.start_date, item.list_status?.finish_date);
          return {
            item,
            episodes,
            days,
            status: item.list_status?.status
          };
        })
        .filter(candidate => 
          candidate.status === 'completed' &&
          candidate.days !== null &&
          candidate.days <= bingeThresholdDays &&
          candidate.episodes > 0
        )
        .sort((a, b) => b.episodes - a.episodes);
      
      let bingeEntry = bingeAnimeCandidates[0]
        ? {
            title: bingeAnimeCandidates[0].item.node?.title || '',
            amount: bingeAnimeCandidates[0].episodes,
            unit: 'episodes',
            days: bingeAnimeCandidates[0].days
          }
        : null;
      
      if (!bingeEntry) {
        const bingeMangaCandidates = filteredManga
          .map(item => {
            const chapters = item.list_status?.num_chapters_read || 0;
            const days = getCompletionDays(item.list_status?.start_date, item.list_status?.finish_date);
            return {
              item,
              chapters,
              days,
              status: item.list_status?.status
            };
          })
          .filter(candidate =>
            candidate.status === 'completed' &&
            candidate.days !== null &&
            candidate.days <= bingeThresholdDays &&
            candidate.chapters > 0
          )
          .sort((a, b) => b.chapters - a.chapters);
        
        if (bingeMangaCandidates[0]) {
          bingeEntry = {
            title: bingeMangaCandidates[0].item.node?.title || '',
            amount: bingeMangaCandidates[0].chapters,
            unit: 'chapters',
            days: bingeMangaCandidates[0].days
          };
        }
      }
      
      if (bingeEntry) {
        const titlePreview = bingeEntry.title.substring(0, 30) + (bingeEntry.title.length > 30 ? '...' : '');
        const bingeDesc = `Like Naruto, you never gave up! You blitzed through "${titlePreview}" in just ${bingeEntry.days} day${bingeEntry.days > 1 ? 's' : ''}.`;
        
        badgeCandidates.push({ 
          type: 'the_sprinter', 
          name: 'The Sprinter',
          description: bingeDesc,
          score: bingeEntry.amount + (3 - bingeEntry.days) * 50
        });
      }
    }
    
    // The Loyalist - 4-5+ anime/manga from same studio/author
    const topStudioCount = topStudios.length > 0 ? topStudios[0][1] : 0;
    const topAuthorCount = topAuthors.length > 0 ? topAuthors[0][1] : 0;
    if (topStudioCount >= 4 || topAuthorCount >= 4) {
      const loyalistName = topStudioCount >= topAuthorCount 
        ? topStudios[0]?.[0] || ''
        : topAuthors[0]?.[0] || '';
      const loyalistCount = Math.max(topStudioCount, topAuthorCount);
      const loyalistType = topStudioCount >= topAuthorCount ? 'studio' : 'author';
      
      badgeCandidates.push({ 
        type: 'the_loyalist', 
        name: 'The Loyalist',
        description: `Rem is loyal to the end. With ${loyalistCount} works from ${loyalistName}, you’re just as devoted.`,
        score: loyalistCount
      });
    }
    
    // The Specialist - 40+ anime same genre
    if (topGenres.length > 0 && thisYearAnime.length > 0) {
      const topGenreCount = topGenres[0][1];
      const genrePercentage = (topGenreCount / thisYearAnime.length) * 100;
      if (topGenreCount >= 40 || genrePercentage > 40) {
        badgeCandidates.push({ 
          type: 'the_specialist', 
          name: 'The Specialist',
          description: `Like Sailor Moon, you shined brightest in ${topGenres[0][0]} genre  , completing ${topGenreCount} titles.`,
          score: genrePercentage
        });
      }
    }
    
    // The Rookie - Started using MAL that year (check if earliest entry is this year)
    let isRookie = false;
    if (currentYear !== 'all' && typeof currentYear === 'number') {
      const allAnimeDates = anime
        .filter(item => item.list_status?.start_date || item.list_status?.finish_date)
        .map(item => {
          const dateStr = item.list_status?.start_date || item.list_status?.finish_date;
          return dateStr ? new Date(dateStr).getFullYear() : null;
        })
        .filter(year => year !== null);
      const allMangaDates = (manga || [])
        .filter(item => item.list_status?.start_date || item.list_status?.finish_date)
        .map(item => {
          const dateStr = item.list_status?.start_date || item.list_status?.finish_date;
          return dateStr ? new Date(dateStr).getFullYear() : null;
        })
        .filter(year => year !== null);
      
      const earliestYear = Math.min(
        ...(allAnimeDates.length > 0 ? allAnimeDates : [currentYear]),
        ...(allMangaDates.length > 0 ? allMangaDates : [currentYear])
      );
      
      isRookie = earliestYear === currentYear && totalCompleted < 20;
    }
    
    if (isRookie) {
      badgeCandidates.push({ 
        type: 'the_rookie', 
        name: 'The Rookie',
        description: `Deku’s story might be complete, but yours is just beginning! Welcome to MyAnimeList!`,
        score: 1000 // High score to prioritize if they qualify
      });
    }
    
    // Sort badges by score (most impressive first) and take only top 4
    const badges = badgeCandidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ score, ...badge }) => badge); // Remove score from final badge object

    // 5. Year-on-Year Comparison (if not 'all' year)
    let yearComparison = null;
    if (currentYear !== 'all' && typeof currentYear === 'number') {
      const previousYear = currentYear - 1;
      const previousYearAnime = anime.filter(item => {
        const finishDate = item.list_status?.finish_date;
        const startDate = item.list_status?.start_date;
        const updatedAt = item.list_status?.updated_at;
        let dateToCheck = finishDate || startDate || updatedAt;
        if (!dateToCheck) return false;
        try {
          const year = new Date(dateToCheck).getFullYear();
          return year === previousYear;
        } catch (e) {
          return false;
        }
      });
      
      const previousYearEpisodes = previousYearAnime.reduce((sum, item) => 
        sum + (item.list_status?.num_episodes_watched || 0), 0
      );
      const previousYearAnimeCount = previousYearAnime.length;
      
      // Get previous year manga
      const previousYearManga = (manga || []).filter(item => {
        const finishDate = item.list_status?.finish_date;
        const startDate = item.list_status?.start_date;
        const updatedAt = item.list_status?.updated_at;
        let dateToCheck = finishDate || startDate || updatedAt;
        if (!dateToCheck) return false;
        try {
          const year = new Date(dateToCheck).getFullYear();
          return year === previousYear;
        } catch (e) {
          return false;
        }
      });
      const previousYearMangaCount = previousYearManga.length;
      
      if (previousYearEpisodes > 0 || previousYearAnimeCount > 0) {
        const growth = previousYearEpisodes > 0 
          ? ((totalEpisodes - previousYearEpisodes) / previousYearEpisodes) * 100
          : 0;
        const animeCountGrowth = previousYearAnimeCount > 0
          ? thisYearAnime.length - previousYearAnimeCount
          : 0;
        const mangaCountGrowth = previousYearMangaCount > 0
          ? filteredManga.length - previousYearMangaCount
          : 0;
        
        yearComparison = {
          previousYear,
          previousEpisodes: previousYearEpisodes,
          currentEpisodes: totalEpisodes,
          growth: Math.round(growth),
          isGrowth: growth > 0,
          previousAnimeCount: previousYearAnimeCount,
          currentAnimeCount: thisYearAnime.length,
          animeCountGrowth: animeCountGrowth,
          isAnimeGrowth: animeCountGrowth > 0,
          previousMangaCount: previousYearMangaCount,
          currentMangaCount: filteredManga.length,
          mangaCountGrowth: mangaCountGrowth,
          isMangaGrowth: mangaCountGrowth > 0
        };
      }
    }

    // 6. Character Twin Suggestion - Match user's genres with popular characters
    // Male character database with genres and MAL anime IDs
    const maleCharacterDatabase = [
      { name: 'Spike Spiegel', series: 'Cowboy Bebop', malId: 1, genres: ['Sci-Fi', 'Action', 'Drama'] },
      { name: 'Lelouch vi Britannia', series: 'Code Geass', malId: 1575, genres: ['Mecha', 'Military', 'Drama'] },
      { name: 'Light Yagami', series: 'Death Note', malId: 1535, genres: ['Supernatural', 'Thriller', 'Mystery'] },
      { name: 'Edward Elric', series: 'Fullmetal Alchemist: Brotherhood', malId: 5114, genres: ['Action', 'Adventure', 'Drama'] },
      { name: 'Guts', series: 'Berserk', malId: 33, genres: ['Action', 'Adventure', 'Horror'] },
      { name: 'Shinji Ikari', series: 'Neon Genesis Evangelion', malId: 30, genres: ['Drama', 'Mecha', 'Sci-Fi'] },
      { name: 'Johan Liebert', series: 'Monster', malId: 19, genres: ['Drama', 'Mystery', 'Psychological'] },
      { name: 'Thorfinn', series: 'Vinland Saga', malId: 37521, genres: ['Action', 'Drama', 'Historical'] },
      { name: 'Saitama', series: 'One Punch Man', malId: 30276, genres: ['Action', 'Comedy', 'Supernatural'] },
      { name: 'Monkey D. Luffy', series: 'One Piece', malId: 21, genres: ['Action', 'Adventure', 'Fantasy'] },
      { name: 'Goku', series: 'Dragon Ball Z', malId: 813, genres: ['Action', 'Adventure', 'Comedy'] },
      { name: 'Satoru Gojo', series: 'Jujutsu Kaisen', malId: 40748, genres: ['Action', 'Fantasy', 'Supernatural'] },
      { name: 'Denji', series: 'Chainsaw Man', malId: 44511, genres: ['Action', 'Supernatural', 'Gore'] },
      { name: 'Loid Forger', series: 'Spy x Family', malId: 50265, genres: ['Action', 'Comedy', 'Slice of Life'] },
      { name: 'Tanjiro Kamado', series: 'Demon Slayer', malId: 38000, genres: ['Action', 'Fantasy', 'Supernatural'] },
      { name: 'Senku Ishigami', series: 'Dr. Stone', malId: 38691, genres: ['Adventure', 'Comedy', 'Sci-Fi'] },
      { name: 'Mob', series: 'Mob Psycho 100', malId: 32182, genres: ['Action', 'Comedy', 'Supernatural'] },
      { name: 'Naruto Uzumaki', series: 'Naruto', malId: 20, genres: ['Action', 'Adventure', 'Fantasy'] },
      { name: 'Levi Ackerman', series: 'Attack on Titan', malId: 16498, genres: ['Action', 'Drama', 'Suspense'] },
      { name: 'L', series: 'Death Note', malId: 1535, genres: ['Mystery', 'Supernatural', 'Thriller'] },
      { name: 'Okabe Rintarou', series: 'Steins;Gate', malId: 9253, genres: ['Drama', 'Sci-Fi', 'Thriller'] },
      { name: 'Gon Freecss', series: 'Hunter x Hunter', malId: 11061, genres: ['Action', 'Adventure', 'Fantasy'] },
      { name: 'Yusuke Urameshi', series: 'Yu Yu Hakusho', malId: 392, genres: ['Action', 'Adventure', 'Supernatural'] },
      { name: 'Ken Kaneki', series: 'Tokyo Ghoul', malId: 22319, genres: ['Action', 'Drama', 'Horror'] },
      { name: 'Kamina', series: 'Gurren Lagann', malId: 2001, genres: ['Action', 'Mecha', 'Sci-Fi'] },
      { name: 'Ichigo Kurosaki', series: 'Bleach', malId: 269, genres: ['Action', 'Adventure', 'Supernatural'] },
      { name: 'Eren Yeager', series: 'Attack on Titan', malId: 16498, genres: ['Action', 'Drama', 'Mystery'] },
      { name: 'Kakashi Hatake', series: 'Naruto', malId: 20, genres: ['Action', 'Adventure', 'Fantasy'] },
      { name: 'Roy Mustang', series: 'Fullmetal Alchemist: Brotherhood', malId: 5114, genres: ['Action', 'Drama', 'Fantasy'] },
      { name: 'Vegeta', series: 'Dragon Ball Z', malId: 813, genres: ['Action', 'Adventure', 'Fantasy'] }
    ];
    
    // Female character database with genres and MAL anime IDs
    const femaleCharacterDatabase = [
      { name: 'Mikasa Ackerman', series: 'Attack on Titan', malId: 16498, genres: ['Action', 'Drama', 'Suspense'] },
      { name: 'Asuka Langley Soryu', series: 'Neon Genesis Evangelion', malId: 30, genres: ['Drama', 'Mecha', 'Sci-Fi'] },
      { name: 'Motoko Kusanagi', series: 'Ghost in the Shell: Stand Alone Complex', malId: 467, genres: ['Action', 'Sci-Fi', 'Mystery'] },
      { name: 'Homura Akemi', series: 'Madoka Magica', malId: 9756, genres: ['Drama', 'Psychological', 'Thriller'] },
      { name: 'Revy', series: 'Black Lagoon', malId: 889, genres: ['Action', 'Drama', 'Thriller'] },
      { name: 'Saber', series: 'Fate/Zero', malId: 10087, genres: ['Action', 'Fantasy', 'Supernatural'] },
      { name: 'Violet Evergarden', series: 'Violet Evergarden', malId: 33352, genres: ['Drama', 'Fantasy', 'Slice of Life'] },
      { name: 'Faye Valentine', series: 'Cowboy Bebop', malId: 1, genres: ['Action', 'Drama', 'Sci-Fi'] },
      { name: 'Kagura', series: 'Gintama', malId: 918, genres: ['Action', 'Comedy', 'Sci-Fi'] },
      { name: 'Erza Scarlet', series: 'Fairy Tail', malId: 6702, genres: ['Action', 'Adventure', 'Fantasy'] },
      { name: 'Nami', series: 'One Piece', malId: 21, genres: ['Action', 'Adventure', 'Fantasy'] },
      { name: 'Rukia Kuchiki', series: 'Bleach', malId: 269, genres: ['Action', 'Adventure', 'Supernatural'] },
      { name: 'Yor Forger', series: 'Spy x Family', malId: 50265, genres: ['Action', 'Comedy', 'Slice of Life'] },
      { name: 'Marin Kitagawa', series: 'My Dress-Up Darling', malId: 48736, genres: ['Comedy', 'Romance', 'Slice of Life'] },
      { name: 'Power', series: 'Chainsaw Man', malId: 44511, genres: ['Action', 'Comedy', 'Supernatural'] },
      { name: 'Nico Robin', series: 'One Piece', malId: 21, genres: ['Action', 'Adventure', 'Mystery'] },
      { name: 'Shiki Ryougi', series: 'Kara no Kyoukai', malId: 2593, genres: ['Action', 'Mystery', 'Supernatural'] },
      { name: 'Holo', series: 'Spice and Wolf', malId: 2966, genres: ['Adventure', 'Fantasy', 'Romance'] },
      { name: 'Nobara Kugisaki', series: 'Jujutsu Kaisen', malId: 40748, genres: ['Action', 'Fantasy', 'Supernatural'] },
      { name: 'Shouko Nishimiya', series: 'A Silent Voice', malId: 28851, genres: ['Drama', 'Romance', 'Slice of Life'] },
      { name: 'Tsunade', series: 'Naruto', malId: 20, genres: ['Action', 'Adventure', 'Fantasy'] },
      { name: 'Riza Hawkeye', series: 'Fullmetal Alchemist: Brotherhood', malId: 5114, genres: ['Action', 'Drama', 'Fantasy'] },
      { name: 'Winry Rockbell', series: 'Fullmetal Alchemist: Brotherhood', malId: 5114, genres: ['Adventure', 'Drama', 'Romance'] },
      { name: 'Bulma', series: 'Dragon Ball Z', malId: 813, genres: ['Action', 'Adventure', 'Comedy'] },
      { name: 'Makise Kurisu', series: 'Steins;Gate', malId: 9253, genres: ['Drama', 'Sci-Fi', 'Thriller'] },
      { name: 'Nezuko Kamado', series: 'Demon Slayer', malId: 38000, genres: ['Action', 'Fantasy', 'Supernatural'] },
      { name: 'Hinata Hyuga', series: 'Naruto', malId: 20, genres: ['Action', 'Drama', 'Romance'] },
      { name: 'Ryuko Matoi', series: 'Kill la Kill', malId: 18679, genres: ['Action', 'Comedy', 'Fantasy'] },
      { name: 'Ochaco Uraraka', series: 'My Hero Academia', malId: 31964, genres: ['Action', 'Comedy', 'Fantasy'] },
      { name: 'Yoruichi Shihouin', series: 'Bleach', malId: 269, genres: ['Action', 'Adventure', 'Supernatural'] }
    ];
    
    // Select character database based on user gender
    // Check userData.gender or userData.sex (MAL API might use either)
    const userGender = userData?.gender || userData?.sex;
    let characterDatabase;
    if (userGender === 'Female' || userGender === 'female' || userGender === 'F' || userGender === 'f') {
      characterDatabase = femaleCharacterDatabase;
    } else if (userGender === 'Male' || userGender === 'male' || userGender === 'M' || userGender === 'm') {
      characterDatabase = maleCharacterDatabase;
    } else {
      // If no gender specified, use either (default to male)
      characterDatabase = maleCharacterDatabase;
    }
    
    // Normalize genre names for matching (handle MAL genre variations)
    const normalizeGenre = (genre) => {
      if (!genre) return '';
      const genreLower = genre.toLowerCase().trim();
      
      // Map common MAL genre variations to standard names
      const genreMap = {
        'shounen': 'Shounen',
        'shonen': 'Shounen',
        'seinen': 'Seinen',
        'action': 'Action',
        'adventure': 'Adventure',
        'comedy': 'Comedy',
        'drama': 'Drama',
        'fantasy': 'Fantasy',
        'sci-fi': 'Sci-Fi',
        'science fiction': 'Sci-Fi',
        'mecha': 'Mecha',
        'mystery': 'Mystery',
        'psychological': 'Psychological',
        'thriller': 'Thriller',
        'supernatural': 'Supernatural',
        'horror': 'Horror',
        'military': 'Military',
        'suspense': 'Suspense',
        'historical': 'Historical',
        'slice of life': 'Slice of Life',
        'martial arts': 'Martial Arts',
        'parody': 'Parody',
        'dark fantasy': 'Dark Fantasy',
        'gore': 'Gore',
        'space': 'Space',
        'super power': 'Super Power',
        'school': 'School',
        'romance': 'Romance',
        'sports': 'Sports',
        'music': 'Music',
        'ecchi': 'Ecchi',
        'harem': 'Harem',
        'isekai': 'Isekai'
      };
      
      return genreMap[genreLower] || genre;
    };
    
    // Get user's top 3 genres (normalized) - always use top 3 for matching
    const userTopGenres = topGenres.length > 0 
      ? topGenres.slice(0, 3).map(([genre]) => normalizeGenre(genre))
      : [];
    
    // Find best matching character based on genre overlap with top 3 genres
    let bestMatch = null;
    let bestScore = 0;
    
    if (userTopGenres.length > 0) {
      characterDatabase.forEach(character => {
        const characterGenres = character.genres.map(normalizeGenre);
        
        // Calculate overlap score - check if any of user's top 3 genres match character genres
        const matchingGenres = userTopGenres.filter(userGenre => {
          const userNorm = normalizeGenre(userGenre).toLowerCase();
          return characterGenres.some(charGenre => {
            const charNorm = normalizeGenre(charGenre).toLowerCase();
            return userNorm === charNorm || 
                   userNorm.includes(charNorm) || 
                   charNorm.includes(userNorm);
          });
        });
        
        const score = matchingGenres.length;
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = character;
        }
      });
    }
    
    // If no match found, use top genre to find closest match
    if (!bestMatch && topGenres.length > 0) {
      const topGenre = normalizeGenre(topGenres[0][0]);
      bestMatch = characterDatabase.find(char => 
        char.genres.some(g => {
          const charNorm = normalizeGenre(g).toLowerCase();
          const topNorm = topGenre.toLowerCase();
          return charNorm === topNorm || charNorm.includes(topNorm) || topNorm.includes(charNorm);
        })
      ) || characterDatabase[0]; // Fallback to first character
    }
    
    // Always create a character twin (use first character as fallback if needed)
    if (!bestMatch) {
      bestMatch = characterDatabase[0];
    }
    
    let characterTwin = null;
    if (bestMatch) {
      const matchedGenres = userTopGenres.length > 0 
        ? bestMatch.genres.filter(charGenre => 
            userTopGenres.some(userGenre => {
              const charNorm = normalizeGenre(charGenre).toLowerCase();
              const userNorm = normalizeGenre(userGenre).toLowerCase();
              return charNorm === userNorm || 
                     userNorm.includes(charNorm) || 
                     charNorm.includes(userNorm);
            })
          )
        : bestMatch.genres;
      
      const genreText = matchedGenres.length > 0 ? matchedGenres[0] : (topGenres[0]?.[0] || bestMatch.genres[0] || 'anime');
      
      // Use only matching genres for the reason text
      let matchingGenreNames = '';
      if (matchedGenres.length > 0) {
        if (matchedGenres.length >= 3) {
          matchingGenreNames = `${matchedGenres[0]}, ${matchedGenres[1]}, and ${matchedGenres[2]}`;
        } else if (matchedGenres.length === 2) {
          matchingGenreNames = `${matchedGenres[0]} and ${matchedGenres[1]}`;
        } else {
          matchingGenreNames = matchedGenres[0];
        }
      } else if (topGenres.length > 0) {
        // Fallback to top genre if no matches found
        matchingGenreNames = topGenres[0][0];
      } else {
        matchingGenreNames = 'anime';
      }
      
      characterTwin = {
        title: bestMatch.name,
        series: bestMatch.series,
        genre: genreText,
        reason: matchingGenreNames !== 'anime'
          ? `Based on your love for ${matchingGenreNames}, ${bestMatch.name} from "${bestMatch.series}" matches your vibes`
          : `${bestMatch.name} from "${bestMatch.series}" matches your anime journey`,
        coverImage: '/anime-character.webp', // Will be updated with character image
        type: 'character',
        animeId: bestMatch.malId,
        characterName: bestMatch.name
      };
    }

    // 7. Episode Count Comparison (estimate average MAL user)
    // Average MAL user watches ~650 episodes per year, 5497 all-time
    const averageEpisodesPerYear = 650;
    const averageEpisodesAllTime = 5497;
    
    // Calculate all-time episodes
    const allTimeEpisodes = anime.reduce((sum, item) => 
      sum + (item.list_status?.num_episodes_watched || 0), 0
    );
    
    const episodeComparison = {
      userEpisodes: totalEpisodes,
      averageEpisodes: averageEpisodesPerYear,
      percentage: Math.round((totalEpisodes / averageEpisodesPerYear) * 100),
      isAboveAverage: totalEpisodes > averageEpisodesPerYear,
      allTimeEpisodes: allTimeEpisodes,
      averageAllTime: averageEpisodesAllTime,
      allTimePercentage: Math.round((allTimeEpisodes / averageEpisodesAllTime) * 100),
      isAboveAverageAllTime: allTimeEpisodes > averageEpisodesAllTime
    };

    // Manga comparison (estimate average MAL user reads ~950 chapters per year, 9500 all-time)
    const averageChaptersPerYear = 950;
    const averageChaptersAllTime = 9500;
    const allTimeChapters = (manga || []).reduce((sum, item) => 
      sum + (item.list_status?.num_chapters_read || 0), 0
    );
    
    const mangaComparison = {
      userChapters: totalChapters,
      averageChapters: averageChaptersPerYear,
      percentage: Math.round((totalChapters / averageChaptersPerYear) * 100),
      isAboveAverage: totalChapters > averageChaptersPerYear,
      allTimeChapters: allTimeChapters,
      averageAllTime: averageChaptersAllTime,
      allTimePercentage: Math.round((allTimeChapters / averageChaptersAllTime) * 100),
      isAboveAverageAllTime: allTimeChapters > averageChaptersAllTime
    };

    // Removed obscure studios calculation

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
      // New unique features
      milestones: milestones,
      thisYearMilestone: thisYearMilestone,
      rareAnimeGems: rareAnimeGems,
      rareMangaGems: rareMangaGems,
      hiddenGemsCount: hiddenGemsCount,
      hiddenGemsMangaCount: hiddenGemsMangaCount ?? 0,
      hiddenGemsAnimeCount: hiddenGemsAnimeCount ?? 0,
      longestStreak: longestStreak,
      badges: badges,
      yearComparison: yearComparison,
      characterTwin: characterTwin, // Combined twin
      episodeComparison: episodeComparison,
      mangaComparison: mangaComparison,
      totalCompletedAnime: totalCompletedAnime,
    };
    
    setStats(statsData);
    
    // Fetch character image if we have an anime ID
    if (characterTwin && characterTwin.animeId && characterTwin.characterName) {
      fetchCharacterImage(characterTwin.animeId, characterTwin.characterName, statsData);
    }
  }

  async function fetchCharacterImage(animeId, characterName, currentStats) {
    try {
      const accessToken = localStorage.getItem('mal_access_token');
      if (!accessToken) return;
      
      const response = await fetch(`/api/mal/characters?animeId=${animeId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      if (!response.ok) {
        console.error('Failed to fetch characters');
        return;
      }
      
      const data = await response.json();
      const characters = data.data || [];
      
      // Find the matching character by name (case-insensitive, partial match)
      const characterNameLower = characterName.toLowerCase();
      let foundCharacter = characters.find(c => {
        const firstName = (c.node?.first_name || '').toLowerCase();
        const lastName = (c.node?.last_name || '').toLowerCase();
        const altName = (c.node?.alternative_name || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        
        return fullName.includes(characterNameLower) ||
               characterNameLower.includes(fullName) ||
               altName.includes(characterNameLower) ||
               characterNameLower.includes(altName) ||
               firstName.includes(characterNameLower) ||
               characterNameLower.includes(firstName);
      });
      
      // If not found by name, try to find main character
      if (!foundCharacter) {
        foundCharacter = characters.find(c => c.role === 'Main') || characters[0];
      }
      
      if (foundCharacter && foundCharacter.node && currentStats.characterTwin) {
        const characterNode = foundCharacter.node;
        const characterImage = characterNode?.main_picture?.medium || 
                              characterNode?.main_picture?.large || 
                              '/anime-character.webp';
        
        // Update stats with character image
        setStats(prevStats => ({
          ...prevStats,
          characterTwin: {
            ...prevStats.characterTwin,
            coverImage: characterImage,
            characterImage: characterImage
          }
        }));
      }
    } catch (err) {
      console.error('Error fetching character image:', err);
    }
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

  async function generatePNG() {
    if (!slideRef.current || typeof window === 'undefined') return null;
    
    try {
      const cardElement = slideRef.current;
      
      // Detect mobile device for optimization
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
      const scale = isMobile ? 1 : 2; // Lower scale on mobile for better performance
      
      // Dynamically import snapdom
      const { snapdom } = await import('@zumer/snapdom');
      
      // Simplified plugin - only stop animations on the main element
      const capturePlugin = {
        name: 'mal-wrapped-capture',
        async afterClone(context) {
          const clonedDoc = context.clonedDocument;
          if (!clonedDoc) return;
          
          const clonedElement = clonedDoc.querySelector('.slide-card') || clonedDoc.body;
          if (clonedElement) {
            clonedElement.style.animation = 'none';
            clonedElement.style.transition = 'none';
            clonedElement.style.animationPlayState = 'paused';
          }
        }
      };
      
      // Capture with snapdom - exclude only navigation containers using data attribute
      const out = await snapdom(cardElement, {
        backgroundColor: '#0A0A0A',
        scale: scale,
        exclude: ['[data-exclude-from-screenshot]'],
        embedFonts: false,
        plugins: [capturePlugin]
      });
      
      // Export as PNG
      const png = await out.toPng();
      
      // Add watermark directly using data URL without reloading image
      return new Promise((resolve, reject) => {
        try {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw the original image
            ctx.drawImage(img, 0, 0);
            
            // Add watermark at the bottom - adjust font size based on scale
            const watermarkText = websiteUrl;
            const fontSize = 40; // Smaller font on mobile
            ctx.font = `bold ${fontSize}px "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            
            const x = canvas.width / 2;
            const y = canvas.height - (canvas.height * 0.015);
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(watermarkText, x, y);
            
            // Convert canvas to blob
            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'));
                return;
              }
              
              const file = new File([blob], `mal-wrapped-${username || 'user'}-slide-${currentSlide + 1}.png`, { type: 'image/png' });
              const dataUrl = canvas.toDataURL('image/png');
              
              resolve({ file, dataUrl });
            }, 'image/png');
          };
          
          img.onerror = () => {
            // Fallback: return PNG without watermark if image load fails
            if (png.src && png.src.startsWith('data:')) {
              fetch(png.src)
                .then(res => res.blob())
                .then(blob => {
                  const file = new File([blob], `mal-wrapped-${username || 'user'}-slide-${currentSlide + 1}.png`, { type: 'image/png' });
                  resolve({ file, dataUrl: png.src });
                })
                .catch(() => reject(new Error('Failed to process image')));
            } else {
              reject(new Error('Failed to load image'));
            }
          };
          
          // Use the PNG src directly (snapdom returns a data URL)
          img.src = png.src || (png.blob ? URL.createObjectURL(png.blob) : '');
        } catch (error) {
          reject(error);
        }
      });
    } catch (err) {
      console.error('Error generating PNG:', err);
      throw err;
    }
  }

  async function handleDownloadPNG(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      const result = await generatePNG();
      if (!result) return;
      
      // Create download link
      const link = document.createElement('a');
      link.download = `mal-wrapped-${username || 'user'}-slide-${currentSlide + 1}.png`;
      link.href = result.dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download image. Please try again.');
    }
  }

  // Copy image to clipboard
  async function copyImageToClipboard() {
    try {
      const result = await generatePNG();
      if (!result) return;
      
      const response = await fetch(result.dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      alert('Image copied to clipboard!');
      setShowShareMenu(false);
    } catch (err) {
      console.error('Failed to copy image:', err);
      alert('Failed to copy image to clipboard. Please try downloading instead.');
    }
  }

  // Copy email to clipboard
  async function copyEmail() {
    try {
      await navigator.clipboard.writeText('avishkarshinde1501@gmail.com');
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy email:', err);
    }
  }

  // Share to social media
  async function handleShareImageClick(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      const result = await generatePNG();
      if (!result) {
        alert('Failed to generate image. Please try again.');
        return;
      }

      const shareData = {
        title: `My ${stats?.selectedYear || '2024'} MAL Wrapped`,
        text: `Check out your ${stats?.selectedYear || '2024'} MyAnimeList Wrapped!`,
        url: window.location.href,
        files: [result.file],
      };

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: trigger download so user can share manually
        const link = document.createElement('a');
        link.download = `mal-wrapped-${username || 'user'}-slide-${currentSlide + 1}.png`;
        link.href = result.dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert('Sharing is not supported on this device. The image has been downloaded so you can share it manually.');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('Error sharing image:', error);
        alert('Failed to share image. Please try again.');
      }
    } finally {
      setShowShareMenu(false);
    }
  }

  async function handleShareButtonClick(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Detect if we're on a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);

    // On desktop, always show the menu. On mobile, try native share first
    if (isMobile && navigator.share) {
      // Use native share with image on mobile
      try {
        await handleShareImageClick(e);
      } catch (error) {
        // If native share fails or is cancelled, fall back to menu
        if (error?.name !== 'AbortError') {
          setShowShareMenu((prev) => !prev);
        }
      }
    } else {
      // Show menu on desktop or if native share not available
      setShowShareMenu((prev) => !prev);
    }
  }

  function shareToSocial(platform) {
    const shareText = `Check out your ${stats?.selectedYear || '2024'} MyAnimeList Wrapped!`;
    const shareUrl = window.location.href;
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(shareUrl);
    
    let shareLink = '';
    
    switch (platform) {
      case 'twitter':
        shareLink = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'facebook':
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'reddit':
        shareLink = `https://reddit.com/submit?title=${encodedText}&url=${encodedUrl}`;
        break;
      case 'linkedin':
        shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case 'whatsapp':
        shareLink = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
        break;
      case 'telegram':
        shareLink = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        break;
      default:
        return;
    }
    
    window.open(shareLink, '_blank', 'width=600,height=400');
    setShowShareMenu(false);
  }

  // Close share menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target)) {
        setShowShareMenu(false);
      }
    }

    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showShareMenu]);

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

  function SlideContent({ slide, mangaListData, websiteUrl }) {
    if (!slide || !stats) return null;
    
    // Helper function to deduplicate items by title
    const deduplicateByTitle = (items) => {
      const map = new Map();
      items.forEach(item => {
        const title = item.node?.title || '';
        if (title && !map.has(title)) {
          map.set(title, item);
        }
      });
      return Array.from(map.values());
    };
    
    // Define userImage for use across all slides
    const userImage = userData?.picture || '/anime-character.webp';

    const SlideLayout = ({ children, bgColor = 'black' }) => {
      // Spotify-like background colors with subtle tint (solid colors)
      const bgColorClasses = {
        black: 'bg-gradient-to-br from-purple-800 via-indigo-900 to-black',
        pink: 'bg-gradient-to-br from-pink-700 via-fuchsia-800 to-purple-950',
        yellow: 'bg-gradient-to-br from-amber-700 via-orange-800 to-rose-900',
        blue: 'bg-gradient-to-br from-cyan-700 via-blue-800 to-indigo-950',
        green: 'bg-gradient-to-br from-emerald-700 via-teal-800 to-blue-950',
        red: 'bg-gradient-to-br from-red-700 via-rose-800 to-purple-950',
        purple: 'bg-gradient-to-br from-purple-700 via-violet-800 to-indigo-950'
      };
      
      return (
        <motion.div 
          className={`w-full h-full relative px-2 sm:px-3 md:px-4 lg:px-6 py-2 sm:py-3 md:py-4 lg:py-6 flex flex-col items-center justify-center slide-card overflow-hidden abstract-shapes ${bgColorClasses[bgColor] || 'bg-black'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{ position: 'relative' }}
        >
          {/* Colorful abstract shapes background on all cards - animated */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
            {/* Large layered organic shape (left side) */}
            <motion.div 
              className="absolute left-0 top-1/2 -translate-y-1/2 w-96 h-96 opacity-60"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(255, 0, 100, 0.4) 0%, rgba(200, 0, 150, 0.3) 30%, rgba(100, 0, 200, 0.2) 60%, transparent 100%)',
                clipPath: 'polygon(0% 20%, 40% 0%, 100% 30%, 80% 70%, 40% 100%, 0% 80%)',
                filter: 'blur(140px)',
                willChange: 'transform, opacity'
              }}
              animate={{
                transform: ['rotate(-15deg) translateY(-50%)', 'rotate(-10deg) translateY(-50%)', 'rotate(-20deg) translateY(-50%)', 'rotate(-15deg) translateY(-50%)'],
                opacity: [0.6, 0.7, 0.5, 0.6]
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: smoothEase
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
                filter: 'blur(120px)',
                willChange: 'transform, opacity'
              }}
              animate={{
                transform: ['translateY(0%)', 'translateY(-5%)', 'translateY(0%)'],
                opacity: [0.5, 0.6, 0.5]
              }}
              transition={{
                duration: 7,
                repeat: Infinity,
                ease: smoothEase
              }}
              data-framer-motion
              data-shape-blur
            ></motion.div>
            
            {/* Purple glow (center) */}
            <motion.div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-40"
              style={{
                background: 'radial-gradient(circle, rgba(138, 43, 226, 0.3) 0%, rgba(75, 0, 130, 0.2) 50%, transparent 100%)',
                filter: 'blur(140px)',
                willChange: 'transform, opacity'
              }}
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.4, 0.5, 0.4]
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: smoothEase
              }}
              data-framer-motion
              data-shape-blur
            ></motion.div>
            
            {/* Rainbow accent (bottom right) */}
            <motion.div 
              className="absolute bottom-1/4 right-1/4 w-80 h-80 opacity-50"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 0, 0, 0.3) 0%, rgba(255, 165, 0, 0.3) 25%, rgba(255, 255, 0, 0.3) 50%, rgba(0, 255, 0, 0.3) 75%, rgba(0, 0, 255, 0.3) 100%)',
                filter: 'blur(120px)',
                willChange: 'transform, opacity'
              }}
              animate={{
                transform: ['rotate(0deg)', 'rotate(10deg)', 'rotate(-10deg)', 'rotate(0deg)'],
                opacity: [0.5, 0.6, 0.5]
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: smoothEase
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
          
          {/* Bottom gradient fade - above rainbow shapes, below content */}
          <div 
            className="absolute bottom-0 left-0 right-0 pointer-events-none h-full"
            style={{
              zIndex: 5,
              background: bottomGradientBackground
            }}
          />
        </motion.div>
      );
    };

    // Image Carousel Component - Always carousel on all screen sizes
    const ImageCarousel = ({ items, maxItems = 10, showHover = true, showNames = false }) => {
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
          if (window.innerWidth >= 640) {
            setGapSize('8px');
            setItemsPerView(5);
          } else {
            setGapSize('6px');
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
              width: shouldCenter ? 'auto' : '100%',
              overflow: 'visible'
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
                    ease: smoothEase
                  }}
                >
                  <motion.div 
                className="aspect-[2/3] w-full bg-transparent rounded-lg relative" 
                    style={{ maxHeight: '275px', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}
                    whileHover={{ borderColor: '#ffffff' }}
                    transition={{ duration: 0.3, ease: smoothEase }}
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
                        className="absolute inset-0 bg-black/80 flex items-center justify-center p-2 z-10 rounded-lg pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p className="title-sm text-center">{item.title}</p>
                        {item.userRating && (
                          <div className="absolute bottom-2 right-2 text-yellow-300 mono font-semibold mt-1">
                            ★ {Math.round(item.userRating)}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                  {showNames && item.title && (
                    <div className="mt-2 text-center">
                      <p className="title-sm truncate">{item.title}</p>
                      {item.userRating && (
                        <p className="mono font-semibold text-yellow-300 mt-1">★ {Math.round(item.userRating)}</p>
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
                    <a href={malUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-full">
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
                    ease: smoothEase
                  }}
                >
                  <motion.div 
                className="aspect-[2/3] bg-transparent rounded-lg overflow-hidden relative w-full" 
                    style={{ maxHeight: '275px', maxWidth: '183px', width: '100%', boxSizing: 'border-box' }}
                    whileHover={{ borderColor: '#ffffff' }}
                    transition={{ duration: 0.3, ease: smoothEase}}
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
                      <p className="mono font-semibold text-yellow-300 mt-1">★ {item.userRating.toFixed(1)}</p>
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

    switch (slide.id) {
      case 'welcome':
        return (
          <SlideLayout bgColor="pink">
            <div className="text-center relative w-full h-full flex flex-col items-center justify-center">
              {/* Colorful abstract shapes background */}
              
              <div className="relative z-20 w-full flex flex-col items-center justify-center">
              <motion.div {...fadeIn} data-framer-motion className="mt-16 w-full flex flex-col items-center">
                  <div className="relative inline-block text-center">
                    <h1 className="wrapped-brand text-white/50 relative z-10 text-center">
                      {stats.selectedYear === 'all' ? 'MyAnimeList' : 'MyAnimeList ' + stats.selectedYear}
                    </h1>
                    <h2 className="wrapped-title text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white relative z-10 text-center">
                      Wrapped
                    </h2>
                  </div>
                  <p className="body-md font-regular text-white mt-8 text-center text-container max-w-2xl mx-auto">A look back at your {stats.selectedYear === 'all' ? 'anime journey' : 'year'}, <span className="text-white font-medium">{username || 'a'}</span>.</p>
              </motion.div>
              <motion.div 
                className="mt-4 w-full max-w-3xl flex items-center justify-center gap-6 sm:gap-8 mb-6 sm:mb-8 relative z-20"
                variants={staggerItem}
              >
                <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0 z-20">
                  <motion.a
                    href={username ? `https://myanimelist.net/profile/${encodeURIComponent(username)}` : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                className="relative z-20 w-full h-full rounded-xl overflow-hidden block"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: smoothEase }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <img 
                      src={userImage} 
                      alt={username || 'User'} 
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  </motion.a>
                </div>
              </motion.div>
              </div>
            </div>
          </SlideLayout>
        );

      case 'anime_count':
        if (stats.thisYearAnime.length === 0) {
          return (
            <SlideLayout bgColor="blue">
              <motion.div className="text-center relative z-10" {...fadeSlideUp} data-framer-motion>
                <h2 className="heading-md text-white mb-4 text-container">
                  You didn't watch any anime {stats.selectedYear === 'all' ? '' : 'in ' + stats.selectedYear}.
                </h2>
                <p className="body-md text-white/80 mb-6 text-container">
                  Log your watched anime on MyAnimeList to see your personalized wrapped!
                </p>
                <motion.a
                  href="https://myanimelist.net/"
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
          <SlideLayout bgColor="blue">
            <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
            {stats.selectedYear === 'all' ? 'Overall' : 'In ' + stats.selectedYear}, you binged through
            </motion.h2>
            <motion.div className="mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
              <p className="number-xl text-white ">
                <AnimatedNumber value={stats.thisYearAnime.length} /> anime
              </p>
              
            </motion.div>
            {animeCarouselItems.length > 0 && <div className="relative z-10"><ImageCarousel items={animeCarouselItems} maxItems={10} showHover={true} showNames={false} /></div>}
            {stats.yearComparison && stats.yearComparison.previousAnimeCount > 0 && (
              <motion.h3 className="body-sm font-regular mt-4 text-white/50 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
                {stats.yearComparison.isAnimeGrowth ? (
                  <>That's <span className="text-white font-semibold">{Math.abs(stats.yearComparison.animeCountGrowth)}</span> more than last year. You’re leveling up!</>
                ) : (
                  <>That's <span className="text-white font-semibold">{Math.abs(stats.yearComparison.animeCountGrowth)}</span> less than last year. Don’t stop now!</>
                )}
              </motion.h3>
            )}
            {(!stats.yearComparison || !stats.yearComparison.previousAnimeCount) && (
              <motion.h3 className="body-sm font-regular mt-4 text-white/50 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
                Now that's dedication
              </motion.h3>
            )}
          </SlideLayout>
        );

      case 'anime_time':
        // Get percentage for comparison
        const animeComparison = stats.episodeComparison;
        const animeDisplayPercentage = animeComparison 
          ? (stats.selectedYear === 'all' ? animeComparison.allTimePercentage : animeComparison.percentage)
          : 0;
        const animeComparisonCopy = getComparisonCopy(animeDisplayPercentage, 'episodes');
        
        return (
          <SlideLayout bgColor="green">
            <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
            That adds up to
            </motion.h2>
            <motion.div className="mt-4 space-y-6 relative z-10 flex flex-col items-center justify-center" {...fadeSlideUp} data-framer-motion>
              <div className="text-center">
                <p className="number-lg text-white ">
                  <AnimatedNumber value={stats.totalEpisodes || 0} />
                </p>
                <p className="body-md text-white font-medium">episodes</p>
                <p className="body-sm text-white/50 mt-2 font-regular">and</p>
              </div>
              <div className="text-center">
                {stats.watchDays > 0 ? (
                  <>
                    <p className="number-lg text-white ">
                      <AnimatedNumber value={stats.watchDays} />
                    </p>
                    <p className="body-md text-white font-medium">days</p>
                    <p className="body-sm text-white/50 mt-2 font-regular">of nonstop binge</p>
                  </>
                ) : (
                  <>
                    <p className="number-lg text-white ">
                      <AnimatedNumber value={stats.watchTime} />
                    </p>
                    <p className="heading-md text-white font-medium">hours</p>
                    <p className="body-sm text-white/50 mt-2 font-regular">of nonstop binge</p>
                  </>
                )}
              </div>
              {animeComparison && animeDisplayPercentage > 0 && animeComparisonCopy && (
                <div className="text-center mt-4 w-full">
                  <p className="body-sm text-white/50 font-regular">
                    {animeComparisonCopy.prefix}
                    <span className="text-white font-semibold">{animeDisplayPercentage}%</span>
                    {animeComparisonCopy.suffix}
                  </p>
                </div>
              )}
            </motion.div>
          </SlideLayout>
        );

      case 'top_genre':
        const topGenre = stats.topGenres && stats.topGenres.length > 0 ? stats.topGenres[0][0] : null;
        const topGenreAnime = topGenre ? deduplicateByTitle(
          stats.thisYearAnime.filter(item => 
            item.node?.genres?.some(g => g.name === topGenre)
          )
        ) : [];
        const genreAnime = topGenreAnime.map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          malId: item.node?.id
        }));
        const otherGenres = stats.topGenres?.slice(1, 5) || [];
        return (
          <SlideLayout  bgColor="yellow">
            <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
            You kept coming back to the same genres
            </motion.h2>
            {topGenre ? (
              <>
                <motion.div className="mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
                  <p className="heading-lg font-semibold text-white ">1. {topGenre}</p>
                  <p className="mono text-white/50 font-regular">{stats.topGenres[0][1]} entries</p>
                </motion.div>
                {genreAnime.length > 0 && <div className="relative z-10"><ImageCarousel items={genreAnime} maxItems={10} showHover={true} showNames={false} /></div>}
                {otherGenres.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-2 relative z-10">
                    {otherGenres.map(([genreName, count], idx) => (
                      <motion.div key={idx} className="text-center rounded-xl" style={{ padding: '2px' }} variants={staggerItem}>
                        <motion.div 
                          className="bg-black/70 rounded-xl p-2 h-full"
                          whileHover={{ scale: 1.02, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
                          transition={{ duration: 0.3, ease: smoothEase }}
                        >
                          <p className="heading-sm font-semibold text-white truncate">{idx + 2}. {genreName}</p>
                          <p className="mono text-white/50 font-regular">{count} entries</p>
                      </motion.div>
                      </motion.div>
                    ))}
                    
                  </div>
                  
                )}
                <motion.h3 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>You know what you love
            </motion.h3>
              </>
              
            ) : (
              <motion.h3 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>No genres topped your list
            </motion.h3>
            )}
            
          </SlideLayout>
        );

      case 'drumroll_anime': {
        const DrumrollContent = () => {
          const [phase, setPhase] = useState(0);
          const topItem = stats.topRated.length > 0 ? stats.topRated[0] : null;
          
          useEffect(() => {
            const timer1 = setTimeout(() => setPhase(1), 2250);
            return () => {
              clearTimeout(timer1);
            };
          }, []);

          return (
            <SlideLayout>
            {phase === 0 ? (
              <motion.div className="text-center relative overflow-hidden z-10" {...fadeSlideUp} data-framer-motion>
                <motion.div 
                  className="relative z-10 mb-6 flex items-center justify-center"
                  {...pulse} 
                  data-framer-motion
                >
                  <img 
                    src="/anime-character.webp" 
                    alt="Anime character"
                    className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 object-contain"
                  />
                </motion.div>
                <h2 className="body-md font-regular text-white mt-4 text-container z-10 relative">But one show rose above everything</h2>
              </motion.div>
            ) : phase === 1 && topItem ? (
              <motion.div className="text-center relative overflow-hidden z-10">
                <div className="flex flex-col items-center justify-center gap-4">
                  <motion.div 
                    className="w-32 md:w-48 aspect-[2/3] bg-transparent rounded-lg overflow-hidden relative z-10" 
                    style={{ boxSizing: 'border-box' }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0, ease: smoothEase }}
                    whileHover={{ borderColor: '#ffffff' }}
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
                  <motion.div 
                    className="text-center relative z-10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2, ease: smoothEase }}
                  >
                    <h3 className="title-lg text-white font-semibold">{topItem.node?.title}</h3>
                    {topItem.node?.studios?.[0]?.name && (
                      <p className="body-sm text-white/50  font-regular">{topItem.node.studios[0].name}</p>
                    )}
                    <div className="flex items-center justify-center body-md text-yellow-300 font-bold mt-1">
                      <span className="mr-2">★</span>
                      <span>{topItem.list_status?.score ? Math.round(topItem.list_status.score) : 'N/A'}</span>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              <div className="body-md font-regular text-white/50 relative z-10">No favorite anime found</div>
            )}
          </SlideLayout>
          );
        };
        return <DrumrollContent />;
      }

      case 'top_5_anime': {
        const Top5Content = () => {
          const type = 'anime';
          const top5Items = stats.topRated.slice(0, 5);
          
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
              <SlideLayout>
                <div className="text-white/50 relative z-10">No favorite {type} found</div>
              </SlideLayout>
            );
          }

          return (
            <SlideLayout>
              <motion.div className="relative z-10" {...fadeSlideUp} data-framer-motion>
                <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
                  Including your top pick, these anime stole the spotlight
                </motion.h2>
                <div className="mt-2 sm:mt-3 flex flex-col gap-1.5 sm:gap-2 w-full relative z-10">
                  {(() => {
                    const [featured, ...others] = top5Formatted;
                    return (
                      <>
                        <motion.div 
                          className="rounded-xl overflow-hidden flex flex-row items-left relative w-full z-10" 
                          style={{ padding: '2px' }}
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.1, ease: smoothEase }}
                        >
                          <motion.div 
                            className="bg-black/70 rounded-xl w-full h-full flex flex-row items-center relative z-10"
                            whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
                            transition={{ duration: 0.3, ease: smoothEase }}
                          >
                            <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-white text-black rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm md:text-base">1</div>
                            {(() => {
                              const featuredUrl = featured.malId ? `https://myanimelist.net/anime/${featured.malId}` : (featured.mangaId ? `https://myanimelist.net/manga/${featured.mangaId}` : null);
                              const featuredImage = (
                                <motion.div 
                                  className="bg-transparent rounded-xl overflow-hidden relative z-10 aspect-[2/3] max-h-[225px]" 
                              style={{ boxSizing: 'border-box' }}
                                  whileHover={{ borderColor: '#ffffff' }}
                                  transition={{ duration: 0.3, ease: smoothEase}}
                                >
                                  {featured.coverImage && (
                                    <motion.img 
                                      src={featured.coverImage} 
                                      crossOrigin="anonymous" 
                                      alt={featured.title} 
                                      className="w-full h-full object-cover rounded-xl"
                                      whileHover={hoverImage}
                                    />
                                  )}
                                </motion.div>
                              );
                              return featuredUrl ? (
                                <a href={featuredUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="relative z-10">
                                  {featuredImage}
                                </a>
                              ) : featuredImage;
                            })()}
                            <motion.div 
                              className="p-1.5 sm:p-2 flex flex-col justify-left flex-grow min-w-0 text-left relative z-10"
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.5, delay: 0.2 }}
                            >
                              <h3 className="title-md mt-1.5 sm:mt-2 truncate font-semibold text-white text-left">{featured.title}</h3>
                              {featured.studio && <p className="body-sm text-white/50 truncate font-medium text-left">{featured.studio}</p>}
                              {featured.author && <p className="body-sm text-white/50 truncate font-medium text-left">{featured.author}</p>}
                              <div className="flex items-left justify-left mono text-yellow-300 mt-1 font-semibold">
                                <span className="mr-0.5 sm:mr-1">★</span>
                                <span>{Math.round(featured.userRating)}</span>
                              </div>
                              {featured.genres.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5 justify-left items-left">
                                  {featured.genres.slice(0, 2).map(g => (
                                    <motion.span 
                                      key={g} 
                                      className="mono text-white px-2 py-0.5 rounded-lg font-regular" 
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
                            className="grid grid-cols-4 gap-2 w-full relative z-10"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delayChildren: 0.4, staggerChildren: 0.1 }}
                          >
                            {others.map((item, index) => {
                              const malUrl = item.malId ? `https://myanimelist.net/anime/${item.malId}` : (item.mangaId ? `https://myanimelist.net/manga/${item.mangaId}` : null);
                              const itemContent = (
                                <motion.div 
                                  className="flex flex-col w-full min-w-0 relative z-10"
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.4 }}
                                >
                                <motion.div 
                                  className="bg-transparent rounded-xl overflow-hidden relative w-full z-10 aspect-[2/3] max-h-[175px]" 
                                  style={{ boxSizing: 'border-box' }}
                                    whileHover={{ borderColor: '#ffffff' }}
                                    transition={{ duration: 0.3, ease: smoothEase}}
                                  >
                                    <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 z-10 w-5 h-5 sm:w-6 sm:h-6 bg-white text-black rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm">{index + 2}</div>
                                    {item.coverImage && (
                                      <motion.img 
                                        src={item.coverImage} 
                                        alt={item.title} 
                                        crossOrigin="anonymous" 
                                        className="w-full h-full object-cover rounded-xl"
                                        whileHover={hoverImage}
                                      />
                                    )}
                                  </motion.div>
                                  <div className="mt-2 text-center w-full min-w-0 relative z-10">
                                    <h3 className="title-sm truncate font-semibold text-white">{item.title}</h3>
                                    <div className="flex items-center justify-center mono text-yellow-300 font-semibold mt-1">
                                      <span className="mr-0.5 sm:mr-1 shrink-0">★</span>
                                      <span>{Math.round(item.userRating)}</span>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                              return (
                                <motion.div key={item.id} className="w-full min-w-0 relative z-10">
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
                <motion.h2 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>A lineup worth bragging about</motion.h2>
              </motion.div>
            </SlideLayout>
          );
        };
        return <Top5Content />;
      }

      case 'top_studio':
        const topStudio = stats.topStudios && stats.topStudios.length > 0 ? stats.topStudios[0][0] : null;
        const topStudioAnime = topStudio ? deduplicateByTitle(
          stats.thisYearAnime.filter(item => 
            item.node?.studios?.some(s => s.name === topStudio)
          )
        ) : [];
        
        const studioAnime = topStudioAnime.map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          malId: item.node?.id
        }));
        const otherStudios = stats.topStudios?.slice(1, 5) || [];
        return (
          <SlideLayout bgColor="red">
            <div className="text-center relative">
            <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
            These studios defined your watchlist
            </motion.h2>
            </div>
            {topStudio ? (
              <>
                <motion.div className="mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
                  <p className="heading-lg font-semibold text-white ">1. {topStudio}</p>
                  <p className="mono text-white/50 font-regular">{stats.topStudios[0][1]} entries</p>
                </motion.div>
                {studioAnime.length > 0 && (
                  <div className="relative z-10"><ImageCarousel items={studioAnime} maxItems={10} showHover={true} showNames={false} /></div>
                )}
                {otherStudios.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 relative z-10">
                    {otherStudios.map(([studioName, count], idx) => (
                      <motion.div key={idx} className="text-center rounded-xl" style={{ padding: '2px' }} variants={staggerItem}>
                        <motion.div 
                          className="bg-black/70 rounded-xl p-2 h-full"
                          whileHover={{ scale: 1.02, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
                          transition={{ duration: 0.3, ease: smoothEase }}
                        >
                          <p className="heading-sm font-semibold text-white truncate">{idx + 2}. {studioName}</p>
                          <p className="mono text-white/50 font-regular">{count} entries</p>
                      </motion.div>
                      </motion.div>
                    ))}
                  </div>
                  
                )}
                <motion.h3 className="body-sm font-regular text-white/50 text-center text-container mt-4 relative z-10" {...fadeSlideUp} data-framer-motion>
                You know who gets the job done
            </motion.h3>
              </>
            ) : (
              <motion.h3 className="body-md font-regular text-white/50 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
            No studios showed up enough to be counted
            </motion.h3>
            )}
          </SlideLayout>
        );

      case 'seasonal_highlights':
        const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];
        const hasAnySeasonalData = seasons.some(season => stats.seasonalHighlights?.[season]);
        
        if (!hasAnySeasonalData) {
          return (
            <SlideLayout bgColor="pink">
              <motion.h3 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
                You didn't follow any seasonal anime this time
              </motion.h3>
            </SlideLayout>
          );
        }
        
        return (
          <SlideLayout bgColor="pink">
            <div className="text-center relative">
              <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
              Each season dropped something special
            </motion.h2>
            </div>
            <div className="mt-2 sm:mt-4 flex flex-col md:grid md:grid-cols-2 gap-1.5 sm:gap-2 relative z-10">
              {seasons.map(season => {
                const seasonData = stats.seasonalHighlights?.[season];
                if (!seasonData) return null;
                const highlight = seasonData.highlight;
                const seasonIndex = seasons.indexOf(season);
                // Get year from highlight for "all time" view
                const seasonYear = stats.selectedYear === 'all' && highlight?.node?.start_season?.year 
                  ? ` ${highlight.node.start_season.year}` 
                  : '';
                return (
                  <motion.div 
                    key={season} 
                    className="rounded-xl" 
                    style={{ padding: '2px' }}
                    variants={staggerItem}
                    initial="initial"
                    animate="animate"
                  >
                    <motion.div 
                      className="bg-black/70 rounded-xl p-2 h-full"
                      whileHover={{ scale: 1.02, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
                      transition={{ duration: 0.3, ease: smoothEase }}
                    >
                      <h3 className="heading-md font-semibold text-white mb-1 sm:mb-2 text-sm sm:text-base">{season}{seasonYear}</h3>
                    {highlight && (
                      <>
                          <div className="flex gap-1.5 sm:gap-2">
                            <motion.div 
                              className="bg-transparent aspect-[2/3] rounded-lg overflow-hidden relative w-12 sm:w-16 md:w-20" 
                              style={{ boxSizing: 'border-box' }}
                              transition={{ duration: 0.3, ease: smoothEase }}
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
                              <p className="title-md truncate font-semibold text-white">{highlight.node?.title}</p>
                              <p className="body-sm text-white/50 truncate font-medium">{highlight.node?.studios?.[0]?.name || ''}</p>
                              <p className="mono text-yellow-300 mt-1 sm:mt-2 font-semibold mt-1">★ {highlight.list_status?.score ? Math.round(highlight.list_status.score) : 'Not Rated'}</p>
                              <p className="mono text-white/50 truncate mt-1 sm:mt-2 font-regular">{seasonData.totalAnime} anime this season</p>
                          </div>
                        </div>
                      </>
                    )}
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
            <motion.h3 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>You caught every wave right on time
            </motion.h3>
          </SlideLayout>
        );

      case 'hidden_gems_anime':
        if (!stats.rareAnimeGems || stats.rareAnimeGems.length === 0) {
          return (
            <SlideLayout bgColor="blue">
              <motion.h3 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
                No hidden gems discovered this time
              </motion.h3>
            </SlideLayout>
          );
        }
        const rareAnimeItems = stats.rareAnimeGems.map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          popularity: item.popularity,
          userRating: item.score,
          malId: item.node?.id
        }));
        return (
          <SlideLayout bgColor="blue">
            <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
              You spotted quality where few were looking
            </motion.h2>
            <motion.div className="mt-4 relative z-10" {...fadeSlideUp} data-framer-motion>
              {rareAnimeItems.map((item, idx) => (
                <motion.div
                  key={idx}
                  className="mb-4 rounded-xl overflow-visible"
                  style={{ padding: '2px' }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                >
                  <motion.div
                    className="bg-black/70 rounded-xl p-4 flex items-center gap-4"
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
                    transition={{ duration: 0.3, ease: smoothEase }}
                  >
                    {item.coverImage && (
                      <a 
                        href={item.malId ? `https://myanimelist.net/anime/${item.malId}` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <motion.img
                          src={item.coverImage}
                          alt={item.title}
                          className="w-20 h-28 object-cover rounded-lg cursor-pointer"
                          crossOrigin="anonymous"
                          whileHover={{ scale: 1.05 }}
                          transition={{ duration: 0.2, ease: smoothEase }}
                        />
                      </a>
                    )}
                    <div className="flex-1">
                      <h3 className="title-md font-semibold text-white">{item.title}</h3>
                      <p className="body-sm text-white/70 mt-1 font-regular">
                        Only {item.popularity.toLocaleString()} people completed this on MAL!
                      </p>
                      {item.userRating && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="mono text-yellow-300 font-semibold">★ {Math.round(item.userRating)}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
            <motion.h3 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
            You found <span className="text-white font-semibold">{stats.hiddenGemsAnimeCount ?? 0}</span> such anime. A true hidden-gem hunter
            </motion.h3>
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
          <SlideLayout  bgColor="red">
            <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
            Not everything hit the way you hoped
            </motion.h2>
            {didntLand.length > 0 ? (
              <motion.div className="relative z-10" {...fadeSlideUp} data-framer-motion>
                <GridImages items={didntLand} maxItems={3} />
                <motion.h3 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>Better luck next season
            </motion.h3>
              </motion.div>
            ) : (
              <motion.h3 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>Nothing rated low, because nothing was rated at all</motion.h3>
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
          <SlideLayout  bgColor="green">
            <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
            Your planned list only got longer
            </motion.h2>
            {plannedAnimeItems.length > 0 ? (
              <motion.div className="relative z-10" {...fadeSlideUp} data-framer-motion>
                <GridImages items={plannedAnimeItems} maxItems={3} />
                <motion.h3 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>One day you’ll get to them… probably</motion.h3>
              </motion.div>
            ) : (
              <motion.h3 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>You didn’t add anything to your plan-to-watch list</motion.h3>
            )}
          </SlideLayout>
        );

      case 'anime_to_manga_transition':
        return (
          <SlideLayout bgColor="black">
            <motion.div className="text-center relative z-10" {...fadeSlideUp} data-framer-motion>
              <motion.div 
                className="relative z-10 mb-6 flex items-center justify-center"
                data-framer-motion
              >
                <img 
                  src="/manga-character.webp" 
                  alt="Manga character"
                  className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 object-contain"
                />
              </motion.div>
              <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
                Now let's see what you've been reading
              </motion.h2>
              <motion.h3 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
                From screens to pages
              </motion.h3>
            </motion.div>
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
            <SlideLayout bgColor="yellow">
              <motion.div className="text-center relative z-10" {...fadeSlideUp} data-framer-motion>
                <h2 className="heading-md text-white mb-4 text-container">
                  You didn't read any manga {stats.selectedYear === 'all' ? '' : 'in ' + stats.selectedYear}.
                </h2>
                <p className="body-md text-white/80 mb-6 text-container">
                  Log your read manga on MyAnimeList to see your personalized wrapped!
                </p>
                <motion.a
                  href="https://myanimelist.net/"
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
          <SlideLayout bgColor="yellow">
            <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
            {stats.selectedYear === 'all' ? 'Till now' : 'In ' + stats.selectedYear}, you read through
            </motion.h2>
            <motion.div className="mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
              <p className="number-xl text-white ">
                <AnimatedNumber value={stats.totalManga} /> manga
              </p>
            </motion.div>
            {allMangaItems.length > 0 && <ImageCarousel items={allMangaItems} maxItems={10} showHover={true} showNames={false} />}
            {stats.yearComparison && stats.yearComparison.previousMangaCount > 0 && (
              <motion.h3 className="body-sm font-regular mt-4 text-white/50 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
                {stats.yearComparison.isMangaGrowth ? (
                  <>That's <span className="text-white font-semibold">{Math.abs(stats.yearComparison.mangaCountGrowth)}</span> more than last year. Your library is growing!</>
                ) : (
                  <>You read <span className="text-white font-semibold">{Math.abs(stats.yearComparison.mangaCountGrowth)}</span> less than last year. There’s always another chapter!!</>
                )}
              </motion.h3>
            )}
            {(!stats.yearComparison || !stats.yearComparison.previousMangaCount) && (
              <motion.h3 className="body-sm font-regular mt-4 text-white/50 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
                That's some serious reading energy
              </motion.h3>
            )}
          </SlideLayout>
        );

      case 'manga_time':
        // Get percentage for comparison
        const mangaComparison = stats.mangaComparison;
        const mangaDisplayPercentage = mangaComparison 
          ? (stats.selectedYear === 'all' ? mangaComparison.allTimePercentage : mangaComparison.percentage)
          : 0;
        const mangaComparisonCopy = getComparisonCopy(mangaDisplayPercentage, 'chapters');
        
        return (
          <SlideLayout bgColor="blue">
            <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
            That's
            </motion.h2>
            <motion.div className="mt-4 space-y-6 relative z-10 flex flex-col items-center justify-center" {...fadeSlideUp} data-framer-motion>
              <div className="text-center">
                <p className="number-lg text-white ">
                  <AnimatedNumber value={stats.totalChapters || 0} />
                </p>
                <p className="body-md text-white font-regular">chapters</p>
                <p className="body-sm text-white/50 mt-2 font-regular">and</p>
              </div>
              {stats.mangaDays > 0 ? (
                <div className="text-center">
                  <p className="number-lg text-white ">
                    <AnimatedNumber value={stats.mangaDays} />
                  </p>
                  <p className="body-md text-white font-regular">days</p>
                  <p className="body-sm text-white/50 mt-2 font-regular">spent flipping pages</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="number-lg text-white ">
                    <AnimatedNumber value={stats.mangaHours || 0} />
                  </p>
                  <p className="heading-md text-white font-medium">hours</p>
                  <p className="body-sm text-white/50 mt-2 font-regular">spent flipping pages</p>
                </div>
              )}
              {mangaComparison && mangaDisplayPercentage > 0 && mangaComparisonCopy && (
                <div className="text-center mt-4 w-full max-w-md">
                  <p className="body-sm text-white/50 font-regular">
                    {mangaComparisonCopy.prefix}
                    <span className="text-white font-semibold">{mangaDisplayPercentage}%</span>
                    {mangaComparisonCopy.suffix}
                  </p>
                </div>
              )}
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
          <SlideLayout  bgColor="yellow">
          <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
          These genres kept you hooked the most
            </motion.h2>
            {topMangaGenre ? (
              <>
                <motion.div className="mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
                  <p className="heading-lg font-semibold text-white ">1. {topMangaGenre[0]}</p>
                  <p className="mono text-white/50 font-regular">{topMangaGenre[1]} entries</p>
                </motion.div>
                {mangaGenreItems.length > 0 && <div className="relative z-10"><ImageCarousel items={mangaGenreItems} maxItems={10} showHover={true} showNames={false} /></div>}
                {otherMangaGenres.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 relative z-10">
                    {otherMangaGenres.map(([genreName, count], idx) => (
                  <motion.div key={idx} className="text-center rounded-xl" style={{ padding: '2px' }} variants={staggerItem}>
                        <motion.div 
                      className="bg-black/70 rounded-xl p-2 h-full"
                          whileHover={{ scale: 1.02, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
                          transition={{ duration: 0.3, ease: smoothEase }}
                        >
                          <p className="heading-sm font-semibold text-white truncate">{idx + 2}. {genreName}</p>
                          <p className="mono text-white/50 font-regular">{count} entries</p>
                      </motion.div>
                      </motion.div>
                    ))}
                  </div>
                )}
                <motion.h3 className="body-sm font-regular text-white/50 text-center text-container relative z-10 mt-4" {...fadeSlideUp} data-framer-motion>
                Clearly, you have a type
            </motion.h3>
              </>
              
            ) : (
              <motion.h3 className="body-sm font-regular text-white/50 text-center text-container relative z-10 mt-4" {...fadeSlideUp} data-framer-motion>
                No genres rose to the top
            </motion.h3>)}
          </SlideLayout>
        );

      case 'drumroll_manga': {
        const DrumrollContent = () => {
          const [phase, setPhase] = useState(0);
          const topItem = stats.topManga.length > 0 ? stats.topManga[0] : null;
          
          useEffect(() => {
            const timer1 = setTimeout(() => setPhase(1), 2250);
            return () => {
              clearTimeout(timer1);
            };
          }, []);

          return (
            <SlideLayout>
              {phase === 0 ? (
                <motion.div className="text-center relative overflow-hidden z-10" {...fadeSlideUp} data-framer-motion>
                  <motion.div 
                    className="relative z-10 mb-6 flex items-center justify-center"
                    {...pulse} 
                    data-framer-motion
                  >
                    <img 
                      src="/manga-character.webp" 
                      alt="Manga character"
                      className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 object-contain"
                    />
                  </motion.div>
                  <h2 className="body-md font-regular text-white mt-4 text-container z-10 relative">But one manga kept you turning pages nonstop</h2>
                </motion.div>
              ) : phase === 1 && topItem ? (
                <motion.div className="text-center relative overflow-hidden z-10">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <motion.div 
                      className="w-32 md:w-48 aspect-[2/3] bg-transparent rounded-lg overflow-hidden relative z-10" 
                      style={{ boxSizing: 'border-box' }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0, ease: smoothEase }}
                      whileHover={{ borderColor: '#ffffff' }}
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
                    <motion.div 
                      className="text-left relative z-10"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.2, ease: smoothEase }}
                    >
                      <h3 className="title-lg text-white font-semibold">{topItem.node?.title}</h3>
                      {topItem.node?.authors?.[0] && (
                        <p className="body-sm text-white/50  font-regular">
                          {`${topItem.node.authors[0].node?.first_name || ''} ${topItem.node.authors[0].node?.last_name || ''}`.trim()}
                        </p>
                      )}
                      <div className="flex items-left justify-left mono text-yellow-300 font-bold mt-1">
                        <span className="mr-2">★</span>
                        <span>{topItem.list_status?.score ? Math.round(topItem.list_status.score) : 'N/A'}</span>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              ) : (
                <div className="body-md font-regular text-white/50 relative z-10">No favorite manga found</div>
              )}
            </SlideLayout>
          );
        };
        return <DrumrollContent />;
      }

      case 'top_5_manga': {
        const Top5Content = () => {
          const type = 'manga';
          const top5Items = stats.topManga.slice(0, 5);
          
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
              <SlideLayout>
                <div className="text-white/50 relative z-10">No favorite {type} found</div>
              </SlideLayout>
            );
          }

          return (
            <SlideLayout>
              <motion.div className="relative z-10" {...fadeSlideUp} data-framer-motion>
                <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
                  Including your top read, these manga ruled your shelves
                </motion.h2>
                <div className="mt-2 sm:mt-3 flex flex-col gap-1.5 sm:gap-2 w-full relative z-10">
                  {(() => {
                    const [featured, ...others] = top5Formatted;
                    return (
                      <>
                        <motion.div 
                          className="rounded-xl overflow-hidden flex flex-row items-left relative w-full z-10" 
                          style={{ padding: '2px' }}
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.1, ease: smoothEase }}
                        >
                          <motion.div 
                            className="bg-black/70 rounded-xl w-full h-full flex flex-row items-center relative z-10"
                            whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
                            transition={{ duration: 0.3, ease: smoothEase }}
                          >
                            <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-white text-black rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm md:text-base">1</div>
                            {(() => {
                              const featuredUrl = featured.malId ? `https://myanimelist.net/anime/${featured.malId}` : (featured.mangaId ? `https://myanimelist.net/manga/${featured.mangaId}` : null);
                              const featuredImage = (
                                <motion.div 
                                  className="bg-transparent rounded-xl overflow-hidden relative z-10" 
                                  style={{ boxSizing: 'border-box', aspectRatio: '2/3', maxHeight: '225px' }}
                                  whileHover={{ borderColor: '#ffffff' }}
                                  transition={{ duration: 0.3, ease: smoothEase}}
                                >
                                  {featured.coverImage && (
                                    <motion.img 
                                      src={featured.coverImage} 
                                      crossOrigin="anonymous" 
                                      alt={featured.title} 
                                      className="w-full h-full object-cover rounded-xl"
                                      whileHover={hoverImage}
                                    />
                                  )}
                                </motion.div>
                              );
                              return featuredUrl ? (
                                <a href={featuredUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="relative z-10">
                                  {featuredImage}
                                </a>
                              ) : featuredImage;
                            })()}
                            <motion.div 
                              className="p-1.5 sm:p-2 flex flex-col justify-left flex-grow min-w-0 text-left relative z-10"
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.5, delay: 0.2 }}
                            >
                              <h3 className="title-md mt-1.5 sm:mt-2 truncate font-semibold text-white text-left">{featured.title}</h3>
                              {featured.studio && <p className="body-sm text-white/50 truncate font-medium text-left">{featured.studio}</p>}
                              {featured.author && <p className="body-sm text-white/50 truncate font-medium text-left">{featured.author}</p>}
                              <div className="flex items-left justify-left mono text-yellow-300 mt-1 font-semibold">
                                <span className="mr-0.5 sm:mr-1">★</span>
                                <span>{Math.round(featured.userRating)}</span>
                              </div>
                              {featured.genres.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2 justify-left items-left">
                                  {featured.genres.slice(0, 2).map(g => (
                                    <motion.span 
                                      key={g} 
                                      className="mono text-white px-2 py-0.5 rounded-lg font-regular" 
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
                            className="grid grid-cols-4 gap-2 w-full relative z-10"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delayChildren: 0.4, staggerChildren: 0.1 }}
                          >
                            {others.map((item, index) => {
                              const malUrl = item.malId ? `https://myanimelist.net/anime/${item.malId}` : (item.mangaId ? `https://myanimelist.net/manga/${item.mangaId}` : null);
                              const itemContent = (
                                <motion.div 
                                  className="flex flex-col w-full min-w-0 relative z-10"
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.4 }}
                                >
                                <motion.div 
                                  className="bg-transparent rounded-xl overflow-hidden relative w-full z-10" 
                                  style={{ boxSizing: 'border-box', aspectRatio: '2/3', maxHeight: '175px' }}
                                    whileHover={{ borderColor: '#ffffff' }}
                                    transition={{ duration: 0.3, ease: smoothEase}}
                                  >
                                    <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 z-10 w-5 h-5 sm:w-6 sm:h-6 bg-white text-black rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm">{index + 2}</div>
                                    {item.coverImage && (
                                      <motion.img 
                                        src={item.coverImage} 
                                        alt={item.title} 
                                        crossOrigin="anonymous" 
                                        className="w-full h-full object-cover rounded-xl"
                                        whileHover={hoverImage}
                                      />
                                    )}
                                  </motion.div>
                                  <div className="mt-2 text-center w-full min-w-0 relative z-10">
                                    <h3 className="title-sm truncate font-semibold text-white">{item.title}</h3>
                                    <div className="flex items-center justify-center mono text-yellow-300 font-semibold mt-1">
                                      <span className="mr-0.5 sm:mr-1 shrink-0">★</span>
                                      <span>{Math.round(item.userRating)}</span>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                              return (
                                <motion.div key={item.id} className="w-full min-w-0 relative z-10">
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
                <motion.h2 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>A lineup worth bragging about</motion.h2>
              </motion.div>
            </SlideLayout>
          );
        };
        return <Top5Content />;
      }


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
          <SlideLayout  bgColor="pink">
          <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
          These authors kept appearing across your reads
            </motion.h2>
            {topAuthor ? (
              <>
                <motion.div className="mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
                  <p className="heading-lg font-semibold text-white ">1. {topAuthor}</p>
                  <p className="mono text-white/50 font-regular">{stats.topAuthors[0][1]} entries</p>
                </motion.div>
                {authorManga.length > 0 && (
                  <div className="relative z-10"><ImageCarousel items={authorManga} maxItems={10} showHover={true} showNames={false} /></div>
                )}
                {otherAuthors.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 relative z-10">
                    {otherAuthors.map(([authorName, count], idx) => (
                      <motion.div key={idx} className="text-center rounded-xl" style={{ padding: '2px' }} variants={staggerItem}>
                        <motion.div 
                          className="bg-black/70 rounded-xl p-2 h-full"
                          whileHover={{ scale: 1.02, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
                          transition={{ duration: 0.3 , ease: smoothEase }}
                        >
                          <p className="heading-sm font-semibold text-white truncate">{idx + 2}. {authorName}</p>
                          <p className="mono text-white/50 font-regular">{count} entries</p>
                      </motion.div>
                      </motion.div>
                      
                    ))}
                  </div>
                  
                )}
                <motion.h3 className="body-sm font-regular text-white/50 text-center text-container relative z-10 mt-4" {...fadeSlideUp} data-framer-motion>
                You know who delivers good writing
            </motion.h3>
              </>
              
            ) : (
              <motion.h3 className="body-sm font-regular text-white/50 text-center text-container relative z-10 mt-4" {...fadeSlideUp} data-framer-motion>
                No author took the spotlight
            </motion.h3>
            )}
          </SlideLayout>
        );

      case 'hidden_gems_manga':
        if (!stats.rareMangaGems || stats.rareMangaGems.length === 0) {
          return (
            <SlideLayout bgColor="blue">
              <motion.h3 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
                No hidden gems found yet
              </motion.h3>
            </SlideLayout>
          );
        }
        const rareMangaItems = stats.rareMangaGems.map(item => ({
          title: item.node?.title || '',
          coverImage: item.node?.main_picture?.large || item.node?.main_picture?.medium || '',
          popularity: item.popularity,
          userRating: item.score,
          mangaId: item.node?.id
        }));
        return (
          <SlideLayout bgColor="blue">
            <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
              These low-profile reads turned out surprisingly strong
            </motion.h2>
            <motion.div className="mt-4 relative z-10" {...fadeSlideUp} data-framer-motion>
              {rareMangaItems.map((item, idx) => (
                <motion.div
                  key={idx}
                  className="mb-2 rounded-xl overflow-visible"
                  style={{ padding: '2px' }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                >
                  <motion.div
                    className="bg-black/70 rounded-xl p-4 flex items-center gap-4"
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
                    transition={{ duration: 0.3, ease: smoothEase }}
                  >
                    {item.coverImage && (
                      <a 
                        href={item.mangaId ? `https://myanimelist.net/manga/${item.mangaId}` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <motion.img
                          src={item.coverImage}
                          alt={item.title}
                          className="w-20 h-28 object-cover rounded-lg cursor-pointer"
                          crossOrigin="anonymous"
                          whileHover={{ scale: 1.05 }}
                          transition={{ duration: 0.2, ease: smoothEase }}
                        />
                      </a>
                    )}
                    <div className="flex-1">
                      <h3 className="title-md font-semibold text-white">{item.title}</h3>
                      <p className="body-sm text-white/70 mt-1 font-regular">
                        Only {item.popularity.toLocaleString()} people completed this on MAL!
                      </p>
                      {item.userRating && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="mono text-yellow-300 font-semibold">★ {Math.round(item.userRating)}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
            <motion.h3 className="body-sm font-regular text-white/50 mt-4 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
            You found <span className="text-white font-semibold">{stats.hiddenGemsMangaCount ?? 0}</span> such titles. Not everyone finds gems like these
            </motion.h3>
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
          <SlideLayout  bgColor="red">
          <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
          But even great readers hit a few misses
            </motion.h2>
            {mangaDidntLand.length > 0 ? (
              <motion.div {...fadeSlideUp} data-framer-motion>
                <GridImages items={mangaDidntLand} maxItems={3} />
                <motion.h3 className="body-sm font-regular text-white/50 text-center text-container relative z-10 mt-4" {...fadeSlideUp} data-framer-motion>
                Happens to the best of us
            </motion.h3>
              </motion.div>
            ) : (
              <motion.h3 className="body-sm font-regular text-white/50 text-center text-container relative z-10 mt-4" {...fadeSlideUp} data-framer-motion>
                Nothing rated low, rather nothing rated at all
            </motion.h3>
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
          <SlideLayout  bgColor="green">
            <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
            Your reading backlog continued to grow
            </motion.h2>
            {plannedMangaItems.length > 0 ? (
              <motion.div {...fadeSlideUp} data-framer-motion>
                <GridImages items={plannedMangaItems} maxItems={3} />
                <motion.h3 className="body-sm font-regular text-white/50 text-center text-container relative z-10 mt-4" {...fadeSlideUp} data-framer-motion>
                You better get reading after this Wrapped
            </motion.h3>
              </motion.div>
            ) : (
              <motion.h3 className="body-sm font-regular text-white/50 text-center text-container relative z-10 mt-4" {...fadeSlideUp} data-framer-motion>
                No manga added to your plan-to-read list
            </motion.h3>
            )}
          </SlideLayout>
        );

      // ========== NEW UNIQUE FEATURES ==========
      
      case 'milestones':
        if (!stats.thisYearMilestone) return null;
        const milestoneCount = stats.thisYearMilestone.count;
        const milestonePercent = Math.min(100, Math.max(1, Math.round((milestoneCount / 1000000) * 100))); // Rough estimate
        return (
          <SlideLayout bgColor="yellow">
            <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
              You hit a major milestone!
            </motion.h2>
            <motion.div className="mt-4 text-center relative z-10" {...fadeSlideUp} data-framer-motion>
              <p className="number-xl text-white">
                <AnimatedNumber value={milestoneCount} />
              </p>
              <p className="heading-md text-white font-semibold mt-2">
                completed anime
              </p>
              <p className="body-sm text-white/70 mt-4 text-container">
                That's a milestone shared by only the top {milestonePercent}% of MAL users!
              </p>
            </motion.div>
            <motion.h3 className="body-sm font-regular text-white/50 mt-6 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
              Keep the momentum going!
            </motion.h3>
          </SlideLayout>
        );

      case 'badges':
        if (!stats.badges || stats.badges.length === 0) return null;
        
        // Character image mapping for different badge types
        const badgeImages = {
          'the_hunter': '/badges/the-hunter.webp', // Light Yagami
          'the_explorer': '/badges/the-explorer.webp', // Monkey D. Luffy
          'the_archivist': '/badges/the-archivist.webp', // Girl reading book
          'the_strategist': '/badges/the-strategist.webp', // Boy with green hair and lightning
          'the_sprinter': '/badges/the-binge-warrior.webp', // Naruto eating ramen
          'the_loyalist': '/badges/the-loyalist.webp', // Sailor Moon
          'the_specialist': '/badges/the-genre-master.webp', // Gon Freecss
          'the_rookie': '/badges/the-rookie.webp' // Rem
        };
        
        return (
          <SlideLayout bgColor="purple">
            <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
              You earned some impressive badges
            </motion.h2>
            <motion.div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-2 max-w-3xl mx-auto relative z-10" {...fadeSlideUp} data-framer-motion>
              {stats.badges.map((badge, idx) => (
                <motion.div
                  key={badge.type}
                  className="rounded-xl overflow-hidden"
                  style={{ padding: '2px' }}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.1, ease: smoothEase }}
                >
                  <motion.div
                    className="bg-black/60 rounded-xl p-4 h-full"
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(0, 0, 0, 0.45)'}}
                    transition={{ duration: 0.3, ease: smoothEase }}
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        className="w-20 md:w-24 h-20 md:h-24 flex-shrink-0 rounded-full overflow-hidden"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.4, delay: idx * 0.1 + 0.2, type: "spring", stiffness: 200 }}
                      >
                        <img
                          src={badgeImages[badge.type] || '/badges/default-badge.webp'}
                          alt={badge.name}
                          className="w-full h-full object-cover rounded-full"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            e.target.src = '/anime-character.webp';
                          }}
                        />
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <p className="heading-sm font-semibold text-white mb-1">{badge.name}</p>
                        <p className="body-xs text-white/60 font-regular leading-relaxed">{badge.description}</p>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
            <motion.h3 className="body-sm font-regular text-white/50 mt-6 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
              Your dedication shows!
            </motion.h3>
          </SlideLayout>
        );

      case 'character_twin':
        if (!stats.characterTwin) return null;
        // Use character image from API if available, otherwise fallback to default
        const characterImage = stats.characterTwin.characterImage || stats.characterTwin.coverImage || '/anime-character.webp';
        return (
          <SlideLayout bgColor="pink">
            <motion.h2 className="body-md font-regular text-white text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
              Your Twin
            </motion.h2>
            <motion.div className="mt-6 flex flex-col items-center relative z-10" {...fadeSlideUp} data-framer-motion>
              <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0 mb-4">
                <motion.div
                  className="relative z-20 w-full h-full rounded-xl overflow-hidden block"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, ease: smoothEase }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <img
                    src={characterImage}
                    alt={stats.characterTwin.title}
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      e.target.src = '/anime-character.webp';
                    }}
                  />
                </motion.div>
              </div>
              <p className="heading-lg text-white font-semibold text-center">{stats.characterTwin.title}</p>
              {stats.characterTwin.series && (
                <p className="body-md text-white/60 text-center">{stats.characterTwin.series}</p>
              )}
             
            </motion.div>
            <motion.h3 className="body-sm font-regular text-white/50 mt-6 text-center text-container relative z-10" {...fadeSlideUp} data-framer-motion>
            {stats.characterTwin.reason}
            </motion.h3>
          </SlideLayout>
        );

      case 'finale': {
        const totalTimeSpent = stats.totalTimeSpent || 0;
        const totalDays = Math.floor(totalTimeSpent / 24);
        
        // Calculate top manga genres for finale
        const finaleMangaGenres = {};
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
            finaleMangaGenres[genre.name] = (finaleMangaGenres[genre.name] || 0) + 1;
          });
        });
        const finaleCombinedGenres = {};
        (stats.topGenres || []).forEach(([genre, count]) => {
          finaleCombinedGenres[genre] = (finaleCombinedGenres[genre] || 0) + count;
        });
        Object.entries(finaleMangaGenres).forEach(([genre, count]) => {
          finaleCombinedGenres[genre] = (finaleCombinedGenres[genre] || 0) + count;
        });
        const finaleTopGenre = Object.entries(finaleCombinedGenres).sort((a, b) => b[1] - a[1])[0];
        const favoriteAuthor = stats.topAuthors?.[0]?.[0] || null;
        
        return (
          <SlideLayout  bgColor="blue">
                <motion.div 
              className="w-full h-full flex flex-col items-center justify-center relative z-20 px-4 sm:px-6 md:px-8"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {/* Image with Heading */}
              <motion.div 
                className="w-full max-w-3xl flex items-center justify-center gap-6 sm:gap-8 mb-6 sm:mb-8 relative z-20"
                variants={staggerItem}
              >
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 flex items-center justify-center flex-shrink-0 z-20">
                  <motion.a
                    href={username ? `https://myanimelist.net/profile/${encodeURIComponent(username)}` : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative z-20 w-full h-full rounded-xl overflow-hidden block"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: smoothEase }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <img 
                      src={userImage} 
                      alt={username || 'User'} 
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  </motion.a>
                </div>
                <div className="flex-1 relative z-20">
                  <motion.h2 
                    className="heading-md md:heading-lg text-white font-medium relative z-20"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: smoothEase }}
                  >
                    {username || 'Your'}'s {stats.selectedYear !== 'all' ? `${stats.selectedYear} ` : ''}MyAnimeList Wrapped
                  </motion.h2>
              </div>
              </motion.div>

              {/* Text Content Below - All sections in one flex container with consistent gap */}
              <div className="w-full max-w-3xl flex flex-col gap-6 md:gap-8 text-white relative z-20">
                <motion.div 
                  className="grid grid-cols-2 gap-4 md:gap-6 relative z-20"
                  variants={staggerItem}
                >
                  <div className="space-y-1">
                    <p className="body-sm text-white/50 font-medium mb-1">Top Anime</p>
                    {stats.topRated.slice(0, 5).map((a, i) => (
                        <p key={a.node.id} className="text-white truncate">
                          <span className="title-sm text-white font-medium truncate mr-2">{String(i + 1)}</span>
                          <span className="title-md text-white font-medium truncate">{a.node.title}</span>
                      </p>
                    ))}
                  </div>
                  
                  <div className="space-y-1">
                    <p className="body-sm text-white/50 font-medium mb-1">Top Manga</p>
                    
                    {stats.topManga.slice(0, 5).map((m, i) => (
                        <p key={m.node.id} className="text-white truncate">
                          <span className="title-sm text-white font-medium truncate mr-2">{String(i + 1)}</span>
                          <span className="title-md text-white font-medium truncate">{m.node.title}</span>
                      </p>
                    ))}
                  </div>
                </motion.div>

                <motion.div 
                  className="grid grid-cols-2 gap-4 md:gap-6 relative z-20"
                  variants={staggerItem}
                >
                  <div className="space-y-1">
                    {finaleTopGenre && (
                      <>
                        <p className="body-sm text-white/50 font-medium mb-1">Favorite Genre</p>
                        <p className="title-md text-white font-medium">{finaleTopGenre[0]}</p>
                      </>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    {favoriteAuthor && (
                      <>
                        <p className="body-sm text-white/50 font-medium mb-1">Favorite Author</p>
                        <p className="title-md text-white font-medium">{favoriteAuthor}</p>
                      </>
                    )}
                  </div>
                </motion.div>

                <motion.div 
                  className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6 relative z-20"
                  variants={staggerItem}
                >
                  <div className="space-y-1">
                    <p className="body-sm text-white/50 font-medium mb-1">Watched</p>
                    <p className="title-md text-white  font-medium">
                    {stats.totalAnime || 0} Anime
                  </p>
                  </div>
                  <div className="space-y-1">
                    <p className="body-sm text-white/50 font-medium mb-1">Read</p>
                    <p className="title-md text-white font-medium">
                    {stats.totalManga || 0} Manga
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="body-sm text-white/50 font-medium mb-1">Time Spent</p>
                  <p className="title-lg text-white font-medium">
                  {totalDays > 0 ? (
                    <>
                      {totalDays} Days
                    </>
                  ) : (
                    <>
                      {totalTimeSpent} Hours
                    </>
                  )}
                </p>
                  </div>
                </motion.div>
                </div>
                
            </motion.div>
          </SlideLayout>
        );
      }

      default:
        return null;
    }
  }

  return (
    <motion.main 
      className="bg-black text-white w-full flex flex-col items-center justify-center p-2 selection:bg-white selection:text-black relative overflow-hidden min-h-screen" 
      style={{ 
        minHeight: '100dvh',
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
      <div ref={slideRef} className="w-full max-w-5xl bg-black rounded-2xl flex flex-col justify-center relative overflow-hidden slide-card mb-8" style={{ zIndex: 10, height: '95dvh', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div className="z-10 w-full h-full flex flex-col items-center justify-center">
          {error && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg z-50">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="text-center w-full max-w-2xl mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: smoothEase }}
              >
                <motion.h1 
                  className="body-lg font-medium text-white mb-4 tracking-tight"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >
                  {loadingProgress || 'Generating your report...'}
                </motion.h1>

                {/* Progress bar */}
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full"
                    style={{
                      background: 'linear-gradient(90deg, rgba(0, 255, 255, 0.8) 0%, rgba(0, 200, 255, 0.8) 100%)'
                    }}
                    initial={{ width: "0%" }}
                    animate={{ width: `${loadingProgressPercent}%` }}
                    transition={{
                      duration: 0.3,
                      ease: smoothEase
                    }}
                  />
                </div>
              </motion.div>
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
              
              

              {/* Bottom gradient fade - static, no animation */}
              <div 
                className="absolute bottom-0 left-0 right-0 pointer-events-none h-full"
                style={{
                  zIndex: 9,
                  background: bottomGradientBackground
                }}
              />
              
              <div className="mt-20 relative z-20 w-full flex flex-col items-center justify-center">
                <motion.div {...fadeIn100} data-framer-motion className="mt-16 w-full flex flex-col items-center">
                  <div className="relative inline-block text-center">
                    <h1 className="wrapped-brand text-white/60 mb-1 relative z-10 text-center">
                      MyAnimeList
                    </h1>
                    <h2 className="wrapped-title text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white relative z-10 text-center">
                      Wrapped
                    </h2>
                  </div>
                </motion.div>
                <motion.p className="mt-8 body-md text-white/80 text-center text-container max-w-2xl mx-auto" {...fadeIn300} data-framer-motion>Connect with your MyAnimeList account to see your year in review.</motion.p>
              <motion.div className="mt-4 flex flex-col sm:flex-row gap-4 justify-center w-full" {...fadeIn} data-framer-motion>
                  <motion.button
                  onClick={handleBegin}
                    className="bg-white text-black font-medium text-lg px-8 py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!CLIENT_ID || CLIENT_ID === '<your_client_id_here>'}
                    whileHover={{ scale: 1.05, backgroundColor: '#f5f5f5' }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2, ease: smoothEase }}
                >
              Connect with MAL
                  </motion.button>
                </motion.div>
                <motion.div className="mt-16 flex flex-col items-center w-full" {...fadeIn} data-framer-motion>
                  
                  <motion.img
                    src="/avatar.webp"
                    alt="XAvishkar"
                    className="relative w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 object-contain pointer-events-none z-10 mt-1 mx-auto"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: smoothEase }}
                  />
                </motion.div>
                <p className="text-sm text-white/60 text-center">
                    Made by{' '}
                    <motion.a
                      href="https://www.avishkarshinde.com/aboutme"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/60 hover:text-white transition-colors underline"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      XAvishkar
                    </motion.a>
                  </p>
              </div>
            </div>
          )}

          {isAuthenticated && stats && slides.length > 0 && (
            <div className="w-full h-full flex flex-col overflow-hidden relative">
              {/* Top Bar - Year Selector, Download, Share, Logout */}
              <div className="flex-shrink-0 px-3 sm:px-4 md:px-6 pt-3 pb-2 flex items-center justify-between gap-2 sm:gap-3" data-exclude-from-screenshot>
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
                      <option value="2023" style={{ background: 'rgba(0, 0, 0, 0.85)', color: '#ffffff' }}>2023</option>
                      <option value="2024" style={{ background: 'rgba(0, 0, 0, 0.85)', color: '#ffffff' }}>2024</option>
                      <option value="2025" style={{ background: 'rgba(0, 0, 0, 0.85)', color: '#ffffff' }}>2025</option>
                      <option value="all" style={{ background: 'rgba(0, 0, 0, 0.85)', color: '#ffffff' }}>All Time</option>
                  </select>
                    <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <motion.button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDownloadPNG(e);
                    }}
                    className="p-1.5 sm:p-2 text-white rounded-full flex items-center gap-1.5 sm:gap-2" 
                    title="Download Slide" 
                    style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                    whileHover={{ 
                      scale: 1.1, 
                      backgroundColor: 'rgba(16, 185, 129, 0.8)',
                      borderColor: 'rgba(16, 185, 129, 0.8)'
                    }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-xs sm:text-sm font-medium">Download</span>
                  </motion.button>
                </div>
                <motion.button 
                  onClick={handleLogout} 
                  className="p-1.5 sm:p-2 text-white rounded-full flex items-center gap-1.5 sm:gap-2" 
                  title="Logout"  
                  style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                  whileHover={{ 
                    scale: 1.1, 
                    backgroundColor: 'rgba(211, 68, 68, 0.8)',
                    borderColor: 'rgba(211, 68, 68, 0.8)'
                  }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-sm font-medium">Log Out</span>
                </motion.button>
              </div>
              
              {/* Progress Bar */}
              <div className="flex-shrink-0 mt-2 px-3 sm:px-4 md:px-6 pb-3 flex items-center gap-1 sm:gap-2 relative z-10" data-exclude-from-screenshot>
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
              <div key={currentSlide} className="w-full flex-grow flex items-center justify-center overflow-y-auto py-2 sm:py-4 relative" style={{ zIndex: 0 }}>
                {/* Top gradient fade - above rainbow shapes, below content */}
               
                
                <div className="w-full h-full relative overflow-y-auto" style={{ zIndex: 10 }}>
                  <SlideContent slide={slides[currentSlide]} mangaListData={mangaList} websiteUrl={websiteUrl} />
                </div>
              </div>
              
              {/* Bottom Controls */}
              <div className="flex-shrink-0 w-full px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 flex items-center justify-between gap-2 relative z-10" data-exclude-from-screenshot>
                <motion.button
                onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                disabled={currentSlide === 0}
                  className="p-1.5 sm:p-2 text-white rounded-full border-box-cyan disabled:opacity-30 transition-all"
                  whileHover={{ scale: currentSlide === 0 ? 1 : 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.2 }}
              >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </motion.button>
                
                <p className="text-white/60 text-xs sm:text-sm md:text-base font-mono py-1.5 sm:py-2 px-2 sm:px-4 rounded-full border-box-cyan ">
                    {`${String(currentSlide + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`}
                </p>

                <div className="flex items-center gap-2">
                  {currentSlide === slides.length - 1 && (
                    <div className="relative" ref={shareMenuRef}>
                      <motion.button
                        type="button"
                        onClick={handleShareButtonClick}
                        className="p-1.5 sm:p-2 text-white rounded-full border-box-cyan flex items-center gap-1.5 sm:gap-2"
                        whileHover={{ 
                          scale: 1.1, 
                          backgroundColor: 'rgba(64, 101, 204, 0.8)',
                          borderColor: 'rgba(64, 101, 204, 0.8)'
                        }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Share2 className="w-5 h-5 sm:w-6 sm:h-6" />
                        <span className="text-xs sm:text-sm font-medium">Share</span>
                      </motion.button>

                      {showShareMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                        className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-sm rounded-xl p-3 z-50 min-w-[200px]"
                        >
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={handleShareImageClick}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                            >
                              <span className="text-white font-medium">Share Image</span>
                            </button>
                            {[
                              { id: 'twitter', label: 'Twitter/X' },
                              { id: 'facebook', label: 'Facebook' },
                              { id: 'reddit', label: 'Reddit' },
                              { id: 'linkedin', label: 'LinkedIn' },
                              { id: 'whatsapp', label: 'WhatsApp' },
                              { id: 'telegram', label: 'Telegram' },
                            ].map(({ id, label }) => (
                              <button
                                key={id}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  shareToSocial(id);
                                }}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                              >
                                <span className="text-white font-medium">{label}</span>
                              </button>
                            ))}
                            <div className="border-t border-white/10 my-1"></div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                copyImageToClipboard();
                              }}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-left"
                            >
                              <span className="text-white font-medium">Copy Image</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}

                  <motion.button
                  onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
                  disabled={currentSlide === slides.length - 1}
                  className="p-1.5 sm:p-2 text-white rounded-full border-box-cyan disabled:opacity-30"
                  whileHover={{ scale: currentSlide === slides.length - 1 ? 1 : 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                  </motion.button>
                </div>
              </div>
            </div>
        )}
      </div>
    </div>
    
    {/* Footer */}
    <footer className="w-full bg-black border-t border-white/10 mt-auto py-8 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8 md:gap-12 md:items-start">
          {/* Left Column - Thanks For Stopping By */}
          <div className="space-y-4 md:flex-1">
            <h3 className="text-xl sm:text-2xl font-bold text-white">Thanks For Stopping By!</h3>
            <p className="text-white/80 text-sm sm:text-base">Want to see more? Send me an email, or have a snoop of more work below.</p>
            <div className="flex items-center gap-3">
              <span className="text-white text-sm sm:text-base">avishkarshinde1501@gmail.com</span>
              <motion.button
                onClick={copyEmail}
                className="px-3 py-1.5 border-box-cyan rounded-lg text-white text-sm flex items-center gap-2 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Copy size={16} />
                <span>{emailCopied ? 'Copied' : 'Copy Mail'}</span>
              </motion.button>
            </div>
            <div className="flex items-center gap-4 pt-2">
              <motion.a
                href="https://www.linkedin.com/in/xavishkar/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all group"
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
                whileHover={{ 
                  scale: 1.1, 
                  backgroundColor: 'rgba(0, 119, 181, 0.8)',
                  borderColor: 'rgba(0, 119, 181, 0.8)'
                }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.2 }}
                title="LinkedIn"
              >
                <Linkedin size={20} className="text-white" />
              </motion.a>
              <motion.a
                href="https://www.youtube.com/@x.avishkar"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all group"
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
                whileHover={{ 
                  scale: 1.1, 
                  backgroundColor: 'rgba(255, 0, 0, 0.8)',
                  borderColor: 'rgba(255, 0, 0, 0.8)'
                }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.2 }}
                title="YouTube"
              >
                <Youtube size={20} className="text-white" />
              </motion.a>
              <motion.a
                href="https://www.instagram.com/x.avishkar"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all group"
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
                whileHover={{ 
                  scale: 1.1, 
                  backgroundColor: 'rgba(228, 64, 95, 0.8)',
                  borderColor: 'rgba(228, 64, 95, 0.8)'
                }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.2 }}
                title="Instagram"
              >
                <Instagram size={20} className="text-white" />
              </motion.a>
              <motion.a
                href="https://github.com/Avishkar15"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all group"
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
                whileHover={{ 
                  scale: 1.1, 
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  borderColor: 'rgba(255, 255, 255, 0.8)'
                }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.2 }}
                title="GitHub"
              >
                <Github size={20} className="text-white" />
              </motion.a>
                    <motion.a
                      href="https://myanimelist.net/profile/XAvishkar"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all group"
                      style={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                      }}
                      whileHover={{ 
                        scale: 1.1, 
                        backgroundColor: 'rgba(46, 81, 162, 0.8)',
                        borderColor: 'rgba(46, 81, 162, 0.8)'
                      }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      title="MyAnimeList"
                    >
                      <MyAnimeListIcon size={20} className="text-white" />
                    </motion.a>
            </div>
          </div>

          {/* Middle and Right Columns Container */}
          <div className="flex flex-col sm:flex-row gap-6 md:gap-8 flex-shrink-0">
            {/* Middle Column - PAGES */}
            <div className="space-y-2 md:space-y-4">
              <h4 className="text-white/60 text-xs md:text-sm font-medium uppercase tracking-wider">PAGES</h4>
              <div className="space-y-1.5 md:space-y-2">
                <motion.a
                  href="https://www.avishkarshinde.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 md:gap-2 text-white hover:text-white/80 transition-colors group text-sm md:text-base"
                  whileHover={{ x: 4 }}
                            >
                  <span>Portfolio</span>
                  <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.a>
                <motion.a
                  href="https://www.avishkarshinde.com/aboutme"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 md:gap-2 text-white hover:text-white/80 transition-colors group text-sm md:text-base"
                  whileHover={{ x: 4 }}
                            >
                  <span>About Me</span>
                  <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.a>
                <motion.a
                  href="https://drive.google.com/file/d/1ta3SF0s3Iy7ryy6ON1FKWl1p9iu32iH2/view?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 md:gap-2 text-white hover:text-white/80 transition-colors group text-sm md:text-base"
                  whileHover={{ x: 4 }}
                            >
                  <span>Resume</span>
                  <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.a>
              </div>
            </div>

            {/* Right Column - WORK */}
            <div className="space-y-2 md:space-y-4">
            <h4 className="text-white/60 text-xs md:text-sm font-medium uppercase tracking-wider">UX WORK</h4>
            <div className="space-y-1.5 md:space-y-2">
              <motion.a
                href="https://www.avishkarshinde.com/spotify"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 md:gap-2 text-white hover:text-white/80 transition-colors group text-sm md:text-base"
                whileHover={{ x: 4 }}
              >
                <span>Spotify</span>
                <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.a>
              <motion.a
                href="https://www.avishkarshinde.com/toyota-mobility-foundation"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 md:gap-2 text-white hover:text-white/80 transition-colors group text-sm md:text-base"
                whileHover={{ x: 4 }}
              >
                <span>Toyota</span>
                <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.a>
              <motion.a
                href="https://www.avishkarshinde.com/solarhive"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 md:gap-2 text-white hover:text-white/80 transition-colors group text-sm md:text-base"
                whileHover={{ x: 4 }}
              >
                <span>SolarHive</span>
                <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.a>
              <motion.a
                href="https://www.avishkarshinde.com/motion-design"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 md:gap-2 text-white hover:text-white/80 transition-colors group text-sm md:text-base"
                whileHover={{ x: 4 }}
              >
                <span>Indiana University</span>
                <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.a>
            </div>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-white/60 text-sm text-center">© 2025 Designed by <span className="font-semibold">Avishkar Shinde</span></p>
        </div>
      </div>
    </footer>
    </motion.main>
  );
}