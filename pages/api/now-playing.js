export default async function handler(req, res) {
  try {
    const user = req.query.user || process.env.LASTFM_USER;
    const apiKey = process.env.LASTFM_API_KEY;

    if (!user || !apiKey) {
      res.status(400).send("Missing LASTFM_USER or LASTFM_API_KEY");
      return;
    }

    const esc = (s = "") =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    const trunc = (s = "", n = 30) =>
      s.length > n ? s.slice(0, n - 1) + "…" : s;

    // ---------- 1) Get current/recent track from Last.fm ----------
    const lastUrl =
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks` +
      `&user=${encodeURIComponent(user)}` +
      `&api_key=${encodeURIComponent(apiKey)}` +
      `&format=json&limit=1`;

    const r = await fetch(lastUrl);
    const data = await r.json();
    const track = data?.recenttracks?.track?.[0];

    let title = "Not playing anything";
    let artist = "";
    let album = "";
    let cover = "";

    if (track) {
      title = track.name || title;
      artist = track.artist?.["#text"] || "";
      album = track.album?.["#text"] || "";
    }

    // ---------- 2) Apple cover lookup via iTunes Search API ----------
    // No API key required. This usually returns correct, high-res art.
    // We'll try a few results and pick the best match.
    const norm = (s = "") =>
      String(s)
        .toLowerCase()
        .replace(/\(.*?\)/g, "") // remove (feat...), (remastered), etc.
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const scoreResult = (it, wantTitle, wantArtist) => {
      const t = norm(it.trackName || "");
      const a = norm(it.artistName || "");
      let score = 0;

      if (t === wantTitle) score += 4;
      if (a === wantArtist) score += 4;

      if (t.includes(wantTitle) || wantTitle.includes(t)) score += 2;
      if (a.includes(wantArtist) || wantArtist.includes(a)) score += 2;

      // small boost if album name exists
      if (it.collectionName) score += 0.5;
      return score;
    };

    if (title && artist) {
      const wantTitle = norm(title);
      const wantArtist = norm(artist);

      const q = encodeURIComponent(`${title} ${artist}`);
      const itunesUrl = `https://itunes.apple.com/search?term=${q}&entity=song&limit=5`;

      const it = await fetch(itunesUrl);
      const itData = await it.json();
      const results = Array.isArray(itData?.results) ? itData.results : [];

      if (results.length) {
        let best = results[0];
        let bestScore = scoreResult(best, wantTitle, wantArtist);

        for (const candidate of results.slice(1)) {
          const s = scoreResult(candidate, wantTitle, wantArtist);
          if (s > bestScore) {
            best = candidate;
            bestScore = s;
          }
        }

        // artworkUrl100 is common; we up-res it
        if (best?.artworkUrl100) {
          cover = best.artworkUrl100
            .replace("100x100bb", "600x600bb")
            .replace("100x100", "600x600");
        }

        // fill album from Apple if Last.fm didn't provide (or it's blank)
        if ((!album || album.trim() === "") && best?.collectionName) {
          album = best.collectionName;
        }
      }
    }

    // ---------- 3) Render Spotify-style SVG card ----------
    const W = 720,
      H = 170,
      R = 22;

    const coverDefs = cover
      ? `<defs>
          <pattern id="cover" patternUnits="userSpaceOnUse" width="110" height="110">
            <image href="${esc(cover)}" x="0" y="0" width="110" height="110" preserveAspectRatio="xMidYMid slice"/>
          </pattern>
        </defs>`
      : `<defs>
          <linearGradient id="coverGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2a2a2a"/>
            <stop offset="100%" stop-color="#121212"/>
          </linearGradient>
        </defs>`;

    const coverFill = cover ? 'fill="url(#cover)"' : 'fill="url(#coverGrad)"';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${coverDefs}

  <rect x="0" y="0" width="${W}" height="${H}" rx="${R}" fill="#0f1115"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${R}" fill="none" stroke="#242831"/>

  <rect x="34" y="30" width="110" height="110" rx="14" ${coverFill}/>
  <rect x="34" y="30" width="110" height="110" rx="14" fill="none" stroke="#2b2f39"/>

  <text x="178" y="76"
    fill="#d7d7d7"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
    font-size="30"
    font-weight="650">
    ${esc(trunc(title))}
  </text>

  <text x="178" y="108"
    fill="#9aa0aa"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
    font-size="22">
    ${esc(trunc(artist || "Unknown artist"))}
  </text>

  <text x="178" y="138"
    fill="#9aa0aa"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
    font-size="22">
    ${esc(trunc(album))}
  </text>
</svg>`;

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.status(200).send(svg);
  } catch (err) {
    res.status(500).send("Error generating now playing card");
  }
}
