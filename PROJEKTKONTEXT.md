# Projektkontext: Abrechnungs-Konverter

Stand: 23. August 2026  
Repository: `19Kaan25/Abrechnungskonverter`  
Branch: `master`

## 1. Zweck der Anwendung

Der Abrechnungs-Konverter ist eine kleine Next.js-Web-App, die Provisions- und
Courtageabrechnungen verschiedener Versicherungsgesellschaften in ein einheitliches
CSV-Format für ein Bestandsverwaltungssystem überführt:

```text
VS-Nummer;VN-Name;Provision;KA
```

Die Anwendung ersetzt die frühere Kombination aus einer lokal geöffneten HTML-Datei
und einem lokal gestarteten n8n-Workflow. Die komplette Verarbeitung läuft im Browser.
Es gibt kein Backend, keine API-Routen, keine Datenbank und keine API-Schlüssel.
Hochgeladene Abrechnungen werden nicht an einen Server gesendet.

Der frühere PDF-/KI-Zweig über Gemini ist bewusst nicht Bestandteil dieses Projekts.
Die App verarbeitet ausschließlich CSV-, semikolongetrennte HVS-TXT-, XLS- und
XLSX-Dateien.

## 2. Technischer Aufbau

- Framework: Next.js 14.2 mit App Router
- UI: React 18 als Client Component
- Sprache: TypeScript 5.5 im Strict Mode
- CSV-Parser: Papa Parse
- Excel-Parser: SheetJS (`xlsx`)
- Tests: Vitest
- CI: GitHub Actions
- Zielplattform: Vercel

Die Startseite wird statisch vorgerendert. Da keine serverseitigen Funktionen
vorhanden sind, kann die Konvertierung vollständig clientseitig ausgeführt werden.

## 3. Projektstruktur

```text
app/
  layout.tsx                  Metadaten und deutsches HTML-Grundlayout
  page.tsx                    Oberfläche, Upload, Status und Download
  globals.css                 vollständiges Styling der Oberfläche

lib/convert/
  index.ts                    zentraler Dispatcher und Firmenlisten
  types.ts                    gemeinsame Datentypen
  readFile.ts                 UTF-8-/Latin1-/Binär-Dateileser
  parseCsv.ts                 Semikolon-CSV-Parser
  parseExcel.ts               Parser für das erste Excel-Tabellenblatt
  validate.ts                 Prüfung erwarteter Eingangsspalten
  contentValidation.ts        Laufzeitprüfung der Inhalte bei jeder Konvertierung
  aggregate.ts                Gruppierung und Summierung
  buildCsv.ts                 Ausgabe-CSV, BOM und Dateiname
  csv/*.ts                    firmenspezifische CSV-Mappings
  excel/*.ts                  Excel-Mappings

test/
  fixtures/*.csv              anonymisierte, realitätsnahe Beispieldateien
  insurers-*.test.ts          End-to-End-Tests je Versicherer/Format
  format-changes.test.ts      Tests für geänderte Eingangsspalten
  aggregate.test.ts           Tests der Gruppierung/Summierung
  buildCsv.test.ts            Tests der Ausgabe
  validate.test.ts            Tests der Spaltenvalidierung
  dispatcher.test.ts          Tests der Firmenlisten und Dispatcher-Fehler

.github/workflows/ci.yml      automatische Tests bei Push und Pull Request
.claude/launch.json           lokale Dev-Server-Konfiguration
README.md                     kurze Benutzer-/Entwicklerdokumentation
```

## 4. Bedienung im Frontend

Die Oberfläche besitzt zwei Tabs.

### CSV umbauen

1. Versicherungsgesellschaft auswählen.
2. Optional einen eigenen Ausgabedateinamen eingeben.
3. CSV beziehungsweise eine HVS-TXT-Datei per Klick oder Drag-and-drop auswählen.
4. „Datei umbauen & herunterladen“ anklicken.

Auswählbare Gesellschaften:

- R+V / Condor
- ARAG
- Adcuri
- Zürich
- Nürnberger
- VHV
- Auxilla
- HVS (`.txt`)
- Allianz

### Excel zu CSV

1. Versicherungsgesellschaft auswählen; aktuell ist nur InterRisk vorhanden.
2. Dateiformat `.xls` oder `.xlsx` auswählen.
3. Optional einen eigenen Dateinamen eingeben.
4. Excel-Datei auswählen und konvertieren.

Wichtig: Die Excel-Gesellschaftsauswahl steuert aktuell nur den Namen der
Ausgabedatei. Das tatsächliche Mapping wird allein durch das gewählte Format bestimmt:

- `.xls` verwendet das InterRisk-Mapping.
- `.xlsx` verwendet das aus dem früheren Workflow übernommene Adcuri-Mapping.

Wenn später weitere Excel-Gesellschaften hinzukommen, sollte der Dispatcher auf eine
echte Kombination aus Gesellschaft und Format umgestellt werden.

### Status und Download

- Ohne ausgewählte Datei ist der Konvertierungsbutton deaktiviert.
- Während der Verarbeitung erscheint ein Ladezustand.
- Bei Erfolg startet der Browser automatisch den CSV-Download und zeigt die Anzahl der
  ausgegebenen Verträge an.
- Bei einem Fehler erscheint die Fehlermeldung als roter Statusblock.
- Bei nicht-blockierenden Auffälligkeiten startet der Download weiterhin und ein gelber
  Warnblock nennt die betroffenen Zeilen beziehungsweise Auffälligkeiten.

Die `accept`-Attribute der Dateifelder sind nur Browser-Hinweise. Entscheidend ist die
anschließende Spaltenvalidierung; eine fachlich falsche Datei soll dort auffallen.

## 5. Allgemeiner Datenfluss

```text
Datei + Modus + Gesellschaft + optionaler Dateiname
  -> Datei mit passendem Encoding lesen
  -> CSV oder erstes Excel-Tabellenblatt parsen
  -> erwartete Eingangsspalten prüfen
  -> Inhalte und Zahlen bei jeder Konvertierung plausibilisieren
  -> firmenspezifisches Mapping auf Row { vs, vn, prov, ka }
  -> gleiche VS-Nummer + VN-Name + KA gruppieren
  -> Provisionen einschließlich Stornos summieren
  -> erzeugte Ausgabe nochmals auf finanzielle Lesbarkeit prüfen
  -> feste Zielkopfzeile und optionale Fußzeile erzeugen
  -> UTF-8-CSV mit BOM im Browser herunterladen
```

Das Zielformat einer internen Zeile ist:

```ts
interface Row {
  vs: string;
  vn: string;
  prov: string;
  ka: string;
}
```

`ConvertResult` enthält neben Dateiname, CSV und Zeilenzahl auch ein Array
`warnings`. Diese Hinweise werden im Frontend gelb dargestellt und verhindern den
Download nicht.

## 6. Gemeinsame Ausgaberegeln

### Kopfzeile und Encoding

Jede Ausgabe beginnt mit:

```text
VS-Nummer;VN-Name;Provision;KA
```

Die Ausgabedatei enthält ein UTF-8-BOM, damit Excel Umlaute zuverlässig erkennt.
Als Zeilenumbruch wird `\n` verwendet.

### Dateiname

- Ohne eigenen Namen: `abrechnung_<gesellschaft-klein>_<YYYY-MM-DD>.csv`
- Mit eigenem Namen: Der Name wird getrimmt und `.csv` ergänzt, falls der String nicht
  exakt auf `.csv` endet.
- Das Datum wird über `new Date().toISOString()` ermittelt und ist damit das UTC-Datum.

### Aggregation

Die gemeinsame Aggregation gruppiert nach der exakten Kombination:

```text
VS-Nummer + VN-Name + KA
```

Nur wenn alle drei Werte gleich sind, werden Provisionen summiert. Dieselbe VS-Nummer
mit anderem Namen oder anderem KA-Wert bleibt in einer separaten Ausgabezeile.
Negative Beträge werden gegengerechnet. Das Ergebnis hat immer zwei Nachkommastellen
und ein deutsches Dezimalkomma.

Die Ausgabe wird nicht alphabetisch oder numerisch sortiert. Eine JavaScript-`Map`
bewahrt die Reihenfolge des ersten Auftretens jeder Gruppe in der Eingabedatei.

Eine Netto-Provision von `0,00` wird nicht entfernt, sondern ausgegeben.

### Feldbereinigung

Der gemeinsame Helfer `safe()` trimmt Werte und ersetzt Semikolons innerhalb eines
Felds durch Kommas, damit das Ziel-CSV nicht beschädigt wird. Es findet keine allgemeine
CSV-Quotierung der Ausgabefelder statt.

## 7. CSV-Mappings je Gesellschaft

### R+V / Condor

- Encoding: UTF-8
- Pflichtspalten: `vsnr`, `vn_name`, `prov_betr`, `prov_satz_eff`
- VS-Nummer: `vsnr`
- VN-Name: `vn_name` unverändert und getrimmt
- Provision: `prov_betr`
- KA: `1`, wenn `prov_satz_eff >= 4`, sonst `0`
- Leere VS-Nummern werden übersprungen.

### ARAG

- Encoding: UTF-8
- Pflichtspalten/Suchbegriffe: `VS-NR`, `VN-NAME`, `BP-ANSPR-BTR`, `BP-PRV SATZ`
- Spalten werden case-insensitiv über Teilstrings gesucht.
- Provision: Punkte werden durch Kommas ersetzt.
- KA: `1`, wenn `BP-PRV SATZ >= 4`, sonst `0`
- Leere VS-Nummern werden übersprungen.

### Adcuri CSV

- Encoding: UTF-8
- Pflichtspalten/Suchbegriffe: `Vertragsnummer`, `Versicherungsnehmer`,
  `Provisionssatz`, `Provisionsbetrag`
- Führende Nullen der Vertragsnummer werden vollständig entfernt.
- VN-Name wird aus `Versicherungsnehmer` übernommen.
- Der Provisionssatz liegt als Anteil vor, z. B. `0.30 = 30 %`, und wird vor dem
  Vergleich mit 100 multipliziert.
- KA: `1`, wenn der umgerechnete Satz `> 4` ist, sonst `0`

### Zürich

- Encoding: UTF-8
- VS-Nummer: Spalte mit `STAMM-NR` oder `VSNR`
- VN-Name: Spalte mit `BUCHUNGSTEXT`
- Provision: exakt die Spalte `Courtage`
- `Courtagebasis` darf nicht versehentlich als Provision verwendet werden.
- KA: `1`, wenn `Courtagesatz > 4`, sonst `0`
- Negative Courtagebeträge bleiben negativ und werden bei der Aggregation verrechnet.

### Nürnberger

- Encoding: ISO-8859-1/Latin1
- Pflichtspalten: `PROVISIONSART`, `VSNR`, `VN_NAME`, `TEILPROVISION`
- Nur Zeilen mit `PROVISIONSART == COURTAGE` werden verarbeitet.
- VN-Name: `VN_NAME, VN_VORNAME`; ohne Vorname nur der Nachname.
- `TEILPROVISION` wird aus deutschem Zahlenformat gelesen und anschließend mit `-1`
  multipliziert. Dieses Vorzeichenverhalten stammt aus der früheren Automatisierung.
- KA ist immer `1`.
- Führende Nullen der VS-Nummer bleiben erhalten.

### Auxilla

- Encoding: ISO-8859-1/Latin1
- Pflichtspalten: `MNR`, `NAME`, `VORNAME`, `PROVISION_BETRAG`,
  `PROVISION_PROZENT`
- VS-Nummer: `MNR`
- VN-Name: `NAME, VORNAME`; fehlt einer, wird nur der vorhandene Teil ohne Komma benutzt.
- Provision: `PROVISION_BETRAG`
- Nur Zeilen mit `4 < PROVISION_PROZENT < 51` werden übernommen.
- Die Grenzwerte 4 und 51 selbst sind ausgeschlossen.
- KA ist immer `1`.
- Ausgefilterte Auxilla-Verträge werden nicht in einer Fußzeile gemeldet.

### HVS

- Eingabeformat: semikolongetrennte `.txt`-Datei
- Encoding: ISO-8859-1/Latin1
- Pflichtspalten, jeweils als exakter Spaltenname: `Vertrag`, `Versicherungsnehmer`,
  `Courtage`, `Prozentsatz`
- VS-Nummer: `Vertrag`
- VN-Name: aus `Versicherungsnehmer`; eine angehängte Anschrift im Muster
  `Name, Straße Hausnummer, 12345 Ort` wird entfernt. Kommas innerhalb des eigentlichen
  Namens bleiben erhalten. Ohne eindeutigen PLZ-/Adressblock bleibt der Wert unverändert.
- Provision: exakt `Courtage`; `Gesamt-Courtage` darf nicht verwendet werden.
- Nur Zeilen mit `4 < Prozentsatz < 51` werden übernommen.
- Die Grenzwerte 4 und 51 selbst sind ausgeschlossen.
- KA ist für übernommene Zeilen immer `1`.
- Negative Courtagewerte bleiben negativ und werden in der Aggregation verrechnet.
- Tausenderpunkte und Füllleerzeichen werden vor der Aggregation aus der Courtage
  entfernt.

Die echte HVS-Datei besitzt einen ungewöhnlichen Zeilenumbruch: Direkt nach der
Kopfzeile kann nur ein einzelnes `CR` stehen, während die weiteren Zeilen `CRLF`
verwenden. Der Dispatcher normalisiert deshalb für HVS alle Varianten vor Papa Parse
auf `\n`. Ohne diese Normalisierung würde die erste Datenzeile teilweise als zusätzliche
Kopfspalten interpretiert und der erste Vertrag verloren gehen.

### Allianz

- Encoding: UTF-8/ASCII-kompatibel; die vorliegende Originaldatei enthält nur
  ASCII-Zeichen.
- Pflichtspalten, jeweils als exakter Spaltenname: `VERTRAGS_OM`, `VN_NAME`,
  `PROVISIONSBETRAG`, `PROVISIONSSATZ`
- VS-Nummer: `VERTRAGS_OM` wird inhaltlich unverändert übernommen. Buchstaben,
  Bindestriche und führende Nullen bleiben erhalten, z. B. `AS-1000000001` oder
  `00B-0007X`.
- VN-Name: Allianz liefert Personen als `Nachname Vorname`; am ersten Leerraum wird
  daraus `Nachname, Vorname`. Mehrere Vornamen bleiben zusammen. Bereits mit Komma
  formatierte Namen bleiben unverändert. Namen mit bekannten Rechtsformbezeichnungen
  wie GmbH, AG, KG, GbR, UG, OHG, SE oder e.K. bleiben ebenfalls unverändert.
- Provision: exakt `PROVISIONSBETRAG`; ähnliche Spalten dürfen nicht als Ersatz dienen.
- Das Vorzeichen wird umgedreht: `-1,23 -> 1,23`, `2,67 -> -2,67`.
- Tausenderpunkte und Füllleerzeichen werden vor der Vorzeichenumkehr entfernt.
- Nur Zeilen mit `3 < PROVISIONSSATZ < 51` werden übernommen.
- Die Grenzwerte 3 und 51 selbst sind ausgeschlossen.
- KA ist für übernommene Zeilen immer `1`.
- Mehrfachzeilen mit gleicher VS-Nummer, formatiertem VN-Namen und KA werden nach der
  Vorzeichenumkehr gemeinsam aggregiert.

### VHV

VHV besitzt einen eigenen Konvertierungspfad und ist das komplexeste Mapping.

- Encoding: ISO-8859-1/Latin1
- Die Datei enthält mehrere Logo-/Metadatenzeilen vor der Tabelle.
- Die echte Kopfzeile wird dynamisch als erste Zeile gesucht, die
  `Vers.Schein-Nr.` enthält.
- Pflichtspalten: `Vers.Schein-Nr.`, `Prov.Betrag`, `Prov %`, `Name 1`
- Leere VS-Nummern und Summenzeilen mit `*` werden ignoriert.
- VN-Name: `Name 1, Name 2`; fehlt einer, nur der vorhandene Teil ohne Komma.
- Provision: `Prov.Betrag` im deutschen Zahlenformat.
- Nur Zeilen mit `4 < Prov % < 51` werden übernommen.
- KA ist immer `1`.

VHV-Stornos können als Minuszeichen mit vielen Füllleerzeichen geschrieben sein,
beispielsweise `-         12,80`. Vor der Verarbeitung werden alle Leerzeichen und
Tausenderpunkte aus dem Betrag entfernt, sodass der Storno als `-12,80` aggregiert wird.

#### VHV-Normalisierung der VS-Nummer

Für Nummern im Format `Präfix-Hauptnummer/Untervertrag` gelten folgende Regeln:

- Das Präfix vor dem Bindestrich bleibt unverändert, auch bei führender Null.
- Führende Nullen nach dem Bindestrich werden entfernt.
- Führende Nullen nach dem Schrägstrich werden entfernt.
- In jedem bereinigten Segment bleibt mindestens eine Ziffer erhalten.
- Nummern ohne Bindestrich bleiben unverändert.

Beispiele:

```text
006-100001          -> 006-100001
577-010001/0001     -> 577-10001/1
073-020001/0001     -> 073-20001/1
626-090001          -> 626-90001
700-000001          -> 700-1
177-100002/0010     -> 177-100002/10
177-100002/0000     -> 177-100002/0
PN0 0002 4944 34    -> PN0 0002 4944 34
```

#### VHV-Fußzeile

Alle echten, normalisierten VS-Nummern werden zunächst als Kandidaten gesammelt. Eine
Nummer gilt als übernommen, wenn mindestens eine gültige Zeile für sie ausgegeben wird.
Kandidaten ohne gültige Ausgabezeile werden nach einer Leerzeile gemeldet:

```text
Nicht aufgelistete VS-Nummer/n: <Nummer 1>, <Nummer 2>, ...
```

Die Fußzeile zählt nicht zum `rowCount`. Summenzeilen werden nicht als fehlende Verträge
gemeldet.

## 8. Excel-Mappings

Excel-Dateien werden als ArrayBuffer gelesen. SheetJS erkennt das Binärformat anhand des
Dateiinhalts. Es wird ausschließlich das erste Tabellenblatt verarbeitet, mit der ersten
Zeile als Kopfzeile. Fehlende Zellwerte werden als leerer String geliefert.

### `.xls`: InterRisk-Mapping

- Pflichtspalten: `Vertragsnummer`, exakt `Name VN`, exakt `Vorname VN`,
  `Provisionssatz`, `Provisionsbetrag`
- Führende Nullen der Vertragsnummer werden entfernt; Buchstaben bleiben erhalten.
- Beispiel: `00100001N -> 100001N`
- VN-Name: `Name VN, Vorname VN`; fehlt ein Wert, nur der vorhandene Wert ohne Komma.
- Provision: Punkt wird zum Dezimalkomma.
- KA: `1`, wenn `Provisionssatz > 4`, sonst `0`

`Name VN` und `Vorname VN` werden exakt gesucht, weil `Vorname VN` den Teilstring
`Name VN` enthält. So kann eine fehlende Nachnamensspalte nicht unbemerkt zu einem
verdoppelten Namen wie `Michael, Michael` führen.

### `.xlsx`: Adcuri-Mapping

- Pflichtspalten: `Vertragsnummer`, `Versicherungsnehmer`, `Provisionssatz`,
  `Provisionsbetrag`
- Führende Nullen der Vertragsnummer werden entfernt.
- VN-Name wird aus `Versicherungsnehmer` übernommen.
- Provisionssatz als Anteil wird mit 100 multipliziert.
- KA: `1`, wenn der umgerechnete Satz `> 4` ist, sonst `0`

## 9. Erkennung geänderter Dateiformate

`requireColumns()` prüft vor dem Mapping anhand des ersten geparsten Datensatzes, ob
alle erwarteten Spalten vorhanden sind. Die Suche ist grundsätzlich case-insensitiv
und erlaubt Teilstringtreffer. Für kollisionsgefährdete Spalten kann ein exakter Match
verlangt werden, zum Beispiel:

- Zürich: `Courtage` ist nicht `Courtagebasis`.
- InterRisk: `Name VN` ist nicht `Vorname VN`.

Bei einer fehlenden Kernspalte wird die Verarbeitung abgebrochen. Die UI zeigt eine
Meldung nach folgendem Muster:

```text
<Gesellschaft>: Erwartete Spalte(n) nicht gefunden: <Spalten>. Hat sich das
Dateiformat geändert? Vorhandene Spalten: ...
```

Dadurch sollen still erzeugte leere Dateien oder Provisionen mit einem falschen
Standardwert verhindert werden.

### Laufzeit-Inhaltsprüfung ohne historische Daten

`contentValidation.ts` wird bei jeder Konvertierung aufgerufen. Es werden keine
Abrechnungen, Statistiken oder historischen Referenzwerte gespeichert. Die Prüfung
arbeitet ausschließlich mit der aktuell hochgeladenen Datei und festen Fachregeln.

Blockierende Fehler:

- CSV-Zeilen haben eine inkonsistente Spaltenanzahl oder fehlerhafte Struktur.
- Die Datei oder das erste Excel-Blatt enthält keine Datenzeilen.
- Eine relevante Provision fehlt oder ist nicht als Zahl lesbar.
- Ein relevanter Provisionssatz fehlt oder ist nicht als Zahl lesbar.
- Direkte Prozentsätze liegen außerhalb 0 bis 100.
- Als Anteil erwartete Sätze (Adcuri CSV und `.xlsx`) liegen außerhalb 0 bis 1; damit
  wird beispielsweise ein Wechsel von `0,30` auf `30` erkannt.
- Nach Mapping und Aggregation existiert keine gültige Ausgabezeile.
- Eine erzeugte Provision ist intern nicht lesbar oder KA ist nicht `0`/`1`.

Nicht-blockierende Warnungen:

- einzelne Zeilen ohne VS-Nummer werden übersprungen und mit Zeilennummer gemeldet;
- fehlende VN-Namen werden gemeldet, die Konvertierung und Ausgabe aber fortgesetzt;
- typische beschädigte UTF-8-/Latin1-Zeichen werden gemeldet;
- die Anzahl der wegen des Provisionssatzbereichs bewusst ausgefilterten Zeilen wird
  gemeldet;
- ausschließlich `0,00`-Provisionen oder extrem hohe Einzelprovisionen werden als
  auffällig markiert.

Die Warnungen erscheinen nach dem erfolgreichen Download in einem gelben Statusblock.
Kritische Fehler erscheinen rot und verhindern den Download.

Bekannte Grenzen:

- Wenn ein Versicherer Spaltennamen und plausible Werte beibehält, aber die fachliche
  Bedeutung einer Spalte ändert, kann das ohne Referenz-/Historienwissen unbemerkt
  bleiben.
- Namensreihenfolgen lassen sich nur anhand der bekannten firmenspezifischen Regel
  prüfen, nicht semantisch gegen eine Personendatenbank.
- Ungewöhnliche, aber numerisch plausible Beträge werden bis auf eine sehr hohe
  Warnschwelle nicht automatisch als falsch bewertet.

## 10. Tests und CI

Die Tests verwenden anonymisierte Fixtures mit erfundenen Personen- und
Vertragsdaten, aber realitätsnahen Spaltennamen und Encodings. Latin1-Fixtures werden
im Test vor dem Aufruf in echte Latin1-Bytes umgewandelt.

Abgedeckt sind unter anderem:

- alle CSV-Gesellschaften und beide Excel-Mappings als End-to-End-Konvertierung
- Aggregation gleicher Verträge
- negative Beträge/Stornos
- KA-Grenzwerte und satzabhängige Regeln
- Latin1-Umlaute
- VHV-Kopfzeile, Summenzeilen, Fußzeile und VS-Nummernnormalisierung
- HVS-Latin1-TXT, gemischte CR-/CRLF-Zeilenumbrüche und exakte Courtage-Spalte
- Allianz-Vertragsnummern mit Buchstaben/Nullen, Namensformat und Vorzeichenumkehr
- exakte Zürich-Spalte `Courtage`
- InterRisk-Kollision `Name VN`/`Vorname VN`
- BOM, Dateinamen und Zeilenzahl
- klare Fehler bei fehlenden Kernspalten
- Laufzeitwarnung bei fehlendem VN-Namen ohne Abbruch
- Laufzeitabbruch bei ungültigen finanziellen Werten
- Inhalte der Dropdown-Listen

Zum dokumentierten Stand existieren 53 Tests in 8 Testdateien.

Lokale Befehle:

```bash
npm test
npm run test:watch
npm run build
```

GitHub Actions führt bei jedem Push und Pull Request auf Ubuntu mit Node.js 22 aus:

```text
npm ci
npm test
```

Der Next.js-Produktionsbuild ist derzeit kein Bestandteil der CI; er wird nur lokal
oder durch Vercel geprüft.

## 11. Datenschutz und Betrieb

- Die Verarbeitung findet lokal im Browser statt.
- Es werden keine hochgeladenen Abrechnungsdaten persistiert oder übertragen.
- Es gibt keine Secrets oder Umgebungsvariablen.
- Die App kann direkt aus dem GitHub-Repository auf Vercel deployed werden.
- Vercel erkennt Next.js automatisch.

## 12. Bekannte Annahmen und wichtige Details

- Alle CSV- und HVS-TXT-Eingaben sind semikolongetrennt.
- Die gewählte Versicherungsgesellschaft muss zum Format der hochgeladenen Datei passen.
- CSV-Strukturfehler und ungültige finanzielle Pflichtwerte verhindern den Download.
- Fehlende VN-Namen sind ausdrücklich nur eine Warnung und blockieren nicht.
- Zeilen ohne VS-Nummer werden übersprungen und als Warnung mit Zeilennummer gemeldet.
- Die Aggregation interpretiert Provisionen mit Dezimalkomma und erwartet, dass
  firmenspezifische Tausender-/Füllzeichen vorher bereinigt wurden.
- Die Ausgabereihenfolge entspricht dem ersten Auftreten und ist keine Sortierung.
- VHV meldet ausgeschlossene VS-Nummern in einer Fußzeile; Auxilla meldet sie nicht.
- Das PDF-/KI-Mapping des früheren n8n-Workflows ist nicht enthalten.

## 13. Vorgehen bei Erweiterungen

### Neue CSV-Gesellschaft

1. Echte CSV-/TXT-Beispieldatei auf Encoding, Trennzeichen, Zeilenumbrüche, Kopfzeile,
   Betragsformat, Stornos, Provisionssatz und Sonder-/Summenzeilen untersuchen.
2. Mapper unter `lib/convert/csv/<gesellschaft>.ts` anlegen.
3. Pflichtspalten mit `requireColumns()` absichern.
4. Mapper in `CSV_MAPPERS` registrieren.
5. Bei Latin1 die Gesellschaft zu `LATIN1_COMPANIES` hinzufügen.
6. Eintrag in `CSV_COMPANIES` ergänzen.
7. Anonymisierte Fixture und End-to-End-Test hinzufügen.
8. Einen Formatänderungstest für eine fehlende Kernspalte ergänzen.
9. README und diese Kontextdatei aktualisieren.
10. `npm test` und `npm run build` ausführen.

### Neue Excel-Gesellschaft

Vor einer weiteren Excel-Gesellschaft sollte die aktuelle Formatkopplung refaktoriert
werden. Empfohlen ist ein Dispatcher nach Gesellschaft und gegebenenfalls Dateiformat,
statt nur `mode === "xls"` bzw. `mode === "xlsx"` auszuwerten.

### Änderung eines Versichererformats

Wenn die UI einen Fehler über fehlende Spalten meldet:

1. Neue Originaldatei sicher untersuchen.
2. Mapping und Spaltenvalidierung anpassen.
3. Fixture an das neue Format angleichen.
4. Vorhandene Fachregeln und Summen gegen eine reale Datei verifizieren.
5. Tests und Build ausführen, danach committen und pushen.
