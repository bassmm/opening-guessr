import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const target = new URL("../../public/data/openings.json", import.meta.url);

if (!existsSync(target)) {
    const result = spawnSync(process.execPath, ["src/data/fetch-openings.mjs"], {
        stdio: "inherit",
    });
    process.exit(result.status ?? 1);
}
