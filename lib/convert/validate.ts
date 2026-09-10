import type { Record } from "./types";

// Eine Spaltenanforderung:
//   - ein Teilstring (case-insensitiv, wie findKey aus buildCsv.ts)
//   - { exact } für Fälle, in denen ein Teilstring-Treffer irreführend wäre
//     (z.B. "Courtage" darf NICHT durch "Courtagebasis" erfüllt werden)
//   - ein Array von Alternativen, von denen mindestens eine vorhanden sein muss
type ColumnNeedle = string | { exact: string };
type ColumnRequirement = ColumnNeedle | ColumnNeedle[];

function matches(key: string, needle: ColumnNeedle): boolean {
  if (typeof needle === "string") return key.toUpperCase().includes(needle.toUpperCase());
  return key.trim().toUpperCase() === needle.exact.toUpperCase();
}

function label(needle: ColumnNeedle): string {
  return typeof needle === "string" ? needle : needle.exact;
}

// Prüft anhand einer Beispielzeile, ob alle für ein Mapping nötigen Spalten in der Datei
// vorhanden sind. Wirft einen klaren, für den Nutzer verständlichen Fehler, WENN eine
// erwartete Spalte komplett fehlt.
//
// Ohne diese Prüfung würde ein geändertes Dateiformat (z.B. eine umbenannte Spalte)
// nicht auffallen: Zeilen würden entweder still übersprungen ("Fertig: 0 Verträge") oder
// mit falschen Werten wie Provision "0" weiterverarbeitet ("Fertig: 42 Verträge", aber
// mit falschen Beträgen) – in beiden Fällen ohne sichtbare Fehlermeldung in der App.
export function requireColumns(
  record: Record,
  insurer: string,
  requirements: ColumnRequirement[],
): void {
  const keys = Object.keys(record);
  const missing: string[] = [];

  for (const req of requirements) {
    const alts = Array.isArray(req) ? req : [req];
    const found = alts.some((needle) => keys.some((k) => matches(k, needle)));
    if (!found) missing.push(alts.map(label).join(" / "));
  }

  if (missing.length > 0) {
    throw new Error(
      `${insurer}: Erwartete Spalte(n) nicht gefunden: ${missing.join(", ")}. ` +
        `Hat sich das Dateiformat geändert? Vorhandene Spalten: ${keys.join(", ") || "(keine)"}`,
    );
  }
}
