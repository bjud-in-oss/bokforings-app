# SHEET FORMULAS REFERENCE (BLACK BOX SPECIFICATION)

Denna referensfil beskriver kalkylarkets inbyggda formelmotor ("Black Box") som beräknar och spottar ut bokföringsunderlag i cellområdet `A3:D6` i realtid. GAS-backend läser enbart resultatet av dessa formler efter att ha satt markeringen `?` i Kolumn F och kategorin i `A1`.

---

## 1. DATAVALIDERING & DYNAMISK FILTRERING

### Fliken 'Vald kategori'
Cellerna som styr dropdown-menyerna i gränssnittet (och cell `A1` i respektive blad) fylls dynamiskt baserat på transaktionens beloppstecken (`SIGN`). Detta filtrerar bort ogiltiga konteringsförslag (t.ex. visar endast utgiftsmallar för negativa belopp och inkomstmallar för positiva belopp).

*   **A1 (Filtrering för 1630 / Skattekonto):**
    ```excel
    =sort(IFERROR(FILTER({'0000_autok'!B:B};'0000_autok'!C:C="Guide";'0000_autok'!E:E=sign(VALUE(substitute(substitute(index('1630'!$D:$D;match("?";'1630'!$F:$F;0));" ";""); Substitute(substitute(index('1630'!$D:$D;match("?";'1630'!$F:$F;0));" ";"");",";"."))))))
    ```
    *   **Logik:** Letar upp den rad i `1630` som är markerad med `?` i kolumn F. Hämtar beloppet i kolumn D, rensar mellanslag, byter decimalkomma till punkt, och beräknar dess `SIGN` (+1 eller -1). Filtrerar sedan fram alla rader i `0000_autok` som är av typen `"Guide"` och har matchande tecken, sorterar dem i bokstavsordning och presenterar dem som valbara alternativ.
*   **B1 (Filtrering för 1930 / Företagskonto):**
    *   Motsvarande formelstruktur som indexerar mot `'1930'!$D:$D` och filtrerar valbara guider från `'0000_autok'` till kolumn B i bladet 'Vald kategori'.

---

## 2. DEN DOLDA FORMELMOTORN (RAD 2-6)

När en rad markeras med `?` och kategori skrivs till `A1`, triggas beräkningskedjan på rad 2, 3, 4, 5 och 6:

### A. Kontokoder (Cellområdet A3:A6)
Placeras på raderna 3 till 6 i kolumn A.
*   **Formel i A2:**
    ```excel
    {"Dölj raden"; index('0000_autok'!C:C;match($A$1;'0000_autok'!$B:$B;0)+2;1); index('0000_autok'!C:C;match($A$1;'0000_autok'!$B:$B;0)+3;1); index('0000_autok'!C:C;match($A$1;'0000_autok'!$B:$B;0)+4;1); index('0000_autok'!C:C;match($A$1;'0000_autok'!$B:$B;0)+5;1)}
    ```
    *   **Logik:** Slår upp den valda kategorin (`$A$1`) i `0000_autok` (kolumn B) och returnerar de tillhörande kontokoderna från kolumn C som är lagrade på de 4 efterföljande raderna (+2, +3, +4, +5).

### B. Kontonamn (Cellområdet B3:B6)
*   **Formel i B2:**
    ```excel
    {"";ARRAYFORMULA(IFERROR(VLOOKUP(A3:A6;Kontoplan!A:B;2;FALSE)))}
    ```
    *   **Logik:** Gör en automatisk `VLOOKUP` på kontokoderna i `A3:A6` mot bladet `'Kontoplan'` (kolumn A och B) för att live-översätta kontokoder till läsbara kontonamn.

### C. Beloppsberäkning (M2 och Debet/Kredit-uppdelning i C3:C6 & D3:D6)
Formeln i M2 beräknar de råa beloppsvärdena för bokföringsraderna, medan formlerna på rad 2 i kolumnerna C och D delar upp dessa i rena Debet- och Kredit-kolumner.

*   **Formel i M2 (Dold matris):**
    En ARRAYFORMULA som multiplicerar det valda transaktionsbeloppet (från raden med `?`) med de procentuella fördelningsnycklarna angivna i `0000_autok` för den valda mallen.
*   **Formel i C2 (Debet-kolumnen):**
    ```excel
    {"Debet";ARRAYFORMULA(IF(M3:M6>0; M3:M6; ""))}
    ```
    *   **Logik:** Sorterar ut positiva beräknade belopp till Debet-kolumnen.
*   **Formel i D2 (Kredit-kolumnen):**
    ```excel
    {"Kredit";ARRAYFORMULA(IF(M3:M6<0; ABS(M3:M6); ""))}
    ```
    *   **Logik:** Tar det absoluta värdet av negativa belopp och placerar dem i Kredit-kolumnen.

---

## 3. RÅDATA-MAPPNING (RAD 7)

För att hålla importen separerad från kalkylarkets bearbetade kärna används en matrismappning för att spegla de inklistrade bankraderna.

*   **Formel i A7 (Blad '1930'):**
    ```excel
    ={J7:J\M7:P}
    ```
    *   **Logik:** Skapar en matris som tar rådatakolumn J (Datum) och placerar i A, samt rådatakolumnerna M:P (Typ, Referens, Belopp, Saldo) och placerar i kolumnerna B:E. Detta gör att kolumnerna K och L (som kan innehålla interna bankkoder eller dolda fält) helt förbigås.

---

## 4. KONTOPLAN & AUTOMATISK VALIDERING (I 0000_AUTOK)

Inuti konfigurationsbladet `0000_autok` används formler för att säkra att de hårdkodade mallarna refererar till giltiga konton i kontoplanen.

*   **Formel i D2 (i 0000_autok):**
    ```excel
    =ARRAYFORMULA(iferror(vlookup(C2:C;Kontoplan!A:B;2;False)))
    ```
    *   **Logik:** Säkrar att alla kontonummer som skrivits in i autokonteringsmallarna (Kolumn C) faktiskt existerar i den officiella kontoplanen. Om ett konto saknas returneras ett tomt värde eller fel, vilket omedelbart flaggar felaktiga mallar innan de används.
