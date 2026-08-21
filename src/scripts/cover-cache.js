const KEY = "opguessr:covers:v1";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function safeStorage() {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export function readCache() {
    const ls = safeStorage();
    if (!ls) return {};
    let raw;
    try {
        raw = ls.getItem(KEY);
    } catch {
        return {};
    }
    if (!raw) return {};
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return {};
    }
    if (!parsed || parsed.v !== 1 || !parsed.covers) return {};
    const now = Date.now();
    const out = {};
    for (const id of Object.keys(parsed.covers)) {
        const entry = parsed.covers[id];
        if (entry && typeof entry.url === "string" && now - entry.ts < TTL_MS) {
            out[id] = entry.url;
        }
    }
    return out;
}

export function writeEntry(malId, url) {
    const ls = safeStorage();
    if (!ls) return;
    let parsed;
    try {
        const raw = ls.getItem(KEY);
        parsed = raw ? JSON.parse(raw) : null;
    } catch {
        parsed = null;
    }
    if (!parsed || parsed.v !== 1 || !parsed.covers) {
        parsed = { v: 1, covers: {} };
    }
    parsed.covers[String(malId)] = { url, ts: Date.now() };
    try {
        ls.setItem(KEY, JSON.stringify(parsed));
    } catch {
        const now = Date.now();
        for (const id of Object.keys(parsed.covers)) {
            if (now - parsed.covers[id].ts > TTL_MS) delete parsed.covers[id];
        }
        try {
            ls.setItem(KEY, JSON.stringify(parsed));
        } catch {
            try {
                ls.removeItem(KEY);
            } catch {}
        }
    }
}