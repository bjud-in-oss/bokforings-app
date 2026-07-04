// TEMPLATEENGINE.JS - Logik för kalkylarkets dolda formelmotor och konteringsmallar
// Prefix: Template_

/**
 * Rensar gamla "?" markörer i Kolumn F, skriver "?" till den aktuella raden,
 * sätter vald kategori i cell A1, flushar kalkylarket och läser ut konteringsresultatet i A3:D6.
 * 
 * @param {string} sheetName - Namnet på bladet ("1930" eller "1630").
 * @param {number} rowNum - Transaktionens radnummer (>= 9).
 * @param {string} categoryName - Namnet på vald konteringskategori (t.ex. "_Hyra").
 * @return {Object} De utlästa konteringsraderna samt eventuellt beräknat momsbelopp.
 */
function Template_loadTemplateForTransaction(sheetName, rowNum, categoryName) {
  try {
    if (sheetName !== "1930" && sheetName !== "1630") {
      throw new Error("Ogiltigt bladnamn.");
    }
    const row = Number(rowNum);
    if (isNaN(row) || row < 9) {
      throw new Error("Ogiltigt radnummer. Måste vara rad 9 eller senare.");
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error("Kunde inte hitta bladet " + sheetName);
    }
    
    // 1. Renslighet i Kolumn F: Ta bort gamla "?" på alla rader
    const lastRow = Math.max(sheet.getLastRow(), 20);
    const fRange = sheet.getRange(9, 6, lastRow - 8, 1);
    const fValues = fRange.getValues();
    let updatedF = false;
    for (let i = 0; i < fValues.length; i++) {
      if (fValues[i][0] === "?") {
        fValues[i][0] = "";
        updatedF = true;
      }
    }
    if (updatedF) {
      fRange.setValues(fValues);
    }
    
    // 2. Sätt sökmarkören "?" på den valda transaktionsraden
    sheet.getRange(row, 6).setValue("?");
    
    // 3. Sätt vald kategori i cell A1
    sheet.getRange("A1").setValue(categoryName);
    
    // 4. Tvinga synkronisering och beräkning av kalkylarkets inbyggda formelmotor
    SpreadsheetApp.flush();
    
    // 5. Läs ut konteringsförslaget från matrisen A3:D6
    const matrixRange = sheet.getRange("A3:D6");
    const matrixValues = matrixRange.getValues();
    
    const rows = [];
    let momsAmount = 0;
    
    for (let i = 0; i < matrixValues.length; i++) {
      const account = String(matrixValues[i][0]).trim();
      const name = String(matrixValues[i][1]).trim();
      const debet = Number(matrixValues[i][2]) || 0;
      const kredit = Number(matrixValues[i][3]) || 0;
      
      // Hoppa över tomma rader i formelresultatet
      if (!account || account === "0" || (debet === 0 && kredit === 0)) {
        continue;
      }
      
      rows.push({
        account: account,
        name: name,
        debet: debet,
        kredit: kredit
      });
      
      // Moms-radar (konto 2641 Ingående moms)
      if (account === "2641") {
        momsAmount = Math.abs(debet - kredit);
      }
    }
    
    return {
      success: true,
      rows: rows,
      momsAmount: momsAmount,
      row: row,
      sheet: sheetName
    };
  } catch (err) {
    return {
      success: false,
      error: err.toString()
    };
  }
}

/**
 * Sparar den slutgiltiga konteringen.
 * Skriver vald kategori till Kolumn G, sätter tillståndet till "v" (Veriferad) i Kolumn F,
 * samt sparar eventuellt beräknat momsbelopp i Kolumn Q.
 * Garanterar att kalkylarkets dolda formler i Kolumn I är helt skyddade!
 * 
 * @param {string} sheetName - Namnet på bladet ("1930" eller "1630").
 * @param {number} rowNum - Radnummer i kalkylarket (>= 9).
 * @param {string} categoryName - Den slutgiltiga kategorin (t.ex. "_Hyra").
 * @param {Array} finalRows - Detaljerade konteringsrader (används för ev. framtida loggning eller validering).
 * @param {number} momsAmount - Det beräknade momsbeloppet som sparas i Kolumn Q.
 * @return {Object} Status.
 */
function Template_saveJournalEntry(sheetName, rowNum, categoryName, finalRows, momsAmount) {
  try {
    if (sheetName !== "1930" && sheetName !== "1630") {
      throw new Error("Ogiltigt bladnamn.");
    }
    const row = Number(rowNum);
    if (isNaN(row) || row < 9) {
      throw new Error("Ogiltigt radnummer. Måste vara rad 9 eller senare.");
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error("Kunde inte hitta bladet " + sheetName);
    }
    
    // 1. Skriv vald kategori till Kolumn G (Kolumn 7)
    sheet.getRange(row, 7).setValue(categoryName);
    
    // 2. Ersätt sökmarkören "?" i Kolumn F (Kolumn 6) med tillståndsflaggan "v" (Veriferad/Klar för buntning)
    // Detta tillåter efterföljande export- eller buntningsprocesser utan att skriva över framtida V-nummer.
    sheet.getRange(row, 6).setValue("v");
    
    // 3. Om vi har ett momsbelopp, spara det i Kolumn Q (Kolumn 17) för momsredovisningen
    if (momsAmount > 0) {
      sheet.getRange(row, 17).setValue(momsAmount);
    }
    
    // Vi lämnar Kolumn I (kolumn 9) helt orörd. Kalkylarkets formel räknar automatiskt ut ny status!
    
    return {
      success: true,
      row: row,
      sheet: sheetName
    };
  } catch (err) {
    return {
      success: false,
      error: err.toString()
    };
  }
}

/**
 * Parsar en extern lönespecifikation från en Google Sheets-länk.
 * Läser cellområdet B9:F70 från fliken 'Lön' i det externa kalkylarket.
 * 
 * @param {string} externalSpreadsheetUrl - Fullständig URL till det externa lönekalkylarket.
 * @return {Object} Lönerader redo för kontering.
 */
function Template_parseSalarySpecification(externalSpreadsheetUrl) {
  try {
    if (!externalSpreadsheetUrl) {
      throw new Error("Ingen URL angiven.");
    }
    
    // Extrahera Spreadsheet ID från URL via reguljärt uttryck
    const match = externalSpreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      throw new Error("Giltigt Google Spreadsheet ID kunde inte hittas i URL:en.");
    }
    
    const extId = match[1];
    const extSS = SpreadsheetApp.openById(extId);
    const extSheet = extSS.getSheetByName("Lön");
    if (!extSheet) {
      throw new Error("Kunde inte hitta fliken 'Lön' i det länkade kalkylarket.");
    }
    
    // Läs cellområde B9:F70
    const values = extSheet.getRange("B9:F70").getValues();
    const rows = [];
    
    for (let i = 0; i < values.length; i++) {
      const account = String(values[i][0]).trim(); // Kolumn B (Konto)
      const name = String(values[i][1]).trim();    // Kolumn C (Kontonamn)
      const debet = Number(values[i][3]) || 0;     // Kolumn E (Debet)
      const kredit = Number(values[i][4]) || 0;    // Kolumn F (Kredit)
      
      if (!account || account === "" || (debet === 0 && kredit === 0)) {
        continue;
      }
      
      rows.push({
        account: account,
        name: name,
        debet: debet,
        kredit: kredit
      });
    }
    
    return {
      success: true,
      rows: rows
    };
  } catch (err) {
    return {
      success: false,
      error: err.toString()
    };
  }
}
