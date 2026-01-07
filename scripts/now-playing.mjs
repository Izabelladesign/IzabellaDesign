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

let text = "Not playing anything right now.";

if (track) {
  const name = track.name;
  const artist = track.artist?.["#text"] ?? "Unknown artist";
  const album = track.album?.["#text"];
  const nowPlaying = track?.["@attr"]?.nowplaying === "true";
  const trackUrl = track.url;

  text = nowPlaying
    ? `▶️ **Now:** [${name} — ${artist}](${trackUrl})${album ? ` _(from ${album})_` : ""}`
    : `⏸️ **Last:** [${name} — ${artist}](${trackUrl})${album ? ` _(from ${album})_` : ""}`;
}

const readmePath = "README.md";
const readme = fs.readFileSync(readmePath, "utf8");

const start = "<!--START_SECTION:nowplaying-->";
const end = "<!--END_SECTION:nowplaying-->";

if (!readme.includes(start) || !readme.includes(end)) {
  console.error("README is missing nowplaying markers");
  process.exit(1);
}

const updated = readme.replace(
  new RegExp(`${start}[\\s\\S]*?${end}`),
  `${start}\n${text}\n${end}`
);

fs.writeFileSync(readmePath, updated);
console.log("Updated:", text);
