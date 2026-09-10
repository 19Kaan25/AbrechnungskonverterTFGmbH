import { describe, it, expect } from "vitest";
import { convert } from "@/lib/convert";
import { csvFile, csvFixtureFile, dataRows } from "./helpers";

// End-to-End pro Versicherer: Fixture-Datei -> convert() -> exakte Ausgabezeilen.
// Deckt Encoding, Spalten-Mapping, Zahlformat, KA-Kennung und Aggregation zusammen ab.

describe("R+V", () => {
  it("mappt vsnr/vn_name/prov_betr, summiert Duplikate, KA = Satz >= 4", async () => {
    const file = csvFixtureFile("rv.csv");
    const res = await convert({ file, mode: "csv", company: "R+V" });
    expect(dataRows(res.csv)).toEqual([
      "100000001;Muster Netzbau GmbH,;23,36;1", // 6,82 + 16,54, Satz 11 -> KA 1
      "100000002;Beispiel, Anna;0,30;0", // Satz 3 -> KA 0
      // Zeile mit leerer VS-Nummer wird übersprungen
    ]);
  });
});

describe("ARAG", () => {
  it("dynamische Spalten, Punkt->Komma, Umlaute (UTF-8), KA = Satz >= 4", async () => {
    const file = csvFixtureFile("arag.csv");
    const res = await convert({ file, mode: "csv", company: "ARAG" });
    expect(dataRows(res.csv)).toEqual([
      "11000000000001;Muster Friseur Salon;10,71;1",
      "11000000000002;Beispiel Gewürze GmbH;105,96;1", // 102,67 + 3,29
    ]);
  });
});

describe("Adcuri", () => {
  it("entfernt führende Nullen, Satz x100, KA = Satz > 4", async () => {
    const file = csvFixtureFile("adcuri.csv");
    const res = await convert({ file, mode: "csv", company: "Adcuri" });
    expect(dataRows(res.csv)).toEqual([
      "100000001;Muster, Max;13,76;1", // 000100000001 -> 100000001, 0.3*100=30 > 4
      "100000002;Muster, Erika;13,02;1", // 11,02 + 2,00
      "200000001;Test, Low;5,00;0", // 0.02*100=2 -> KA 0
    ]);
  });
});

describe("Zürich", () => {
  it("nutzt exakt die Courtage-Spalte (nicht Courtagebasis), verrechnet Stornos", async () => {
    const file = csvFixtureFile("zuerich.csv");
    const res = await convert({ file, mode: "csv", company: "Zuerich" });
    expect(dataRows(res.csv)).toEqual([
      "110000000001;Musterhaus Steuerber;9,78;1", // -5,72 + 15,50 (NICHT 100 aus Courtagebasis!)
      "110000000002;MUSTER GmbH;3,00;0", // Satz 2 -> KA 0
    ]);
  });
});

describe("Nürnberger", () => {
  it("Latin1, nur COURTAGE, x -1, KA immer 1", async () => {
    const file = csvFixtureFile("nuernberger.csv", "latin1");
    const res = await convert({ file, mode: "csv", company: "Nuernberger" });
    expect(dataRows(res.csv)).toEqual([
      "000100000001;Grüßmann, Björn;9,29;1", // -8,79 & -0,50 -> *-1 -> 8,79+0,50
      "000100000003;Çetin;7,52;1", // ohne Vorname -> nur Nachname, ohne Komma
      // BESTANDSPFLEGEPROVISION-Zeile wird herausgefiltert
    ]);
  });
});

describe("Auxilla", () => {
  it("Latin1, MNR->VS, NAME+VORNAME, Filter 4<%<51, KA immer 1", async () => {
    const file = csvFixtureFile("auxilla.csv", "latin1");
    const res = await convert({ file, mode: "csv", company: "Auxilla" });
    expect(dataRows(res.csv)).toEqual([
      "1000000001;Müller, Björn;4,54;1", // 4,06 + 0,48, Satz 20 -> in Range
      "1000000004;Bau GmbH;12,00;1", // ohne Vorname -> ohne Komma, Satz 10 -> in Range
      // Satz 60 (1000000002) und Satz 3 (1000000003) fallen aus dem Bereich 4..51
    ]);
  });
});

describe("HVS", () => {
  it("liest Latin1-TXT, nutzt exakt Courtage, filtert 4<%<51 und aggregiert", async () => {
    const file = csvFixtureFile("hvs.txt", "latin1");
    const res = await convert({ file, mode: "csv", company: "HVS" });
    expect(dataRows(res.csv)).toEqual([
      // 10,50 - 2,00; Gesamt-Courtage 999,99/-200,00 darf nicht verwendet werden
      "80010001;Müller GmbH;8,50;1",
      // Tausenderpunkt wird vor der Aggregation entfernt
      "80010002;Beispiel, Anna;1234,56;1",
      // Prozentsatz 4,00 und 51,00 sind ausgeschlossen
    ]);
    expect(res.filename).toMatch(/^abrechnung_hvs_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("normalisiert den einzelnen CR-Zeilenumbruch nach der echten HVS-Kopfzeile", async () => {
    const text =
      "POS;Vertrag;Versicherungsnehmer;Prozentsatz;Courtage;Gesamt-Courtage\r" +
      "1;80000001;Erster Vertrag;25,00;10,00;1000,00\r\n" +
      "2;80000002;Zweiter Vertrag;25,00;20,00;2000,00\r\n";
    const file = csvFile(text, "latin1", "100000_202607.txt");
    const res = await convert({ file, mode: "csv", company: "HVS" });

    expect(dataRows(res.csv)).toEqual([
      "80000001;Erster Vertrag;10,00;1",
      "80000002;Zweiter Vertrag;20,00;1",
    ]);
  });

  it("entfernt Adressen, behält aber Kommas innerhalb des VN-Namens", async () => {
    const text =
      "Vertrag;Versicherungsnehmer;Prozentsatz;Courtage\n" +
      "1;Muster Tabak, Lotto, Presseshop, Musterstr. 97, 10969 Berlin;25,00;10,00\n" +
      "2;Name ohne Anschrift;25,00;20,00\n" +
      "3;Beispielhof Krüger GbR c/o Muster Gruppe, Beispielstr. 2, 12277 Berlin;25,00;30,00\n";
    const res = await convert({ file: csvFile(text, "latin1"), mode: "csv", company: "HVS" });

    expect(dataRows(res.csv)).toEqual([
      "1;Muster Tabak, Lotto, Presseshop;10,00;1",
      "2;Name ohne Anschrift;20,00;1",
      "3;Beispielhof Krüger GbR;30,00;1",
    ]);
  });
});

describe("Allianz", () => {
  it("erhält VERTRAGS_OM, formatiert Namen, dreht Vorzeichen und filtert 3<%<51", async () => {
    const file = csvFixtureFile("allianz.csv");
    const res = await convert({ file, mode: "csv", company: "Allianz" });

    expect(dataRows(res.csv)).toEqual([
      "AS-1000000001;Beispiel, Rita;3,23;1", // -1,23/-2,00 -> +1,23/+2,00; aggregiert
      "00B-0007X;Muster Bau GmbH;-2,67;1", // Buchstaben/Nullen 1:1; +2,67 -> -2,67
      "C-3;Meier, Anna Maria;0,50;1", // erster Teil Nachname, Rest Vorname(n)
      "D-4;Schmidt, Max;1000,00;1", // bereits formatiert; -1.000,00 -> +1000,00
      // Satz 3,00 und 51,00 sind ausgeschlossen
    ]);
    expect(res.filename).toMatch(/^abrechnung_allianz_\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
