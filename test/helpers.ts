import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, "fixtures");

// Lädt eine CSV-Fixture (auf der Platte immer UTF-8, damit sie gut lesbar/reviewbar ist)
// und erzeugt daraus ein File-Objekt mit dem Encoding, das der jeweilige Versicherer im
// echten Betrieb liefert. Für Latin1-Versicherer (Nürnberger, VHV) werden die Zeichen in
// Latin1-Bytes umkodiert – so testen wir denselben Byte-Weg wie die echte App.
export function csvFixtureFile(name: string, encoding: "utf-8" | "latin1" = "utf-8"): File {
  return csvFile(fs.readFileSync(path.join(FIXTURES, name), "utf-8"), encoding, name);
}

// Wie csvFixtureFile, aber der CSV-Text kommt direkt als String (statt aus einer Datei).
// Praktisch, um gezielt kaputte/geänderte Dateiformate für Tests zu konstruieren.
export function csvFile(text: string, encoding: "utf-8" | "latin1" = "utf-8", name = "test.csv"): File {
  const bytes = Buffer.from(text, encoding === "latin1" ? "latin1" : "utf-8");
  return new File([new Uint8Array(bytes)], name);
}

// Baut aus Zeilen-Objekten eine echte Excel-Datei (Buffer) und liefert ein File. Der
// Parser (parseExcel) erkennt das Format am Inhalt automatisch – der mode (xls/xlsx)
// steuert in convert() nur die Mapping-Auswahl, nicht das Parsen. Deshalb reicht ein
// xlsx-Buffer, um beide Mappings zu testen.
export function xlsxFixtureFile(
  rows: Array<Record<string, string | number>>,
  name = "fixture.xlsx",
): File {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tabelle1");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new File([new Uint8Array(buf)], name);
}

// Wie xlsxFixtureFile, aber Zeile für Zeile als Array. So gehen auch Briefkopf-Zeilen über
// der Kopfzeile oder doppelte Spaltennamen (HVS). Standard ist ein echtes .xls (BIFF8).
export function excelAoaFile(
  rows: Array<Array<string | number>>,
  name = "fixture.xls",
  bookType: "biff8" | "xlsx" = "biff8",
): File {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tabelle1");
  const buf = XLSX.write(wb, { bookType, type: "array" }) as ArrayBuffer;
  return new File([new Uint8Array(buf)], name);
}

// Entfernt das BOM und gibt die reinen Zeilen zurück (praktisch für Assertions).
export function csvLines(csv: string): string[] {
  return csv.replace(/^﻿/, "").split("\n");
}

// Nur die Datenzeilen (ohne Kopfzeile, ohne leere Zeilen/Fußzeilen).
export function dataRows(csv: string): string[] {
  return csvLines(csv)
    .slice(1)
    .filter((l) => l.trim() !== "" && !l.startsWith("Nicht aufgelistete"));
}
