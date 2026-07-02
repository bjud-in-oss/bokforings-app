# FEATURE LOGIC: DATAIMPORT & SKARV-SÄKERHET (IMPORT ENGINE)

## 1. ANSVARSOMRÅDE
Denna modul ansvarar för säker import av råtransaktioner från banken (företagskonto 1930) och Skatteverket (skattekonto 1630). Den erbjuder klistra-in-funktionalitet i gränssnittet och utför strikt matematisk validering av ingående saldon för att helt förhindra glipor eller dubbelimport i kalkylarket.

---

## 2. DATAFLÖDE & IMPORTZONER

Användaren kan klistra in rå CSV/TSV-data direkt i UI:t. Backend tolkar raderna och placerar dem i rådatazonerna:

* **Blad '1930':** Rådata skrivs direkt till kolumn **J:P**, med start på nästa lediga rad efter den sista befintliga transaktionen.
* **Blad '1630':** Rådata skrivs direkt till kolumn **J:M**, med start på nästa lediga rad.

---

## 3. KRITISK LOGIK: SKARV-SÄKERHET (SEAM SECURITY)

Ett vanligt fel vid automatiserad eller manuell transaktionsimport är rader som saknas eller dubbelimporteras på grund av att datum överlappar (flera transaktioner sker samma dag).

### Algoritm för skarvsäker validering:
1. **Läs sista radens saldo:** Innan import sker läser backend det sista bokförda saldot i kalkylarket från kolumn **E** (Bokfört saldo, raden precis före den nya import-positionen).
2. **Läs ingående saldo i ny rådata:** Backend parsar den nya rådatan och lokaliserar det ingående saldot på den tidigaste transaktionsraden.
3. **Matematisk matchning:** Det ingående saldot i den nya rådatan *minus* beloppet på den första raden måste exakt matcha det sista kända bokförda saldot i kalkylarket (eller motsvarande matematisk relation beroende på bankens sorteringsordning: fallande eller stigande).
4. **Blockerings-regel:** Om saldot i skarven diffar med så mycket som en enda krona eller ett öre:
   - **Importen blockeras omedelbart.** Inga rader får skrivas till kalkylarket.
   - En tydlig **röd flagga/varningsbanner** ska visas i UI.
   - Användaren måste uppmanas till manuell granskning (t.ex. kontrollera om banken har ändrat sorteringsordningen, eller om en tidigare export missats).

---

## 4. FUNCTIONAL SPECIFICATION (SERVER-SIDE)

* `Import_validateAndInsertRawData(sheetName, rawRows)`: Parsar inklistrad rådata, kör skarvsäkerhetskontrollen mot det sista saldot i kolumn E, och klistrar in datan i J:P/J:M om valideringen godkänns.

---

## 5. PSEUDOKOD (SERVER-SIDE)

```javascript
/**
 * Validerar skarven och sparar den nya rådatan.
 * @param {string} sheetName - '1930' eller '1630'
 * @param {Array<Array>} rawData - Matris med parsad rådata från UI
 */
function Import_validateAndInsertRawData(sheetName, rawData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Bladet saknas: " + sheetName);
  
  const lastRow = sheet.getLastRow();
  
  // 1. Hämta sista kända bokförda saldo (Kolumn E / index 5)
  let lastRecordedBalance = 0;
  if (lastRow >= 9) {
    lastRecordedBalance = Number(sheet.getRange(lastRow, 5).getValue() || 0);
  } else {
    // Om bladet är helt tomt, tillåt import utan skarvkontroll (eller kräv manuellt ingående saldo)
    lastRecordedBalance = null;
  }
  
  if (lastRecordedBalance !== null && rawData.length > 0) {
    // Sortera den inkommande rådatan så att vi analyserar den kronologiskt (äldst först)
    // För '1930' antar vi att J:P matas in. Kolumn P (index 6 i rådatan) innehåller löpande saldo.
    // Kolumn O (index 5) innehåller transaktionsbeloppet.
    
    const firstImportRow = rawData[0];
    const importAmount = Number(firstImportRow[5] || 0); // Exempelindex för belopp i rådata
    const importBalance = Number(firstImportRow[6] || 0); // Exempelindex för saldo i rådata
    
    // Beräkna ingående saldo för den första raden i importen
    const calculatedIngoingBalance = importBalance - importAmount;
    
    // Tolerans för öresavrundning (0.01 kr)
    const diff = Math.abs(calculatedIngoingBalance - lastRecordedBalance);
    if (diff > 0.01) {
      throw new Error(
        "IMPORT BLOCKERAD (Skarv-avvikelse): Det förväntade ingående saldot (" + 
        calculatedIngoingBalance.toFixed(2) + " kr) matchar inte kalkylarkets sista bokförda saldo (" + 
        lastRecordedBalance.toFixed(2) + " kr). Vänligen kontrollera transaktionsordningen."
      );
    }
  }
  
  // 2. Skriv rådata till importzonen (Kolumn J och framåt)
  const startWriteRow = lastRow + 1;
  const numRows = rawData.length;
  const numCols = rawData[0].length;
  
  // J är kolumn 10
  sheet.getRange(startWriteRow, 10, numRows, numCols).setValues(rawData);
  
  return {
    success: true,
    insertedRows: numRows,
    newBalance: sheet.getRange(sheet.getLastRow(), 5).getValue()
  };
}
```
