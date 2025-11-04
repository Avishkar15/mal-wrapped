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

const CLIENT_ID = '<YOUR_CLIENT_ID_HERE>';
const REDIRECT_URI = window.location.origin + window.location.pathname;
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
    { id: 'finale' }
  ] : [];

  // Handle OAuth PKCE
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const localVerifier = window.localStorage.getItem('mal_pkce_verifier');
    if (code && localVerifier) {
      setIsLoading(true);
      // Exchange code for token
      fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          code,
          code_verifier: localVerifier,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.access_token) {
            setIsAuthenticated(true);
            window.localStorage.setItem('mal_access_token', data.access_token);
            fetchMALUserData(data.access_token);
          } else {
            setError('Authentication failed.');
          }
          setIsLoading(false);
        });
    }
  }, []);

  function fetchMALUserData(token) {
    setIsLoading(true);
    fetch('https://api.myanimelist.net/v2/users/@me?fields=id,name,anime_statistics,&anime_list_status,anime_statistics,anime_list', {
      headers: {
        Authorization: 'Bearer ' + token,
      },
    })
      .then(res => res.json())
      .then(userJson => {
        setUserData(userJson);
        setUsername(userJson.name);
        setIsLoading(false);
      })
      .catch(e => {
        setError('Failed to load user data.');
        setIsLoading(false);
      });
  }

  async function handleBegin() {
    const verifier = generateCodeVerifier(64);
    const challenge = await pkceChallenge(verifier);
    window.localStorage.setItem('mal_pkce_verifier', verifier);
    setPkceVerifier(verifier);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'mal_auth',
    });
    window.location.href = `${AUTH_URL}?${params}`;
  }

  function SlideContent({ slide }) {
    if (!slide) return null;
    switch (slide.id) {
      case 'welcome':
        return <div className="mb-6 animate-fade-in">
          <Sparkles size={48} className="mx-auto mb-4 text-violet-300 animate-bounce" />
          <h1 className="text-5xl font-extrabold text-white mb-2">Welcome, {username || 'MAL User'}!</h1>
          <p className="text-xl mb-6">Ready for your Anime Wrapped?</p>
        </div>;
      case 'total_anime':
        return <div className="mb-6 animate-slide-in">
          <h2 className="text-4xl font-bold">You've Watched</h2>
          <p className="text-5xl font-extrabold text-teal-400">{userData?.anime_statistics?.num_items_watching + userData?.anime_statistics?.num_items_completed + userData?.anime_statistics?.num_items_on_hold + userData?.anime_statistics?.num_items_dropped + userData?.anime_statistics?.num_items_plan_to_watch} <span className='text-white'>anime</span></p>
        </div>;
      // ...repeat for other slides (genres, studio, etc)
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
