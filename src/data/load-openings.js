import { readFile } from "node:fs/promises";
import path from "node:path";

let cache;

export async function loadOpenings() {
    if (cache) return cache;
    const raw = await readFile(
        path.join(process.cwd(), "public/data/openings.json"),
        "utf-8"
    );
    cache = JSON.parse(raw);
    return cache;
}
