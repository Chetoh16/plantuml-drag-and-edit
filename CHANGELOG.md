# Changelog

## [Unreleased]

## [1.0.0] - 2026-08-23

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
