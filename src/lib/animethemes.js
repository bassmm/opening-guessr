// Shared AnimeThemes GraphQL client + data helpers.
// Used by the build-time fetcher (src/data/fetch-openings.mjs, Node)
// and the browser MAL-pool resolver (src/scripts/mal-pool.js).
// Keep this module environment-agnostic: no fs, no localStorage.

// AnimeThemes sits behind Cloudflare and blocks default Node UAs;
// browsers silently drop this header and send their own UA, which is fine.
const H = { "User-Agent": "OpeningGuessr/1.0" };
const GRAPHQL = "https://graphql.animethemes.moe/";
const MAX_RETRIES = 3;

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

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchWithRetry(url, opts = {}, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: H, ...opts });
      if (res.ok) return res;
      if (res.status === 429) {
        await sleep(2000 * (i + 1));
        continue;
      }
      return null;
    } catch {
      if (i < retries - 1) await sleep(1000 * (i + 1));
    }
  }
  return null;
}

export function pickOpEntry(animeData) {
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

export async function queryAnimeThemes(malIds) {
  const res = await fetchWithRetry(GRAPHQL, {
    method: "POST",
    headers: {
      ...H,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: GQL_QUERY, variables: { id: malIds } }),
  });
  if (!res) return [];
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return [];
  }
  if (data.errors) return [];
  return data?.data?.findAnimeByExternalSite || [];
}

export function mapThemesByMalId(themes) {
  const byMalId = new Map();
  for (const t of themes) {
    const malResource = t.resources?.nodes?.find((r) => r.site === "MAL");
    if (malResource?.externalId) {
      byMalId.set(malResource.externalId, t);
    }
  }
  return byMalId;
}

// Collects searchable titles: GraphQL romaji first, then caller-provided
// fallbacks, then GraphQL english and synonyms, deduplicated.
export function collectTitles(themeData, ...fallbacks) {
  const titles = [];
  const push = (t) => {
    if (t && !titles.includes(t)) titles.push(t);
  };
  push(themeData.title?.romaji);
  for (const f of fallbacks) push(f);
  push(themeData.title?.english);
  for (const syn of themeData.synonyms || []) push(syn.text);
  if (!titles.length) {
    titles.push(themeData.title?.romaji || themeData.slug);
  }
  return titles;
}
