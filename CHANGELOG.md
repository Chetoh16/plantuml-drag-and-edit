# Changelog

## [Unreleased]

## [1.3.0] - 2026-08-24

### Added
- Dashed guide lines connecting a class to its package when it has been dragged out of its package. Only appears while the class is being dragged, and only once it has moved fully outside its package's bounding box (any amount of overlap still counts as "inside").
- `rectsOverlap()` helper for the above: simple AABB intersection test.
- `createGuideLines()` / `updateGuideLine()`: build and update the dashed lines using the same math as the existing solid relationship lines.

### Changed
- `groupNodes()` now also records `parentId` on each class node, so a class's owning package can be looked up directly during drag.
- `getTrimmedSvgClone()` now strips any `.pu-guide-line` elements from the exported clone, guaranteeing guide lines can never appear in an exported SVG or PNG.


## [1.2.0] - 2026-08-24

### Added
- PlantUML source in the textarea is now saved to `localStorage` as the user types, and survives a refresh.
- The most recently rendered diagram (the server's raw SVG output, pre-drag) is saved to `localStorage` and automatically restored on page load. It's overwritten the next time you click **Render Diagram**.


## [1.1.0] - 2026-08-23

## Added
- Export buttons to download the current, as-dragged layout as SVG or PNG
- Drag-in-progress highlight: dragged node gets a solid yellow outline.
- Diagram title (g.title) is now draggable alongside classes and packages.
- Re-render Background colour live.

## [1.0.0] - 2026-08-22

### Added
- Package/cluster support: dragging a package moves its contained classes with it, determined by matching `data-qualified-name` prefixes (e.g. class `Account.User` belongs to package `Account`).
- Full canvas resizing: `expandSvgCanvas()` grows the SVG's `viewBox`/`width`/`height` to match the container size (or the diagram's native size, whichever is larger), so small diagrams get a full drag canvas and large diagrams overflow into scrollbars instead of being clipped or distorted.
- 2-column layout: The left column has the textbox for writing the code and the right side displays the rendered diagram as well as act as the dragging area (canvas). 
- Column resizing: The columns can be resized horizontally. Left column has width of 15% min.

### Fixed
- **SVG stretching on resize.** 

### Changed
- **Updated the SVG parser**.
  - Actual current format: classes/interfaces are already grouped as `<g class="entity" id="..." data-qualified-name="Package.Class">`, packages as `<g class="cluster" ...>`, and links as `<g class="link" data-entity-1="entId" data-entity-2="entId">`.
  - Package membership is now determined by string-matching qualified names (split at the last `.`) instead of bounding-box containment checks.
- Verified the new parser against a real PlantText SVG export containing packages, inheritance, associations, and multi-line labels.


### Added
- Express server (`server/index.js`) wrapping `plantuml.jar`: accepts PlantUML source via `POST /render`, runs the command `java -jar plantuml.jar -tsvg`, returns the rendered SVG.
- Frontend (`public/index.html`, `app.js`, `styles.css`): textarea for PlantUML source, render button, SVG display area.
- First working drag implementation: SVG parsing based on PlantUML's SVG structure, `rectEdgeIntersection()` for live-rendering connecting lines, `getScreenCTM().inverse()` for converting mouse coordinates into SVG space, and mousedown/mousemove/mouseup handlers per node.
