import fs from "fs";

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

if (!clientId || !clientSecret || !refreshToken) {
  console.error("Missing Spotify environment variables.");
  process.exit(1);
}

async function getAccessToken() {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
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

  const data = await response.json();
  return data.access_token;
}

async function getNowPlaying(accessToken) {
  const response = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (response.status === 204) return null;
  return response.json();
}

async function fetchImageAsBase64(url) {
  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

(async () => {
  const accessToken = await getAccessToken();
  const now = await getNowPlaying(accessToken);

  let title = "Not Playing";
  let artist = "";
  let album = "";
  let cover = "";

  if (now && now.item) {
    title = now.item.name;
    artist = now.item.artists.map(a => a.name).join(", ");
    album = now.item.album.name;
    cover = await fetchImageAsBase64(now.item.album.images[0].url);
  }

  const svg = `
<svg width="720" height="170" xmlns="http://www.w3.org/2000/svg">
  <rect width="720" height="170" rx="20" fill="#0f1115"/>
  <image href="${cover}" x="30" y="30" width="110" height="110" rx="12"/>
  <text x="170" y="75" fill="#ffffff" font-size="28" font-family="Arial" font-weight="bold">
    ${title}
  </text>
  <text x="170" y="105" fill="#aaaaaa" font-size="20" font-family="Arial">
    ${artist}
  </text>
  <text x="170" y="130" fill="#aaaaaa" font-size="20" font-family="Arial">
    ${album}
  </text>
</svg>
`;

  fs.mkdirSync("assets", { recursive: true });
  fs.writeFileSync("assets/now-playing.svg", svg);

  console.log("Updated now-playing.svg");
})();
