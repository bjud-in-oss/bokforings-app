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
    const shellPath = path.join(__dirname, 'src', 'main', 'ui', 'AppShell.html');
    let html = fs.readFileSync(shellPath, 'utf8');

    // Read CSS and JS files
    const cssPath = path.join(__dirname, 'src', 'ui', 'CSS.html');
    const cssHtml = fs.readFileSync(cssPath, 'utf8');

    const jsPath = path.join(__dirname, 'src', 'ui', 'JS.html');
    const jsHtml = fs.readFileSync(jsPath, 'utf8');

    // Read BatchView file
    const batchViewPath = path.join(__dirname, 'src', 'features', 'batching', 'ui', 'BatchView.html');
    const batchViewHtml = fs.readFileSync(batchViewPath, 'utf8');

    // Replace the scriptlet tags with file contents
    html = html.replace(/<\?!=\s*Init_include\(['"](?:src\/ui\/)?CSS['"]\);\s*\?>/g, cssHtml);
    html = html.replace(/<\?!=\s*Init_include\(['"](?:src\/ui\/)?JS['"]\);\s*\?>/g, jsHtml);
    html = html.replace(/<\?!=\s*Init_include\(['"](?:src\/features\/batching\/ui\/)?BatchView['"]\);\s*\?>/g, batchViewHtml);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).send(`Server error: ${error.message}`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bokförings-app development server running on port ${PORT}`);
});
