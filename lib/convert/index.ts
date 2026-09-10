import type { ConvertResult, Mode, Record, Row } from "./types";
import { readAsText, readAsArrayBuffer } from "./readFile";
import { parseCsv } from "./parseCsv";
import { parseExcel } from "./parseExcel";
import { aggregate } from "./aggregate";
import { buildCsv } from "./buildCsv";
import {
  validateInputContent,
  validateOutputContent,
  type ContentValidationProfileId,
} from "./contentValidation";

import { rows as rvRows } from "./csv/rv";
import { rows as aragRows } from "./csv/arag";
import { rows as adcuriRows } from "./csv/adcuri";
import { rows as zuerichRows } from "./csv/zuerich";
import { rows as nuernbergerRows } from "./csv/nuernberger";
import { convertVhv } from "./csv/vhv";
import { rows as auxillaRows } from "./csv/auxilla";
import { rows as hvsRows, normalizeHvsText } from "./csv/hvs";
import { rows as allianzRows } from "./csv/allianz";
import { rows as xlsInterriskRows } from "./excel/xls-interrisk";
import { rows as xlsxAdcuriRows } from "./excel/xlsx-adcuri";

type Mapper = (records: Record[]) => Row[];

// CSV: pro Firma ein Mapper. Nürnberger/Auxilla/HVS werden als Latin1 eingelesen, der
// Rest als UTF-8. HVS-Text wird zusätzlich wegen gemischter CR-/CRLF-Zeilenumbrüche
// normalisiert.
const CSV_MAPPERS: { [company: string]: Mapper } = {
  "R+V": rvRows,
  ARAG: aragRows,
  Adcuri: adcuriRows,
  Zuerich: zuerichRows,
  Nuernberger: nuernbergerRows,
  Auxilla: auxillaRows,
  HVS: hvsRows,
  Allianz: allianzRows,
};

const LATIN1_COMPANIES = new Set(["Nuernberger", "Auxilla", "HVS"]);

const CSV_VALIDATION_PROFILES: { [company: string]: ContentValidationProfileId } = {
  "R+V": "R+V",
  ARAG: "ARAG",
  Adcuri: "Adcuri",
  Zuerich: "Zürich",
  Nuernberger: "Nürnberger",
  Auxilla: "Auxilla",
  HVS: "HVS",
  Allianz: "Allianz",
};

// Die im Frontend auswählbaren CSV-Firmen (Wert -> Anzeigename).
export const CSV_COMPANIES: { value: string; label: string }[] = [
  { value: "R+V", label: "R+V / Condor" },
  { value: "ARAG", label: "ARAG" },
  { value: "Adcuri", label: "Adcuri" },
  { value: "Zuerich", label: "Zürich" },
  { value: "Nuernberger", label: "Nürnberger" },
  { value: "VHV", label: "VHV" },
  { value: "Auxilla", label: "Auxilla" },
  { value: "HVS", label: "HVS" },
  { value: "Allianz", label: "Allianz" },
];

// Excel-Formate (Wert -> Anzeigename). Das Mapping hängt am Format, nicht an der Firma.
export const EXCEL_FORMATS: { value: "xls" | "xlsx"; label: string }[] = [
  { value: "xls", label: ".xls (älteres Format)" },
  { value: "xlsx", label: ".xlsx (neueres Format)" },
];

// Die im Frontend auswählbaren Excel-Firmen (Wert -> Anzeigename). Der Wert steuert
// aktuell nur den Dateinamen der Ausgabe (das Mapping hängt weiterhin am Dateiformat
// oben) - die Liste ist bewusst so vorbereitet, dass später weitere Firmen ergänzt
// werden können.
export const EXCEL_COMPANIES: { value: string; label: string }[] = [
  { value: "InterRisk", label: "InterRisk" },
];

export interface ConvertOptions {
  file: File;
  mode: Mode;
  company: string; // bei CSV: Schlüssel aus CSV_MAPPERS; bei Excel: nur für den Dateinamen
  customName?: string;
}

// Zentrale Konvertierungsfunktion: liest die Datei, wählt das passende Firmen-/Format-
// Mapping, aggregiert die Provisionen und baut die finale CSV.
export async function convert(opts: ConvertOptions): Promise<ConvertResult> {
  const { file, mode, company, customName } = opts;

  // VHV wird gesondert behandelt: mehrzeiliger Kopf muss übersprungen werden, Zeilen
  // werden nach Prov % gefiltert, und nicht aufgelistete VS-Nummern kommen als Fußzeile
  // unter die Tabelle.
  if (mode === "csv" && company === "VHV") {
    const text = await readAsText(file, "iso-8859-1");
    const { rows, notListed, warnings } = convertVhv(text);
    const aggregated = aggregate(rows);
    const outputWarnings = validateOutputContent(aggregated, company);
    const footer =
      notListed.length > 0
        ? [`Nicht aufgelistete VS-Nummer/n: ${notListed.join(", ")}`]
        : [];
    return buildCsv(aggregated, company, customName, footer, [...warnings, ...outputWarnings]);
  }

  let mapped: Row[];
  let warnings: string[] = [];

  if (mode === "csv") {
    const mapper = CSV_MAPPERS[company];
    if (!mapper) {
      throw new Error(`Für die Gesellschaft "${company}" gibt es keine CSV-Konvertierung.`);
    }
    const encoding = LATIN1_COMPANIES.has(company) ? "iso-8859-1" : "utf-8";
    const text = await readAsText(file, encoding);
    const normalizedText = company === "HVS" ? normalizeHvsText(text) : text;
    const records = parseCsv(normalizedText, company);
    mapped = mapper(records);
    warnings = validateInputContent(records, CSV_VALIDATION_PROFILES[company]);
  } else {
    // Excel (.xls oder .xlsx)
    const buffer = await readAsArrayBuffer(file);
    const records = parseExcel(buffer);
    mapped = mode === "xls" ? xlsInterriskRows(records) : xlsxAdcuriRows(records);
    warnings = validateInputContent(
      records,
      mode === "xls" ? "Excel (.xls)" : "Excel (.xlsx)",
    );
  }

  // Gemeinsamer Abschluss für alle Zweige: gleiche VS/VN/KA zusammenfassen und summieren.
  const aggregated = aggregate(mapped);
  warnings.push(...validateOutputContent(aggregated, company));
  return buildCsv(aggregated, company, customName, undefined, warnings);
}
