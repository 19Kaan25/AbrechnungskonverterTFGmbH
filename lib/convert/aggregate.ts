import type { Row } from "./types";

// Entspricht dem n8n-Node "Provisionen addieren":
// Fasst alle Zeilen mit identischer Kombination aus VS-Nummer, VN-Name und KA zusammen
// und summiert deren Provisionen. Stornos/negative Beträge werden dabei korrekt verrechnet.
// Die Summe wird wieder ins deutsche Format (Komma, 2 Nachkommastellen) gebracht.
export function aggregate(rows: Row[]): Row[] {
  const gruppiert = new Map<string, { vs: string; vn: string; ka: string; summe: number }>();

  for (const r of rows) {
    const provZahl = parseFloat(String(r.prov).replace(",", ".")) || 0;
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
