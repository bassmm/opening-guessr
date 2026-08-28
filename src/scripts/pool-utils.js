// Shared pool/search helpers for the game and the anime directory.

export function countGenres(list) {
  const counts = {};
  list.forEach((a) =>
    (a.genres || []).forEach((g) => {
      counts[g] = (counts[g] || 0) + 1;
    })
  );
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

export function filterPool(source, { rankLimit = null, genres = [] } = {}) {
  return source.filter((d) => {
    if (rankLimit !== null && (d.rank === null || d.rank > rankLimit)) {
      return false;
    }
    if (genres.length > 0) {
      return genres.every((g) => (d.genres || []).includes(g));
    }
    return true;
  });
}

export function matchTitles(pool, query) {
  const q = query.toLowerCase();
  return pool.filter((a) => {
    const titles = a.titles || [a.name];
    return titles.some((t) => (t || "").toLowerCase().includes(q));
  });
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
