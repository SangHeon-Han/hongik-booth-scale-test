# Contributor and Agent Guide

This folder contains a 3D booth planner for the Interaction class of Hongik University's 2026 Design Convergence graduation exhibition. Students may edit it directly or with an AI coding agent. These instructions apply throughout this folder.

## Commands

- `npm ci`: install locked dependency versions.
- `npm run dev`: start the local app on port 4310.
- `npm test`: run the Node test suite.
- `npm run build`: create the static app in `dist/`.
- `실행.cmd`: Windows launcher; reuses an existing local server.

Do not edit generated files in `dist/` or `node_modules/`.

## File map

| File | Responsibility |
| --- | --- |
| `index.html` | Entry point and page metadata |
| `src/main.js` | UI, events, state mutations, history, browser storage, JSON import/export |
| `src/style.css` | Responsive layout and warm orange theme |
| `src/theme.css` | App-wide dark colors linked to the active layout's room lighting |
| `vite.config.js` | Relative asset URLs for local previews and project subpath hosting |
| `.github/workflows/deploy.yml` | Tests, production build and GitHub Pages deployment on main |
| `docs/images/booth-scale-preview.png` | User-provided README cover image |
| `src/model.js` | Presets, units, poses, attachments, bounds, collisions, validation/migration |
| `src/project.js` | A/B wrapper, copy/switch operations, project validation |
| `src/environment.js` | Continuous floor dimensions and neighboring booth geometry |
| `src/images.js` | Poster image validation and compression |
| `src/projection.js` | Lens-space projection geometry |
| `src/objects/projection.js` | Projection area, beam, and local light |
| `src/objects/screen.js` | Front-only display face and forward light |
| `src/objects/human.js` | Procedural person pictogram |
| `src/scene.js` | Three.js scene, cameras, picking, dragging, dimensions, PNG export |
| `tests/` | Geometry, data, migration, and lighting regression tests |
| `examples/` | Portable layouts with embedded poster images |
| `qa/` | Local screenshots and verification notes |
| `start.ps1`, `실행.cmd` | Windows startup |
| `LICENSE` | MIT license and original copyright notice |

## Data rules

- Internal lengths are metres; UI values are centimetres. X is horizontal, Y is height, and positive Z faces the audience. Object origins are at their bottom centres.
- Use `width(state)` and `depth(state)`. Booth width is 1.5/2 m, depth is 1.5/1 m, and height is 2 m. Walls sit outside the usable footprint and default to 0.04 m thick.
- Preserve item poses and dimensions when changing the booth. `issues()` reports violations instead of moving or scaling objects.
- `options.neighbors` adds three empty 1.5 × 1.5 × 2 m context booths on each side, aligned at the back wall. Missing values in older files default to false. Render these under the environment root, never as selectable items or collision candidates. Preserve the main booth's wall controls and clear widths around shared partitions. Keep the floor continuous at Y=-0.005 m through the entire hall.
- Table-supported equipment stores the table ID in `support`; X/Z/rotation are relative to it. Use `world()`, `setWorld()`, and `attach()` for coordinate changes.
- A poster's `x` runs along its wall, `y` is its bottom height, and `mount` selects back/left/right. `world()` follows booth dimension changes. Posters cannot be table-supported.
- Use `humanSize(h)`: width = 0.39 × height, depth = 0.05 × height. It is a pictogram, not a measured human body.
- Scene schema is v3. `validate()` migrates v1/v2 and returns the normalized scene. Older v3 projection colors default to `#b6dcff`; supplied colors must be six-digit hex values.
- Project files use `{format:"hicd-project",version:1,active:"A",layouts:{A:scene,B:sceneOrNull}}`. `validateProject()` also wraps legacy single scenes.
- Use `commit()` for mutations and `snapshot()`/`restore()` for history containing both layouts. Do not share mutable item references between A and B. One drag is one undo step.
- Preserve the storage key `hicd-booth-v1`. Never clear saved layouts on import, migration, or storage failure.

## Add an object type

1. Add a stable `PRESETS` key in `src/model.js` with label, subtitle, width/depth/height, and color. Cards and type counts come from this registry.
2. For custom geometry, add `src/objects/<type>.js` and a builder that populates the supplied Three.js group. A plain box can use the fallback.
3. Import it in `src/scene.js` and add a `buildObject()` branch. Centre X/Z around zero and use Y=0 for the bottom, Y=`item.h` for the top. The parent handles world position and rotation.
4. Keep geometry within declared dimensions. Set shadow flags as needed. `disposeGroup()` releases geometry, materials, and light shadow resources. Poster textures have a separate cache lifecycle.
5. Add an icon in `src/main.js`; otherwise the box icon is used. Reuse common size, pose, duplicate, and delete controls.
6. New properties need defaults, controls, validation, and backward-compatible loading. Preserve old user files.
7. `collisionParts()` defaults to an oriented outer box. Follow the table example for shapes with meaningful empty space. New support surfaces also require changes to world/attach logic, validation, and the support selector.
8. Test the changed behavior, run `npm test` and `npm run build`, then verify creation, sizing, rotation, and save/reload in the browser.

## Lighting

- The display front is local +Z. Keep its emissive face single-sided. Light and target must share the display's parent so they follow all object/table rotations.
- Screen lights must point forward. Do not replace them with omnidirectional point lights. Preserve shadows and release their render targets when lights are removed.
- Dark mode retains weak ambient and directional light so walls and objects remain legible, like a dim exhibition room. Keep key/fill light subdued and dim grid/boundary guides too; unlit line materials otherwise appear self-illuminated.
- The active layout's lighting also drives `document.documentElement.dataset.theme`. Keep the header, sidebar, floating controls, native inputs and dialogs consistent through `src/theme.css`; preserve orange accents. Do not add a separate theme preference that can drift from lighting.
- `projection.color` is independent of body color. Apply it to beam, target area, lens emission, and local light.
- Keep intensity restrained. The 0–2 input is relative, not measured brightness.
- Projection remains a virtual-screen preview. Do not claim measured illuminance, keystone correction, or projector occlusion without implementing it.

## Images

- Generate shapes procedurally. Add future shared assets under `src/assets/` and import them through the bundler; avoid domain-root asset paths that break subpath hosting.
- Poster input permits PNG/JPEG/WebP up to 10 MB, compressed to an embedded JPEG data URL of at most 450,000 characters. Allow eight posters per layout; reject external image URLs and SVG input.
- `posterTexture()` caches textures and releases unused entries. PNG export waits for `readyImages()`.

## Documentation and publishing

- Write README.md and AGENTS.md in English. Keep product UI in concise Korean and preserve the warm orange style. Avoid marketing slogans.
- Keep public documentation consistent with implemented behavior. Presets are not verified product measurements.
- `기획.md` is local-only. Preserve it on disk, but never stage, force-add, upload, or publish it to GitHub. `.gitignore` excludes it and `.gitattributes` excludes it from repository archives. Do not link it from README. Verify it is absent from the index and upload set before publishing.
- GitHub Pages deploys pushes to `main` through `.github/workflows/deploy.yml`. The initial public release is authorized. Future local changes do not independently authorize pushing or deployment; follow the user's current request.
- Keep `qa/`, `exports/`, `node_modules/`, `dist/`, environment files and local planning out of the source repository. The Pages artifact must contain only the production `dist/` output. Retain the user-provided cover at the top of README.
- Preserve the MIT license and copyright notice. Keep the author credit and email concise in README. Dependencies retain their own licenses.

## Example request

> Read AGENTS.md and add an editable chair preset. Preserve saved layouts and table attachments, verify the affected behavior, and run the tests and build. Do not publish yet.
