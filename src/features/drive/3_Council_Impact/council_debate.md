# DIALECTICAL COUNCIL DEBATE & IMPACT REPORT: DRIVE INTEGRATION

## 1. THE DIALECTICAL COUNCIL DEBATE

### A. The Innovator (Att förändra)
"Detta Service Broker-mönster är helt fantastiskt! Genom att kapsla in anropen till `google.script.run` i en klientsides-tillsynsklass (`DriveService`) kan vi sömlöst växla mellan ett live Google Drive-gränssnitt och lokala skenobjekt (mocks) i vår Express-baserade dev-server. Det gör frontend-komponenten `DriveView.html` 100 % testbar, modulär och fri från global koppling. Det asynkrona laddningsgränssnittet i `DriveView` kommer att upplevas otroligt responsivt och modernt!"

### B. The Reflector (Att vända)
"Halt! Jag måste slå på den stora nödbromsen och känner en djup arkitektonisk ånger över vår initiala ritning. I specifikationen för `Drive_linkReceiptToRow` i vår Blueprint planerade vi att backend skulle uppdatera Kolumn I (Status) efter länkning. 
Detta är ett katastrofalt brott mot vår grundläggande systemarkitektur definierad i `SCHEMA_CONTRACTS.md` och `SHEET_FORMULAS_REFERENCE.md`. 
Kolumn I innehåller komplexa, inbäddade formler (såsom `=IF(...)`) som i realtid utvärderar transaktionens giltighet, länkstatus, flaggor och avvikelser. Om vår Apps Script-kod skriver ett statiskt textvärde till Kolumn I, kommer vi att **skriva över och utradera kalkylarkets formelmotor**! Detta förstör kalkylarkets integritet permanent. Vi får ALDRIG röra Kolumn I via kod!"

### C. The Mediator (Att förlika)
"Reflectorns invändning är helt monumental och räddar oss från ett dolt haveri. Vi måste respektera kalkylarkets inneboende logik och formelmotor som den absoluta källan till statusberäkning. 
Vi ändrar omedelbart logiken för `Drive_linkReceiptToRow`:
* Backend ska **ENBART** skriva Drive-URL:en till Kolumn H (Kolumn 8).
* Kolumn I lämnas helt orörd av kod. Kalkylarkets inbyggda formler kommer automatiskt att känna av att Kolumn H fyllts i och omedelbart uppdatera statusen till 'Länkad' eller 'Klar' på ett naturligt, reaktivt sätt.
Detta bevarar systemkontraktet perfekt."

---

## 2. ARCHITECTURAL SYNCHRONIZATION & IMPACT ANALYSIS

Vi kommer att skapa och modifiera följande operativa filer i kommande `4_Produce`-cykel:

* **`src/features/drive/FilePicker.js`** (Skapas)
  * Implementerar de 5 Drive-funktionerna (`Drive_resolvePathAsynchronously`, `Drive_linkReceiptToRow`, `Drive_renameFile`, `Drive_moveFile`, `Drive_uploadFile`) med prefixet `Drive_`.
  * Garanterar att `Drive_linkReceiptToRow` *enbart* modifierar Kolumn H och lämnar Kolumn I orörd.

* **`src/features/drive/ui/DriveView.html`** (Skapas)
  * Ny domändriven frontend-vy för Verifikat-fliken.
  * Inkluderar `DriveService`-brokern för transparent Apps Script vs. Lokal Dev-server-exekvering.
  * Hanterar asynkron rendering, filsökning, namnbyte och drag-and-drop-uppladdning.

* **`src/main/ui/AppShell.html`** (Modifieras)
  * Byter ut det gamla statiska `#tab-verification`-placeholder-innehållet mot ett dynamiskt scriptlet som inkluderar den nya vyn: `<?!= Init_include('src/features/drive/ui/DriveView'); ?>`.

* **`dev-server.js`** (Modifieras)
  * Lägger till inläsning och scriptlet-ersättning för `DriveView.html` så att lokala tester fungerar klockrent.

---

## 3. ROUTE DECISION
Efter en lyckad synkronisering och korrigering av Blueprinten i Rådet, dirigeras exekveringsgrafen härmed framåt till **CYCLE 4: Standalone Produce**.
