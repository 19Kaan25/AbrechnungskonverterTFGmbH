"use client";

import { useRef, useState } from "react";
import {
  convert,
  CSV_COMPANIES,
  EXCEL_COMPANIES,
  EXCEL_FORMATS,
} from "@/lib/convert";
import type { Mode } from "@/lib/convert/types";

type Tab = "csv" | "excel";
type StatusKind = "loading" | "success" | "warning" | "error" | null;

export default function Home() {
  const [tab, setTab] = useState<Tab>("csv");
  const [status, setStatus] = useState<StatusKind>(null);
  const [statusMsg, setStatusMsg] = useState("");

  // CSV-Tab
  const [csvCompany, setCsvCompany] = useState(CSV_COMPANIES[0].value);
  const [csvName, setCsvName] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvDrag, setCsvDrag] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Excel-Tab
  const [excelCompany, setExcelCompany] = useState(EXCEL_COMPANIES[0].value);
  const [excelFormat, setExcelFormat] = useState<"xls" | "xlsx">(EXCEL_FORMATS[0].value);
  const [excelName, setExcelName] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelDrag, setExcelDrag] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

  function switchTab(next: Tab) {
    setTab(next);
    setStatus(null);
  }

  async function handleSubmit(mode: Tab) {
    const file = mode === "csv" ? csvFile : excelFile;
    if (!file) return;

    const company = mode === "csv" ? csvCompany : excelCompany;
    const customName = mode === "csv" ? csvName : excelName;
    // HVS gibt es nur als .xls
    const convertMode: Mode =
      mode === "csv" ? "csv" : excelCompany === "HVS" ? "xls" : excelFormat;

    setStatus("loading");
    setStatusMsg(
      mode === "csv" ? "CSV wird umformatiert…" : "Excel-Datei wird verarbeitet…",
    );

    try {
      const result = await convert({ file, mode: convertMode, company, customName });

      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);

      if (result.warnings.length > 0) {
        setStatus("warning");
        setStatusMsg(
          `Fertig: ${result.rowCount} Verträge → ${result.filename}\n` +
            result.warnings.map((warning) => `• ${warning}`).join("\n"),
        );
      } else {
        setStatus("success");
        setStatusMsg(`Fertig: ${result.rowCount} Verträge → ${result.filename}`);
      }
    } catch (err) {
      setStatus("error");
      setStatusMsg(err instanceof Error ? err.message : "Fehler beim Verarbeiten.");
    }
  }

  function onDrop(e: React.DragEvent, mode: Tab) {
    e.preventDefault();
    if (mode === "csv") setCsvDrag(false);
    else setExcelDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (mode === "csv") setCsvFile(f);
    else setExcelFile(f);
  }

  const csvReady = csvFile !== null;
  const excelReady = excelFile !== null;

  return (
    <div className="card">
      <h1>📄 Abrechnungs-Konverter</h1>
      <p className="subtitle">Datenaufbereitung für das Bestandsverwaltungssystem</p>

      <div className="tabs">
        <button
          className={`tab ${tab === "csv" ? "active" : ""}`}
          onClick={() => switchTab("csv")}
        >
          CSV umbauen
        </button>
        <button
          className={`tab ${tab === "excel" ? "active" : ""}`}
          onClick={() => switchTab("excel")}
        >
          Excel zu CSV
        </button>
      </div>

      {tab === "csv" && (
        <div>
          <label>Versicherungsgesellschaft</label>
          <select
            className="select-style"
            value={csvCompany}
            onChange={(e) => setCsvCompany(e.target.value)}
          >
            {CSV_COMPANIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <label>
            Dateiname der neuen Datei <span>(optional)</span>
          </label>
          <input
            type="text"
            placeholder="z.B. vhv_abrechnung_mai"
            value={csvName}
            onChange={(e) => setCsvName(e.target.value)}
          />

          <label>Originale CSV-/TXT-Datei</label>
          <div
            className={`file-area ${csvDrag ? "drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setCsvDrag(true);
            }}
            onDragLeave={() => setCsvDrag(false)}
            onDrop={(e) => onDrop(e, "csv")}
          >
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            />
            <div className="file-icon">📊</div>
            <p>
              {csvFile ? (
                <span className="file-selected">✓ {csvFile.name}</span>
              ) : (
                "CSV oder HVS-TXT hier ablegen oder klicken"
              )}
            </p>
          </div>

          <button
            className="submit"
            disabled={!csvReady || status === "loading"}
            onClick={() => handleSubmit("csv")}
          >
            Datei umbauen &amp; herunterladen
          </button>
        </div>
      )}

      {tab === "excel" && (
        <div>
          <label>Versicherungsgesellschaft</label>
          <select
            className="select-style"
            value={excelCompany}
            onChange={(e) => setExcelCompany(e.target.value)}
          >
            {EXCEL_COMPANIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          {excelCompany === "HVS" ? (
            <p className="hint">
              HVS-Datei (.xls) bitte vorher in Excel öffnen und ohne Passwort speichern.
            </p>
          ) : (
            <>
              <label>Dateiformat</label>
              <select
                className="select-style"
                value={excelFormat}
                onChange={(e) => setExcelFormat(e.target.value as "xls" | "xlsx")}
              >
                {EXCEL_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </>
          )}

          <label>
            Dateiname der neuen Datei <span>(optional)</span>
          </label>
          <input
            type="text"
            placeholder="z.B. excel_abrechnung_mai"
            value={excelName}
            onChange={(e) => setExcelName(e.target.value)}
          />

          <label>Originale Excel-Datei (.xls, .xlsx)</label>
          <div
            className={`file-area ${excelDrag ? "drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setExcelDrag(true);
            }}
            onDragLeave={() => setExcelDrag(false)}
            onDrop={(e) => onDrop(e, "excel")}
          >
            <input
              ref={excelInputRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
            />
            <div className="file-icon">📈</div>
            <p>
              {excelFile ? (
                <span className="file-selected">✓ {excelFile.name}</span>
              ) : (
                "Excel hier ablegen oder klicken"
              )}
            </p>
          </div>

          <button
            className="submit"
            disabled={!excelReady || status === "loading"}
            onClick={() => handleSubmit("excel")}
          >
            Excel umbauen &amp; herunterladen
          </button>
        </div>
      )}

      {status === "loading" && (
        <div className="status loading">
          <div className="spinner" />
          <span>{statusMsg}</span>
        </div>
      )}
      {status === "success" && <div className="status success">✅ {statusMsg}</div>}
      {status === "warning" && <div className="status warning">⚠️ {statusMsg}</div>}
      {status === "error" && <div className="status error">❌ {statusMsg}</div>}
    </div>
  );
}
