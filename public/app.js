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
            initDiagram(rawSvg)

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

        // Extract nodes
        const nodes = buildNodes(svgRoot);

        // Group nodes based on whether they're in the same cluster (packages)
        groupNodes(nodes)

    }

    function buildEdges(svgRoot){
        
        const edges = {}

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
            const textElement = g.querySelector('text')

            if (!pathElement){
                return;
            }

            const origPoints = extractPathEndpoints(pathEl.getAttribute('d'));
            const textMs = textEls.map(t => ({
                origX: parseFloat(t.getAttribute('x')),
                origY: parseFloat(t.getAttribute('y'))
            }));
            edges.push({ from, to, pathEl, polyEl, textEls, textMs, origPoints });
            
        });

        return edges
    }

    function extractPathEndpoints(d){
        return
    }


    // Parse all class and cluster elements, to get initial positions via SVG getBBox()
    function buildNodes(svgRoot){

        const nodes = {}

        // The svg is made out g.entities, g.clusters, g.links , g.title etc.
        // Example:
        // <g xmlns="http://www.w3.org/2000/svg" class="cluster" data-qualified-name="Account" data-source-line="20" id="ent0002">
        // <g xmlns="http://www.w3.org/2000/svg" class="entity" data-qualified-name="Account.User" data-source-line="22" id="ent0003">
        svgRoot.querySelectorAll('g.entity', 'g.cluster').forEach(g => {

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

});