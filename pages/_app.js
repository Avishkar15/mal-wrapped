import { appWithTranslation } from 'next-i18next'
import Head from 'next/head';
import '../styles/globals.css'

function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>MyAnimeList Wrapped</title>
        <meta name="description" content="MyAnimeList Wrapped is a personalized year-in-review for your anime and manga habits, inspired by Spotify Wrapped. It turns your raw list data into fun, shareable stories about how you watched and read throughout the year." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="MyAnimeList Wrapped" />
        <meta property="og:description" content="MyAnimeList Wrapped is a personalized year-in-review for your anime and manga habits, inspired by Spotify Wrapped. It turns your raw list data into fun, shareable stories about how you watched and read throughout the year." />
        <meta property="og:image" content="/Preview.webp" />
        <meta property="og:image:width" content="1080" />
        <meta property="og:image:height" content="1080" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MyAnimeList Wrapped" />
        <meta name="twitter:description" content="MyAnimeList Wrapped is a personalized year-in-review for your anime and manga habits, inspired by Spotify Wrapped. It turns your raw list data into fun, shareable stories about how you watched and read throughout the year." />
        <meta name="twitter:image" content="/Avatar.webp" />
        
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" href="/favicon.ico" />
        {/* Preload fonts for better performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default appWithTranslation(App)