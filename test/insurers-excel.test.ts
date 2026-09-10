import { describe, it, expect } from "vitest";
import { convert } from "@/lib/convert";
import { xlsxFixtureFile, dataRows } from "./helpers";

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
