import type { Row, ConvertResult } from "./types";

const KOPFZEILE = "VS-Nummer;VN-Name;Provision;KA";

// Baut aus den fertig aggregierten Zeilen den finalen CSV-Text (mit UTF-8-BOM, damit
// Excel Umlaute korrekt darstellt) und bestimmt den Dateinamen.
//
// Dateiname-Regel (wie im n8n-Workflow):
//   - customName gesetzt  -> dieser Name (".csv" anhängen, falls nicht vorhanden)
//   - sonst               -> abrechnung_<company>_<YYYY-MM-DD>.csv
//
// footerLines: optionale Zusatzzeilen, die (durch eine Leerzeile getrennt) unter die
// Tabelle geschrieben werden – z.B. der VHV-Hinweis auf nicht aufgelistete VS-Nummern.
export function buildCsv(
  rows: Row[],
  company: string,
  customName?: string,
  footerLines?: string[],
  warnings: string[] = [],
): ConvertResult {
  const zeilen = rows.map((r) => `${r.vs};${r.vn};${r.prov};${r.ka}`);
  const alleZeilen = [KOPFZEILE, ...zeilen];
  if (footerLines && footerLines.length > 0) {
    alleZeilen.push("", ...footerLines);
  }
  const csvText = alleZeilen.join("\n");

  const heute = new Date().toISOString().slice(0, 10);
  let filename = `abrechnung_${company.toLowerCase()}_${heute}.csv`;
  const trimmed = (customName ?? "").trim();
  if (trimmed !== "") {
    filename = trimmed.endsWith(".csv") ? trimmed : `${trimmed}.csv`;
  }

  return {
    filename,
    csv: "﻿" + csvText,
    rowCount: rows.length,
    warnings,
  };
}

// Kleine gemeinsame Helfer, die in mehreren Firmen-Mappings gebraucht werden.

// Ersetzt ';' durch ',', damit einzelne Feldwerte das CSV nicht zerschießen.
export function safe(value: unknown): string {
  return String(value ?? "").trim().replace(/;/g, ",");
}

// Sucht in einem Datensatz den ersten Spaltennamen, der (case-insensitiv) den
// gesuchten Teilstring enthält. Schützt vor kleinen Abweichungen in den Kopfzeilen.
//
// ACHTUNG: Bei zwei Spalten, von denen die eine Name Teilstring der anderen ist
// (z.B. "Name VN" in "Vorname VN"), kann findKey beide auf dieselbe Spalte auflösen,
// wenn die kürzere Spalte fehlt. Für solche Fälle findExactKey() verwenden.
export function findKey(record: object, needleUpper: string): string | undefined {
  return Object.keys(record).find((k) => k.toUpperCase().includes(needleUpper));
}

// Sucht einen Spaltennamen per EXAKTER Übereinstimmung (case-insensitiv, getrimmt).
// Nötig, wenn ein Teilstring-Treffer eine andere Spalte fälschlich mit abdecken würde.
export function findExactKey(record: object, name: string): string | undefined {
  const target = name.trim().toUpperCase();
  return Object.keys(record).find((k) => k.trim().toUpperCase() === target);
}
