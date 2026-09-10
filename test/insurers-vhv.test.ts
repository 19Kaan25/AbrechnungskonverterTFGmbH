import { describe, it, expect } from "vitest";
import { convert } from "@/lib/convert";
import { csvFile, csvFixtureFile, csvLines, dataRows } from "./helpers";

// VHV ist der komplexeste Fall und bekommt eigene Detailtests.
describe("VHV", () => {
  async function run() {
    const file = csvFixtureFile("vhv.csv", "latin1");
    return convert({ file, mode: "csv", company: "VHV" });
  }

  it("überspringt den mehrzeiligen Kopf und mappt korrekt", async () => {
    const res = await run();
    expect(dataRows(res.csv)).toEqual([
      "006-100001;Mustermann, Max;12,04;1",
      "006-100002;Grüßmann, Nina;0,00;1", // Buchung 12,80 + Storno -12,80 = 0,00
      "700-1;Muster GmbH;58,02;1", // nur Name 1 (Firma) -> ohne Komma; 700-000001 -> 700-1
    ]);
  });

  it("zieht Stornos ab (negativer Betrag mit Füll-Leerzeichen)", async () => {
    const res = await run();
    expect(dataRows(res.csv)).toContain("006-100002;Grüßmann, Nina;0,00;1");
  });

  it("übernimmt nur Zeilen mit 4 < Prov % < 51 und listet den Rest als Fußzeile", async () => {
    const res = await run();
    const lines = csvLines(res.csv);
    // 3 % und 60 % fallen raus -> Fußzeile; Summenzeilen (*** / Gesamt) NICHT
    // (800-000002 -> 800-2 und 900-000003 -> 900-3, ebenfalls entpolstert)
    expect(lines.at(-1)).toBe("Nicht aufgelistete VS-Nummer/n: 800-2, 900-3");
  });

  it("ignoriert Struktur-/Summenzeilen (*** und Gesamt) vollständig", async () => {
    const res = await run();
    expect(res.csv).not.toContain("***");
    expect(res.csv).not.toContain("6.816,77");
    expect(res.csv).not.toContain("3.333,76");
  });

  it("erzeugt einen VHV-Standarddateinamen", async () => {
    const res = await run();
    expect(res.filename).toMatch(/^abrechnung_vhv_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('entfernt führende Nullen NACH einem "/" bei Sparten-Verträgen einer Person', async () => {
    const header = "VZW;Vers.Schein-Nr.;Prov.Betrag;Prov %;Name 1;Name 2";
    const file = csvFile(
      [
        "junk",
        "junk",
        "junk",
        "junk",
        header,
        " 1 ;177-100002/0001;10,00;25,000;Mustermann;Max",
        " 1 ;177-100002/0010;12,00;25,000;Mustermann;Max",
        " 1 ;177-100002/0000;5,00;25,000;Mustermann;Max", // Sonderfall: nur Nullen
      ].join("\r\n"),
      "latin1",
    );
    const res = await convert({ file, mode: "csv", company: "VHV" });
    expect(dataRows(res.csv)).toEqual([
      "177-100002/1;Mustermann, Max;10,00;1",
      "177-100002/10;Mustermann, Max;12,00;1",
      "177-100002/0;Mustermann, Max;5,00;1",
    ]);
  });

  it('entfernt führende Nullen NACH einem "-" (unabhängig von einem "/")', async () => {
    const header = "VZW;Vers.Schein-Nr.;Prov.Betrag;Prov %;Name 1;Name 2";
    const file = csvFile(
      [
        "junk",
        "junk",
        "junk",
        "junk",
        header,
        " 1 ;577-010001/0003;10,00;25,000;Mustermann;Max", // beide Segmente gepolstert
        " 1 ;700-000001;7,00;25,000;Firma;", // kein "/", trotzdem entpolstert
        " 1 ;626-090001;8,00;25,000;Beispiel;Paul", // eine einzelne führende Null
        " 1 ;006-100001;9,00;25,000;Ohne;Nullen", // 3-stelliges Präfix mit "0" bleibt unangetastet
      ].join("\r\n"),
      "latin1",
    );
    const res = await convert({ file, mode: "csv", company: "VHV" });
    expect(dataRows(res.csv)).toEqual([
      "577-10001/3;Mustermann, Max;10,00;1",
      "700-1;Firma;7,00;1",
      "626-90001;Beispiel, Paul;8,00;1",
      "006-100001;Ohne, Nullen;9,00;1", // Präfix "006" unverändert, "100001" hat keine führenden Nullen
    ]);
  });
});
