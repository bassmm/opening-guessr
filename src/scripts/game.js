import Plyr from "plyr";
import { loadMalPool } from "./mal-pool.js";

document.addEventListener("alpine:init", () => {
  Alpine.data("game", () => ({
    screen: "menu",
    difficulty: "50",
    selectedGenres: [],
    genres: [],
    round: 1,
    totalRounds: 5,
    score: 0,
    mode: "audio",
    audioPlyr: null,
    videoPlyr: null,
    playerError: false,
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
    coverCache: {},
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
          const counts = {};
          data.forEach((a) =>
            (a.genres || []).forEach((g) => {
              counts[g] = (counts[g] || 0) + 1;
            })
          );
          this.genres = Object.entries(counts)
            .filter(([g, c]) => c > 50)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));
        })
        .catch(() => {});
      this.$watch("mode", (val, old) => {
        if (val === old) return;
        this.$nextTick(() => {
          if (val === "audio") this.initAudioPlyr();
          else this.initVideoPlyr();
          const el = val === "audio" ? this.$refs.audioPlayer : this.$refs.videoPlayer;
          if (el) this.armLoadWatch(el, val);
        });
      });
      this.$watch("current", () => {
        this.$nextTick(() => {
          const el = this.mode === "audio" ? this.$refs.audioPlayer : this.$refs.videoPlayer;
          if (el) this.armLoadWatch(el, this.mode);
        });
      });
      const observer = new MutationObserver(() => {
        if (this.screen !== "playing") return;
        this.$nextTick(() => {
          if (this.mode === "audio") {
            if (this.audioPlyr) { this.audioPlyr.destroy(); this.audioPlyr = null; }
            this.initAudioPlyr();
          } else {
            if (this.videoPlyr) { this.videoPlyr.destroy(); this.videoPlyr = null; }
            this.initVideoPlyr();
          }
        });
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    },

    get filteredPoolCount() {
      const source = this.listMode === "mal" ? this.malPool : this.dataset;
      if (!source || !source.length) return 0;
      const limit = parseInt(this.difficulty);
      return source.filter((d) => {
        if (this.listMode !== "mal") {
          const matchesRank = d.rank !== null && d.rank <= limit;
          if (!matchesRank) return false;
        }
        if (this.selectedGenres.length > 0) {
          return this.selectedGenres.every((g) => (d.genres || []).includes(g));
        }
        return true;
      }).length;
    },

    get activeGenres() {
      return this.listMode === "mal" ? this.malGenres : this.genres;
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
        const counts = {};
        this.malPool.forEach((a) =>
          (a.genres || []).forEach((g) => {
            counts[g] = (counts[g] || 0) + 1;
          })
        );
        this.malGenres = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }));
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
      [this.$refs.audioPlayer, this.$refs.videoPlayer].forEach((el) => {
        if (!el) return;
        this.clearLoadWatch(el);
        el.pause();
        el.removeAttribute("src");
        el.removeAttribute("data-preload-armed");
        el.dataset.loadRetries = "0";
        el.preload = "none";
        el.load();
      });
      this.playerError = false;
    },

    initPlyr(type) {
      if (type === "audio") this.initAudioPlyr();
      else this.initVideoPlyr();
    },

    initAudioPlyr() {
      const el = this.$refs.audioPlayer;
      if (!el || this.audioPlyr) return;
      const cs = getComputedStyle(document.documentElement)
        .getPropertyValue("color-scheme")
        .trim();
      this.audioPlyr = new Plyr(el, {
        theme: cs === "dark" ? "dark" : "light",
        controls: [
          "play-large",
          "play",
          "progress",
          "current-time",
          "mute",
          "volume",
          "fullscreen",
        ],
      });
      this.attachMediaHandlers(el, "audio");
      this.resolveDuration(el, "audio");
      this.prepareVideoPreload();
    },

    initVideoPlyr() {
      const el = this.$refs.videoPlayer;
      if (!el || this.videoPlyr) return;
      const cs = getComputedStyle(document.documentElement)
        .getPropertyValue("color-scheme")
        .trim();
      this.videoPlyr = new Plyr(el, {
        theme: cs === "dark" ? "dark" : "light",
        controls: [
          "play-large",
          "play",
          "progress",
          "current-time",
          "mute",
          "volume",
          "fullscreen",
        ],
      });
      this.attachMediaHandlers(el, "video");
      if (el.readyState >= 1) {
        const d = isFinite(el.duration) ? el.duration : null;
        this.setVideoMarkers(d || 1);
        if (d !== null) this.restoreStart(el, "video", d);
      }
      this.resolveDuration(el, "video");
    },

    prepareVideoPreload() {
      const videoEl = this.$refs.videoPlayer;
      if (!videoEl) return;
      this.attachMediaHandlers(videoEl, "video");
      if (videoEl.dataset.preloadArmed) return;
      videoEl.dataset.preloadArmed = "1";
      videoEl.preload = "metadata";
    },

    attachMediaHandlers(el, type) {
      if (el.dataset.mediaHandlersArmed) return;
      el.dataset.mediaHandlersArmed = "1";
      el.addEventListener("loadedmetadata", () => {
        const d = isFinite(el.duration) ? el.duration : null;
        if (type === "video") this.setVideoMarkers(d || 1);
        if (d !== null) this.restoreStart(el, type, d);
        if (this.mode === type && !isFinite(el.duration)) {
          this.resolveDuration(el, type);
        }
      });
      el.addEventListener("durationchange", () => {
        if (isFinite(el.duration)) {
          if (type === "video") this.setVideoMarkers(el.duration);
          this.restoreStart(el, type, el.duration);
        } else if (this.mode === type) {
          this.resolveDuration(el, type);
        }
      });
    },

    resolveDuration(el, type) {
      if (el.dataset.durationResolving) return;
      if (isFinite(el.duration)) {
        if (type === "video") this.setVideoMarkers(el.duration);
        this.restoreStart(el, type, el.duration);
        return;
      }
      el.dataset.durationResolving = "1";
      try { el.currentTime = 1e101; } catch (e) {}
      const onTime = () => {
        el.removeEventListener("timeupdate", onTime);
        el.dataset.durationResolving = "";
        const d = isFinite(el.duration) ? el.duration : 1;
        if (type === "video") this.setVideoMarkers(d);
        this.restoreStart(el, type, d);
      };
      el.addEventListener("timeupdate", onTime, { once: true });
    },

    restoreStart(el, type, d) {
      if (type === "video") {
        if (el.currentTime < 25 || el.currentTime >= d) el.currentTime = 25;
      } else if (!isFinite(el.currentTime) || el.currentTime >= d) {
        el.currentTime = 0;
      }
    },

    setVideoMarkers(d) {
      const player = this.videoPlyr;
      if (!player) return;
      const dur = d || 1;
      const minPct = (25 / dur) * 100;
      const maxPct = (65 / dur) * 100;
      const container = player.elements?.container;
      if (container) {
        container.style.setProperty("--min-percent", minPct + "%");
        container.style.setProperty("--max-percent", maxPct + "%");
      }
      const progress = player.elements?.progress;
      if (progress) {
        progress.style.setProperty("--min-percent", minPct + "%");
        progress.style.setProperty("--max-percent", maxPct + "%");
      }
    },

    armLoadWatch(el, type) {
      this.clearLoadWatch(el);
      this.playerError = false;
      if (el.readyState >= 3) return;
      const retries = parseInt(el.dataset.loadRetries || "0", 10);
      if (retries >= 3) return;
      const onOk = () => this.clearLoadWatch(el);
      const fail = () => this.handleMediaFail(el, type);
      el._loadWatchOk = onOk;
      el._loadWatchErr = fail;
      el.addEventListener("canplay", onOk);
      el.addEventListener("loadeddata", onOk);
      el.addEventListener("error", fail);
      el._loadWatchTimer = setTimeout(() => this.handleMediaFail(el, type), 2000);
    },

    clearLoadWatch(el) {
      if (el._loadWatchTimer) {
        clearTimeout(el._loadWatchTimer);
        el._loadWatchTimer = null;
      }
      if (el._loadWatchOk) {
        el.removeEventListener("canplay", el._loadWatchOk);
        el.removeEventListener("loadeddata", el._loadWatchOk);
        el._loadWatchOk = null;
      }
      if (el._loadWatchErr) {
        el.removeEventListener("error", el._loadWatchErr);
        el._loadWatchErr = null;
      }
    },

    handleMediaFail(el, type) {
      const retries = parseInt(el.dataset.loadRetries || "0", 10);
      this.clearLoadWatch(el);
      if (retries < 3) {
        el.dataset.loadRetries = String(retries + 1);
        try { el.load(); } catch (e) {}
        this.armLoadWatch(el, type);
      } else {
        this.playerError = true;
      }
    },

    retryMedia() {
      this.playerError = false;
      const el = this.mode === "audio" ? this.$refs.audioPlayer : this.$refs.videoPlayer;
      if (!el) return;
      el.dataset.loadRetries = "0";
      try { el.load(); } catch (e) {}
      this.armLoadWatch(el, this.mode);
    },

    switchToVideo() {
      if (!this.videoUnlocked) {
        this.videoUnlocked = true;
      }
      this.mode = "video";
    },

    startGame() {
      this.resetMedia();
      this.loading = true;

      const run = (data) => {
        if (this.listMode !== "mal") this.dataset = data;

        const limit = parseInt(this.difficulty);
        this.pool = data.filter((d) => {
          if (this.listMode !== "mal") {
            const matchesRank = d.rank !== null && d.rank <= limit;
            if (!matchesRank) return false;
          }
          if (this.selectedGenres.length > 0) {
            return this.selectedGenres.every((g) => (d.genres || []).includes(g));
          }
          return true;
        });

        if (this.pool.length < this.totalRounds) {
          alert("Not enough anime in this difficulty. Try a larger pool.");
          this.loading = false;
          return;
        }
        this.rounds = this.shuffle([...this.pool]).slice(
          0,
          this.totalRounds
        );
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

    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
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
      const q = this.guess.toLowerCase();
      const seen = new Set();
      this.searchResults = this.pool
        .filter((a) => {
          const titles = a.titles || [a.name];
          return titles.some((t) => t.toLowerCase().includes(q));
        })
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
        return titles.some((t) => t.toLowerCase() === q);
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
        this.isCorrect = titles.some((t) => t.toLowerCase() === q);
      }
      this.answered = true;
      this.correctTitle = this.current.name;
      const points = this.isCorrect
        ? this.videoUnlocked
          ? 500
          : 1000
        : 0;
      this.score += points;
      this.results.push({
        correct: this.isCorrect,
        points,
        title: this.current.name,
      });
      this.searchResults = [];
      const malId = this.current.mal_id;
      if (this.coverCache[malId]) {
        this.coverUrl = this.coverCache[malId];
      } else {
        this.coverLoading = true;
        const q = `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { coverImage { extraLarge } } }`;
        fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query: q, variables: { idMal: malId } }),
        })
          .then((r) => r.json())
          .then((d) => {
            const url = d?.data?.Media?.coverImage?.extraLarge;
            if (url) {
              this.coverCache[malId] = url;
              this.coverUrl = url;
            }
            this.coverLoading = false;
          })
          .catch(() => { this.coverLoading = false; });
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
      this.prepareVideoPreload();
        this.coverUrl = null;
      },

      backToMenu() {
      this.resetMedia();
      this.selectedGenres = [];
      this.screen = "menu";
    },
  }));
});
