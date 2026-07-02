// INIT.JS - Huvudinitiering och globala funktioner för Google Apps Script
// Prefix: Init_

/**
 * Standard trigger onOpen i Google Kalkylark som bygger den anpassade menyn.
 */
function onOpen() {
  Init_onOpen();
}

/**
 * Bygger programmets anpassade meny.
 */
function Init_onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Bokföring & Verifikat")
    .addItem("Öppna Applikation", "Init_showSidebar")
    .addToUi();
}

/**
 * Öppnar programmets sidopanel (Sidebar).
 */
function Init_showSidebar() {
  const html = HtmlService.createTemplateFromFile("GUI")
    .evaluate()
    .setTitle("Bokförings-app SPA")
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Hjälpfunktion för att inkludera andra HTML-filer (CSS/JS) i huvudmallen.
 * @param {string} filename - Filnamnet relativt till källmappen (t.ex. "src/ui/CSS").
 * @return {string} Innehållet i HTML-filen.
 */
function Init_include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
