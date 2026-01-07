import fs from "fs";

const apiKey = process.env.LASTFM_API_KEY;
const user = process.env.LASTFM_USER;

if (!apiKey || !user) {
  console.error("Missing LASTFM_API_KEY or LASTFM_USER");
  process.exit(1);
}

const url =
  `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks` +
  `&user=${encodeURIComponent(user)}` +
  `&api_key=${encodeURIComponent(apiKey)}` +
  `&format=json&limit=1`;

const res = await fetch(url);
const data = await res.json();
const track = data?.recenttracks?.track?.[0];

const escapeXml = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const truncate = (s = "", max = 28) => {
  const str = String(s);
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
};

let title = "Not playing anything";
let artist = "";
let album = "";
let cover = "";

if (track) {
  title = track.name ?? title;
  artist = track.artist?.["#text"] ?? "";
  album = track.album?.["#text"] ?? "";
  cover = track.image?.[track.image.length - 1]?.["#text"] ?? "";
}

const W = 720;
const H = 170;
const R = 22;

const coverDefs = cover
  ? `
  <defs>
    <pattern id="cover" patternUnits="userSpaceOnUse" width="110" height="110">
      <image href="${escapeXml(cover)}" x="0" y="0" width="110" height="110" preserveAspectRatio="xMidYMid slice"/>
    </pattern>
  </defs>`
  : `
  <defs>
    <linearGradient id="coverGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a2a2a"/>
      <stop offset="100%" stop-color="#121212"/>
    </linearGradient>
  </defs>`;

const coverFill = cover ? 'fill="url(#cover)"' : 'fill="url(#coverGrad)"';

const t = escapeXml(truncate(title, 30));
const a = escapeXml(truncate(artist || "Unknown artist", 30));
const al = escapeXml(truncate(album || "", 30));

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${coverDefs}

  <!-- Card -->
  <rect x="0" y="0" width="${W}" height="${H}" rx="${R}" fill="#0f1115"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${R}" fill="none" stroke="#242831"/>

  <!-- Left cover -->
  <rect x="34" y="30" width="110" height="110" rx="14" ${coverFill}/>
  <rect x="34" y="30" width="110" height="110" rx="14" fill="none" stroke="#2b2f39"/>

  <!-- Text block -->
  <text x="178" y="76"
        fill="#d7d7d7"
        font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="30"
        font-weight="650">
    ${t}
  </text>

  <text x="178" y="108"
        fill="#9aa0aa"
        font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="22"
        font-weight="500">
    ${a}
  </text>

  <text x="178" y="138"
        fill="#9aa0aa"
        font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="22"
        font-weight="500">
    ${al}
  </text>
</svg>
`;

fs.mkdirSync("assets", { recursive: true });
fs.writeFileSync("assets/now-playing.svg", svg, "utf8");

console.log("Wrote assets/now-playing.svg:", `${title} — ${artist}`);
