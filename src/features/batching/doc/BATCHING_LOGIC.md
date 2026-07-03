# SYSTEM LOGIC: BATCHING & STATE MANAGEMENT CONTRACT

## 1. TILLSTÅNDSGENERATORN (`Batch_getInitialState`)
Backend-funktionen `Batch_getInitialState(sheetName)` är applikationens primära datakälla vid uppstart och omladdning. Den garanterar att frontend alltid har en korrekt, synkroniserad representation av kalkylarkets sanna tillstånd.

### Steg-för-steg exekvering i backend:
1. **Schema Boundary Test:**
   * Anropa `Utils_verifySchema(sheetName)` innan någon annan logik körs. Detta förhindrar exekvering mot ett korrupt eller felaktigt strukturerat kalkylblad.
2. **Datainsamling (Rad 9 och nedåt):**
   * Läs in data från det valda kalkylbladet (tillåt endast `'1930'` eller `'1630'`).
   * Bygg en JSON-array av transaktioner där varje rad innehåller:
     * `row`: Radnummer i kalkylarket (heltall, $\ge 9$).
     * `date`: Transaktionsdatum (formaterad sträng eller rådatum).
     * `text`: Beskrivning / Transaktionstext (Kolumn C).
     * `amount`: Beräknat belopp (Debet - Kredit eller netto).
     * `editedAmount`: Manuellt ändrat belopp (från Kolumn E).
     * `flag`: Flagga / Singeltecken (Kolumn F).
     * `comment`: Kommentar / Anteckningar (Kolumn G).
     * `link`: Hyperlänk till verifikat (Kolumn H).
     * `status`: Status / Varning (Kolumn I).
     * `batchStatus`: Buntningsstatus / Gruppering.
3. **Dynamisk Räkenskapsårs-analys (Brutna år):**
   * Systemet loopar igenom alla insamlade transaktionsdatum.
   * Använd en `Set` för att identifiera unika brutna räkenskapsår (format `"ÅÅÅÅ/ÅÅÅÅ"`, där brytpunkten är satt till 1 juli).
   * Sortera dessa år i fallande ordning för presentation i dropdown-menyn.

---

## 2. FOKUSHANTERING & TARGET ROW
När applikationen startar eller laddar om, måste fokus flyttas till den rad där användaren senast befann sig eller där åtgärd krävs:

1. **Sökning efter Flagga:**
   * Backend söker uppifrån och ned i Kolumn F efter ett singeltecken (längd 1, t.ex. `'?'`, `'x'`, `'v'`).
   * Om ett singeltecken hittas, sätts denna rad direkt som `targetRow` (eller `activeRow`).
2. **Fallback till Aktiv Cell:**
   * Om inget singeltecken hittas i Kolumn F, läses den aktiva cellens radnummer via `sheet.getActiveCell().getRow()`.
   * **Stenhård spärr:** Radnumret valideras mot dataraden. Om radnumret är $< 9$, tvingas det till fallback-raden $9$ (absolut första dataraden).

---

## 3. UX STATE MACHINE (FLIK-HOPPNING)
Frontend lyssnar på val av transaktionsrad och styr automatiskt flik-navigeringen för att ge ett optimalt och snabbt flöde:

```
                  [ Användaren väljer rad ]
                             |
              Is currentRowData.link present?
                 /                       \
               Nej                       Ja
               /                           \
  [ Byt till flik: Verifikat ]    [ Byt till flik: Kontering ]
  * Drive-väljaren aktiveras      * Drive-väljaren döljs
  * Sök filsökväg asynkront       * Klar för omedelbar kontering
               \                           /
                \                         /
            [ Användaren genomför buntning ]
                             |
          [ Återvänd automatiskt till: Bokföring ]
```

### Regler för flik-växling:
* **Flik 'Verifikat' (Kopplingsvyn):** Aktiveras omedelbart om en rad saknar länk. Användaren kan då snabbt koppla rätt underlag från Drive. Så fort filen kopplas och sparas i kalkylarket (Kolumn H), växlar vyn direkt över till fliken **Kontering**.
* **Flik 'Kontering' (Mallar & Redigering):** Aktiveras direkt om raden redan har en länk. Drive-väljaren döljs helt eftersom underlaget redan är identifierat, vilket sparar skärmyta och klick.
* **Flik 'Bokföring' (Huvudlistan):** När buntningen eller avbuntningen är slutförd, skickas användaren omedelbart tillbaka till huvudvyn för att smidigt kunna fortsätta med nästa rad i kön.
