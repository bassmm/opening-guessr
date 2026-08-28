// Shared AniList cover fetching for the game, directory, and detail pages.
const ANILIST = "https://graphql.anilist.co";

async function post(body) {
  const res = await fetch(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return data?.data || null;
}

export async function fetchCover(malId) {
  const data = await post({
    query:
      "query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { coverImage { extraLarge } } }",
    variables: { idMal: malId },
  });
  return data?.Media?.coverImage?.extraLarge || null;
}

export async function fetchCovers(malIds) {
  const fields = malIds
    .map(
      (id) =>
        `m${id}: Media(idMal: ${id}, type: ANIME) { coverImage { extraLarge } }`
    )
    .join("\n");
  const data = await post({ query: `query { ${fields} }` });
  const covers = {};
  for (const id of malIds) {
    const url = data?.["m" + id]?.coverImage?.extraLarge;
    if (url) covers[id] = url;
  }
  return covers;
}
