# Looks engine — implementation plan (hardened, eng-reviewed 2026-08-03)

> Self-contained handoff doc. Read this + the memory `layout-agent-live-review-round`
> before starting. This plan is eng-reviewed and cleared; P1 is ready to build.

## Why we're doing this
Live-site review (Emil-design lens): the AI layouts "don't look designed, they look
personal." Root cause: the model emits x/y/size coordinates (the layout agent, decisions
7.21/7.23) and a language model can't art-direct. Fix: **the model picks 1 of 6 hand-crafted
Looks per story and writes the words; deterministic code owns the composition** (type,
placement in the photo's quiet zones, accent, marks). This is what makes it look designed
AND consistent, while different stories still get different looks.

## The 6 Looks (LOCKED — approved by the user 2026-08-03)
Artifact (phone-viewable board): https://claude.ai/code/artifact/30aa49a8-5241-4515-976a-84d10ed38715
Reference HTML mockup (real CSS to port): `~/.gstack/projects/tomnotthomas-auto-stories/designs/story-looks-20260803/board.template.html`
(source template with placeholders; built board `story-looks-board.html` in same dir).

Each Look is a FULL grammar: type pairing, accent usage, mark usage, scrim treatment, placement grammar.
1. **Quiet Editorial** — Fraunces, small, restrained, lower-left. No accent, no marks. Soft shadow, no box.
2. **Film Postcard** — warm 35mm wash + thin print border + rotated date/location stamp. Fraunces caption centred low. (Uses a mono for the stamp.)
3. **Bold Poster** — Bricolage Grotesque 800, all-caps, oversized edge-to-edge. One word in an accent colour block. Pill location tag.
4. **Scrapbook** — Shantell hand type, tilted, with REAL hand marks (underline on key word, doodle) in the accent. White taped location tag. **This is the only home for scribbles.** Engine varies to ~1 mark/frame (mockup showed 3; don't pile up).
5. **Minimal** — system sans, thin, small, top-left, huge negative space, hairline rule. Apple-Memories calm.
6. **Magazine Masthead** — Bricolage kicker + accent tab, hairline rule, big Fraunces headline with one word accent-underlined, footer byline row. Most overtly "designed."

Fonts we can ship (bundled woff2 in `apps/web/public/fonts/`): Fraunces 400/700, Bricolage Grotesque (variable), Shantell Sans 400/700. Film's mono needs a bundled mono OR drop mono → Fraunces.

## Architecture

### Model's job shrinks to (folded into the SINGLE pass-1 call)
Today generation is two model passes: pass 1 = story (`story-generator.service.ts:59`), pass 2 =
`layoutAgent.composeLayouts` (line 88) = N parallel per-frame calls for geometry (the timeout cause).
**DECISION (eng review): fold Look-selection + content into pass 1's `STORY_RESPONSE_SCHEMA` and DELETE pass 2.**
- Story-level: `look` (enum of the 6). One Look per story, held across frames.
- Per frame: `kicker?`, `headline`, `emphasis?` (word/phrase in headline to mark/accent), plus existing `location` (via suggestions).
- Model NEVER emits x/y/size/anchor again.
- DELETE: `layout-agent.service.ts`, `layout-prompt.builder.ts`, `layout.schema.ts`, `layout-critique.builder.ts` (+ their specs). Remove the `composeLayouts` call in `story-generator.service.ts`. Result: one model call per story → kills timeout, cuts latency/cost, deletes a subsystem.

### Contract (openapi → api-types via `npm run openapi:types`, kubb)
- Add `look` to `GenerateResponse` (top-level, alongside `frames`/`partial`) — NOT per frame.
- Add `kicker?`/`headline`/`emphasis?` to `Frame.yaml`.
- HARD-REPLACE: delete `Layout.yaml` + `LayoutElement.yaml` and the `layout` prop on `Frame.yaml`.
- Do contract + backend + web in the SAME P1 PR so the deployed contract never half-migrates (API-contract CI job diffs generated types; must commit regen'd `packages/api-types/src/gen`).

### Web — deterministic Look renderers
- Keep the two-surface discipline: `resolveLayout → LayoutView (DOM) + drawLayout (canvas)` already guarantees preview == export. SWAP the producer: a `Look` composes a `ResolvedComposition` consumed by both surfaces. Repurpose `layout-spec.ts` / `layout-canvas.ts` / `layout-view/`; don't throw the pattern away.
- `interface Look { id; compose(content, photoAnalysis) -> ResolvedComposition }`. Each Look encodes type ramp, placement grammar, accent usage, mark set, scrim. Port the 6 mockup CSS blocks.
- Photo analysis on-device (reuse `accent-color.ts` OffscreenCanvas technique):
  - Quiet-zone map: downscale ~48×48, score a thirds/safe grid by luminance-variance + edge-density; the Look picks its preferred quiet zone → text never on faces. **P1 = Layer-3 heuristic only.** `FaceDetector` is Chromium-only (NOT iOS Safari) — do not depend on it; real saliency = P4.
  - Accent: reuse `sampleAccent`/`vibrantColor`. Legibility light/dark: reuse per-region sampling (decision 7.10).

### Mandatory fallbacks (once Looks are the only renderer, a frame must ALWAYS compose)
- Model omits `look` → default Look. Omits `emphasis` / word not in headline → skip the mark. No quiet zone (busy photo) → fallback placement + scrim. None may crash the export.
- Canvas: every Look's font must be bundled woff2 AND FontFace-loaded (`loadCaptionFonts` in `frame-renderer.ts`) or the PNG silently falls back.

## Phased delivery (small PRs off origin/main, strict TDD, browser-verified on a real generation)
- **P0 — DONE:** 6 Looks locked + recorded (`~/.gstack/projects/tomnotthomas-auto-stories/designs/story-looks-20260803/approved.json`).
- **P1 (NOW) — vertical slice, ONE Look end-to-end (the architectural PR):**
  1. Contract: add `look` (GenerateResponse) + `kicker`/`headline`/`emphasis` (Frame); delete Layout/LayoutElement; `npm run openapi:types`; commit regen.
  2. Backend: add fields to `STORY_RESPONSE_SCHEMA` + `prompt.builder.ts`; DELETE pass 2 files + the `composeLayouts` call; update `shapeFrames`/`story.mapper.ts` for new fields. Keep ≥85% coverage; delete pass-2 specs.
  3. Web: `Look` interface + `resolveComposition`; **Magazine Look** renderer (DOM in `layout-view`, canvas in `layout-canvas`/`frame-renderer`); quiet-zone detector v1 (pure); wire preview + export; default-Look fallback.
  4. Make it look great on the real sample photos (`apps/web/public/sample/example-1.jpg`, `example-3.jpg`) before fanning out.
  - Tests: zone detector (pure), Magazine `compose` (pure), `resolveComposition` (pure), LayoutView (CDK harness), canvas (fake-ctx pattern in `layout-canvas.spec.ts`). **Regression (CRITICAL):** `renderFrame` emits a valid PNG for the Look + the default-fallback path.
- **P2:** add the other 5 Looks (Editorial, Minimal, Poster, Film, Scrapbook + hand-mark SVG set). ~1 PR each, tests + real-generation browser check.
- **P3:** model picks the Look well (prompt/eval) — `[→EVAL]` for Look-fit + emphasis choice; tune on real generations.
- **P4:** quiet-zone v2 (saliency/face-avoidance).
- **P5:** free-drag editing (user chose FULL free-drag, not zone-snap). Tap-select any element, free-drag/resize anywhere, edit text, tap-out commits; add light snap-assist alignment guides UNDER the free drag so it still lands clean. Sequenced last — the default should rarely need editing.

## Existing code the plan touches
- Web: `apps/web/src/app/story/{layout-spec,layout-canvas,accent-color,frame-renderer,caption-render}.ts`; `apps/web/src/app/features/story/layout-view/`; `apps/web/src/app/features/story/story.html` (renders LayoutView vs caption); `story.service.ts` (EditableFrame, computeReadable, sampleAccent).
- API: `apps/api/src/story/{story-generator.service,prompt.builder,story.schema,story.mapper,caption-style}.ts`; DELETE `{layout-agent.service,layout-prompt.builder,layout.schema,layout-critique.builder}.ts` (+specs).
- Contract: `openapi/components/schemas/{Frame,Layout,LayoutElement,GenerateResponse}.yaml`; `packages/api-types/src/gen/`.

## Env / workflow notes
- Web tests: Node ≥22.22.3 (nvm has 22.23.1); runner is **vitest** (`npx ng test --watch=false` from `apps/web`). Before running, ensure the api-types symlink exists: `apps/web/node_modules/@auto-stories/api-types -> ../../../../packages/api-types` (create if missing). Raw `tsc` shows false module-resolution errors — the `ng test` bundle build is the authoritative typecheck.
- API tests: jest, `*.spec.ts` co-located.
- Deployed site (current main, key updated by user): https://auto-stories.onrender.com/app/create — dogfood via `/browse` (global rule: never use mcp__claude-in-chrome). Browse is sandboxed to /private/tmp + repo; copy artifacts there to render. Generation needs GOOGLE_CLOUD_API_KEY (now set on Render).
- Conventions: Conventional Commits, small reviewable PRs, worktree/branch per batch off origin/main, Tailwind + Material only (no component CSS/inline styles), Angular v22 signals/standalone, strict TS no `any`.
- Log decision 7.24 to `docs/decisions.md` (supersedes 7.21/7.23) when starting: Problem→Options→Decision→Why — deterministic Looks replace model-emitted geometry; model picks 1 of 6 Looks + writes words; fold into pass 1, delete pass 2.

## Status: eng-reviewed, CLEARED. Next action: build P1 on a fresh branch `feat/looks-engine-p1` off origin/main.
