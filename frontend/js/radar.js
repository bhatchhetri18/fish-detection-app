/**
 * radar.js — Sonar Radar Scanning Animation
 * ═════════════════════════════════════════
 * Canvas 2D radar sweep shown during AI detection.
 * Features: sweeping arc, grid rings, random blips,
 *           neon glow, center target cross.
 */

class RadarScanner {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx     = this.canvas.getContext("2d");
    this.angle   = 0;
    this.running = false;
    this.blips   = [];
    this.raf     = null;

    // Visual settings — pulled from CSS vars at runtime
    this._accent1 = "#00d4ff";
    this._accent2 = "#00ffc8";
  }

  /** Read CSS custom property (so theme changes apply) */
  _cssVar(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim() || this["_" + name.replace("--", "_").replace(/-/g, "_")];
  }

  start() {
    this.running = true;
    this.blips   = [];
    this.angle   = 0;
    this._loop();
  }

  stop() {
    this.running = false;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
  }

  _loop() {
    if (!this.running) return;
    this._draw();
    this.raf = requestAnimationFrame(() => this._loop());
  }

  _draw() {
    const { canvas, ctx } = this;
    const W  = canvas.width;
    const H  = canvas.height;
    const CX = W / 2;
    const CY = H / 2;
    const R  = Math.min(W, H) / 2 - 8;

    // Accent colors — try to read from CSS, fallback to defaults
    const c1 = this._cssVar("--accent-1") || "#00d4ff";
    const c2 = this._cssVar("--accent-2") || "#00ffc8";

    // -- Background --
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 8, 20, 0.92)";
    ctx.fill();

    // Subtle inner glow
    const bgGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, R);
    bgGrad.addColorStop(0,   "rgba(0,212,255,0.06)");
    bgGrad.addColorStop(0.5, "rgba(0,60,120,0.04)");
    bgGrad.addColorStop(1,   "transparent");
    ctx.fillStyle = bgGrad;
    ctx.fill();
    ctx.restore();

    // Clip everything to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.clip();

    // -- Concentric grid rings --
    for (let i = 1; i <= 5; i++) {
      const rr = (R / 5) * i;
      ctx.beginPath();
      ctx.arc(CX, CY, rr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 160, 220, ${i === 5 ? 0.35 : 0.12})`;
      ctx.lineWidth   = i === 5 ? 1.5 : 0.8;
      ctx.stroke();
    }

    // -- Cross-hair lines --
    ctx.strokeStyle = "rgba(0, 160, 220, 0.18)";
    ctx.lineWidth   = 0.7;
    const angles = [0, 45, 90, 135];
    angles.forEach(deg => {
      const rad = (deg * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(rad) * R, CY + Math.sin(rad) * R);
      ctx.lineTo(CX - Math.cos(rad) * R, CY - Math.sin(rad) * R);
      ctx.stroke();
    });

    // -- Sweep glow trail --
    const SWEEP = (Math.PI * 2) / 3;   // 120° trail
    const sweepGrad = ctx.createConicalGradientFallback
      ? null
      : (() => {
          // Approximate conical gradient with arc fill
          const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, R);
          g.addColorStop(0,   `rgba(0, 212, 255, 0.05)`);
          g.addColorStop(0.6, `rgba(0, 212, 255, 0.12)`);
          g.addColorStop(1,   `rgba(0, 212, 255, 0.02)`);
          return g;
        })();

    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, R, this.angle - SWEEP, this.angle);
    ctx.closePath();
    ctx.fillStyle = sweepGrad;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;

    // -- Sweep leading edge --
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.lineTo(
      CX + Math.cos(this.angle) * R,
      CY + Math.sin(this.angle) * R
    );
    ctx.strokeStyle = c1;
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 12;
    ctx.shadowColor = c1;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Advance sweep angle
    this.angle = (this.angle + 0.035) % (Math.PI * 2);

    // -- Random blips --
    if (Math.random() < 0.025) {
      const bAngle = Math.random() * Math.PI * 2;
      const bDist  = (0.2 + Math.random() * 0.75) * R;
      this.blips.push({
        x:     CX + Math.cos(bAngle) * bDist,
        y:     CY + Math.sin(bAngle) * bDist,
        alpha: 1,
        size:  2.5 + Math.random() * 3,
        color: Math.random() > 0.4 ? c1 : c2,
      });
    }

    // Draw + age blips
    this.blips = this.blips.filter(b => b.alpha > 0);
    this.blips.forEach(b => {
      b.alpha -= 0.008;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fillStyle = b.color.replace(")", `, ${b.alpha})`).replace("rgb", "rgba").replace("#", "rgba(") ;

      // Quick hex to rgba fallback
      ctx.globalAlpha = b.alpha;
      ctx.fillStyle   = b.color;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = b.color;
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;

      // Ripple ring
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * (2 - b.alpha), 0, Math.PI * 2);
      ctx.strokeStyle = b.color;
      ctx.lineWidth   = 0.6;
      ctx.globalAlpha = b.alpha * 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // -- Center dot --
    ctx.beginPath();
    ctx.arc(CX, CY, 4, 0, Math.PI * 2);
    ctx.fillStyle  = c1;
    ctx.shadowBlur = 10;
    ctx.shadowColor = c1;
    ctx.fill();
    ctx.shadowBlur = 0;

    // -- Center target rings --
    [10, 17].forEach(r => {
      ctx.beginPath();
      ctx.arc(CX, CY, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 212, 255, 0.25)`;
      ctx.lineWidth   = 0.8;
      ctx.stroke();
    });

    ctx.restore();  // restore clip

    // -- Outer ring border --
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.strokeStyle = c1;
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // -- Tick marks around rim --
    for (let i = 0; i < 36; i++) {
      const a   = (i / 36) * Math.PI * 2;
      const len = i % 3 === 0 ? 8 : 4;
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(a) * (R - len), CY + Math.sin(a) * (R - len));
      ctx.lineTo(CX + Math.cos(a) * R,         CY + Math.sin(a) * R);
      ctx.strokeStyle = `rgba(0, 212, 255, ${i % 9 === 0 ? 0.55 : 0.2})`;
      ctx.lineWidth   = i % 9 === 0 ? 1.2 : 0.6;
      ctx.stroke();
    }
  }
}

// Expose globally for app.js to use
window.RadarScanner = RadarScanner;
window._radar = null;

/**
 * showRadar(filename) — start radar overlay
 * hideRadar()        — stop and hide
 */
window.showRadar = function (filename) {
  const overlay = document.getElementById("radarOverlay");
  if (!overlay) return;
  overlay.style.display = "flex";

  if (!window._radar) {
    window._radar = new RadarScanner("radarCanvas");
  }
  window._radar.start();

  if (filename) {
    const el = document.getElementById("radarFileName");
    if (el) el.textContent = filename;
  }
};

window.hideRadar = function () {
  const overlay = document.getElementById("radarOverlay");
  if (overlay) overlay.style.display = "none";
  if (window._radar) window._radar.stop();
};
