export default async function handler(req, res) {
  try {
    const user = req.query.user || process.env.LASTFM_USER;
    const apiKey = process.env.LASTFM_API_KEY;

    if (!user || !apiKey) {
      res.status(400).send("Missing LASTFM_USER or LASTFM_API_KEY");
      return;
    }

    const url =
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks` +
      `&user=${encodeURIComponent(user)}` +
      `&api_key=${encodeURIComponent(apiKey)}` +
      `&format=json&limit=1`;

    const r = await fetch(url);
    const data = await r.json();
    const track = data?.recenttracks?.track?.[0];

    const esc = (s = "") =>
      String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const trunc = (s = "", n = 32) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

    let title = "Not playing anything";
    let artist = "";
    let album = "";
    let cover = "";

    if (track) {
      title = track.name || title;
      artist = track.artist?.["#text"] || "";
      album = track.album?.["#text"] || "";
      cover = track.image?.[track.image.length - 1]?.["#text"] || "";
    }

    const W = 720, H = 170, R = 22;

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

  <text x="178" y="76" fill="#d7d7d7"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
    font-size="30" font-weight="650">${esc(trunc(title, 30))}</text>

  <text x="178" y="108" fill="#9aa0aa"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
    font-size="22" font-weight="500">${esc(trunc(artist || "Unknown artist", 30))}</text>

  <text x="178" y="138" fill="#9aa0aa"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
    font-size="22" font-weight="500">${esc(trunc(album || "", 30))}</text>
</svg>`;

    res.setHeader("Content-Type", "image/svg+xml");
    // Cache a bit to reduce rate limits; GitHub will re-fetch periodically anyway
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).send(svg);
  } catch (e) {
    res.status(500).send("Error generating SVG");
  }
}
