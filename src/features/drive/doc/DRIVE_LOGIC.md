# FEATURE LOGIC: VERIFIKAT & DRIVE INTEGRATION

## 1. ANSVARSOMRÅDE
Denna modul hanterar kopplingen mellan transaktionsrader och digitala kvitton lagrade på Google Drive. Den erbjuder asynkron sökning, länkning, samt asynkron sökvägs-upplösning för att navigera och strukturera underlag i Drive-mappar.

---

## 2. DOMÄNREGLER & SPECIFIKA KRAV

### A. Asynkron Sökvägs-upplösning (Upward Hierarchy Traversal)
* **Funktion:** `Drive_resolvePathAsynchronously(fileId)`
* **Regel:** Funktionen ska ta ett fil-ID som indata, hämta Drive-filen och traversera **UPPÅT** (genom föräldramapparna) i katalogstrukturen tills den hittar en mapp vars namn består av exakt **fyra siffror** (vilket representerar år och månad, t.ex. `2507` för juli 2025).
* **Returvärde:** Den ska bygga och returnera en formaterad sökvägssträng som representerar strukturen från den hittade ÅÅMM-mappen och nedåt till själva filen.
  - *Exempel:* Om filen `kvitto_hyra.pdf` ligger i `Bokföring/2507/Fakturor/kvitto_hyra.pdf`, ska funktionen stanna vid `2507` och returnera `'2507/Fakturor/kvitto_hyra.pdf'`.

### B. Optimal Lazy Loading
* För att garantera snabba svarstider hämtas endast fil-ID och länk initialt. Detaljerade filnamn eller sökvägar beräknas via asynkrona anrop först när de efterfrågas på klientsidan (Lazy Loading).

---

## 3. FUNKTIONELL SPECIFIKATION (SERVER-SIDE)

* `Drive_resolvePathAsynchronously(fileId)`: Traverserar uppåt i Drive-mappstrukturen för att hitta mappen med fyra siffror (`YYMM`), och bygger den relativa sökvägen.
* `Drive_linkReceiptToRow(sheetName, rowNum, fileId)`: Sparar filens URL i kolumn H (eller motsvarande kvitto-kolumn) på angiven rad.

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
    
    // Om vi hittade ÅÅMM-mappen, returnera den sammansatta sökvägen
    // Annars returnerar vi en standard fallbacksökväg eller bara filnamnet
    if (foundYearMonthFolder) {
      return pathParts.join("/");
    } else {
      return "Osorterat/" + fileName;
    }
    
  } catch (err) {
    throw new Error("Kunde inte lösa sökvägen asynkront: " + err.message);
  }
}
```
