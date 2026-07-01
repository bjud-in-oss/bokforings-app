# FEATURE LOGIC: BUNTNING & BATCHING (SIE-4 EXPORT)

## 1. ANSVARSOMRÅDE
Denna modul ansvarar för att läsa transaktionsdata från kalkylbladet (t.ex. rader som involverar likvidkonton som 1930, 1630 eller dylikt), gruppera dem i balanserade verifikationer, samt erbjuda export till det standardiserade svenska bokhföringsformatet **SIE-4**.

---

## 2. DOMÄNREGLER
1. **Transaktionskällor:** 
   - Läs data från ett definierat kalkylblad i det aktiva kalkylarkets dokument.
   - Filtrera data baserat på valt räkenskapsår (Accounting Year).
2. **Balanskrav:** 
   - Varje enskilt verifikat (bunt av konteringsrader med samma verifikatsnummer) måste balansera, dvs. summan av debet (`SUM(debit)`) måste vara exakt lika med summan av kredit (`SUM(credit)`).
   - Om ett verifikat är obalanserat ska gränssnittet varna användaren och blockera export.
3. **SIE-4 Exportkrav:**
   - Skapa giltiga SIE-4 rader med korrekta fältavgränsare och teckenkodning (CP437 / ISO-8859-1 kompatibel för svenska tecken Å, Ä, Ö).
   - Inkludera nödvändiga SIE-huvuden som `#FLAGGA`, `#FORMAT`, `#GEN`, `#FNAMN`, `#RAR`, `#KONTO` och `#VER`.

---

## 3. FUNKTIONELL SPECIFIKATION

### Server-side (`BatchLogic.js` / `BatchExport.js`)
* `Batch_getTransactions(year)`: Läser in alla transaktioner för angivet år och returnerar en array av transaktionsobjekt.
* `Batch_validateJournal(transactions)`: Kontrollerar att alla verifikat balanserar och uppfyller grundläggande valideringsregler.
* `Batch_generateSieFile(year)`: Samlar kontoplan, ingående balanser samt årets verifikat och bygger en SIE-4 sträng. Returnerar strängen eller skapar en tillfällig länk/Drive-fil för nedladdning.

### Client-side UI (`src/ui/` integrerat)
* **Tabellvy:** Visar verifikat grupperade per nummer med visuell indikation på om de balanserar (grön/röd belysning).
* **Års-väljare:** Dropdown-meny för att skifta mellan räkenskapsår.
* **Export-knapp:** Trigger för att generera och ladda ner SIE-formatet.

---

## 4. PSEUDOKOD (SERVER-SIDE)

```javascript
/**
 * Hämtar och strukturerar transaktionsrader från det aktiva kalkylarket.
 * @param {string} year - Räkenskapsåret som ska hämtas (t.ex. "2026").
 * @return {Array<Object>} Lista med strukturerade transaktionsrader.
 */
function Batch_getTransactions(year) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Verifikationer");
  if (!sheet) {
    throw new Error("Hittade inte bladet 'Verifikationer'.");
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0]; // Första raden som rubriker
  const transactions = [];
  
  // Rad-för-rad bearbetning (skippa rubriker)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const transDate = new Date(row[1]); // Antag datum i kolumn B
    
    if (transDate.getFullYear().toString() === year) {
      transactions.push({
        rowNum: i + 1,
        id: row[0],         // Verifikationsnummer
        date: row[1],       // Bokföringsdatum
        desc: row[2],       // Beskrivning
        account: row[3],    // Kontonummer
        debit: Number(row[4] || 0),
        credit: Number(row[5] || 0),
        receiptLink: row[6] // Länk till Drive-kvitto (om det finns)
      });
    }
  }
  
  return transactions;
}

/**
 * Genererar en SIE-4 kompatibel textsträng för valt år.
 * @param {string} year
 * @return {string} SIE-4 innehåll.
 */
function Batch_generateSieFile(year) {
  const transactions = Batch_getTransactions(year);
  
  // Gruppera efter verifikationsnummer
  const journal = {};
  transactions.forEach(t => {
    if (!journal[t.id]) {
      journal[t.id] = [];
    }
    journal[t.id].push(t);
  });
  
  let sieString = "";
  
  // 1. Skriv standardhuvuden
  sieString += "#FLAGGA 0\r\n";
  sieString += "#FORMAT PC8\r\n";
  sieString += `#GEN ${Utilities.formatDate(new Date(), "GMT+1", "yyyyMMdd")}\r\n`;
  sieString += `#FNAMN "Bokförings-app SPA"\r\n`;
  sieString += `#RAR 0 ${year}0101 ${year}1231\r\n`;
  
  // 2. Skriv kontolista (autogenererad från unika konton i transaktionerna)
  const uniqueAccounts = [...new Set(transactions.map(t => t.account))];
  uniqueAccounts.forEach(acc => {
    sieString += `#KONTO ${acc} "Konto ${acc}"\r\n`;
  });
  
  // 3. Skriv verifikat och dess transaktionsrader
  for (const verId in journal) {
    const lines = journal[verId];
    const firstLine = lines[0];
    const formattedDate = Utilities.formatDate(new Date(firstLine.date), "GMT+1", "yyyyMMdd");
    
    sieString += `#VER A ${verId} ${formattedDate} "${firstLine.desc}"\r\n{\r\n`;
    
    lines.forEach(line => {
      const amount = line.debit - line.credit;
      sieString += `  #TRANS ${line.account} {} ${amount.toFixed(2)}\r\n`;
    });
    
    sieString += "}\r\n";
  }
  
  return sieString;
}
```
