import type { Record as DataRecord, Row } from "./types";

export type ContentValidationProfileId =
  | "R+V"
  | "ARAG"
  | "Adcuri"
  | "Zürich"
  | "Nürnberger"
  | "VHV"
  | "Auxilla"
  | "HVS"
  | "Allianz"
  | "Excel (.xls)"
  | "Excel (.xlsx)";

interface FieldRef {
  names: string[];
  exact?: boolean;
}

interface RateRule {
  field: FieldRef;
  scale: "direct" | "fraction";
  filter?: { minExclusive: number; maxExclusive: number };
}

interface ValidationProfile {
  insurer: string;
  vs: FieldRef;
  names: FieldRef[];
  provision: FieldRef;
  rate?: RateRule;
  relevant?: (record: DataRecord, resolved: ResolvedFields) => boolean;
}

interface ResolvedFields {
  vs?: string;
  names: Array<string | undefined>;
  provision?: string;
  rate?: string;
}

function exact(name: string): FieldRef {
  return { names: [name], exact: true };
}

function contains(...names: string[]): FieldRef {
  return { names };
}

const PROFILES: Record<ContentValidationProfileId, ValidationProfile> = {
  "R+V": {
    insurer: "R+V",
    vs: exact("vsnr"),
    names: [exact("vn_name")],
    provision: exact("prov_betr"),
    rate: { field: exact("prov_satz_eff"), scale: "direct" },
  },
  ARAG: {
    insurer: "ARAG",
    vs: contains("VS-NR"),
    names: [contains("VN-NAME")],
    provision: contains("BP-ANSPR-BTR"),
    rate: { field: contains("BP-PRV SATZ"), scale: "direct" },
  },
  Adcuri: {
    insurer: "Adcuri",
    vs: contains("VERTRAGSNUMMER"),
    names: [contains("VERSICHERUNGSNEHMER")],
    provision: contains("PROVISIONSBETRAG"),
    rate: { field: contains("PROVISIONSSATZ"), scale: "fraction" },
  },
  Zürich: {
    insurer: "Zürich",
    vs: contains("STAMM-NR", "VSNR"),
    names: [contains("BUCHUNGSTEXT")],
    provision: exact("Courtage"),
    rate: { field: contains("COURTAGESATZ"), scale: "direct" },
  },
  Nürnberger: {
    insurer: "Nürnberger",
    vs: exact("VSNR"),
    names: [exact("VN_NAME"), exact("VN_VORNAME")],
    provision: exact("TEILPROVISION"),
    relevant: (record) => String(record.PROVISIONSART ?? "").trim().toUpperCase() === "COURTAGE",
  },
  VHV: {
    insurer: "VHV",
    vs: exact("Vers.Schein-Nr."),
    names: [exact("Name 1"), exact("Name 2")],
    provision: exact("Prov.Betrag"),
    rate: {
      field: exact("Prov %"),
      scale: "direct",
      filter: { minExclusive: 4, maxExclusive: 51 },
    },
    relevant: (record, resolved) => {
      const vs = stringValue(record, resolved.vs);
      return vs !== "" && !vs.includes("*");
    },
  },
  Auxilla: {
    insurer: "Auxilla",
    vs: exact("MNR"),
    names: [exact("NAME"), exact("VORNAME")],
    provision: exact("PROVISION_BETRAG"),
    rate: {
      field: exact("PROVISION_PROZENT"),
      scale: "direct",
      filter: { minExclusive: 4, maxExclusive: 51 },
    },
  },
  HVS: {
    insurer: "HVS",
    vs: exact("Vertrag"),
    names: [exact("Versicherungsnehmer")],
    provision: exact("Courtage"),
    rate: {
      field: exact("Prozentsatz"),
      scale: "direct",
      filter: { minExclusive: 4, maxExclusive: 51 },
    },
  },
  Allianz: {
    insurer: "Allianz",
    vs: exact("VERTRAGS_OM"),
    names: [exact("VN_NAME")],
    provision: exact("PROVISIONSBETRAG"),
    rate: {
      field: exact("PROVISIONSSATZ"),
      scale: "direct",
      filter: { minExclusive: 3, maxExclusive: 51 },
    },
  },
  "Excel (.xls)": {
    insurer: "Excel (.xls)",
    vs: contains("VERTRAGSNUMMER"),
    names: [exact("Name VN"), exact("Vorname VN")],
    provision: contains("PROVISIONSBETRAG"),
    rate: { field: contains("PROVISIONSSATZ"), scale: "direct" },
  },
  "Excel (.xlsx)": {
    insurer: "Excel (.xlsx)",
    vs: contains("VERTRAGSNUMMER"),
    names: [contains("VERSICHERUNGSNEHMER")],
    provision: contains("PROVISIONSBETRAG"),
    rate: { field: contains("PROVISIONSSATZ"), scale: "fraction" },
  },
};

function resolveKey(record: DataRecord, ref: FieldRef): string | undefined {
  const keys = Object.keys(record);
  for (const name of ref.names) {
    const target = name.trim().toUpperCase();
    const found = keys.find((key) => {
      const normalized = key.trim().toUpperCase();
      return ref.exact ? normalized === target : normalized.includes(target);
    });
    if (found) return found;
  }
  return undefined;
}

function resolveFields(record: DataRecord, profile: ValidationProfile): ResolvedFields {
  return {
    vs: resolveKey(record, profile.vs),
    names: profile.names.map((field) => resolveKey(record, field)),
    provision: resolveKey(record, profile.provision),
    rate: profile.rate ? resolveKey(record, profile.rate.field) : undefined,
  };
}

function stringValue(record: DataRecord, key: string | undefined): string {
  return key ? String(record[key] ?? "").trim() : "";
}

// Akzeptiert Zahlen sowie deutsche/englische Dezimaldarstellung. Diese Funktion prüft
// nur, ob ein Wert fachlich als Zahl lesbar ist; die firmenspezifische Ausgabeformatierung
// bleibt weiterhin Aufgabe des jeweiligen Mappers.
export function parseFlexibleNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;

  let normalized = String(value ?? "").trim().replace(/\s/g, "");
  if (normalized === "") return undefined;

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function containsEncodingDamage(record: DataRecord): boolean {
  return Object.values(record).some((value) => {
    if (typeof value !== "string") return false;
    return /\uFFFD|Ã.|Â.|â€|ðŸ/.test(value);
  });
}

function rowList(rows: number[]): string {
  const shown = rows.slice(0, 8).join(", ");
  return rows.length > 8 ? `${shown}, …` : shown;
}

// Diese Prüfung läuft bei JEDER Konvertierung. Sie braucht weder historische Daten noch
// ein Backend. Fehlende Namen/VS-Nummern und Encoding-Auffälligkeiten sind Warnungen;
// ungültige finanzielle Werte sind harte Fehler, damit keine falsche CSV erzeugt wird.
export function validateInputContent(
  records: DataRecord[],
  profileId: ContentValidationProfileId,
): string[] {
  const profile = PROFILES[profileId];
  if (records.length === 0) {
    throw new Error(`${profile.insurer}: Die Datei enthält keine Datenzeilen.`);
  }

  const resolved = resolveFields(records[0], profile);
  const missingVs: number[] = [];
  const missingNames: number[] = [];
  const encodingDamage: number[] = [];
  const invalidFinancialValues: string[] = [];
  let filteredByRate = 0;
  let relevantRows = 0;

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    if (profile.relevant && !profile.relevant(record, resolved)) return;
    relevantRows += 1;

    if (containsEncodingDamage(record)) encodingDamage.push(rowNumber);

    const vs = stringValue(record, resolved.vs);
    if (vs === "") {
      missingVs.push(rowNumber);
      return;
    }

    let acceptedByRate = true;
    if (profile.rate) {
      const rateValue = resolved.rate ? record[resolved.rate] : undefined;
      const rate = parseFlexibleNumber(rateValue);
      if (rate === undefined) {
        invalidFinancialValues.push(`Zeile ${rowNumber}: Provisionssatz fehlt oder ist ungültig`);
        return;
      }

      const maxExpected = profile.rate.scale === "fraction" ? 1 : 100;
      if (rate < 0 || rate > maxExpected) {
        const hint =
          profile.rate.scale === "fraction"
            ? " (erwartet wird ein Anteil, z. B. 0,30 für 30 %)"
            : " (erwartet werden direkte Prozentwerte zwischen 0 und 100)";
        invalidFinancialValues.push(
          `Zeile ${rowNumber}: unplausibler Provisionssatz ${String(rateValue)}${hint}`,
        );
        return;
      }

      if (profile.rate.filter) {
        const { minExclusive, maxExclusive } = profile.rate.filter;
        acceptedByRate = rate > minExclusive && rate < maxExclusive;
        if (!acceptedByRate) filteredByRate += 1;
      }
    }

    if (!acceptedByRate) return;

    const provisionValue = resolved.provision ? record[resolved.provision] : undefined;
    if (parseFlexibleNumber(provisionValue) === undefined) {
      invalidFinancialValues.push(`Zeile ${rowNumber}: Provision fehlt oder ist ungültig`);
    }

    const hasName = resolved.names.some((key) => stringValue(record, key) !== "");
    if (!hasName) missingNames.push(rowNumber);
  });

  if (relevantRows === 0) {
    throw new Error(`${profile.insurer}: Keine fachlich relevanten Datenzeilen gefunden.`);
  }

  if (invalidFinancialValues.length > 0) {
    const shown = invalidFinancialValues.slice(0, 8).join("; ");
    const suffix = invalidFinancialValues.length > 8 ? "; …" : "";
    throw new Error(
      `${profile.insurer}: Finanzielle Werte konnten nicht sicher verarbeitet werden. ${shown}${suffix}`,
    );
  }

  const warnings: string[] = [];
  if (missingVs.length > 0) {
    warnings.push(
      `${profile.insurer}: ${missingVs.length} Zeile(n) ohne VS-Nummer wurden übersprungen ` +
        `(Zeilen ${rowList(missingVs)}).`,
    );
  }
  if (missingNames.length > 0) {
    warnings.push(
      `${profile.insurer}: ${missingNames.length} übernommene Zeile(n) haben keinen VN-Namen ` +
        `(Zeilen ${rowList(missingNames)}). Die Konvertierung wurde nicht abgebrochen.`,
    );
  }
  if (encodingDamage.length > 0) {
    warnings.push(
      `${profile.insurer}: Möglicherweise beschädigte Umlaute/Zeichen in ${encodingDamage.length} ` +
        `Zeile(n) gefunden (Zeilen ${rowList(encodingDamage)}). Bitte Encoding prüfen.`,
    );
  }
  if (filteredByRate > 0) {
    warnings.push(
      `${profile.insurer}: ${filteredByRate} Zeile(n) lagen außerhalb des zulässigen ` +
        `Provisionssatzbereichs und wurden nicht übernommen.`,
    );
  }

  return warnings;
}

export function validateOutputContent(rows: Row[], insurer: string): string[] {
  if (rows.length === 0) {
    throw new Error(
      `${insurer}: Es konnten keine gültigen Verträge erzeugt werden. Es wurde keine CSV heruntergeladen.`,
    );
  }

  const invalid: string[] = [];
  const amounts: number[] = [];
  rows.forEach((row, index) => {
    if (row.vs.trim() === "") invalid.push(`Ausgabezeile ${index + 2}: VS-Nummer fehlt`);
    const amount = parseFlexibleNumber(row.prov);
    if (amount === undefined) invalid.push(`Ausgabezeile ${index + 2}: Provision ist ungültig`);
    else amounts.push(amount);
    if (row.ka !== "0" && row.ka !== "1") {
      invalid.push(`Ausgabezeile ${index + 2}: KA ist weder 0 noch 1`);
    }
  });

  if (invalid.length > 0) {
    throw new Error(`${insurer}: Interne Ausgabeprüfung fehlgeschlagen. ${invalid.join("; ")}`);
  }

  const warnings: string[] = [];
  if (amounts.length > 0 && amounts.every((amount) => amount === 0)) {
    warnings.push(`${insurer}: Alle ausgegebenen Provisionen sind 0,00. Bitte Datei kontrollieren.`);
  }

  const veryLarge = amounts.filter((amount) => Math.abs(amount) > 10_000_000).length;
  if (veryLarge > 0) {
    warnings.push(
      `${insurer}: ${veryLarge} ungewöhnlich hohe Provision(en) über 10.000.000 gefunden.`,
    );
  }

  return warnings;
}
