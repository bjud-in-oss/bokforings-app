# FEATURE LOGIC: BUNTNING & BATCHING (SIE-4 EXPORT)

## 1. ANSVARSOMRÅDE
Denna modul ansvarar för att läsa transaktionsdata från kalkylbladet (specifikt bladen `'1930'` och `'1630'`), gruppera dem i balanserade verifikationer (bunta), samt erbjuda export till det standardiserade svenska bokföringsformatet **SIE-4**.

---

## 2. DOMÄNREGLER & SPECIFIKA KRAV
1. **Transaktionskällor:**
   - Data läses från de specifika kalkylbladen med namnen `'1930'` och `'1630'`.
   - **Startrad:** Transaktionsdatan i båda bladen börjar alltid på **rad 9** (allt ovanför är sidhuvud/metadatablock).
2. **Brutet Räkenskapsår:**
   - Räkenskapsåret är brutet och löper från **1 juli till 30 juni** (t.ex. 2025-07-01 till 2026-06-30).
3. **Temporär Buntning (Kolumner T, U, V):**
   - När en transaktion "buntas" skapas ett internt `#VER`-block.
   - Information om detta temporära block skrivs direkt till kalkylraden i **kolumnerna T, U och V** (kolumn 20, 21 och 22). 
     - Kolumn T: Temporärt Verifikationsnummer / Batch-ID
     - Kolumn U: Temporär Verifikationsbeskrivning
     - Kolumn V: Temporärt Verifikationsdatum
4. **Verifikationsnummer (Kolumn F) & Bekräftelse:**
   - **V-numret (Kolumn F) tilldelas INTE vid buntning.** Under det temporära buntningsstadiet lämnas Kolumn F helt tom.
   - Först när användaren klickar på **"Bekräfta export"** i gränssnittet slutförs processen:
     - Systemet tilldelar permanenta, sekventiella verifikationsnummer i **Kolumn F** (kolumn 6).
     - De temporära värdena i **kolumnerna T, U och V rensas** helt från kalkylbladet.
5. **Balanskrav:**
   - Varje färdigt verifikat måste balansera exakt (debet minus kredit ska vara noll) innan export tillåts.

---

## 3. FUNKTIONELL SPECIFIKATION (SERVER-SIDE)

* `Batch_getTransactions(sheetName, fiscalYearStart)`: Läser in transaktioner från valt blad (`'1930'` eller `'1630'`) med start på rad 9, filtrerat enligt det brutna räkenskapsåret.
* `Batch_temporaryGroup(rowIndices, batchDesc)`: Skapar ett temporärt `#VER`-block och sparar informationen i kolumnerna T, U, V för de valda raderna.
* `Batch_confirmExportAndFinalize(sheetName, fiscalYearStart)`: Tilldelar permanenta sekventiella verifikationsnummer i Kolumn F för alla buntade rader, rensar kolumnerna T, U, V samt genererar SIE-4 exporten.

---

## 4. PSEUDOKOD (SERVER-SIDE)

```javascript
/**
 * Hämtar transaktionsrader från rad 9 baserat på brutet räkenskapsår.
 * @param {string} sheetName - Antingen '1930' eller '1630'.
 * @param {number} startYear - Startåret för det brutna räkenskapsåret (t.ex. 2025 för 2025-07-01 till 2026-06-30).
 * @return {Array<Object>} List av rader.
 */
function Batch_getTransactions(sheetName, startYear) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Hittade inte bladet: " + sheetName);
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 9) return []; // Inget data ännu
  
  // Läs från rad 9 till sista raden
  const range = sheet.getRange(9, 1, lastRow - 8, sheet.getLastColumn());
  const values = range.getValues();
  const transactions = [];
  
  const startDate = new Date(startYear, 6, 1); // 1 Juli
  const endDate = new Date(startYear + 1, 5, 30, 23, 59, 59); // 30 Juni
  
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowNum = i + 9; // Faktiskt radnummer i Sheets
    const transDate = new Date(row[1]); // Antag datum i kolumn B (index 1)
    
    // Kontrollera om datumet faller inom det brutna räkenskapsåret
    if (transDate >= startDate && transDate <= endDate) {
      transactions.push({
        rowNum: rowNum,
        tempId: row[19],      // Kolumn T (index 19)
        tempDesc: row[20],    // Kolumn U (index 20)
        tempDate: row[21],    // Kolumn V (index 21)
        finalVerNum: row[5],  // Kolumn F (index 5)
        account: row[2],      // Kolumn C (index 2)
        debit: Number(row[3] || 0),   // Kolumn D
        credit: Number(row[4] || 0)   // Kolumn E
      });
    }
  }
  
  return transactions;
}

/**
 * Bekräftar exporten genom att tilldela sekventiella nummer till kolumn F och rensa T, U, V.
 * @param {string} sheetName
 * @param {number} startYear
 */
function Batch_confirmExportAndFinalize(sheetName, startYear) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Bladet saknas.");
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 9) return;
  
  // Hämta nästa tillgängliga permanenta verifikationsnummer från en inställning eller max i kolumn F
  let nextVerNum = Batch_getNextVerificationNumber(sheet);
  
  const rangeTUV = sheet.getRange(9, 20, lastRow - 8, 3); // T, U, V
  const rangeF = sheet.getRange(9, 6, lastRow - 8, 1);    // F
  
  const valuesTUV = rangeTUV.getValues();
  const valuesF = rangeF.getValues();
  
  // Gruppera efter temporärt ID i T för att ge samma V-nummer till rader i samma bunt
  const tempIdToFinalNum = {};
  
  for (let i = 0; i < valuesTUV.length; i++) {
    const tempId = valuesTUV[i][0]; // Kolumn T
    if (tempId) {
      if (!tempIdToFinalNum[tempId]) {
        tempIdToFinalNum[tempId] = nextVerNum;
        nextVerNum++;
      }
      valuesF[i][0] = tempIdToFinalNum[tempId]; // Sätt permanent V-nummer i F
      
      // Rensar temporära värden i T, U, V
      valuesTUV[i][0] = ""; // T
      valuesTUV[i][1] = ""; // U
      valuesTUV[i][2] = ""; // V
    }
  }
  
  // Spara ändringar i kalkylarket i en batch-operation
  rangeF.setValues(valuesF);
  rangeTUV.setValues(valuesTUV);
}
```
