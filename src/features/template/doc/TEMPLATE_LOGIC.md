# FEATURE LOGIC: KONTERING & KONTOMALLAR (TEMPLATE ENGINE)

## 1. ANSVARSOMRÅDE
Denna modul erbjuder ett interaktivt gränssnitt för att dynamiskt kontera och skapa nya verifikat. Genom att integrera tätt med Google Kalkylarks dolda formelmotor slipper backend bygga egna konteringsförslag från grunden. Istället fungerar kalkylarket som den primära kalkyleringsmotorn.

---

## 2. DOMÄNREGLER & SPECIFIKA KRAV

### A. Den Formelstyrda Konteringsmotorn (A1 / A3:D6)
För att hålla backend fri från komplex bokföringslogik används kalkylarkets inbyggda matriser på rad 2 som beräkningsmotor:
* **Val av Kategori:** När en transaktion granskas, sätter GAS-backend ett `?` i kolumn F på transaktionsraden samt skriver den valda bokföringskategorin (börjar alltid med understreck, t.ex. `_Hyra`) till cell **A1**.
* **Datavalidering live:** Cell `A1` styrs av datavalidering live via bladet **'Vald kategori'** (intervall `$B:$B` för blad `1930`, `$A:$A` för blad `1630`). Detta blad filtrerar automatiskt fram rätt konteringsguider från `0000_autok` baserat på om den markerade radens beloppstecken (`SIGN`) är positivt eller negativt.
* **Underlagsgenerering:** Så fort `A1` uppdateras spottar kalkylarkets dolda matrisformler i rad 2 automatiskt ut det färdiga, balanserade bokföringsunderlaget i cellområdet **`A3:D6`** (Konto, Namn, Debet, Kredit).
* **Förenklad backend:** GAS behöver enbart *läsa* de genererade raderna från **`A3:D6`** för att bygga sitt SIE-block eller verifikat.

### B. Intelligent Auto-Kontering (Beskrivningsmatchning)
* **Regel:** Automatiskt igenkännande av transaktionsmönster för att underlätta manuell kontering.
* **Logik:** Om den valda radens `'Beskrivning'` (Kolumn C) matchar kända nyckelord (t.ex. "Hyra", "Adobe", "Google Cloud", "Lön") eller överensstämmer med tidigare bokförda rader, ska systemet automatiskt föreslå och ladda in rätt konteringsmall till cell `A1` när fliken `'Kontering'` öppnas. Användaren ska inte behöva klicka på dropdown-menyn manuellt.

### C. Realtidsvalidering av Balans (Buntningsspärr)
* **Regel:** Garantera att inga obalanserade verifikat sparas i kalkylbladet.
* **Logik:** Konteringsmallen i frontend ska ha en dynamisk tabell-footer som i realtid beräknar och visar summan för total Debet, total Kredit samt differensen (`Debet - Kredit`). 
  - Om differensen **inte är exakt noll**, ska knappen för att spara eller buntas förbli **helt inaktiverad (disabled)**.
  - Ett tydligt, rött varningsmeddelande ska visas bredvid knappen med den exakta obalansen (t.ex. *"Obalans: Debet och Kredit diffar med -150.00 kr"*).

### D. Momsdetektering (Moms-radar för Konto 2641)
* **Regel:** Om ett konteringsförslag innehåller konto **2641** (ingående moms), aktiveras systemets moms-radar.
* **Logik:** Mellanskillnaden (`Debet - Kredit`) för momskontot beräknas och sparas automatiskt i **Kolumn Q** (momsbelopp, index 17) för att säkra momsredovisningsunderlaget.

### E. Dynamisk Import av Lönespecifikationer (Kolumn H)
* **Regel:** Om dokumentlänken i **Kolumn H** leder till ett externt Google Kalkylark med fliken `'Lön'`, ska systemet parsa cellområdet **`B9:F70`** i det externa arket för att generera lön, källskatt och arbetsgivaravgifter.

---

## 3. FUNKTIONELL SPECIFIKATION (SERVER-SIDE)

* `Template_loadTemplateForTransaction(sheetName, rowNum, category)`: Skriver `?` till radens kolumn F samt skriver `category` till cell `A1`. Läser sedan in det genererade underlaget från `A3:D6` och returnerar det till UI:t.
* `Template_getAccountPlan()`: Hämtar tillgängliga konton från bladet "Kontoplan" i det aktiva dokumentet.
* `Template_parseExternalPayslip(spreadsheetUrl)`: Öppnar det externa kalkylarket via URL/ID, läser tabellen `'Lön'!B9:F70` och strukturerar datan till ett färdigt bokföringsunderlag för löner.

---

## 4. PSEUDOKOD (SERVER-SIDE)

```javascript
/**
 * Laddar en konteringsmall genom att skriva kategori till A1 och läsa A3:D6.
 * @param {string} sheetName - '1930' eller '1630'
 * @param {number} rowNum - Raden som markeras
 * @param {string} category - t.ex. '_Hyra'
 * @return {Array<Object>} Underlaget från A3:D6
 */
function Template_loadTemplateForTransaction(sheetName, rowNum, category) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Bladet saknas: " + sheetName);
  
  // Sätt markering "?" i Kolumn F
  sheet.getRange(rowNum, 6).setValue("?");
  
  // Skriv vald kategori till A1 för att aktivera formelmotorn
  sheet.getRange("A1").setValue(category);
  
  SpreadsheetApp.flush(); // Tvinga kalkylarket att beräkna formlerna
  
  // Läs bokföringsunderlaget från A3:D6
  const values = sheet.getRange("A3:D6").getValues();
  const journalRows = [];
  
  for (let i = 0; i < values.length; i++) {
    const accountCode = values[i][0];
    const accountName = values[i][1];
    const debit = Number(values[i][2] || 0);
    const credit = Number(values[i][3] || 0);
    
    if (accountCode) {
      journalRows.push({
        account: accountCode.toString(),
        name: accountName,
        debit: debit,
        credit: credit
      });
    }
  }
  
  return journalRows;
}
```
