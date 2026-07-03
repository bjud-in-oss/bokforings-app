# SYSTEM LOGIC: FRONTEND UI/UX SPECIFICATION

## 1. STRUKTURELL LAYOUT & SYSTEMSKISS
Gränssnittet är en Single Page Application (SPA) byggd med Vanilla HTML, CSS och JS som körs som en modeless dialogruta i Google Sheets. För att ge en professionell och ergonomisk arbetsmiljö följer vi principen **"Industrial Clarity"** med en tydlig och förutsägbar vy utan dolda tillstånd.

### Gränssnittets Layout-struktur:
```
+-----------------------------------------------------------------------+
|  GLOBAL HEADER: [Räkenskapsår (Brutet t.ex. 2025/2026) V]  [Blad (1930/1630) V] |
+-----------------------------------+-----------------------------------+
|                                   |                                   |
|   LEFT PANEL:                     |   RIGHT PANEL: AKTIVT ARBETSFÄLT  |
|   [ Bokföring ] [Verifikat] [Kont]|                                   |
|   +-----------------------------+ |                                   |
|   |                             | |                                   |
|   |  Aktiv tab-vy visas här     | |                                   |
|   |                             | |                                   |
|   |  (Standard: 1/3 bredd)      | |  (Standard: 2/3 bredd)          |
|   |                             | |                                   |
|   |                             | |                                   |
|   +-----------------------------+ |                                   |
|                                   |                                   |
+-----------------------------------+-----------------------------------+
|  SPLIT-VIEW RESIZER (Dragbar avdelare mellan panelerna)               |
+-----------------------------------------------------------------------+
|  SIE-BANNER (Dold i botten, visas efter export som en bekräftelse-banner) |
+-----------------------------------------------------------------------+
```

---

## 2. KOMPONENTDETALJER & KOMPAKTNESS

### A. Global Header (Toppfältet)
* **Brutna Räkenskapsår:** En `<select>` dropdown som låter användaren välja brutet räkenskapsår (t.ex. "2025/2026"). Detta val styr filtreringen i alla flikar.
* **Kalkylblads-väljare:** En `<select>` dropdown för att skifta mellan de två tillåtna datakällorna: `'1930'` (Företagskonto) och `'1630'` (Avräkningskonto).
* **Inga "stimmiga" rubriker:** Inga onödiga rubriker som "Bokföringspanel" eller liknande. Flikarna i gränssnittet fungerar som rubriker i sig själva för att spara värdefullt vertikalt utrymme.
* **Ingen extra stängningsknapp:** Vi använder Google Sheets standard-kryss i dialogrutan. Ingen extra [X]-knapp eller "Stäng" i vårt interna UI.

### B. Dragsplit (Split-View Resizer)
* Mellan vänster panel och höger panel ligger en vertikal dragbar avdelare (`#ui-resizer`).
* Standardinställningen för panelerna är **1/3 bredd för vänster panel** och **2/3 bredd för höger panel**.
* Klientsidan registrerar händelsehanterare (`mousedown` / `touchstart`) för att dynamiskt ändra bredden på panelerna i realtid, vilket ger användaren total kontroll över skärmutrymmet.

### C. Fliksystem & De Tre Huvudflikarna
Flikarna ska heta exakt: **Bokföring**, **Verifikat** och **Kontering**.

#### 1. Fliken 'Bokföring' (Huvudvy)
* Visar hela året i en blixtsnabb datatabell **utan radnummer** för maximal kompakthet.
* **Ergonomisk navigering:** Man kan enkelt navigera mellan raderna med kalkylarkets piltangenter (Upp/Ned) samt trycka `Enter` för att välja en rad.
* **Strikt kolumnordning (Vänster till Höger):**
  1. **Status:** Statusindikator från Kolumn I (placerad längst till vänster).
  2. **Datum:** Transaktionsdatum (Kolumn B).
  3. **Text:** Beskrivning (Kolumn C).
  4. **Belopp:** Beräknat/Visat värde baserat på Debet/Kredit.
  5. **Ändrat Belopp:** Manuellt ändrat belopp (från Kolumn E för att spåra manuella korrigeringar).
  6. **V-Nr:** Det permanenta eller temporära verifikationsnumret (Kolumn F).
  7. **Kommentar:** Anteckningar (Kolumn G).
  8. **Hyperlänk:** Visar enbart en klickbar `🔗`-ikon (om det finns en länk i Kolumn H) med en smidig hover-meny för att ta bort länken.
* **Avbuntning:** Har en röd **"Avbunta"**-knapp direkt i listan för att omedelbart ångra en buntning och återställa raden.

#### 2. Fliken 'Verifikat' (Drive-kopplingen)
* **Asynchronous Lazy Loading:** När en rad klickas, laddas Drive-sökvägen asynkront i bakgrunden. Under sökningen visas texten *"Söker filsökväg..."* i stället för att låsa hela gränssnittet, vilket gör att appen startar och reagerar blixtsnabbt.
* **Kompakt filvy:** Visar filnamnet förkortat från dess respektive `ÅÅMM`-mapp på Drive.
* **Filhantering:** Det ska finnas möjlighet att direkt flytta, ladda upp, eller döpa om filer.

#### 3. Fliken 'Kontering' (Templates & Lön)
* **Flexibel radredigering:** Användaren måste manuellt kunna ändra belopp och konton, samt dynamiskt lägga till eller ta bort rader (kritiskt för hantering av t.ex. komplexa lönespecifikationer).
* **Autocomplete:** Stöder autocomplete mot kontoplanen i realtid när man skriver kontonummer eller söker i dropdown-listan.
* **SIE-Bannern (Bekräftelse-banner):** När en SIE-export genereras, fälls en smal bekräftelse-banner upp i botten av skärmen i stället för att dölja hela gränssnittet med en blockerande modal eller helskärmsvy.

---

## 3. SMART TAB-HOPPNING & AUTOMATISKT FLÖDE (UX)
För att minimera antalet klick och låta användaren "flyga" igenom bokföringen, styrs gränssnittet av ett intelligent, automatiskt flödesmönster:

1. **Val av rad UTAN länk (Kolumn H är tom):**
   * Applikationen förstår direkt att ett underlag saknas för denna transaktion.
   * Gränssnittet hoppar automatiskt över till fliken **Verifikat** och aktiverar Drive-väljaren/kopplingen så att användaren kan leta upp och koppla rätt fil.
2. **När filen kopplas:**
   * Applikationen sparar omedelbart länken till Kolumn H i kalkylarket.
   * Gränssnittet reagerar live och växlar automatiskt över till fliken **Kontering** (Mall).
3. **Val av rad MED länk (Kolumn H innehåller redan en URL):**
   * Eftersom verifikatet redan är kopplat är Drive-väljaren irrelevant.
   * Applikationen hoppar helt förbi Verifikat-fliken och tar användaren direkt till fliken **Kontering** (Mall). Drive-kopplingen förblir dold eller inaktiv för att spara tid.
4. **Efter utförd buntning i Kontering:**
   * När konteringen sparas/buntas kastas användaren automatiskt tillbaka till huvudfliken **Bokföring** för att kunna påbörja nästa transaktion.

---

## 4. FLOATING ACTION BUTTONS (FAB)
För att bibehålla en avskalad och extremt ren layout placeras primära sammanhangsberoende handlingar i en svävande knappgrupp (**Floating Action Buttons**) nere i det högra hörnet:
* **Spara Länk / Koppla:** Visas under kopplingsflödet.
* **Bunta:** Visas vid aktiv kontering.
* **SIE Export:** Visas i bokföringsvyn för att exportera data.

Dessa knappar anpassas dynamiskt beroende på vilken flik eller radstatus som för tillfället är aktiv.
