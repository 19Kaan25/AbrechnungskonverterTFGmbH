import { describe, it, expect } from "vitest";
import { convert } from "@/lib/convert";
import { xlsxFixtureFile, excelAoaFile, dataRows } from "./helpers";

// Excel: das Mapping hängt am Format (mode), nicht an der Firma.
// .xls -> InterRisk-Mapping, .xlsx -> Adcuri-Mapping.

describe("Excel .xls (InterRisk-Mapping)", () => {
  it("Vertragsnummer ohne führende Nullen, Name VN + Vorname VN, KA = Satz > 4", async () => {
    const file = xlsxFixtureFile([
      { Vertragsnummer: "00100001N", "Name VN": "Schmidt", "Vorname VN": "Michael", Provisionsbetrag: 1.27, Provisionssatz: 24 },
      { Vertragsnummer: "00100001N", "Name VN": "Schmidt", "Vorname VN": "Michael", Provisionsbetrag: 2.0, Provisionssatz: 24 },
      { Vertragsnummer: "00100002X", "Name VN": "Klein", "Vorname VN": "", Provisionsbetrag: 5.0, Provisionssatz: 3 },
    ]);
    const res = await convert({ file, mode: "xls", company: "Excel_Import" });
    expect(dataRows(res.csv)).toEqual([
      "100001N;Schmidt, Michael;3,27;1", // 1,27 + 2,00, Satz 24 -> KA 1
      "100002X;Klein;5,00;0", // ohne Vorname -> ohne Komma, Satz 3 -> KA 0
    ]);
  });
});

describe("Excel .xlsx (Adcuri-Mapping)", () => {
  it("Vertragsnummer ohne führende Nullen, Satz x100, KA = Satz > 4", async () => {
    const file = xlsxFixtureFile([
      { Versicherungsnehmer: "Muster, Max", Vertragsnummer: "000100000001", Provisionssatz: 0.3, Provisionsbetrag: 13.76 },
      { Versicherungsnehmer: "Test, Low", Vertragsnummer: "200000001", Provisionssatz: 0.02, Provisionsbetrag: 5.0 },
    ]);
    const res = await convert({ file, mode: "xlsx", company: "Excel_Import" });
    expect(dataRows(res.csv)).toEqual([
      "100000001;Muster, Max;13,76;1", // 0.3*100=30 > 4
      "200000001;Test, Low;5,00;0", // 0.02*100=2 -> KA 0
    ]);
  });
});

// HVS-.xls: Aufbau wie im Original (Briefkopf, Kopfzeile in Zeile 4, SUMME unten),
// Daten komplett erfunden.
const HVS_KOPF = [
  "V", "M/R-Nr.", "V", "N-Nr.", "VN-Name", "Vertragsnr.", "Referenz", "PrBasis", "Bruttopr.",
  "Pr%", "Abr.Betrag", "BelDat", "Erh.von", "Erh.bis", "BuJM", "Sprt", "Sparte", "RechNr",
  "Buchungstext",
];

function hvsZeile(vertrag: string, vn: string, satz: number | string, betrag: number | string) {
  return ["", "01234", "", "0000001", vn, vertrag, "", 100, 120, satz, betrag, "01.10.2026",
    "01.10.2026", "01.10.2027", 202610, "09", "Hausrat", "000000001", ""];
}

function hvsDatei(kopf: string[], daten: Array<Array<string | number>>) {
  return excelAoaFile([
    ["Absender: Test-Versicherung AG, Musterweg 1, 20000 Hamburg"],
    ["Empfänger: Beispiel Makler GmbH, Teststraße 1, 10000 Berlin"],
    ["Belegnr.: 000-0000000"],
    kopf,
    ...daten,
  ]);
}

describe("Excel .xls (HVS)", () => {
  it("überspringt Briefkopf und SUMME, entfernt Nullen, filtert 4<Pr%<51 und summiert", async () => {
    const file = hvsDatei(HVS_KOPF, [
      hvsZeile("00012345", "Muster Max", 25, 10.5),
      hvsZeile("00012345", "Muster Max", 25, 2.25), // zweite Sparte, gleicher Vertrag
      hvsZeile("00012345", "Muster Max", 25, -1), // Storno
      hvsZeile("80020001", "Beispiel GmbH", "25,00", "2.228,62"), // als Text mit Tausenderpunkt
      hvsZeile("80030001", "Zu Niedrig", 4, 5),
      hvsZeile("80040001", "Zu Hoch", 51, 5),
      ["", "01234", "", "", "SUMME", "", "", 0, 0, 0, 2244.37],
    ]);
    const res = await convert({ file, mode: "xls", company: "HVS" });
    expect(dataRows(res.csv)).toEqual([
      "12345;Muster Max;11,75;1",
      "80020001;Beispiel GmbH;2228,62;1",
    ]);
    expect(res.filename).toMatch(/^abrechnung_hvs_\d{4}-\d{2}-\d{2}\.csv$/);
    // nur der Hinweis auf die 2 rausgefilterten Zeilen, nichts zur SUMME-Zeile
    expect(res.warnings).toEqual([
      "HVS (.xls): 2 Zeile(n) lagen außerhalb des zulässigen Provisionssatzbereichs und wurden nicht übernommen.",
    ]);
  });

  it("meldet fehlende Spalten statt still falsch zu rechnen", async () => {
    const kopf = HVS_KOPF.map((k) => (k === "Abr.Betrag" ? "Betrag" : k));
    const file = hvsDatei(kopf, [hvsZeile("00012345", "Muster Max", 25, 10.5)]);
    await expect(convert({ file, mode: "xls", company: "HVS" })).rejects.toThrow(/Abr\.Betrag/);
  });

  it("nutzt das HVS-Mapping auch, wenn im Formular .xlsx eingestellt war", async () => {
    const file = hvsDatei(HVS_KOPF, [hvsZeile("00012345", "Muster Max", 25, 10.5)]);
    const res = await convert({ file, mode: "xlsx", company: "HVS" });
    expect(dataRows(res.csv)).toEqual(["12345;Muster Max;10,50;1"]);
  });
});
