import { describe, it, expect } from "vitest";
import { aggregate } from "@/lib/convert/aggregate";
import type { Row } from "@/lib/convert/types";

describe("aggregate (Provisionen addieren)", () => {
  it("summiert Zeilen mit gleicher VS-Nummer + Name + KA", () => {
    const rows: Row[] = [
      { vs: "1", vn: "A", prov: "6,82", ka: "1" },
      { vs: "1", vn: "A", prov: "16,54", ka: "1" },
    ];
    expect(aggregate(rows)).toEqual([{ vs: "1", vn: "A", prov: "23,36", ka: "1" }]);
  });

  it("verrechnet Stornos (negative Beträge) korrekt", () => {
    const rows: Row[] = [
      { vs: "1", vn: "A", prov: "12,80", ka: "1" },
      { vs: "1", vn: "A", prov: "-12,80", ka: "1" },
    ];
    expect(aggregate(rows)).toEqual([{ vs: "1", vn: "A", prov: "0,00", ka: "1" }]);
  });

  it("hält unterschiedliche KA-Werte getrennt", () => {
    const rows: Row[] = [
      { vs: "1", vn: "A", prov: "10,00", ka: "1" },
      { vs: "1", vn: "A", prov: "5,00", ka: "0" },
    ];
    expect(aggregate(rows)).toEqual([
      { vs: "1", vn: "A", prov: "10,00", ka: "1" },
      { vs: "1", vn: "A", prov: "5,00", ka: "0" },
    ]);
  });

  it("formatiert immer mit 2 Nachkommastellen und Komma", () => {
    const rows: Row[] = [{ vs: "1", vn: "A", prov: "5", ka: "1" }];
    expect(aggregate(rows)[0].prov).toBe("5,00");
  });

  it("liest deutsche Beträge mit Tausenderpunkt (2.550,00 -> 2550,00, nicht 2,55)", () => {
    const rows: Row[] = [
      { vs: "1", vn: "A", prov: "2.550,00", ka: "1" },
      { vs: "1", vn: "A", prov: "-1.000,50", ka: "1" },
      { vs: "2", vn: "B", prov: "1.234.567,89", ka: "1" },
    ];
    expect(aggregate(rows).map((r) => r.prov)).toEqual(["1549,50", "1234567,89"]);
  });

  it("liest US-Beträge mit Tausenderkomma (2,550.00 -> 2550,00)", () => {
    const rows: Row[] = [
      { vs: "1", vn: "A", prov: "2,550.00", ka: "1" },
      { vs: "1", vn: "A", prov: "13.76", ka: "1" },
      { vs: "2", vn: "B", prov: "1,234,567.89", ka: "1" },
    ];
    expect(aggregate(rows).map((r) => r.prov)).toEqual(["2563,76", "1234567,89"]);
  });

  it("behält die Reihenfolge des ersten Auftretens bei", () => {
    const rows: Row[] = [
      { vs: "2", vn: "B", prov: "1,00", ka: "1" },
      { vs: "1", vn: "A", prov: "1,00", ka: "1" },
      { vs: "2", vn: "B", prov: "1,00", ka: "1" },
    ];
    expect(aggregate(rows).map((r) => r.vs)).toEqual(["2", "1"]);
  });
});
