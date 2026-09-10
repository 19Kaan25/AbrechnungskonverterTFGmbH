import type { Record, Row } from "../types";
import { safe } from "../buildCsv";
import { requireColumns } from "../validate";

// R+V / Condor: feste Spaltennamen vsnr, vn_name, prov_betr, prov_satz_eff.
// KA = 1, wenn Provisionssatz >= 4, sonst 0.
export function rows(records: Record[]): Row[] {
  if (records.length > 0) {
    requireColumns(records[0], "R+V", ["vsnr", "vn_name", "prov_betr", "prov_satz_eff"]);
  }

  const out: Row[] = [];
  for (const e of records) {
    const vs = safe(e.vsnr);
    const vn = safe(e.vn_name);
    const prov = safe(e.prov_betr ?? "0");

    const provSatz = parseFloat(String(e.prov_satz_eff ?? "0").replace(",", "."));
    const ka = provSatz >= 4 ? "1" : "0";

    if (vs !== "") out.push({ vs, vn, prov, ka });
  }
  return out;
}
