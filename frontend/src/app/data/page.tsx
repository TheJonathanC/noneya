"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Database,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Download,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { LinenHeader } from "@/components/linen/LinenHeader";

interface MongoTelemetryRecord {
  id: string;
  batch_id: string;
  machine_id: string;
  timestamp: string;
  classified_defect: string;
  sensor_readings: {
    mold_temp?: number;
    injection_pressure?: number;
    cooling_rate?: number;
    vibration?: number;
    machine_speed?: number;
    humidity?: number;
    [key: string]: number | undefined;
  };
  root_cause?: {
    predicted_cause_defect?: string;
    confidence_score?: number;
    primary_culprit_sensor?: string;
    z_score_deviation?: number;
    diagnostic_explanation?: string;
    cause?: string;
    action?: string;
  };
}

const BASELINES: Record<string, { label: string; unit: string; target: number; min: number; max: number; std: number }> = {
  mold_temp: { label: "Mold Temp", unit: "°C", target: 685.0, min: 660, max: 710, std: 4.5 },
  injection_pressure: { label: "Injection Pressure", unit: "bar", target: 142.0, min: 130, max: 155, std: 3.0 },
  cooling_rate: { label: "Cooling Rate", unit: "°C/s", target: 12.0, min: 9.0, max: 15.0, std: 0.8 },
  vibration: { label: "Vibration", unit: "mm/s", target: 1.2, min: 0.8, max: 1.6, std: 0.15 },
  machine_speed: { label: "Machine Speed", unit: "u/h", target: 1200, min: 1100, max: 1300, std: 25.0 },
  humidity: { label: "Humidity", unit: "%RH", target: 42.0, min: 35.0, max: 50.0, std: 2.5 },
};

export default function TelemetryDataPage() {
  const [records, setRecords] = useState<MongoTelemetryRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OK" | "DEFECT">("ALL");
  const [limit, setLimit] = useState<number>(100);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  // Sorting
  const [sortField, setSortField] = useState<"timestamp" | "batch_id" | "defect">("timestamp");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const fetchRecords = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/telemetry/recent?limit=${limit}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setIsConnected(Boolean(json.connected));
        if (Array.isArray(json.records)) {
          setRecords(json.records);
        } else {
          setRecords([]);
        }
      } else {
        setErrorMsg(`HTTP ${res.status}: Failed to pull telemetry records.`);
      }
    } catch (err) {
      console.error("Telemetry fetch error:", err);
      setErrorMsg("Network error connecting to MongoDB backend service.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [limit]);

  // Filtered & sorted records
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (statusFilter === "OK") {
      result = result.filter((r) => r.classified_defect === "ok" || r.classified_defect === "nominal");
    } else if (statusFilter === "DEFECT") {
      result = result.filter((r) => r.classified_defect !== "ok" && r.classified_defect !== "nominal");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.batch_id?.toLowerCase().includes(q) ||
          r.machine_id?.toLowerCase().includes(q) ||
          r.classified_defect?.toLowerCase().includes(q) ||
          r.root_cause?.primary_culprit_sensor?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let comp = 0;
      if (sortField === "timestamp") {
        comp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else if (sortField === "batch_id") {
        comp = (a.batch_id || "").localeCompare(b.batch_id || "");
      } else if (sortField === "defect") {
        comp = (a.classified_defect || "").localeCompare(b.classified_defect || "");
      }
      return sortAsc ? comp : -comp;
    });

    return result;
  }, [records, statusFilter, searchQuery, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page]);

  // Export CSV
  const handleExportCsv = () => {
    if (filteredRecords.length === 0) return;
    const headers = [
      "ID",
      "Timestamp",
      "Batch ID",
      "Machine ID",
      "Status",
      "Mold Temp (°C)",
      "Injection Pressure (bar)",
      "Cooling Rate (°C/s)",
      "Vibration (mm/s)",
      "Machine Speed (u/h)",
      "Humidity (%RH)",
      "Primary Culprit Sensor",
      "Z-Score Deviation",
    ];

    const rows = filteredRecords.map((r) => [
      r.id,
      r.timestamp,
      r.batch_id,
      r.machine_id,
      r.classified_defect,
      r.sensor_readings?.mold_temp ?? "",
      r.sensor_readings?.injection_pressure ?? "",
      r.sensor_readings?.cooling_rate ?? "",
      r.sensor_readings?.vibration ?? "",
      r.sensor_readings?.machine_speed ?? "",
      r.sensor_readings?.humidity ?? "",
      r.root_cause?.primary_culprit_sensor ?? "",
      r.root_cause?.z_score_deviation ?? "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `telemetry_mongodb_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1C1917]">
      <LinenHeader />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Top Control Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE4D7]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#1C1917]">
                Process Telemetry Sheet
              </h1>
              <span
                className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isConnected
                    ? "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
                    : "bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]"
                }`}
              >
                {isConnected ? "MONGODB ATLAS LIVE" : "SYNCING CACHE"}
              </span>
            </div>
            <p className="text-xs text-[#78716A] mt-0.5">
              Live historical sensor sheet pulled directly from MongoDB database records.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={fetchRecords}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-xs font-medium text-[#1C1917] transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#78716A] ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1C1917] bg-[#1C1917] hover:bg-[#2C2724] text-xs font-medium text-[#FAF8F5] transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FFFFFF] p-3 rounded-xl border border-[#E5DFD3] shadow-xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-[#A8A29E] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search batch, machine, defect..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FAF8F5] text-xs text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#1C1917]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter Buttons */}
            <div className="flex items-center bg-[#F3EFE6] p-0.5 rounded-lg border border-[#E5DFD3] text-xs">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("ALL");
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === "ALL" ? "bg-white text-[#1C1917] shadow-xs" : "text-[#78716A] hover:text-[#1C1917]"
                }`}
              >
                All ({records.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("OK");
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === "OK" ? "bg-white text-[#166534] shadow-xs" : "text-[#78716A] hover:text-[#166534]"
                }`}
              >
                Nominal
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("DEFECT");
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === "DEFECT" ? "bg-white text-[#991B1B] shadow-xs" : "text-[#78716A] hover:text-[#991B1B]"
                }`}
              >
                Defects
              </button>
            </div>

            {/* Fetch Limit Selector */}
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="py-1 px-2.5 rounded-lg border border-[#DDD5C7] bg-[#FAF8F5] text-xs text-[#1C1917] font-mono"
            >
              <option value={30}>Pull 30</option>
              <option value={60}>Pull 60</option>
              <option value={100}>Pull 100</option>
            </select>
          </div>
        </div>

        {/* Tabular Spreadsheet View */}
        <div className="flex-1 rounded-2xl border border-[#E5DFD3] bg-[#FFFFFF] shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1 max-h-[680px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#F3EFE6] text-[#78716A] border-b border-[#E5DFD3] z-10 font-mono text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th
                    onClick={() => {
                      if (sortField === "timestamp") setSortAsc(!sortAsc);
                      else {
                        setSortField("timestamp");
                        setSortAsc(false);
                      }
                    }}
                    className="py-2.5 px-3 font-semibold cursor-pointer hover:text-[#1C1917]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Timestamp</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      if (sortField === "batch_id") setSortAsc(!sortAsc);
                      else {
                        setSortField("batch_id");
                        setSortAsc(true);
                      }
                    }}
                    className="py-2.5 px-3 font-semibold cursor-pointer hover:text-[#1C1917]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Batch ID</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3 font-semibold">Machine</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Mold Temp (°C)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Pressure (bar)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Cooling (°C/s)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Vib (mm/s)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Speed (u/h)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Humidity (%)</th>
                  <th className="py-2.5 px-3 font-semibold">Primary Culprit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE1] font-mono text-[11px]">
                {isLoading && records.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-[#78716A]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#78716A]" />
                        <span>Pulling historical telemetry from MongoDB Atlas...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-[#78716A]">
                      No telemetry records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((rec) => {
                    const isDefect = rec.classified_defect !== "ok" && rec.classified_defect !== "nominal";
                    const culprit = rec.root_cause?.primary_culprit_sensor?.toLowerCase() || null;
                    const readings = rec.sensor_readings || {};

                    return (
                      <tr
                        key={rec.id}
                        className={`hover:bg-[#FAF8F5] transition-colors ${
                          isDefect ? "bg-[#FEF2F2]/30" : ""
                        }`}
                      >
                        {/* Status Badge */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              isDefect
                                ? "bg-[#FEE2E2] text-[#991B1B]"
                                : "bg-[#DCFCE7] text-[#166534]"
                            }`}
                          >
                            {isDefect ? (
                              <AlertTriangle className="w-3 h-3 text-[#DC2626]" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-[#16A34A]" />
                            )}
                            <span className="capitalize">{rec.classified_defect || "Nominal"}</span>
                          </span>
                        </td>

                        {/* Timestamp */}
                        <td className="py-2.5 px-3 text-[#57534E] whitespace-nowrap">
                          {rec.timestamp ? new Date(rec.timestamp).toLocaleString("en-GB", { hour12: false }) : "-"}
                        </td>

                        {/* Batch ID */}
                        <td className="py-2.5 px-3 font-bold text-[#1C1917] whitespace-nowrap">
                          {rec.batch_id || "-"}
                        </td>

                        {/* Machine */}
                        <td className="py-2.5 px-3 text-[#78716A] whitespace-nowrap">
                          {rec.machine_id || "CELL-01"}
                        </td>

                        {/* Mold Temp */}
                        <td
                          className={`py-2.5 px-3 text-right ${
                            culprit === "mold_temp"
                              ? "bg-[#FEE2E2] text-[#991B1B] font-bold"
                              : readings.mold_temp && (readings.mold_temp < BASELINES.mold_temp.min || readings.mold_temp > BASELINES.mold_temp.max)
                              ? "text-[#DC2626] font-semibold"
                              : "text-[#1C1917]"
                          }`}
                        >
                          {readings.mold_temp !== undefined ? readings.mold_temp.toFixed(1) : "-"}
                        </td>

                        {/* Injection Pressure */}
                        <td
                          className={`py-2.5 px-3 text-right ${
                            culprit === "injection_pressure"
                              ? "bg-[#FEE2E2] text-[#991B1B] font-bold"
                              : readings.injection_pressure && (readings.injection_pressure < BASELINES.injection_pressure.min || readings.injection_pressure > BASELINES.injection_pressure.max)
                              ? "text-[#DC2626] font-semibold"
                              : "text-[#1C1917]"
                          }`}
                        >
                          {readings.injection_pressure !== undefined ? readings.injection_pressure.toFixed(1) : "-"}
                        </td>

                        {/* Cooling Rate */}
                        <td
                          className={`py-2.5 px-3 text-right ${
                            culprit === "cooling_rate"
                              ? "bg-[#FEE2E2] text-[#991B1B] font-bold"
                              : readings.cooling_rate && (readings.cooling_rate < BASELINES.cooling_rate.min || readings.cooling_rate > BASELINES.cooling_rate.max)
                              ? "text-[#DC2626] font-semibold"
                              : "text-[#1C1917]"
                          }`}
                        >
                          {readings.cooling_rate !== undefined ? readings.cooling_rate.toFixed(1) : "-"}
                        </td>

                        {/* Vibration */}
                        <td
                          className={`py-2.5 px-3 text-right ${
                            culprit === "vibration"
                              ? "bg-[#FEE2E2] text-[#991B1B] font-bold"
                              : readings.vibration && (readings.vibration < BASELINES.vibration.min || readings.vibration > BASELINES.vibration.max)
                              ? "text-[#DC2626] font-semibold"
                              : "text-[#1C1917]"
                          }`}
                        >
                          {readings.vibration !== undefined ? readings.vibration.toFixed(2) : "-"}
                        </td>

                        {/* Machine Speed */}
                        <td
                          className={`py-2.5 px-3 text-right ${
                            culprit === "machine_speed"
                              ? "bg-[#FEE2E2] text-[#991B1B] font-bold"
                              : readings.machine_speed && (readings.machine_speed < BASELINES.machine_speed.min || readings.machine_speed > BASELINES.machine_speed.max)
                              ? "text-[#DC2626] font-semibold"
                              : "text-[#1C1917]"
                          }`}
                        >
                          {readings.machine_speed !== undefined ? Math.round(readings.machine_speed) : "-"}
                        </td>

                        {/* Humidity */}
                        <td
                          className={`py-2.5 px-3 text-right ${
                            culprit === "humidity"
                              ? "bg-[#FEE2E2] text-[#991B1B] font-bold"
                              : readings.humidity && (readings.humidity < BASELINES.humidity.min || readings.humidity > BASELINES.humidity.max)
                              ? "text-[#DC2626] font-semibold"
                              : "text-[#1C1917]"
                          }`}
                        >
                          {readings.humidity !== undefined ? readings.humidity.toFixed(1) : "-"}
                        </td>

                        {/* Culprit Sensor & Deviation */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {culprit ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[#991B1B] font-bold">
                              <span>{BASELINES[culprit]?.label || culprit}</span>
                              {rec.root_cause?.z_score_deviation && (
                                <span className="opacity-75">
                                  (+{rec.root_cause.z_score_deviation.toFixed(1)}σ)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#166534]">Nominal</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3 bg-[#FAF8F5] border-t border-[#E5DFD3] flex items-center justify-between text-xs text-[#78716A]">
            <div className="font-mono text-[11px]">
              Showing {Math.min(filteredRecords.length, (page - 1) * pageSize + 1)}–
              {Math.min(filteredRecords.length, page * pageSize)} of {filteredRecords.length} records
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded border border-[#DDD5C7] bg-white hover:bg-[#F3EFE6] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px] px-2 font-medium text-[#1C1917]">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded border border-[#DDD5C7] bg-white hover:bg-[#F3EFE6] disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
