// Builds a playable opening pool from a MAL user's anime list:
// 1. Fetches the list via the Netlify function (MAL official API proxy)
// 2. Resolves opening videos via the AnimeThemes GraphQL API (batched)
// 3. Caches the resolved pool in localStorage (24h TTL)

import {
  pickOpEntry,
  queryAnimeThemes,
  mapThemesByMalId,
  collectTitles,
} from "../lib/animethemes.js";

const BATCH_SIZE = 50;
const CACHE_TTL = 24 * 60 * 60 * 1000;

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
    const themesByMalId = mapThemesByMalId(themes);

    for (const entry of batch) {
      const themeData = themesByMalId.get(entry.mal_id);
      if (!themeData) continue;
      const op = pickOpEntry(themeData);
      if (!op) continue;

      pool.push({
        mal_id: entry.mal_id,
        name: op.name,
        name_english: themeData.title?.english || null,
        titles: collectTitles(themeData, entry.title),
        genres: entry.genres || [],
        slug: op.slug,
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
