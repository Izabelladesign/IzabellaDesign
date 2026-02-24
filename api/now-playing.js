export default async function handler(req, res) {
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const {
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REFRESH_TOKEN,
  } = process.env;

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
    return res
      .status(400)
      .send("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET / SPOTIFY_REFRESH_TOKEN");
  }

  const basic = Buffer.from(
    `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  async function getAccessToken() {
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: SPOTIFY_REFRESH_TOKEN,
      }),
    });

    const j = await r.json();
    if (!r.ok) throw new Error(`Token error: ${JSON.stringify(j)}`);
    return j.access_token;
  }

  async function getPlayback(accessToken) {
    const r = await fetch("https://api.spotify.com/v1/me/player", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (r.status === 204) return null;

    const j = await r.json();
    if (!r.ok) throw new Error(`Playback error: ${JSON.stringify(j)}`);
    return j;
  }

  async function imageUrlToDataUri(url) {
    if (!url) return "";

    const r = await fetch(url);
    if (!r.ok) return "";

    const contentType = r.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await r.arrayBuffer());
    const base64 = buffer.toString("base64");

    return `data:${contentType};base64,${base64}`;
  }

  let data = null;

  try {
    const accessToken = await getAccessToken();
    data = await getPlayback(accessToken);
  } catch (e) {
    data = null;
  }

  const title = data?.item?.name ?? "Not Playing";
  const artist = data?.item?.artists?.map((a) => a.name).join(", ") ?? "";
  const album = data?.item?.album?.name ?? "";
  const coverUrl = data?.item?.album?.images?.[0]?.url ?? "";

  const coverDataUri = await imageUrlToDataUri(coverUrl);

  const W = 720;
  const H = 170;
  const R = 22;

  const coverSize = 110;
  const coverX = 40;
  const coverY = Math.floor((H - coverSize) / 2);
  const coverR = 18;

  const textX = coverX + coverSize + 30;

  const defs = coverDataUri
    ? `<defs>
        <clipPath id="coverClip">
          <rect x="${coverX}" y="${coverY}" width="${coverSize}" height="${coverSize}" rx="${coverR}" />
        </clipPath>
      </defs>`
    : "";

  const coverElement = coverDataUri
    ? `<image
         href="${escapeXml(coverDataUri)}"
         x="${coverX}"
         y="${coverY}"
         width="${coverSize}"
         height="${coverSize}"
         clip-path="url(#coverClip)"
         preserveAspectRatio="xMidYMid slice"
       />`
    : `<rect x="${coverX}" y="${coverY}" width="${coverSize}" height="${coverSize}" rx="${coverR}" fill="#1b1f2a"/>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${defs}
  <rect width="${W}" height="${H}" rx="${R}" fill="#0f1115"/>

  ${coverElement}

  <text x="${textX}" y="78" fill="#d7d7d7" font-size="34" font-family="Arial" font-weight="700">
    ${escapeXml(trunc(title, 32))}
  </text>
  <text x="${textX}" y="112" fill="#9aa0aa" font-size="22" font-family="Arial">
    ${escapeXml(trunc(artist, 45))}
  </text>
  <text x="${textX}" y="142" fill="#9aa0aa" font-size="22" font-family="Arial">
    ${escapeXml(trunc(album, 45))}
  </text>
</svg>`;

  res.status(200).send(svg);
}

function trunc(s = "", n = 32) {
  return String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s);
}

function escapeXml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
