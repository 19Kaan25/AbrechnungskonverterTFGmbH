import * as XLSX from "xlsx";
import type { Record } from "./types";

// Ersetzt die n8n-"Extract from XLS/XLSX File"-Nodes: liest das erste Tabellenblatt
// mit der ersten Zeile als Kopfzeile und liefert Objekte (Spaltenname -> Wert).
// SheetJS erkennt .xls (BIFF) und .xlsx automatisch am Dateiinhalt.
//
// headerContains: wenn die Kopfzeile nicht in Zeile 1 steht (z.B. HVS mit Briefkopf),
// wird in den ersten Zeilen nach einer Zelle mit genau diesem Text gesucht.
export function parseExcel(buffer: ArrayBuffer, headerContains?: string): Record[] {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array" });
  } catch (err) {
    // verschlüsselte Datei -> verständliche Meldung statt SheetJS-Fehler
    if (err instanceof Error && /password|encrypt/i.test(err.message)) {
      throw new Error(
        "Die Datei ist passwortgeschützt. Bitte erst in Excel öffnen und ohne Passwort speichern.",
      );
    }
    throw err;
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];

  let headerRow = 0;
  if (headerContains) {
    const lines = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
    const found = lines
      .slice(0, 10)
      .findIndex((line) => line.some((cell) => String(cell).trim() === headerContains));
    // nicht gefunden -> Zeile 1 nehmen, requireColumns meldet dann die fehlenden Spalten
    if (found > 0) headerRow = found;
  }

  return XLSX.utils.sheet_to_json<Record>(ws, { defval: "", range: headerRow });
}
