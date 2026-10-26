import type { Record, Row } from "../types";
import { findExactKey } from "../buildCsv";
import { requireColumns } from "../validate";
import { parseFlexibleNumber } from "../contentValidation";
import { cleanHvsName } from "../csv/hvs";

// HVS als .xls (Passwort muss vorher in Excel entfernt werden):
//   Zeile 1-3 Briefkopf, Kopfzeile erst in Zeile 4, unten eine SUMME-Zeile
//   Vertragsnr.  -> VS-Nummer (führende Nullen weg)
//   VN-Name      -> VN-Name
//   Abr.Betrag   -> Provision
//   Pr%          -> nur 4 < Satz < 51 übernehmen, KA immer "1" (wie bei der TXT)
export function rows(records: Record[]): Row[] {
  if (records.length > 0) {
    requireColumns(records[0], "HVS (.xls)", [
      { exact: "Vertragsnr." },
      { exact: "VN-Name" },
      { exact: "Abr.Betrag" },
      { exact: "Pr%" },
    ]);
  }

  const out: Row[] = [];
  for (const e of records) {
    const vsKey = findExactKey(e, "Vertragsnr.") ?? "Vertragsnr.";
    const vnKey = findExactKey(e, "VN-Name") ?? "VN-Name";
    const provKey = findExactKey(e, "Abr.Betrag") ?? "Abr.Betrag";
    const pctKey = findExactKey(e, "Pr%") ?? "Pr%";

    // SUMME-Zeile hat keine Vertragsnr. und fliegt hier raus
    const vs = String(e[vsKey] ?? "").trim().replace(/^0+/, "");
    if (vs === "") continue;

    const pct = parseFlexibleNumber(e[pctKey]);
    if (pct === undefined || !(pct > 4 && pct < 51)) continue;

    const vn = cleanHvsName(e[vnKey]);

    // Betrag kommt als Zahl oder als Text "2.228,62" -> immer "2228,62"
    const betrag = parseFlexibleNumber(e[provKey]);
    const prov = betrag === undefined ? String(e[provKey] ?? "") : betrag.toFixed(2).replace(".", ",");

    out.push({ vs, vn, prov, ka: "1" });
  }
  return out;
}
