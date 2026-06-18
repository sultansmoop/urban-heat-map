/**
 * script.js — Urban Heat Map Simulation Engine
 * -------------------------------------------------
 * Reads the material painted onto each grid cell and runs a simplified
 * Surface Energy Balance to produce an average "city temperature."
 *
 * Physics model used (simplified):
 *   T_surface = T_ambient + (Solar_in × (1 - albedo) - QE) / k
 *
 *   where:
 *     T_ambient = 22 °C  (baseline air temperature on a sunny day)
 *     Solar_in = 800 W/m²  (typical mid-day solar irradiance)
 *     albedo = material's reflectivity  (0 = absorbs all, 1 = reflects all)
 *     QE = latent heat flux (cooling from evapotranspiration, W/m²)
 *     k = normalisation constant that maps W/m² -> °C offset (≈ 25)
 *
 * For the "buffer zone" (Tree Canopy Effect), every grass cell also slightly
 * cools its 8 neighbouring cells by applying a fraction of its QE benefit.
 */
 
// Material Definitions:
// Each material carries:
//   albedo: fraction of sunlight reflected  (higher = cooler surface)
//   QE: latent/evaporative cooling flux in W/m²
//   label: human-readable name for the tooltip / legend
//   colour: the heat-map overlay colour used in the visualisation pass

const MATERIALS = {
  asphalt: {
    albedo: 0.07,   // very dark, absorbs ~93 % of solar radiation
    QE:     0,      // impermeable, no evapotranspiration
    label:  'Asphalt',
    base:   '#475569',
  },
  concrete: {
    albedo: 0.30,   // lighter grey, moderate reflectivity
    QE:     0,      // still impermeable
    label:  'Concrete',
    base:   '#94a3b8',
  },
  grass: {
    albedo: 0.25,   // absorbs most sunlight, but plants cool through transpiration
    QE:     120,    // strong evaporative cooling (W/m²)
    label:  'Grass / park',
    base:   '#22c55e',
  },
  water: {
    albedo: 0.06,   // water absorbs a lot of light…
    QE:     250,    // …but its huge latent-heat flux keeps it cool
    label:  'Water body',
    base:   '#3b82f6',
  },
  snow: {
    albedo: 0.80,   // most reflective natural surface
    QE:     0,      // sublimation ignored in this simplified model
    label:  'Snow',
    base:   '#e2e8f0',
  },
};
 
//Constants
const T_AMBIENT   = 22;    // baseline ambient air temperature (°C)
const SOLAR_IN    = 800;   // incoming solar irradiance (W/m²)
const K_NORMALIZE = 25;    // maps net W/m² -> °C rise above ambient
const BUFFER_FRAC = 0.35;  // fraction of grass QE shared with neighbours
 
// State
const canvas   = document.getElementById('grid-canvas');
const ctx      = canvas.getContext('2d');
let N          = 6;            // current grid dimension (N × N)
let grid       = [];           // 2D array of material keys
let selected   = 'asphalt';   // currently selected palette material
let isDragging = false;        // tracks mouse-held drag-paint
let heatMapMode = false;       // false = Normal view, true = Heat map overlay
 
// Grid Initialisation
// Creates a fresh N×N grid filled with concrete. 
function initGrid() {
  grid = Array.from({ length: N }, () => Array(N).fill('concrete'));
}
 
// Physics Helpers
/**
 * surfaceTemp: simplified Surface Energy Balance for a single cell.
 *
 * @param {string} mat      material key (e.g. asphalt)
 * @param {number} extraQE  additional evaporative cooling from nearby grass (W/m²)
 * @returns {number}        surface temperature in °C
 */
function surfaceTemp(mat, extraQE = 0) {
  const m = MATERIALS[mat];
  if (!m) return T_AMBIENT;
 
  // Net absorbed solar radiation (W/m²)
  const Q_absorbed = SOLAR_IN * (1 - m.albedo);
 
  // Total latent/evaporative cooling: own QE + buffer from grass neighbours
  const Q_latent = m.QE + extraQE;
 
  // Temperature offset above ambient (°C)
  const deltaT = (Q_absorbed - Q_latent) / K_NORMALIZE;
 
  return T_AMBIENT + deltaT;
}
 
/**
 * buildBufferMap: tree canopy effect.
 * Each grass cell shares BUFFER_FRAC × QE_grass with its neighbours,
 * creating a measurable cooling halo around parks.
 *
 * @returns {Float32Array[][]} - N×N grid of extra QE values (W/m²)
 */
function buildBufferMap() {
  const buf = Array.from({ length: N }, () => new Float32Array(N));
 
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c] !== 'grass') continue;
 
      const spill = MATERIALS.grass.QE * BUFFER_FRAC;
 
      // Walk the 8 surrounding neighbours
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;           // skip the grass cell itself
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < N && nc >= 0 && nc < N) {
            buf[nr][nc] += spill;
          }
        }
      }
    }
  }
  return buf;
}
 
//Colour Helpers
 
/**
 * lerpColor: linearly interpolates between two hex colour strings.
 * t = 0 -> colorA,  t = 1 -> colorB
 *
 */
function lerpColor(a, b, t) {
  const p = h => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},` +
             `${Math.round(g1 + (g2 - g1) * t)},` +
             `${Math.round(b1 + (b2 - b1) * t)})`;
}
 
/**
 * heatRamp: maps a normalised 0–1 value to a blue -> amber -> red gradient.
 * Used in Heat map mode.
 */
function heatRamp(t) {
  const stops = [
    [0,   [59,  130, 246]],   // blue
    [0.4, [251, 191,  36]],   // amber
    [0.7, [249, 115,  22]],   // orange
    [1,   [239,  68,  68]],   // red
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      a = stops[i]; b = stops[i + 1]; break;
    }
  }
  const s = (b[0] - a[0]) < 0.001 ? 0 : (t - a[0]) / (b[0] - a[0]);
  return `rgb(${Math.round(a[1][0] + (b[1][0] - a[1][0]) * s)},` +
             `${Math.round(a[1][1] + (b[1][1] - a[1][1]) * s)},` +
             `${Math.round(a[1][2] + (b[1][2] - a[1][2]) * s)})`;
}
 
// hexToRgb: splits a #rrggbb string into [r, g, b] integers.
function hexToRgb(h) {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}
 
// Main Draw / Simulation Function
 
/**
 * drawGrid: computes temperatures and repaints the canvas.
 *
 * Steps:
 *   1. Build the grass buffer (cooling halo) map.
 *   2. Calculate per-cell surface temperatures.
 *   3. Update the metrics panel (average, hottest, coolest).
 *   4. Paint each cell in the active mode:
 *        Normal   -> material's real base colour
 *        Heat map -> full heat-ramp colour (blue -> amber -> red)
 *   5. Optionally overlay a temperature label when cells are large enough.
 *
 */
function drawGrid() {
  const buf = buildBufferMap();
 
  const temps = grid.map((row, r) =>
    row.map((mat, c) => surfaceTemp(mat, buf[r][c]))
  );
 
  const flat  = temps.flat();
  const minT  = Math.min(...flat);
  const maxT  = Math.max(...flat);
  const range = maxT - minT || 1;   // avoid division by zero
 
  // Size canvas to fit the container
  const available = Math.min(canvas.parentElement.offsetWidth - 4, 460);
  const cellPx    = Math.max(24, Math.floor(available / N));
  const W         = cellPx * N;
  canvas.width    = W;
  canvas.height   = W;
 
  let total = 0, hottest = -Infinity, coolest = Infinity;
 
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const t    = temps[r][c];
      total     += t;
      if (t > hottest) hottest = t;
      if (t < coolest) coolest = t;
 
      const norm = (t - minT) / range;   // normalised 0–1 for colour mapping
      const x = c * cellPx, y = r * cellPx;
 
      // Draw rounded cell
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, cellPx - 4, cellPx - 4, 3);
 
      if (heatMapMode) {
        // Heat map mode: fill with temperature ramp colour
        ctx.fillStyle = heatRamp(norm);
      } else {
        // Normal mode: fill with the material's real base colour
        const [mr, mg, mb] = hexToRgb(MATERIALS[grid[r][c]].base);
        ctx.fillStyle = `rgb(${mr},${mg},${mb})`;
      }
      ctx.fill();
 
      // Temperature label (visible when cells are wide enough)
      if (cellPx >= 40) {
        ctx.font         = `600 ${Math.min(11, Math.floor(cellPx / 4))}px 'Segoe UI', sans-serif`;
        ctx.fillStyle    = heatMapMode ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.50)';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.toFixed(1), x + cellPx / 2, y + cellPx / 2);
      }
    }
  }
 
  //Update metrics panel
  const avg  = total / (N * N);
  const heat = Math.min(1, Math.max(0, (avg - 22) / 23));
 
  const readout = document.getElementById('temp-readout');
  if (readout) {
    readout.textContent = avg.toFixed(1) + ' °C';
    readout.style.color = lerpColor('#3b82f6', '#dc2626', heat);
  }
 
  const hotEl  = document.getElementById('hot-temp');
  const coolEl = document.getElementById('cool-temp');
  if (hotEl)  hotEl.textContent  = hottest.toFixed(1);
  if (coolEl) coolEl.textContent = coolest.toFixed(1);
}
 
// Cell Picking
 
/**
 * cellFromEvent: converts a mouse/touch event to [row, col] grid indices.
 * Returns null if the event falls outside the grid.
 */
function cellFromEvent(e) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top)  * scaleY;
  const cellPx = canvas.width / N;
  const c = Math.floor(x / cellPx);
  const r = Math.floor(y / cellPx);
  return (r >= 0 && r < N && c >= 0 && c < N) ? [r, c] : null;
}
 
// Mouse / Touch Events
 
// Start drag-paint on mousedown
canvas.addEventListener('mousedown', e => {
  isDragging = true;
  const pos = cellFromEvent(e);
  if (pos) { grid[pos[0]][pos[1]] = selected; drawGrid(); }
  e.preventDefault();   // prevents text selection while dragging
});
 
// Continue painting while dragging
canvas.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const pos = cellFromEvent(e);
  if (pos) { grid[pos[0]][pos[1]] = selected; drawGrid(); }
});
 
// Stop dragging anywhere on the page
document.addEventListener('mouseup', () => { isDragging = false; });
 
// Touch equivalents for mobile
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const pos = cellFromEvent(e.touches[0]);
  if (pos) { grid[pos[0]][pos[1]] = selected; drawGrid(); }
}, { passive: false });
 
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const pos = cellFromEvent(e.touches[0]);
  if (pos) { grid[pos[0]][pos[1]] = selected; drawGrid(); }
}, { passive: false });
 
// Palette Buttons
 
document.querySelectorAll('.palette-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selected = btn.dataset.material;
  });
});
 
// Mode Toggle (Normal <-> Heat Map) 
 
document.getElementById('mode-toggle').addEventListener('change', function () {
  heatMapMode = this.checked;
 
  // Swap legends
  document.getElementById('legend-normal').style.display = heatMapMode ? 'none'  : 'flex';
  document.getElementById('legend-heat').style.display   = heatMapMode ? 'flex'  : 'none';
 
  // Update toggle label emphasis
  const lblNormal = document.getElementById('lbl-normal');
  const lblHeat   = document.getElementById('lbl-heat');
  lblNormal.classList.toggle('on', !heatMapMode);
  lblHeat.classList.toggle('on',   heatMapMode);
 
  drawGrid();
});
 
// Grid Size Slider
 
document.getElementById('grid-size').addEventListener('input', function () {
  N = parseInt(this.value);
  document.getElementById('size-out').textContent = N + '×' + N;
  initGrid();
  drawGrid();
});
 
// Quick Action Buttons
 
// Reset everything to concrete
document.getElementById('btn-clear').addEventListener('click', () => {
  initGrid();
  drawGrid();
});
 
// Resize Handling
 
// Redraw on window resize so the canvas stays correctly sized
window.addEventListener('resize', drawGrid);
 
//Boot
 
initGrid();
drawGrid();
 