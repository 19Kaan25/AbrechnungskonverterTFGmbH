import type { Record, Row } from "../types";
import { safe, findExactKey } from "../buildCsv";
import { requireColumns } from "../validate";

// Formatiert das Allianz-Feld VN_NAME. Die Datei liefert Personen als
// "Nachname Vorname"; daraus wird "Nachname, Vorname". Bereits formatierte Namen und
// Einwort-/Gesellschaftsnamen bleiben erhalten.
function formatVnName(value: unknown): string {
  const cleaned = safe(value).replace(/\s+/g, " ");
  if (cleaned === "" || cleaned.includes(",")) return cleaned;
  if (/\b(GMBH|AG|KG|GBR|UG|OHG|SE|E\.?K\.?)\b/i.test(cleaned)) return cleaned;

  const firstSpace = cleaned.indexOf(" ");
  if (firstSpace === -1) return cleaned;

  const nachname = cleaned.slice(0, firstSpace);
  const vorname = cleaned.slice(firstSpace + 1).trim();
  return vorname === "" ? nachname : `${nachname}, ${vorname}`;
}

// Allianz:
//   VERTRAGS_OM       -> VS-Nummer 1:1 (keine Entfernung von Nullen/Zeichen)
//   VN_NAME           -> VN-Name als "Nachname, Vorname"
//   PROVISIONSBETRAG  -> Provision mit umgedrehtem Vorzeichen
//   PROVISIONSSATZ    -> nur 3 < Satz < 51 übernehmen
//   KA                -> für übernommene Zeilen immer "1"
export function rows(records: Record[]): Row[] {
  if (records.length > 0) {
    requireColumns(records[0], "Allianz", [
      { exact: "VERTRAGS_OM" },
      { exact: "VN_NAME" },
      { exact: "PROVISIONSBETRAG" },
      { exact: "PROVISIONSSATZ" },
    ]);
  }

  const out: Row[] = [];
  for (const e of records) {
    const vsKey = findExactKey(e, "VERTRAGS_OM") ?? "VERTRAGS_OM";
    const vnKey = findExactKey(e, "VN_NAME") ?? "VN_NAME";
    const provKey = findExactKey(e, "PROVISIONSBETRAG") ?? "PROVISIONSBETRAG";
    const pctKey = findExactKey(e, "PROVISIONSSATZ") ?? "PROVISIONSSATZ";

    // Nur äußere Füllzeichen entfernen; Buchstaben, Bindestriche und führende Nullen
    // innerhalb der Vertragsnummer bleiben vollständig erhalten.
    const vs = safe(e[vsKey]);
    if (vs === "") continue;

    const pct = parseFloat(String(e[pctKey] ?? "").trim().replace(",", "."));
    if (isNaN(pct) || !(pct > 3 && pct < 51)) continue;

    const provInput = String(e[provKey] ?? "")
      .trim()
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const parsedProvision = parseFloat(provInput);
    if (isNaN(parsedProvision)) continue;

    const invertedProvision = parsedProvision * -1;
    const normalizedProvision = Object.is(invertedProvision, -0) ? 0 : invertedProvision;
    const prov = normalizedProvision.toFixed(2).replace(".", ",");

    out.push({ vs, vn: formatVnName(e[vnKey]), prov, ka: "1" });
  }

  return out;
}
