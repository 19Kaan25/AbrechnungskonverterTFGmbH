import type { Row } from "./types";
import { parseFlexibleNumber } from "./contentValidation";

// Entspricht dem n8n-Node "Provisionen addieren":
// Fasst alle Zeilen mit identischer Kombination aus VS-Nummer, VN-Name und KA zusammen
// und summiert deren Provisionen. Stornos/negative Beträge werden dabei korrekt verrechnet.
// Die Summe wird wieder ins deutsche Format (Komma, 2 Nachkommastellen) gebracht.
//
// Die Provision kommt im Originalformat des Versicherers an: deutsch ("2.550,00") oder
// US ("2,550.00"). parseFlexibleNumber erkennt das Format am letzten Trennzeichen.
export function aggregate(rows: Row[]): Row[] {
  const gruppiert = new Map<string, { vs: string; vn: string; ka: string; summe: number }>();

  for (const r of rows) {
    const provZahl = parseFlexibleNumber(r.prov) ?? 0;
    const schluessel = `${r.vs}###${r.vn}###${r.ka}`;

    const eintrag = gruppiert.get(schluessel);
    if (eintrag) {
      eintrag.summe += provZahl;
    } else {
      gruppiert.set(schluessel, { vs: r.vs, vn: r.vn, ka: r.ka, summe: provZahl });
    }
  }

  return Array.from(gruppiert.values()).map((e) => ({
    vs: e.vs,
    vn: e.vn,
    prov: e.summe.toFixed(2).replace(".", ","),
    ka: e.ka,
  }));
}
