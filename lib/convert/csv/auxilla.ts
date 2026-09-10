import type { Record, Row } from "../types";
import { safe } from "../buildCsv";
import { requireColumns } from "../validate";

// Auxilla: feste Spaltennamen MNR, NAME, VORNAME, PROVISION_BETRAG, PROVISION_PROZENT.
// Datei kommt als Latin1 (wird vom Dispatcher entsprechend eingelesen).
// VN-Name = "NAME, VORNAME" (fehlt einer, nur der andere ohne Komma).
// Nur Zeilen mit 4 < PROVISION_PROZENT < 51 übernehmen. KA ist immer "1" (kein
// satzabhängiger Schwellenwert wie bei R+V/ARAG/Adcuri/Zürich).
export function rows(records: Record[]): Row[] {
  if (records.length > 0) {
    requireColumns(records[0], "Auxilla", [
      "MNR",
      "NAME",
      "VORNAME",
      "PROVISION_BETRAG",
      "PROVISION_PROZENT",
    ]);
  }

  const out: Row[] = [];
  for (const e of records) {
    const vs = safe(e.MNR);
    if (vs === "") continue;

    const pct = parseFloat(String(e.PROVISION_PROZENT ?? "0").trim().replace(",", "."));
    if (isNaN(pct) || !(pct > 4 && pct < 51)) continue;

    const nachname = safe(e.NAME);
    const vorname = safe(e.VORNAME);
    const vn = nachname !== "" && vorname !== "" ? `${nachname}, ${vorname}` : nachname || vorname;

    const prov = safe(e.PROVISION_BETRAG);

    out.push({ vs, vn, prov, ka: "1" });
  }
  return out;
}
