# Drawing Training Tool

Modern web app for stroke practice and reference drawing creation.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- React Router v7
- Functional components + hooks

## Features

- Fullscreen responsive canvas with dark, tool-like UI
- Pointer-based drawing (mouse + pointer input)
- Smooth rendering with `requestAnimationFrame`
- Stroke capture as arrays of timestamped points
- Brush size slider, undo last stroke, clear canvas
- Practice mode with guide overlay (line/circle) + feedback
- Teacher mode to save/load/delete reference strokes in `localStorage`
- Simple stroke analysis module ready for DTW extension

## Stroke Data Model

```ts
type Point = {
  x: number;
  y: number;
  timestamp: number;
};

type Stroke = Point[];
```

Each finished stroke is captured and logged to the console for debugging.

## Routes

- `/` Home
- `/practice` Practice mode
- `/teacher` Teacher mode

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run development server

```bash
npm run dev
```

### 3. Build production bundle

```bash
npm run build
```

### 4. Lint

```bash
npm run lint
```

## Project Structure

```text
src/
  components/
    AppLayout.tsx
    ControlBar.tsx
    DrawingCanvas.tsx
    FeedbackPanel.tsx
    GuideOverlay.tsx
    ReferenceSelector.tsx
    TopNavigation.tsx
  hooks/
    useDrawingCanvas.ts
  pages/
    HomePage.tsx
    PracticePage.tsx
    TeacherPage.tsx
    NotFoundPage.tsx
  types/
    drawing.ts
  utils/
    analysis.ts
    feedback.ts
    storage.ts
    strokes.ts
  App.tsx
  main.tsx
  index.css
```

## Core Modules

### `src/hooks/useDrawingCanvas.ts`

Canvas engine hook responsible for:

- pointer interaction lifecycle
- responsive canvas sizing
- frame-based stroke drawing with `requestAnimationFrame`
- returning completed strokes to page-level state

### `src/utils/analysis.ts`

Contains:

- `normalizeStroke(stroke)`
  - translates points so center is at `(0, 0)`
  - scales stroke to fit a unit box
- `distanceBetweenPoints(a, b)`
- `compareStrokes(strokeA, strokeB)`
  - returns similarity score from `0` to `1`
  - structured so DTW can replace internals later

### `src/utils/feedback.ts`

`getFeedback(stroke)` rules:

- high deviation -> `"Line is uneven"`
- too slow or too fast -> `"Try smoother motion"`

## Local Storage

Teacher references are stored under key:

- `drawing-training-references`

Managed by:

- `loadReferences()`
- `saveReferences(references)`

## Notes for Future Expansion

- Replace current point-to-point comparison with DTW in `compareStrokes`
- Add multi-stroke reference matching and scoring aggregation
- Add AI-assisted coaching on top of normalized stroke statistics