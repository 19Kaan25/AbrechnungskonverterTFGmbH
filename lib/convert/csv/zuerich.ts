import type { Record, Row } from "../types";
import { safe, findKey } from "../buildCsv";
import { requireColumns } from "../validate";

// Zürich: VS-Nummer aus STAMM-NR / VSNR, Name aus BUCHUNGSTEXT.
// Wichtig: exakt die Spalte "Courtage" nehmen (nicht "Courtagebasis" o.ä.).
// KA = 1, wenn Courtagesatz > 4.
export function rows(records: Record[]): Row[] {
  if (records.length > 0) {
    requireColumns(records[0], "Zürich", [
      ["STAMM-NR", "VSNR"],
      "BUCHUNGSTEXT",
      "COURTAGESATZ",
      { exact: "COURTAGE" }, // "Courtagebasis" darf das NICHT erfüllen
    ]);
  }

  const out: Row[] = [];
  for (const e of records) {
    const vsKey =
      findKey(e, "STAMM-NR") ?? findKey(e, "VSNR") ?? "VSNR/Stamm-Nr";
    const vnKey = findKey(e, "BUCHUNGSTEXT") ?? "VN / Buchungstext";
    const provSatzKey = findKey(e, "COURTAGESATZ") ?? "Courtagesatz";
    // Exakte Übereinstimmung, um "Courtagebasis" etc. auszuschließen.
    const provBetrKey =
      Object.keys(e).find((k) => k.trim().toUpperCase() === "COURTAGE") ?? "Courtage";

    if (!e[vsKey]) continue;

    const vs = safe(e[vsKey]);
    const vn = safe(e[vnKey]);
    const prov = String(e[provBetrKey] ?? "0").trim().replace(/\./g, ",");

    const provSatz = parseFloat(String(e[provSatzKey] ?? "0").trim().replace(",", "."));
    const ka = provSatz > 4 ? "1" : "0";

    if (vs !== "") out.push({ vs, vn, prov, ka });
  }
  return out;
}
