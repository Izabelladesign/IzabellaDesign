import fs from "fs";

const apiKey = process.env.LASTFM_API_KEY;
const user = process.env.LASTFM_USER;

if (!apiKey || !user) {
  console.error("Missing LASTFM_API_KEY or LASTFM_USER");
  process.exit(1);
}

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

fs.mkdirSync("assets", { recursive: true });

const url =
  `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks` +
  `&user=${encodeURIComponent(user)}` +
  `&api_key=${encodeURIComponent(apiKey)}` +
  `&format=json&limit=1`;

const res = await fetch(url);
const data = await res.json();
const track = data?.recenttracks?.track?.[0];

let title = "Not playing anything";
let artist = "";
let album = "";
let coverUrl = "";

if (track) {
  title = track.name ?? title;
  artist = track.artist?.["#text"] ?? "";
  album = track.album?.["#text"] ?? "";
  coverUrl = track.image?.[track.image.length - 1]?.["#text"] ?? "";
}

// Download cover locally so GitHub will render it
const coverPath = "assets/cover.jpg";
let hasCover = false;

try {
  if (coverUrl) {
    const imgRes = await fetch(coverUrl);
    if (imgRes.ok) {
      const buf = Buffer.from(await imgRes.arrayBuffer());
      if (buf.length > 0) {
        fs.writeFileSync(coverPath, buf);
        hasCover = true;
      }
    }
  }
} catch {
  // ignore, fallback below
}

if (!hasCover) {
  // If no cover, keep whatever previous cover exists, or create a tiny placeholder file
  if (!fs.existsSync(coverPath)) {
    fs.writeFileSync(coverPath, Buffer.alloc(0));
  }
}

const W = 720;
const H = 170;
const R = 22;

const t = escapeXml(truncate(title, 30));
const a = escapeXml(truncate(artist || "Unknown artist", 30));
const al = escapeXml(truncate(album || "", 30));

// Use local image in SVG (GitHub reliably renders this)
const coverDefs = hasCover
  ? `
  <defs>
    <pattern id="cover" patternUnits="userSpaceOnUse" width="110" height="110">
      <image href="./assets/cover.jpg" x="0" y="0" width="110" height="110" preserveAspectRatio="xMidYMid slice"/>
    </pattern>
  </defs>`
  : `
  <defs>
    <linearGradient id="coverGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a2a2a"/>
      <stop offset="100%" stop-color="#121212"/>
    </linearGradient>
  </defs>`;

const coverFill = hasCover ? 'fill="url(#cover)"' : 'fill="url(#coverGrad)"';

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${coverDefs}

  <rect x="0" y="0" width="${W}" height="${H}" rx="${R}" fill="#0f1115"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${R}" fill="none" stroke="#242831"/>

  <rect x="34" y="30" width="110" height="110" rx="14" ${coverFill}/>
  <rect x="34" y="30" width="110" height="110" rx="14" fill="none" stroke="#2b2f39"/>

  <text x="178" y="76" fill="#d7d7d7"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
    font-size="30" font-weight="650">${t}</text>

  <text x="178" y="108" fill="#9aa0aa"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
    font-size="22" font-weight="500">${a}</text>

  <text x="178" y="138" fill="#9aa0aa"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
    font-size="22" font-weight="500">${al}</text>
</svg>
`;

fs.writeFileSync("assets/now-playing.svg", svg, "utf8");
console.log("Wrote card:", `${title} — ${artist}`);
