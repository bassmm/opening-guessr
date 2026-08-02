# Graph Report - opening-guessr  (2026-08-03)

## Corpus Check
- 23 files · ~44,817 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 100 nodes · 106 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `38e741cc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dependencies
- package.json
- game.js
- fetch-openings.mjs
- Guidelines
- Guidelines
- Opening Guessr <a href="https://opguessr.netlify.app"><img src="public/favicon.png" width="48" align="right"/></a>
- tsconfig.json
- robots.txt.ts

## God Nodes (most connected - your core abstractions)
1. `Opening Guessr <a href="https://opguessr.netlify.app"><img src="public/favicon.png" width="48" align="right"/></a>` - 7 edges
2. `scripts` - 6 edges
3. `main()` - 5 edges
4. `initPlyr()` - 5 edges
5. `Guidelines` - 5 edges
6. `Guidelines` - 5 edges
7. `fetchWithRetry()` - 4 edges
8. `plyr` - 3 edges
9. `fetchTenraiPage()` - 3 edges
10. `queryAnimeThemes()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `initPlyr()` --references--> `plyr`  [EXTRACTED]
  src/scripts/game.js → package.json

## Import Cycles
- None detected.

## Communities (11 total, 1 thin omitted)

### Community 0 - "dependencies"
Cohesion: 0.12
Nodes (17): alpinejs, astro, @astrojs/alpinejs, @astrojs/sitemap, dependencies, alpinejs, astro, @astrojs/alpinejs (+9 more)

### Community 1 - "package.json"
Cohesion: 0.13
Nodes (14): daisyui, devDependencies, daisyui, engines, node, name, scripts, astro (+6 more)

### Community 2 - "game.js"
Cohesion: 0.26
Nodes (8): init(), initPlyr(), isValidGuess(), nextRound(), selectGuess(), shuffle(), startGame(), submitAnswer()

### Community 4 - "fetch-openings.mjs"
Cohesion: 0.42
Nodes (8): extractGenres(), fetchTenraiPage(), fetchWithRetry(), H, main(), pickOpEntry(), queryAnimeThemes(), sleep()

### Community 5 - "Guidelines"
Cohesion: 0.25
Nodes (7): 1. Think Before Coding, 2. Simplicity First, 3. Surgical Changes, 4. Goal-Driven Execution, Development, Documentation, Guidelines

### Community 6 - "Guidelines"
Cohesion: 0.25
Nodes (7): 1. Think Before Coding, 2. Simplicity First, 3. Surgical Changes, 4. Goal-Driven Execution, Development, Documentation, Guidelines

### Community 7 - "Opening Guessr <a href="https://opguessr.netlify.app"><img src="public/favicon.png" width="48" align="right"/></a>"
Cohesion: 0.25
Nodes (7): Build, Development, Game mechanics, How it works, Opening Guessr <a href="https://opguessr.netlify.app"><img src="public/favicon.png" width="48" align="right"/></a>, Project structure, Tech stack

### Community 8 - "tsconfig.json"
Cohesion: 0.25
Nodes (7): **/*, astro/tsconfigs/strict, .astro/types.d.ts, dist, exclude, extends, include

## Knowledge Gaps
- **42 isolated node(s):** `name`, `type`, `version`, `node`, `prebuild` (+37 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **Why does `plyr` connect `dependencies` to `game.js`?**
  _High betweenness centrality (0.153) - this node is a cross-community bridge._
- **Why does `initPlyr()` connect `game.js` to `dependencies`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **What connects `name`, `type`, `version` to the rest of the system?**
  _42 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._