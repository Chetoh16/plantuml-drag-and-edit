// Writing a raw HTTP server using Node's built-in http module requires manually parsing URLs, body streams, and static assets.
// Express provides clean abstractions for routing and middleware.
const express = require('express');

// exec allows Node.js to make a system shell and execute external commands 
// (like java -jar which is needed for PlantUML API).
const { exec } = require('child_process');

// filesystem - import the built-in File System module to perform disk operations.
const fs = require('fs');

// Import the Path module to manage file directory paths across OSs.
const path = require('path');

// Instantiate express object
const app = express();

// Parse incoming JSON payloads and populate req.body
app.use(express.json());

// Allow browser to access files/assets in public directory
app.use(express.static('public'));

// Define an HTTP POST endpoint
// GET requests pass parameters in the URL, which has strict character limits and can break with special characters.
// POST sends data inside the request body which allows large diagram markup strings.
app.post('/render', (req, res) => {

    // Extract PlantUML markup string sent from the client/browser
    const code = req.body.code;
    
    // Create absolute paths for the diagrams
    const diagramSourcePath = path.join(__dirname, 'temp_diagram.puml');
    const diagramOutputPath = path.join(__dirname, 'temp_diagram.svg');

    // Construct absolute path to the jar file
    const jarPath = path.join(__dirname, 'plantuml.jar');

    // Write the PlantUML string to disk at diagram.puml.
    // PlantUML requires an actual file on disk to process. 
    fs.writeFile(diagramSourcePath, code, (writeErr) => {

        if (writeErr) {
            console.error('File write error:', writeErr);
            return res.status(500).send('Failed to create temporary input file.');
        }

        // Create a shell command running Java to process diagram.puml.
        exec(`java -jar ${jarPath} -tsvg ${diagramSourcePath}`, (err) => {

            // Clean up the .puml file regardless of success or error
            if (fs.existsSync(diagramSourcePath)) {
                fs.unlinkSync(diagramSourcePath);
            }

            if (err){
                return res.status(500).send('PlantUML failed to render. How sad, try again.');
            }
                        
            // Read generated SVG output
            fs.readFile(diagramOutputPath, 'utf8', (readErr, svgData) => {

                // Clean up the generated .svg file after reading
                if (fs.existsSync(diagramOutputPath)) {
                    fs.unlinkSync(diagramOutputPath);
                }

                if (readErr) {
                    console.error('File read error:', readErr);
                    return res.status(500).send('Failed to read rendered SVG output.');
                }

                // Return raw SVG string back to the client
                res.type('image/svg+xml').send(svgData);
            });
        });
    });
});

app.listen(3000, () => console.log('Running on http://localhost:3000'));