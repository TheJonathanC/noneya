export type DefectClassification =
  | "Nominal"
  | "Porosity"
  | "Crack"
  | "Dent"
  | "Scratch"
  | "Corrosion"
  | "Deformation";

export type SeverityRating = "Nominal" | "Minor" | "Moderate" | "Critical";

export type InspectionStatus = "PASSED" | "DEFECTIVE";

export interface SensorTelemetry {
  id: string;
  name: string;
  unit: string;
  recordedValue: number;
  nominalMin: number;
  nominalMax: number;
  nominalTarget: number;
  delta: number;
  isOutOfTolerance: boolean;
  status: "nominal" | "warning" | "critical";
}

export interface AnomalyCoordinate {
  xPercent: number; // 0 - 100
  yPercent: number; // 0 - 100
  radiusPercent: number;
  confidence: number;
  intensity: "High" | "Severe" | "Trace" | "None";
}

export interface InspectionMetadata {
  stationId: string;
  lotCode: string;
  shift: string;
  operatorId: string;
  cycleDurationMs: number;
  componentType: string;
}

export interface InspectionItem {
  id: string;
  partId: string;
  serialNumber: string;
  timestamp: string;
  status: InspectionStatus;
  defectType: DefectClassification;
  confidenceScore: number; // 0 - 100
  severity: SeverityRating;
  rawImageUrl: string;
  heatmapImageUrl: string;
  anomalyCoordinate: AnomalyCoordinate;
  telemetry: SensorTelemetry[];
  rootCauseSummary: string;
  recommendedAction: string;
  metadata: InspectionMetadata;
}

export interface StationStats {
  stationId: string;
  lotCode: string;
  shift: string;
  targetTolerance: string;
  totalInspected: number;
  passedCount: number;
  defectiveCount: number;
  yieldPercentage: number;
}

// Generates procedural SVG data-URIs for photorealistic industrial parts
function generateIndustrialSvg(type: "raw" | "gradcam", defect: DefectClassification, seed = 1): string {
  const isDefect = defect !== "Nominal";
  const defectX = 48 + ((seed * 17) % 24);
  const defectY = 42 + ((seed * 23) % 28);

  if (type === "raw") {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <radialGradient id="metal" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="%233A404E"/>
          <stop offset="45%" stop-color="%23232733"/>
          <stop offset="85%" stop-color="%23141720"/>
          <stop offset="100%" stop-color="%230C0E14"/>
        </radialGradient>
        <linearGradient id="groove" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="%23565F74" stop-opacity="0.8"/>
          <stop offset="50%" stop-color="%231E222D" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="%23485062" stop-opacity="0.7"/>
        </linearGradient>
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="noise"/>
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.15 0"/>
          <feComposite in2="SourceGraphic" in="gl" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
        </filter>
      </defs>
      <rect width="800" height="600" fill="%230B0D12"/>
      <!-- Grid reticle calibration backdrop -->
      <g stroke="%231E2330" stroke-width="0.8" opacity="0.6">
        <line x1="50" y1="0" x2="50" y2="600"/>
        <line x1="150" y1="0" x2="150" y2="600"/>
        <line x1="250" y1="0" x2="250" y2="600"/>
        <line x1="350" y1="0" x2="350" y2="600"/>
        <line x1="450" y1="0" x2="450" y2="600"/>
        <line x1="550" y1="0" x2="550" y2="600"/>
        <line x1="650" y1="0" x2="650" y2="600"/>
        <line x1="750" y1="0" x2="750" y2="600"/>
        <line x1="0" y1="100" x2="800" y2="100"/>
        <line x1="0" y1="200" x2="800" y2="200"/>
        <line x1="0" y1="300" x2="800" y2="300"/>
        <line x1="0" y1="400" x2="800" y2="400"/>
        <line x1="0" y1="500" x2="800" y2="500"/>
      </g>
      <!-- Circular Machined Cast Impeller Body -->
      <circle cx="400" cy="300" r="230" fill="url(%23metal)" stroke="%234A5468" stroke-width="2.5"/>
      <circle cx="400" cy="300" r="195" fill="none" stroke="%232D3444" stroke-width="1.5" stroke-dasharray="4,6"/>
      <circle cx="400" cy="300" r="145" fill="%23171A24" stroke="%23384256" stroke-width="3"/>
      <!-- Machined Impeller Vanes -->
      <g stroke="url(%23groove)" stroke-width="4.5" stroke-linecap="round">
        <path d="M 400 160 Q 450 200 400 300"/>
        <path d="M 540 300 Q 500 350 400 300"/>
        <path d="M 400 440 Q 350 400 400 300"/>
        <path d="M 260 300 Q 300 250 400 300"/>
        <path d="M 499 201 Q 480 270 400 300"/>
        <path d="M 499 399 Q 430 380 400 300"/>
        <path d="M 301 399 Q 320 330 400 300"/>
        <path d="M 301 201 Q 370 220 400 300"/>
      </g>
      <!-- Central Hub Bore with Keyway -->
      <circle cx="400" cy="300" r="55" fill="%230C0E14" stroke="%235A667D" stroke-width="2.5"/>
      <rect x="393" y="240" width="14" height="20" fill="%230C0E14" stroke="%235A667D" stroke-width="1"/>
      <circle cx="400" cy="300" r="32" fill="%2308090D"/>
      <!-- Bolt Apertures -->
      <circle cx="340" cy="240" r="11" fill="%230E1017" stroke="%233C475B" stroke-width="2"/>
      <circle cx="460" cy="240" r="11" fill="%230E1017" stroke="%233C475B" stroke-width="2"/>
      <circle cx="340" cy="360" r="11" fill="%230E1017" stroke="%233C475B" stroke-width="2"/>
      <circle cx="460" cy="360" r="11" fill="%230E1017" stroke="%233C475B" stroke-width="2"/>
      ${
        isDefect
          ? defect === "Crack"
            ? `<path d="M ${defectX * 8} ${defectY * 6} Q ${defectX * 8 + 18} ${defectY * 6 + 12} ${defectX * 8 + 36} ${defectY * 6 + 28} Q ${defectX * 8 + 48} ${defectY * 6 + 42} ${defectX * 8 + 58} ${defectY * 6 + 55}" stroke="%2311141A" stroke-width="3" fill="none" stroke-linecap="round"/>
               <path d="M ${defectX * 8 + 18} ${defectY * 6 + 12} l 8 16" stroke="%2311141A" stroke-width="2"/>`
            : defect === "Porosity"
            ? `<circle cx="${defectX * 8}" cy="${defectY * 6}" r="6" fill="%23131720" stroke="%23262D3D" stroke-width="1"/>
               <circle cx="${defectX * 8 + 9}" cy="${defectY * 6 - 5}" r="4" fill="%23131720" stroke="%23262D3D" stroke-width="1"/>
               <circle cx="${defectX * 8 - 8}" cy="${defectY * 6 + 7}" r="5.5" fill="%23131720" stroke="%23262D3D" stroke-width="1"/>
               <circle cx="${defectX * 8 + 14}" cy="${defectY * 6 + 10}" r="3" fill="%23131720"/>`
            : `<circle cx="${defectX * 8}" cy="${defectY * 6}" r="16" fill="%2312151D" stroke="%23272D3D" stroke-width="2"/>`
          : ""
      }
      <!-- Technical HUD Stamp -->
      <text x="25" y="45" fill="%234B5568" font-family="monospace" font-size="12">CAM-FEED // MAG: 4.8X // RES: 4096x3072 // CAL: 0.012mm/px</text>
    </svg>`;
  }

  // Grad-CAM Thermal Visualization Overlay
  const cx = defectX * 8;
  const cy = defectY * 6;
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <defs>
      <radialGradient id="thermalHotspot" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="%23FF003C" stop-opacity="0.95"/>
        <stop offset="25%" stop-color="%23FF5E00" stop-opacity="0.85"/>
        <stop offset="50%" stop-color="%23FFD000" stop-opacity="0.75"/>
        <stop offset="72%" stop-color="%2300E5FF" stop-opacity="0.5"/>
        <stop offset="88%" stop-color="%230044FF" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="%23000000" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="nominalGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="%2300FF9D" stop-opacity="0.35"/>
        <stop offset="60%" stop-color="%2300B4D8" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="%23000000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="800" height="600" fill="%230B0D12"/>
    ${
      isDefect
        ? `<!-- Thermal anomaly hotspot -->
           <circle cx="${cx}" cy="${cy}" r="170" fill="url(%23thermalHotspot)"/>
           <circle cx="${cx + 10}" cy="${cy + 5}" r="95" fill="url(%23thermalHotspot)"/>
           <!-- Calibrated Reticle Crosshairs -->
           <line x1="${cx - 40}" y1="${cy}" x2="${cx + 40}" y2="${cy}" stroke="%23FFFFFF" stroke-width="1.8" stroke-dasharray="3,3"/>
           <line x1="${cx}" y1="${cy - 40}" x2="${cx}" y2="${cy + 40}" stroke="%23FFFFFF" stroke-width="1.8" stroke-dasharray="3,3"/>
           <circle cx="${cx}" cy="${cy}" r="28" fill="none" stroke="%23FFFFFF" stroke-width="1.5"/>
           <circle cx="${cx}" cy="${cy}" r="3" fill="%23FF003C"/>
           <!-- HUD Coordinate Data Box -->
           <rect x="${Math.min(cx + 36, 610)}" y="${Math.max(cy - 60, 40)}" width="155" height="52" rx="4" fill="%230F131D" fill-opacity="0.92" stroke="%23FF003C" stroke-width="1.2"/>
           <text x="${Math.min(cx + 46, 620)}" y="${Math.max(cy - 42, 58)}" fill="%23FF4060" font-family="monospace" font-size="11" font-weight="bold">ANOMALY: ${defect.toUpperCase()}</text>
           <text x="${Math.min(cx + 46, 620)}" y="${Math.max(cy - 28, 72)}" fill="%2394A3B8" font-family="monospace" font-size="10">X:${cx.toFixed(0)} Y:${cy.toFixed(0)} INT:97.8%</text>
           <text x="${Math.min(cx + 46, 620)}" y="${Math.max(cy - 14, 86)}" fill="%23CBD5E1" font-family="monospace" font-size="9">DEV: +4.2σ CRITICAL</text>`
        : `<!-- Nominal thermal signature -->
           <circle cx="400" cy="300" r="230" fill="url(%23nominalGlow)"/>
           <circle cx="400" cy="300" r="40" fill="none" stroke="%2300FF9D" stroke-width="1" stroke-dasharray="4,4"/>
           <rect x="330" y="275" width="140" height="34" rx="4" fill="%230D1518" fill-opacity="0.9" stroke="%2300FF9D" stroke-width="1"/>
           <text x="345" y="296" fill="%2300FF9D" font-family="monospace" font-size="11" font-weight="bold">NOMINAL PASS</text>`
    }
  </svg>`;
}

// Pre-calibrated mock batch representing a live industrial casting run
export const MOCK_INSPECTION_ITEMS: InspectionItem[] = [
  {
    id: "QC-2026-0491",
    partId: "P-IMP-9810",
    serialNumber: "SN-9810-A1",
    timestamp: "12:14:02.812",
    status: "DEFECTIVE",
    defectType: "Porosity",
    confidenceScore: 94.6,
    severity: "Critical",
    rawImageUrl: generateIndustrialSvg("raw", "Porosity", 1),
    heatmapImageUrl: generateIndustrialSvg("gradcam", "Porosity", 1),
    anomalyCoordinate: { xPercent: 52, yPercent: 46, radiusPercent: 14, confidence: 94.6, intensity: "Severe" },
    telemetry: [
      { id: "T-01", name: "Mold Core Temperature", unit: "°C", recordedValue: 742.8, nominalMin: 680.0, nominalMax: 710.0, nominalTarget: 695.0, delta: 32.8, isOutOfTolerance: true, status: "critical" },
      { id: "T-02", name: "Die Injection Pressure", unit: "bar", recordedValue: 148.2, nominalMin: 155.0, nominalMax: 170.0, nominalTarget: 162.5, delta: -6.8, isOutOfTolerance: true, status: "warning" },
      { id: "T-03", name: "Coolant Flow Rate", unit: "L/min", recordedValue: 18.4, nominalMin: 22.0, nominalMax: 26.0, nominalTarget: 24.0, delta: -3.6, isOutOfTolerance: true, status: "warning" },
      { id: "T-04", name: "Casting Cycle Vibration", unit: "mm/s", recordedValue: 1.18, nominalMin: 0.20, nominalMax: 1.50, nominalTarget: 0.85, delta: 0.33, isOutOfTolerance: false, status: "nominal" },
    ],
    rootCauseSummary: "Micro-cavity air entrapment caused by abnormal mold core overheating combined with a 15% drop in primary coolant line flow.",
    recommendedAction: "Halt line injection sequence. Purge coolant manifold B-3 and recalibrate core thermistor before resuming casting cycle.",
    metadata: {
      stationId: "Station 04 - Casting Cell B",
      lotCode: "LOT-2026-X89",
      shift: "Shift A - Day (06:00 - 14:00)",
      operatorId: "OP-482 [Correa, J.]",
      cycleDurationMs: 412,
      componentType: "Aviation Grade Alloy Impeller",
    },
  },
  {
    id: "QC-2026-0492",
    partId: "P-IMP-9811",
    serialNumber: "SN-9811-A2",
    timestamp: "12:14:28.140",
    status: "PASSED",
    defectType: "Nominal",
    confidenceScore: 99.4,
    severity: "Nominal",
    rawImageUrl: generateIndustrialSvg("raw", "Nominal", 2),
    heatmapImageUrl: generateIndustrialSvg("gradcam", "Nominal", 2),
    anomalyCoordinate: { xPercent: 50, yPercent: 50, radiusPercent: 0, confidence: 99.4, intensity: "None" },
    telemetry: [
      { id: "T-01", name: "Mold Core Temperature", unit: "°C", recordedValue: 694.1, nominalMin: 680.0, nominalMax: 710.0, nominalTarget: 695.0, delta: -0.9, isOutOfTolerance: false, status: "nominal" },
      { id: "T-02", name: "Die Injection Pressure", unit: "bar", recordedValue: 163.7, nominalMin: 155.0, nominalMax: 170.0, nominalTarget: 162.5, delta: 1.2, isOutOfTolerance: false, status: "nominal" },
      { id: "T-03", name: "Coolant Flow Rate", unit: "L/min", recordedValue: 24.3, nominalMin: 22.0, nominalMax: 26.0, nominalTarget: 24.0, delta: 0.3, isOutOfTolerance: false, status: "nominal" },
      { id: "T-04", name: "Casting Cycle Vibration", unit: "mm/s", recordedValue: 0.74, nominalMin: 0.20, nominalMax: 1.50, nominalTarget: 0.85, delta: -0.11, isOutOfTolerance: false, status: "nominal" },
    ],
    rootCauseSummary: "All structural, surface roughness, and dimensional tolerances within Six Sigma limits.",
    recommendedAction: "Release component to automated deburring and ultrasonic wash station.",
    metadata: {
      stationId: "Station 04 - Casting Cell B",
      lotCode: "LOT-2026-X89",
      shift: "Shift A - Day (06:00 - 14:00)",
      operatorId: "OP-482 [Correa, J.]",
      cycleDurationMs: 388,
      componentType: "Aviation Grade Alloy Impeller",
    },
  },
  {
    id: "QC-2026-0493",
    partId: "P-IMP-9812",
    serialNumber: "SN-9812-A3",
    timestamp: "12:14:55.620",
    status: "DEFECTIVE",
    defectType: "Crack",
    confidenceScore: 97.8,
    severity: "Critical",
    rawImageUrl: generateIndustrialSvg("raw", "Crack", 3),
    heatmapImageUrl: generateIndustrialSvg("gradcam", "Crack", 3),
    anomalyCoordinate: { xPercent: 62, yPercent: 44, radiusPercent: 18, confidence: 97.8, intensity: "Severe" },
    telemetry: [
      { id: "T-01", name: "Mold Core Temperature", unit: "°C", recordedValue: 702.4, nominalMin: 680.0, nominalMax: 710.0, nominalTarget: 695.0, delta: 7.4, isOutOfTolerance: false, status: "nominal" },
      { id: "T-02", name: "Die Injection Pressure", unit: "bar", recordedValue: 188.9, nominalMin: 155.0, nominalMax: 170.0, nominalTarget: 162.5, delta: 18.9, isOutOfTolerance: true, status: "critical" },
      { id: "T-03", name: "Coolant Flow Rate", unit: "L/min", recordedValue: 23.8, nominalMin: 22.0, nominalMax: 26.0, nominalTarget: 24.0, delta: -0.2, isOutOfTolerance: false, status: "nominal" },
      { id: "T-04", name: "Casting Cycle Vibration", unit: "mm/s", recordedValue: 2.34, nominalMin: 0.20, nominalMax: 1.50, nominalTarget: 0.85, delta: 0.84, isOutOfTolerance: true, status: "critical" },
    ],
    rootCauseSummary: "Radial thermal shock fracture detected along trailing edge vane #3 caused by injection pressure hydraulic spike (+18.9 bar).",
    recommendedAction: "Quarantine serial batch. Inspect hydraulic proportional relief valve for particulate binding.",
    metadata: {
      stationId: "Station 04 - Casting Cell B",
      lotCode: "LOT-2026-X89",
      shift: "Shift A - Day (06:00 - 14:00)",
      operatorId: "OP-482 [Correa, J.]",
      cycleDurationMs: 440,
      componentType: "Aviation Grade Alloy Impeller",
    },
  },
  {
    id: "QC-2026-0494",
    partId: "P-IMP-9813",
    serialNumber: "SN-9813-A4",
    timestamp: "12:15:20.301",
    status: "PASSED",
    defectType: "Nominal",
    confidenceScore: 98.9,
    severity: "Nominal",
    rawImageUrl: generateIndustrialSvg("raw", "Nominal", 4),
    heatmapImageUrl: generateIndustrialSvg("gradcam", "Nominal", 4),
    anomalyCoordinate: { xPercent: 50, yPercent: 50, radiusPercent: 0, confidence: 98.9, intensity: "None" },
    telemetry: [
      { id: "T-01", name: "Mold Core Temperature", unit: "°C", recordedValue: 696.5, nominalMin: 680.0, nominalMax: 710.0, nominalTarget: 695.0, delta: 1.5, isOutOfTolerance: false, status: "nominal" },
      { id: "T-02", name: "Die Injection Pressure", unit: "bar", recordedValue: 161.8, nominalMin: 155.0, nominalMax: 170.0, nominalTarget: 162.5, delta: -0.7, isOutOfTolerance: false, status: "nominal" },
      { id: "T-03", name: "Coolant Flow Rate", unit: "L/min", recordedValue: 24.1, nominalMin: 22.0, nominalMax: 26.0, nominalTarget: 24.0, delta: 0.1, isOutOfTolerance: false, status: "nominal" },
      { id: "T-04", name: "Casting Cycle Vibration", unit: "mm/s", recordedValue: 0.81, nominalMin: 0.20, nominalMax: 1.50, nominalTarget: 0.85, delta: -0.04, isOutOfTolerance: false, status: "nominal" },
    ],
    rootCauseSummary: "Nominal grain boundary formation and density distribution verified by vision optics.",
    recommendedAction: "Component accepted. Clear for downstream inspection buffer.",
    metadata: {
      stationId: "Station 04 - Casting Cell B",
      lotCode: "LOT-2026-X89",
      shift: "Shift A - Day (06:00 - 14:00)",
      operatorId: "OP-482 [Correa, J.]",
      cycleDurationMs: 395,
      componentType: "Aviation Grade Alloy Impeller",
    },
  },
  {
    id: "QC-2026-0495",
    partId: "P-IMP-9814",
    serialNumber: "SN-9814-A5",
    timestamp: "12:15:47.904",
    status: "PASSED",
    defectType: "Nominal",
    confidenceScore: 98.2,
    severity: "Nominal",
    rawImageUrl: generateIndustrialSvg("raw", "Nominal", 5),
    heatmapImageUrl: generateIndustrialSvg("gradcam", "Nominal", 5),
    anomalyCoordinate: { xPercent: 50, yPercent: 50, radiusPercent: 0, confidence: 98.2, intensity: "None" },
    telemetry: [
      { id: "T-01", name: "Mold Core Temperature", unit: "°C", recordedValue: 692.3, nominalMin: 680.0, nominalMax: 710.0, nominalTarget: 695.0, delta: -2.7, isOutOfTolerance: false, status: "nominal" },
      { id: "T-02", name: "Die Injection Pressure", unit: "bar", recordedValue: 164.2, nominalMin: 155.0, nominalMax: 170.0, nominalTarget: 162.5, delta: 1.7, isOutOfTolerance: false, status: "nominal" },
      { id: "T-03", name: "Coolant Flow Rate", unit: "L/min", recordedValue: 24.6, nominalMin: 22.0, nominalMax: 26.0, nominalTarget: 24.0, delta: 0.6, isOutOfTolerance: false, status: "nominal" },
      { id: "T-04", name: "Casting Cycle Vibration", unit: "mm/s", recordedValue: 0.79, nominalMin: 0.20, nominalMax: 1.50, nominalTarget: 0.85, delta: -0.06, isOutOfTolerance: false, status: "nominal" },
    ],
    rootCauseSummary: "Geometric circularity and concentricity within 0.005mm tolerance.",
    recommendedAction: "Pass to bin A-4.",
    metadata: {
      stationId: "Station 04 - Casting Cell B",
      lotCode: "LOT-2026-X89",
      shift: "Shift A - Day (06:00 - 14:00)",
      operatorId: "OP-482 [Correa, J.]",
      cycleDurationMs: 402,
      componentType: "Aviation Grade Alloy Impeller",
    },
  },
  {
    id: "QC-2026-0496",
    partId: "P-IMP-9815",
    serialNumber: "SN-9815-A6",
    timestamp: "12:16:11.205",
    status: "DEFECTIVE",
    defectType: "Dent",
    confidenceScore: 92.4,
    severity: "Moderate",
    rawImageUrl: generateIndustrialSvg("raw", "Dent", 6),
    heatmapImageUrl: generateIndustrialSvg("gradcam", "Dent", 6),
    anomalyCoordinate: { xPercent: 58, yPercent: 48, radiusPercent: 12, confidence: 92.4, intensity: "High" },
    telemetry: [
      { id: "T-01", name: "Mold Core Temperature", unit: "°C", recordedValue: 698.0, nominalMin: 680.0, nominalMax: 710.0, nominalTarget: 695.0, delta: 3.0, isOutOfTolerance: false, status: "nominal" },
      { id: "T-02", name: "Die Injection Pressure", unit: "bar", recordedValue: 160.1, nominalMin: 155.0, nominalMax: 170.0, nominalTarget: 162.5, delta: -2.4, isOutOfTolerance: false, status: "nominal" },
      { id: "T-03", name: "Coolant Flow Rate", unit: "L/min", recordedValue: 24.0, nominalMin: 22.0, nominalMax: 26.0, nominalTarget: 24.0, delta: 0.0, isOutOfTolerance: false, status: "nominal" },
      { id: "T-04", name: "Casting Cycle Vibration", unit: "mm/s", recordedValue: 1.82, nominalMin: 0.20, nominalMax: 1.50, nominalTarget: 0.85, delta: 0.32, isOutOfTolerance: true, status: "warning" },
    ],
    rootCauseSummary: "Surface mechanical impact depression detected on exterior sealing flange. Correlates with extraction robot gripper jerk.",
    recommendedAction: "Route component to rework station for manual surface dial-indicator inspection.",
    metadata: {
      stationId: "Station 04 - Casting Cell B",
      lotCode: "LOT-2026-X89",
      shift: "Shift A - Day (06:00 - 14:00)",
      operatorId: "OP-482 [Correa, J.]",
      cycleDurationMs: 419,
      componentType: "Aviation Grade Alloy Impeller",
    },
  },
  {
    id: "QC-2026-0497",
    partId: "P-IMP-9816",
    serialNumber: "SN-9816-A7",
    timestamp: "12:16:35.819",
    status: "PASSED",
    defectType: "Nominal",
    confidenceScore: 99.1,
    severity: "Nominal",
    rawImageUrl: generateIndustrialSvg("raw", "Nominal", 7),
    heatmapImageUrl: generateIndustrialSvg("gradcam", "Nominal", 7),
    anomalyCoordinate: { xPercent: 50, yPercent: 50, radiusPercent: 0, confidence: 99.1, intensity: "None" },
    telemetry: [
      { id: "T-01", name: "Mold Core Temperature", unit: "°C", recordedValue: 694.9, nominalMin: 680.0, nominalMax: 710.0, nominalTarget: 695.0, delta: -0.1, isOutOfTolerance: false, status: "nominal" },
      { id: "T-02", name: "Die Injection Pressure", unit: "bar", recordedValue: 163.0, nominalMin: 155.0, nominalMax: 170.0, nominalTarget: 162.5, delta: 0.5, isOutOfTolerance: false, status: "nominal" },
      { id: "T-03", name: "Coolant Flow Rate", unit: "L/min", recordedValue: 24.2, nominalMin: 22.0, nominalMax: 26.0, nominalTarget: 24.0, delta: 0.2, isOutOfTolerance: false, status: "nominal" },
      { id: "T-04", name: "Casting Cycle Vibration", unit: "mm/s", recordedValue: 0.72, nominalMin: 0.20, nominalMax: 1.50, nominalTarget: 0.85, delta: -0.13, isOutOfTolerance: false, status: "nominal" },
    ],
    rootCauseSummary: "Clean optical scan. Bore concentricity verified.",
    recommendedAction: "Pass to packaging line.",
    metadata: {
      stationId: "Station 04 - Casting Cell B",
      lotCode: "LOT-2026-X89",
      shift: "Shift A - Day (06:00 - 14:00)",
      operatorId: "OP-482 [Correa, J.]",
      cycleDurationMs: 382,
      componentType: "Aviation Grade Alloy Impeller",
    },
  },
  {
    id: "QC-2026-0498",
    partId: "P-IMP-9817",
    serialNumber: "SN-9817-A8",
    timestamp: "12:17:02.112",
    status: "DEFECTIVE",
    defectType: "Scratch",
    confidenceScore: 91.0,
    severity: "Minor",
    rawImageUrl: generateIndustrialSvg("raw", "Scratch", 8),
    heatmapImageUrl: generateIndustrialSvg("gradcam", "Scratch", 8),
    anomalyCoordinate: { xPercent: 44, yPercent: 55, radiusPercent: 10, confidence: 91.0, intensity: "High" },
    telemetry: [
      { id: "T-01", name: "Mold Core Temperature", unit: "°C", recordedValue: 691.0, nominalMin: 680.0, nominalMax: 710.0, nominalTarget: 695.0, delta: -4.0, isOutOfTolerance: false, status: "nominal" },
      { id: "T-02", name: "Die Injection Pressure", unit: "bar", recordedValue: 162.0, nominalMin: 155.0, nominalMax: 170.0, nominalTarget: 162.5, delta: -0.5, isOutOfTolerance: false, status: "nominal" },
      { id: "T-03", name: "Coolant Flow Rate", unit: "L/min", recordedValue: 24.1, nominalMin: 22.0, nominalMax: 26.0, nominalTarget: 24.0, delta: 0.1, isOutOfTolerance: false, status: "nominal" },
      { id: "T-04", name: "Casting Cycle Vibration", unit: "mm/s", recordedValue: 0.88, nominalMin: 0.20, nominalMax: 1.50, nominalTarget: 0.85, delta: 0.03, isOutOfTolerance: false, status: "nominal" },
    ],
    rootCauseSummary: "Linear abrasion on hub lip (<0.08mm depth). Likely contact with conveyor belt rail burr.",
    recommendedAction: "Buff with fine grade scotch-brite or send to surface refinishing.",
    metadata: {
      stationId: "Station 04 - Casting Cell B",
      lotCode: "LOT-2026-X89",
      shift: "Shift A - Day (06:00 - 14:00)",
      operatorId: "OP-482 [Correa, J.]",
      cycleDurationMs: 405,
      componentType: "Aviation Grade Alloy Impeller",
    },
  },
  {
    id: "QC-2026-0499",
    partId: "P-IMP-9818",
    serialNumber: "SN-9818-A9",
    timestamp: "12:17:29.400",
    status: "PASSED",
    defectType: "Nominal",
    confidenceScore: 99.6,
    severity: "Nominal",
    rawImageUrl: generateIndustrialSvg("raw", "Nominal", 9),
    heatmapImageUrl: generateIndustrialSvg("gradcam", "Nominal", 9),
    anomalyCoordinate: { xPercent: 50, yPercent: 50, radiusPercent: 0, confidence: 99.6, intensity: "None" },
    telemetry: [
      { id: "T-01", name: "Mold Core Temperature", unit: "°C", recordedValue: 695.2, nominalMin: 680.0, nominalMax: 710.0, nominalTarget: 695.0, delta: 0.2, isOutOfTolerance: false, status: "nominal" },
      { id: "T-02", name: "Die Injection Pressure", unit: "bar", recordedValue: 162.7, nominalMin: 155.0, nominalMax: 170.0, nominalTarget: 162.5, delta: 0.2, isOutOfTolerance: false, status: "nominal" },
      { id: "T-03", name: "Coolant Flow Rate", unit: "L/min", recordedValue: 24.0, nominalMin: 22.0, nominalMax: 26.0, nominalTarget: 24.0, delta: 0.0, isOutOfTolerance: false, status: "nominal" },
      { id: "T-04", name: "Casting Cycle Vibration", unit: "mm/s", recordedValue: 0.76, nominalMin: 0.20, nominalMax: 1.50, nominalTarget: 0.85, delta: -0.09, isOutOfTolerance: false, status: "nominal" },
    ],
    rootCauseSummary: "Zero anomalies identified across all 8 visual sectors.",
    recommendedAction: "Pass to bin A-4.",
    metadata: {
      stationId: "Station 04 - Casting Cell B",
      lotCode: "LOT-2026-X89",
      shift: "Shift A - Day (06:00 - 14:00)",
      operatorId: "OP-482 [Correa, J.]",
      cycleDurationMs: 391,
      componentType: "Aviation Grade Alloy Impeller",
    },
  },
  {
    id: "QC-2026-0500",
    partId: "P-IMP-9819",
    serialNumber: "SN-9819-B0",
    timestamp: "12:17:54.671",
    status: "DEFECTIVE",
    defectType: "Deformation",
    confidenceScore: 93.9,
    severity: "Critical",
    rawImageUrl: generateIndustrialSvg("raw", "Deformation", 10),
    heatmapImageUrl: generateIndustrialSvg("gradcam", "Deformation", 10),
    anomalyCoordinate: { xPercent: 55, yPercent: 49, radiusPercent: 16, confidence: 93.9, intensity: "Severe" },
    telemetry: [
      { id: "T-01", name: "Mold Core Temperature", unit: "°C", recordedValue: 738.4, nominalMin: 680.0, nominalMax: 710.0, nominalTarget: 695.0, delta: 28.4, isOutOfTolerance: true, status: "critical" },
      { id: "T-02", name: "Die Injection Pressure", unit: "bar", recordedValue: 142.1, nominalMin: 155.0, nominalMax: 170.0, nominalTarget: 162.5, delta: -12.9, isOutOfTolerance: true, status: "critical" },
      { id: "T-03", name: "Coolant Flow Rate", unit: "L/min", recordedValue: 19.1, nominalMin: 22.0, nominalMax: 26.0, nominalTarget: 24.0, delta: -2.9, isOutOfTolerance: true, status: "warning" },
      { id: "T-04", name: "Casting Cycle Vibration", unit: "mm/s", recordedValue: 1.94, nominalMin: 0.20, nominalMax: 1.50, nominalTarget: 0.85, delta: 0.44, isOutOfTolerance: true, status: "warning" },
    ],
    rootCauseSummary: "Geometric warpage and wall thickness variance exceeding +/-0.25mm due to premature mold release while core was above solidus point.",
    recommendedAction: "Scrap part. Extend mold dwell time parameter from 14.2s to 16.5s in PLC profile.",
    metadata: {
      stationId: "Station 04 - Casting Cell B",
      lotCode: "LOT-2026-X89",
      shift: "Shift A - Day (06:00 - 14:00)",
      operatorId: "OP-482 [Correa, J.]",
      cycleDurationMs: 428,
      componentType: "Aviation Grade Alloy Impeller",
    },
  },
];

/**
 * Normalizes any backend response (legacy FastAPI, test classify endpoint, or custom payload)
 * into the strict domain `InspectionItem` model.
 */
export function normalizeInspectionResponse(
  raw: unknown,
  fallbackPartId = `P-IMP-${Math.floor(1000 + Math.random() * 9000)}`,
  customRawImageUrl?: string
): InspectionItem {
  const data = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>;

  // Check prediction key from backend
  const rawPrediction = typeof data.prediction === "string" ? data.prediction.toUpperCase().trim() : null;
  const isDefectiveByPrediction = rawPrediction === "DEFECTIVE";

  // Check defect_type key from backend
  const rawDefectType = typeof data.defect_type === "string" ? data.defect_type.toLowerCase() : "";
  let defectType: DefectClassification = "Nominal";

  if (rawDefectType.includes("porosity")) defectType = "Porosity";
  else if (rawDefectType.includes("crack")) defectType = "Crack";
  else if (rawDefectType.includes("dent")) defectType = "Dent";
  else if (rawDefectType.includes("scratch")) defectType = "Scratch";
  else if (rawDefectType.includes("corrosion")) defectType = "Corrosion";
  else if (rawDefectType.includes("deformation") || rawDefectType.includes("warp")) defectType = "Deformation";
  else if (isDefectiveByPrediction) defectType = "Porosity";

  const isDefective = isDefectiveByPrediction || defectType !== "Nominal";
  const status: InspectionStatus = isDefective ? "DEFECTIVE" : "PASSED";

  // Severity rating
  let severity: SeverityRating = "Nominal";
  if (typeof data.severity_rating === "string") {
    const s = data.severity_rating.toLowerCase();
    if (s.includes("crit")) severity = "Critical";
    else if (s.includes("mod")) severity = "Moderate";
    else if (s.includes("min")) severity = "Minor";
  } else if (isDefective) {
    severity = defectType === "Crack" || defectType === "Porosity" ? "Critical" : "Moderate";
  }

  // Confidence score
  let confidenceScore = 95.0;
  if (typeof data.confidence === "number") {
    confidenceScore = data.confidence > 1 ? data.confidence : data.confidence * 100;
  } else if (typeof data.confidence_score === "number") {
    confidenceScore = data.confidence_score > 1 ? data.confidence_score : data.confidence_score * 100;
  } else if (data.probabilities && typeof (data.probabilities as Record<string, unknown>).defect === "number") {
    const prob = (data.probabilities as Record<string, unknown>).defect as number;
    confidenceScore = Math.round((isDefective ? prob : 1 - prob) * 1000) / 10;
  } else if (data.root_cause_analysis && typeof (data.root_cause_analysis as Record<string, unknown>).confidence_score === "string") {
    const parsed = parseFloat(String((data.root_cause_analysis as Record<string, unknown>).confidence_score));
    if (!isNaN(parsed)) confidenceScore = parsed;
  }

  // Root cause analysis
  let rootCauseSummary = isDefective
    ? "Localized surface variance detected exceeding factory acceptance threshold."
    : "All structural and geometric tolerance metrics within nominal specification.";

  if (typeof data.gemini_incident_report === "string") {
    rootCauseSummary = data.gemini_incident_report;
  } else if (typeof data.root_cause_summary === "string") {
    rootCauseSummary = data.root_cause_summary;
  } else if (data.root_cause && typeof (data.root_cause as Record<string, unknown>).cause === "string") {
    rootCauseSummary = `Telemetry drift identified primary factor in: ${String((data.root_cause as Record<string, unknown>).cause)}`;
  } else if (data.root_cause_analysis && typeof (data.root_cause_analysis as Record<string, unknown>).probable_cause === "string") {
    rootCauseSummary = String((data.root_cause_analysis as Record<string, unknown>).probable_cause);
  } else if (typeof data.details === "string") {
    rootCauseSummary = data.details;
  }

  // Recommended action
  let recommendedAction = isDefective
    ? "Quarantine component and verify mold cooling circuit."
    : "Pass component to downstream staging area.";

  if (typeof data.recommended_action === "string") {
    recommendedAction = data.recommended_action;
  } else if (data.root_cause && typeof (data.root_cause as Record<string, unknown>).action === "string") {
    recommendedAction = String((data.root_cause as Record<string, unknown>).action);
  }

  // Anomaly coordinates (checking spatial hotspots from PatchCore-lite backend)
  let anomalyCoordinate: AnomalyCoordinate;
  if (Array.isArray(data.hotspots) && data.hotspots.length > 0) {
    const hs = data.hotspots[0] as Record<string, unknown>;
    const x = typeof hs.x === "number" ? hs.x * 100 : 54;
    const y = typeof hs.y === "number" ? hs.y * 100 : 46;
    anomalyCoordinate = {
      xPercent: Math.round(x),
      yPercent: Math.round(y),
      radiusPercent: 15,
      confidence: confidenceScore,
      intensity: severity === "Critical" ? "Severe" : "High",
    };
  } else {
    anomalyCoordinate = isDefective
      ? {
          xPercent: 54,
          yPercent: 46,
          radiusPercent: 15,
          confidence: confidenceScore,
          intensity: severity === "Critical" ? "Severe" : "High",
        }
      : {
          xPercent: 50,
          yPercent: 50,
          radiusPercent: 0,
          confidence: confidenceScore,
          intensity: "None",
        };
  }

  // Telemetry mapping
  const telemetry: SensorTelemetry[] = isDefective
    ? [
        { id: "T-01", name: "Mold Core Temperature", unit: "°C", recordedValue: 741.2, nominalMin: 680.0, nominalMax: 710.0, nominalTarget: 695.0, delta: 31.2, isOutOfTolerance: true, status: "critical" },
        { id: "T-02", name: "Die Injection Pressure", unit: "bar", recordedValue: 147.5, nominalMin: 155.0, nominalMax: 170.0, nominalTarget: 162.5, delta: -7.5, isOutOfTolerance: true, status: "warning" },
        { id: "T-03", name: "Coolant Flow Rate", unit: "L/min", recordedValue: 18.2, nominalMin: 22.0, nominalMax: 26.0, nominalTarget: 24.0, delta: -3.8, isOutOfTolerance: true, status: "warning" },
        { id: "T-04", name: "Casting Cycle Vibration", unit: "mm/s", recordedValue: 1.15, nominalMin: 0.20, nominalMax: 1.50, nominalTarget: 0.85, delta: 0.30, isOutOfTolerance: false, status: "nominal" },
      ]
    : [
        { id: "T-01", name: "Mold Core Temperature", unit: "°C", recordedValue: 694.5, nominalMin: 680.0, nominalMax: 710.0, nominalTarget: 695.0, delta: -0.5, isOutOfTolerance: false, status: "nominal" },
        { id: "T-02", name: "Die Injection Pressure", unit: "bar", recordedValue: 162.9, nominalMin: 155.0, nominalMax: 170.0, nominalTarget: 162.5, delta: 0.4, isOutOfTolerance: false, status: "nominal" },
        { id: "T-03", name: "Coolant Flow Rate", unit: "L/min", recordedValue: 24.1, nominalMin: 22.0, nominalMax: 26.0, nominalTarget: 24.0, delta: 0.1, isOutOfTolerance: false, status: "nominal" },
        { id: "T-04", name: "Casting Cycle Vibration", unit: "mm/s", recordedValue: 0.78, nominalMin: 0.20, nominalMax: 1.50, nominalTarget: 0.85, delta: -0.07, isOutOfTolerance: false, status: "nominal" },
      ];

  const now = new Date();
  const timeString = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(now.getMilliseconds()).padStart(3, "0")}`;

  const seed = Math.floor(Math.random() * 8) + 1;
  const rawImageUrl = customRawImageUrl || generateIndustrialSvg("raw", defectType, seed);
  const heatmapImageUrl = typeof data.localisation_heatmap_url === "string" && data.localisation_heatmap_url.startsWith("http")
    ? data.localisation_heatmap_url
    : generateIndustrialSvg("gradcam", defectType, seed);

  return {
    id: `QC-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    partId: fallbackPartId,
    serialNumber: `SN-${fallbackPartId.replace("P-", "")}-${status === "DEFECTIVE" ? "D1" : "P1"}`,
    timestamp: timeString,
    status,
    defectType,
    confidenceScore: Math.round(confidenceScore * 10) / 10,
    severity,
    rawImageUrl,
    heatmapImageUrl,
    anomalyCoordinate,
    telemetry,
    rootCauseSummary,
    recommendedAction,
    metadata: {
      stationId: "Station 04 - Casting Cell B",
      lotCode: "LOT-2026-X89",
      shift: "Shift A - Day (06:00 - 14:00)",
      operatorId: "OP-482 [Correa, J.]",
      cycleDurationMs: Math.floor(380 + Math.random() * 70),
      componentType: typeof data.component === "string" ? data.component : "Cast Alloy Impeller",
    },
  };
}

/**
 * Calculates current live station statistics for a given batch of inspection items.
 */
export function calculateStationStats(items: InspectionItem[]): StationStats {
  const total = items.length;
  const passed = items.filter((i) => i.status === "PASSED").length;
  const defective = total - passed;
  const yieldPct = total > 0 ? Math.round((passed / total) * 100) : 100;

  return {
    stationId: "Station 04 - Casting Cell B",
    lotCode: "LOT-2026-X89",
    shift: "Shift A (Day)",
    targetTolerance: "± 0.012 mm",
    totalInspected: total,
    passedCount: passed,
    defectiveCount: defective,
    yieldPercentage: yieldPct,
  };
}
