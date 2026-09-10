// Zielformat einer Abrechnungszeile (entspricht der n8n-CSV: VS-Nummer;VN-Name;Provision;KA)
export interface Row {
  vs: string; // VS-Nummer
  vn: string; // VN-Name
  prov: string; // Provision im deutschen Format (Komma als Dezimaltrennzeichen)
  ka: string; // Kennung: '1' oder '0'
}

// Ein Datensatz aus einer geparsten CSV-/Excel-Datei: Spaltenname -> Wert
export type Record = { [key: string]: unknown };

// Ergebnis einer Konvertierung
export interface ConvertResult {
  filename: string;
  csv: string; // vollständiger CSV-Text inkl. BOM
  rowCount: number; // Anzahl der Datenzeilen (ohne Kopfzeile)
  warnings: string[]; // nicht-blockierende Hinweise aus der Laufzeit-Inhaltsprüfung
}

// Eingabemodus, abgeleitet aus dem hochgeladenen Dateityp
export type Mode = "csv" | "xls" | "xlsx";
