import Papa from "papaparse";
import type { Record } from "./types";

// Ersetzt den n8n-"Extract from File"-Node: parst CSV-Text in Objekte, deren Schlüssel
// die Spaltennamen aus der Kopfzeile sind. Delimiter ist ';' (deutsches CSV).
export function parseCsv(text: string, sourceLabel = "CSV"): Record[] {
  const result = Papa.parse<Record>(text, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    const details = result.errors
      .slice(0, 5)
      .map((error) => {
        const row = typeof error.row === "number" ? `Zeile ${error.row + 2}: ` : "";
        return `${row}${error.message}`;
      })
      .join("; ");
    const suffix = result.errors.length > 5 ? "; …" : "";
    throw new Error(
      `${sourceLabel}: Die Tabellenstruktur konnte nicht sicher gelesen werden. ${details}${suffix}`,
    );
  }

  return result.data;
}
