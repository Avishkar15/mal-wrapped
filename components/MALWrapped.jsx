import React, { useState, useEffect } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';

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
  // returns promise ArrayBuffer
  // Guard for SSR - only execute in browser
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('sha256 requires browser environment'));
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a) {
  // Convert ArrayBuffer to base64url
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
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pkceVerifier, setPkceVerifier] = useState(null);

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
    // Only run in browser
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const errorParam = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    const storedVerifier = window.localStorage.getItem('pkce_verifier');
    const storedToken = window.localStorage.getItem('mal_access_token');

    // Check for OAuth errors in URL
    if (errorParam) {
      setError(`Authorization failed: ${errorDescription || errorParam}. Please try again.`);
      window.history.replaceState({}, document.title, window.location.pathname);
      window.localStorage.removeItem('pkce_verifier');
      return;
    }

    if (code && storedVerifier) {
      exchangeCodeForToken(code, storedVerifier);
    } else if (code && !storedVerifier) {
      // Code returned but no verifier - likely page was refreshed
      setError('Authorization session expired. Please try connecting again.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (storedToken) {
      // Try to use stored token
      fetchUserData(storedToken);
    }
  }, []);

  // Helper to normalize redirect URI
  function getRedirectUri() {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    // Remove trailing slash from pathname if present (except for root)
    const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
    return origin + normalizedPath;
  }

  async function exchangeCodeForToken(code, verifier) {
    if (typeof window === 'undefined') return;

    setIsLoading(true);
    setError('');
    const redirectUri = getRedirectUri();
    
    // Validate CLIENT_ID
    if (CLIENT_ID === '<your_client_id_here>' || !CLIENT_ID || CLIENT_ID.trim() === '') {
      setError('CLIENT_ID is not configured. Please set NEXT_PUBLIC_MAL_CLIENT_ID environment variable or update the CLIENT_ID constant.');
      setIsLoading(false);
      return;
    }
    
    try {
      console.log('Exchanging code for token...');
      console.log('Redirect URI:', redirectUri);
      console.log('Client ID:', CLIENT_ID ? 'Set' : 'Missing');
      
      // Use our API route instead of calling MAL API directly (avoids CORS)
      const response = await fetch('/api/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
        }),
      });

      console.log('Token exchange response status:', response.status);

      // Try to parse error response even if not ok
      if (!response.ok) {
        let errorData = null;
        
        try {
          errorData = await response.json();
          console.error('Error response:', errorData);
        } catch (e) {
          const errorText = await response.text();
          console.error('Error response text:', errorText);
          errorData = { error: 'Unknown error', message: errorText };
        }
        
        let errorMessage = 'Failed to exchange authorization code for token.';
        
        if (errorData) {
          if (errorData.error) {
            errorMessage = `Authentication error: ${errorData.error}`;
            if (errorData.error_description) {
              errorMessage += ` - ${errorData.error_description}`;
            } else if (errorData.message) {
              errorMessage += ` - ${errorData.message}`;
            }
          }
        }
        
        // Common errors
        if (response.status === 400) {
          if (errorData?.error === 'invalid_grant') {
            errorMessage += '\n\nThe authorization code may have expired. Please try connecting again.';
          } else if (errorData?.error === 'redirect_uri_mismatch') {
            errorMessage += `\n\nRedirect URI mismatch! Make sure your MAL app redirect URI is set to:\n${redirectUri}`;
          } else {
            errorMessage += `\n\nStatus: ${response.status}. Please check your CLIENT_ID and redirect URI settings.`;
            errorMessage += `\n\nExpected redirect URI: ${redirectUri}`;
          }
        } else if (response.status === 401) {
          errorMessage += '\n\nInvalid CLIENT_ID. Please check your configuration.';
        } else if (response.status === 500) {
          if (errorData?.message?.includes('CLIENT_ID')) {
            errorMessage = 'Server configuration error: CLIENT_ID is not set. Please configure NEXT_PUBLIC_MAL_CLIENT_ID in Vercel.';
          } else {
            errorMessage += '\n\nServer error. Please try again later.';
          }
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token received from MAL API. Response: ' + JSON.stringify(data));
      }
      
      console.log('Token exchange successful');
      window.localStorage.setItem('mal_access_token', data.access_token);
      window.localStorage.removeItem('pkce_verifier');

      // Clear the URL
      window.history.replaceState({}, document.title, window.location.pathname);

      await fetchUserData(data.access_token);
      setIsAuthenticated(true);
    } catch (err) {
      let errorMessage = 'Authentication failed';
      
      // Check for network errors
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        errorMessage = 'Network error: Could not connect to server.\n\n';
        errorMessage += 'Possible causes:\n';
        errorMessage += '1. Check your internet connection\n';
        errorMessage += '2. Server might be temporarily unavailable\n';
        errorMessage += '3. Please try again in a moment\n\n';
        errorMessage += 'Please check the browser console (F12) for more details.';
      } else if (err.name === 'NetworkError' || (err.message && err.message.includes('fetch'))) {
        errorMessage = 'Network error: Unable to reach server.\n\n';
        errorMessage += 'Please check your connection and try again.';
      } else {
        // Use the detailed error message we constructed
        errorMessage = err.message || 'Authentication failed';
      }
      
      setError(errorMessage);
      console.error('Token exchange error:', err);
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        redirectUri,
        clientIdSet: !!CLIENT_ID && CLIENT_ID !== '<your_client_id_here>'
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUserData(accessToken) {
    if (typeof window === 'undefined') return;

    setIsLoading(true);
    setError('');
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
        
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          // Ignore
        }
        
        throw new Error(`Failed to fetch user data (${response.status}): ${errorText || 'Unknown error'}`);
      }

      const data = await response.json();
      setUsername(data.name);
      setUserData(data);
      setIsAuthenticated(true);
    } catch (err) {
      let errorMessage = 'Failed to fetch user data';
      
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        errorMessage = 'Network error: Could not connect to MAL API. Please check your connection.';
      } else if (err.name === 'NetworkError') {
        errorMessage = 'Network error: Unable to reach MAL API servers.';
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
    // Only execute in browser
    if (typeof window === 'undefined') {
      setError('This feature requires a browser environment');
      return;
    }

    // Validate CLIENT_ID
    if (CLIENT_ID === '<your_client_id_here>' || !CLIENT_ID || CLIENT_ID.trim() === '') {
      setError('CLIENT_ID is not configured. Please set NEXT_PUBLIC_MAL_CLIENT_ID environment variable in Vercel or update the CLIENT_ID constant.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const verifier = generateCodeVerifier();
      setPkceVerifier(verifier);
      window.localStorage.setItem('pkce_verifier', verifier);

      const challenge = await pkceChallenge(verifier);
      const redirectUri = getRedirectUri();

      console.log('Initiating OAuth flow...');
      console.log('Redirect URI:', redirectUri);
      console.log('Make sure this exact URL is set in your MAL app settings');

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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-violet-900 to-pink-900 flex items-center justify-center">
      <div className="bg-black/50 rounded-3xl shadow-2xl p-10 text-white w-[90vw] max-w-2xl text-center border border-violet-700">
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
              disabled={CLIENT_ID === '<your_client_id_here>' || !CLIENT_ID}
            >
              Connect with MAL
            </button>
            {typeof window !== 'undefined' && (
              <div className="text-xs text-gray-400 mt-4 p-3 bg-gray-800/50 rounded-lg">
                <p className="font-semibold mb-1">Redirect URI (set this in MAL app settings):</p>
                <p className="font-mono break-all text-violet-300">{getRedirectUri()}</p>
              </div>
            )}
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
