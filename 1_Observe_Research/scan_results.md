# Scan: CSS & JS References

## Current File Locations
* `src/ui/CSS.html`
* `src/ui/JS.html`

## Current Reference Analysis

### 1. `src/main/ui/AppShell.html`
* **Line 8**:
  ```html
  <?!= Init_include('src/ui/CSS'); ?>
  ```
* **Line 204**:
  ```html
  <?!= Init_include('src/ui/JS'); ?>
  ```

### 2. `dev-server.js`
* **Line 18**:
  ```javascript
  const cssPath = path.join(__dirname, 'src', 'ui', 'CSS.html');
  ```
* **Line 21**:
  ```javascript
  const jsPath = path.join(__dirname, 'src', 'ui', 'JS.html');
  ```
* **Line 29**:
  ```javascript
  html = html.replace(/<\?!=\s*Init_include\(['"](?:src\/ui\/)?CSS['"]\);\s*\?>/g, cssHtml);
  ```
* **Line 30**:
  ```javascript
  html = html.replace(/<\?!=\s*Init_include\(['"](?:src\/ui\/)?JS['"]\);\s*\?>/g, jsHtml);
  ```

---

## Migration Steps to `src/main/ui/`

1. **Move files physically**:
   * Move `src/ui/CSS.html` to `src/main/ui/CSS.html`
   * Move `src/ui/JS.html` to `src/main/ui/JS.html`

2. **Update AppShell.html**:
   * Change `Init_include('src/ui/CSS')` to `Init_include('src/main/ui/CSS')`
   * Change `Init_include('src/ui/JS')` to `Init_include('src/main/ui/JS')`

3. **Update dev-server.js**:
   * Update file paths for `cssPath` and `jsPath` to point to `src/main/ui/...`
   * Update regular expressions to match `'src/main/ui/CSS'` and `'src/main/ui/JS'`

4. **Delete old `src/ui/` directory**:
   * Delete `src/ui/CSS.html`
   * Delete `src/ui/JS.html`
   * Delete `src/ui/` directory
