# Scan & Ultrathink: Kontering & Template Engine

## 1. Analys av kalkylarkets dolda formelmotor ("Black Box")
Kalkylarkets formler i `A3:D6` utgör kärnan i konteringsmotorn. För att backend ska interagera säkert med denna utan att störa eller bryta formelkedjor, har följande kartlagts:

* **Sättande av "?" (Kolumn F)**:
  * Formlerna i bladet `'Vald kategori'` och rad 2 i det aktiva bladet förlitar sig på `match("?"; 'Blad'!$F:$F; 0)` för att hitta den aktuella transaktionsraden.
  * **Hög risk**: Om det finns mer än ett `?` i Kolumn F kommer `match()` att matcha den första raden, vilket resulterar i att fel transaktionsdata läses in om en senare rad väljs.
  * **Lösning**: Innan backend skriver `?` till den nya raden, måste alla befintliga `?` i Kolumn F rensas för det bladet (från rad 9 till sista raden).

* **Uppdatering av Kategori i A1**:
  * När kategorinamnet (t.ex. `_Hyra`) skrivs till `A1` i det aktiva bladet triggas `match($A$1; '0000_autok'!$B:$B; 0)` i rad 2.
  * Detta fyller i sin tur på `A3:A6` (Konto), `B3:B6` (Kontonamn via `VLOOKUP` mot `'Kontoplan'`), samt `C3:D6` (Debet/Kredit uppdelat från den dolda beloppsmatrisen `M3:M6`).

* **SpreadsheetApp.flush()**:
  * Google Apps Script batchar alla skrivningar till kalkylarket. För att formelmotorn ska hinna beräkna värdena i `A3:D6` innan backend läser av dem, måste vi kalla på `SpreadsheetApp.flush()` omedelbart efter att vi skrivit `?` till kolumn F och kategorin till `A1`. Först därefter kan vi läsa cellområdet `A3:D6`.

## 2. Moms-radar (konto 2641)
* **Regel**: Om konteringen innehåller konto **2641** (Ingående moms), ska mellanskillnaden (`Debet - Kredit`) beräknas.
* **Logik**: Det beräknade momsbeloppet sparas i **Kolumn Q** (kolumn 17, momsbelopp) på transaktionsraden i det aktiva bladet när verifikatet sparas/buntas. Detta bevarar momsunderlaget för momsredovisningen.

## 3. Dynamisk löne-import (Lönespecifikationer i Kolumn H)
* **Regel**: Om Kolumn H innehåller en länk till ett externt Google Kalkylark med fliken `'Lön'`, ska systemet parsa cellområdet `B9:F70`.
* **Detektion och Säkerhet**: 
  * Backend måste via RegExp identifiera om strängen i Kolumn H är en giltig Google Spreadsheet-URL (t.ex. innehåller `/spreadsheets/d/([a-zA-Z0-9-_]+)`).
  * Systemet öppnar det externa kalkylarket asynkront med `SpreadsheetApp.openById(id)` och läser området `'Lön'!B9:F70`.
  * Rader som innehåller giltig lönehistorik (t.ex. anställdas löner, skatt, arbetsgivaravgifter) struktureras upp och översätts till motsvarande Debet/Kredit-rader (konto 7010, 2710, 2730 etc.) för konteringstabellen.

## 4. Frontend-integration och Flikhoppning
* **Handoff**: `DriveView.html` hanterar koppling av underlag. När användaren klickar på "Koppla fil" anropas `Drive_linkReceiptToRow` (som enbart skriver till Kolumn H). Vid lyckat svar uppdateras det lokala tillståndet, varpå gränssnittet automatiskt växlar till fliken `'Kontering'` (`tab-journal`) och triggar laddning av transaktionen där.
* **Mottagare**: Vår nya frontend-vy `TemplateView.html` kommer att ta över stafettpinnen i `#tab-verification` -> `#tab-journal`. Den ska tillhandahålla en interaktiv dropdown för att välja kategorier, visa de genererade raderna, tillåta redigering, och validera balans innan buntning tillåts.
