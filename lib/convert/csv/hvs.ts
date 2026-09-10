import type { Record, Row } from "../types";
import { safe, findExactKey } from "../buildCsv";
import { requireColumns } from "../validate";

// HVS liefert semikolongetrennte TXT-Dateien in Latin1. In echten Dateien kann die
// Kopfzeile nur mit CR enden, während die Datenzeilen CRLF verwenden. Ohne vorherige
// Normalisierung interpretiert Papa Parse die erste Datenzeile teilweise als Kopfzeile.
export function normalizeHvsText(text: string): string {
  return text.replace(/\r\n|\r|\n/g, "\n");
}

// HVS:
//   Vertrag               -> VS-Nummer
//   Versicherungsnehmer   -> VN-Name (angehängte Straße/PLZ/Ort werden entfernt)
//   Courtage               -> Provision; exakt diese Spalte, nicht "Gesamt-Courtage"
//   Prozentsatz            -> nur 4 < Satz < 51 übernehmen
//   KA                     -> für übernommene Zeilen immer "1"
export function cleanHvsName(value: unknown): string {
  const normalized = safe(value).replace(/\s+/g, " ").trim();

  // Üblicher HVS-Aufbau: "VN-Name, Straße Hausnummer, 12345 Ort". Wir suchen
  // zuerst den eindeutigen fünfstelligen PLZ-Block und entfernen anschließend
  // auch die direkt davorstehende Straßenkomponente. Frühere Kommas bleiben
  // erhalten, weil sie zum Namen gehören können (z. B. "Beispiel, Anna" oder
  // "Tabak, Lotto, Presseshop"). Ohne dieses klare Muster bleibt der Wert stehen.
  const postalCodeSeparator = normalized.search(/,\s*\d{5}(?:\s|$)/);
  if (postalCodeSeparator === -1) return normalized;

  const beforePostalCode = normalized.slice(0, postalCodeSeparator);
  const streetSeparator = beforePostalCode.lastIndexOf(",");
  if (streetSeparator === -1) return normalized;

  return beforePostalCode
    .slice(0, streetSeparator)
    .replace(/\s+c\/o\b.*$/i, "")
    .trim()
    .replace(/\s+,/g, ",");
}

export function rows(records: Record[]): Row[] {
  if (records.length > 0) {
    requireColumns(records[0], "HVS", [
      { exact: "Vertrag" },
      { exact: "Versicherungsnehmer" },
      { exact: "Courtage" },
      { exact: "Prozentsatz" },
    ]);
  }

  const out: Row[] = [];
  for (const e of records) {
    const vsKey = findExactKey(e, "Vertrag") ?? "Vertrag";
    const vnKey = findExactKey(e, "Versicherungsnehmer") ?? "Versicherungsnehmer";
    const provKey = findExactKey(e, "Courtage") ?? "Courtage";
    const pctKey = findExactKey(e, "Prozentsatz") ?? "Prozentsatz";

    const vs = safe(e[vsKey]);
    if (vs === "") continue;

    const pct = parseFloat(String(e[pctKey] ?? "").trim().replace(",", "."));
    if (isNaN(pct) || !(pct > 4 && pct < 51)) continue;

    const vn = cleanHvsName(e[vnKey]);
    // Tausenderpunkte und Füllleerzeichen entfernen; Dezimalkomma bleibt erhalten.
    const prov = String(e[provKey] ?? "")
      .trim()
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(/;/g, ",");

    out.push({ vs, vn, prov, ka: "1" });
  }
  return out;
}
