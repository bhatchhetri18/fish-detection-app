/**
 * report.js — Detection Report Generator
 * ════════════════════════════════════════
 * Generates a styled, self-contained HTML report
 * from the last detection results, ready to download.
 */

// Holds the last detection payload for report generation
window._reportData = [];

/**
 * setReportData(results) — called by app.js after detection
 * @param {Array} results  Array of detection result objects
 */
window.setReportData = function (results) {
  window._reportData = results || [];
};

/**
 * generateReport() — builds and downloads an HTML report
 */
window.generateReport = function () {
  const data = window._reportData;
  if (!data || data.length === 0) {
    alert("No detection data available. Run a scan first.");
    return;
  }

  const now       = new Date();
  const timestamp = now.toLocaleString();
  const total     = data.length;
  const fishCount = data.filter(d => d.status === "fish_detected").length;
  const unknCount = data.filter(d => d.status === "unknown_fish").length;
  const noneCount = data.filter(d => d.status === "no_detection").length;

  // ── Build individual detection rows ──────────────────────────
  const rows = data.map((d, i) => {
    const statusLabel = {
      fish_detected: "✅ Fish Detected",
      unknown_fish:  "❓ Unknown Species",
      non_marine:    "🚫 Non-Marine Object",
      no_detection:  "🔍 No Detection",
    }[d.status] || d.status;

    const statusColor = {
      fish_detected: "#00ffc8",
      unknown_fish:  "#ffb830",
      non_marine:    "#ff4d6a",
      no_detection:  "#557799",
    }[d.status] || "#557799";

    const detRows = (d.detections || [])
      .filter(det => det.is_fish)
      .map(det => `
        <tr>
          <td style="padding:6px 10px;color:#a0c8e0;">${det.label}</td>
          <td style="padding:6px 10px;font-family:monospace;color:#00d4ff;">${(det.confidence * 100).toFixed(1)}%</td>
          <td style="padding:6px 10px;font-size:0.75rem;color:#5e9ab8;font-family:monospace;">
            [${det.bbox.join(", ")}]
          </td>
        </tr>`).join("");

    const detTable = detRows
      ? `<table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <thead>
            <tr style="border-bottom:1px solid #183050;">
              <th style="padding:6px 10px;text-align:left;color:#5e9ab8;font-size:0.7rem;letter-spacing:0.1em;">SPECIES</th>
              <th style="padding:6px 10px;text-align:left;color:#5e9ab8;font-size:0.7rem;letter-spacing:0.1em;">CONFIDENCE</th>
              <th style="padding:6px 10px;text-align:left;color:#5e9ab8;font-size:0.7rem;letter-spacing:0.1em;">BOUNDING BOX</th>
            </tr>
          </thead>
          <tbody>${detRows}</tbody>
        </table>`
      : "";

    return `
      <div style="margin-bottom:20px;padding:18px;background:rgba(0,20,44,0.8);
                  border:1px solid #183050;border-radius:12px;
                  border-left:3px solid ${statusColor};">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
          <span style="font-size:0.78rem;color:#5e9ab8;font-family:monospace;">#${i + 1} · ${d.filename || "image"}</span>
          <span style="padding:3px 12px;border-radius:50px;font-size:0.65rem;font-family:'Orbitron',monospace;
                       background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}66;">
            ${statusLabel}
          </span>
        </div>
        <p style="font-size:0.9rem;color:#d8edf8;margin:0 0 6px;">${d.message}</p>
        <p style="font-size:0.7rem;color:#5e9ab8;margin:0;">${d.timestamp ? new Date(d.timestamp).toLocaleString() : "—"}</p>
        ${detTable}
      </div>`;
  }).join("");

  // ── Assemble full HTML report ─────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AquaDetect Detection Report — ${timestamp}</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Space+Grotesk:wght@300;400;600&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Space Grotesk', sans-serif; background: #000c1a; color: #d8edf8; min-height: 100vh; }
    .page { max-width: 860px; margin: 0 auto; padding: 40px 24px; }
    .header { display: flex; align-items: center; gap: 18px; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 1px solid #0d3050; }
    .logo-svg { width: 44px; color: #00d4ff; filter: drop-shadow(0 0 10px #00d4ff88); }
    .header-text h1 { font-family: 'Orbitron', monospace; font-size: 1.4rem; font-weight: 900; color: #d8edf8; }
    .header-text p  { font-size: 0.75rem; color: #5e9ab8; margin-top: 4px; letter-spacing: 0.06em; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
    .stat-box { padding: 16px; background: rgba(0,18,40,0.8); border: 1px solid #0d3050; border-radius: 12px; text-align: center; }
    .stat-box .num  { font-family: 'Orbitron', monospace; font-size: 2rem; font-weight: 900; color: #00d4ff; }
    .stat-box .lbl  { font-size: 0.68rem; color: #5e9ab8; letter-spacing: 0.08em; margin-top: 4px; }
    .section-title  { font-family: 'Orbitron', monospace; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.16em; color: #00d4ff; margin-bottom: 16px; padding: 0 4px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #0d3050; text-align: center; font-size: 0.72rem; color: #28506a; }
    @media (max-width: 600px) { .stats-grid { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <svg class="logo-svg" viewBox="0 0 44 44" fill="none">
        <path d="M4 22C10 10 22 5 40 22C22 34 10 36 4 22Z" fill="currentColor" opacity="0.9"/>
        <path d="M40 14L46 22L40 30" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.6"/>
        <circle cx="33" cy="18" r="3" fill="white" opacity="0.9"/>
      </svg>
      <div class="header-text">
        <h1>AQUA<span style="color:#00d4ff;">DETECT</span> — Detection Report</h1>
        <p>Generated: ${timestamp} · Marine AI Detection System v2.0</p>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-box"><div class="num">${total}</div><div class="lbl">Total Scanned</div></div>
      <div class="stat-box"><div class="num" style="color:#00ffc8">${fishCount}</div><div class="lbl">Fish Detected</div></div>
      <div class="stat-box"><div class="num" style="color:#ffb830">${unknCount}</div><div class="lbl">Unknown Species</div></div>
      <div class="stat-box"><div class="num" style="color:#557799">${noneCount}</div><div class="lbl">No Detection</div></div>
    </div>

    <!-- Detection Results -->
    <div class="section-title">DETECTION RESULTS</div>
    ${rows}

    <!-- Footer -->
    <div class="footer">
      AquaDetect Marine AI Detection System · Powered by YOLOv8 Ultralytics
    </div>
  </div>
</body>
</html>`;

  // ── Download ───────────────────────────────────────────────────
  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `aquadetect-report-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
