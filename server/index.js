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
    
    // Create an absolute path to the diagram.puml
    const diagramSourcePath = path.join(__dirname, 'temp_diagram.puml');

    // Write the PlantUML string to disk at diagram.puml.
    // PlantUML requires an actual file on disk to process. 
    fs.writeFileSync(diagramSourcePath, code);

    // Construct absolute path to the jar file
    const jarPath = path.join(__dirname, 'plantuml.jar');

    // Create a shell command running Java to process diagram.puml.
    exec(`java -jar ${jarPath} -tsvg ${diagramSourcePath}`, (err) => {

        if (err){
            return res.status(500).send('PlantUML failed to render. How sad, try again.');
        }
        
        // Read generated SVG output file from disk
        const svg = fs.readFileSync(path.join(__dirname, 'temp_diagram.svg'), 'utf8');
        
        // Send the SVG markup string back to the browser.
        res.type('text/plain').send(svg);
    });
});

app.listen(3000, () => console.log('Running on http://localhost:3000'));