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

const CLIENT_ID = '<your_client_id_here>';
const AUTH_URL = 'https://myanimelist.net/v1/oauth2/authorize';
const TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';

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
    const storedVerifier = window.localStorage.getItem('pkce_verifier');

    if (code && storedVerifier) {
      exchangeCodeForToken(code, storedVerifier);
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
        throw new Error('Failed to exchange code for token');
      }

      const data = await response.json();
      window.localStorage.setItem('mal_access_token', data.access_token);
      window.localStorage.removeItem('pkce_verifier');

      // Clear the URL
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
    try {
      const response = await fetch('https://api.myanimelist.net/v2/users/@me?fields=id,name,picture,anime_statistics', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const data = await response.json();
      setUsername(data.name);
      setUserData(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch user data');
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
        {error && <div className="bg-red-600 p-3 rounded mb-6 animate-shake">{error}</div>}
        {isLoading && <div className="text-lg text-violet-200 animate-pulse mb-6">Loading...</div>}
        {!isAuthenticated && !userData && !isLoading && (
          <>
            <Sparkles size={40} className="mx-auto mb-4 text-violet-300 animate-bounce" />
            <h1 className="text-5xl font-extrabold text-white mb-5">MAL Wrapped 2025</h1>
            <p className="text-xl mb-6">Get your anime year in review. Ready?</p>
            <button onClick={handleBegin} className="bg-violet-700 hover:bg-pink-500 px-7 py-3 text-lg rounded-full font-bold shadow-lg transition-all">
              Connect with MAL
            </button>
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
