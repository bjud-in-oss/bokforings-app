# FEATURE LOGIC: VERIFIKAT & DRIVE INTEGRATION

## 1. ANSVARSOMRÅDE
Denna modul hanterar kopplingen mellan fysiska verifikat (kvitton/fakturor sparade på Google Drive) och bokföringsraderna i kalkylbladet. Den tillhandahåller funktioner för att söka, lista och knyta dokumentlänkar till specifika transaktionsrader med optimal prestanda genom asynkron latladdning ("lazy loading").

---

## 2. DOMÄNREGLER
1. **Drive-koppling:**
   - Varje verifikatrad i kalkylbladet kan ha en tillhörande Google Drive-länk (URL till förhandsvisning eller nedladdning).
   - Användaren ska kunna öppna kvittot direkt från kalkylarket eller gränssnittet.
2. **Asynkron Latladdning (Lazy Loading):**
   - Hämta aldrig metadata för hundratals Drive-filer samtidigt vid initialisering. Detta orsakar time-outs i Google Apps Script och fördröjer renderingen av gränssnittet.
   - Hämta kvittoförhandsvisningar eller filnamn asynkront först när en specifik rad expanderas eller väljs i gränssnittet.
3. **Mappstruktur på Drive:**
   - Appen bör automatiskt leta efter en specifik undermapp (t.ex. "Bokföring Kvitton") eller tillåta användaren att välja källmapp via en inbäddad filväljare (Google Picker).

---

## 3. FUNKTIONELL SPECIFIKATION

### Server-side (`FilePicker.js`)
* `Drive_getReceiptFolderFiles()`: Hämtar en begränsad lista av nyligen uppladdade kvitton/filer från Google Drive för snabbkoppling.
* `Drive_linkReceiptToRow(rowNum, fileId)`: Skriver Drive-länken till den specifika kolumnen för angiven rad i kalkylbladet och returnerar den formaterade länken.
* `Drive_getFileMetadata(fileId)`: Hämtar detaljerad metadata (namn, förhandsvisningsbild, storlek) för en enskild fil vid behov (on-demand).

### Client-side UI (`src/ui/` integrerat)
* **Kvitto-indikator:** Visar en ikon brevid transaktioner som har ett kopplat kvitto.
* **Flytande förhandsvisning (Lazy Preview):** När användaren klickar på kvitto-ikonen, anropas `Drive_getFileMetadata` asynkront för att hämta och visa en tumnagelbild direkt i applikationen utan att ladda om hela sidan.
* **Filväljar-modal:** En modal som låter användaren bläddra bland nyligen uppladdade filer på Drive och koppla dem till den valda transaktionsraden med ett klick.

---

## 4. PSEUDOKOD (SERVER-SIDE)

```javascript
/**
 * Hämtar nyligen uppladdade filer från en specifik kvitto-mapp i Google Drive.
 * @return {Array<Object>} Lista med filnamn och id-nummer.
 */
function Drive_getReceiptFolderFiles() {
  const FOLDER_NAME = "Bokföring Kvitton";
  let folder;
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    // Om mappen inte finns, skapa den i roten för att underlätta för användaren
    folder = DriveApp.createFolder(FOLDER_NAME);
  }
  
  const files = folder.getFiles();
  const fileList = [];
  let count = 0;
  
  // Begränsa till de 50 senaste filerna för att garantera snabb svarstid
  while (files.hasNext() && count < 50) {
    const file = files.next();
    fileList.push({
      id: file.getId(),
      name: file.getName(),
      url: file.getUrl(),
      created: file.getDateCreated().getTime()
    });
    count++;
  }
  
  // Sortera efter senaste först
  return fileList.sort((a, b) => b.created - a.created);
}

/**
 * Kopplar en Drive-fil till en specifik rad i kalkylbladet.
 * @param {number} rowNum - Radnumret i kalkylarket som ska uppdateras.
 * @param {string} fileId - Unikt ID för Google Drive-filen.
 * @return {string} Den sparade länkadressen.
 */
function Drive_linkReceiptToRow(rowNum, fileId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Verifikationer");
  if (!sheet) {
    throw new Error("Hittade inte bladet 'Verifikationer'.");
  }
  
  const file = DriveApp.getFileById(fileId);
  const fileUrl = file.getUrl();
  
  // Antag att kolumn G (index 7) är kolumnen för kvitto-länkar
  const RECEIPT_COLUMN = 7;
  sheet.getRange(rowNum, RECEIPT_COLUMN).setValue(fileUrl);
  
  return fileUrl;
}

/**
 * Hämtar metadata för en enskild fil på ett lazy-loaded sätt.
 * @param {string} fileId - Fil-ID att hämta detaljer för.
 * @return {Object} Metadata och tumnagel (om tillgängligt).
 */
function Drive_getFileMetadata(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    return {
      id: fileId,
      name: file.getName(),
      size: file.getSize(),
      mimeType: file.getMimeType(),
      downloadUrl: file.getDownloadUrl(),
      viewerUrl: file.getUrl()
    };
  } catch (error) {
    throw new Error("Kunde inte hämta filens metadata. Kontrollera behörigheter: " + error.message);
  }
}
```
