# MAL Wrapped 🎌

MyAnimeList Wrapped - Your year in anime. A Spotify Wrapped-style experience for your MAL data.

## Features

- ✨ Beautiful, animated slides showcasing your anime statistics
- 📊 Real-time data from your MyAnimeList account
- 🎨 Stunning gradient UI with smooth animations
- 📈 Comprehensive stats including:
  - Total anime watched
  - Favorite genres and studios
  - Top-rated anime
  - Hidden gems discovery
  - Seasonal highlights
  - Watch time statistics
  - Manga statistics
- 🔐 Secure OAuth authentication
- 📱 Responsive design

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Get your MyAnimeList API Client ID:**
   - Go to [MyAnimeList API](https://myanimelist.net/apiconfig)
   - Create a new application
   - Copy your Client ID

3. **Configure the Client ID:**
   - Open `components/MALWrapped.jsx`
   - Replace `<your_client_id_here>` with your actual Client ID on line 41

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   - Navigate to `http://localhost:3000`
   - Click "Connect with MyAnimeList"
   - Authorize the application
   - Enjoy your personalized anime wrapped!

## Tech Stack

- Next.js 14
- React 18
- Tailwind CSS
- MyAnimeList API v2
- Lucide React Icons

## Notes

- Your data is processed locally and never stored on any server
- The app uses OAuth 2.0 with PKCE for secure authentication
- All API calls are made directly from your browser to MyAnimeList

## License

MIT
