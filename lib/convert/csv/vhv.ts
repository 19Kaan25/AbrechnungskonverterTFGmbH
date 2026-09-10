import type { Row } from "../types";
import { parseCsv } from "../parseCsv";
import { safe } from "../buildCsv";
import { requireColumns } from "../validate";
import { validateInputContent } from "../contentValidation";

// VHV hat einen ungewöhnlichen Aufbau:
//   - 4 Kopf-/Logozeilen VOR der eigentlichen Tabellen-Kopfzeile
//     (die echte Kopfzeile ist die, die "Vers.Schein-Nr." enthält)
//   - am Ende Summenzeilen (Vers.Schein-Nr. = "*** 20 ***" o.ä. oder leer),
//     die keine echten Verträge sind und übersprungen werden.
//   - Datei ist Latin1-kodiert, Werte sind mit Leerzeichen aufgefüllt.
//
// Mapping:
//   VS-Nummer  = Vers.Schein-Nr., führende Nullen werden entfernt sowohl im Segment
//                NACH dem "-" (z.B. "577-010001" -> "577-10001") als auch, falls
//                vorhanden, im Segment NACH einem "/" (Sparten-Verträge einer Person,
//                z.B. "177-100002/0006" -> "177-100002/6"). Das 3-stellige Präfix VOR
//                dem "-" bleibt unangetastet, auch wenn es selbst mit "0" beginnt
//                (z.B. "006-100001" bleibt "006-100001").
//   VN-Name    = "Name 1, Name 2" (Nachname, Vorname); fehlt einer, nur der andere ohne Komma
//   Provision  = Prov.Betrag (deutsches Format; Tausenderpunkte werden entfernt)
//   KA         = immer "1"
// Übernommen werden nur Zeilen mit 4 < Prov % < 51.
//
// WICHTIG: Stornos/Abgänge sind als NEGATIVE Beträge kodiert, wobei das Minuszeichen
// durch Füll-Leerzeichen von der Zahl getrennt ist (z.B. "-         12,80"). Diese
// Beträge müssen abgezogen werden. Deshalb werden vor dem Parsen ALLE Leerzeichen
// entfernt ("-         12,80" -> "-12,80"). Die anschließende Aggregation summiert
// Buchung und Storno korrekt zusammen.
//
// Echte VS-Nummern, die es NICHT in die Ausgabe schaffen (z.B. weil ein Wert fehlt
// oder der Satz außerhalb des Bereichs liegt), werden als "notListed" zurückgegeben,
// damit nichts stillschweigend verschwindet.

export interface VhvResult {
  rows: Row[];
  notListed: string[];
  warnings: string[];
}

// Entfernt ALLE Leerzeichen (inkl. der zwischen "-" und Zahl) und wandelt das deutsche
// Zahlformat in eine JS-Zahl um. "-         12,80" -> -12.8 ; "25,000" -> 25 ; "" -> NaN
function parseGermanNumber(s: string): number {
  return parseFloat(s.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
}

// Bereinigt einen Betrag zu sauberem deutschen Format mit Vorzeichen, ohne Leerzeichen
// und ohne Tausenderpunkte: "-         12,80" -> "-12,80" ; "1.234,56" -> "1234,56".
function cleanGermanAmount(s: string): string {
  return s.replace(/\s/g, "").replace(/\./g, "");
}

// Entfernt führende Nullen aus einem String (mind. eine Ziffer bleibt stehen):
// "010001" -> "10001" ; "0006" -> "6" ; "0000" -> "0" ; "10001" bleibt "10001".
function stripLeadingZeros(s: string): string {
  return s.replace(/^0+(?=\d)/, "");
}

// Normalisiert die VS-Nummer: entfernt führende Nullen im Segment NACH dem "-" und,
// falls vorhanden, im Segment NACH einem "/". Das Präfix VOR dem "-" bleibt
// unangetastet. "577-010001/0001" -> "577-10001/1" ; "700-000001" -> "700-1".
// Ohne "-" bleibt die VS-Nummer unverändert.
function normalizeVsNummer(vs: string): string {
  const slashIdx = vs.indexOf("/");
  const beforeSlash = slashIdx === -1 ? vs : vs.slice(0, slashIdx);
  const afterSlash = slashIdx === -1 ? "" : stripLeadingZeros(vs.slice(slashIdx + 1));

  const dashIdx = beforeSlash.indexOf("-");
  const normalizedBeforeSlash =
    dashIdx === -1
      ? beforeSlash
      : beforeSlash.slice(0, dashIdx + 1) + stripLeadingZeros(beforeSlash.slice(dashIdx + 1));

  return slashIdx === -1 ? normalizedBeforeSlash : `${normalizedBeforeSlash}/${afterSlash}`;
}

export function convertVhv(text: string): VhvResult {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.includes("Vers.Schein-Nr."));
  if (headerIdx === -1) {
    throw new Error('VHV: Kopfzeile mit "Vers.Schein-Nr." wurde nicht gefunden.');
  }

  // Manche VHV-Exporte enden mit dem alten DOS-Endzeichen 0x1A. Es ist keine
  // Datenzeile und wird vor der strengen CSV-Strukturprüfung entfernt.
  const tableText = lines.slice(headerIdx).join("\n").replace(/\x1A/g, "");
  const records = parseCsv(tableText, "VHV");

  if (records.length > 0) {
    requireColumns(records[0], "VHV", ["Vers.Schein-Nr.", "Prov.Betrag", "Prov %", "Name 1"]);
  }
  const warnings = validateInputContent(records, "VHV");

  const rows: Row[] = [];
  const kandidaten = new Set<string>(); // alle echten VS-Nummern in der Datei
  const uebernommen = new Set<string>(); // VS-Nummern, die in die Ausgabe kommen

  for (const e of records) {
    const vsRaw = String(e["Vers.Schein-Nr."] ?? "").trim();

    // Struktur-/Summenzeilen überspringen (leere VS oder "*** 20 ***" etc.)
    if (vsRaw === "" || vsRaw.includes("*")) continue;

    const vs = normalizeVsNummer(vsRaw);
    kandidaten.add(vs);

    const prov = cleanGermanAmount(String(e["Prov.Betrag"] ?? ""));
    const pctRaw = String(e["Prov %"] ?? "").replace(/\s/g, "");
    const pct = parseGermanNumber(pctRaw);

    // Nur echte Provisionszeilen mit vorhandenem Betrag und 4 < Prov % < 51
    if (prov === "" || pctRaw === "" || isNaN(pct) || !(pct > 4 && pct < 51)) {
      continue;
    }

    const n1 = safe(e["Name 1"]);
    const n2 = safe(e["Name 2"]);
    const vn = n1 !== "" && n2 !== "" ? `${n1}, ${n2}` : n1 || n2;

    rows.push({ vs: vs.replace(/;/g, ","), vn, prov, ka: "1" });
    uebernommen.add(vs);
  }

  const notListed = [...kandidaten].filter((vs) => !uebernommen.has(vs));
  return { rows, notListed, warnings };
}
