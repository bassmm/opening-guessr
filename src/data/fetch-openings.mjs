const H = { "User-Agent": "OpeningGuessr/1.0" };
const TENRAI = "https://api.tenrai.org/v1";
const AT = "https://api.animethemes.moe";

const TOTAL = 2500;
const PER_PAGE = 50;
const CONCURRENT = 4;
const MAX_RETRIES = 3;

let collected = 0;
let skipped = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: H });
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

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[:\"'.!?,\-#$@+&%^*()\[\]\/\\<>~`]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function pickOpEntry(animeData) {
  const themes = animeData?.animethemes || [];
  const op = themes
    .filter((t) => t.type === "OP")
    .sort((a, b) => a.sequence - b.sequence)[0];
  if (!op?.animethemeentries?.length) return null;
  const entry = op.animethemeentries[0];
  const video = entry?.videos?.[0];
  if (!video?.link) return null;
  return {
    name: animeData.name,
    slug: animeData.slug,
    video: video.link,
    audio: video.audio?.link || null,
  };
}

async function getAnimeData(slug) {
  const url = `${AT}/anime/${slug}?include=animethemes.animethemeentries.videos.audio`;
  const res = await fetchWithRetry(url);
  if (!res) return null;
  const d = await res.json();
  return d?.anime || null;
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

  const allResults = [];
  const totalPages = Math.ceil(TOTAL / PER_PAGE);

  for (let page = 1; page <= totalPages; page++) {
    process.stdout.write(`\nPage ${page}/${totalPages}...`);

    const tres = await fetchWithRetry(
      `${TENRAI}/top/anime?filter=bypopularity&limit=${PER_PAGE}&page=${page}&sfw=true`
    );
    if (!tres) {
      console.error(" Tenrai failed, skipping page");
      continue;
    }
    const tdata = await tres.json();
    const animeList = tdata.data || [];
    if (!animeList.length) break;

    for (let i = 0; i < animeList.length; i += CONCURRENT) {
      const batch = animeList.slice(i, i + CONCURRENT);
      const entries = await Promise.all(
        batch.map(async (anime) => {
          const titles = [
            ...new Set(
              [anime.title, anime.title_english].filter(Boolean)
            ),
          ];

          for (const title of titles) {
            const slug = slugify(title);
            if (!slug) continue;
            const ad = await getAnimeData(slug);
            if (!ad) continue;
            const entry = pickOpEntry(ad);
            if (!entry) continue;
            const resultTitles = [anime.title];
            if (anime.title_english && anime.title_english !== anime.title) {
              resultTitles.push(anime.title_english);
            }
            if (!resultTitles.includes(entry.name)) {
              resultTitles.unshift(entry.name);
            }
            const syns = (ad.synonyms || []).filter(
              (s) => !resultTitles.includes(s)
            );
            resultTitles.push(...syns);
            return {
              mal_id: anime.mal_id,
              name: entry.name,
              titles: resultTitles,
              rank: anime.popularity || null,
              score: anime.score,
              year: anime.year,
              slug: entry.slug,
              video: entry.video,
              audio: entry.audio,
            };
          }
          return null;
        })
      );

      for (const e of entries) {
        if (e) {
          allResults.push(e);
          collected++;
          process.stdout.write(` ✓ ${e.name}`);
        } else {
          skipped++;
        }
      }
    }

    console.log(` (${collected}/${TOTAL}, skipped: ${skipped})`);

    const sorted = [...allResults].sort(
      (a, b) => (a.rank || 999999) - (b.rank || 999999)
    );
    fs.writeFileSync(
      path.join(outDir, "openings.json"),
      JSON.stringify(sorted.slice(0, TOTAL), null, 2)
    );

    if (collected >= TOTAL) break;
  }

  const final = allResults
    .sort((a, b) => (a.rank || 999999) - (b.rank || 999999))
    .slice(0, TOTAL);
  fs.writeFileSync(path.join(outDir, "openings.json"), JSON.stringify(final, null, 2));
  console.log(`\nDone! ${final.length} openings saved`);
}

main().catch(console.error);
