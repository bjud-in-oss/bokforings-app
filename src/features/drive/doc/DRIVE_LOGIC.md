# FEATURE LOGIC: VERIFIKAT & DRIVE INTEGRATION

## 1. ANSVARSOMRÅDE
Denna modul hanterar kopplingen mellan transaktionsrader och digitala kvitton lagrade på Google Drive. Den erbjuder asynkron sökning, länkning, samt asynkrona filoperationer och sökvägs-upplösning för att underlätta hantering av underlag direkt från gränssnittet.

---

## 2. DOMÄNREGLER & SPECIFIKA KRAV

### A. Asynkron Sökvägs-upplösning (Upward Hierarchy Traversal)
* **Funktion:** `Drive_resolvePathAsynchronously(fileId)`
* **Regel:** Funktionen tar ett fil-ID som indata, hämtar Drive-filen och traverserar **UPPÅT** (genom föräldramapparna) i katalogstrukturen tills den hittar en mapp vars namn består av exakt **fyra siffror** (vilket representerar år och månad, t.ex. `2507` för juli 2025).
* **Returvärde:** Den bygger och returnerar en formaterad sökvägssträng som representerar strukturen från den hittade ÅÅMM-mappen och nedåt till själva filen.
  - *Exempel:* Om filen `kvitto_hyra.pdf` ligger i `Bokföring/2507/Fakturor/kvitto_hyra.pdf`, ska funktionen stanna vid `2507` och returnera `'2507/Fakturor/kvitto_hyra.pdf'`.

### B. Optimal Lazy Loading & Detaljerad filvisning
* För att garantera snabba svarstider laddas filinformationen asynkront (on-demand) först när en rad expanderas eller klickas i klientsidan.

### C. Avancerade filoperationer i gränssnittet
Utöver att läsa och länka filer till rader, tillåter systemet filhantering direkt från 'Verifikat'-fliken i gränssnittet genom följande backend-operationer:
1. **Byta namn (`Drive_renameFile`):** Användaren kan döpa om filer för att upprätthålla namnsättningsstandarder.
2. **Klipp & Klistra (`Drive_moveFile`):** Flyttar en fil till en annan målkatalog.
3. **Direktuppladdning (`Drive_uploadFile`):** Användaren kan ladda upp kvitton direkt via webbläsaren. Eftersom Apps Script inte stödjer multipart/form-data på standardvis, konverteras filerna till **Base64** på klientsidan och skickas som en sträng till backend.

---

## 3. FUNKTIONELL SPECIFIKATION (SERVER-SIDE)

* `Drive_resolvePathAsynchronously(fileId)`: Traverserar uppåt i Drive-mappstrukturen för att hitta mappen med fyra siffror (`YYMM`), och bygger den relativa sökvägen.
* `Drive_linkReceiptToRow(sheetName, rowNum, fileId)`: Sparar filens fullständiga Google Drive-URL i **Kolumn H** (kolumn 8) för angiven rad i det valda kalkylbladet.
* `Drive_renameFile(fileId, newName)`: Döper om en specifik fil på Google Drive.
* `Drive_moveFile(fileId, targetFolderId)`: Flyttar en fil från sin nuvarande mapp till en ny målmapp.
* `Drive_uploadFile(base64Data, fileName, mimeType, folderId)`: Skapar en ny fil i angiven mapp på Google Drive baserat på base64-data.

---

## 4. PSEUDOKOD (SERVER-SIDE)

```javascript
/**
 * Löser filens sökväg asynkront genom att traversera uppåt i föräldramapparna.
 * Söker efter en mapp med exakt fyra siffror i namnet (YYMM, t.ex. "2507").
 * @param {string} fileId - ID för filen i Google Drive.
 * @return {string} Relativ formaterad sökväg (t.ex. "2507/undermapp/filnamn.pdf").
 */
function Drive_resolvePathAsynchronously(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const fileName = file.getName();
    const pathParts = [fileName];
    
    let currentItem = file;
    let foundYearMonthFolder = false;
    
    // Traversera uppåt i katalogstrukturen
    while (!foundYearMonthFolder) {
      const parents = currentItem.getParents();
      
      if (!parents.hasNext()) {
        // Vi nådde roten utan att hitta en 4-siffrig mapp
        break;
      }
      
      const parentFolder = parents.next();
      const parentName = parentFolder.getName();
      pathParts.unshift(parentName); // Lägg till överst i sökvägen
      
      // Kontrollera om mappen består av exakt 4 siffror (t.ex. "2507")
      const isFourDigits = /^\d{4}$/.test(parentName);
      if (isFourDigits) {
        foundYearMonthFolder = true;
        break; // Avsluta loop
      }
      
      currentItem = parentFolder;
    }
    
    if (foundYearMonthFolder) {
      return pathParts.join("/");
    } else {
      return "Osorterat/" + fileName;
    }
  } catch (err) {
    throw new Error("Kunde inte lösa sökvägen asynkront: " + err.message);
  }
}

/**
 * Sparar en fil-länk i Kolumn H (kolumn 8) på den angivna transaktionsraden.
 * @param {string} sheetName - Namnet på bladet ('1930' eller '1630').
 * @param {number} rowNum - Radnumret (minst rad 9).
 * @param {string} fileId - ID för filen.
 * @return {string} Den sparade länken.
 */
function Drive_linkReceiptToRow(sheetName, rowNum, fileId) {
  if (rowNum < 9) throw new Error("Ogiltigt radnummer. Bokföringsdata börjar på rad 9.");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Hittade inte bladet " + sheetName);
  
  const file = DriveApp.getFileById(fileId);
  const fileUrl = file.getUrl();
  
  // Spara URL i Kolumn H (kolumn 8)
  const RECEIPT_COLUMN = 8;
  sheet.getRange(rowNum, RECEIPT_COLUMN).setValue(fileUrl);
  
  return fileUrl;
}

/**
 * Döper om en fil på Google Drive.
 * @param {string} fileId
 * @param {string} newName
 */
function Drive_renameFile(fileId, newName) {
  const file = DriveApp.getFileById(fileId);
  file.setName(newName);
}

/**
 * Flyttar en fil till en ny målmapp.
 * @param {string} fileId
 * @param {string} targetFolderId
 */
function Drive_moveFile(fileId, targetFolderId) {
  const file = DriveApp.getFileById(fileId);
  const targetFolder = DriveApp.getFolderById(targetFolderId);
  
  // Hämta befintliga föräldrar och ta bort filen från dem
  const parents = file.getParents();
  while (parents.hasNext()) {
    const parent = parents.next();
    parent.removeFile(file);
  }
  
  // Lägg till i den nya målmappen
  targetFolder.addFile(file);
}

/**
 * Tar emot Base64-kodad fil från klientsidan och sparar den i en Drive-mapp.
 * @param {string} base64Data - Base64-sträng.
 * @param {string} fileName - Filnamn.
 * @param {string} mimeType - MIME-typ (t.g. application/pdf).
 * @param {string} folderId - Målmappens ID på Drive.
 * @return {Object} Metadata för den sparade filen.
 */
function Drive_uploadFile(base64Data, fileName, mimeType, folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const decodedBytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
    const file = folder.createFile(blob);
    
    return {
      id: file.getId(),
      name: file.getName(),
      url: file.getUrl()
    };
  } catch (err) {
    throw new Error("Filuppladdning misslyckades: " + err.message);
  }
}
```
