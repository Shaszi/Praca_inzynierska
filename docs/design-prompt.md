# Design prompt — Praca inżynierska (drawing practice app)

Paste the whole brief below into Claude. It is written to be self-contained: it names every
route, component, state and constraint that exists today, plus the work that is not designed yet.

---

## Role

You are the design lead for an existing React drawing-practice app. You are redesigning its
visual system, not rebuilding the app. Every change must land in the real codebase and keep
working. You produce design decisions **as code**, in the repo's own patterns.

## What the product actually does

A thesis-project web app that teaches freehand drawing by comparing what the user draws against
a reference, stroke by stroke, and giving immediate local feedback.

Two practice modes:

1. **Reference mode** (`/app/practice`) — the user picks a saved reference made of real stroke
   paths. The app shows **one** guide stroke at a time and the user traces it. On pointer-up the
   stroke is graded locally (no network) and the user either retries or advances to the next stroke.
2. **Image mode** (`/app/practice/image`) — the user uploads a photo. An AI Edge Function returns
   a list of text steps ("draw the jaw line…") and scores each attempt against the image. This
   path needs the network and can fail in many ways.

Progress, daily goals and a streak are tracked per user. References are user-authored and stored
per account, importable/exportable as JSON.

The UI language is **Polish**. All user-facing copy you write must be Polish; code, comments in
new code, and your explanations to me stay English.

## Hard technical constraints

Breaking any of these is a failed design.

- **Tailwind CSS v4** via `@tailwindcss/vite`. All colour lives in the `@theme` block in
  `src/index.css`. **Never introduce a raw hex in a component.** If you need a new colour, add a
  token. The only legitimate hexes in `.tsx`/`.ts` are listed under "Colour that cannot be a token".
- **No new dependencies.** No component library, no animation library, no icon package. Icons are
  hand-written inline SVG in `src/components/icons.tsx`.
- React 19 + Vite 8 + react-router-dom 7. Supabase for auth and storage.
- `npx tsc -b`, `npx vitest run` and `npx vite build` must all stay green.
- **WCAG AA is non-negotiable.** Every text/background pair ≥ 4.5:1 (≥ 3:1 for ≥ 24px or bold
  ≥ 18.66px). State the computed ratio for every new pair you introduce — do not assert it, compute it.
- Keyboard focus must stay visible everywhere. There is a global `:focus-visible` outline in
  `@layer base`; do not remove it per-component without replacing it with something at least as clear.
- Minimum touch target 44px. The existing code uses `min-h-11` for this — keep that convention.

## The canvas is the hard part — read this before designing anything near it

- The drawing surface is a real `<canvas>` sized from its container (`clientWidth`/`clientHeight`)
  with devicePixelRatio scaling. Stroke points are stored in **absolute CSS pixels**.
- **References are NOT scaled to the canvas.** A reference drawn in a 600×600 space renders at
  those literal coordinates. If you change the canvas container's size, padding or aspect ratio,
  you silently crop or misalign every saved reference. Treat canvas geometry as load-bearing:
  if you want to change it, say so explicitly and explain the migration for existing references.
- The live grading runs **every frame** inside `requestAnimationFrame`. Do not add work to that
  path, do not put a network call anywhere near it, and do not add CSS transitions long enough to
  lag behind the pen. The progress bar currently uses `duration-100`; treat that as a ceiling.
- Canvas strokes are painted by the 2D context, which cannot take Tailwind classes.

### Colour that cannot be a token

These literal hexes are correct and must be kept in sync **by hand** with `@theme` whenever you
change the palette. Each already carries a comment saying why:

| File | Why it must stay literal |
|---|---|
| `src/features/canvas/hooks/useCanvas.ts` | default stroke + reference colour for the 2D context |
| `src/features/practice/hooks/usePracticeAnalysis.ts` | live stroke colour by accuracy band |
| `src/features/practice/components/PracticeCanvas.tsx` | reference (guide) stroke colour |

Two hexes are **off limits** entirely:

- `src/features/auth/AuthPage.tsx` — `#EA4335` is Google's brand red inside the `GoogleIcon` SVG
  on the sign-in button. Recolouring a third party's logo is both wrong and a trademark problem.
- `src/services/aiImageGuide.ts` — `#ffffff` / `#111827` render the user's drawing to a PNG
  **for the model to look at**. Restyling them changes what the AI sees and corrupts grading.

Inline SVG *can* reference tokens directly: `stroke="var(--color-accent)"`. Prefer that over a hex.

## Current design system

Fonts: **IBM Plex Sans** (UI) and **IBM Plex Mono** (numbers, metrics, labels), loaded from Google
Fonts in `src/index.css`. Monospace is used deliberately for anything numeric — scores, pixel
offsets, percentages, counters. Keep that distinction; it is the app's main typographic idea.

Tokens currently defined in `@theme` (light only — `color-scheme: light`):

```
paper, paper-dim            page background
surface, surface-dim        cards
line, line-strong           borders
ink, ink-hover, ink-soft, ink-faint    text, 4 weights
accent, accent-strong, accent-soft, accent-line
success, success-soft
warn, warn-soft
danger, danger-soft
```

The palette is violet-tinted: fiolet paper, ink near-black with a violet cast, vivid violet accent,
teal-green success, amber warn, rose danger. `body` carries three very light radial washes
(violet / mint / peach) with `background-attachment: fixed`.

**Known weakness to fix:** the semantic set is thin. There is `warn` but no `warn-line`, no
`info` family at all, and `*-soft` exists only for four of them. Decide deliberately whether to
complete the matrix or collapse it — do not leave it half-built.

### UI primitives — reuse these, do not reinvent

`src/components/ui.tsx`: `Button`, `Segmented`, `Divider`, `Eyebrow`, `Panel`, `PageHeader`,
`Spinner`, `TypingDots`, plus the shared `rangeClass` and `selectClass` strings for native
range/select inputs.

`src/components/icons.tsx`: `HomeIcon`, `PencilIcon`, `ImageIcon`, `LayersIcon`, `ChartIcon`,
`LogOutIcon`, `ArrowRightIcon`, `FlameIcon`, `CheckIcon`.

If a screen needs a control that nearly matches a primitive, extend the primitive. A second
almost-identical button style is a design bug.

### Layout shell

`AppShell` wraps all authenticated routes: header with `BrandMark`, five nav items, user label and
sign-out. Content is capped at `max-w-[1520px]` with `px-4 md:px-6`. `main` uses
`pb-24 md:pb-8` — the tall mobile bottom padding exists because navigation moves to the bottom on
small screens. Respect that.

Nav labels (each has a short form for narrow screens): Pulpit, Ćwiczenia z wzorcem (Wzorzec),
Rysuj ze zdjęcia (Zdjęcie), Moje wzorce (Wzorce), Postęp.

## Full surface inventory

Routes:

| Route | Page | Auth |
|---|---|---|
| `/` | `LandingPage` | public |
| `/login`, `/signup` | `AuthPage` (one component, `mode` prop) | public |
| `/app` | `DashboardPage` | required |
| `/app/practice` | `PracticePage` | required |
| `/app/practice/image` | `ImagePracticePage` | required |
| `/app/references` | `TeacherPage` | required |
| `/app/progress` | `ProgressPage` | required |
| `*` | `NotFoundPage` | public |

`/practice`, `/practice/image` and `/teacher` are legacy redirects — they still need to not look broken.

Feature components: `ControlBar`, `DebugPanel`, `FeedbackPanel`, `BrandMark`,
`SketchIllustration`, `canvas/{DrawingCanvas, CanvasRenderer, CanvasOverlay, SmoothingControl}`,
`practice/PracticeCanvas`, `progress/{ActivityCalendar, GoalProgress, GoalSetup, SessionGrid,
StrokeThumbnail}`, `teacher/{ImportExportControls, ReferenceLibrary, ReferenceSelector}`,
`auth/{AuthPage, AuthProvider, RequireAuth}`.

**Dead files — do not style these, delete them or tell me to:**
`src/components/DrawingCanvas.tsx` and `src/components/ReferenceSelector.tsx` are unused
duplicates of the versions under `src/features/`. Nothing outside `features/` imports them.
(`src/components/GuideOverlay.tsx` was already removed for the same reason.) Styling the wrong
copy is the single easiest mistake to make in this repo.

## Every state you must design

Screens are easy; states are where this app is unfinished. Cover all of these explicitly.

**Practice loop (reference mode)**
- no references saved at all (first-run empty state) vs. references exist but none selected
- references loading; references failed to load
- mid-stroke, live: the progress bar filling, stroke tinted by accuracy band (good/warn/bad)
- stroke rejected as too short (`tooShort`) — it does not count as an attempt and vanishes
- stroke graded: score 0–100, level `good` / `warn` / `bad`, three segment reports
  (`start` / `middle` / `end`), each with issues of kind `offset`, `waver`, `angle`, `tremor`, `pause`
- the worst-error marker pinned on the canvas
- awaiting-next state (retry vs. advance), last stroke of the reference, reference completed
- stroke drawn in reverse (`reversed` is detected and reported)
- undo/redo availability, eraser active, smoothing modes `off` / `adaptive` / `rope`
- save-to-history failure while the session is otherwise fine

**Image mode** — every one of these is a real failure code from the Edge Function and needs a
distinct, non-alarming Polish message:
`unauthorized` (session expired), `config` (server missing its API key), `invalid_input`,
`too_large` (image over ~5 MB), `refusal` (the model declined the image), `rate_limited`,
`bad_request`, `api_error`, `invalid_output`, `network`, `empty`, `internal`, wrong HTTP method.
Also: upload in progress, steps being generated (latency is seconds — `TypingDots` exists for
this), a step's attempt being scored, and a truncated AI comment (the server trims at a sentence
boundary when it hits `max_tokens`).

**Progress** — zero sessions, one session, a long history; goal not set, goal set, goal met,
streak alive, streak broken; the activity calendar across month boundaries.

**References library** — empty, one, many; import succeeded, invalid JSON, invalid structure,
name collision (the app auto-suffixes `(2)`), delete confirmation.

**Auth** — login vs. signup, in flight, wrong credentials, email already registered, weak
password, network down, signed-out redirect back to the intended page.

**Global** — offline, slow network, unexpected error boundary, 404.

## Deliverable

1. **Design rationale first**, short: the one idea the system is built on, and what you are
   deliberately rejecting.
2. **The token block** — the complete `@theme` for `src/index.css`, with a contrast table proving
   AA for every text pair, computed not asserted.
3. **Concrete diffs** for the primitives in `ui.tsx` and any component whose styling must change.
4. **The literal-hex sync list** — the exact new values for the three canvas files above.
5. A **state matrix**: every state from the section above mapped to its visual treatment and its
   Polish copy. Flag any state that currently has no UI at all.
6. **What you did not touch and why.**

Work in this order and stop after step 2 for my approval before writing component diffs. Do not
redesign everything at once.

## Explicitly out of scope unless I say otherwise

Changing canvas geometry, the grading algorithm, the data model, the Supabase schema, the AI
prompts in `supabase/functions/ai/index.ts`, or adding dependencies.

## Future work — design the system so none of this needs a rewrite

The point of this brief is that the palette was already changed once and eight files held hexes
that silently did not follow. Build the system so the next change is one edit.

- **Dark mode.** Nothing supports it today: `:root` hard-codes `color-scheme: light` and the
  tokens have no dark counterparts. Decide the mechanism now even if you do not ship it —
  `prefers-color-scheme`, a `.dark` class, or `light-dark()`. Say which, and make sure the three
  literal-hex canvas files can follow it, because a 2D context cannot read a CSS class. This is
  the single biggest structural risk in the current design.
- **Mobile.** The bottom-nav padding exists but the practice screen has never been designed for a
  phone: a finger-sized canvas, a control bar, a live meter and a feedback panel do not coexist in
  a 375px-wide viewport. Decide what collapses.
- **Stylus / pressure.** The app captures raw pointer samples and already measures tremor and
  pauses from them. Pressure and tilt are the obvious next input; leave room for showing them.
- **i18n.** Every string is a Polish literal inline in the components. If English is ever wanted,
  the design must not depend on Polish string lengths. Note where German/Polish-length labels break.
- **Reference scaling.** Absolute pixel coordinates are a real limitation: references do not adapt
  to the canvas or to a phone. If this is ever fixed, the UI needs to express scale/fit. Design the
  affordance even if the maths comes later.
- **Better stroke comparison.** Grading is projection-onto-polyline today; DTW is flagged as a
  future replacement in `src/utils/analysis.ts`. The scoring UI should not hard-code the
  assumption that a score is one number from one algorithm.
- **More semantic colours.** An `info` family and the missing `*-line` / `*-soft` variants.
- **Motion.** There is no motion language. The only `prefers-reduced-motion` handling in the whole
  app is one media query inside `src/components/SketchIllustration.tsx`, which disables its
  stroke-draw animation — use that as the pattern and generalise it. Whatever you add must have a
  reduced-motion path, and must never animate the drawing path.
- **Performance.** The production bundle is a single ~597 kB chunk with no code splitting; Vite
  already warns about it. Image mode and the progress charts are the obvious split points. Do not
  make it worse — say what your changes cost.
- **Onboarding.** A first-time user lands on an empty references library with no explanation of
  the stroke-by-stroke loop, which is the whole product.
- **Accessibility beyond contrast.** Canvas drawing has no keyboard or screen-reader path at all.
  At minimum the score, the live coverage and the per-segment feedback must be announced; the
  progress bar already has `role="progressbar"` to build on.
- **Print / export / share.** Users will want a finished drawing or a progress report out of the
  app. Nothing supports it.

## Repo hygiene you will notice

`npm run lint` already fails with three pre-existing errors (`canvasDrawing.ts:73-74` prefer-const,
`PracticePage.tsx:163` set-state-in-effect). They are not yours. Do not fix them as a side effect
of a design change, and do not add new ones.
