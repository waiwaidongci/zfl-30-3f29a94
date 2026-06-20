const UI = (() => {
  const typeNames = { ceramic: "陶片", wood: "木构件", metal: "金属件", unknown: "未知物" };
  const weatherNames = { sunny: "晴", cloudy: "多云", rainy: "雨", windy: "大风", foggy: "雾" };
  const currentNames = { calm: "无流", weak: "弱流", moderate: "中流", strong: "强流" };

  let elements = {};
  let marks = [];
  let dives = [];
  let measurements = [];
  let scale = null;
  let gridConfig = { enabled: false, size: 1, showLabels: true };
  let pending = null;
  let currentEditId = null;
  let currentEditDiveId = null;
  let currentEditMeasureId = null;
  let activeTab = "marks";

  let callbacks = {};
  let isCalibrating = false;
  let calibratePoints = [];
  let isMeasuring = false;
  let measurePoints = [];
  let selectedRelatedMarks = [];

  function init(deps) {
    elements = {
      map: document.querySelector("#map"),
      form: document.querySelector("#form"),
      list: document.querySelector("#list"),
      filter: document.querySelector("#filter"),
      diveFilter: document.querySelector("#diveFilter"),
      view: document.querySelector("#view"),
      listTitle: document.querySelector("#listTitle"),
      exportBtn: document.querySelector("#exportBtn"),
      importBtn: document.querySelector("#importBtn"),
      deleteBtn: document.querySelector("#deleteBtn"),
      mapStats: document.querySelector("#mapStats"),
      tabs: document.querySelectorAll(".tab"),
      marksTab: document.querySelector("#marksTab"),
      divesTab: document.querySelector("#divesTab"),
      diveForm: document.querySelector("#diveForm"),
      diveList: document.querySelector("#diveList"),
      diveStats: document.querySelector("#diveStats"),
      diveDetail: document.querySelector("#diveDetail"),
      diveDetailContent: document.querySelector("#diveDetailContent"),
      deleteDiveBtn: document.querySelector("#deleteDiveBtn"),
      calibrateBtn: document.querySelector("#calibrateBtn"),
      gridBtn: document.querySelector("#gridBtn"),
      measureBtn: document.querySelector("#measureBtn"),
      gridLayer: document.querySelector("#gridLayer"),
      measureLayer: document.querySelector("#measureLayer"),
      measureTab: document.querySelector("#measureTab"),
      measureForm: document.querySelector("#measureForm"),
      measureList: document.querySelector("#measureList"),
      measureStats: document.querySelector("#measureStats"),
      scaleValue: document.querySelector("#scaleValue"),
      relatedMarksContainer: document.querySelector("#relatedMarksContainer"),
      deleteMeasureBtn: document.querySelector("#deleteMeasureBtn"),
      cancelMeasureBtn: document.querySelector("#cancelMeasureBtn"),
      gridSize: document.querySelector("#gridSize"),
      showGridLabels: document.querySelector("#showGridLabels"),
    };

    marks = deps.marks;
    dives = deps.dives;
    measurements = deps.measurements || [];
    scale = deps.scale || null;
    gridConfig = deps.gridConfig || { enabled: false, size: 1, showLabels: true };
    pending = deps.pending;
    currentEditId = deps.currentEditId;

    if (gridConfig.size) {
      elements.gridSize.value = gridConfig.size;
    }
    if (gridConfig.showLabels !== undefined) {
      elements.showGridLabels.checked = gridConfig.showLabels;
    }

    callbacks = deps.callbacks;
    initRibs();
    bindEvents(callbacks);
    updateDiveSelect();
    updateDiveFilter();
    updateScaleDisplay();
    updateMeasureDiveSelect();
    renderGrid();
  }

  function initRibs() {
    for (let i = 0; i < 7; i++) {
      const rib = document.createElement("div");
      rib.className = "rib";
      rib.style.left = 28 + i * 7 + "%";
      elements.map.appendChild(rib);
    }
  }

  function bindEvents(callbacks) {
    elements.map.addEventListener("click", (event) => {
      if (isCalibrating) {
        handleCalibrateClick(event);
        return;
      }
      if (isMeasuring) {
        handleMeasureClick(event);
        return;
      }
      const rect = elements.map.getBoundingClientRect();
      pending = {
        x: Number(((event.clientX - rect.left) / rect.width * 100).toFixed(2)),
        y: Number(((event.clientY - rect.top) / rect.height * 100).toFixed(2)),
      };
      elements.form.reset();
      elements.form.id.value = "";
      currentEditId = null;
      elements.form.code.value = "M-" + String(marks.length + 1).padStart(3, "0");
      if (dives.length > 0) {
        elements.form.dive.value = dives[0].code;
      }
      render();
    });

    elements.form.onsubmit = (event) => {
      event.preventDefault();
      if (!pending) pending = { x: 50, y: 50 };
      const data = Object.fromEntries(new FormData(elements.form).entries());
      callbacks.onSaveMark(data, pending);
    };

    elements.diveForm.onsubmit = (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(elements.diveForm).entries());
      callbacks.onSaveDive(data);
    };

    elements.measureForm.onsubmit = (event) => {
      event.preventDefault();
      const formData = Object.fromEntries(new FormData(elements.measureForm).entries());
      const data = {
        ...formData,
        length: Number(formData.length),
        points: measurePoints.length >= 2 ? measurePoints : null,
        relatedMarks: selectedRelatedMarks,
      };
      callbacks.onSaveMeasurement(data);
    };

    elements.deleteBtn.onclick = () => {
      if (!elements.form.id.value) return;
      callbacks.onDeleteMark(elements.form.id.value);
    };

    elements.deleteDiveBtn.onclick = () => {
      if (!elements.diveForm.id.value) return;
      callbacks.onDeleteDive(elements.diveForm.id.value);
    };

    elements.deleteMeasureBtn.onclick = () => {
      if (!elements.measureForm.id.value) return;
      callbacks.onDeleteMeasurement(elements.measureForm.id.value);
    };

    elements.cancelMeasureBtn.onclick = () => {
      cancelMeasuring();
      resetMeasureForm();
    };

    elements.calibrateBtn.onclick = () => {
      if (isCalibrating) {
        cancelCalibrating();
      } else {
        startCalibrating();
      }
    };

    elements.gridBtn.onclick = () => {
      gridConfig.enabled = !gridConfig.enabled;
      elements.gridBtn.classList.toggle("active", gridConfig.enabled);
      callbacks.onUpdateGridConfig(gridConfig);
      renderGrid();
    };

    elements.measureBtn.onclick = () => {
      if (isMeasuring) {
        cancelMeasuring();
      } else {
        startMeasuring();
      }
    };

    elements.gridSize.onchange = () => {
      gridConfig.size = Number(elements.gridSize.value) || 1;
      callbacks.onUpdateGridConfig(gridConfig);
      renderGrid();
    };

    elements.showGridLabels.onchange = () => {
      gridConfig.showLabels = elements.showGridLabels.checked;
      callbacks.onUpdateGridConfig(gridConfig);
      renderGrid();
    };

    elements.exportBtn.onclick = () => {
      callbacks.onExport();
    };

    elements.importBtn.onclick = () => {
      callbacks.onImport();
    };

    elements.filter.onchange = render;
    elements.diveFilter.onchange = render;
    elements.view.onchange = render;

    elements.tabs.forEach(tab => {
      tab.onclick = () => {
        switchTab(tab.dataset.tab);
      };
    });
  }

  function startCalibrating() {
    isCalibrating = true;
    calibratePoints = [];
    elements.map.classList.add("calibrating");
    elements.calibrateBtn.textContent = "取消校准";
    elements.calibrateBtn.classList.remove("secondary");
    showToast("请在地图上点击两个点进行比例尺校准", "info");
    renderCalibrate();
  }

  function cancelCalibrating() {
    isCalibrating = false;
    calibratePoints = [];
    elements.map.classList.remove("calibrating");
    elements.calibrateBtn.textContent = "校准比例尺";
    elements.calibrateBtn.classList.add("secondary");
    renderCalibrate();
  }

  function handleCalibrateClick(event) {
    event.stopPropagation();
    const rect = elements.map.getBoundingClientRect();
    const point = {
      x: Number(((event.clientX - rect.left) / rect.width * 100).toFixed(2)),
      y: Number(((event.clientY - rect.top) / rect.height * 100).toFixed(2)),
    };

    calibratePoints.push(point);
    renderCalibrate();

    if (calibratePoints.length === 2) {
      const pixelDistance = calculatePixelDistance(calibratePoints[0], calibratePoints[1]);
      showCalibrateModal(pixelDistance);
    }
  }

  function renderCalibrate() {
    const svg = elements.measureLayer;
    svg.innerHTML = "";

    if (calibratePoints.length > 0) {
      if (calibratePoints.length === 2) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", calibratePoints[0].x + "%");
        line.setAttribute("y1", calibratePoints[0].y + "%");
        line.setAttribute("x2", calibratePoints[1].x + "%");
        line.setAttribute("y2", calibratePoints[1].y + "%");
        line.setAttribute("class", "calibrate-line");
        svg.appendChild(line);
      }

      calibratePoints.forEach((point, index) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", point.x + "%");
        circle.setAttribute("cy", point.y + "%");
        circle.setAttribute("r", "6");
        circle.setAttribute("class", "calibrate-point");
        svg.appendChild(circle);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", point.x + "%");
        text.setAttribute("y", (point.y - 2) + "%");
        text.setAttribute("class", "measure-label");
        text.textContent = index === 0 ? "起点" : "终点";
        svg.appendChild(text);
      });
    } else {
      renderMeasurements();
    }
  }

  function showCalibrateModal(pixelDistance) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal modal-calibrate";

    let html = "<h2>比例尺校准</h2>";
    html += '<div class="calibrate-steps">';
    html += '<div class="calibrate-step"><div class="step-number completed">1</div><div class="step-text done">点击起点</div></div>';
    html += '<div class="calibrate-step"><div class="step-number completed">2</div><div class="step-text done">点击终点</div></div>';
    html += '<div class="calibrate-step"><div class="step-number">3</div><div class="step-text">输入实际距离</div></div>';
    html += "</div>";
    html += '<label>实际距离（米）</label>';
    html += '<input type="number" id="realDistanceInput" step="0.01" min="0.01" placeholder="例如：2.5" autofocus>';
    html += '<div class="muted" style="margin-top:8px">像素距离：' + pixelDistance.toFixed(2) + ' px</div>';
    html += '<div class="toolbar" style="margin-top:16px">';
    html += '<button id="confirmCalibrateBtn">确认校准</button>';
    html += '<button type="button" class="secondary" id="cancelCalibrateBtn">取消</button>';
    html += "</div>";

    modal.innerHTML = html;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    modal.querySelector("#confirmCalibrateBtn").onclick = () => {
      const realDistance = Number(modal.querySelector("#realDistanceInput").value);
      if (!realDistance || realDistance <= 0) {
        showToast("请输入有效的实际距离", "error");
        return;
      }
      const newScale = {
        pixelDistance,
        realDistance,
        unit: "米",
        createdAt: new Date().toISOString(),
      };
      document.body.removeChild(backdrop);
      cancelCalibrating();
      updateScale(newScale);
    };

    modal.querySelector("#cancelCalibrateBtn").onclick = () => {
      document.body.removeChild(backdrop);
      cancelCalibrating();
    };

    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        document.body.removeChild(backdrop);
        cancelCalibrating();
      }
    };
  }

  function updateScale(newScale) {
    scale = newScale;
    updateScaleDisplay();
    if (callbacks.onUpdateScale) {
      callbacks.onUpdateScale(newScale);
    }
  }

  function updateScaleDisplay() {
    if (scale) {
      const ratio = (scale.pixelDistance / scale.realDistance).toFixed(2);
      elements.scaleValue.textContent = ratio + " px/米 (" + scale.realDistance + "米=" + scale.pixelDistance.toFixed(0) + "px)";
    } else {
      elements.scaleValue.textContent = "未校准";
    }
  }

  function startMeasuring() {
    if (!scale) {
      showToast("请先校准比例尺", "error");
      return;
    }
    isMeasuring = true;
    measurePoints = [];
    selectedRelatedMarks = [];
    elements.map.classList.add("measuring");
    elements.measureBtn.textContent = "取消测距";
    elements.measureBtn.classList.remove("secondary");
    switchTab("measure");
    resetMeasureForm();
    elements.measureForm.code.value = "MEAS-" + String(measurements.length + 1).padStart(3, "0");
    if (dives.length > 0) {
      elements.measureForm.dive.value = dives[0].code;
    }
    renderRelatedMarks();
    showToast("点击地图添加测距点，至少需要2个点", "info");
    renderMeasure();
  }

  function cancelMeasuring() {
    isMeasuring = false;
    measurePoints = [];
    selectedRelatedMarks = [];
    elements.map.classList.remove("measuring");
    elements.measureBtn.textContent = "开始测距";
    elements.measureBtn.classList.add("secondary");
    renderMeasure();
  }

  function handleMeasureClick(event) {
    event.stopPropagation();
    const rect = elements.map.getBoundingClientRect();
    const point = {
      x: Number(((event.clientX - rect.left) / rect.width * 100).toFixed(2)),
      y: Number(((event.clientY - rect.top) / rect.height * 100).toFixed(2)),
    };

    measurePoints.push(point);
    renderMeasure();

    if (measurePoints.length >= 2) {
      const length = calculateRealLength(measurePoints);
      elements.measureForm.length.value = length.toFixed(2);
    }
  }

  function renderMeasure() {
    const svg = elements.measureLayer;
    svg.innerHTML = "";

    renderMeasurements();

    if (measurePoints.length > 0) {
      if (measurePoints.length >= 2) {
        const pathData = measurePoints.map((p, i) =>
          (i === 0 ? "M" : "L") + p.x + "%" + p.y + "%"
        ).join(" ");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        path.setAttribute("class", "measure-line");
        svg.appendChild(path);
      }

      measurePoints.forEach((point, index) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", point.x + "%");
        circle.setAttribute("cy", point.y + "%");
        circle.setAttribute("r", "5");
        circle.setAttribute("class", "measure-point");
        svg.appendChild(circle);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", point.x + "%");
        text.setAttribute("y", (point.y - 1.5) + "%");
        text.setAttribute("class", "measure-label");
        text.textContent = "P" + (index + 1);
        svg.appendChild(text);
      });

      if (measurePoints.length >= 2 && scale) {
        const midPoint = calculateMidPoint(measurePoints);
        const length = calculateRealLength(measurePoints);
        const lengthText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        lengthText.setAttribute("x", midPoint.x + "%");
        lengthText.setAttribute("y", (midPoint.y + 2) + "%");
        lengthText.setAttribute("class", "measure-label");
        lengthText.textContent = length.toFixed(2) + " 米";
        svg.appendChild(lengthText);
      }
    }
  }

  function renderMeasurements() {
    const svg = elements.measureLayer;

    measurements.forEach(measurement => {
      if (!measurement.points || measurement.points.length < 2) return;

      const isSelected = measurement.id === currentEditMeasureId;

      const pathData = measurement.points.map((p, i) =>
        (i === 0 ? "M" : "L") + p.x + "%" + p.y + "%"
      ).join(" ");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData);
      path.setAttribute("class", "measure-line-saved");
      if (isSelected) {
        path.setAttribute("stroke", "#ffc107");
        path.setAttribute("stroke-width", "4");
      }
      svg.appendChild(path);

      measurement.points.forEach((point, index) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", point.x + "%");
        circle.setAttribute("cy", point.y + "%");
        circle.setAttribute("r", isSelected ? "6" : "4");
        circle.setAttribute("class", "measure-point-saved");
        if (isSelected) {
          circle.setAttribute("fill", "#ffc107");
        }
        svg.appendChild(circle);
      });

      const midPoint = calculateMidPoint(measurement.points);
      const labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      labelText.setAttribute("x", midPoint.x + "%");
      labelText.setAttribute("y", (midPoint.y + 2) + "%");
      labelText.setAttribute("class", "measure-label");
      labelText.textContent = measurement.code + ": " + Number(measurement.length).toFixed(2) + "m";
      svg.appendChild(labelText);
    });
  }

  function renderGrid() {
    const svg = elements.gridLayer;
    svg.innerHTML = "";

    if (!gridConfig.enabled || !scale) return;

    const rect = elements.map.getBoundingClientRect();
    const metersPerPixel = scale.realDistance / scale.pixelDistance;
    const gridSizePixels = gridConfig.size / metersPerPixel;
    const gridSizePercent = (gridSizePixels / rect.width) * 100;

    const gridSizePercentY = (gridSizePixels / rect.height) * 100;

    for (let x = 0; x <= 100; x += gridSizePercent) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x + "%");
      line.setAttribute("y1", "0%");
      line.setAttribute("x2", x + "%");
      line.setAttribute("y2", "100%");
      line.setAttribute("class", (x % (gridSizePercent * 5) < 0.01 || x === 0) ? "grid-line-major" : "grid-line");
      svg.appendChild(line);

      if (gridConfig.showLabels) {
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", (x + 0.3) + "%");
        label.setAttribute("y", "2%");
        label.setAttribute("class", "grid-label");
        label.textContent = ((x / gridSizePercent) * gridConfig.size).toFixed(1) + "m";
        svg.appendChild(label);
      }
    }

    for (let y = 0; y <= 100; y += gridSizePercentY) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", "0%");
      line.setAttribute("y1", y + "%");
      line.setAttribute("x2", "100%");
      line.setAttribute("y2", y + "%");
      line.setAttribute("class", (y % (gridSizePercentY * 5) < 0.01 || y === 0) ? "grid-line-major" : "grid-line");
      svg.appendChild(line);

      if (gridConfig.showLabels) {
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", "0.3%");
        label.setAttribute("y", (y + 1.5) + "%");
        label.setAttribute("class", "grid-label");
        label.textContent = ((y / gridSizePercentY) * gridConfig.size).toFixed(1) + "m";
        svg.appendChild(label);
      }
    }
  }

  function calculatePixelDistance(p1, p2) {
    const rect = elements.map.getBoundingClientRect();
    const dx = (p2.x - p1.x) * rect.width / 100;
    const dy = (p2.y - p1.y) * rect.height / 100;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function calculateRealLength(points) {
    if (!scale || points.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const pixelDist = calculatePixelDistance(points[i - 1], points[i]);
      total += pixelDist * (scale.realDistance / scale.pixelDistance);
    }
    return total;
  }

  function calculateMidPoint(points) {
    if (points.length === 2) {
      return {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      };
    }
    const midIndex = Math.floor(points.length / 2);
    return points[midIndex];
  }

  function updateMeasureDiveSelect() {
    const diveSelect = elements.measureForm.querySelector('select[name="dive"]');
    diveSelect.innerHTML = '<option value="">请选择潜次</option>';
    dives.forEach(dive => {
      const option = document.createElement("option");
      option.value = dive.code;
      option.textContent = dive.code + " - " + dive.date;
      diveSelect.appendChild(option);
    });
  }

  function renderRelatedMarks() {
    const container = elements.relatedMarksContainer;
    if (marks.length === 0) {
      container.innerHTML = '<div class="muted">暂无标记可关联</div>';
      return;
    }

    container.innerHTML = marks.map(mark => {
      const isSelected = selectedRelatedMarks.includes(mark.id);
      return '<div class="related-mark-item ' + (isSelected ? "selected" : "") + '" data-id="' + mark.id + '">' +
        '<input type="checkbox" ' + (isSelected ? "checked" : "") + '>' +
        '<span class="pill ' + mark.type + '">' + typeNames[mark.type] + '</span>' +
        '<span>' + mark.code + '</span>' +
        '</div>';
    }).join("");

    container.querySelectorAll(".related-mark-item").forEach(item => {
      item.onclick = (e) => {
        e.preventDefault();
        const id = item.dataset.id;
        const checkbox = item.querySelector("input");
        if (selectedRelatedMarks.includes(id)) {
          selectedRelatedMarks = selectedRelatedMarks.filter(mid => mid !== id);
          checkbox.checked = false;
          item.classList.remove("selected");
        } else {
          selectedRelatedMarks.push(id);
          checkbox.checked = true;
          item.classList.add("selected");
        }
      };
    });
  }

  function resetMeasureForm() {
    elements.measureForm.reset();
    elements.measureForm.id.value = "";
    currentEditMeasureId = null;
    measurePoints = [];
    selectedRelatedMarks = [];
    renderRelatedMarks();
    renderMeasure();
  }

  function switchTab(tab) {
    activeTab = tab;
    elements.tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    elements.marksTab.classList.toggle("hidden", tab !== "marks");
    elements.divesTab.classList.toggle("hidden", tab !== "dives");
    elements.measureTab.classList.toggle("hidden", tab !== "measure");
    if (tab === "dives") {
      renderDives();
    } else if (tab === "measure") {
      renderMeasureTab();
    } else {
      render();
    }
  }

  function updateDiveSelect() {
    const diveSelect = elements.form.querySelector('select[name="dive"]');
    diveSelect.innerHTML = '<option value="">请选择潜次</option>';
    dives.forEach(dive => {
      const option = document.createElement("option");
      option.value = dive.code;
      option.textContent = dive.code + " - " + dive.date;
      diveSelect.appendChild(option);
    });
  }

  function updateDiveFilter() {
    elements.diveFilter.innerHTML = '<option value="">全部潜次</option>';
    dives.forEach(dive => {
      const option = document.createElement("option");
      option.value = dive.code;
      option.textContent = dive.code + " - " + dive.date;
      elements.diveFilter.appendChild(option);
    });
  }

  function updateState(newMarks, newDives, newMeasurements, newScale, newGridConfig, newPending, newCurrentEditId, newCurrentEditMeasureId) {
    marks = newMarks;
    dives = newDives;
    measurements = newMeasurements || measurements;
    scale = newScale !== undefined ? newScale : scale;
    gridConfig = newGridConfig || gridConfig;
    pending = newPending;
    currentEditId = newCurrentEditId;
    currentEditMeasureId = newCurrentEditMeasureId !== undefined ? newCurrentEditMeasureId : currentEditMeasureId;

    updateDiveSelect();
    updateDiveFilter();
    updateMeasureDiveSelect();
    updateScaleDisplay();
    renderGrid();

    if (activeTab === "dives") {
      renderDives();
    } else if (activeTab === "measure") {
      renderMeasureTab();
    } else {
      render();
    }
  }

  function render() {
    elements.map.querySelectorAll(".marker").forEach((el) => el.remove());

    let filtered = marks;
    if (elements.filter.value) {
      filtered = filtered.filter((m) => m.type === elements.filter.value);
    }
    if (elements.diveFilter.value) {
      filtered = filtered.filter((m) => m.dive === elements.diveFilter.value);
    }

    const totalVisible = filtered.length;
    const diveInfo = elements.diveFilter.value
      ? " · 潜次: " + elements.diveFilter.value
      : "";
    elements.mapStats.textContent = `显示 ${totalVisible} 个标记` + diveInfo;

    filtered.forEach((mark) => {
      const el = document.createElement("button");
      el.className =
        "marker " + mark.type + (mark.id === currentEditId ? " selected" : "");
      el.style.left = mark.x + "%";
      el.style.top = mark.y + "%";
      el.textContent = mark.code.slice(0, 2);
      el.onclick = (event) => {
        event.stopPropagation();
        edit(mark.id);
      };
      elements.map.appendChild(el);
    });

    if (pending) {
      const pendingEl = document.createElement("button");
      pendingEl.className = "marker unknown selected";
      pendingEl.style.left = pending.x + "%";
      pendingEl.style.top = pending.y + "%";
      pendingEl.textContent = "?";
      pendingEl.onclick = (e) => e.stopPropagation();
      elements.map.appendChild(pendingEl);
    }

    if (elements.view.value === "timeline") {
      renderTimeline(filtered);
    } else {
      renderList(filtered);
    }

    if (!isMeasuring && !isCalibrating) {
      renderMeasurements();
    }
  }

  function renderList(data) {
    elements.listTitle.textContent = "标记列表";
    elements.list.className = "list";
    elements.list.innerHTML = data
      .map(
        (m) =>
          '<div class="item ' +
          (m.id === currentEditId ? "active" : "") +
          '" data-id="' +
          m.id +
          '"><b>' +
          m.code +
          '</b> <span class="pill">' +
          typeNames[m.type] +
          '</span><div class="muted">' +
          m.dive +
          " · " +
          m.depth +
          " · " +
          (m.orientation || "") +
          "</div><div>" +
          (m.condition || "") +
          "</div></div>"
      )
      .join("");
    elements.list.querySelectorAll("[data-id]").forEach((el) => {
      el.onclick = () => edit(el.dataset.id);
    });
  }

  function renderTimeline(data) {
    elements.listTitle.textContent = "潜次时间线";
    elements.list.className = "timeline";
    const groups = data.reduce((map, item) => {
      (map[item.dive] ||= []).push(item);
      return map;
    }, {});
    elements.list.innerHTML = Object.entries(groups)
      .map(
        ([dive, items]) =>
          '<div class="item"><b>' +
          dive +
          '</b><div class="muted">新增' +
          items.length +
          "个标记</div>" +
          items
            .map((i) => "<div>" + i.code + " · " + typeNames[i.type] + "</div>")
            .join("") +
          "</div>"
      )
      .join("");
  }

  function renderDives() {
    renderDiveStats();
    renderDiveList();
  }

  function renderDiveStats() {
    const totalDives = dives.length;
    const totalMarks = marks.length;
    const avgMarksPerDive = totalDives > 0 ? (totalMarks / totalDives).toFixed(1) : 0;

    const typeCounts = marks.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    }, {});

    let statsHtml = '<div class="stats-grid">';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + totalDives + '</div><div class="stat-label">潜次总数</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + totalMarks + '</div><div class="stat-label">标记总数</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + avgMarksPerDive + '</div><div class="stat-label">平均每潜次</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + Object.keys(typeCounts).length + '</div><div class="stat-label">类型数</div></div>';
    statsHtml += '</div>';

    elements.diveStats.innerHTML = statsHtml;
  }

  function renderDiveList() {
    elements.diveList.innerHTML = dives
      .map(
        (d) =>
          '<div class="dive-item ' +
          (d.id === currentEditDiveId ? "active" : "") +
          '" data-id="' +
          d.id +
          '"><div class="dive-item-header"><b>' +
          d.code +
          '</b> <span class="muted">' +
          d.date +
          '</span></div><div class="dive-item-info"><span class="pill">' +
          weatherNames[d.weather] +
          '</span> <span class="pill">' +
          currentNames[d.current] +
          '</span> <span class="muted">能见度: ' +
          d.visibility +
          '</span></div><div class="dive-item-meta"><span>负责人: ' +
          d.leader +
          '</span> <span class="muted">标记: ' +
          marks.filter(m => m.dive === d.code).length +
          '个</span></div><div class="dive-item-actions"><button type="button" class="secondary" data-action="edit" data-id="' +
          d.id +
          '">编辑</button><button type="button" class="secondary" data-action="detail" data-id="' +
          d.id +
          '">详情</button></div></div>'
      )
      .join("");

    elements.diveList.querySelectorAll("[data-action]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === "edit") {
          editDive(id);
        } else if (action === "detail") {
          showDiveDetail(id);
        }
      };
    });

    elements.diveList.querySelectorAll(".dive-item").forEach((el) => {
      el.onclick = (e) => {
        if (!e.target.closest("[data-action]")) {
          showDiveDetail(el.dataset.id);
        }
      };
    });
  }

  function showDiveDetail(id) {
    const dive = dives.find((d) => d.id === id);
    if (!dive) return;

    const diveMarks = marks.filter(m => m.dive === dive.code);

    let detailHtml = '<div class="detail-section">';
    detailHtml += '<h3>基本信息</h3>';
    detailHtml += '<div class="detail-grid">';
    detailHtml += '<div><span class="muted">潜次编号</span><div><b>' + dive.code + '</b></div></div>';
    detailHtml += '<div><span class="muted">下潜日期</span><div>' + dive.date + '</div></div>';
    detailHtml += '<div><span class="muted">负责人</span><div>' + dive.leader + '</div></div>';
    detailHtml += '<div><span class="muted">天气</span><div>' + weatherNames[dive.weather] + '</div></div>';
    detailHtml += '<div><span class="muted">水流</span><div>' + currentNames[dive.current] + '</div></div>';
    detailHtml += '<div><span class="muted">能见度</span><div>' + dive.visibility + '</div></div>';
    detailHtml += '</div>';
    detailHtml += '</div>';

    detailHtml += '<div class="detail-section">';
    detailHtml += '<h3>任务目标</h3>';
    detailHtml += '<div class="objective-text">' + dive.objective + '</div>';
    detailHtml += '</div>';

    detailHtml += '<div class="detail-section">';
    detailHtml += '<h3>关联标记 (' + diveMarks.length + '个)</h3>';
    if (diveMarks.length > 0) {
      detailHtml += '<div class="marks-in-dive">';
      diveMarks.forEach(m => {
        detailHtml += '<div class="mark-in-dive"><span class="pill ' + m.type + '">' + typeNames[m.type] + '</span> <b>' + m.code + '</b> · ' + m.depth + ' · ' + (m.condition || '');
        detailHtml += '</div>';
      });
      detailHtml += '</div>';
    } else {
      detailHtml += '<div class="muted">该潜次暂无关联标记</div>';
    }
    detailHtml += '</div>';

    elements.diveDetailContent.innerHTML = detailHtml;
    elements.diveDetail.classList.remove("hidden");
  }

  function renderMeasureTab() {
    renderMeasureStats();
    renderMeasureList();
    renderMeasure();
    renderGrid();
  }

  function renderMeasureStats() {
    const totalMeasurements = measurements.length;
    const totalLength = measurements.reduce((sum, m) => sum + Number(m.length || 0), 0);
    const totalDivesUsed = new Set(measurements.map(m => m.dive)).size;

    let statsHtml = '<div class="stats-grid">';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + totalMeasurements + '</div><div class="stat-label">测距总数</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + totalLength.toFixed(1) + '</div><div class="stat-label">总长度(米)</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + totalDivesUsed + '</div><div class="stat-label">涉及潜次</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + (scale ? "已校准" : "未校准") + '</div><div class="stat-label">比例尺</div></div>';
    statsHtml += '</div>';

    elements.measureStats.innerHTML = statsHtml;
  }

  function renderMeasureList() {
    if (measurements.length === 0) {
      elements.measureList.innerHTML = '<div class="muted" style="padding:20px;text-align:center;">暂无测距记录，点击"开始测距"按钮添加</div>';
      return;
    }

    elements.measureList.innerHTML = measurements
      .map(
        (m) =>
          '<div class="measure-item ' +
          (m.id === currentEditMeasureId ? "active" : "") +
          '" data-id="' +
          m.id +
          '"><div class="measure-item-header"><b>' +
          m.code +
          '</b> <span class="pill pill-measure">' +
          Number(m.length).toFixed(2) + ' 米' +
          '</span></div><div class="measure-item-info"><span class="muted">' +
          m.dive +
          '</span> · <span class="muted">' +
          (m.points ? m.points.length : 0) + ' 个点' +
          '</span> · <span class="muted">关联' +
          (m.relatedMarks ? m.relatedMarks.length : 0) + '个标记' +
          '</span></div><div class="measure-item-meta">' +
          (m.note || "无备注") +
          '</div><div class="measure-item-actions"><button type="button" class="secondary" data-action="edit" data-id="' +
          m.id +
          '">编辑</button><button type="button" class="secondary danger" data-action="delete" data-id="' +
          m.id +
          '">删除</button></div></div>'
      )
      .join("");

    elements.measureList.querySelectorAll("[data-action]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === "edit") {
          editMeasurement(id);
        } else if (action === "delete") {
          if (confirm("确定要删除这条测距记录吗？")) {
            const event = new CustomEvent('deleteMeasurement', { detail: { id } });
            document.dispatchEvent(event);
          }
        }
      };
    });

    elements.measureList.querySelectorAll(".measure-item").forEach((el) => {
      el.onclick = (e) => {
        if (!e.target.closest("[data-action]")) {
          editMeasurement(el.dataset.id);
        }
      };
    });
  }

  function editMeasurement(id) {
    const measurement = measurements.find((m) => m.id === id);
    if (!measurement) return;

    cancelMeasuring();
    currentEditMeasureId = id;
    measurePoints = measurement.points ? [...measurement.points] : [];
    selectedRelatedMarks = measurement.relatedMarks ? [...measurement.relatedMarks] : [];

    elements.measureForm.id.value = measurement.id;
    elements.measureForm.code.value = measurement.code;
    elements.measureForm.dive.value = measurement.dive;
    elements.measureForm.length.value = Number(measurement.length).toFixed(2);
    elements.measureForm.note.value = measurement.note || "";

    renderRelatedMarks();
    renderMeasureTab();
  }

  function edit(id) {
    const mark = marks.find((m) => m.id === id);
    if (!mark) return;
    for (const [key, value] of Object.entries(mark)) {
      if (elements.form[key]) elements.form[key].value = value;
    }
    pending = { x: mark.x, y: mark.y };
    currentEditId = id;
    render();
  }

  function editDive(id) {
    const dive = dives.find((d) => d.id === id);
    if (!dive) return;
    for (const [key, value] of Object.entries(dive)) {
      if (elements.diveForm[key]) elements.diveForm[key].value = value;
    }
    currentEditDiveId = id;
    renderDives();
  }

  function resetForm() {
    elements.form.reset();
    elements.form.id.value = "";
    currentEditId = null;
    pending = null;
  }

  function resetDiveForm() {
    elements.diveForm.reset();
    elements.diveForm.id.value = "";
    currentEditDiveId = null;
    elements.diveDetail.classList.add("hidden");
  }

  function showImportPreview(comparison, onConfirm, onCancel) {
    const isFullFormat = comparison.isFullFormat;
    const isFullFormatV3 = comparison.isFullFormatV3;
    const markComparison = comparison.marks;
    const diveComparison = comparison.dives;
    const measurementComparison = comparison.measurements;

    const markResolutions = (markComparison?.conflicts || []).map(() => "keep");
    const diveResolutions = (diveComparison?.conflicts || []).map(() => "keep");
    const measurementResolutions = (measurementComparison?.conflicts || []).map(() => "keep");

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal";

    let html = "<h2>导入预览</h2>";

    if (isFullFormatV3) {
      html += '<div class="summary-bar">';
      html += '<span class="pill">完整数据格式 (v' + comparison.version + ')</span>';
      html += "</div>";
    } else if (isFullFormat) {
      html += '<div class="summary-bar">';
      html += '<span class="pill">完整数据格式 (v' + comparison.version + ')</span>';
      html += "</div>";
    }

    if (diveComparison) {
      html += '<div class="preview-section">';
      html += '<h3>潜次档案</h3>';
      html += '<div class="summary-bar">';
      html += '<span class="pill">共 ' + diveComparison.summary.total + " 项</span>";
      html += '<span class="pill pill-new">新增 ' + diveComparison.summary.new + " 项</span>";
      html += '<span class="pill pill-conflict">冲突 ' + diveComparison.summary.conflict + " 项</span>";
      html += '<span class="pill pill-error">错误 ' + diveComparison.summary.error + " 项</span>";
      html += "</div>";

      if (diveComparison.newDives.length > 0) {
        html += '<div class="preview-list">';
        diveComparison.newDives.forEach((dive) => {
          html +=
            '<div class="preview-item"><span><b>' +
            dive.code +
            "</b> " +
            dive.date +
            ' · ' +
            dive.leader +
            " · " +
            weatherNames[dive.weather] +
            "</span><span class='pill pill-new'>新增</span></div>";
        });
        html += "</div>";
      }

      if (diveComparison.conflicts.length > 0) {
        html += '<div class="toolbar-3">';
        html += '<button type="button" class="secondary" data-bulk-dive="keep">全部保留本地</button>';
        html += '<button type="button" class="secondary" data-bulk-dive="overwrite">全部覆盖本地</button>';
        html += '<button type="button" class="secondary" data-bulk-dive="saveas">全部另存新编号</button>';
        html += "</div>";
        html += '<div class="preview-list">';
        diveComparison.conflicts.forEach((conflict, idx) => {
          html +=
            '<div class="preview-item" data-dive-conflict-index="' +
            idx +
            '"><span><b>' +
            conflict.imported.code +
            "</b> " +
            conflict.imported.date +
            ' · ' +
            conflict.imported.leader +
            "</span>";
          html += '<select data-dive-resolution-index="' + idx + '">';
          html += '<option value="keep">保留本地</option>';
          html += '<option value="overwrite">覆盖本地</option>';
          html += '<option value="saveas">另存为新编号</option>';
          html += "</select></div>";
        });
        html += "</div>";
      }

      if (diveComparison.errors.length > 0) {
        html += '<div class="preview-list">';
        diveComparison.errors.forEach((err) => {
          const code = err.dive && err.dive.code ? err.dive.code : "第 " + (err.index + 1) + " 项";
          html +=
            '<div class="preview-item"><span><b>' +
            code +
            "</b></span><span class='muted'>" +
            err.errors.join("; ") +
            "</span></div>";
        });
        html += "</div>";
      }
      html += "</div>";
    }

    if (markComparison) {
      html += '<div class="preview-section">';
      html += '<h3>标记数据</h3>';
      html += '<div class="summary-bar">';
      html += '<span class="pill">共 ' + markComparison.summary.total + " 项</span>";
      html += '<span class="pill pill-new">新增 ' + markComparison.summary.new + " 项</span>";
      html += '<span class="pill pill-conflict">冲突 ' + markComparison.summary.conflict + " 项</span>";
      html += '<span class="pill pill-error">错误 ' + markComparison.summary.error + " 项</span>";
      html += "</div>";

      if (markComparison.newMarks.length > 0) {
        html += '<div class="preview-list">';
        markComparison.newMarks.forEach((mark) => {
          html +=
            '<div class="preview-item"><span><b>' +
            mark.code +
            "</b> " +
            typeNames[mark.type] +
            ' · ' +
            mark.dive +
            " · " +
            mark.depth +
            "</span><span class='pill pill-new'>新增</span></div>";
        });
        html += "</div>";
      }

      if (markComparison.conflicts.length > 0) {
        html += '<div class="toolbar-3">';
        html += '<button type="button" class="secondary" data-bulk-mark="keep">全部保留本地</button>';
        html += '<button type="button" class="secondary" data-bulk-mark="overwrite">全部覆盖本地</button>';
        html += '<button type="button" class="secondary" data-bulk-mark="saveas">全部另存新编号</button>';
        html += "</div>";
        html += '<div class="preview-list">';
        markComparison.conflicts.forEach((conflict, idx) => {
          html +=
            '<div class="preview-item" data-mark-conflict-index="' +
            idx +
            '"><span><b>' +
            conflict.imported.code +
            "</b> " +
            typeNames[conflict.imported.type] +
            ' · ' +
            conflict.imported.dive +
            "</span>";
          html += '<select data-mark-resolution-index="' + idx + '">';
          html += '<option value="keep">保留本地</option>';
          html += '<option value="overwrite">覆盖本地</option>';
          html += '<option value="saveas">另存为新编号</option>';
          html += "</select></div>";
        });
        html += "</div>";
      }

      if (markComparison.errors.length > 0) {
        html += '<div class="preview-list">';
        markComparison.errors.forEach((err) => {
          const code = err.mark && err.mark.code ? err.mark.code : "第 " + (err.index + 1) + " 项";
          html +=
            '<div class="preview-item"><span><b>' +
            code +
            "</b></span><span class='muted'>" +
            err.errors.join("; ") +
            "</span></div>";
        });
        html += "</div>";
      }
      html += "</div>";
    }

    if (measurementComparison) {
      html += '<div class="preview-section">';
      html += '<h3>测距记录</h3>';
      html += '<div class="summary-bar">';
      html += '<span class="pill">共 ' + measurementComparison.summary.total + " 项</span>";
      html += '<span class="pill pill-new">新增 ' + measurementComparison.summary.new + " 项</span>";
      html += '<span class="pill pill-conflict">冲突 ' + measurementComparison.summary.conflict + " 项</span>";
      html += '<span class="pill pill-error">错误 ' + measurementComparison.summary.error + " 项</span>";
      html += "</div>";

      if (measurementComparison.newMeasurements.length > 0) {
        html += '<div class="preview-list">';
        measurementComparison.newMeasurements.forEach((measurement) => {
          html +=
            '<div class="preview-item"><span><b>' +
            measurement.code +
            "</b> " +
            measurement.dive +
            ' · ' +
            Number(measurement.length).toFixed(2) + "米" +
            ' · ' +
            (measurement.points ? measurement.points.length : 0) + '个点' +
            "</span><span class='pill pill-new'>新增</span></div>";
        });
        html += "</div>";
      }

      if (measurementComparison.conflicts.length > 0) {
        html += '<div class="toolbar-3">';
        html += '<button type="button" class="secondary" data-bulk-measurement="keep">全部保留本地</button>';
        html += '<button type="button" class="secondary" data-bulk-measurement="overwrite">全部覆盖本地</button>';
        html += '<button type="button" class="secondary" data-bulk-measurement="saveas">全部另存新编号</button>';
        html += "</div>";
        html += '<div class="preview-list">';
        measurementComparison.conflicts.forEach((conflict, idx) => {
          html +=
            '<div class="preview-item" data-measurement-conflict-index="' +
            idx +
            '"><span><b>' +
            conflict.imported.code +
            "</b> " +
            conflict.imported.dive +
            ' · ' +
            Number(conflict.imported.length).toFixed(2) + "米" +
            "</span>";
          html += '<select data-measurement-resolution-index="' + idx + '">';
          html += '<option value="keep">保留本地</option>';
          html += '<option value="overwrite">覆盖本地</option>';
          html += '<option value="saveas">另存为新编号</option>';
          html += "</select></div>";
        });
        html += "</div>";
      }

      if (measurementComparison.errors.length > 0) {
        html += '<div class="preview-list">';
        measurementComparison.errors.forEach((err) => {
          const code = err.measurement && err.measurement.code ? err.measurement.code : "第 " + (err.index + 1) + " 项";
          html +=
            '<div class="preview-item"><span><b>' +
            code +
            "</b></span><span class='muted'>" +
            err.errors.join("; ") +
            "</span></div>";
        });
        html += "</div>";
      }
      html += "</div>";
    }

    html += '<div class="toolbar">';
    html += '<button type="button" id="confirmImportBtn">确认导入</button>';
    html += '<button type="button" class="secondary" id="cancelImportBtn">取消</button>';
    html += "</div>";

    modal.innerHTML = html;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    modal.querySelectorAll("[data-mark-resolution-index]").forEach((select) => {
      select.onchange = (e) => {
        const idx = parseInt(e.target.dataset.markResolutionIndex);
        markResolutions[idx] = e.target.value;
      };
    });

    modal.querySelectorAll("[data-dive-resolution-index]").forEach((select) => {
      select.onchange = (e) => {
        const idx = parseInt(e.target.dataset.diveResolutionIndex);
        diveResolutions[idx] = e.target.value;
      };
    });

    modal.querySelectorAll("[data-measurement-resolution-index]").forEach((select) => {
      select.onchange = (e) => {
        const idx = parseInt(e.target.dataset.measurementResolutionIndex);
        measurementResolutions[idx] = e.target.value;
      };
    });

    modal.querySelectorAll("[data-bulk-mark]").forEach((btn) => {
      btn.onclick = (e) => {
        const action = e.target.dataset.bulkMark;
        (markComparison?.conflicts || []).forEach((_, idx) => {
          markResolutions[idx] = action;
          const select = modal.querySelector(
            '[data-mark-resolution-index="' + idx + '"]'
          );
          if (select) select.value = action;
        });
      };
    });

    modal.querySelectorAll("[data-bulk-dive]").forEach((btn) => {
      btn.onclick = (e) => {
        const action = e.target.dataset.bulkDive;
        (diveComparison?.conflicts || []).forEach((_, idx) => {
          diveResolutions[idx] = action;
          const select = modal.querySelector(
            '[data-dive-resolution-index="' + idx + '"]'
          );
          if (select) select.value = action;
        });
      };
    });

    modal.querySelectorAll("[data-bulk-measurement]").forEach((btn) => {
      btn.onclick = (e) => {
        const action = e.target.dataset.bulkMeasurement;
        (measurementComparison?.conflicts || []).forEach((_, idx) => {
          measurementResolutions[idx] = action;
          const select = modal.querySelector(
            '[data-measurement-resolution-index="' + idx + '"]'
          );
          if (select) select.value = action;
        });
      };
    });

    modal.querySelector("#confirmImportBtn").onclick = () => {
      document.body.removeChild(backdrop);
      onConfirm({ markResolutions, diveResolutions, measurementResolutions });
    };

    modal.querySelector("#cancelImportBtn").onclick = () => {
      document.body.removeChild(backdrop);
      onCancel();
    };

    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        document.body.removeChild(backdrop);
        onCancel();
      }
    };
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.style.cssText =
      "position:fixed;top:24px;right:24px;padding:12px 20px;background:#1d6c78;color:#fff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.3);z-index:2000;animation:slideIn .3s ease;";
    if (type === "error") toast.style.background = "#c0392b";
    if (type === "success") toast.style.background = "#28a745";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "slideOut .3s ease forwards";
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 2500);
  }

  return {
    init,
    updateState,
    render,
    renderDives,
    renderMeasureTab,
    edit,
    editDive,
    editMeasurement,
    resetForm,
    resetDiveForm,
    resetMeasureForm,
    showImportPreview,
    showToast,
    switchTab,
    typeNames,
    weatherNames,
    currentNames,
  };
})();
