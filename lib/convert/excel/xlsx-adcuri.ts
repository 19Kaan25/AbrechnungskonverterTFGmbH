import type { Record, Row } from "../types";
import { safe, findKey } from "../buildCsv";
import { requireColumns } from "../validate";

// .xlsx-Import (im n8n-Workflow "Adcuri1"-Mapping):
// VS-Nummer (führende Nullen entfernen), Name aus "Versicherungsnehmer",
// Provisionsbetrag, Provisionssatz als Anteil (0,30 = 30%) -> * 100. KA = 1, wenn > 4.
export function rows(records: Record[]): Row[] {
  if (records.length > 0) {
    requireColumns(records[0], "Excel (.xlsx)", [
      "VERTRAGSNUMMER",
      "VERSICHERUNGSNEHMER",
      "PROVISIONSSATZ",
      "PROVISIONSBETRAG",
    ]);
  }

  const out: Row[] = [];
  for (const e of records) {
    const vsKey = findKey(e, "VERTRAGSNUMMER") ?? "Vertragsnummer";
    const nameKey = findKey(e, "VERSICHERUNGSNEHMER") ?? "Versicherungsnehmer";
    const provSatzKey = findKey(e, "PROVISIONSSATZ") ?? "Provisionssatz";
    const provBetrKey = findKey(e, "PROVISIONSBETRAG") ?? "Provisionsbetrag";

    if (!e[vsKey]) continue;

    const vs = String(e[vsKey]).trim().replace(/^0+/, "").replace(/;/g, ",");
    const vn = safe(e[nameKey]);
    const prov = String(e[provBetrKey] ?? "0").trim().replace(/\./g, ",");

    const provSatz = parseFloat(String(e[provSatzKey] ?? "0").trim().replace(",", ".")) * 100;
    const ka = provSatz > 4 ? "1" : "0";

    if (vs !== "") out.push({ vs, vn, prov, ka });
  }
  return out;
}
