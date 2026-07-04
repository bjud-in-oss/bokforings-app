# ARCHITECTURE BLUEPRINT: DRIVE INTEGRATION (VERIFIKAT)

## 1. BACKEND ARCHITECTURE (src/features/drive/FilePicker.js)
The backend file `FilePicker.js` manages all communications with Google Drive API and ties verified receipts to transaction records.

### Interface & Prefix
All functions use the `Drive_` prefix to prevent namespace collisions during clasp deployment.

### Functions Specification:
1. **`Drive_resolvePathAsynchronously(fileId)`**
   * **Purpose**: Performs an upward hierarchy traversal starting from the selected file.
   * **Behavior**:
     * Open the file using `DriveApp.getFileById(fileId)`.
     * Recursively retrieve parent folders using `.getParents()`.
     * Identify a folder with a 4-digit name matching the format `"YYMM"` (e.g. `2507` or `2603`).
     * Build and return a relative path string (e.g., `"Skannat / 2507 / kvitto.pdf"`).
   * **Signature**: `function Drive_resolvePathAsynchronously(fileId)`
   * **Return**: `{ success: boolean, path: string, error?: string }`

2. **`Drive_linkReceiptToRow(sheetName, rowNum, fileId)`**
   * **Purpose**: Persist the Google Drive file URL in Column H (column 8) of the targeted spreadsheet row.
   * **Behavior**:
     * Validate `sheetName` via boundary validation and retrieve the sheet.
     * Validate `rowNum` to ensure it is $\ge 9$.
     * Fetch the file URL using `DriveApp.getFileById(fileId).getUrl()`.
     * Set the value of the cell `(rowNum, 8)` to the URL.
     * Update the row's warning/status in Column I (column 9) to reflect that it is "Länkad" or similar.
   * **Signature**: `function Drive_linkReceiptToRow(sheetName, rowNum, fileId)`
   * **Return**: `{ success: boolean, url: string, error?: string }`

3. **`Drive_renameFile(fileId, newName)`**
   * **Purpose**: Rename a receipt on Google Drive to maintain naming consistency.
   * **Signature**: `function Drive_renameFile(fileId, newName)`
   * **Return**: `{ success: boolean, name: string, error?: string }`

4. **`Drive_moveFile(fileId, targetFolderId)`**
   * **Purpose**: Move a file from a temporary inbox/root directory into its respective `YYMM` subdirectory.
   * **Behavior**:
     * Fetch the file and target folder.
     * Add the file to the target folder and remove it from any existing parent folders.
   * **Signature**: `function Drive_moveFile(fileId, targetFolderId)`
   * **Return**: `{ success: boolean, error?: string }`

5. **`Drive_uploadFile(base64Data, fileName, mimeType, folderId)`**
   * **Purpose**: Stream/upload a local file (drag-and-drop or manual upload) directly into a Google Drive folder.
   * **Signature**: `function Drive_uploadFile(base64Data, fileName, mimeType, folderId)`
   * **Return**: `{ success: boolean, fileId: string, url: string, error?: string }`

---

## 2. FRONTEND ARCHITECTURE (src/features/drive/ui/DriveView.html)
This file encapsulates all client-side UI and logic for the **Verifikat** tab, completely decoupled from global structures.

### UI Layout:
* **Active Status Header**: Displays current search context, selected transaction reference, and folder status.
* **Asynchronous Spinner**: Elegant loading feedback when `Drive_resolvePathAsynchronously` is running.
* **File Browser List**: Displays matching files found in the current year/month folder. Includes quick-actions for each file:
  * **Koppla**: Triggers backend linking.
  * **Visa**: Preview file.
  * **Byt namn**: Inline rename input.
* **Drag-and-Drop / Upload Area**: Built-in file drop zone supporting standard and manual file uploads to Google Drive.

### JavaScript State & Handlers:
* **`DriveView_load(tx)`**: Receives the selected transaction object and triggers search.
* **`DriveView_linkFile(fileId)`**: Calls `google.script.run.Drive_linkReceiptToRow`.
* **`DriveView_onUpload(event)`**: Triggers base64 encoding and uploads via `Drive_uploadFile`.

---

## 3. CLIENT-SIDE SERVICE WRAPPER & FALLBACK
To allow seamless local development via `dev-server.js` without active Apps Script execution:

### Service Broker Wrapper:
```javascript
const DriveService = {
  resolvePath: function(fileId, callback) {
    if (typeof google !== "undefined") {
      google.script.run.withSuccessHandler(callback).Drive_resolvePathAsynchronously(fileId);
    } else {
      setTimeout(() => callback({ success: true, path: "Kvitto / 2507 / mock_receipt.pdf" }), 500);
    }
  },
  linkReceipt: function(sheetName, rowNum, fileId, callback) {
    if (typeof google !== "undefined") {
      google.script.run.withSuccessHandler(callback).Drive_linkReceiptToRow(sheetName, rowNum, fileId);
    } else {
      setTimeout(() => callback({ success: true, url: "https://drive.google.com/mock-receipt-url" }), 500);
    }
  }
};
```
This guarantees that UI layouts, styling, drag-and-drop triggers, and responsive states can be thoroughly tested locally.
