// Wait for the HTML document structure to fully load before running the script
document.addEventListener('DOMContentLoaded', () => {

    // Get references to the DOM elements to interact with
    const renderBtn = document.getElementById('renderBtn');
    const codeInput = document.getElementById('code');
    const svgHost = document.getElementById('svgHost');


    renderBtn.addEventListener('click', async () => {
        const code = codeInput.value.trim();

        if (!code) {
            alert('Enter PlantUML code before rendering.');
            return;
        }

        try {
            const response = await fetch('/render', {
                method: 'POST',

                // Informs the Express backend how to interpret the incoming raw string
                headers: { 'Content-Type': 'application/json' },

                // Fetch function cannot directly send raw JavaScript objects over HTTP.
                // Need to convert code object into a plain JSON string format
                body: JSON.stringify({ code })
            });

            if (!response.ok) {
                throw new Error('Server returned an error processing the diagram.');
            }
            
            // Raw text response body returned by the server (which contains the raw SVG markup).
            const rawSvg = await response.text();
            initDiagram(rawSvg);

        } catch (error) {
            console.error('Rendering error:', error);
            alert('Failed to render diagram.');
        }
    });

    // Main initialisation once SVG string is retrieved
    function initDiagram(rawSvg) {

        // Initialise the SVG
        svgHost.innerHTML = rawSvg;
        
        // Get the element in order to control it
        const svgRoot = svgHost.querySelector('svg');

        if (!svgRoot) return;

        // Resize SVG Canvas so dragging area is usable
        expandSvgCanvas(svgRoot, svgHost);

        // Extract nodes (classes/clusters/boxes) and edges (connecting lines)
        const nodes = buildNodes(svgRoot);
        const edges = buildEdges(svgRoot, nodes)

        // Group nodes based on whether they're in the same cluster (packages)
        groupNodes(nodes)

        // Redraw edges/lines
        redrawAllEdges(nodes, edges);

        // Attach mouse drag handlers to nodes
        // attachDragHandlers(svgRoot, nodes, edges);

    }

    // Parse all class and cluster elements, to get initial positions via SVG getBBox()
    function buildNodes(svgRoot){

        const nodes = {}

        // The svg is made out g.entities, g.clusters, g.links , g.title etc.
        // Example:
        // <g xmlns="http://www.w3.org/2000/svg" class="cluster" data-qualified-name="Account" data-source-line="20" id="ent0002">
        // <g xmlns="http://www.w3.org/2000/svg" class="entity" data-qualified-name="Account.User" data-source-line="22" id="ent0003">
        svgRoot.querySelectorAll('g.entity, g.cluster').forEach(g => {

            const id = g.getAttribute('id');
            if (!id){
                return
            }
            const isCluster = g.classList.contains('cluster');

            // Full package and class name (e.g. "AuthPackage.User") used for grouping
            // If there is no qualified name, default to id
            const fullName = g.getAttribute('data-qualified-name') || id

            // getBBox() works for any shape (rect for classes, path for package borders)
            const box = g.getBBox();

            // Sets the mouse cursor to "grab"
            g.classList.add('pu-node')

            nodes[id] = {

                // I call it class rather than entity since I mainly work with Class Diagrams
                id, fullName, type: isCluster? 'cluster' : 'class',

                // Initial x-y coordinate when the diagram is first rendered
                origX: box.x, origY: box.y, 
                w: box.width, h: box.height,
                // Current x-y coordinate
                curX: box.x, curY: box.y,
                // Reference to the SVG <g> DOM element representing this node (Group Element)
                groupEl: g, 
                // Array of child node IDs contained inside this package (used if nodeType is 'cluster')
                children: []
            };     
        });
        return nodes
    }

    // A class belongs to a package if its qualified name's prefix
    // (everything before the LAST dot) matches a package's own qualified name.
    // E.g.
    // class="cluster" data-qualified-name="Account"
    // class="entity" data-qualified-name="Account.User"
    // Group nodes based on their container (cluster/class)
    function groupNodes(nodes){
        
        // Separate nodes into clusters (containers) and entities/classes (items)
        // I call it class rather than entity since I mainly work with Class Diagrams
        const clusters = Object.values(nodes).filter(node => node.type === 'cluster')
        const classes = Object.values(nodes).filter(node => node.type !== 'cluster')

        classes.forEach(node => {
            
            // Find the last dot to get the parent prefix (e.g. "Account" from "Account.User")
            const lastDot = node.fullName.lastIndexOf('.')

            // Skip if it has no parent package
            if(lastDot < 0){
                return;
            }

            // Extract parent name and attach this node to its matching cluster
            const parentFullName = node.fullName.slice(0, lastDot)
            const parent = clusters.find(cluster => cluster.fullName === parentFullName)


            // Builds a list of child IDs directly inside the cluster's data object
            // Basically adds the children nodes inside the parent if they belong to the same cluster
            if(parent){
                parent.children.push(node.id)
            }

        });
    }
        

    // Extract edge elements linked via data attributes
    // These are the lines between elements
    function buildEdges(svgRoot, nodes){
        
        const edges = []

        svgRoot.querySelectorAll('g.link').forEach(g => {
            
            const linkFrom = g.getAttribute('data-entity-1')
            const linkTo = g.getAttribute('data-entity-2')

            if (!linkFrom || !linkTo || !nodes[linkFrom] || !nodes[linkTo]){
                return;
            }

            // Example SVG input
            // <g class="link" data-entity-1="ent0006" data-entity-2="ent0016" data-link-type="dependency" data-source-line="136" id="lnk24">
            // <path .../>
            // <polygon fill="#444444" points="264.9,737...."/>
            // <text fill="#000000" font-family="sans-serif" .../text></g>
            const pathElement = g.querySelector('path')
            const polygonElement = g.querySelector('polygon')
            const textElements = [...g.querySelectorAll('text')];

            if (!pathElement){
                return;
            }

            // Extract data from the elements
            const origPoints = extractPathEndpoints(pathElement.getAttribute('d'));
            const textMessage = textElements.map(t => ({
                origX: parseFloat(t.getAttribute('x')),
                origY: parseFloat(t.getAttribute('y'))
            }));

            // Add data to the edges dictionary
            edges.push({ linkFrom, linkTo, pathElement, polygonElement, textElements, textMessage, origPoints });
            
        });

        return edges
    }

    // Get start (x1, y1) and end (x2, y2) coordinate points from path d attributes
    function extractPathEndpoints(d){

        // Find all numbers in the path string (including negatives and decimals) and convert them to Number types
        // For example: "M 10.5 20.2 L 50 100" (M is MoveTo (start) and L is Line to (where to draw the line to))
        // -?: Matches an optional minus sign for negative numbers
        // [\d.]+: Matches one or more digits (\d) or decimal points (.)
        // g: Global flag—finds all matching numbers in the string, not just the first one.
        // ["10.5", "20.2", "50", "100"].
        const nums = d.match(/-?[\d.]+/g).map(Number);

        // Return the first two numbers as the start point, and the last two numbers as the end point
        return { x1: nums[0], y1: nums[1], x2: nums[nums.length - 2], y2: nums[nums.length - 1] };
    }

    // Recalculate straight line path, rotation of arrowhead, and position of labels
    // Used when the elements are moved around in the canvas (dragging area)
    function redrawEdge(e, nodes) {

        // Fetch source and target nodes for drawing lines
        const fromNode = nodes[e.linkFrom]
        const toNode = nodes[e.linkTo];

        if (!fromNode || !toNode){
            return;
        }

        const fromCenter = { x: fromNode.curX + fromNode.w / 2, y: fromNode.curY + fromNode.h / 2 };
        const toCenter = { x: toNode.curX + toNode.w / 2, y: toNode.curY + toNode.h / 2 };

        const p1 = rectEdgeIntersection(fromNode, toCenter.x, toCenter.y);
        const p2 = rectEdgeIntersection(toNode, fromCenter.x, fromCenter.y);

        // Update the SVG path element with the new start and end coordinates
        e.pathElement.setAttribute('d', `M${p1.x},${p1.y} L${p2.x},${p2.y}`);

        // Redraw arrowhead polygon if one exists for this edge
        if (e.polygonElement) {
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const size = 9;

            // Calculate corner points of arrowhead triangle relative to tips
            const back1 = { x: p2.x - size * Math.cos(angle - 0.4), y: p2.y - size * Math.sin(angle - 0.4) };
            const back2 = { x: p2.x - size * Math.cos(angle + 0.4), y: p2.y - size * Math.sin(angle + 0.4) };

            // Update SVG polygon points string to draw triangle (tip, left, right)
            e.polygonElement.setAttribute('points', `${p2.x},${p2.y} ${back1.x},${back1.y} ${back2.x},${back2.y}`);
        }

        // Reposition attached text labels if original layout metrics exist
        if (e.origPoints) {
            
            e.textMessage.forEach((tm, i) => {
                // Find relative scalar position 't' and projected point on original line
                const proj = getLabelLineProjection(tm.origX, tm.origY, e.origPoints.x1, e.origPoints.y1, e.origPoints.x2, e.origPoints.y2);
                
                // Preserve original perpendicular distance from line to text center
                const offsetX = tm.origX - proj.x, offsetY = tm.origY - proj.y;

                // Update SVG text positions
                e.textElements[i].setAttribute('x', p1.x + proj.t * (p2.x - p1.x) + offsetX);
                e.textElements[i].setAttribute('y', p1.y + proj.t * (p2.y - p1.y) + offsetY);
            });
        }
    }

    // Compute rectangle boundary intersection so arrows stop at node borders
    function rectEdgeIntersection(box, towardX, towardY) {

        // Find the center coordinates of the bounding box
        const cx = box.curX + box.w / 2
        const cy = box.curY + box.h / 2;

        // Calculate the horizontal and vertical distances to the target point
        const dx = towardX - cx
        const dy = towardY - cy;

        // If target is at the exact center, return center to avoid dividing by zero
        if (dx === 0 && dy === 0){
            return { x: cx, y: cy };
        }

        // Get half-width and half-height of the bounding box
        const hw = box.w / 2
        const  hh = box.h / 2;

        // Calculate scaling factors to reach horizontal and vertical edges (Infinity if direction is 0)
        const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
        const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity;

        // Pick the smaller scale factor to find which edge is hit first
        const scale = Math.min(scaleX, scaleY);

        // Return the exact intersection point coordinates on the box perimeter
        return { x: cx + dx * scale, y: cy + dy * scale };
    }

    // Finds the closest point on a line segment to a text label, and records its relative position
    // Remembers where a label sits along an arrow (e.g. 50% way through) and its offset,
    // so when nodes are dragged, the label moves smoothly with the updated line.
    function getLabelLineProjection(labelX, labelY, lineStartX, lineStartY, lineEndX, lineEndY) {

        // Measure the total horizontal and vertical distance of the line segment
        const lineDeltaX = lineEndX - lineStartX;
        const lineDeltaY = lineEndY - lineStartY;

        // Calculate the squared length of the line segment
        const lineLengthSquared = lineDeltaX * lineDeltaX + lineDeltaY * lineDeltaY;

        // Calculate 'progressOnLine' (t): 0 = start of line, 0.5 = middle, 1 = end of line
        let progressOnLine = lineLengthSquared === 0 
            ? 0 
            : ((labelX - lineStartX) * lineDeltaX + (labelY - lineStartY) * lineDeltaY) / lineLengthSquared;

        // Lock progress between 0 and 1 so the projection never goes past the line's endpoints
        progressOnLine = Math.max(0, Math.min(1, progressOnLine));

        // Return the percentage along the line and the exact point on the line
        return { 
            t: progressOnLine, 
            x: lineStartX + progressOnLine * lineDeltaX, 
            y: lineStartY + progressOnLine * lineDeltaY 
        };
    }

    // Helper to iterate through all edges and trigger redraw Edge on each one
    function redrawAllEdges(nodes, edges) {
        edges.forEach(e => redrawEdge(e, nodes)); 
    }


    // Dynamically adjust SVG viewport so dragging area (canvas) expands to fill the container (div)
    function expandSvgCanvas(svgRoot, containerEl) {

        // Get PlantUML's real diagram size BEFORE overriding anything
        const origW = parseFloat(svgRoot.getAttribute('width'));
        const origH = parseFloat(svgRoot.getAttribute('height'));

        // Pick the biggest width/height out of canvas and SVG so that there's as much
        // working space (dragging area) as possible
        const canvasW = Math.max(origW, containerEl.clientWidth);
        const canvasH = Math.max(origH, containerEl.clientHeight);

        // Set the internal width and height of the SVG drawing canvas
        svgRoot.setAttribute('width', canvasW);
        svgRoot.setAttribute('height', canvasH);

        // Match the view area to canvas size so elements don't stretch or distort
        svgRoot.setAttribute('viewBox', `0 0 ${canvasW} ${canvasH}`);
        
        // Set the visible width and height of the SVG element on the page
        svgRoot.style.width = canvasW + 'px';
        svgRoot.style.height = canvasH + 'px';
    }


    // Transform screen click coordinates into SVG canvas space coordinates
    function getSvgPoint(svgRoot, event) {

        // Create an empty SVG point object
        const point = svgRoot.createSVGPoint();

        // Set the point's coordinates to the click coordinates
        point.x = event.clientX;
        point.y = event.clientY;

        return point.matrixTransform(svgRoot.getScreenCTM().inverse());
    }



});