import fs from "fs";

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

if (!clientId || !clientSecret || !refreshToken) {
  console.error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET / SPOTIFY_REFRESH_TOKEN");
  process.exit(1);
}

const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const trunc = (s = "", n = 34) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function getAccessToken() {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Token refresh failed: ${r.status} ${t}`);
  }

  const j = await r.json();
  return j.access_token;
}

async function getPlaybackState(accessToken) {
  const r = await fetch("https://api.spotify.com/v1/me/player", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 204 = "No active device"
  if (r.status === 204) return { status: 204, data: null };

  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  return { status: r.status, data };
}

async function getRecentlyPlayed(accessToken) {
  const r = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Recently played failed: ${r.status} ${t}`);
  }

  return r.json();
}

async function fetchAsDataUri(url) {
  const r = await fetch(url);
  if (!r.ok) return "";

  const ct = r.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await r.arrayBuffer());

  // avoid huge files
  if (buf.length === 0 || buf.length > 1_500_000) return "";

  return `data:${ct};base64,${buf.toString("base64")}`;
}

function renderSvg({ title, artist, album, coverDataUri }) {
  const W = 720;
  const H = 170;
  const R = 22;

  const defs = coverDataUri
    ? `<defs>
        <pattern id="cover" patternUnits="userSpaceOnUse" width="110" height="110">
          <image href="${coverDataUri}" x="0" y="0" width="110" height="110" preserveAspectRatio="xMidYMid slice"/>
        </pattern>
      </defs>`
    : `<defs>
        <linearGradient id="coverGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2a2a2a"/>
          <stop offset="100%" stop-color="#121212"/>
        </linearGradient>
      </defs>`;

  const coverFill = coverDataUri ? 'fill="url(#cover)"' : 'fill="url(#coverGrad)"';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${defs}

  <rect x="0" y="0" width="${W}" height="${H}" rx="${R}" fill="#0f1115"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${R}" fill="none" stroke="#242831"/>

  <rect x="34" y="30" width="110" height="110" rx="14" ${coverFill}/>
  <rect x="34" y="30" width="110" height="110" rx="14" fill="none" stroke="#2b2f39"/>

  <text x="178" y="76" fill="#d7d7d7"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
    font-size="30" font-weight="650">
    ${esc(trunc(title))}
  </text>

  <text x="178" y="108" fill="#9aa0aa"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
    font-size="22">
    ${esc(trunc(artist || "Unknown artist"))}
  </text>

  <text x="178" y="138" fill="#9aa0aa"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
    font-size="22">
    ${esc(trunc(album || ""))}
  </text>
</svg>`;
}

(async () => {
  const accessToken = await getAccessToken();

  // 1) Try /me/player (best)
  const { status, data } = await getPlaybackState(accessToken);
  console.log("Spotify /v1/me/player status:", status);

  let title = "Not Playing";
  let artist = "";
  let album = "";
  let coverUrl = "";

  if (data?.item) {
    title = data.item.name || title;
    artist = (data.item.artists || []).map((a) => a.name).join(", ");
    album = data.item.album?.name || "";
    coverUrl = data.item.album?.images?.[0]?.url || "";
  } else {
    // 2) Fallback to recently played
    console.log("No active playback item. Falling back to recently played...");
    try {
      const recent = await getRecentlyPlayed(accessToken);
      const item = recent?.items?.[0]?.track;
      if (item) {
        title = item.name || title;
        artist = (item.artists || []).map((a) => a.name).join(", ");
        album = item.album?.name || "";
        coverUrl = item.album?.images?.[0]?.url || "";
      }
    } catch (e) {
      console.log("Recently played fallback failed (likely missing scope).");
      console.log(String(e));
    }
  }

  const coverDataUri = coverUrl ? await fetchAsDataUri(coverUrl) : "";
  const svg = renderSvg({ title, artist, album, coverDataUri });

  fs.mkdirSync("assets", { recursive: true });
  fs.writeFileSync("assets/now-playing.svg", svg, "utf8");

  console.log("Wrote assets/now-playing.svg");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
