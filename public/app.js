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


    // Main initialisation once SVG string is retrieved
    function initDiagram(rawSvg) {

        // Initialise the SVG
        svgHost.innerHTML = rawSvg;
        
        // Get the element in order to control it
        const svgRoot = svgHost.querySelector('svg');

        if (!svgRoot) return;

        // Resize SVG Canvas so dragging area is usable
        expandSvgCanvas(svgRoot, svgHost)
    }
});