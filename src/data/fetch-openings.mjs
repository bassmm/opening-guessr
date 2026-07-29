const H = { "User-Agent": "OpeningGuessr/1.0" };
const TENRAI = "https://api.tenrai.org/v1";
const GRAPHQL = "https://graphql.animethemes.moe/";

const TOTAL = 2500;
const PER_PAGE = 50;
const TENRAI_CONCURRENT = 10;
const MAX_RETRIES = 3;

let collected = 0;
let skipped = 0;

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, opts = {}, retries = MAX_RETRIES) {
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

function extractGenres(item) {
  const out = [];
  for (const g of item.genres || []) {
    if (g.name) out.push(g.name);
  }
  for (const t of item.themes || []) {
    if (t.name) out.push(t.name);
  }
  for (const d of item.demographics || []) {
    if (d.name) out.push(d.name);
  }
  return out;
}

async function fetchTenraiPage(page) {
  const res = await fetchWithRetry(
    `${TENRAI}/top/anime?filter=bypopularity&limit=${PER_PAGE}&page=${page}&sfw=true`
  );
  if (!res) return null;
  const data = await res.json();
  return data.data || [];
}

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

async function queryAnimeThemes(malIds) {
  const res = await fetchWithRetry(GRAPHQL, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json", Accept: "application/json" },
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

async function main() {
  const fs = await import("fs");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const outDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../public/data"
  );
  fs.mkdirSync(outDir, { recursive: true });

  const totalPages = Math.ceil(TOTAL / PER_PAGE);
  const allResults = [];

  for (let batchStart = 1; batchStart <= totalPages; batchStart += TENRAI_CONCURRENT) {
    const batchEnd = Math.min(batchStart + TENRAI_CONCURRENT - 1, totalPages);
    console.log(`\n--- Fetching Tenrai pages ${batchStart}-${batchEnd} ---`);

    const tenraiFetches = [];
    for (let p = batchStart; p <= batchEnd; p++) {
      tenraiFetches.push(fetchTenraiPage(p));
    }
    const tenraiPages = await Promise.all(tenraiFetches);

    for (let offset = 0; offset < tenraiPages.length; offset++) {
      const pageNum = batchStart + offset;
      const animeList = tenraiPages[offset];
      if (!animeList || !animeList.length) {
        console.log(`  Page ${pageNum} - no data, skipping`);
        continue;
      }

      process.stdout.write(`  Page ${pageNum}: ${animeList.length} anime → GraphQL...`);

      const malIds = animeList.map((a) => a.mal_id);
      const themes = await queryAnimeThemes(malIds);

      const themesByMalId = new Map();
      for (const t of themes) {
        const malResource = t.resources?.nodes?.find((r) => r.site === "MAL");
        if (malResource?.externalId) {
          themesByMalId.set(malResource.externalId, t);
        }
      }

      let pageCollected = 0;
      let pageSkipped = 0;

      for (const anime of animeList) {
        const themeData = themesByMalId.get(anime.mal_id);
        if (!themeData) {
          pageSkipped++;
          continue;
        }

        const entry = pickOpEntry(themeData);
        if (!entry) {
          pageSkipped++;
          continue;
        }

        const resultTitles = [anime.title];
        if (anime.title_english && anime.title_english !== anime.title) {
          resultTitles.push(anime.title_english);
        }

        const gqlRomaji = themeData.title?.romaji;
        const gqlEnglish = themeData.title?.english;

        if (gqlRomaji && !resultTitles.includes(gqlRomaji)) {
          resultTitles.unshift(gqlRomaji);
        }
        if (gqlEnglish && gqlEnglish !== gqlRomaji && !resultTitles.includes(gqlEnglish)) {
          resultTitles.push(gqlEnglish);
        }

        for (const syn of themeData.synonyms || []) {
          if (syn.text && !resultTitles.includes(syn.text)) {
            resultTitles.push(syn.text);
          }
        }

        allResults.push({
          mal_id: anime.mal_id,
          name: entry.name,
          titles: resultTitles,
          rank: anime.popularity || null,
          score: anime.score,
          year: anime.year,
          genres: extractGenres(anime),
          slug: entry.slug,
          video: entry.video,
          audio: entry.audio,
          song: {
            title: entry.songTitle,
            artist: entry.songArtist,
          },
        });

        pageCollected++;
        collected++;
        process.stdout.write(` ✓ ${entry.name}`);
      }

      console.log(` (collected: ${pageCollected}, skipped: ${pageSkipped})`);
      skipped += pageSkipped;
    }

    const sorted = [...allResults].sort(
      (a, b) => (a.rank || 999999) - (b.rank || 999999)
    );
    fs.writeFileSync(
      path.join(outDir, "openings.json"),
      JSON.stringify(sorted.slice(0, TOTAL))
    );

    if (collected >= TOTAL) break;
  }

  const final = allResults
    .sort((a, b) => (a.rank || 999999) - (b.rank || 999999))
    .slice(0, TOTAL);
  fs.writeFileSync(path.join(outDir, "openings.json"), JSON.stringify(final));
  console.log(`\nDone! ${final.length} openings saved (${skipped} skipped)`);
}

main().catch(console.error);