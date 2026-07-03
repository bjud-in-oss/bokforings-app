import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000; // Port 3000 is required by the environment!

app.get('/', (req, res) => {
  try {
    const guiPath = path.join(__dirname, 'src', 'ui', 'GUI.html');
    let guiHtml = fs.readFileSync(guiPath, 'utf8');

    // Read CSS and JS files
    const cssPath = path.join(__dirname, 'src', 'ui', 'CSS.html');
    const cssHtml = fs.readFileSync(cssPath, 'utf8');

    const jsPath = path.join(__dirname, 'src', 'ui', 'JS.html');
    const jsHtml = fs.readFileSync(jsPath, 'utf8');

    // Replace the scriptlet tags with file contents
    // Supports both 'src/ui/CSS' and 'CSS' styles of includes
    guiHtml = guiHtml.replace(/<\?!=\s*Init_include\(['"](?:src\/ui\/)?CSS['"]\);\s*\?>/g, cssHtml);
    guiHtml = guiHtml.replace(/<\?!=\s*Init_include\(['"](?:src\/ui\/)?JS['"]\);\s*\?>/g, jsHtml);

    res.setHeader('Content-Type', 'text/html');
    res.send(guiHtml);
  } catch (error) {
    console.error(error);
    res.status(500).send(`Server error: ${error.message}`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bokförings-app development server running on port ${PORT}`);
});
