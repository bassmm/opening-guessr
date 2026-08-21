import { OGImageRoute } from "astro-og-canvas";
import { loadOpenings } from "../../data/load-openings.js";

const openings = await loadOpenings();

const animePages: Record<string, { title: string; description: string }> = {};
for (const a of openings) {
    const display = a.name_english || a.name;
    const desc = a.song?.title
        ? `Opening “${a.song.title}”${a.song.artist ? ` by ${a.song.artist}` : ""}`
        : "Guess this anime from its opening theme!";
    animePages[`anime/${a.slug}`] = { title: display, description: desc };
}

export const { getStaticPaths, GET } = await OGImageRoute({
    pages: {
        home: {
            title: "Opening Guessr",
            description:
                "Guess anime openings — listen to theme songs and test your knowledge.",
        },
        anime: {
            title: "All Anime",
            description: "Browse the full list of anime openings on Opening Guessr.",
        },
        ...animePages,
    },
    getImageOptions: (_path, page) => ({
        title: page.title,
        description: page.description,
        logo: { path: "./public/favicon-96x96.png" },
        bgGradient: [
            [40, 42, 54],
            [68, 71, 90],
        ],
        font: {
            title: { color: [248, 248, 242], size: 64 },
            description: { color: [189, 147, 249], size: 34 },
        },
    }),
});
