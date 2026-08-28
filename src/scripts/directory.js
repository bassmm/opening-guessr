import { readCache, writeEntry } from "./cover-cache.js";
import { fetchCovers } from "./cover-fetch.js";
import { countGenres, filterPool, matchTitles } from "./pool-utils.js";

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
            this.genres = countGenres(this.data);
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

        async fetchCovers(items) {
            const missing = items.filter((a) => !(a.mal_id in this.covers));
            if (missing.length === 0) return;
            try {
                const covers = await fetchCovers(
                    missing.map((a) => a.mal_id)
                );
                missing.forEach((a) => {
                    const url = covers[a.mal_id];
                    if (url) {
                        this.covers[a.mal_id] = url;
                        writeEntry(a.mal_id, url);
                    }
                });
            } catch {}
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
            const q = this.query.trim();
            if (q) {
                list = matchTitles(list, q);
            }
            if (this.selectedGenres.length > 0) {
                list = filterPool(list, { genres: this.selectedGenres });
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
