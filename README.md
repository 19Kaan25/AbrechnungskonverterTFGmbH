# Abrechnungs-Konverter

![CI](https://github.com/19Kaan25/Abrechnungskonverter/actions/workflows/ci.yml/badge.svg)

Web-App, die Provisions-/Courtageabrechnungen verschiedener Versicherer in das
einheitliche CSV-Format fürs Bestandsverwaltungssystem umbaut
(`VS-Nummer;VN-Name;Provision;KA`, `;`-getrennt, UTF-8 mit BOM).

Ersetzt die frühere Kombination aus lokaler HTML-Datei + lokal gehostetem n8n-Workflow.
Die gesamte Umwandlung läuft **im Browser** – es werden keine Daten an einen Server
gesendet, es gibt keinen API-Key und keine Backend-Abhängigkeit.

## Unterstützte Formate

- **CSV/TXT umbauen:** R+V / Condor, ARAG, Adcuri, Zürich, Nürnberger, VHV, Auxilla,
  HVS (`.txt`), Allianz
- **Excel zu CSV:** `.xls` (InterRisk-Mapping) und `.xlsx` (Adcuri-Mapping)

VHV ist ein Sonderfall: Die Datei hat einen mehrzeiligen Kopf und Summenzeilen, Stornos
sind als negative Beträge kodiert (werden abgezogen), und nur Zeilen mit Provisionssatz
zwischen 4 % und 51 % werden übernommen. VS-Nummern, die dadurch wegfallen, werden unter
der Tabelle als „Nicht aufgelistete VS-Nummer/n" aufgeführt.

Auxilla: Datei ist Latin1-kodiert, nur Zeilen mit Provisionssatz zwischen 4 % und 51 %
werden übernommen (ohne Fußzeile für ausgeschlossene Verträge), KA ist immer `1`.

HVS: Die semikolongetrennte `.txt`-Datei ist Latin1-kodiert. Gemischte CR-/CRLF-
Zeilenumbrüche werden vor dem Parsen normalisiert. Nur Zeilen mit `4 < Prozentsatz < 51`
werden übernommen; als Provision wird exakt `Courtage` verwendet (nicht
`Gesamt-Courtage`), KA ist immer `1`. An den Versicherungsnehmer angehängte Anschriften
im Format `Name, Straße, PLZ Ort` werden aus dem VN-Namen entfernt.

Allianz: `VERTRAGS_OM` wird als alphanumerische VS-Nummer unverändert übernommen,
`VN_NAME` als „Nachname, Vorname“ formatiert und das Vorzeichen von
`PROVISIONSBETRAG` umgedreht. Nur Zeilen mit `3 < PROVISIONSSATZ < 51` werden
übernommen; KA ist immer `1`.

> Der frühere PDF→CSV-Zweig (über Gemini/KI) ist bewusst **nicht** enthalten, um die
> App ohne Server und ohne API-Key betreiben zu können. InterRisk-/Alte-Leipziger-PDFs
> müssen weiterhin anderweitig verarbeitet werden.

## Wenn ein Versicherer sein Dateiformat ändert

Jedes Mapping prüft vorab (`lib/convert/validate.ts`, `requireColumns`), ob die
erwarteten Spalten in der Datei vorhanden sind. Fehlt eine Kernspalte (z.B. weil eine
Spalte umbenannt wurde), erscheint eine klare Fehlermeldung in der App – anstatt
still `„Fertig: 0 Verträge"` oder, schlimmer, Verträge mit falscher Provision (`0`)
auszugeben. Wenn diese Meldung auftaucht, hat sich vermutlich das Dateiformat der
Versicherung geändert; dann Mapping und Fixture in `test/fixtures/` aktualisieren.

Zusätzlich läuft bei **jeder Konvertierung** eine Inhaltsprüfung
(`lib/convert/contentValidation.ts`) ohne historische Speicherung. Sie prüft unter
anderem CSV-Struktur, leere Dateien, lesbare Provisionen/Provisionssätze, erwartete
Prozentsatz-Skalen, beschädigte Zeichen sowie die erzeugte Ausgabe. Kritische finanzielle
Fehler verhindern den Download. Fehlende VN-Namen, einzelne fehlende VS-Nummern,
ausgefilterte Satz-Zeilen oder ausschließlich `0,00`-Provisionen erscheinen als Warnung;
der Download bleibt möglich, sofern gültige Verträge vorhanden sind.

## Lokal starten

```bash
npm install
npm run dev
# http://localhost:3000
```

## Auf Vercel deployen

1. Repository zu GitHub pushen.
2. Auf [vercel.com](https://vercel.com) „New Project" → das Repo importieren.
3. Vercel erkennt Next.js automatisch. Keine Umgebungsvariablen, kein Build-Config nötig.
4. „Deploy" – fertig.

Alternativ per CLI: `npm i -g vercel && vercel`.

## Tests

```bash
npm test          # einmalig (wie in der CI)
npm run test:watch  # während der Entwicklung
```

Für jeden Versicherer gibt es einen End-to-End-Test (`test/insurers-*.test.ts`), der eine
kleine, **anonymisierte** Fixture-Datei (`test/fixtures/`, erfundene Namen/Nummern, aber
echte Spaltenstruktur/Encoding) durch `convert()` schickt und das exakte Ergebnis prüft –
inkl. KA-Kennung, Zahlformat, Umlaute (Latin1) und Aggregation. Dazu Unit-Tests für
`aggregate` und `buildCsv`. Die Tests laufen automatisch bei jedem Push über GitHub
Actions (`.github/workflows/ci.yml`).

Neuen Versicherer testen: Fixture unter `test/fixtures/<name>.csv` anlegen und einen
Block in der passenden `test/insurers-*.test.ts` ergänzen.

## Aufbau

- `app/page.tsx` – Oberfläche (Tabs, Datei-Upload, Download)
- `lib/convert/` – Konvertierungslogik
  - `index.ts` – Dispatcher `convert()` (wählt Mapping nach Firma/Format)
  - `csv/*.ts` – firmenspezifische CSV-Mappings
  - `excel/*.ts` – Excel-Mappings (.xls / .xlsx)
  - `aggregate.ts` – fasst gleiche Verträge zusammen und summiert Provisionen
  - `buildCsv.ts` – finaler CSV-Text + Dateiname
- `test/` – Vitest-Tests und anonymisierte Fixtures
