import type { Record, Row } from "../types";
import { safe, findKey } from "../buildCsv";
import { requireColumns } from "../validate";

// ARAG: dynamische Spaltensuche (VS-NR, VN-NAME, BP-ANSPR-BTR, BP-PRV SATZ).
// Provisionsbetrag hat Punkt als Dezimaltrennzeichen -> in Komma umwandeln.
// KA = 1, wenn Provisionssatz >= 4.
export function rows(records: Record[]): Row[] {
  if (records.length > 0) {
    requireColumns(records[0], "ARAG", ["VS-NR", "VN-NAME", "BP-ANSPR-BTR", "BP-PRV SATZ"]);
  }

  const out: Row[] = [];
  for (const e of records) {
    const vsKey = findKey(e, "VS-NR") ?? "VS-NR";
    const vnKey = findKey(e, "VN-NAME") ?? "VN-NAME";
    const provKey = findKey(e, "BP-ANSPR-BTR") ?? "BP-ANSPR-BTR";
    const satzKey = findKey(e, "BP-PRV SATZ") ?? "BP-PRV SATZ";

    if (!e[vsKey]) continue;

    const vs = safe(e[vsKey]);
    const vn = safe(e[vnKey]);
    const prov = String(e[provKey] ?? "0").trim().replace(/\./g, ",");

    const provSatz = parseFloat(String(e[satzKey] ?? "0").trim());
    const ka = provSatz >= 4 ? "1" : "0";

    if (vs !== "") out.push({ vs, vn, prov, ka });
  }
  return out;
}
