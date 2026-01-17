# MAL Wrapped 🎌

Your year in anime, wrapped up nice and pretty. Think Spotify Wrapped, but for your MyAnimeList account.

## What is this?

Connect your MyAnimeList account and get a beautiful, animated slideshow of your anime and manga stats. See your top shows, hidden gems, favorite genres, watch time, and more—all wrapped up in a gorgeous interface.

## Getting Started

### 1. Install stuff

```bash
npm install
```

### 2. Get your MyAnimeList API key

- Head over to [MyAnimeList API settings](https://myanimelist.net/apiconfig)
- Create a new app
- Copy your Client ID

### 3. Add your Client ID

- Set `NEXT_PUBLIC_MAL_CLIENT_ID` in your environment variables (or `.env.local`)
- Set `MAL_CLIENT_SECRET` in your environment variables (for production)

### 4. Set up your redirect URI

In your MAL app settings, add your redirect URI:

- **Local:** `http://localhost:3000`
- **Production:** Your actual domain (e.g., `https://yourdomain.com`)

If you add locale-specific routes (e.g., `/fr`, `/es`), MyAnimeList requires **each redirect URI to be registered explicitly**. Add one line per locale, both for local and production, for example:

- `http://localhost:3000/fr`
- `https://yourdomain.com/fr`

The redirect URI must match exactly—check what's shown on the login page if you're not sure.

### 5. Run it

```bash
npm run dev
```

Open `http://localhost:3000`, click "Connect with MAL", and enjoy your wrapped!

## What You'll See

- Your total anime and manga counts
- Watch time and reading stats
- Top genres and studios
- Your highest rated shows
- Hidden gems you discovered
- Seasonal highlights
- Badges you've earned
- Your anime character twin

## Tech Stuff

Built with Next.js, React, Tailwind CSS, and the MyAnimeList API. Uses OAuth 2.0 for secure login—your data stays private and is processed in your browser.

## Having Issues?

**Login not working?**

- Make sure your Client ID is set correctly
- Check that your redirect URI matches exactly (including `http://` or `https://`)
- Try clearing your browser's localStorage and cookies
- Check the browser console for error messages

**Still stuck?**

- The redirect URI is shown on the login page—copy that exact URL into your MAL app settings
- Make sure you're using the right environment (local vs production)

## Privacy

Your data is processed in your browser and never stored on any server. All API calls go directly from your browser to MyAnimeList.

---

Made with ❤️ by [XAvishkar](https://myanimelist.net/profile/XAvishkar)
