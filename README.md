# PlantUML Drag & Edit

A local web app for editing PlantUML class diagrams with draggable layout. Write PlantUML code, render it through a real PlantUML engine, then drag classes and packages around by hand.

## Why

I love using PlantUML to create my class diagrams. Not for fun, but for my university courseworks & projects. I'm not a psychopath.
However, as good as PlantUML is, I still find myself spending a boatload of time trying to get the layout to look just perfect.
Let me tell you, it's not a fun process. So I made this tool to be able to easily move around classes/packages and make everything
look just how I want them to look. 

It doesn't replace PlantUML's rendering or syntax because that part works great already. It takes PlantUML's own SVG output and adds interactive dragging on top of it.


## How it works

1. You write PlantUML code in the browser.
2. The Node server writes it to a temp `.puml` file and uses the `plantuml.jar -tsvg` to render real PlantUML output.
3. The returned SVG is parsed in the browser. 
4. Each entity/cluster group gets drag handlers. On drag, connecting lines are rerendered live using rectangle-edge intersection math, and labels stay proportionally placed along the line.
5. Packages carry their contained classes along when dragged. (Account.User` belongs to package `Account`).

No PlantUML internals are modified. This project only adds a drag layer on top of its SVG output.

## Requirements

- **Java** (JRE) — to run `plantuml.jar`
- **Node.js** — for the server
- **plantuml.jar** — download a current version from [plantuml.com/download](https://plantuml.com/download) and place it in `server/`. Must be a recent version; older versions (pre-2023ish) emit a different SVG structure this parser doesn't support. (This is already uploaded but you might want to replace it with a newer version in the future)

## Setup

```bash
npm install
```

Place `plantuml.jar` in `server/` (if it already doesn't exist or if you want to replace it with a newer version). Verify it works standalone:

```bash
java -jar server/plantuml.jar -tsvg test.puml
```

Check the output SVG contains `class="entity"`. If it contains `<!--MD5=...-->` comments instead, your jar is too old.

## Run

```bash
node server/index.js
```

Open `http://localhost:3000`.

## Usage

1. Type PlantUML class diagram code (could work with other diagram types, but haven't been explicitly tested) in the textarea (see example pre-filled on load).
2. Click **Render Diagram**.
3. Drag any class box to reposition it.
4. Drag a package's background/border to move it and everything inside it together. Drag an individual class within a package to move just that class.


## Known limitations

- **No persistence.** Dragged positions are lost on re-render or page refresh.
- **Straight-line edges only.** Dragging discards PlantUML's original curved/routed connector paths in favor of straight lines recomputed live.
- **Requires a recent PlantUML SVG format.** The parser depends on `g.entity` / `g.cluster` / `g.link` elements with `data-qualified-name` and `data-entity-1/2` attributes, introduced in newer PlantUML versions. Diagrams rendered by older PlantUML jars will not parse.
- **Only class/interface/enum + package relationships are diagram-aware.** Sequence diagrams, activity diagrams, etc. are not supported by the drag logic (though PlantUML will still render them as static SVG).
- **Single-user, local use.** The server has no auth, and concurrent requests use per-request temp files but no queueing/rate-limiting so not intended for public deployment as-is.

## Future Implementations
- **Colour Pickeer.** Allow background colours to be changed in the visual editor.
- **Size Buttons.** Allow boxes/classes/packages to be sized up easily
- **Zoom in/out Buttons.**
- **Import - Export Buttons.** 
- When in `dragging` state, add an outline for clarity (like yellow).

## Deployment notes
This app needs a persistent server with a JVM available (for `plantuml.jar`). Static hosts like Netlify cannot run this. They only serve static files or short-lived serverless functions with no Java runtime. 