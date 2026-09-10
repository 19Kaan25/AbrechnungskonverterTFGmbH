// Liest eine hochgeladene Datei mit dem passenden Encoding als Text ein.
//
// Hintergrund: Der alte n8n-Workflow las die Nürnberger-CSV mit "latin1" (ISO-8859-1)
// ein, alle anderen CSVs als UTF-8. Excel-Dateien werden als ArrayBuffer (binär) für
// SheetJS benötigt.

export async function readAsText(
  file: File,
  encoding: "utf-8" | "iso-8859-1" = "utf-8",
): Promise<string> {
  const buffer = await file.arrayBuffer();
  const text = new TextDecoder(encoding).decode(buffer);
  // Falls vorhanden, führenden BOM entfernen (papaparse würde ihn sonst in den
  // ersten Spaltennamen ziehen).
  return text.replace(/^﻿/, "");
}

export async function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}
