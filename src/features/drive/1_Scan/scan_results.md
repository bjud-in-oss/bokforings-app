# Scan: Drive Integration (Verifikat)

## 1. Analys av källkod och specifikation
* **Historisk källkod (`FilePicker.js`)**: Filen innehåller för närvarande endast initiala kommentarer och prefixet `Drive_`. Ingen faktisk logik är implementerad ännu.
* **Pseudokod & Specifikation (`DRIVE_LOGIC.md`)**:
  * Definierar 5 nyckelfunktioner för backend:
    1. `Drive_resolvePathAsynchronously(fileId)`: Utför en uppåtgående traversering (Upward Hierarchy Traversal) för att hitta en fyrsiffrig mapp (`YYMM`, t.ex. `2507`) och bygga en relativ sökvägssträng.
    2. `Drive_linkReceiptToRow(sheetName, rowNum, fileId)`: Sparar den fullständiga Drive-URL:en i kolumn H (kolumn 8) för vald transaktionsrad.
    3. `Drive_renameFile(fileId, newName)`: Byter namn på en fil i Drive.
    4. `Drive_moveFile(fileId, targetFolderId)`: Flyttar en fil till en ny föräldramapp.
    5. `Drive_uploadFile(base64Data, fileName, mimeType, folderId)`: Tar emot base64-data och skapar en ny fil i Drive.

## 2. Gränssnittets interaktioner
* I `BatchView.html` (`BatchView_selectIndex`):
  * När en transaktion väljs kontrolleras om den har en länk (`tx.link`).
  * Om länk saknas: Växlar automatiskt till fliken `tab-verification`. Visar ett sökmeddelande och simulerar en Drive-sökning (visar en fil med knapp för att koppla).
  * Om länk finns: Växlar automatiskt till fliken `tab-journal` (Kontering).
  * Vid klick på "Koppla fil"-knappen körs `BatchView_mockSaveLink` som simulerar länkning av filen till raden på kalkylarket.

## 3. Systembegränsningar & Riskbedömning
* **Google Drive API Latency**: Sökningar och rekursiv traversering uppåt kan ta allt från 200 ms till flera sekunder beroende på mappdjup. Eftersom vi gör detta asynkront vid behov (lazy-load) påverkar det inte applikationens initiala laddningstid.
* **6-minutersgränsen i Apps Script**: Helt irrelevant för enskilda filoperationer då de slutförs på bråkdelar av en sekund. Skulle dock kunna bli en faktor om man utför mass-traversering av hundratals filer i en och samma exekvering (vilket vi inte gör här).
* **Lokalt utvecklingsläge (dev-server)**: Eftersom `google.script.run` inte existerar lokalt, måste vi säkerställa robust felhantering och välfungerande mock-data i klientsidan för att bibehålla en sömlös utvecklingsupplevelse.
