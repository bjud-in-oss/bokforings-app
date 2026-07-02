// BATCHLOGIC.JS - Logik för temporär buntning och radsökning
// Prefix: Batch_

/**
 * Hämtar det initiala tillståndet för klientsidan (aktivt blad, rad, år etc.)
 * efter att ha genomfört ett Boundary Test (Schema-validering).
 * 
 * @return {Object} Initialt tillstånd.
 */
function Batch_getInitialState() {
  // 1. Kör säkerhetstestad gränsdragningskontroll på 1930 (default-bladet)
  Utils_verifySchema("1930");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getActiveSheet();
  let sheetName = sheet.getName();
  
  // Säkerställ att vi är på något av de två godkända bladen, annars fallback på "1930"
  if (sheetName !== "1930" && sheetName !== "1630") {
    sheetName = "1930";
    sheet = ss.getSheetByName(sheetName);
  }
  
  let activeRow = -1;
  const lastRow = sheet.getLastRow();
  
  // Sök efter ett singeltecken (längd 1, t.ex. '?', 'x' eller 'v') i Kolumn F (från rad 9 till sista raden)
  if (lastRow >= 9) {
    const fValues = sheet.getRange(9, 6, lastRow - 8, 1).getValues();
    for (let i = 0; i < fValues.length; i++) {
      const val = String(fValues[i][0]).trim();
      if (val.length === 1) {
        activeRow = i + 9;
        break;
      }
    }
  }
  
  // Fallback: Om inget singeltecken hittades, kontrollera om den aktiva cellen är på rad >= 9
  if (activeRow === -1) {
    const activeCell = sheet.getActiveCell();
    const activeCellRow = activeCell.getRow();
    if (activeCellRow >= 9) {
      activeRow = activeCellRow;
    } else {
      activeRow = 9; // Fallback till absolut första datarad (Säkerhetsspärr: minst rad 9)
    }
  }
  
  // Fastställ tillgängliga år och aktivt år (hårdkodat enligt specifikation eller dynamiskt framgent)
  const currentYear = "2025/2026";
  const availableYears = ["2023/2024", "2024/2025", "2025/2026"];
  
  return {
    sheet: sheetName,
    activeRow: activeRow,
    currentYear: currentYear,
    availableYears: availableYears
  };
}
