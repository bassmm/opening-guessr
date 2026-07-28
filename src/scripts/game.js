import Plyr from "plyr";

if (!document.getElementById("plyr-marker-styles")) {
  const s = document.createElement("style");
  s.id = "plyr-marker-styles";
  s.textContent =
    ".plyr--video .plyr__progress::before,.plyr--video .plyr__progress::after{content:'';position:absolute;top:2px;width:2px;height:calc(100% - 4px);z-index:11;pointer-events:none;border-radius:1px;background:rgba(255,255,255,0.7)}.plyr--video .plyr__progress::before{left:var(--min-percent)}.plyr--video .plyr__progress::after{left:var(--max-percent)}";
  document.head.appendChild(s);
}

document.addEventListener("alpine:init", () => {
  Alpine.data("game", () => ({
    screen: "menu",
    difficulty: "50",
    selectedGenre: "",
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
        const container = player.elements.container;
        if (container) {
          const rootStyle = getComputedStyle(elRoot);
          const primary = rootStyle.getPropertyValue("--color-primary").trim();
          const radius = rootStyle.getPropertyValue("--radius-box").trim();
          container.style.setProperty("--plyr-color-main", primary);
          container.style.setProperty("--plyr-border-radius", radius);
          container.style.setProperty("--plyr-video-controls-background", "oklch(0 0 0 / 0.6)");
          if (type === "audio") {
            container.style.setProperty("--plyr-audio-controls-background", rootStyle.getPropertyValue("--color-base-100").trim());
            container.style.setProperty("--plyr-audio-control-color", rootStyle.getPropertyValue("--color-base-content").trim());
          }
        }
        if (type === "audio") {
          const videoEl = this.$refs.videoPlayer;
          const startVideoPreload = () => {
            if (videoEl && videoEl.preload !== "auto") {
              videoEl.preload = "auto";
              videoEl.load();
            }
          };
          if (el.readyState >= 3) {
            startVideoPreload();
          } else {
            player.on("canplay", startVideoPreload);
          }
        }
        if (type === "video") {
          const mediaProto = HTMLMediaElement.prototype;
          const ctDesc =
            Object.getOwnPropertyDescriptor(mediaProto, "currentTime") ||
            Object.getOwnPropertyDescriptor(
              Object.getPrototypeOf(el),
              "currentTime"
            );
          if (ctDesc && ctDesc.set) {
            Object.defineProperty(el, "currentTime", {
              get() {
                return ctDesc.get.call(el);
              },
              set(value) {
                ctDesc.set.call(
                  el,
                  Math.min(Math.max(value, 25), 65)
                );
              },
            });
          }
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

    switchToVideo() {
      if (!this.videoUnlocked) {
        this.videoUnlocked = true;
      }
      this.mode = "video";
    },

    startGame() {
      if (window.__plyr) {
        window.__plyr.destroy();
        window.__plyr = null;
      }
      this.loading = true;

      const run = (data) => {
        this.dataset = data;

        if (this.difficulty === "genre") {
          this.pool = data.filter(
            (d) =>
              this.selectedGenre &&
              (d.genres || []).includes(this.selectedGenre)
          );
        } else {
          const limit = parseInt(this.difficulty);
          this.pool = data.filter(
            (d) => d.rank !== null && d.rank <= limit
          );
        }

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
          this.$nextTick(() => this.initPlyr("audio"));
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
          english: a.titles?.[1] || null,
        }))
        .slice(0, 4);
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
      if (!this.guess.trim() || this.answered) return;
      if (!this.isValidGuess(this.guess)) {
        this.invalidGuess = true;
        return;
      }
      this.invalidGuess = false;
      const q = this.guess.trim().toLowerCase();
      const titles = this.current.titles || [this.current.name];
      this.isCorrect = titles.some((t) => t.toLowerCase() === q);
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
      if (window.__plyr) {
        window.__plyr.destroy();
        window.__plyr = null;
      }
        this.coverUrl = null;
        this.$nextTick(() => this.initPlyr("audio"));
      },

      backToMenu() {
      if (window.__plyr) {
        window.__plyr.destroy();
        window.__plyr = null;
      }
      this.selectedGenre = "";
      this.screen = "menu";
    },
  }));
});
