import type { Record, Row } from "../types";
import { requireColumns } from "../validate";

// Nürnberger: Datei kommt als Latin1 (wird vom Dispatcher entsprechend eingelesen).
// Nur Zeilen mit PROVISIONSART == COURTAGE verarbeiten.
// TEILPROVISION liegt im deutschen Format vor (Tausenderpunkt, Dezimalkomma) und wird
// mit -1 multipliziert. KA ist immer '1'.
export function rows(records: Record[]): Row[] {
  if (records.length > 0) {
    requireColumns(records[0], "Nürnberger", [
      "PROVISIONSART",
      "VSNR",
      "VN_NAME",
      "TEILPROVISION",
    ]);
  }

  const out: Row[] = [];
  for (const e of records) {
    const provisionsArt = String(e["PROVISIONSART"] ?? "").trim().toUpperCase();
    if (provisionsArt !== "COURTAGE") continue;

    const vs = String(e["VSNR"] ?? "").trim().replace(/;/g, ",");

    const nachname = String(e["VN_NAME"] ?? "").trim().replace(/;/g, "");
    const vorname = String(e["VN_VORNAME"] ?? "").trim().replace(/;/g, "");
    const vn = vorname ? `${nachname}, ${vorname}` : nachname;

    let provInput = String(e["TEILPROVISION"] ?? "0").trim();
    provInput = provInput.replace(/\./g, "").replace(",", ".");
    let provFloat = parseFloat(provInput);
    if (isNaN(provFloat)) provFloat = 0;
    provFloat = provFloat * -1;
    const prov = provFloat.toFixed(2).replace(".", ",");

    if (vs !== "") out.push({ vs, vn, prov, ka: "1" });
  }
  return out;
}
