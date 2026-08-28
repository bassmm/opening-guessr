import {
  fetchWithRetry,
  pickOpEntry,
  queryAnimeThemes,
  mapThemesByMalId,
  collectTitles,
} from "../lib/animethemes.js";

const TENRAI = "https://api.tenrai.org/v1";

const TOTAL = 2500;
const PER_PAGE = 50;
const TENRAI_CONCURRENT = 10;

let collected = 0;
let skipped = 0;

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
      const themesByMalId = mapThemesByMalId(themes);

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

        const resultTitles = collectTitles(
          themeData,
          anime.title,
          anime.title_english
        );

        const nameEnglish =
          anime.title_english || themeData.title?.english || null;

        allResults.push({
          mal_id: anime.mal_id,
          name: entry.name,
          name_english: nameEnglish,
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

    if (collected >= TOTAL) break;
  }

  const final = allResults
    .sort((a, b) => (a.rank || 999999) - (b.rank || 999999))
    .slice(0, TOTAL);
  fs.writeFileSync(path.join(outDir, "openings.json"), JSON.stringify(final));
  console.log(`\nDone! ${final.length} openings saved (${skipped} skipped)`);
}

main().catch(console.error);
