/**
 * 2D particle fluid (double-density relaxation, after Clavet, Beaudoin & Poulin 2005).
 * Pure math, no DOM: positions are in "stage units" (the flow's 600 x 460 viewBox).
 *
 * The water starts as a drop held together by a central pull. As `morph` grows,
 * that pull fades and each particle is guided toward its own spot on one of the
 * four flow lanes, so the drop literally pours out into streams; near the end
 * the lanes start to run and the water keeps flowing through them.
 */
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const LANES = {
  yIn: [0.46, 0.49, 0.52, 0.55],
  yOut: [0.29, 0.355, 0.415, 0.74],
  w: [0.075, 0.06, 0.05, 0.045],
};

export class WaterSim {
  /**
   * @param {{ n?: number, w?: number, h?: number, cx?: number, cy?: number, lanes?: boolean, radius?: number }} o
   */
  constructor({ n = 1000, w = 600, h = 460, cx = w / 2, cy = h / 2, lanes = true, radius = 0 } = {}) {
    this.n = n; this.W = w; this.H = h; this.cx = cx; this.cy = cy; this.lanes = lanes;
    this.rho0 = 2.0; this.k = 0.08; this.kNear = 0.3; // pressure; rho0 above the surface density gives surface tension
    this.vmax = 5;
    this.visc = 0.06;                // velocity smoothing between neighbours
    this.t = 0;
    const A = (len) => new Float32Array(len);
    this.x = A(n); this.y = A(n); this.px = A(n); this.py = A(n); this.vx = A(n); this.vy = A(n);
    this.u = A(n); this.lane = new Uint8Array(n); this.ang = A(n);
    // drop volume equals the volume of the four ribbons, so nothing appears or vanishes
    const area = lanes ? LANES.w.reduce((s, v) => s + v, 0) * h * w : Math.PI * (h * 0.3) ** 2;
    this.R = Math.sqrt(area / Math.PI);
    this.spacing = Math.sqrt(area / n);
    this.h = radius || this.spacing * 2.2; // interaction radius (the pressure constants are tuned for this ratio)
    this._grid = new Map();
    this._nb = new Int32Array(n * 64); this._nbq = new Float32Array(n * 64); this._nbc = new Uint8Array(n);
    this.reset();
  }

  /** even "sunflower" spread inside the drop, then lanes by height and lane positions by x */
  reset() {
    const { n, cx, cy, R } = this;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const r = R * 0.92 * Math.sqrt((i + 0.5) / n);
      const a = i * golden;
      this.x[i] = this.px[i] = cx + Math.cos(a) * r;
      this.y[i] = this.py[i] = cy + Math.sin(a) * r;
      this.vx[i] = this.vy[i] = 0;
    }
    if (!this.lanes) return;
    // lanes: top of the drop -> lane 0 ... bottom -> lane 3, shares by ribbon width
    const order = [...Array(n).keys()].sort((a, b) => this.y[a] - this.y[b]);
    const total = LANES.w.reduce((s, v) => s + v, 0);
    let start = 0;
    for (let l = 0; l < 4; l++) {
      const cnt = l === 3 ? n - start : Math.round((n * LANES.w[l]) / total);
      const ids = order.slice(start, start + cnt).sort((a, b) => this.x[a] - this.x[b]);
      ids.forEach((id, k) => { this.lane[id] = l; this.u[id] = (k + 0.5) / ids.length; });
      start += cnt;
    }
  }

  laneY(l, u) {
    const s = smooth(0.3, 0.72, u);
    return (LANES.yIn[l] + (LANES.yOut[l] - LANES.yIn[l]) * s) * this.H + Math.sin(u * 8 + this.t * 0.0065 + l) * 0.01 * this.H;
  }

  _neighbours() {
    const { n, h, x, y } = this;
    const grid = this._grid; grid.clear();
    const key = (gx, gy) => gx * 73856093 ^ gy * 19349663;
    for (let i = 0; i < n; i++) {
      const k = key(Math.floor(x[i] / h), Math.floor(y[i] / h));
      let cell = grid.get(k);
      if (!cell) { cell = []; grid.set(k, cell); }
      cell.push(i);
    }
    const nb = this._nb, nbq = this._nbq, nbc = this._nbc;
    for (let i = 0; i < n; i++) {
      const gx = Math.floor(x[i] / h), gy = Math.floor(y[i] / h);
      let c = 0;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const cell = grid.get(key(gx + ox, gy + oy));
        if (!cell) continue;
        for (let m = 0; m < cell.length; m++) {
          const j = cell[m];
          if (j <= i) continue;
          const dx = x[j] - x[i], dy = y[j] - y[i];
          const r2 = dx * dx + dy * dy;
          if (r2 < h * h && c < 63) { nb[i * 64 + c] = j; nbq[i * 64 + c] = Math.sqrt(r2) / h; c++; }
        }
      }
      nbc[i] = c;
    }
  }

  /**
   * one simulation step (dt = 1 "tick", ~1/120 s)
   * @param {number} morph 0..1
   * @param {{ x: number, y: number, vx: number, vy: number, down: boolean, active: boolean, gx: number, gy: number }} ptr  pointer in stage units
   * @param {{ wobble?: number, flow?: number }} opt
   */
  step(morph, ptr, { wobble = 1, flow = 1 } = {}) {
    const { n, x, y, px, py, vx, vy, h } = this;
    this.t += 1;
    const md = 1 - smooth(0.04, 0.7, morph);      // drop cohesion
    const ml = this.lanes ? smooth(0.08, 0.8, morph) : 0; // lane guidance
    const mf = this.lanes ? smooth(0.72, 1.0, morph) * flow : 0; // lanes start to run
    const cx = this.cx, cy = this.cy;
    const flowV = 0.55;                            // stage units per tick
    const du = flowV / this.W;

    // the drop holds itself together by surface tension; we only steer its centre of mass
    // (critically damped: it glides to its spot without swinging past it)
    let comX = 0, comY = 0, comVX = 0, comVY = 0;
    for (let i = 0; i < n; i++) { comX += x[i]; comY += y[i]; comVX += vx[i]; comVY += vy[i]; }
    comX /= n; comY /= n; comVX /= n; comVY /= n;
    const steerX = ((cx - comX) * 0.04 - comVX) * 0.12 * md, steerY = ((cy - comY) * 0.04 - comVY) * 0.12 * md;
    const Rk = this.R * 1.08;
    for (let i = 0; i < n; i++) {
      if (md > 0.001) {
        vx[i] += steerX; vy[i] += steerY;
        const dx = x[i] - comX, dy = y[i] - comY;
        const d = Math.sqrt(dx * dx + dy * dy) + 1e-3;
        const a = Math.atan2(dy, dx);
        // a slow ripple running around the surface makes it breathe
        const ripple = 0.0022 * wobble * (Math.sin(this.t * 0.016 + a * 3) + 0.6 * Math.sin(this.t * 0.025 - a * 5)) * (d / this.R);
        // splashes that fly too far are pulled back, like a weak gravity well
        const back = d > Rk ? (d - Rk) * 0.004 : 0;
        vx[i] += (dx / d) * (ripple - back) * md; vy[i] += (dy / d) * (ripple - back) * md;
      }
      // guidance toward the particle's own spot on its lane
      if (ml > 0.001) {
        const l = this.lane[i];
        if (mf > 0.001) {
          // channel flow: each particle follows the lane where it currently is, and the lanes run left to right
          this.u[i] += (x[i] / this.W - this.u[i]) * mf * 0.2;
          if (x[i] > this.W * 1.1) {        // leave through the faded right edge, re-enter through the faded left edge
            x[i] = px[i] = -this.W * (0.1 + Math.random() * 0.06);
            this.u[i] = x[i] / this.W;
            y[i] = py[i] = this.laneY(l, 0) + (Math.random() - 0.5) * LANES.w[l] * this.H * 0.8;
            vx[i] = flowV * mf; vy[i] = 0;
          }
        }
        const ue = Math.max(0, this.u[i]);
        const tx = this.u[i] * this.W, ty = this.laneY(l, ue);
        // damped guidance (velocity toward the target, not a spring): streams settle without sloshing back and forth
        const behind = x[i] < 0 ? Math.min(3, -x[i] * 0.01) : 0; // water left of the lanes is drawn in faster
        vx[i] += ((tx - x[i]) * 0.03 - vx[i]) * 0.1 * ml * (1 - mf) + ((flowV + behind) * mf - vx[i]) * 0.03 * mf;
        vy[i] += ((ty - y[i]) * 0.06 - vy[i]) * 0.2 * ml;
        if (mf > 0.001) {
          // follow the bend of the channel instead of being dragged around it
          const slope = (this.laneY(l, Math.min(1, ue + 0.01)) - ty) / (0.01 * this.W);
          vy[i] += (slope * flowV - vy[i]) * 0.06 * mf;
        }
      }
      // finger in the water: pressing drags it along, hovering parts it gently
      if (ptr.active) {
        const dx = x[i] - ptr.x, dy = y[i] - ptr.y;
        const r2 = dx * dx + dy * dy, R2 = 46 * 46;
        if (r2 < R2) {
          const f = 1 - r2 / R2;
          if (ptr.down) { vx[i] += (ptr.vx * 0.35 - dx * 0.004) * f; vy[i] += (ptr.vy * 0.35 - dy * 0.004) * f; }
          else { const r = Math.sqrt(r2) + 1e-3; vx[i] += (dx / r) * 0.05 * f; vy[i] += (dy / r) * 0.05 * f; }
        }
      }
      vx[i] *= 0.994; vy[i] *= 0.994;
      const sp = Math.hypot(vx[i], vy[i]);
      if (sp > this.vmax) { vx[i] *= this.vmax / sp; vy[i] *= this.vmax / sp; }
    }

    // advance
    for (let i = 0; i < n; i++) {
      px[i] = x[i]; py[i] = y[i];
      x[i] += vx[i]; y[i] += vy[i];
    }

    // double-density relaxation (neighbouring streams lose their mutual pull as they become lanes)
    const sepLanes = this.lanes ? smooth(0.3, 0.9, morph) : 0;
    const tension = 1 - 0.65 * (this.lanes ? smooth(0.72, 1.0, morph) : 0); // thin running streams should not pinch off
    this._neighbours();
    const nb = this._nb, nbq = this._nbq, nbc = this._nbc;
    const rho = new Float32Array(n), rhoN = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < nbc[i]; c++) {
        const j = nb[i * 64 + c], q = 1 - nbq[i * 64 + c];
        const q2 = q * q, q3 = q2 * q;
        rho[i] += q2; rho[j] += q2; rhoN[i] += q3; rhoN[j] += q3;
      }
    }
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < nbc[i]; c++) {
        const j = nb[i * 64 + c], qq = nbq[i * 64 + c], q = 1 - qq;
        let P = this.k * (rho[i] + rho[j] - 2 * this.rho0) * 0.5;
        if (sepLanes && this.lane[i] !== this.lane[j] && P < 0) P *= 1 - sepLanes; // streams may part ways
        if (P < 0) P *= tension;
        const PN = this.kNear * (rhoN[i] + rhoN[j]) * 0.5;
        let dx = x[j] - x[i], dy = y[j] - y[i];
        const r = qq * h + 1e-4;
        dx /= r; dy /= r;
        const D = Math.max(-1.5, Math.min(1.5, (P * q + PN * q * q) * 0.5));
        x[i] -= dx * D; y[i] -= dy * D;
        x[j] += dx * D; y[j] += dy * D;
      }
    }

    // velocities from displacement, then a little viscosity between neighbours
    for (let i = 0; i < n; i++) { vx[i] = x[i] - px[i]; vy[i] = y[i] - py[i]; }
    if (this.visc > 0) {
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < nbc[i]; c++) {
          const j = nb[i * 64 + c], q = 1 - nbq[i * 64 + c];
          const ivx = (vx[j] - vx[i]) * this.visc * q, ivy = (vy[j] - vy[i]) * this.visc * q;
          vx[i] += ivx * 0.5; vy[i] += ivy * 0.5; vx[j] -= ivx * 0.5; vy[j] -= ivy * 0.5;
        }
      }
    }
    // keep stray drops in reach
    for (let i = 0; i < n; i++) {
      if (Math.abs(x[i] - this.cx) > this.W * 3 || Math.abs(y[i] - this.cy) > this.H * 3 || !Number.isFinite(x[i])) {
        x[i] = px[i] = this.cx + (Math.random() - 0.5) * 10; y[i] = py[i] = this.cy + (Math.random() - 0.5) * 10; vx[i] = vy[i] = 0;
      }
    }
  }
}
