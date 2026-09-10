import { describe, it, expect } from "vitest";
import { convert } from "@/lib/convert";
import { csvFile, xlsxFixtureFile } from "./helpers";

// Simuliert, dass ein Versicherer sein CSV-/Excel-Format ändert (z.B. eine Spalte
// umbenennt). Vorher wäre das entweder als "Fertig: 0 Verträge" (Zeilen still
// übersprungen) oder mit falschen Werten wie Provision "0" durchgelaufen – in beiden
// Fällen ohne sichtbaren Fehler in der App. Mit requireColumns() muss stattdessen ein
// klarer Fehler geworfen werden, den die UI als rote Fehlermeldung anzeigt.

describe("Erkennung geänderter Dateiformate", () => {
  it("R+V: Kernspalte umbenannt -> Fehler statt 0 Verträge", async () => {
    const file = csvFile("vs_nr;vn_name;prov_betr;prov_satz_eff\n1;A;10,00;5,00\n");
    await expect(convert({ file, mode: "csv", company: "R+V" })).rejects.toThrow(
      /R\+V.*vsnr/,
    );
  });

  it("ARAG: VS-NR fehlt -> Fehler", async () => {
    const file = csvFile("VN-NAME;BP-ANSPR-BTR;BP-PRV SATZ\nA;10,00;5,00\n");
    await expect(convert({ file, mode: "csv", company: "ARAG" })).rejects.toThrow(
      /ARAG.*VS-NR/,
    );
  });

  it("Adcuri: Vertragsnummer fehlt -> Fehler", async () => {
    const file = csvFile(
      "Versicherungsnehmer;Provisionssatz;Provisionsbetrag\nA, B;0.3;10.00\n",
    );
    await expect(convert({ file, mode: "csv", company: "Adcuri" })).rejects.toThrow(
      /Adcuri.*VERTRAGSNUMMER/,
    );
  });

  it("Zürich: nur Courtagebasis vorhanden, keine Courtage -> Fehler (nicht still 0,00)", async () => {
    const file = csvFile(
      "VN / Buchungstext;VSNR/Stamm-Nr;Courtagebasis;Courtagesatz\nA;1;100,00;5,000\n",
    );
    await expect(convert({ file, mode: "csv", company: "Zuerich" })).rejects.toThrow(
      /Zürich.*COURTAGE/,
    );
  });

  it("Nürnberger: VSNR fehlt -> Fehler", async () => {
    const file = csvFile(
      "PROVISIONSART;VN_NAME;TEILPROVISION\nCOURTAGE;A;-10,00\n",
      "latin1",
    );
    await expect(convert({ file, mode: "csv", company: "Nuernberger" })).rejects.toThrow(
      /Nürnberger.*VSNR/,
    );
  });

  it("Auxilla: MNR fehlt -> Fehler", async () => {
    const file = csvFile(
      "NAME;VORNAME;PROVISION_BETRAG;PROVISION_PROZENT\nMuster;Max;10,00;20,00\n",
      "latin1",
    );
    await expect(convert({ file, mode: "csv", company: "Auxilla" })).rejects.toThrow(
      /Auxilla.*MNR/,
    );
  });

  it("HVS: nur Gesamt-Courtage vorhanden -> Fehler statt falscher Provision", async () => {
    const file = csvFile(
      "Vertrag;Versicherungsnehmer;Prozentsatz;Gesamt-Courtage\r" +
        "1;Muster GmbH;25,00;999,99\r\n",
      "latin1",
      "hvs.txt",
    );
    await expect(convert({ file, mode: "csv", company: "HVS" })).rejects.toThrow(
      /HVS.*Courtage/,
    );
  });

  it("Allianz: nur ähnliche Betragsspalte vorhanden -> Fehler", async () => {
    const file = csvFile(
      "VERTRAGS_OM;VN_NAME;PROVISIONSSATZ;PROVISIONSBETRAG_ALT\r\n" +
        "AS-1;Muster Max;4,5;-1,23\r\n",
    );
    await expect(convert({ file, mode: "csv", company: "Allianz" })).rejects.toThrow(
      /Allianz.*PROVISIONSBETRAG/,
    );
  });

  it("VHV: Prov.Betrag umbenannt -> Fehler statt Sammel-Fußzeile mit allen VS-Nummern", async () => {
    const header =
      "VZW;Vers.Schein-Nr.;Prov.Auszahlung;Prov %;Name 1;Name 2";
    const file = csvFile(
      ["junk", "junk", "junk", "junk", header, " 1 ;001-111;10,00;25,000;Muster;Max"].join(
        "\r\n",
      ),
      "latin1",
    );
    await expect(convert({ file, mode: "csv", company: "VHV" })).rejects.toThrow(
      /VHV.*Prov\.Betrag/,
    );
  });

  it("Excel .xls: Vertragsnummer fehlt -> Fehler", async () => {
    const file = xlsxFixtureFile([
      { "Name VN": "Schmidt", "Vorname VN": "Michael", Provisionsbetrag: 1.27, Provisionssatz: 24 },
    ]);
    await expect(convert({ file, mode: "xls", company: "Excel_Import" })).rejects.toThrow(
      /Excel \(\.xls\).*VERTRAGSNUMMER/,
    );
  });

  it('Excel .xls: "Name VN" fehlt, nur "Vorname VN" vorhanden -> Fehler statt verdoppeltem Namen', async () => {
    // "Vorname VN" enthält "Name VN" als Teilstring. Eine Teilstring-Suche würde beide
    // Felder fälschlich auf dieselbe Spalte auflösen -> Name würde als "Michael, Michael"
    // statt eines Fehlers ausgegeben. Der exakte Spaltenabgleich muss das verhindern.
    const file = xlsxFixtureFile([
      { Vertragsnummer: "00100001N", "Vorname VN": "Michael", Provisionsbetrag: 1.27, Provisionssatz: 24 },
    ]);
    await expect(convert({ file, mode: "xls", company: "Excel_Import" })).rejects.toThrow(
      /Excel \(\.xls\).*Name VN/,
    );
  });

  it("Excel .xlsx: Provisionsbetrag fehlt -> Fehler", async () => {
    const file = xlsxFixtureFile([
      { Versicherungsnehmer: "A, B", Vertragsnummer: "123", Provisionssatz: 0.3 },
    ]);
    await expect(convert({ file, mode: "xlsx", company: "Excel_Import" })).rejects.toThrow(
      /Excel \(\.xlsx\).*PROVISIONSBETRAG/,
    );
  });
});
