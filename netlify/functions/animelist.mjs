// Proxies the MyAnimeList official API (v2) for public user anime lists.
// Keeps the MAL Client ID server-side; no OAuth needed for public lists.

const MAL_API = "https://api.myanimelist.net/v2";
const ALLOWED_STATUSES = new Set(["completed", "watching", "on_hold", "dropped"]);
const MAX_PAGES = 15; // 15 * 1000 entries safety cap

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) {
    return json({ error: "Server is missing MAL_CLIENT_ID" }, 500);
  }

  const username = new URL(req.url).searchParams.get("username")?.trim();
  if (!username) {
    return json({ error: "Missing username parameter" }, 400);
  }

  const entries = [];
  let url =
    `${MAL_API}/users/${encodeURIComponent(username)}/animelist` +
    `?fields=list_status,genres&limit=1000&nsfw=true`;

  for (let page = 0; page < MAX_PAGES && url; page++) {
    let res;
    try {
      res = await fetch(url, { headers: { "X-MAL-CLIENT-ID": clientId } });
    } catch {
      return json({ error: "Failed to reach MyAnimeList" }, 502);
    }

    if (res.status === 404) {
      return json({ error: `MyAnimeList user "${username}" not found` }, 404);
    }
    if (res.status === 403) {
      return json({ error: "This user's anime list is private" }, 403);
    }
    if (!res.ok) {
      return json({ error: `MyAnimeList returned status ${res.status}` }, 502);
    }

    const data = await res.json();

    for (const item of data.data || []) {
      const status = item.list_status?.status;
      if (!ALLOWED_STATUSES.has(status)) continue;
      entries.push({
        mal_id: item.node?.id,
        title: item.node?.title,
        genres: (item.node?.genres || []).map((g) => g.name),
      });
    }

    url = data.paging?.next || null;
  }

  return json({ entries: entries.filter((e) => e.mal_id && e.title) });
};
