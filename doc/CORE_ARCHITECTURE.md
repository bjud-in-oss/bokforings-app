# CORE ARCHITECTURE: GOOGLE APPS SCRIPT SPA

## 1. ARKITEKTURPRINCIPER & MAPPSTRUKTUR
Denna applikation är en Single Page Application (SPA) byggd med en Vanilla HTML/JS-frontend och en Google Apps Script (GAS) backend (V8-motor). 

Källkoden är strukturerad enligt en variant av **Feature-Sliced Design (FSD)** anpassad för GAS-miljöns begränsningar:

```
/
├── .clasp.json                    # Konfiguration för clasp-synkronisering
├── appsscript.json                # Google Apps Script Manifest
├── doc/
│   └── CORE_ARCHITECTURE.md       # Globala arkitekturregler & GAS-begränsningar
└── src/
    ├── main/
    │   └── Init.js                # App-initiering, onOpen, menyskapande och globala helpers
    ├── features/                  # Domänspecifika moduler (fraktal struktur)
    │   ├── batching/
    │   │   └── doc/               # Logik och specifikation för Batching
    │   ├── drive/
    │   │   └── doc/               # Logik och specifikation för Drive/kvitto-koppling
    │   └── template/
    │       └── doc/               # Logik och specifikation för Kontering/Mallar
    └── ui/
        ├── GUI.html               # Huvudgränssnitt (struktur & layout)
        ├── CSS.html               # Global och komponentspecifik CSS (injiceras i GUI.html)
        └── JS.html                # Global och komponentspecifik klientside-JS (injiceras i GUI.html)
```

---

## 2. CRITICAL GAS CONSTRAINTS (MANDATE)

### A. Platt sökstruktur (clasp push-plattning)
När `clasp push` körs laddas alla filer upp till Google Drive. Apps Script-miljön **stödjer inte riktiga undermappar** för kodfiler. 
* Alla underkataloger i `src/` plattas till av clasp. En fil på sökvägen `src/features/batching/BatchLogic.js` kommer att döpas om till `src/features/batching/BatchLogic.gs` i Google-projektet, men internt ser GAS alla filer som om de låg i samma rotmapp.
* **MANDAT:** Alla backend-funktioner (.js/.gs) måste ha **globalt unika namn** över hela projektet för att undvika namnkonflikter och överskrivningar.

### B. Funktionsnamns-konventioner (Namespace-simulering)
För att motverka kollisioner på grund av den plattade strukturen använder vi ett strikt prefix-baserat namnsystem för alla globala funktioner och variabler i backend:
* **Globala hjälpfunktioner / Init:** Prefix `Init_` (t.ex. `Init_onOpen()`, `Init_include()`)
* **Batching Feature:** Prefix `Batch_` (t.ex. `Batch_getTransactions()`, `Batch_exportToSie()`)
* **Drive Feature:** Prefix `Drive_` (t.ex. `Drive_linkReceipt()`, `Drive_getFiles()`)
* **Template Feature:** Prefix `Template_` (t.ex. `Template_getAccountPlan()`, `Template_applyTemplate()`)

### C. UI-inkludering & Modularisering (HtmlService)
Google `HtmlService` tillåter endast att en HTML-fil fungerar som startpunkt. För att hålla vår CSS och klientside-JS i separata filer, använder vi Apps Script scriptlets (`<?!= ... ?>`) för att inkludera dem i `GUI.html`:
```html
<!-- I GUI.html -->
<?!= Init_include('src/ui/CSS'); ?>
<?!= Init_include('src/ui/JS'); ?>
```
Hjälpfunktionen `Init_include(filename)` måste implementeras i backend (`Init.js`) för att läsa och utvärdera innehållet i målet som rå text:
```javascript
function Init_include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

---

## 3. STATE- & DATAFLÖDE (CLIENT-SERVER)

### A. Asynkron kommunikation (google.script.run)
All kommunikation mellan frontend (`JS.html`) och backend (`.js` filer) sker asynkront via det inbyggda API:et `google.script.run`.
* **Klientsidan** anropar serverfunktioner med framgångs- och felhanterare (callbacks):
  ```javascript
  google.script.run
    .withSuccessHandler(onSuccessCallback)
    .withFailureHandler(onFailureCallback)
    .Batch_getTransactions(year);
  ```
* **Ingen synkron exekvering:** Försök aldrig att returnera värden direkt från serverfunktioner till synkron kod på klientsidan.

### B. Exekveringstider & Kvoter
* **Tidsgräns:** Google Apps Script har en exekveringstidsgräns på **6 minuter** per anrop. Långa batch-körningar måste designas för att kunna avbrytas och återupptas, eller delas upp asynkront.
* **Batching & Chunking:** Vid bearbetning av stora mängder transaktionsrader, läs eller skriv i batchar snarare än rad-för-rad för att minimera API-anrop till SpreadsheetApp (vilket är extremt långsamt).

---

## 4. UI-FILOSOFI: "INDUSTRIAL CLARITY"
* **Inga dolda tillstånd:** Det aktiva räkenskapsåret, batch-statusen och länkningsstatusen för Drive-filer måste alltid framgå tydligt i gränssnittet.
* **Minimalistisk & Responsiv:** Layouten ska laddas omedelbart i en Google Sheets sidopanel eller dialogruta. Vi undviker tunga externa ramverk och förlitar oss på flexibel Vanilla JS-arkitektur och ren CSS Grid/Flexbox.
