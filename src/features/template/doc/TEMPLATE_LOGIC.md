# FEATURE LOGIC: KONTERING & KONTOMALLAR (TEMPLATE ENGINE)

## 1. ANSVARSOMRÅDE
Denna modul erbjuder ett interaktivt gränssnitt för att dynamiskt skapa nya verifikat och rader i kalkylbladet. Den tillhandahåller även smart automatisk kontering mot kalkylarkets inbyggda kontoplan samt färdiga konteringsmallar (t.ex. för återkommande händelser som hyra, mobilfaktura, etc.).

---

## 2. DOMÄNREGLER
1. **Dynamisk radtilldelning:**
   - Gränssnittet tillåter användaren att dynamiskt lägga till, flytta eller ta bort rader i en pågående verifikation innan den sparas till kalkylbladet.
2. **Autofyll & Sök mot Kontoplan:**
   - När användaren påbörjar inmatning av ett kontonummer (eller kontonamn) ska systemet automatiskt söka mot kalkylarkets kontoplan och föreslå matchningar.
3. **Konteringsmallar:**
   - Sparade mallar ska definiera vilka konton som ska debiteras och krediteras för en viss typ av transaktion.
   - När en mall väljs ska det nya verifikationsformuläret förhandskonteras automatiskt, så att användaren endast behöver mata in belopp och datum.

---

## 3. FUNKTIONELL SPECIFIKATION

### Server-side (`TemplateEngine.js`)
* `Template_getAccountPlan()`: Hämtar hela listan med konton (nummer + namn) från bladet "Kontoplan" i det aktiva kalkylarket.
* `Template_getTemplates()`: Hämtar tillgängliga bokföringsmallar (t.ex. "Inköp kontorsmaterial", "Kundfaktura", "Egen insättning").
* `Template_saveJournalEntry(entry)`: Tar emot en sammansatt verifikationspost (med datum, beskrivning och en array av konteringsrader) från klientsidan, verifierar balansen och sparar raderna sekventiellt i kalkylbladet "Verifikationer".

### Client-side UI (`src/ui/` integrerat)
* **Verifikations-skapare:** Ett dynamiskt formulär med möjlighet att lägga till obegränsat antal debet/kredit-rader.
* **Typ-ahead sökning:** Snabbsökning i realtid bland konton med hjälp av lokalt lagrad kontoplan (hämtad en gång per session för högsta prestanda).
* **Mallväljare:** En snabbvalspanel för att ladda förinställda kontomallar direkt in i skaparen.

---

## 4. PSEUDOKOD (SERVER-SIDE)

```javascript
/**
 * Hämtar den aktuella kontoplanen från kalkylbladet "Kontoplan".
 * @return {Array<Object>} Lista med konton.
 */
function Template_getAccountPlan() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Kontoplan");
  if (!sheet) {
    // Returnera en grundläggande standardkontoplan om bladet saknas
    return [
      { code: "1930", name: "Företagskonto / Bank" },
      { code: "2641", name: "Debiterad ingående moms" },
      { code: "3001", name: "Försäljning varor" },
      { code: "6071", name: "Repræsentation" }
    ];
  }
  
  const data = sheet.getDataRange().getValues();
  const accounts = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) {
      accounts.push({
        code: row[0].toString(),
        name: row[1] ? row[1].toString() : ""
      });
    }
  }
  return accounts;
}

/**
 * Sparar en komplett verifikationspost i kalkylbladet.
 * @param {Object} entry - Innehåller date, desc, rows (array med {account, debit, credit})
 * @return {boolean} True om sparandet lyckades.
 */
function Template_saveJournalEntry(entry) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Verifikationer");
  if (!sheet) {
    throw new Error("Hittade inte bladet 'Verifikationer'.");
  }
  
  // 1. Validera att posten balanserar före lagring
  let sumDebit = 0;
  let sumCredit = 0;
  entry.rows.forEach(r => {
    sumDebit += Number(r.debit || 0);
    sumCredit += Number(r.credit || 0);
  });
  
  if (Math.abs(sumDebit - sumCredit) > 0.01) {
    throw new Error("Transaktionen balanserar inte! Debet: " + sumDebit + ", Kredit: " + sumCredit);
  }
  
  // 2. Beräkna nästa tillgängliga verifikationsnummer
  const lastRow = sheet.getLastRow();
  let nextVerId = 1;
  if (lastRow > 1) {
    const lastVerId = sheet.getRange(lastRow, 1).getValue();
    nextVerId = Number(lastVerId || 0) + 1;
  }
  
  // 3. Skriv rader till kalkylbladet i en och samma operation (Batching för prestanda)
  const rowsToWrite = [];
  entry.rows.forEach(r => {
    rowsToWrite.push([
      nextVerId,
      entry.date,
      entry.desc,
      r.account,
      Number(r.debit || 0),
      Number(r.credit || 0),
      "" // Tom kolumn för kvitto-länk (fylls via Drive feature)
    ]);
  });
  
  sheet.getRange(lastRow + 1, 1, rowsToWrite.length, 7).setValues(rowsToWrite);
  return true;
}
```
