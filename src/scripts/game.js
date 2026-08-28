import { loadMalPool } from "./mal-pool.js";
import { readCache, writeEntry } from "./cover-cache.js";
import { fetchCover } from "./cover-fetch.js";
import { countGenres, filterPool, matchTitles, shuffle } from "./pool-utils.js";
import { initPlyr as createPlyr, CLIP_START, CLIP_END } from "./plyr.js";

const POINTS_AUDIO = 1000;
const POINTS_VIDEO = 500;

document.addEventListener("alpine:init", () => {
  Alpine.data("game", () => ({
    screen: "menu",
    difficulty: 50,
    pointsAudio: POINTS_AUDIO,
    pointsVideo: POINTS_VIDEO,
    selectedGenres: [],
    genres: [],
    round: 1,
    totalRounds: 5,
    score: 0,
    mode: "audio",
    videoUnlocked: false,
    dataset: [],
    pool: [],
    rounds: [],
    current: null,
    guess: "",
    searchResults: [],
    answered: false,
    isCorrect: null,
    correctTitle: "",
    results: [],
    highScore: 0,
    loading: false,
    invalidGuess: false,
    coverUrl: null,
    coverLoading: false,
    suggestAbove: false,
    listMode: "popular",
    malUsername: "",
    malPool: [],
    malGenres: [],
    malLoading: false,
    malProgress: "",
    malError: "",

    init() {
      this.highScore = parseInt(
        localStorage.getItem("openingGuessr_highScore") || "0"
      );
      fetch("/data/openings.json")
        .then((r) => r.json())
        .then((data) => {
          this.dataset = data;
          this.genres = countGenres(data).filter((g) => g.count > 50);
        })
        .catch(() => {});
      this.$watch("mode", (val, old) => {
        if (val === old) return;
        this.$nextTick(() => this.initPlyr(val === "audio" ? "audio" : "video"));
      });
      this.$watch("$store.theme.current", (val, old) => {
        if (val === old) return;
        if (this.screen === "playing" && window.__plyr) {
          this.$nextTick(() => this.initPlyr(this.mode));
        }
      });
    },

    get filteredPoolCount() {
      const source = this.listMode === "mal" ? this.malPool : this.dataset;
      if (!source || !source.length) return 0;
      return filterPool(source, {
        rankLimit: this.listMode === "mal" ? null : this.difficulty,
        genres: this.selectedGenres,
      }).length;
    },

    get activeGenres() {
      return this.listMode === "mal" ? this.malGenres : this.genres;
    },

    get directorySlugs() {
      return new Set((this.dataset || []).map((a) => a.slug).filter(Boolean));
    },

    animeLink(a) {
      if (a?.slug && this.directorySlugs.has(a.slug)) {
        return "/anime/" + a.slug;
      }
      if (a?.mal_id) {
        return "https://myanimelist.net/anime/" + a.mal_id;
      }
      return "#";
    },

    setListMode(mode) {
      if (this.listMode === mode) return;
      this.listMode = mode;
      this.selectedGenres = [];
    },

    async loadMalList(force = false) {
      const username = this.malUsername.trim();
      if (!username || this.malLoading) return;
      this.malLoading = true;
      this.malError = "";
      this.malProgress = "Fetching list from MyAnimeList...";
      try {
        this.malPool = await loadMalPool(username, {
          force,
          onProgress: (done, total) => {
            this.malProgress = `Matching openings... (${done}/${total})`;
          },
        });
        this.malGenres = countGenres(this.malPool);
        this.selectedGenres = [];
        if (!this.malPool.length) {
          this.malError = "No openings found for this list.";
        }
      } catch (e) {
        this.malPool = [];
        this.malGenres = [];
        this.malError = e.message || "Failed to load anime list.";
      } finally {
        this.malLoading = false;
        this.malProgress = "";
      }
    },

    toggleGenre(genreName) {
      if (this.selectedGenres.includes(genreName)) {
        this.selectedGenres = this.selectedGenres.filter((g) => g !== genreName);
      } else {
        this.selectedGenres.push(genreName);
      }
    },

    resetMedia() {
      if (window.__plyr) {
        window.__plyr.destroy();
        window.__plyr = null;
      }
      [this.$refs.audioPlayer, this.$refs.videoPlayer].forEach((el) => {
        if (!el) return;
        el.pause();
        el.removeAttribute("src");
        el.removeAttribute("data-preload-armed");
        el.preload = "none";
        el.load();
      });
    },

    initPlyr(type) {
      if (type === "video" && this.mode !== "video") return;
      if (type === "audio" && this.mode !== "audio") return;
      const key = type === "audio" ? "audioPlayer" : "videoPlayer";
      this.$nextTick(() => {
        const el = this.$refs[key];
        if (!el) return;
        createPlyr(el, type);
        if (type === "audio") {
          this.setVideoPreload();
        }
      });
    },

    clampSeek(el) {
      if (el.currentTime < CLIP_START || el.currentTime > CLIP_END) {
        el.currentTime = Math.min(Math.max(el.currentTime, CLIP_START), CLIP_END);
      }
    },

    stopAtEnd(el) {
      if (el.currentTime >= CLIP_END) el.pause();
    },

    restartIfNearEnd(el) {
      if (el.currentTime >= CLIP_END - 2) el.currentTime = CLIP_START;
    },

    setVideoPreload() {
      const videoEl = this.$refs.videoPlayer;
      if (!videoEl || videoEl.dataset.preloadArmed) return;
      videoEl.dataset.preloadArmed = "1";
      videoEl.preload = "metadata";
      const bufferFromStart = () => {
        if (videoEl.currentTime < CLIP_START) {
          videoEl.currentTime = CLIP_START;
        }
      };
      if (videoEl.readyState >= 1) {
        bufferFromStart();
      } else {
        videoEl.addEventListener("loadedmetadata", bufferFromStart, {
          once: true,
        });
      }
    },

    switchToVideo() {
      if (!this.videoUnlocked) {
        this.videoUnlocked = true;
      }
      this.mode = "video";
    },

    openFullOpening() {
      this.$refs.fullModal.showModal();
      this.$nextTick(() => {
        const video = this.$refs.fullVideo;
        if (video) {
          video.currentTime = 0;
          video.play().catch(() => {});
        }
      });
    },

    closeFullOpening() {
      const video = this.$refs.fullVideo;
      if (video) video.pause();
    },

    startGame() {
      this.resetMedia();
      this.loading = true;

      const run = (data) => {
        if (this.listMode !== "mal") this.dataset = data;

        this.pool = filterPool(data, {
          rankLimit: this.listMode === "mal" ? null : this.difficulty,
          genres: this.selectedGenres,
        });

        if (this.pool.length < this.totalRounds) {
          alert("Not enough anime in this difficulty. Try a larger pool.");
          this.loading = false;
          return;
        }
        this.rounds = shuffle([...this.pool]).slice(0, this.totalRounds);
        this.round = 1;
        this.score = 0;
        this.results = [];
        this.answered = false;
        this.guess = "";
        this.searchResults = [];
        this.invalidGuess = false;
        this.mode = "audio";
        this.videoUnlocked = false;
        this.current = this.rounds[0];
        this.screen = "playing";
        this.loading = false;
        this.coverUrl = null;
      };

      if (this.listMode === "mal") {
        run(this.malPool);
      } else if (this.dataset.length) {
        run(this.dataset);
      } else {
        fetch("/data/openings.json")
          .then((r) => {
            if (!r.ok) throw new Error("Failed to load data");
            return r.json();
          })
          .then((data) => run(data))
          .catch(() => {
            alert("Failed to load game data. Please try again.");
            this.loading = false;
          });
      }
    },

    filterSearch() {
      if (!this.guess.trim()) {
        this.searchResults = [];
        return;
      }
      const input = this.$refs.searchInput;
      if (input) {
        const rect = input.getBoundingClientRect();
        this.suggestAbove = window.innerHeight - rect.bottom < 200;
      }
      const seen = new Set();
      this.searchResults = matchTitles(this.pool, this.guess)
        .filter((a) => {
          if (seen.has(a.name)) return false;
          seen.add(a.name);
          return true;
        })
        .map((a) => ({
          name: a.titles?.[0] || a.name,
          english: a.name_english || null,
        }))
        .slice(0, 5);
    },

    selectGuess(result) {
      this.guess = result.name;
      this.searchResults = [];
      this.invalidGuess = false;
      this.submitAnswer();
    },

    isValidGuess(text) {
      if (!text.trim()) return false;
      const q = text.trim().toLowerCase();
      return this.pool.some((a) => {
        const titles = a.titles || [a.name];
        return titles.some((t) => (t || "").toLowerCase() === q);
      });
    },

    submitAnswer() {
      if (this.answered) return;
      if (!this.guess.trim()) {
        this.isCorrect = false;
        this.invalidGuess = false;
      } else {
        if (!this.isValidGuess(this.guess)) {
          this.invalidGuess = true;
          return;
        }
        this.invalidGuess = false;
        const q = this.guess.trim().toLowerCase();
        const titles = this.current.titles || [this.current.name];
        this.isCorrect = titles.some((t) => (t || "").toLowerCase() === q);
      }
      this.answered = true;
      this.correctTitle = this.current.name;
      const points = this.isCorrect
        ? this.videoUnlocked
          ? POINTS_VIDEO
          : POINTS_AUDIO
        : 0;
      this.score += points;
      this.results.push({
        correct: this.isCorrect,
        points,
        title: this.current.name,
      });
      this.searchResults = [];
      const malId = this.current.mal_id;
      const cached = readCache()[malId];
      if (cached) {
        this.coverUrl = cached;
      } else {
        this.coverLoading = true;
        fetchCover(malId)
          .then((url) => {
            if (url) {
              writeEntry(malId, url);
              this.coverUrl = url;
            }
            this.coverLoading = false;
          })
          .catch(() => {
            this.coverLoading = false;
          });
      }
    },

    nextRound() {
      if (this.round >= this.totalRounds) {
        if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem(
            "openingGuessr_highScore",
            String(this.score)
          );
        }
        this.screen = "result";
        return;
      }
      this.round++;
      this.current = this.rounds[this.round - 1];
      this.answered = false;
      this.guess = "";
      this.searchResults = [];
      this.invalidGuess = false;
      this.mode = "audio";
      this.videoUnlocked = false;
      this.resetMedia();
      this.coverUrl = null;
      if (this.$refs.fullModal && this.$refs.fullModal.open) {
        this.$refs.fullModal.close();
      }
      this.$nextTick(() => this.initPlyr("audio"));
    },

    backToMenu() {
      this.resetMedia();
      this.selectedGenres = [];
      if (this.$refs.fullModal && this.$refs.fullModal.open) {
        this.$refs.fullModal.close();
      }
      this.screen = "menu";
    },
  }));
});
