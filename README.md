# Abrechnungs-Konverter

![CI](https://github.com/19Kaan25/AbrechnungskonverterTFGmbH/actions/workflows/ci.yml/badge.svg)

**Live-Demo:** https://abrechnungskonverter.vercel.app/

Web-App, die Provisions- und Courtageabrechnungen verschiedener Versicherer in ein
einheitliches CSV-Format für ein Bestandsverwaltungssystem umwandelt.

Jede Versicherung liefert ihre Abrechnung anders: andere Spaltennamen, andere
Zeichenkodierung, Prozentsätze mal als `30` und mal als `0,30`, Stornos als negative
Beträge, Kopf- und Summenzeilen. Der Konverter liest diese Dateien ein, vereinheitlicht
sie und fasst gleiche Verträge zusammen. Heraus kommt immer dieselbe Struktur:

```text
VS-Nummer;VN-Name;Provision;KA
```

Die App hat einen früheren Ablauf aus lokaler HTML-Datei und n8n-Workflow abgelöst.

## Highlights

- **Datenschutz:** Die gesamte Verarbeitung läuft im Browser. Abrechnungen verlassen
  den Rechner nicht, es gibt kein Backend, keine Datenbank und keine API-Schlüssel.
- **9 Versicherer, 3 Dateiformate:** CSV, semikolongetrennte TXT, XLS und XLSX,
  inklusive Latin1-Dateien und gemischter Zeilenumbrüche.
- **Prüfung bei jeder Konvertierung:** Fehlende Spalten, unlesbare Beträge oder
  beschädigte Zeichen werden erkannt, bevor eine fehlerhafte Datei heruntergeladen wird.
- **Automatisch getestet:** End-to-End-Tests je Versicherer mit anonymisierten
  Beispieldateien, ausgeführt bei jedem Push über GitHub Actions.

## Tech-Stack

| Bereich | Technik |
| --- | --- |
| Framework | Next.js 14 (App Router), React 18 |
| Sprache | TypeScript (Strict Mode) |
| Parsing | Papa Parse (CSV), SheetJS (Excel) |
| Tests | Vitest |
| CI | GitHub Actions (Node 22) |
| Hosting | Vercel (statische Seite, keine Serverfunktionen) |

## Unterstützte Formate

**CSV / TXT:** R+V / Condor, ARAG, Adcuri, Zürich, Nürnberger, VHV, Auxilla, HVS (`.txt`),
Allianz

**Excel:** `.xls` (InterRisk) und `.xlsx` (Adcuri)

Einige Versicherer brauchen eine Sonderbehandlung:

- **VHV:** mehrzeiliger Dateikopf und Summenzeilen. Stornos stehen als negative Beträge
  drin und werden abgezogen. Übernommen werden nur Zeilen mit einem Provisionssatz
  zwischen 4 % und 51 %. VS-Nummern, die dadurch wegfallen, stehen unter der Tabelle als
  „Nicht aufgelistete VS-Nummer/n“.
- **Auxilla:** Latin1-kodiert. Übernommen werden nur Zeilen mit einem Provisionssatz
  zwischen 4 % und 51 %, KA ist immer `1`.
- **HVS:** semikolongetrennte `.txt` in Latin1 mit gemischten CR-/CRLF-Zeilenumbrüchen,
  die vor dem Parsen vereinheitlicht werden. Übernommen werden nur Zeilen mit
  `4 < Prozentsatz < 51`. Als Provision zählt `Courtage`, nicht `Gesamt-Courtage`.
  Anschriften, die an den VN-Namen angehängt sind (`Name, Straße, PLZ Ort`), werden
  entfernt.
- **Allianz:** alphanumerische VS-Nummer aus `VERTRAGS_OM`, VN-Name als
  „Nachname, Vorname“, das Vorzeichen von `PROVISIONSBETRAG` wird umgedreht. Übernommen
  werden nur Zeilen mit `3 < PROVISIONSSATZ < 51`.

PDF-Abrechnungen werden bewusst nicht unterstützt. Dafür wäre ein Server oder ein
externer KI-Dienst nötig, und die Daten müssten den Browser verlassen.

## Wenn ein Versicherer sein Format ändert

Jedes Mapping prüft vorab, ob alle erwarteten Spalten da sind
(`lib/convert/validate.ts`). Wurde eine Spalte umbenannt, zeigt die App eine klare
Fehlermeldung an. Ohne diese Prüfung käme still „0 Verträge“ heraus oder, schlimmer,
Verträge mit Provision `0`.

Zusätzlich prüft `lib/convert/contentValidation.ts` bei jeder Konvertierung den Inhalt:
CSV-Struktur, leere Dateien, lesbare Provisionen und Provisionssätze, plausible
Prozentskalen, beschädigte Zeichen und die erzeugte Ausgabe. Dabei wird nichts
gespeichert.

- **Kritische Fehler** (z. B. nicht lesbare Beträge) verhindern den Download.
- **Warnungen** (z. B. fehlende VN-Namen, einzelne fehlende VS-Nummern, herausgefilterte
  Zeilen) werden angezeigt, der Download bleibt aber möglich.

## Lokal starten

```bash
npm install
npm run dev
```

Die App läuft dann unter http://localhost:3000.

## Tests

```bash
npm test            # einmal durchlaufen lassen (wie in der CI)
npm run test:watch  # während der Entwicklung
```

Für jeden Versicherer gibt es einen End-to-End-Test (`test/insurers-*.test.ts`). Er
schickt eine kleine Beispieldatei aus `test/fixtures/` durch `convert()` und vergleicht
das Ergebnis exakt, inklusive KA-Kennung, Zahlenformat, Umlauten und Zusammenfassung.
Die Beispieldateien haben die echte Spaltenstruktur und Kodierung, enthalten aber nur
erfundene Namen und Nummern.

Dazu kommen Unit-Tests für Aggregation, CSV-Ausgabe, Spaltenprüfung, Dispatcher und
geänderte Eingangsformate.

## Deployment

Die App läuft unter https://abrechnungskonverter.vercel.app/. Sie ist eine statische
Next.js-Seite und braucht auf Vercel keine Umgebungsvariablen: Repository importieren,
Vercel erkennt Next.js automatisch.

## Projektstruktur

```text
app/
  page.tsx                Oberfläche: Tabs, Upload, Status, Download
lib/convert/
  index.ts                convert(): wählt das Mapping nach Firma bzw. Format
  readFile.ts             liest Dateien als UTF-8, Latin1 oder binär
  parseCsv.ts             Semikolon-CSV-Parser
  parseExcel.ts           liest das erste Tabellenblatt einer Excel-Datei
  validate.ts             Prüfung der erwarteten Spalten
  contentValidation.ts    Inhaltsprüfung bei jeder Konvertierung
  aggregate.ts            fasst gleiche Verträge zusammen und summiert
  buildCsv.ts             Ausgabe-CSV (UTF-8 mit BOM) und Dateiname
  csv/*.ts                Mappings je Versicherer
  excel/*.ts              Excel-Mappings
test/
  fixtures/               anonymisierte Beispieldateien
  *.test.ts               Vitest-Tests
```
