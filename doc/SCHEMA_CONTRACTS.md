# SCHEMA & SYSTEM CONTRACTS (SINGLE SOURCE OF TRUTH)

Denna dokumentation definierar de stenhåra arkitektoniska kontrakten mellan Google Apps Script (GAS) backend, det inbyggda gränssnittet (HTML/JS) och Google Kalkylarks inbyggda formel- och beräkningsmotor. Varje kodändring måste respektera dessa gränser för att inte korrumpera kalkylarkets dolda logik.

---

## 1. STRUKTURELL LAYOUT & DATAGRÄNSER

Kalkylarken (`1930` och `1630`) är uppbyggda med strikta rad- och zonindelningar:

| Radintervall | Syfte / Funktion | Beskrivning |
| :--- | :--- | :--- |
| **Rad 1-6** | Metadata & Konfigurationszon | Innehåller inställningar, datavalideringsceller (t.ex. `A1` för vald kategori) samt systemparametrar. |
| **Rad 2** | Dold formelzon | Innehåller avancerade matrisformler som drivs av rader markerade i F. |
| **Rad 7** | Formel-huvudzon | Innehåller dolda matriser och `ARRAYFORMULA`-huvuden (t.ex. kolumn I:s statusformel samt kolumn A:s mappingsformel). |
| **Rad 8** | Rubrikrad (Headers) | Statiska kolumnrubriker. Exempelvis måste cell `A8` i `1930` alltid innehålla `"Bokf datum"`. |
| **Rad 9+** | Transaktionsdata | Faktiska bokföringstransaktioner hämtade från bank- eller skatteexport. |

### Backend Boundary Test (Skarv- & Strukturkontroll)
All kod i GAS-backend som på något sätt läser, skriver eller ändrar rader i kalkylarket **MÅSTE** först genomföra följande valideringstest:
```javascript
// Gränskontroll för att säkra att kalkylarkets struktur är intakt
const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("1930");
if (sheet.getRange("A8").getValue() !== "Bokf datum") {
  throw new Error("KRITISKT FEL: Kalkylarkets struktur har ändrats eller rubrikraden på Rad 8 är skadad!");
}
```

---

## 2. KOLUMN I (STATUS) - STRIKT SKRIVSKYDD FÖR BACKEND

Kolumn I (`Status` / `Kontroll`) är **skrivskyddad** för GAS-backend. Den drivs helt live i kalkylarket av en matrisformel placerad i cell **I7**:

```excel
={"Kontroll";ARRAYFORMULA(IF(ROW(A8:A)<9; ""; IF(F8:F<>""; "Slutförd ("&F8:F&")"; IF(V8:V=""; ""; IF(REGEXMATCH(V8:V; "diff"); "FEL: Obalanserad"; "Buntad (Klar)")))))}
```

### Regler för statusinteraktion:
* **GAS-backend** får **ALDRIG** skriva eller rensa värden i Kolumn I.
* **GAS-backend** läser live-värdet från Kolumn I för att skicka status och färgkodning (t.ex. rött för `"FEL: Obalanserad"`, grönt för `"Buntad (Klar)"`, grått för `"Slutförd (V1)"`) till gränssnittet.

---

## 3. RÅDATA-INGESTIONSSTRUKTUR (KOLUMN J OCH FRAMÅT)

För att bevara bankens och Skatteverkets rådata intakt klistras eller importeras rådata alltid in i kolumnerna **J** och framåt. Kalkylarkets kolumner **A:E** är helt formelstyrda och mappar automatiskt från rådatakolumnerna.

### A. Blad '1930' (Företagskonto)
* **Importzon:** Rådata klistras in i kolumnerna **J:P** (börjar på Rad 9, men matningsformeln ligger i rad 7).
* **Mappningsformel i A7:**
  `={J7:J\M7:P}`
  Detta mappar rådatan dynamiskt enligt följande kontrakt:
  - Kolumn J (Bokf datum) $\rightarrow$ Kolumn A
  - Kolumn M (Transaktionstyp) $\rightarrow$ Kolumn B
  - Kolumn N (Referens) $\rightarrow$ Kolumn C
  - Kolumn O (Belopp) $\rightarrow$ Kolumn D
  - Kolumn P (Bokfört saldo) $\rightarrow$ Kolumn E
  - *Notera:* Kolumn K och L är dolda internt i kalkylarket och tas inte med i mappningen.

### B. Blad '1630' (Skattekonto)
* **Importzon:** Rådata klistras in i kolumnerna **J:M** (börjar på Rad 9).
* **Mappningskontrakt:**
  - J (Transdatum) $\rightarrow$ Kolumn A
  - K (Referens) $\rightarrow$ Kolumn B & C (Referens dupliceras eller fyller båda kolumnerna)
  - L (Belopp) $\rightarrow$ Kolumn D
  - M (Bokfört saldo) $\rightarrow$ Kolumn E

---

## 4. FLAGGLOGIK & VAL-DIAGNOSTIK

När användaren väljer en transaktionsrad i gränssnittet för att granska eller kontera den, interagerar backend med Kolumn F på följande sätt:

1. **Markering (Aktiv rad):** GAS skriver ett singeltecken-vildkort (t.ex. `'?'`, `'x'`, eller `'v'`) till Kolumn F på den valda transaktionsraden.
2. **Formelaktivering:** Detta tecken triggar kalkylarkets dolda rad 2-formler som letar efter markeringen med:
   `=match("?", '1930'!$F:$F;0)`
3. **Slutgiltig export (Buntning/SIE):** När exporten bekräftas ersätter GAS-backend vildkortstecknet i kolumn F med det permanenta, sekventiella verifikationsnumret (t.ex. `'V1'`, `'V2'`). Detta flyttar transaktionen till status "Slutförd" i kalkylarkets inbyggda formler.
