// BATCHLOGIC.JS - Logik för temporär buntning, tillståndshantering och radsökning
// Prefix: Batch_

/**
 * Hämtar det tillhörande brutna räkenskapsåret ("ÅÅÅÅ/ÅÅÅÅ") baserat på brytpunkt 1 juli.
 * @param {Date|string} dateVal - Datumet som ska analyseras.
 * @return {string|null} Räkenskapsår på formatet "ÅÅÅÅ/ÅÅÅÅ", eller null.
 */
function Batch_getBrokenFiscalYear(dateVal) {
  let dateObj = null;
  if (dateVal instanceof Date) {
    dateObj = dateVal;
  } else if (typeof dateVal === 'string' && dateVal.trim() !== '') {
    dateObj = new Date(dateVal);
  }
  
  if (!dateObj || isNaN(dateObj.getTime())) {
    return null;
  }
  
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth(); // 0-indexed: 0 = Jan, 5 = Jun, 6 = Jul
  
  if (month < 6) { // Jan - Jun
    return (year - 1) + "/" + year;
  } else { // Jul - Dec
    return year + "/" + (year + 1);
  }
}

/**
 * Hämtar det initiala tillståndet för klientsidan (aktivt blad, rad, transaktioner, tillgängliga år etc.)
 * efter att ha genomfört ett Boundary Test (Schema-validering).
 * 
 * @param {string} [sheetName] - Valfritt bladnamn (t.ex. '1930' eller '1630').
 * @return {Object} Starttillstånd i form av ett JSON-objekt.
 */
function Batch_getInitialState(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Om inget blad anges, använd aktivt blad om det är giltigt, annars '1930'
  if (!sheetName) {
    const activeSheet = ss.getActiveSheet();
    sheetName = activeSheet.getName();
  }
  if (sheetName !== "1930" && sheetName !== "1630") {
    sheetName = "1930";
  }
  
  // 1. Boundary Test: Verifiera kalkylarkets struktur
  Utils_verifySchema(sheetName);
  
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  
  const transactions = [];
  const yearsSet = new Set();
  
  // Lägg till relevanta standardår i Set för att säkerställa att vi har giltig data även vid tomma ark
  yearsSet.add("2024/2025");
  yearsSet.add("2025/2026");
  yearsSet.add("2026/2027");
  
  // 2. Sök efter målad (targetRow / activeRow) baserat på singeltecken i Kolumn F
  let activeRow = -1;
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
  
  // Fallback: Om inget singeltecken hittades, använd aktiv cell (Säkerhetsspärr: minst rad 9)
  if (activeRow === -1) {
    const activeCell = sheet.getActiveCell();
    const activeCellRow = activeCell.getRow();
    if (activeCellRow >= 9) {
      activeRow = activeCellRow;
    } else {
      activeRow = 9; // Fallback till absolut första datarad
    }
  }
  
  // 3. Datainsamling (Kolumn A till I och Kolumn V)
  if (lastRow >= 9) {
    const dataRange = sheet.getRange(9, 1, lastRow - 8, 9).getValues();
    const vRange = sheet.getRange(9, 22, lastRow - 8, 1).getValues();
    
    for (let i = 0; i < dataRange.length; i++) {
      const rowNum = i + 9;
      const dateVal = dataRange[i][0];
      const textType = dataRange[i][1];
      const textVal = dataRange[i][2];
      const amountVal = dataRange[i][3];
      const editedAmountVal = dataRange[i][4];
      const flagVal = dataRange[i][5];
      const commentVal = dataRange[i][6];
      const linkVal = dataRange[i][7];
      const statusVal = dataRange[i][8];
      const batchStatusVal = vRange[i][0];
      
      const fYear = Batch_getBrokenFiscalYear(dateVal);
      if (fYear) {
        yearsSet.add(fYear);
      }
      
      let dateString = "";
      if (dateVal instanceof Date) {
        // Enkel ISO-formatering i stället för tung Utilities.formatDate för snabbare rendering lokalt
        const y = dateVal.getFullYear();
        const m = String(dateVal.getMonth() + 1).padStart(2, '0');
        const d = String(dateVal.getDate()).padStart(2, '0');
        dateString = `${y}-${m}-${d}`;
      } else {
        dateString = dateVal ? String(dateVal).split('T')[0] : "";
      }
      
      transactions.push({
        row: rowNum,
        date: dateString,
        type: String(textType),
        text: String(textVal),
        amount: Number(amountVal) || 0,
        editedAmount: editedAmountVal !== "" && editedAmountVal !== null ? Number(editedAmountVal) : null,
        flag: String(flagVal),
        comment: String(commentVal),
        link: String(linkVal),
        status: String(statusVal),
        batchStatus: String(batchStatusVal),
        fiscalYear: fYear || "2025/2026" // Standard-fallbacks
      });
    }
  }
  
  // Sortera tillgängliga år i fallande ordning
  const availableYears = Array.from(yearsSet).sort().reverse();
  
  // Hitta aktivt räkenskapsår utifrån vald rad
  let currentYear = "2025/2026";
  const focusIndex = activeRow - 9;
  if (focusIndex >= 0 && focusIndex < transactions.length) {
    const focusTx = transactions[focusIndex];
    if (focusTx && focusTx.fiscalYear) {
      currentYear = focusTx.fiscalYear;
    }
  }
  
  if (!yearsSet.has(currentYear) && availableYears.length > 0) {
    currentYear = availableYears[0];
  }
  
  return {
    sheet: sheetName,
    activeRow: activeRow,
    currentYear: currentYear,
    availableYears: availableYears,
    transactions: transactions
  };
}
