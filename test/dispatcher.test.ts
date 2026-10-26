import { describe, it, expect } from "vitest";
import { convert, CSV_COMPANIES, EXCEL_COMPANIES } from "@/lib/convert";

describe("Dispatcher", () => {
  it("wirft einen klaren Fehler bei unbekanntem CSV-Versicherer", async () => {
    const file = new File(["vsnr;vn_name\n1;A\n"], "x.csv");
    await expect(
      convert({ file, mode: "csv", company: "GibtEsNicht" }),
    ).rejects.toThrow(/keine CSV-Konvertierung/);
  });

  it("bietet alle unterstützten CSV-Versicherer im Dropdown an", () => {
    const values = CSV_COMPANIES.map((c) => c.value);
    expect(values).toEqual([
      "R+V",
      "ARAG",
      "Adcuri",
      "Zuerich",
      "Nuernberger",
      "VHV",
      "Auxilla",
      "HVS",
      "Allianz",
    ]);
  });

  it("bietet InterRisk und HVS im Excel-Dropdown an", () => {
    const values = EXCEL_COMPANIES.map((c) => c.value);
    expect(values).toEqual(["InterRisk", "HVS"]);
  });
});
