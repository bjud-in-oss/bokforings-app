# SYSTEM LOGIC: FRONTEND UI/UX SPECIFICATION

## 1. STRUKTURELL LAYOUT & SYSTEMSKISS
Gränssnittet är en Single Page Application (SPA) byggd med Vanilla HTML, CSS och JS som körs som en sidopanel eller dialogruta i Google Sheets. För att ge en professionell och ergonomisk arbetsmiljö följer vi principen **"Industrial Clarity"** med en tydlig och förutsägbar vy utan dolda tillstånd.

### Gränssnittets Layout-struktur:
```
+-----------------------------------------------------------------------+
|  GLOBAL HEADER: [Räkenskapsår V]  [Blad (1930/1630) V]            [X] |
+-----------------------------------+-----------------------------------+
|                                   |                                   |
|   LEFT PANEL: FLIKSYSTEM          |   RIGHT PANEL: AKTIVT ARBETSFÄLT  |
|   [ Bokföring ] [Verifikat] [Kont]|                                   |
|   +-----------------------------+ |                                   |
|   |                             | |                                   |
|   |  Aktiv tab-vy visas här     | |                                   |
|   |                             | |                                   |
|   |                             | |                                   |
|   |                             | |                                   |
|   |                             | |                                   |
|   +-----------------------------+ |                                   |
|                                   |                                   |
+-----------------------------------+-----------------------------------+
|  SPLIT-VIEW RESIZER (Dragbar avdelare mellan panelerna)               |
+-----------------------------------------------------------------------+
|  SIE-BANNER (Dold i botten, visas efter export)                      |
+-----------------------------------------------------------------------+
```

---

## 2. KOMPONENTDETALJER

### A. Global Header (Toppfältet)
* **Räkenskapsår (Accounting Year):** En `<select>` dropdown som låter användaren välja brutet räkenskapsår (t.ex. "2025/2026"). Detta val styr filtreringen i alla flikar.
* **Kalkylblads-väljare:** En `<select>` dropdown för att skifta mellan de två tillåtna datakällorna: `'1930'` (Företagskonto) och `'1630'` (Avräkningskonto).
* **Realtidssaldo:** Visar det aktuella summerade saldot för det valda kalkylbladet (t.ex. `'1930 Saldo: 54 320 kr'`). Detta saldo hämtas asynkront från backend och uppdateras automatiskt varje gång en buntning eller avbuntning sker.
* **Stängningsknapp [X]:** En distinkt, röd-aktig knapp i det övre högra hörnet som anropar `google.script.host.close()` för att omedelbart stänga sidopanelen/dialogrutan.

### B. Dragsplit (Split-View Resizer)
* Mellan vänster panel och höger panel ligger en vertikal dragbar avdelare (`#ui-resizer`).
* Klientsidan registrerar händelsehanterare (`mousedown` / `touchstart`) för att dynamiskt ändra bredden (`grid-template-columns` eller `flex-basis`) på de två panelerna i realtid, vilket ger användaren kontroll över sitt skärmutrymme.

### C. Fliksystem (Vänster Panel)
Tre huvudflikar styr vad användaren arbetar med:
1. **'Bokföring' (Huvudvy):**
   - Visar en bred, högdensitets-tabell över årets alla rader laddade från det valda bladet (börjar på rad 9).
   - **Kolumnkrav för tabellen:**
     - **Datum:** Transaktionsdatum (Kolumn B).
     - **Beskrivning:** Fritext (Kolumn C).
     - **Belopp:** Beräknat/Visat värde baserat på Debet/Kredit.
     - **Ändrat (E):** Status i Kolumn E (t.ex. korrigeringar).
     - **Nr (F):** Det permanenta verifikationsnumret (Kolumn F).
     - **Kommentar:** Anteckningar (Kolumn G).
     - **Länk:** Visar en klickbar `🔗`-ikon om en giltig Drive-URL finns i Kolumn H. Vid klick laddas en förhandsvisning asynkront.
     - **Status (I):** Statusindikator för verifikatet (Kolumn I).
     - **Åtgärd:** En knapp för att **'Avbunta'** raden (vilket rensar T, U, V om raden ännu inte exporterats permanent).
2. **'Verifikat' (Google Drive-väljare):**
   - Erbjuder en filhanterare ansluten till Drive.
   - Visar nyligen uppladdade underlag i den aktuella `YYMM`-mappen.
   - Tillåter användaren att snabbt döpa om, flytta eller ladda upp nya filer.
3. **'Kontering' (Templates & Inmatning):**
   - Gränssnitt för manuell registrering av nya transaktioner.
   - Använder en `<datalist>` i kontonummer-fälten för automatisk autocomplete mot den inlästa kontoplanen.
   - Har en knapp **"+ Lägg till rad"** för att dynamiskt expandera verifikatet med obegränsat antal debet/kredit-rader.

### D. SIE-Bannern (Dold botten-vy)
* Denna sektion är initialt helt dold (`display: none`).
* Den blir synlig **ENDAST** omedelbart efter att en framgångsrik SIE-export har initierats och filen har genererats.
* **Innehåll i SIE-bannern:**
  1. Steg-för-steg instruktioner och direktlänkar för att ladda upp filen till bokföringstjänsten (t.ex. *Enkelbok*).
  2. Den slutgiltiga åtgärdsknappen: **"Bekräfta (Auto-Numrera)"**. Vid klick på denna tilldelas de permanenta V-numren till kolumn F och de temporära kolumnerna T, U, V rensas i kalkylarket.

---

## 3. KLIENTSIDE LOGIK & TILLSTÅNDSHANTERING (`JS.html`)

```javascript
// Globalt tillstånd i klientgränssnittet
const UI_STATE = {
  activeSheet: "1930",
  activeYear: "2025",
  activeTab: "bokforing",
  accountPlan: [],     // Hämtas en gång per session
  selectedRow: null,   // Raden användaren har markerat
  dragStartWidth: 0,
  isDragging: false
};

/**
 * Initierar gränssnittet vid laddning.
 */
function UI_init() {
  UI_setupEventListeners();
  UI_loadInitialState();
  UI_loadAccountPlan();
}

/**
 * Registrerar lyssnare för resizer, flikar och dropdowns.
 */
function UI_setupEventListeners() {
  // Resizer logik
  const resizer = document.getElementById("ui-resizer");
  const leftPanel = document.getElementById("left-panel");
  
  resizer.addEventListener("mousedown", (e) => {
    UI_STATE.isDragging = true;
    UI_STATE.dragStartWidth = leftPanel.offsetWidth;
    document.body.style.cursor = "col-resize";
  });
  
  document.addEventListener("mousemove", (e) => {
    if (!UI_STATE.isDragging) return;
    const newWidth = e.clientX; // Avstånd från vänsterkant
    if (newWidth > 150 && newWidth < window.innerWidth - 150) {
      leftPanel.style.width = newWidth + "px";
    }
  });
  
  document.addEventListener("mouseup", () => {
    if (UI_STATE.isDragging) {
      UI_STATE.isDragging = false;
      document.body.style.cursor = "default";
    }
  });
}

/**
 * Laddar kalkylarkets ursprungstillstånd asynkront.
 */
function UI_loadInitialState() {
  google.script.run
    .withSuccessHandler((state) => {
      UI_STATE.activeSheet = state.sheet;
      UI_STATE.activeYear = state.year;
      document.getElementById("select-sheet").value = state.sheet;
      document.getElementById("select-year").value = state.year;
      
      // Fokusera den aktiva raden i tabellen
      if (state.activeRow >= 9) {
        UI_STATE.selectedRow = state.activeRow;
        UI_scrollToRow(state.activeRow);
      }
      
      UI_refreshActiveTab();
    })
    .Batch_getInitialState();
}
```

---

## 4. ERGONOMI & KORTKOMMANDON (POWER-USER)
För att underlätta det löpande bokföringsarbetet och göra gränssnittet extremt tidseffektivt för erfarna användare (power-users) ska applikationen stödja följande navigations- och ergonomimönster:

* **Ctrl + S / Cmd + S (Snabb-buntning):** En global klientside-event listener på tangentbordet (`keydown`) ska övervaka denna kombination. När den trycks triggas omedelbart buntningslogiken för de markerade eller fokuserade kalkylraderna, utan att användaren behöver lämna tangentbordet.
* **Escape-tangenten (Stäng & Avbryt):** Om användaren trycker på `Escape` ska alla öppna dropdown-menyer, tillfälliga flytande förhandsvisningar av kvitton samt den bottenplacerade SIE-bannern omedelbart stängas.
* **Smart Tab-ordning (Fält-hoppning):** Inuti konteringsmallen och den manuella inmatningen ska `tabindex` ställas in så att användaren smidigt kan hoppa sekventiellt mellan Debet- och Kredit-fälten för att snabbt kunna skriva in belopp och klicka på "Lägg till rad" eller "Spara" helt utan att röra musen.
