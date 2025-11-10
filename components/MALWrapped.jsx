import React, { useState, useEffect } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';

// Helper for PKCE plain code challenge (same as verifier)
function generateCodeVerifier(length = 128) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const CLIENT_ID = process.env.NEXT_PUBLIC_MAL_CLIENT_ID;
const AUTH_URL = 'https://myanimelist.net/v1/oauth2/authorize';

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
      setError(`Authorization failed: ${errorDescription || errorParam}. Please try again.`);
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
    if (typeof window === 'undefined') return;

    setIsLoading(true);
    setError('');
    
    try {
      console.log('Exchanging code for token via API route...');
      
      // Call our API route (avoids CORS)
      const response = await fetch('/api/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          code_verifier: verifier,
        }),
      });

      console.log('Token exchange response status:', response.status);

      if (!response.ok) {
        const responseText = await response.text();
        console.error('Error response:', responseText);
        
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { error: 'Unknown error', message: responseText };
        }
        
        let errorMessage = 'Failed to exchange authorization code for token.';
        
        if (response.status === 400) {
          if (errorData?.error === 'invalid_grant') {
            errorMessage = 'Authorization code expired or already used. Please try connecting again.';
          } else if (errorData?.error === 'invalid_client') {
            errorMessage = 'Invalid CLIENT_ID or CLIENT_SECRET. Please check your MAL app credentials.';
          } else {
            errorMessage = `Authentication error: ${errorData?.error || 'Unknown'}\n${errorData?.error_description || ''}`;
          }
        } else if (response.status === 401) {
          errorMessage = 'Invalid CLIENT_ID or CLIENT_SECRET.\n\nPlease verify your credentials at https://myanimelist.net/apiconfig';
        } else if (response.status === 500) {
          errorMessage = `Server error: ${errorData?.message || 'Unknown error'}\n\nPlease check server logs.`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data.access_token) {
        console.error('No access_token in response:', data);
        throw new Error('No access token received from MAL API.');
      }
      
      console.log('Token exchange successful');
      console.log('Token type:', data.token_type);
      console.log('Expires in:', data.expires_in, 'seconds');
      
      // Store tokens
      localStorage.setItem('mal_access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('mal_refresh_token', data.refresh_token);
      }
      localStorage.removeItem('pkce_verifier');

      // Clear URL
      window.history.replaceState({}, document.title, window.location.pathname);

      // Fetch user data
      await fetchUserData(data.access_token);
      setIsAuthenticated(true);
    } catch (err) {
      let errorMessage = 'Authentication failed';
      
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        errorMessage = 'Network error: Could not connect to server.\n\nPlease check your internet connection and try again.';
      } else {
        errorMessage = err.message || 'Authentication failed';
      }
      
      setError(errorMessage);
      console.error('Token exchange error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUserData(accessToken) {
    if (typeof window === 'undefined') return;

    if (!accessToken || accessToken.trim() === '') {
      setError('Invalid access token. Please try connecting again.');
      localStorage.removeItem('mal_access_token');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      console.log('Fetching user data...');
      
      const response = await fetch('https://api.myanimelist.net/v2/users/@me?fields=id,name,picture,anime_statistics,manga_statistics', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      console.log('User data response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        
        if (response.status === 401) {
          console.error('401 Unauthorized - Token is invalid or expired');
          localStorage.removeItem('mal_access_token');
          localStorage.removeItem('mal_refresh_token');
          
          throw new Error('Authentication failed: Invalid or expired token.\n\nPlease try connecting again.');
        }
        
        throw new Error(`Failed to fetch user data (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      console.log('User data fetched successfully:', { id: data.id, name: data.name });
      
      setUsername(data.name);
      setUserData(data);
      setIsAuthenticated(true);
      
    } catch (err) {
      let errorMessage = 'Failed to fetch user data';
      
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        errorMessage = 'Network error: Could not connect to MAL API.\n\nPlease check your internet connection and try again.';
      } else {
        errorMessage = err.message || 'Failed to fetch user data';
      }
      
      setError(errorMessage);
      console.error('Fetch user data error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBegin() {
    if (typeof window === 'undefined') {
      setError('This feature requires a browser environment');
      return;
    }

    if (!CLIENT_ID || CLIENT_ID.trim() === '') {
      setError('CLIENT_ID is not configured. Please set NEXT_PUBLIC_MAL_CLIENT_ID environment variable.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Generate verifier - in PKCE plain, challenge = verifier
      const verifier = generateCodeVerifier();
      localStorage.setItem('pkce_verifier', verifier);

      console.log('Initiating OAuth flow with PKCE plain method...');
      console.log('code_challenge = code_verifier (plain method)');

      // Build authorization URL - NO redirect_uri needed according to MAL docs
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        code_challenge: verifier,  // Same as verifier in plain method
      });

      window.location.href = `${AUTH_URL}?${params.toString()}`;
    } catch (err) {
      setError(err.message || 'Failed to initiate OAuth');
      setIsLoading(false);
      console.error('OAuth initiation error:', err);
    }
  }

  function SlideContent({ slide }) {
    if (!slide || !userData) return null;
    const stats = userData.anime_statistics || {};

    switch (slide.id) {
      case 'welcome':
        return <div className="animate-fade-in">
          <h2 className="text-4xl font-bold mb-4">Hi, {username}!</h2>
          <p className="text-xl">Let's see what you've been watching...</p>
        </div>;
      case 'total_anime':
        return <div className="animate-fade-in">
          <h2 className="text-5xl font-extrabold text-pink-400 mb-2">{stats.num_items || 0}</h2>
          <p className="text-xl">anime titles on your list!</p>
        </div>;
      case 'genres':
        return <div className="animate-fade-in">
          <h2 className="text-4xl font-bold mb-4">Your Favorite Genre</h2>
          <p className="text-2xl text-pink-300">Action</p>
          <p className="text-lg mt-2">You love the thrills!</p>
        </div>;
      case 'studio':
        return <div className="animate-fade-in">
          <h2 className="text-4xl font-bold mb-4">Top Studio</h2>
          <p className="text-2xl text-violet-300">Ufotable</p>
          <p className="text-lg mt-2">Their animation never disappoints.</p>
        </div>;
      case 'watch_time':
        return <div className="animate-fade-in">
          <h2 className="text-4xl font-bold mb-4">Total Watch Time</h2>
          <p className="text-5xl font-extrabold text-pink-400">{stats.num_days_watched || 0}</p>
          <p className="text-xl mt-2">days spent in anime worlds!</p>
        </div>;
      case 'seasonal':
        return <div className="animate-fade-in">
          <h2 className="text-4xl font-bold mb-4">Seasonal Highlight</h2>
          <p className="text-2xl text-pink-300">Winter 2025</p>
          <p className="text-lg mt-2">You watched 12 new shows this season!</p>
        </div>;
      case 'top_rated':
        return <div className="animate-fade-in">
          <h2 className="text-4xl font-bold mb-4">Your Top Rated</h2>
          <p className="text-2xl text-violet-300">Steins;Gate</p>
          <p className="text-lg mt-2">A masterpiece in your eyes!</p>
        </div>;
      case 'hidden_gems':
        return <div className="animate-fade-in">
          <h2 className="text-4xl font-bold mb-4">Hidden Gem You Found</h2>
          <p className="text-2xl text-pink-300">Odd Taxi</p>
          <p className="text-lg mt-2">Underrated but unforgettable.</p>
        </div>;
      case 'community':
        return <div className="animate-fade-in">
          <h2 className="text-4xl font-bold mb-4">Community Stats</h2>
          <p className="text-xl">You've completed {stats.num_items_completed || 0} anime!</p>
          <p className="text-lg mt-2">Keep going, otaku!</p>
        </div>;
      case 'manga':
        return <div className="animate-fade-in">
          <h2 className="text-4xl font-bold mb-4">Manga Corner</h2>
          <p className="text-xl">You've also been reading manga. Nice!</p>
        </div>;
      case 'finale':
        return <div className="animate-bounce-in">
          <h2 className="text-4xl font-bold">Thank you for using MAL Wrapped!</h2>
          <p className="text-xl">Share your results and let's make 2025 even more anime-packed!</p>
        </div>;
      default:
        return <div className="mb-6"><p>More stats coming soon...</p></div>;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-violet-900 to-pink-900 flex items-center justify-center p-4">
      <div className="bg-black/50 rounded-3xl shadow-2xl p-10 text-white w-full max-w-2xl text-center border border-violet-700">
        {error && (
          <div className="bg-red-600/90 p-4 rounded-xl mb-6 border border-red-400">
            <p className="font-semibold whitespace-pre-line text-sm">{error}</p>
          </div>
        )}
        {isLoading && <div className="text-lg text-violet-200 animate-pulse mb-6">Loading...</div>}
        {!isAuthenticated && !userData && !isLoading && (
          <>
            <Sparkles size={40} className="mx-auto mb-4 text-violet-300 animate-bounce" />
            <h1 className="text-5xl font-extrabold text-white mb-5">MAL Wrapped 2025</h1>
            <p className="text-xl mb-6">Get your anime year in review. Ready?</p>
            <button 
              onClick={handleBegin} 
              className="bg-violet-700 hover:bg-pink-500 px-7 py-3 text-lg rounded-full font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!CLIENT_ID}
            >
              Connect with MAL
            </button>
            <div className="text-xs text-gray-400 mt-6 p-3 bg-gray-800/50 rounded-lg">
              <p className="text-violet-300">✓ Using secure API route (CLIENT_SECRET is protected)</p>
              <p className="mt-1">✓ PKCE plain method as per MAL documentation</p>
            </div>
          </>
        )}
        {isAuthenticated && userData && (
          <>
            <SlideContent slide={slides[currentSlide]} />
            <div className="flex gap-4 justify-center mt-8">
              <button
                className="p-2 rounded-full bg-violet-600/70 hover:bg-violet-700 text-white disabled:opacity-50"
                onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                disabled={currentSlide === 0}
              >
                Prev
              </button>
              <button
                className="p-2 px-6 rounded-full bg-pink-600/80 hover:bg-pink-700 text-white disabled:opacity-50 flex items-center gap-2"
                onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
                disabled={currentSlide === slides.length - 1}
              >
                Next <ChevronRight size={18} />
              </button>
            </div>
            <div className="flex gap-2 mt-5 justify-center">
              {slides.map((slide, idx) => (
                <span
                  key={slide.id}
                  className={
                    "w-3 h-3 rounded-full " +
                    (idx === currentSlide ? 'bg-pink-400' : 'bg-gray-600')
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}