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

3. **Configure the Client ID and Redirect URI:**
   - Open `components/MALWrapped.jsx`
   - Replace `<your_client_id_here>` with your actual Client ID on line 38
   - **IMPORTANT:** In your MAL app settings (https://myanimelist.net/apiconfig), set the redirect URI to match your app URL:
     - For local development: `http://localhost:3000` (or `http://localhost:3000/` - both should work)
     - For production: Your actual domain (e.g., `https://yourdomain.com`)
   - The redirect URI must match **exactly** (including http/https, port, and trailing slash if present)
   - You can see the redirect URI your app is using on the main page - it's displayed below the connect button

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

## Troubleshooting

### "Authorization failed" or "Login not working"

1. **Check your Client ID:**
   - Make sure you've replaced `<your_client_id_here>` with your actual Client ID
   - Verify the Client ID is correct in your MAL app settings

2. **Check your Redirect URI:**
   - The redirect URI in your MAL app settings must match **exactly** what's shown on the app page
   - Common issues:
     - Missing `http://` or `https://`
     - Wrong port number (e.g., `:3000`)
     - Trailing slash mismatch (`/` vs no `/`)
     - Using `localhost` in production (use your actual domain)

3. **Clear browser data:**
   - Clear localStorage for the site
   - Clear cookies
   - Try in an incognito/private window

4. **Check browser console:**
   - Open browser developer tools (F12)
   - Check the Console tab for error messages
   - Check the Network tab to see if API calls are failing

5. **Common error messages:**
   - `redirect_uri_mismatch`: The redirect URI doesn't match what's in your MAL app settings
   - `invalid_client`: Your Client ID is incorrect
   - `access_denied`: You denied authorization (try again and click "Allow")

### "Failed to exchange code for token"

- This usually means the redirect URI doesn't match
- Check the error message for the exact redirect URI your app is using
- Make sure this exact URI is set in your MAL app settings

## Notes

- Your data is processed locally and never stored on any server
- The app uses OAuth 2.0 with PKCE for secure authentication
- All API calls are made directly from your browser to MyAnimeList
- The redirect URI is automatically detected and displayed on the app page

## License

MIT
