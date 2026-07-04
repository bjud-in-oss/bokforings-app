// FILEPICKER.JS - Logik för Drive-integration, verifikatssökning och uppladdning
// Prefix: Drive_

/**
 * Utför en uppåtgående traversering (Upward Hierarchy Traversal) för att hitta
 * en fyrsiffrig mapp ("YYMM", t.ex. "2507") och returnera en relativ sökväg.
 * 
 * @param {string} fileId - ID för filen i Google Drive.
 * @return {Object} Status och sökvägssträng.
 */
function Drive_resolvePathAsynchronously(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    let current = file;
    const pathParts = [file.getName()];
    let foundYYMM = null;
    
    // Traversera uppåt i hierarkin
    let safetyCounter = 0;
    while (safetyCounter < 10) {
      safetyCounter++;
      const parents = current.getParents();
      if (!parents.hasNext()) {
        break;
      }
      
      const parent = parents.next();
      const parentName = parent.getName().trim();
      pathParts.unshift(parentName);
      
      // Kontrollera om mappen är fyrsiffrig YYMM (t.ex. 2507 eller 2601)
      if (/^\d{4}$/.test(parentName)) {
        foundYYMM = parentName;
        // Vi slutar inte direkt, vi vill bygga hela sökvägen upp till rot eller lagom nivå
      }
      current = parent;
    }
    
    return {
      success: true,
      path: pathParts.join(" / "),
      yymm: foundYYMM,
      fileName: file.getName()
    };
  } catch (err) {
    return {
      success: false,
      error: err.toString()
    };
  }
}

/**
 * Sparar Google Drive-filens URL i Kolumn H (kolumn 8) för vald transaktionsrad.
 * Garanterar att Kolumn I lämnas HELT orörd för att skydda kalkylarkets formelmotor!
 * 
 * @param {string} sheetName - Namnet på bladet ("1930" eller "1630").
 * @param {number} rowNum - Radnummer i kalkylarket (>= 9).
 * @param {string} fileId - ID för filen på Google Drive.
 * @return {Object} Status och sparad URL.
 */
function Drive_linkReceiptToRow(sheetName, rowNum, fileId) {
  try {
    // 1. Boundary-test och valideringar
    if (sheetName !== "1930" && sheetName !== "1630") {
      throw new Error("Ogiltigt bladnamn.");
    }
    const row = Number(rowNum);
    if (isNaN(row) || row < 9) {
      throw new Error("Ogiltigt radnummer. Måste vara rad 9 eller senare.");
    }
    
    const file = DriveApp.getFileById(fileId);
    const url = file.getUrl();
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error("Kunde inte hitta bladet " + sheetName);
    }
    
    // 2. Skriv enbart till Kolumn H (Kolumn 8)
    const range = sheet.getRange(row, 8);
    range.setValue(url);
    
    // Vi rör ALDRIG Kolumn I (kolumn 9) då den innehåller dolda, komplexa skyddade formler.
    
    return {
      success: true,
      url: url,
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
 * Byter namn på en fil i Google Drive för att bibehålla en strukturerad namngivning.
 * 
 * @param {string} fileId - ID på filen som ska döpas om.
 * @param {string} newName - Det nya filnamnet.
 * @return {Object} Status och det nya namnet.
 */
function Drive_renameFile(fileId, newName) {
  try {
    if (!newName || newName.trim() === '') {
      throw new Error("Filnamnet får inte vara tomt.");
    }
    const file = DriveApp.getFileById(fileId);
    file.setName(newName.trim());
    return {
      success: true,
      name: file.getName()
    };
  } catch (err) {
    return {
      success: false,
      error: err.toString()
    };
  }
}

/**
 * Flyttar en fil till en specifik målmapp på Google Drive.
 * 
 * @param {string} fileId - ID för filen som ska flyttas.
 * @param {string} targetFolderId - ID för målmappen.
 * @return {Object} Status.
 */
function Drive_moveFile(fileId, targetFolderId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const targetFolder = DriveApp.getFolderById(targetFolderId);
    
    // Hämta alla nuvarande föräldrar och ta bort filen från dem
    const parents = file.getParents();
    while (parents.hasNext()) {
      const parent = parents.next();
      parent.removeFile(file);
    }
    
    // Lägg till filen i den nya målmappen
    targetFolder.addFile(file);
    return {
      success: true
    };
  } catch (err) {
    return {
      success: false,
      error: err.toString()
    };
  }
}

/**
 * Tar emot Base64-kodad fildata och laddar upp den direkt till Google Drive.
 * 
 * @param {string} base64Data - Base64-sträng innehållande filens data.
 * @param {string} fileName - Filnamn att ge den skapade filen.
 * @param {string} mimeType - Filens MIME-typ (t.ex. "application/pdf").
 * @param {string} [folderId] - Valfritt ID för mappen där filen ska placeras.
 * @return {Object} Status, skapat ID samt URL.
 */
function Drive_uploadFile(base64Data, fileName, mimeType, folderId) {
  try {
    const decoded = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decoded, mimeType, fileName);
    
    let folder;
    if (folderId) {
      folder = DriveApp.getFolderById(folderId);
    } else {
      // Om inget mapp-ID anges, spara i programmets rot eller Skannat-rot om den hittas
      const folders = DriveApp.getFoldersByName("Skannat");
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.getRootFolder();
      }
    }
    
    const file = folder.createFile(blob);
    return {
      success: true,
      fileId: file.getId(),
      url: file.getUrl(),
      name: file.getName()
    };
  } catch (err) {
    return {
      success: false,
      error: err.toString()
    };
  }
}
