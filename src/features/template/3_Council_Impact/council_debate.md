# DIALECTICAL COUNCIL DEBATE & IMPACT REPORT: TEMPLATE ENGINE

## 1. THE DIALECTICAL COUNCIL DEBATE

### A. The Innovator (Att förändra)
"Detta kommer att bli en revolutionerande användarupplevelse! Den dynamiska konteringstabellen gör det möjligt för användaren att direkt se hur Debet och Kredit balanserar i realtid. Buntningsspärren (The Balancing Barrier) förhindrar helt felaktiga bokföringsposter genom att inaktivera spara-knappen och visa en tydlig röd differensindikator. Detta minimerar mänskliga fel till absolut noll!"

### B. The Reflector (Att vända)
"Halt! Jag känner en djup rannsakan och arkitektonisk ånger över vår hantering av Kolumn F i den ursprungliga blueprinten. Vi föreslog att `Template_saveJournalEntry` skulle skriva kategorinamnet (t.ex. `_Hyra`) till Kolumn F. 
Detta är ett katastrofalt brott mot vår data- och tillståndsmodell i `SCHEMA_CONTRACTS.md`! 
Kolumn F (Verifikatstatus/V-nummer) är **strikt reserverad** för tillståndsflaggor (`?`, `x`, `v`) eller det slutgiltiga verifikationsnumret (t.ex. `V1`, `V2`). Kategorinamnet (t.ex. `_Hyra`) hör hemma i **Kolumn G** (Kategori)! 
Om vi skriver kategorinamnet till Kolumn F raderar vi permanent status- och revisionsspåret vilket omöjliggör framtida SIE-exporter och buntningar. Vi måste omedelbart korrigera detta!"

### C. The Mediator (Att förlika)
"Reflectorns insikt är helt kritisk och räddar hela systemets dataintegritet. Vi korrigerar härmed logiken för `Template_saveJournalEntry` enligt följande:
1. När en kontering sparas, ska det valda kategorinamnet (t.ex. `_Hyra`) skrivas till **Kolumn G** (Kolumn 7, Kategori).
2. Sökmarkören `?` i **Kolumn F** (Kolumn 6) ska raderas eller ersättas med tillståndsflaggan `v` (Veriferad/Klar för buntning) i enlighet med flagglogiken i `SCHEMA_CONTRACTS.md`.
3. Eventuell moms sparas i **Kolumn Q** (Kolumn 17).
Detta bevarar både revisionskedjan och kalkylarkets tillståndsmaskin intakt."

---

## 2. ARCHITECTURAL SYNCHRONIZATION & IMPACT ANALYSIS

Följande filer kommer att skapas eller modifieras i nästa `4_Produce`-cykel:

* **`src/features/template/TemplateEngine.js`** (Skapas)
  * Implementerar `Template_loadTemplateForTransaction` (rensar gamla `?` i Kolumn F, sätter nytt `?`, sätter kategori i A1, flushar, och extraherar A3:D6).
  * Implementerar `Template_saveJournalEntry` (skriver kategori till Kolumn G, sätter Kolumn F till status `v` och sparar ev. moms till Kolumn Q).
  * Implementerar `Template_parseSalarySpecification` för asynkron inläsning och parsing av externa löneblad.

* **`src/features/template/ui/TemplateView.html`** (Skapas)
  * Ny frontend-vy som ersätter `#tab-journal` i `AppShell.html`.
  * Dynamisk tabell med realtidsbalansering, manuell radtilläggning och en stenhård "Buntningsspärr" (disabled-läge om Debet != Kredit).

* **`src/main/ui/AppShell.html`** (Modifieras)
  * Inkluderar `TemplateView.html` via scriptlet-taggen `<?!= Init_include('src/features/template/ui/TemplateView'); ?>`.

* **`dev-server.js`** (Modifieras)
  * Registrerar inläsning och regex-ersättning för `TemplateView.html` så att lokala tester fungerar klockrent.

---

## 3. ROUTE DECISION
Efter fullständig rannsakan och korrigering av blueprinten dirigeras exekveringen härmed framåt till **CYCLE 4: Standalone Produce**.
