import { InspectionItem } from "@/lib/inspection-adapter";

interface BatchReportData {
  batchId: string;
  gateDecision: "GO" | "ADJUST" | "CRITICAL STOP";
  supervisorSummary: string | null;
  batchPrediction?: { text?: string; next_batch_risk?: number };
  batchFixes?: Array<{ sensor: string; label: string; instruction: string; current?: number; target?: number; unit?: string }>;
  batchStats: { total: number; passed: number; defective: number };
  items: InspectionItem[];
  rawJson?: Record<string, unknown> | null;
}

export function openPrintableBatchReport(data: BatchReportData) {
  const {
    batchId,
    gateDecision,
    supervisorSummary,
    batchPrediction,
    batchFixes = [],
    batchStats,
    items,
  } = data;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to generate and print the batch report PDF.");
    return;
  }

  const decisionColor =
    gateDecision === "GO" ? "#166534" : gateDecision === "ADJUST" ? "#B45309" : "#991B1B";
  const decisionBg =
    gateDecision === "GO" ? "#F0FDF4" : gateDecision === "ADJUST" ? "#FFFBEB" : "#FEF2F2";
  const decisionBorder =
    gateDecision === "GO" ? "#86EFAC" : gateDecision === "ADJUST" ? "#FDE68A" : "#FCA5A5";

  // Build items HTML
  const itemsHtml = items
    .map((item, idx) => {
      const isDefective = item.status === "DEFECTIVE";
      const origImg =
        item.visionResults?.original_image_base64 ||
        item.visionResults?.original_url ||
        item.rawImageUrl;
      const heatImg =
        item.visionResults?.heatmap_image_base64 ||
        item.visionResults?.heatmap_png_url ||
        item.heatmapImageUrl;

      const defectsList =
        item.predictedDefects && item.predictedDefects.length > 0
          ? item.predictedDefects.join(", ")
          : item.defectType || (isDefective ? "Defect" : "Nominal");

      return `
        <div style="page-break-inside: avoid; border: 1px solid #E5DFD3; border-radius: 12px; padding: 16px; margin-bottom: 20px; background: #FFFFFF;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #EAE4D7; padding-bottom: 10px; margin-bottom: 12px;">
            <div>
              <span style="font-size: 14px; font-weight: 700; color: #1C1917;">Part ${idx + 1} (${item.partId})</span>
              <span style="font-size: 11px; color: #78716A; margin-left: 8px;">SN: ${item.serialNumber}</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: ${isDefective ? "#FEF2F2" : "#F0FDF4"}; color: ${isDefective ? "#991B1B" : "#166534"}; border: 1px solid ${isDefective ? "#FCA5A5" : "#86EFAC"};">
                ${isDefective ? "DEFECTIVE" : "PASSED / NOMINAL"}
              </span>
              <span style="font-size: 11px; font-weight: 600; color: #57534E;">${Math.round(item.confidenceScore)}% Conf.</span>
            </div>
          </div>

          <!-- Image Pairs: Raw Photo + Heatmap Overlay -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
            <div>
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #78716A; margin-bottom: 4px;">Original Part Image</div>
              <div style="border: 1px solid #E5DFD3; border-radius: 8px; overflow: hidden; background: #1C1917; aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center;">
                ${origImg ? `<img src="${origImg}" style="width: 100%; height: 100%; object-fit: contain;" alt="Part ${idx + 1}" />` : `<span style="color: #A8A29E; font-size: 11px;">Image not available</span>`}
              </div>
            </div>
            <div>
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #78716A; margin-bottom: 4px;">Grad-CAM Heatmap & Inspection Overlay</div>
              <div style="border: 1px solid #E5DFD3; border-radius: 8px; overflow: hidden; background: #1C1917; aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center; position: relative;">
                ${origImg ? `<img src="${origImg}" style="width: 100%; height: 100%; object-fit: contain;" alt="Part ${idx + 1}" />` : ""}
                ${heatImg ? `<img src="${heatImg}" style="width: 100%; height: 100%; object-fit: contain; position: absolute; top:0; left:0; mix-blend-mode: screen; opacity: 0.85;" alt="Heatmap" />` : ""}
              </div>
            </div>
          </div>

          <!-- Part Details / Diagnosis -->
          <div style="background: #FAF8F5; border: 1px solid #EAE4D7; border-radius: 8px; padding: 10px 12px; font-size: 11px;">
            <div style="margin-bottom: 4px;"><strong>Inspection Result:</strong> <span style="color: ${isDefective ? "#991B1B" : "#166534"}; font-weight: 600;">${defectsList}</span></div>
            ${item.rootCauseSummary ? `<div style="color: #57534E;"><strong>Diagnostic Summary:</strong> ${item.rootCauseSummary}</div>` : ""}
          </div>
        </div>
      `;
    })
    .join("");

  // Build telemetry summary table
  const sampleTel = items[0]?.telemetry || [];
  const telemetryRows = sampleTel
    .map((sensor) => {
      const isWarn = sensor.isOutOfTolerance;
      return `
        <tr style="border-bottom: 1px solid #EAE4D7; font-size: 11px; ${isWarn ? "background: #FEF2F2;" : ""}">
          <td style="padding: 8px 10px; font-weight: 600; color: #1C1917;">${sensor.name}</td>
          <td style="padding: 8px 10px; text-align: center; color: #57534E;">${sensor.nominalTarget} ${sensor.unit}</td>
          <td style="padding: 8px 10px; text-align: center; color: #78716A;">${sensor.nominalMin} – ${sensor.nominalMax} ${sensor.unit}</td>
          <td style="padding: 8px 10px; text-align: center; font-weight: 700; color: ${isWarn ? "#991B1B" : "#1C1917"};">
            ${sensor.recordedValue} ${sensor.unit}
          </td>
          <td style="padding: 8px 10px; text-align: right; font-weight: 600; color: ${isWarn ? "#991B1B" : "#166534"};">
            ${isWarn ? "ANOMALOUS / DRIFT" : "NOMINAL"}
          </td>
        </tr>
      `;
    })
    .join("");

  // Fixes HTML
  const fixesHtml =
    batchFixes.length > 0
      ? `
      <div style="margin-top: 16px; padding: 14px; background: #FFFDF5; border: 1px solid #FDE68A; border-radius: 10px;">
        <div style="font-weight: 700; color: #92400E; font-size: 12px; margin-bottom: 8px;">Recommended Machine Setpoint Fixes (${batchFixes.length})</div>
        <ul style="margin: 0; padding-left: 18px; font-size: 11px; color: #57534E;">
          ${batchFixes.map((f) => `<li style="margin-bottom: 4px;"><strong>${f.label}:</strong> ${f.instruction} ${f.current !== undefined && f.target !== undefined ? `(${f.current} → ${f.target} ${f.unit || ""})` : ""}</li>`).join("")}
        </ul>
      </div>
    `
      : "";

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Batch Inspection Report - ${batchId}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1C1917;
            background: #FFFFFF;
            margin: 0;
            padding: 20px;
            font-size: 12px;
            line-height: 1.5;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; padding: 12px; background: #FAF8F5; border: 1px solid #E5DFD3; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600; color: #57534E;">Inspection Dossier Prepared for Printing / PDF Export</span>
          <button onclick="window.print()" style="padding: 8px 16px; background: #1C1917; color: #FFFFFF; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
            Print / Save as PDF
          </button>
        </div>

        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1C1917; padding-bottom: 14px; margin-bottom: 20px;">
          <div>
            <h1 style="font-size: 20px; font-weight: 800; margin: 0 0 4px 0; color: #1C1917;">Batch Inspection Quality Report</h1>
            <div style="font-size: 11px; color: #78716A;">Station 04 • Casting Cell B • Lot LOT-2026-X89</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 13px; font-weight: 700; color: #1C1917;">Batch ID: ${batchId}</div>
            <div style="font-size: 11px; color: #78716A;">Generated: ${new Date().toLocaleString()}</div>
          </div>
        </div>

        <!-- Executive Summary Banner -->
        <div style="background: ${decisionBg}; border: 1px solid ${decisionBorder}; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 14px; font-weight: 800; color: ${decisionColor};">
              Gatekeeper Verdict: ${gateDecision} (${gateDecision === "GO" ? "LINE CLEARED" : gateDecision === "ADJUST" ? "ACTION REQUIRED" : "CRITICAL HALT"})
            </div>
            <div style="font-size: 12px; font-weight: 700; color: #57534E;">
              Yield: ${batchStats.passed} / ${batchStats.total} Passed (${batchStats.defective} Defective)
            </div>
          </div>
          ${
            supervisorSummary
              ? `<div style="font-size: 12px; color: #44403C; margin-top: 6px; line-height: 1.6;"><strong>Supervisor Briefing:</strong> ${supervisorSummary}</div>`
              : ""
          }
          ${
            batchPrediction?.text
              ? `<div style="font-size: 11px; color: #78350F; margin-top: 8px; padding-top: 8px; border-top: 1px solid #EAE4D7;"><strong>Risk Analysis:</strong> ${batchPrediction.text} ${batchPrediction.next_batch_risk ? `(${Math.round(batchPrediction.next_batch_risk * 100)}% risk)` : ""}</div>`
              : ""
          }
        </div>

        <!-- Machine Fixes if present -->
        ${fixesHtml}

        <!-- Section: Individual Parts & Visuals -->
        <div style="margin-top: 28px; margin-bottom: 12px;">
          <h2 style="font-size: 14px; font-weight: 800; text-transform: uppercase; color: #1C1917; margin: 0 0 12px 0;">Inspected Components (${items.length} Parts)</h2>
        </div>
        ${itemsHtml}

        <!-- Section: Telemetry & SCADA Readings -->
        <div style="page-break-inside: avoid; margin-top: 28px; border-top: 1px solid #EAE4D7; padding-top: 16px;">
          <h2 style="font-size: 14px; font-weight: 800; text-transform: uppercase; color: #1C1917; margin: 0 0 12px 0;">Process Telemetry Baseline Audit</h2>
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: #FAF8F5; border-bottom: 2px solid #EAE4D7; font-size: 10px; text-transform: uppercase; color: #78716A;">
                <th style="padding: 8px 10px;">Sensor Parameter</th>
                <th style="padding: 8px 10px; text-align: center;">Target</th>
                <th style="padding: 8px 10px; text-align: center;">Tolerance Corridor</th>
                <th style="padding: 8px 10px; text-align: center;">Recorded Reading</th>
                <th style="padding: 8px 10px; text-align: right;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${telemetryRows}
            </tbody>
          </table>
        </div>

        <!-- Footer Sign-off -->
        <div style="page-break-inside: avoid; margin-top: 40px; padding-top: 16px; border-top: 1px solid #EAE4D7; display: flex; justify-content: space-between; font-size: 11px; color: #78716A;">
          <div>Certified Automated Quality Inspection Report • ISO 9001 Compliant</div>
          <div style="border-top: 1px solid #1C1917; width: 200px; text-align: center; padding-top: 4px;">Quality Supervisor Signature</div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
}
