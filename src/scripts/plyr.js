// Shared Plyr player setup for the game and the anime detail page.
// Plyr and its CSS are loaded lazily so they never block initial page load.
// The CSS is injected via a ?url import because Astro hoists regular CSS
// imports (even dynamic ones) into a render-blocking <link> in the page head.
import plyrCssUrl from "plyr/dist/plyr.css?url";

let plyrCssLoaded = false;

function loadPlyrCss() {
  if (plyrCssLoaded) return Promise.resolve();
  plyrCssLoaded = true;
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = plyrCssUrl;
    link.onload = resolve;
    document.head.appendChild(link);
  });
}

export function preloadPlyr() {
  import("plyr");
  loadPlyrCss();
}

export const CLIP_START = 25;
export const CLIP_END = 65;

function detectTheme() {
  const cs = getComputedStyle(document.documentElement)
    .getPropertyValue("color-scheme")
    .trim();
  return cs === "dark" ? "dark" : "light";
}

export async function initPlyr(el, type, { clip = true } = {}) {
  el.style.opacity = "0";
  const [, { default: Plyr }] = await Promise.all([loadPlyrCss(), import("plyr")]);
  el.style.opacity = "";
  if (window.__plyr) {
    window.__plyr.destroy();
    window.__plyr = null;
  }
  const player = new Plyr(el, {
    theme: detectTheme(),
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
  if (type === "video" && clip) {
    player.on("ready", () => {
      const dur = player.duration || 1;
      const minPct = (CLIP_START / dur) * 100;
      const maxPct = (CLIP_END / dur) * 100;
      const container = player.elements.container;
      if (container) {
        container.style.setProperty("--min-percent", minPct + "%");
        container.style.setProperty("--max-percent", maxPct + "%");
      }
      const progress = player.elements.progress;
      if (progress) {
        progress.style.setProperty("--min-percent", minPct + "%");
        progress.style.setProperty("--max-percent", maxPct + "%");
      }
      el.currentTime = CLIP_START;
    });
  }
  window.__plyr = player;
  return player;
}
