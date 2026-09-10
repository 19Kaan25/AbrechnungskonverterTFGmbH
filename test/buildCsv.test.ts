import { describe, it, expect } from "vitest";
import { buildCsv, safe, findKey } from "@/lib/convert/buildCsv";
import type { Row } from "@/lib/convert/types";

const rows: Row[] = [{ vs: "1", vn: "A", prov: "10,00", ka: "1" }];

describe("buildCsv", () => {
  it("beginnt mit BOM und der festen Kopfzeile", () => {
    const { csv } = buildCsv(rows, "R+V");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.replace(/^﻿/, "").split("\n")[0]).toBe("VS-Nummer;VN-Name;Provision;KA");
  });

  it("erzeugt Standard-Dateinamen abrechnung_<firma>_<datum>.csv", () => {
    const { filename } = buildCsv(rows, "R+V");
    expect(filename).toMatch(/^abrechnung_r\+v_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("nutzt customName und ergänzt .csv nur wenn nötig", () => {
    expect(buildCsv(rows, "R+V", "mai").filename).toBe("mai.csv");
    expect(buildCsv(rows, "R+V", "mai.csv").filename).toBe("mai.csv");
  });

  it("hängt Fußzeilen (durch Leerzeile getrennt) unter die Tabelle", () => {
    const { csv } = buildCsv(rows, "VHV", undefined, ["Nicht aufgelistete VS-Nummer/n: 1, 2"]);
    const lines = csv.replace(/^﻿/, "").split("\n");
    expect(lines).toEqual([
      "VS-Nummer;VN-Name;Provision;KA",
      "1;A;10,00;1",
      "",
      "Nicht aufgelistete VS-Nummer/n: 1, 2",
    ]);
  });

  it("rowCount zählt nur Datenzeilen (ohne Fußzeile)", () => {
    expect(buildCsv(rows, "VHV", undefined, ["Fußzeile"]).rowCount).toBe(1);
  });
});

describe("Helfer", () => {
  it("safe trimmt und ersetzt Semikolons durch Kommas", () => {
    expect(safe("  a;b  ")).toBe("a,b");
    expect(safe(null)).toBe("");
  });

  it("findKey findet Spalten case-insensitiv per Teilstring", () => {
    const rec = { "BP-PRV SATZ": "4", Vertragsnummer: "1" };
    expect(findKey(rec, "BP-PRV SATZ")).toBe("BP-PRV SATZ");
    expect(findKey(rec, "VERTRAGSNUMMER")).toBe("Vertragsnummer");
    expect(findKey(rec, "GIBTESNICHT")).toBeUndefined();
  });
});
