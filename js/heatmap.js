const Heatmap = (() => {
  const GRADIENT_STOPS = [
    { pos: 0.0, color: [0, 0, 255, 0] },
    { pos: 0.15, color: [0, 0, 255, 80] },
    { pos: 0.3, color: [0, 200, 255, 140] },
    { pos: 0.45, color: [0, 255, 100, 180] },
    { pos: 0.6, color: [255, 255, 0, 210] },
    { pos: 0.8, color: [255, 140, 0, 235] },
    { pos: 1.0, color: [255, 0, 0, 255] },
  ];

  let state = {
    enabled: false,
    filterMode: "all",
    opacity: 0.55,
    radius: 40,
  };

  let canvas = null;
  let ctx = null;
  let shadowCanvas = null;
  let shadowCtx = null;

  function init() {
    canvas = document.getElementById("heatmapCanvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");

    shadowCanvas = document.createElement("canvas");
    shadowCtx = shadowCanvas.getContext("2d");

    resize();
    window.addEventListener("resize", debounce(resize, 150));
  }

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function resize() {
    if (!canvas) return;
    const mapEl = document.getElementById("map");
    if (!mapEl) return;
    const rect = mapEl.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    shadowCanvas.width = rect.width;
    shadowCanvas.height = rect.height;
    if (state.enabled) {
      render();
    }
  }

  function setState(newState) {
    Object.assign(state, newState);
  }

  function getState() {
    return { ...state };
  }

  function filterMarks(marks, filterMode) {
    if (filterMode === "all") return marks;

    const typeMap = {
      type_ceramic: "ceramic",
      type_wood: "wood",
      type_metal: "metal",
      type_unknown: "unknown",
    };

    const statusMap = {
      status_collected: "collected",
      status_pending: "pending",
      status_confirmed: "confirmed",
      status_revisit: "revisit",
    };

    if (typeMap[filterMode]) {
      return marks.filter((m) => m.type === typeMap[filterMode]);
    }
    if (statusMap[filterMode]) {
      return marks.filter((m) => {
        const s = m.review?.status || "collected";
        return s === statusMap[filterMode];
      });
    }
    if (filterMode.startsWith("dive_")) {
      const diveCode = filterMode.slice(5);
      return marks.filter((m) => m.dive === diveCode);
    }

    return marks;
  }

  function calculateDensity(marks, width, height, radius) {
    const gridW = Math.ceil(width / 4);
    const gridH = Math.ceil(height / 4);
    const grid = new Float32Array(gridW * gridH);

    const cellSize = 4;
    const sigma = radius / 2.5;

    marks.forEach((mark) => {
      if (mark.x == null || mark.y == null) return;

      const px = (mark.x / 100) * width;
      const py = (mark.y / 100) * height;

      const gxMin = Math.max(0, Math.floor((px - radius * 2) / cellSize));
      const gxMax = Math.min(gridW - 1, Math.ceil((px + radius * 2) / cellSize));
      const gyMin = Math.max(0, Math.floor((py - radius * 2) / cellSize));
      const gyMax = Math.min(gridH - 1, Math.ceil((py + radius * 2) / cellSize));

      for (let gy = gyMin; gy <= gyMax; gy++) {
        for (let gx = gxMin; gx <= gxMax; gx++) {
          const cx = gx * cellSize + cellSize / 2;
          const cy = gy * cellSize + cellSize / 2;
          const dx = cx - px;
          const dy = cy - py;
          const dist2 = dx * dx + dy * dy;
          const sigma2 = sigma * sigma;
          const val = Math.exp(-dist2 / (2 * sigma2));
          grid[gy * gridW + gx] += val;
        }
      }
    });

    return { grid, gridW, gridH, cellSize };
  }

  function getColor(value, maxVal) {
    if (maxVal === 0) return null;
    const t = Math.min(value / maxVal, 1.0);

    let low = GRADIENT_STOPS[0];
    let high = GRADIENT_STOPS[GRADIENT_STOPS.length - 1];
    for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
      if (t >= GRADIENT_STOPS[i].pos && t <= GRADIENT_STOPS[i + 1].pos) {
        low = GRADIENT_STOPS[i];
        high = GRADIENT_STOPS[i + 1];
        break;
      }
    }

    const range = high.pos - low.pos;
    const ratio = range === 0 ? 0 : (t - low.pos) / range;

    const r = Math.round(low.color[0] + (high.color[0] - low.color[0]) * ratio);
    const g = Math.round(low.color[1] + (high.color[1] - low.color[1]) * ratio);
    const b = Math.round(low.color[2] + (high.color[2] - low.color[2]) * ratio);
    const a = Math.round(low.color[3] + (high.color[3] - low.color[3]) * ratio);

    return [r, g, b, a];
  }

  function render(marks) {
    if (!canvas || !ctx || !shadowCtx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!state.enabled) {
      updateEmptyTip(true);
      return;
    }

    const filtered = filterMarks(marks || [], state.filterMode);

    if (filtered.length === 0) {
      updateEmptyTip(false);
      return;
    }

    updateEmptyTip(true);

    const { grid, gridW, gridH, cellSize } = calculateDensity(
      filtered,
      width,
      height,
      state.radius
    );

    let maxVal = 0;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] > maxVal) maxVal = grid[i];
    }

    if (maxVal === 0) {
      updateEmptyTip(false);
      return;
    }

    const imageData = shadowCtx.createImageData(width, height);
    const pixels = imageData.data;

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const val = grid[gy * gridW + gx];
        if (val < 0.01) continue;

        const color = getColor(val, maxVal);
        if (!color) continue;

        const startX = gx * cellSize;
        const startY = gy * cellSize;
        const endX = Math.min(startX + cellSize, width);
        const endY = Math.min(startY + cellSize, height);

        for (let py = startY; py < endY; py++) {
          for (let px = startX; px < endX; px++) {
            const idx = (py * width + px) * 4;
            if (color[3] > pixels[idx + 3]) {
              pixels[idx] = color[0];
              pixels[idx + 1] = color[1];
              pixels[idx + 2] = color[2];
              pixels[idx + 3] = color[3];
            }
          }
        }
      }
    }

    shadowCtx.putImageData(imageData, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = state.opacity;
    ctx.drawImage(shadowCanvas, 0, 0);
    ctx.globalAlpha = 1.0;
  }

  function updateEmptyTip(hasData) {
    const tip = document.getElementById("heatmapEmptyTip");
    if (!tip) return;
    if (state.enabled && !hasData) {
      tip.classList.remove("hidden");
    } else {
      tip.classList.add("hidden");
    }
  }

  function getGradientCSS() {
    const stops = GRADIENT_STOPS
      .filter((s) => s.pos > 0)
      .map((s) => {
        const r = s.color[0];
        const g = s.color[1];
        const b = s.color[2];
        return `rgba(${r},${g},${b},1) ${Math.round(s.pos * 100)}%`;
      });
    return `linear-gradient(to top, ${stops.join(", ")})`;
  }

  function toggle() {
    state.enabled = !state.enabled;
    return state.enabled;
  }

  function enable() {
    state.enabled = true;
  }

  function disable() {
    state.enabled = false;
  }

  return {
    init,
    render,
    resize,
    toggle,
    enable,
    disable,
    setState,
    getState,
    filterMarks,
    getGradientCSS,
  };
})();
