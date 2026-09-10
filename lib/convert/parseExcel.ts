import * as XLSX from "xlsx";
import type { Record } from "./types";

// Ersetzt die n8n-"Extract from XLS/XLSX File"-Nodes: liest das erste Tabellenblatt
// mit der ersten Zeile als Kopfzeile und liefert Objekte (Spaltenname -> Wert).
// SheetJS erkennt .xls (BIFF) und .xlsx automatisch am Dateiinhalt.
export function parseExcel(buffer: ArrayBuffer): Record[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Record>(ws, { defval: "" });
}
