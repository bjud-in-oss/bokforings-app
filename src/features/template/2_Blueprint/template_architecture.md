# ARCHITECTURE BLUEPRINT: TEMPLATE ENGINE & JOURNALING

This document outlines the system architecture for the domain-driven Template Engine, providing an interactive, auto-calculating, and formula-safe journaling interface.

---

## 1. BACKEND ARCHITECTURE (src/features/template/TemplateEngine.js)
The template engine acts as a bridge between the frontend and the hidden, formula-driven spreadsheet calculations.

### Functions Specification:

1. **`Template_loadTemplateForTransaction(sheetName, rowNum, categoryName)`**
   * **Purpose**: Clear existing search cursors, write `?` to F and category to A1, flush spreadsheet calculations, and extract generated Debet/Kredit values from `A3:D6`.
   * **Behavior**:
     * Validate `sheetName` ("1930" or "1630") and `rowNum` ($\ge 9$).
     * Get sheet reference `sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName)`.
     * **F-column Cleanliness**: Scan Column F (from row 9 to lastRow) and clear any cells containing `?`.
     * Set Column F, Row `rowNum` to `?`.
     * Set Cell `A1` to `categoryName`.
     * **Forced Synchronisation**: Call `SpreadsheetApp.flush()` to force the spreadsheet formula engine to calculate `A3:D6` based on the newly selected transaction and category.
     * Retrieve the matrix values from `A3:D6`.
     * **Moms-Radar Detection**: Scan the extracted rows. If account `2641` (Ingående moms) is present, compute `momsAmount = Debet - Kredit` to be cached for saving.
     * Return the populated rows.
   * **Signature**: `function Template_loadTemplateForTransaction(sheetName, rowNum, categoryName)`
   * **Return**: `{ success: boolean, rows: Array<{ account: string, name: string, debet: number, kredit: number }>, momsAmount: number, error?: string }`

2. **`Template_saveJournalEntry(sheetName, rowNum, categoryName, finalRows, momsAmount)`**
   * **Purpose**: Persist the final balanced journal entry to the spreadsheet, updating Column F and writing optional moms.
   * **Behavior**:
     * Write final `categoryName` to Column F (replaces the search cursor `?`).
     * If `momsAmount > 0`, save this to Column Q (column 17) of the transaction row.
     * Return success.
   * **Signature**: `function Template_saveJournalEntry(sheetName, rowNum, categoryName, finalRows, momsAmount)`
   * **Return**: `{ success: boolean, error?: string }`

3. **`Template_parseSalarySpecification(externalSpreadsheetUrl)`**
   * **Purpose**: Scan and parse external payroll files to map employee net salaries, tax withholdings, and employer contributions.
   * **Behavior**:
     * Use regex to extract the Spreadsheet ID: `/spreadsheets/d/([a-zA-Z0-9-_]+)/`.
     * Open the sheet via `SpreadsheetApp.openById(spreadsheetId)`.
     * Read the `'Lön'` tab, cell range `B9:F70`.
     * Accumulate salaries (7010), taxes (2710), social fees (2730) into structured journal rows.
   * **Signature**: `function Template_parseSalarySpecification(externalSpreadsheetUrl)`
   * **Return**: `{ success: boolean, rows: Array<{ account: string, name: string, debet: number, kredit: number }>, error?: string }`

---

## 2. FRONTEND ARCHITECTURE (src/features/template/ui/TemplateView.html)
This component encapsulates the entire journaling panel, replacing the `#tab-journal` placeholder in `AppShell.html`.

### UI Components:
* **Category Selector**: A clean dropdown (`<select>`) loaded with standard templates (e.g., `_Hyra`, `_Mobil`, `_Lön`, `_Försäljning`).
* **Interactive Ledger Table**:
  * Fields: `Konto` (read-only), `Kontonamn` (read-only), `Debet` (editable input), `Kredit` (editable input).
  * Auto-append new empty rows for manual split journal additions.
* **Real-time Balance Calculator**:
  * Live display of `Total Debet`, `Total Kredit`, and `Differens`.
* **The Balancing Barrier (Buntningsspärr)**:
  * If `Differens !== 0`, the "Bunta & Spara" button is fully disabled (`disabled`), accompanied by a clear red text warning: `⚠️ Journalposten måste balansera (Differens: X kr)`.
  * If `Differens === 0`, the button is enabled and styled with success emerald colors.

---

## 3. CLIENT-SIDE SERVICE WRAPPER & FALLBACK
To maintain 100% locally testable and styled elements on `dev-server.js`:

```javascript
const TemplateService = {
  loadTemplate: function(sheetName, rowNum, categoryName, callback) {
    if (typeof google !== "undefined" && google.script && google.script.run) {
      google.script.run.withSuccessHandler(callback).Template_loadTemplateForTransaction(sheetName, rowNum, categoryName);
    } else {
      // Mocked formula-driven output
      setTimeout(() => {
        let rows = [
          { account: "1930", name: "Företagskonto", debet: 0, kredit: 1250 },
          { account: "4000", name: "Varuinköp", debet: 1000, kredit: 0 },
          { account: "2641", name: "Ingående moms (25%)", debet: 250, kredit: 0 }
        ];
        callback({ success: true, rows: rows, momsAmount: 250 });
      }, 600);
    }
  },
  saveJournal: function(sheetName, rowNum, categoryName, finalRows, momsAmount, callback) {
    if (typeof google !== "undefined" && google.script && google.script.run) {
      google.script.run.withSuccessHandler(callback).Template_saveJournalEntry(sheetName, rowNum, categoryName, finalRows, momsAmount);
    } else {
      setTimeout(() => callback({ success: true }), 400);
    }
  }
};
```
