// Shared Plyr player setup for the game and the anime detail page.
import Plyr from "plyr";

export const CLIP_START = 25;
export const CLIP_END = 65;

function detectTheme() {
  const cs = getComputedStyle(document.documentElement)
    .getPropertyValue("color-scheme")
    .trim();
  return cs === "dark" ? "dark" : "light";
}

export function initPlyr(el, type, { clip = true } = {}) {
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
