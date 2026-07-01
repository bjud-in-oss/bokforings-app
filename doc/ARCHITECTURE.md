# Bokhförings-app: Systemarkitektur & Mappstruktur

Detta dokument fungerar som vår Master System Documentation (Single Source of Truth) för bokhföringsapplikationen.

## Mappstruktur (Target State)

Källkoden är organiserad under `bokforings-app/` för att underlätta hantering och distribution via Google Apps Script (clasp):

```
bokforings-app/
├── .clasp.json          # Clasp konfigurationsfil för synkronisering
├── appsscript.json      # Manifestfil för Google Apps Script
└── src/
    ├── main/
    │   └── Init.js      # Globala händelsehanterare (onOpen) och menyskapande
    ├── features/
    │   ├── batching/
    │   │   ├── BatchLogic.js   # Logik för batch-bearbetning av verifikat
    │   │   └── BatchExport.js  # Exportfunktioner till kalkylblad/PDF
    │   ├── template/
    │   │   └── TemplateEngine.js # Mallmotor för dokumentgenerering
    │   └── drive/
    │       └── FilePicker.js   # Integration med Google Drive File Picker
    └── ui/
        ├── GUI.html     # Huvud-UI (HTML-struktur)
        ├── CSS.html     # CSS-styling (inkluderas i GUI.html via scriptlets)
        └── JS.html      # Klientside-logik (inkluderas i GUI.html via scriptlets)
```

## Google Apps Script (GAS) Begränsningar & Riktlinjer

1. **Namespace-kollisioner:**
   Eftersom `clasp push` plattar till alla underkataloger till en enda nivå i Google Apps Script, måste alla globala funktionsnamn, variabler och klasser i `.js` (som blir `.gs` vid push) vara unika över HELA projektet. Vi rekommenderar ett prefixsystem (t.ex. `Init_`, `Batch_`, `Template_`, `Drive_`).

2. **Asynkron exekvering:**
   All kommunikation mellan frontend (`GUI.html`/`JS.html`) och backend sker asynkront via `google.script.run`.

3. **Inkludering av UI-komponenter:**
   För att hålla gränssnittet modulärt men ändå kompatibelt med Apps Scripts `HtmlService` (som endast accepterar en HTML-fil som startpunkt), inkluderar vi `CSS.html` och `JS.html` i `GUI.html` med följande GAS-kod:
   ```html
   <?!= include('bokforings-app/src/ui/CSS'); ?>
   <?!= include('bokforings-app/src/ui/JS'); ?>
   ```
   Detta kräver en hjälpfunktion `include(filename)` i backend (t.ex. i `Init.js`).
