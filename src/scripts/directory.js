import { readCache, writeEntry } from "./cover-cache.js";

document.addEventListener("alpine:init", () => {
    Alpine.data("directory", (initial = []) => ({
        data: [],
        query: "",
        selectedGenres: [],
        genreQuery: "",
        sortBy: "rank",
        genres: [],
        page: 1,
        perPage: 50,
        covers: {},
        coversLoaded: {},
        pageVisible: {},
        narrowed: false,
        dropdownOpen: false,

        init() {
            this.covers = readCache();
            this.data = initial;
            const counts = {};
            this.data.forEach((a) =>
                (a.genres || []).forEach((g) => {
                    counts[g] = (counts[g] || 0) + 1;
                })
            );
            this.genres = Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => ({ name, count }));
            this.recomputePageVisible();
            this.fetchCovers(this.paged);

            this.$watch("query", () => {
                this.page = 1;
                this.recomputePageVisible();
                this.refreshCovers();
            });
            this.$watch("sortBy", () => {
                this.page = 1;
                this.recomputePageVisible();
                this.refreshCovers();
            });
            this.$watch("page", () => {
                this.recomputePageVisible();
                this.refreshCovers();
            });
        },

        toggleGenre(name) {
            if (this.selectedGenres.includes(name)) {
                this.selectedGenres = this.selectedGenres.filter(
                    (g) => g !== name
                );
            } else {
                this.selectedGenres.push(name);
            }
            this.page = 1;
            this.recomputePageVisible();
            this.refreshCovers();
        },

        fetchCovers(items) {
            const missing = items.filter((a) => !(a.mal_id in this.covers));
            if (missing.length === 0) return;
            const fields = missing
                .map(
                    (a) =>
                        `m${a.mal_id}: Media(idMal: ${a.mal_id}, type: ANIME) { coverImage { extraLarge } }`
                )
                .join("\n");
            const query = `query { ${fields} }`;
            fetch("https://graphql.anilist.co", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({ query }),
            })
                .then((r) => r.json())
                .then((d) => {
                    if (!d || !d.data) return;
                    missing.forEach((a) => {
                        const node = d.data["m" + a.mal_id];
                        const url =
                            node && node.coverImage && node.coverImage.extraLarge;
                        if (url) {
                            this.covers[a.mal_id] = url;
                            writeEntry(a.mal_id, url);
                        }
                    });
                })
                .catch(() => {});
        },

        refreshCovers() {
            if (this.data.length > 0) this.fetchCovers(this.paged);
        },

        recomputePageVisible() {
            const map = {};
            for (const a of this.paged) map[a.mal_id] = true;
            this.pageVisible = map;
            if (this.data.length > 0) this.narrowed = true;
        },

        nextPage() {
            if (this.page < this.totalPages) this.page++;
        },

        prevPage() {
            if (this.page > 1) this.page--;
        },

        get totalPages() {
            return Math.max(1, Math.ceil(this.filtered.length / this.perPage));
        },

        get paged() {
            const start = (this.page - 1) * this.perPage;
            return this.filtered.slice(start, start + this.perPage);
        },

        get filtered() {
            let list = this.data;
            const q = this.query.trim().toLowerCase();
            if (q) {
                list = list.filter((a) => {
                    const titles = a.titles || [a.name];
                    return titles.some((t) =>
                        (t || "").toLowerCase().includes(q)
                    );
                });
            }
            if (this.selectedGenres.length > 0) {
                list = list.filter((a) =>
                    this.selectedGenres.every((g) =>
                        (a.genres || []).includes(g)
                    )
                );
            }
            const sort = this.sortBy;
            return [...list].sort((a, b) => {
                if (sort === "score") return (b.score || 0) - (a.score || 0);
                if (sort === "year") return (b.year || 0) - (a.year || 0);
                return (a.rank ?? 999999) - (b.rank ?? 999999);
            });
        },

        get filteredGenres() {
            const q = this.genreQuery.trim().toLowerCase();
            if (!q) return this.genres;
            return this.genres.filter((g) =>
                g.name.toLowerCase().includes(q)
            );
        },
    }));
});