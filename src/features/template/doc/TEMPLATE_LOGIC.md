# FEATURE LOGIC: KONTERING & KONTOMALLAR (TEMPLATE ENGINE)

## 1. ANSVARSOMRÅDE
Denna modul erbjuder ett interaktivt gränssnitt för att dynamiskt kontera och skapa nya verifikat. Den tillhandahåller även smart automatisk kontering mot kalkylarkets inbyggda kontoplan samt färdiga konteringsmallar med inbyggt stöd för momsdetektering och extern löneimport.

---

## 2. DOMÄNREGLER & SPECIFIKA KRAV

### A. Momsdetektering (Moms-radar för Konto 2641)
* **Regel:** Om ett konteringsförslag eller en transaktionsrad innehåller konto **2641** (ingående moms), ska systemets "Moms-radar" aktiveras.
* **Logik:** Systemet beräknar mellanskillnaden mellan Debet och Kredit (`Debet - Kredit`) för just denna rad och sparar automatiskt detta beräknade momsvärde i **Kolumn Q** (index 17, dvs. kolumnen för momsbelopp).

### B. Dynamisk Import av Lönespecifikationer (Kolumn H)
* **Regel:** Systemet övervakar den länkade filen i **Kolumn H** (dokumentlänken).
* **Logik:**
  - Om länken i Kolumn H leder till ett externt **Google Kalkylark (spreadsheet)**, ska systemet **INTE** visa den standardiserade verifikationsmallen.
  - Istället ska backend öppna det externa kalkylarket, hämta data från fliken namngiven **'Lön'** inom cellområdet **`B9:F70`**, och parsa detta direkt som en lönespecifikation för att generera färdiga konteringsförslag (lön, skatt, arbetsgivaravgifter).

---

## 3. FUNKTIONELL SPECIFIKATION (SERVER-SIDE)

* `Template_getAccountPlan()`: Hämtar tillgängliga konton från bladet "Kontoplan" i det aktiva dokumentet.
* `Template_parseExternalPayslip(spreadsheetUrl)`: Öppnar det externa kalkylarket via URL/ID, läser tabellen `'Lön'!B9:F70` och strukturerar datan till ett färdigt bokföringsunderlag för löner.
* `Template_saveJournalEntryWithVat(entry, sheetName)`: Sparar konteringsraderna sekventiellt till målbladet, och skriver automatiskt differensen till Kolumn Q om konto 2641 detekteras.

---

## 4. PSEUDOKOD (SERVER-SIDE)

```javascript
/**
 * Kontrollerar rader och sparar dem, med momsberäkning till Kolumn Q (index 17) för konto 2641.
 * @param {Object} entry - Innehåller rows, date, desc etc.
 * @param {string} sheetName - t.ex. '1930' eller '1630'.
 */
function Template_saveJournalEntryWithVat(entry, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Bladet saknas.");
  
  const lastRow = sheet.getLastRow();
  const targetRow = lastRow + 1;
  
  entry.rows.forEach((row, idx) => {
    const currentRowNum = targetRow + idx;
    
    // Standardfält
    sheet.getRange(currentRowNum, 2).setValue(entry.date); // Kolumn B
    sheet.getRange(currentRowNum, 3).setValue(entry.desc); // Kolumn C
    sheet.getRange(currentRowNum, 4).setValue(row.account); // Kolumn D
    sheet.getRange(currentRowNum, 5).setValue(Number(row.debit || 0)); // Kolumn E
    sheet.getRange(currentRowNum, 6).setValue(Number(row.credit || 0)); // Kolumn F
    
    // MOMS-RADAR: Om kontot är 2641, spara debet - kredit i Kolumn Q (kolumn 17)
    if (row.account === "2641") {
      const vatDifference = Number(row.debit || 0) - Number(row.credit || 0);
      sheet.getRange(currentRowNum, 17).setValue(vatDifference); // Kolumn Q (index 17)
    }
  });
}

/**
 * Parsar en extern lönespecifikation om länken i Kolumn H är ett Google Kalkylark.
 * @param {string} spreadsheetUrl - URL till det externa lönekalkylarket.
 * @return {Array<Object>} Konteringsrader skapade utifrån lönespecifikationen.
 */
function Template_parseExternalPayslip(spreadsheetUrl) {
  try {
    const extSs = SpreadsheetApp.openByUrl(spreadsheetUrl);
    const lonSheet = extSs.getSheetByName("Lön");
    if (!lonSheet) {
      throw new Error("Kunde inte hitta fliken 'Lön' i det länkade kalkylarket.");
    }
    
    // Hämta cellområdet B9:F70
    const values = lonSheet.getRange("B9:F70").getValues();
    const suggestedJournalRows = [];
    
    // Iterera över löneraderna och parsa konton och belopp
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const accountCode = row[0]; // Kolumn B i ursprungliga fliken
      const accountName = row[1]; // Kolumn C
      const debitValue = Number(row[3] || 0);  // Kolumn E
      const creditValue = Number(row[4] || 0); // Kolumn F
      
      if (accountCode && (debitValue > 0 || creditValue > 0)) {
        suggestedJournalRows.push({
          account: accountCode.toString(),
          name: accountName,
          debit: debitValue,
          credit: creditValue
        });
      }
    }
    
    return suggestedJournalRows;
  } catch (err) {
    throw new Error("Löneimport misslyckades: " + err.message);
  }
}
```
