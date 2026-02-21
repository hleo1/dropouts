# CLAUDE.md — Project Guidelines

## Project Overview

Hand-tracked 3D canvas using Three.js + MediaPipe Hand Landmarker. The user's webcam hands control a spherical camera around a scene of static blocks. Supports finger-gun gesture for cursor-based block selection with thumb-tap interaction. No build step — runs directly via `npx serve .` with ES module imports from CDN.

## Architecture

```
index.html            Entry point. Loads index.js as ES module. Contains importmap for CDN deps.
index.js              Main app. Scene setup, animation loop, hand dot visualization, wires up agent system.
handCameraControl.js  Camera controller. Maps hand landmarks to orbit/zoom. Owns all gesture logic.
getVisionStuff.js     MediaPipe + webcam initialization. Returns { video, handLandmarker }.
getBodies.js          Static block geometry generator for scene objects.
sceneContext.js       Scene API surface for LLM-generated code. Object registry, animation system, helpers.
codeExecutor.js       Sandboxed execution of generated JS via new Function() with scene API injected.
agent.js              LLM communication (Claude API via CORS proxy). Conversation history, code extraction.
chatUI.js             Chat panel UI + orchestration. Single entry point: handleUserInput(text).
proxy.mjs             Zero-dependency Node CORS proxy (port 9876) for Anthropic API.
```

### Data flow — Hand tracking

1. `getVisionStuff` initializes MediaPipe HandLandmarker (2 hands) and webcam stream
2. Animation loop in `index.js` calls `handLandmarker.detectForVideo()` each frame
3. Raw `handResults.landmarks` array (one entry per detected hand) is passed to `handCameraControl`
4. Camera controller decides behavior: one hand = orbit, two hands = zoom, both fists = pause
5. If a finger-gun gesture is detected (with frame-based hysteresis), `index.js` enters selection mode: a smoothed cursor tracks the index fingertip, and a thumb-tap triggers raycaster hit-testing against blocks
6. `index.js` draws hand landmark dots on the PIP canvas overlay (green = user's right, orange = left)

### Data flow — LLM agent

1. User types (or voice sends) text → `handleUserInput(text)` in `chatUI.js`
2. `askAgent(text)` in `agent.js` sends conversation to Claude via CORS proxy (`localhost:9876`)
3. Response is parsed: JS code extracted from ```js fences, explanation from surrounding text
4. `executeGeneratedCode(code)` in `codeExecutor.js` runs code via `new Function()` with scene API injected
5. Generated code uses helpers like `createSphere()`, `addObject()`, `addAnimation()` from `sceneContext.js`
6. `tickAnimations(delta)` is called every frame in the animate loop to run registered animation callbacks

### Key detail: MediaPipe handedness is camera-relative

MediaPipe labels hands from the camera's perspective. `"Left"` from MediaPipe = user's **right** hand. This is already handled in index.js — do not flip it again.

## File Ownership & Coordination

To avoid merge conflicts when multiple people are working simultaneously:

- **Do not modify the same file as another teammate without coordinating first.** Check open PRs and in-progress branches before touching a file.
- **Use feature branches.** Never push directly to `main`. Open a PR for review.
- **Keep changes scoped.** One concern per PR. Don't mix gesture logic changes with scene/rendering changes.

| File | Owner / Concern | Notes |
|------|----------------|-------|
| `index.js` | Scene setup + animation loop | The glue layer. Keep it thin — delegate logic to modules. |
| `handCameraControl.js` | All gesture interpretation + camera math | Owns gesture detectors (fist, finger-gun, thumb-tap) and camera orbit/zoom. |
| `getVisionStuff.js` | MediaPipe config + webcam access | Rarely needs changes. If adding new models, add here. |
| `getBodies.js` | Scene object generation | Add new object types here. Keep pure (returns mesh, no side effects). |
| `index.html` | DOM structure + importmap | Update importmap when adding/upgrading CDN dependencies. |
| `sceneContext.js` | Scene API for generated code | Object registry + animation system. Helpers return meshes but don't add to scene. |
| `codeExecutor.js` | Code sandboxing | Runs generated JS with scene API params. No window/document/fetch access. |
| `agent.js` | LLM communication | System prompt, conversation history, code fence parsing. Uses `claude-sonnet-4-5-20250929`. |
| `chatUI.js` | Chat UI + orchestration | Creates all DOM in JS. `handleUserInput(text)` is the single entry point for voice swap. |
| `proxy.mjs` | CORS proxy | Must be running (`node proxy.mjs`) for agent to work. Port 9876. |

## Code Style

- **Double quotes** for all strings. No single quotes.
- **Named exports** for all modules (`export { fn }` or `export function fn`). No default exports.
- **2-space indentation**, no tabs.
- **Semicolons** on all statements.
- **camelCase** for variables/functions, **UPPER_SNAKE_CASE** for constants.
- Keep functions short. If a function exceeds ~40 lines, break it up.
- No unused variables or imports. No dead code.

## Dependencies

All dependencies load from CDN via the importmap in `index.html`. There is no `node_modules` or build step.

- **Three.js** — `three` and `jsm/` mapped in importmap
- **MediaPipe** — `@mediapipe/tasks-vision` mapped as `mediapipe`

To add or upgrade a dependency, update the importmap URLs in `index.html`. Pin exact versions.

## Running

```bash
node proxy.mjs          # Terminal 1: CORS proxy (required for LLM agent)
npx serve . -p 3000     # Terminal 2: Static file server
```

Then open http://localhost:3000 in a browser with webcam access. Set your Anthropic API key in the chat panel (bottom-left).

## Scene Details

- **Ground:** Brown `MeshLambertMaterial` plane at y=-5, with grid overlay at y=-4.99
- **Lighting:** `HemisphereLight` (sky/ground) + `DirectionalLight` ("sun" at 15,25,10) with shadow mapping
- **Shadows:** `PCFSoftShadowMap` enabled. Renderer uses `ACESFilmicToneMapping`, `SRGBColorSpace`
- **Background:** Gradient blue sky via `CanvasTexture`
- **Blocks:** 40 earthy-toned `MeshLambertMaterial` boxes with edge wireframes, cast/receive shadows
- **Agent objects** are tracked in a `Map<name, Object3D>` in `sceneContext.js`. `clearAll()` only removes agent-created objects, not original scene objects.

## Common Pitfalls

- **Landmark coordinate space:** Landmarks are normalized 0–1 in the raw video frame. The PIP overlay mirrors X via CSS `scaleX(-1)`, so dot rendering uses `(1 - lm.x)` to match.
- **Pinch/fist thresholds:** Tuning constants are at the top of `handCameraControl.js`. Small changes have big UX impact — test with actual hands before committing.
- **Camera position:** Uses spherical coordinates (theta, phi, radius) around a target point. `updateCameraPosition()` is the single source of truth for camera placement.
- **Frame-to-frame deltas:** The controller tracks previous wrist positions. When switching modes (orbit ↔ zoom) or when a hand disappears, previous values are reset to `null` to avoid jump artifacts on the next frame.
- **Finger-gun hysteresis:** Mode switches require several consecutive frames of detection (`FG_ENTER_FRAMES` / `FG_EXIT_FRAMES`) to prevent flickering between orbit and selection modes.
- **Thumb-tap hysteresis:** Uses enter/exit distance thresholds (`THUMB_TAP_ENTER` / `THUMB_TAP_EXIT`) to fire exactly once per tap and avoid repeated triggers.
- **Proxy must be running:** The LLM agent calls `localhost:9876` which proxies to `api.anthropic.com`. If the proxy isn't running, you get "Failed to fetch" errors.
- **Voice integration:** `window.handleUserInput` is exposed globally by `chatUI.js` — voice input should call this directly instead of wiring into the DOM.
