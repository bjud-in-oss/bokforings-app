/**
 * Kontrollerar att kalkylarkets struktur är intakt (Boundary Test).
 * @param {string} sheetName - Namnet på bladet som ska valideras (t.ex. '1930' eller '1630').
 * @return {boolean} True om testet godkänns.
 * @throws {Error} Om strukturen är skadad eller rubrikraden saknas.
 */
function Utils_verifySchema(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("KRITISKT FEL: Kalkylbladet '" + sheetName + "' saknas!");
  }
  
  // Läs rubriken i cell A8
  const headerValue = sheet.getRange("A8").getValue();
  if (headerValue !== "Bokf datum") {
    throw new Error("KRITISKT FEL: Kalkylarkets struktur har ändrats eller rubrikraden på Rad 8 är skadad!");
  }
  
  return true;
}
