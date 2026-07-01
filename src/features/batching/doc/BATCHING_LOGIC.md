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

5. **Startlogik (Smart rad-detektering):**
   - Funktionen `Batch_getInitialState` körs vid app-start för att hitta vilket blad som är aktivt och vilken rad appen ska fokusera på.
   - **Söksekvens:**
     - Den söker först igenom **Kolumn F** efter en cell som innehåller **exakt 1 tecken** (t.ex. ett `'x'`), vilket fungerar som en flagga för en rad användaren vill arbeta på.
     - Om ingen sådan cell hittas, faller systemet tillbaka på att använda kalkylarkets för tillfället valda aktiva cell (`SpreadsheetApp.getActiveRange()`).
     - **Säkerhetsspärr:** Den lägsta tillåtna fokuserade raden är alltid **rad 9**. Om en cell ovanför rad 9 är markerad, tvingas fokus till rad 9.

6. **Avbuntning (Unbatching):**
   - Om en användare ångrar en gjord buntning (innan permanent export har bekräftats), ska systemet tillhandahålla funktionen `Batch_unbatchRow(sheetName, rowNum)`.
   - Denna rensar omedelbart de temporära värdena i **Kolumn T, U och V** för den specifika raden så att den kan buntas om eller korrigeras.

7. **Balanskrav:**
   - Varje färdigt verifikat måste balansera exakt (debet minus kredit ska vara noll) innan export tillåts.

---

## 3. FUNKTIONELL SPECIFIKATION (SERVER-SIDE)

* `Batch_getInitialState()`: Detekterar det aktiva bladet samt den aktiva raden (baserat på 'x'-flagga eller aktiv cell, minimum rad 9).
* `Batch_getTransactions(sheetName, fiscalYearStart)`: Läser in transaktioner från valt blad (`'1930'` eller `'1630'`) med start på rad 9, filtrerat enligt det brutna räkenskapsåret.
* `Batch_temporaryGroup(rowIndices, batchDesc)`: Skapar ett temporärt `#VER`-block och sparar informationen i kolumnerna T, U, V för de valda raderna.
* `Batch_unbatchRow(sheetName, rowNum)`: Rensar kolumn T, U och V på angiven rad.
* `Batch_getAccountBalance(sheetName)`: Summerar kolumnerna för in- och utbetalningar på det aktiva bladet (börjar på rad 9) och returnerar ett summerat nettosaldo (Debet - Kredit) till gränssnittet i realtid.
* `Batch_confirmExportAndFinalize(sheetName, fiscalYearStart)`: Tilldelar permanenta sekventiella verifikationsnummer i Kolumn F för alla buntade rader, rensar kolumnerna T, U, V samt genererar SIE-4 exporten.

---

## 4. PSEUDOKOD (SERVER-SIDE)

```javascript
/**
 * Identifierar ursprungstillstånd för appen och hittar den bästa startraden (minst rad 9).
 * Söker i Kolumn F efter ett tecken med längd 1, t.ex 'x', annars används den aktiva cellen.
 * @return {Object} { sheet: string, activeRow: number, year: string }
 */
function Batch_getInitialState() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  let sheetName = activeSheet.getName();
  
  // Tillåt endast 1930 eller 1630 som giltiga bokföringsblad, fall tillbaka på 1930
  if (sheetName !== "1930" && sheetName !== "1630") {
    sheetName = "1930";
  }
  
  const targetSheet = ss.getSheetByName(sheetName);
  const lastRow = targetSheet.getLastRow();
  let selectedRow = 9; // Standard fallback
  
  // Sök efter 'x' (eller annat singeltecken) i Kolumn F (kolumn 6)
  let foundFlag = false;
  if (lastRow >= 9) {
    const fValues = targetSheet.getRange(9, 6, lastRow - 8, 1).getValues();
    for (let i = 0; i < fValues.length; i++) {
      const cellValue = String(fValues[i][0]).trim();
      if (cellValue.length === 1) {
        selectedRow = i + 9;
        foundFlag = true;
        break;
      }
    }
  }
  
  // Fallback: Använd kalkylarkets aktiva cell
  if (!foundFlag) {
    const activeRange = ss.getActiveRange();
    if (activeRange) {
      selectedRow = activeRange.getRow();
    }
  }
  
  // Säkerhetsspärr: Lägst rad 9
  if (selectedRow < 9) {
    selectedRow = 9;
  }
  
  // Standardår (t.ex. 2025 för brutet år 2025-07-01 till 2026-06-30)
  const currentYear = new Date().getFullYear();
  
  return {
    sheet: sheetName,
    activeRow: selectedRow,
    year: currentYear.toString()
  };
}

/**
 * Rensar de temporära kolumnerna T, U, V för en rad om användaren ångrar en buntning.
 * @param {string} sheetName - Namnet på bladet ('1930' eller '1630').
 * @param {number} rowNum - Raden som ska återställas.
 */
function Batch_unbatchRow(sheetName, rowNum) {
  if (rowNum < 9) throw new Error("Ogiltigt radnummer.");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Bladet saknas: " + sheetName);
  
  // T, U, V är kolumn 20, 21, 22
  const rangeTUV = sheet.getRange(rowNum, 20, 1, 3);
  rangeTUV.clearContent();
}

/**
 * Beräknar det aktuella summerade saldot för det valda kalkylbladet från rad 9.
 * @param {string} sheetName - Namnet på bladet ('1930' eller '1630').
 * @return {number} Det beräknade nettosaldot (Debet - Kredit).
 */
function Batch_getAccountBalance(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Bladet saknas: " + sheetName);
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 9) return 0;
  
  // Läs debet (Kolumn D / index 4) och kredit (Kolumn E / index 5)
  const debitValues = sheet.getRange(9, 4, lastRow - 8, 1).getValues();
  const creditValues = sheet.getRange(9, 5, lastRow - 8, 1).getValues();
  
  let balance = 0;
  for (let i = 0; i < debitValues.length; i++) {
    const debit = Number(debitValues[i][0] || 0);
    const credit = Number(creditValues[i][0] || 0);
    balance += (debit - credit);
  }
  
  return balance;
}
```
