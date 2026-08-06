import Plyr from "plyr";

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
        this.$nextTick(() => this.initPlyr(val === "audio" ? "audio" : "video"));
      });
      const observer = new MutationObserver(() => {
        if (this.screen === "playing" && window.__plyr) {
          this.$nextTick(() => this.initPlyr(this.mode));
        }
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    },

    get filteredPoolCount() {
      if (!this.dataset || !this.dataset.length) return 0;
      const limit = parseInt(this.difficulty);
      return this.dataset.filter((d) => {
        const matchesRank = d.rank !== null && d.rank <= limit;
        if (!matchesRank) return false;
        if (this.selectedGenres.length > 0) {
          return this.selectedGenres.every((g) => (d.genres || []).includes(g));
        }
        return true;
      }).length;
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
        if (window.__plyr) {
          window.__plyr.destroy();
          window.__plyr = null;
        }
        const elRoot = document.documentElement;
        const cs = getComputedStyle(elRoot).getPropertyValue("color-scheme").trim();
        const player = new Plyr(el, {
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
        if (type === "audio") {
          this.setVideoPreload();
        }
        if (type === "video") {
          player.on("ready", () => {
            const dur = player.duration || 1;
            const minPct = (25 / dur) * 100;
            const maxPct = (65 / dur) * 100;
            const container = player.elements.container;
            if (container) {
              container.style.setProperty(
                "--min-percent",
                minPct + "%"
              );
              container.style.setProperty(
                "--max-percent",
                maxPct + "%"
              );
            }
            const progress = player.elements.progress;
            if (progress) {
              progress.style.setProperty("--min-percent", minPct + "%");
              progress.style.setProperty("--max-percent", maxPct + "%");
            }
            el.currentTime = 25;
          });
        }
        window.__plyr = player;
      });
    },

    setVideoPreload() {
      const videoEl = this.$refs.videoPlayer;
      if (!videoEl || videoEl.dataset.preloadArmed) return;
      videoEl.dataset.preloadArmed = "1";
      videoEl.preload = "metadata";
      const bufferFrom25 = () => {
        if (videoEl.currentTime < 25) {
          videoEl.currentTime = 25;
        }
      };
      if (videoEl.readyState >= 1) {
        bufferFrom25();
      } else {
        videoEl.addEventListener("loadedmetadata", bufferFrom25, { once: true });
      }
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
        this.dataset = data;

        const limit = parseInt(this.difficulty);
        this.pool = data.filter((d) => {
          const matchesRank = d.rank !== null && d.rank <= limit;
          if (!matchesRank) return false;
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

      if (this.dataset.length) {
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
        const q = `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { coverImage { large } } }`;
        fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query: q, variables: { idMal: malId } }),
        })
          .then((r) => r.json())
          .then((d) => {
            const url = d?.data?.Media?.coverImage?.large;
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
        this.coverUrl = null;
        this.$nextTick(() => this.initPlyr("audio"));
      },

      backToMenu() {
      this.resetMedia();
      this.selectedGenres = [];
      this.screen = "menu";
    },
  }));
});
