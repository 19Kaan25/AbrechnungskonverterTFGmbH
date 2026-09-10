import type { Record, Row } from "../types";
import { safe, findKey, findExactKey } from "../buildCsv";
import { requireColumns } from "../validate";

// .xls-Import (im n8n-Workflow "Interrisk"-Mapping):
// VS-Nummer (führende Nullen entfernen), Name aus "Name VN" + "Vorname VN",
// Provisionsbetrag, Provisionssatz. KA = 1, wenn Satz > 4.
//
// WICHTIG: "Name VN" und "Vorname VN" werden per EXAKTEM Spaltenabgleich gesucht
// (nicht per Teilstring-Suche wie die übrigen Spalten). Grund: "Vorname VN" enthält
// "Name VN" als Teilstring. Fehlt die Spalte "Name VN" (z.B. umbenannt), würde eine
// Teilstring-Suche fälschlich auch für "Name VN" auf "Vorname VN" auflösen – beide
// Felder bekämen denselben Wert und der Name würde verdoppelt ("Michael, Michael"
// statt eines Fehlers).
export function rows(records: Record[]): Row[] {
  if (records.length > 0) {
    requireColumns(records[0], "Excel (.xls)", [
      "VERTRAGSNUMMER",
      { exact: "Name VN" },
      { exact: "Vorname VN" },
      "PROVISIONSSATZ",
      "PROVISIONSBETRAG",
    ]);
  }

  const out: Row[] = [];
  for (const e of records) {
    const vsKey = findKey(e, "VERTRAGSNUMMER") ?? "Vertragsnummer";
    const nameKey = findExactKey(e, "Name VN") ?? "Name VN";
    const vornameKey = findExactKey(e, "Vorname VN") ?? "Vorname VN";
    const provSatzKey = findKey(e, "PROVISIONSSATZ") ?? "Provisionssatz";
    const provBetrKey = findKey(e, "PROVISIONSBETRAG") ?? "Provisionsbetrag";

    if (!e[vsKey]) continue;

    const vs = String(e[vsKey]).trim().replace(/^0+/, "").replace(/;/g, ",");

    const nachname = safe(e[nameKey]);
    const vorname = safe(e[vornameKey]);
    let vn: string;
    if (nachname !== "" && vorname !== "") vn = `${nachname}, ${vorname}`;
    else vn = nachname || vorname;

    const prov = String(e[provBetrKey] ?? "0").trim().replace(/\./g, ",");

    const provSatz = parseFloat(String(e[provSatzKey] ?? "0").trim().replace(",", "."));
    const ka = provSatz > 4 ? "1" : "0";

    if (vs !== "") out.push({ vs, vn, prov, ka });
  }
  return out;
}
