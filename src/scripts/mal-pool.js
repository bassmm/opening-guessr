// Builds a playable opening pool from a MAL user's anime list:
// 1. Fetches the list via the Netlify function (MAL official API proxy)
// 2. Resolves opening videos via the AnimeThemes GraphQL API (batched)
// 3. Caches the resolved pool in localStorage (24h TTL)

const GRAPHQL = "https://graphql.animethemes.moe/";
const BATCH_SIZE = 50;
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_RETRIES = 3;
// AnimeThemes sits behind Cloudflare and blocks default Node UAs;
// browsers silently drop this header and send their own UA, which is fine.
const H = { "User-Agent": "OpeningGuessr/1.0" };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Same query as src/data/fetch-openings.mjs
const GQL_QUERY = `query ($id: [Int!]) {
  findAnimeByExternalSite(site: MAL, id: $id) {
    title { romaji english }
    slug
    resources { nodes { externalId site } }
    animethemes {
      type
      sequence
      song {
        title { romaji }
        performances {
          artist { name { main } }
        }
      }
      animethemeentries(first: 1) {
        videos { nodes { link audio { link } } }
      }
    }
    synonyms { text }
  }
}`;

// Same logic as src/data/fetch-openings.mjs
function pickOpEntry(animeData) {
  const themes = animeData?.animethemes || [];
  const op = themes
    .filter((t) => t.type === "OP")
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))[0];
  if (!op?.animethemeentries?.length) return null;
  const entry = op.animethemeentries[0];
  const video = entry?.videos?.nodes?.[0];
  if (!video?.link) return null;
  return {
    name: animeData.title?.romaji || animeData.slug,
    slug: animeData.slug,
    video: video.link,
    audio: video.audio?.link || null,
    songTitle: op.song?.title?.romaji || null,
    songArtist: op.song?.performances?.[0]?.artist?.name?.main || null,
  };
}

async function queryAnimeThemes(malIds, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(GRAPHQL, {
        method: "POST",
        headers: {
          ...H,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query: GQL_QUERY, variables: { id: malIds } }),
      });
      if (res.status === 429) {
        await sleep(2000 * (i + 1));
        continue;
      }
      if (!res.ok) return [];
      const data = await res.json().catch(() => null);
      if (!data || data.errors) return [];
      return data?.data?.findAnimeByExternalSite || [];
    } catch {
      if (i < retries - 1) await sleep(1000 * (i + 1));
    }
  }
  return [];
}

// entries: [{ mal_id, title, genres }] -> pool entries in the openings.json shape
export async function resolveOpenings(entries, onProgress) {
  const pool = [];
  const batches = [];
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    batches.push(entries.slice(i, i + BATCH_SIZE));
  }

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const themes = await queryAnimeThemes(batch.map((e) => e.mal_id));

    const themesByMalId = new Map();
    for (const t of themes) {
      const malResource = t.resources?.nodes?.find((r) => r.site === "MAL");
      if (malResource?.externalId) {
        themesByMalId.set(malResource.externalId, t);
      }
    }

    for (const entry of batch) {
      const themeData = themesByMalId.get(entry.mal_id);
      if (!themeData) continue;
      const op = pickOpEntry(themeData);
      if (!op) continue;

      const titles = [];
      const push = (t) => {
        if (t && !titles.includes(t)) titles.push(t);
      };
      push(themeData.title?.romaji);
      push(entry.title);
      push(themeData.title?.english);
      for (const syn of themeData.synonyms || []) push(syn.text);
      if (!titles.length) titles.push(op.name);

      pool.push({
        mal_id: entry.mal_id,
        name: op.name,
        name_english: themeData.title?.english || null,
        titles,
        genres: entry.genres || [],
        video: op.video,
        audio: op.audio,
        song: { title: op.songTitle, artist: op.songArtist },
      });
    }

    if (onProgress) onProgress(b + 1, batches.length);
  }

  return pool;
}

function cacheKey(username) {
  return `og_malpool_${username.toLowerCase()}`;
}

export function readMalPoolCache(username) {
  try {
    const raw = localStorage.getItem(cacheKey(username));
    if (!raw) return null;
    const { ts, pool } = JSON.parse(raw);
    if (!Array.isArray(pool) || Date.now() - ts > CACHE_TTL) return null;
    return pool;
  } catch {
    return null;
  }
}

export async function loadMalPool(username, { force = false, onProgress } = {}) {
  if (!force) {
    const cached = readMalPoolCache(username);
    if (cached) return cached;
  }

  const res = await fetch(
    `/.netlify/functions/animelist?username=${encodeURIComponent(username)}`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to load anime list");
  }
  const entries = data.entries || [];

  const pool = await resolveOpenings(entries, onProgress);

  try {
    localStorage.setItem(
      cacheKey(username),
      JSON.stringify({ ts: Date.now(), pool })
    );
  } catch {
    // localStorage full/unavailable — caching is best-effort
  }

  return pool;
}
