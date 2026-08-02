# Graph Report - .  (2026-08-02)

## Corpus Check
- 203 files · ~136,619 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 958 nodes · 1649 edges · 54 communities (43 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51

## God Nodes (most connected - your core abstractions)
1. `StoryService` - 47 edges
2. `Story` - 25 edges
3. `compilerOptions` - 21 edges
4. `scripts` - 16 edges
5. `GenerateRequestDto` - 16 edges
6. `Example` - 16 edges
7. `StoryHarness` - 16 edges
8. `FairUseService` - 15 edges
9. `JobService` - 15 edges
10. `CaptionEditorHarness` - 14 edges

## Surprising Connections (you probably didn't know these)
- `StoryError` --references--> `ErrorCode`  [EXTRACTED]
  apps/web/src/app/story/story.service.ts → packages/api-types/src/gen/models/ErrorCode.ts
- `GenerateRequestDto` --implements--> `GenerateRequest`  [EXTRACTED]
  apps/api/src/story/dto/generate-request.dto.ts → packages/api-types/src/gen/models/GenerateRequest.ts
- `GenerateRequestDto` --references--> `Tone`  [EXTRACTED]
  apps/api/src/story/dto/generate-request.dto.ts → packages/api-types/src/gen/models/Tone.ts
- `PhotoDto` --implements--> `Photo`  [EXTRACTED]
  apps/api/src/story/dto/photo.dto.ts → packages/api-types/src/gen/models/Photo.ts
- `ToneChip` --references--> `Tone`  [EXTRACTED]
  apps/web/src/app/features/create/create.ts → packages/api-types/src/gen/models/Tone.ts

## Import Cycles
- 3-file cycle: `apps/web/src/app/story/caption-cohesion.ts -> apps/web/src/app/story/caption-style.ts -> apps/web/src/app/story/story.service.ts -> apps/web/src/app/story/caption-cohesion.ts`

## Communities (54 total, 11 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (45): ErrorCode, ErrorCodeEnum, ErrorResponse, Frame, GenerateAccepted, GenerateRequest, GenerateResponse, GenerateStory202 (+37 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (15): Example, ExampleFrame, ExampleHarness, SEED, Component, CaptionEditor, clamp(), draggedPosition() (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (47): devDependencies, eslint, eslint-config-prettier, @eslint/eslintrc, @eslint/js, eslint-plugin-prettier, globals, jest (+39 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (44): dependencies, @auto-stories/api-types, class-transformer, class-validator, @google/genai, @nestjs/common, @nestjs/config, @nestjs/core (+36 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (43): build, serve, test, builder, configurations, defaultConfiguration, options, cli (+35 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (42): concurrently, @kubb/cli, @kubb/core, @kubb/plugin-oas, @kubb/plugin-ts, description, devDependencies, concurrently (+34 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (9): RefineFilmstripHarness, RefineFilmstrip, imageFile(), render(), Thumb, Component, StoryHarness, frames (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (24): DEFAULT_PALETTE, Palette, paletteFor(), PaletteId, PALETTES, DISPLAY_FONT, fitMultiplier(), fontFamily() (+16 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (19): BATCH_SIZES, jpegFixtures(), loadPhotos(), main(), AppModule, serveStatic, Module, AppSetupOptions (+11 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (13): isTerminal(), JobController, STORY, Controller, Get, JobModule, Module, JobService (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (23): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, incremental (+15 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (23): global, branches, functions, lines, statements, jest, collectCoverageFrom, coverageDirectory (+15 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (4): reindex(), sparkKey(), StoryService, Injectable

### Community 13 - "Community 13"
Cohesion: 0.16
Nodes (8): ApiException, DEFAULT_MESSAGE, STATUS_BY_CODE, JobWork, STORY, TONES, JPEG, STORY

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (9): genaiProvider, factory, buildPrompt(), DEFAULT_MODEL, DEFAULT_TIMEOUT_MS, GENAI, MIN_PHOTOS, PROXY_MIME_TYPE (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (9): FRAMES, ErrorScreen, Component, Generating, Component, expectNoAxeViolations(), format(), OPTIONS (+1 more)

### Community 17 - "Community 17"
Cohesion: 0.19
Nodes (7): FairUseGuard, Injectable, FairUseService, configWith(), serviceWith(), Injectable, Window

### Community 18 - "Community 18"
Cohesion: 0.17
Nodes (16): ALIGNS, CASES, DEFAULT_STYLE, FONTS, LETTERBOXES, MAX_SUGGESTIONS_PER_FRAME, normalizeStyle(), normalizeSuggestions() (+8 more)

### Community 19 - "Community 19"
Cohesion: 0.16
Nodes (11): clamp(), cohesionFilter(), frameLuminance(), averageLuminance(), DEFAULT_STYLE, pickReadable(), Readable, sampleLuminance() (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.11
Nodes (19): @angular/build, @angular/cli, devDependencies, @angular/build, @angular/cli, jsdom, postcss, prettier (+11 more)

### Community 21 - "Community 21"
Cohesion: 0.11
Nodes (19): @angular/cdk, @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/material, dependencies, @angular/cdk (+11 more)

### Community 22 - "Community 22"
Cohesion: 0.15
Nodes (11): ApiErrors, StoryController, Controller, parseFrames(), StoryGeneratorService, Injectable, Body, HttpCode (+3 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (16): GenerateRequestDto, IsOptional, IsString, Length, PhotoDto, IsOptional, IsString, Length (+8 more)

### Community 24 - "Community 24"
Cohesion: 0.15
Nodes (5): StorySparks, Component, DEFAULT_SWIPE, swipeDismissed(), SwipeThresholds

### Community 25 - "Community 25"
Cohesion: 0.20
Nodes (8): ToneChip, MAX_PHOTOS, MAX_STORY_LENGTH, SparkState, STYLE, StoryError, StoryPhase, Tone

### Community 26 - "Community 26"
Cohesion: 0.14
Nodes (13): compilerOptions, outDir, rootDir, tsBuildInfoFile, exclude, extends, **/*spec.ts, dist (+5 more)

### Community 27 - "Community 27"
Cohesion: 0.15
Nodes (4): HandoffChecklist, HandoffChecklistHarness, STYLE, Component

### Community 30 - "Community 30"
Cohesion: 0.21
Nodes (5): imageFile(), seedStoryPlusOne(), GenerateOutcome, StoryGateway, Injectable

### Community 31 - "Community 31"
Cohesion: 0.17
Nodes (11): description, exports, files, src, name, private, scripts, typecheck (+3 more)

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (4): ChecklistItem, MusicView, SparkView, SUGGESTION_META

### Community 33 - "Community 33"
Cohesion: 0.31
Nodes (7): blobToBase64(), fitWithin(), ImageService, JPEG_QUALITY, MAX_EDGE, Injectable, PickedPhoto

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (10): compilerOptions, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck, strict, target (+2 more)

### Community 36 - "Community 36"
Cohesion: 0.31
Nodes (5): AllExceptionsFilter, CODE_BY_STATUS, extractMessage(), httpErrorStatus(), Catch

### Community 37 - "Community 37"
Cohesion: 0.25
Nodes (6): ImageType, sniffImageType(), HEIC, JPEG, PNG, WEBP

### Community 38 - "Community 38"
Cohesion: 0.31
Nodes (7): AcceptOutcome, EVENT_SOURCE_FACTORY, EventSourceFactory, GENERATE_URL, JOBS_URL, request, STORY

### Community 39 - "Community 39"
Cohesion: 0.25
Nodes (7): description, license, name, private, scripts, build, version

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (7): scripts, build, ng, start, test, typecheck, watch

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 43 - "Community 43"
Cohesion: 0.40
Nodes (3): App, appConfig, Component

### Community 45 - "Community 45"
Cohesion: 0.40
Nodes (4): name, packageManager, private, version

### Community 47 - "Community 47"
Cohesion: 0.67
Nodes (3): main(), pretext_as_global(), Turn the trailing `export{A as name,...}` into `window.Pretext={name:A,...}`.

## Knowledge Gaps
- **274 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+269 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `StoryService` connect `Community 12` to `Community 32`, `Community 1`, `Community 6`, `Community 7`, `Community 15`, `Community 19`, `Community 25`, `Community 27`, `Community 28`, `Community 30`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `Story` connect `Community 16` to `Community 1`, `Community 7`, `Community 6`, `Community 15`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `StorySparksHarness` connect `Community 29` to `Community 32`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _274 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10138248847926268 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0514216575922565 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._