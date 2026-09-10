import { describe, it, expect } from "vitest";
import { requireColumns } from "@/lib/convert/validate";
import { convert } from "@/lib/convert";
import { csvFile, dataRows } from "./helpers";

describe("requireColumns", () => {
  it("wirft nichts, wenn alle Spalten vorhanden sind", () => {
    expect(() =>
      requireColumns({ "VS-NR": "1", "VN-NAME": "A" }, "Test", ["VS-NR", "VN-NAME"]),
    ).not.toThrow();
  });

  it("erkennt Spaltennamen case-insensitiv als Teilstring (wie findKey)", () => {
    expect(() => requireColumns({ "vs-nr": "1" }, "Test", ["VS-NR"])).not.toThrow();
  });

  it("wirft mit dem Firmennamen und der fehlenden Spalte, wenn nichts passt", () => {
    expect(() => requireColumns({ Irgendwas: "1" }, "Test-Firma", ["VS-NR"])).toThrow(
      /Test-Firma.*VS-NR/,
    );
  });

  it("akzeptiert eine Alternativen-Liste, wenn mindestens eine passt", () => {
    expect(() =>
      requireColumns({ VSNR: "1" }, "Test", [["STAMM-NR", "VSNR"]]),
    ).not.toThrow();
    expect(() => requireColumns({}, "Test", [["STAMM-NR", "VSNR"]])).toThrow();
  });

  it("{ exact } verlangt exakte Übereinstimmung (Courtage != Courtagebasis)", () => {
    expect(() =>
      requireColumns({ Courtagebasis: "1" }, "Zürich", [{ exact: "COURTAGE" }]),
    ).toThrow(/Zürich.*COURTAGE/);
    expect(() =>
      requireColumns({ Courtage: "1" }, "Zürich", [{ exact: "COURTAGE" }]),
    ).not.toThrow();
  });
});

describe("Laufzeit-Inhaltsprüfung", () => {
  it("bricht bei fehlendem VN-Namen nicht ab, sondern gibt eine Warnung aus", async () => {
    const file = csvFile("vsnr;vn_name;prov_betr;prov_satz_eff\n123;;10,00;5,00\n");
    const result = await convert({ file, mode: "csv", company: "R+V" });

    expect(dataRows(result.csv)).toEqual(["123;;10,00;1"]);
    expect(result.warnings.join(" ")).toMatch(/keinen VN-Namen.*nicht abgebrochen/i);
  });

  it("bricht bei einer ungültigen Provision ab, damit keine 0,00 erzeugt wird", async () => {
    const file = csvFile(
      "vsnr;vn_name;prov_betr;prov_satz_eff\n123;Muster, Max;kein-betrag;5,00\n",
    );

    await expect(convert({ file, mode: "csv", company: "R+V" })).rejects.toThrow(
      /R\+V.*Provision fehlt oder ist ungültig/,
    );
  });
});
