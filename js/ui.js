const UI = (() => {
  const typeNames = { ceramic: "陶片", wood: "木构件", metal: "金属件", unknown: "未知物" };
  const weatherNames = { sunny: "晴", cloudy: "多云", rainy: "雨", windy: "大风", foggy: "雾" };
  const currentNames = { calm: "无流", weak: "弱流", moderate: "中流", strong: "强流" };
  const angleNames = { top: "俯视", side: "侧视", front: "正视", back: "后视", detail: "细节", overview: "全景", other: "其他" };
  const reviewStatusNames = { collected: "采集", pending: "待复核", confirmed: "已确认", revisit: "需返潜" };
  const REVIEW_STATUSES = ["collected", "pending", "confirmed", "revisit"];

  let elements = {};
  let marks = [];
  let dives = [];
  let measurements = [];
  let scale = null;
  let gridConfig = { enabled: false, size: 1, showLabels: true };
  let baseMap = null;
  let pending = null;
  let currentEditId = null;
  let currentEditDiveId = null;
  let currentEditMeasureId = null;
  let currentAttachments = [];
  let currentParticipants = [];
  let activeTab = "marks";

  let callbacks = {};
  let isCalibrating = false;
  let calibratePoints = [];
  let isMeasuring = false;
  let measurePoints = [];
  let selectedRelatedMarks = [];
  let importErrors = [];
  let currentProject = null;
  let remeasureOriginal = null;
  let views = [];
  let revisitPlan = [];
  let selectedRevisitTasks = new Set();

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function init(deps) {
    elements = {
      map: document.querySelector("#map"),
      form: document.querySelector("#form"),
      list: document.querySelector("#list"),
      filter: document.querySelector("#filter"),
      diveFilter: document.querySelector("#diveFilter"),
      reviewFilter: document.querySelector("#reviewFilter"),
      view: document.querySelector("#view"),
      listTitle: document.querySelector("#listTitle"),
      exportBtn: document.querySelector("#exportBtn"),
      exportOfflineBtn: document.querySelector("#exportOfflineBtn"),
      importBtn: document.querySelector("#importBtn"),
      importCSVBtn: document.querySelector("#importCSVBtn"),
      deleteBtn: document.querySelector("#deleteBtn"),
      mapStats: document.querySelector("#mapStats"),
      tabs: document.querySelectorAll(".tab"),
      marksTab: document.querySelector("#marksTab"),
      reviewTab: document.querySelector("#reviewTab"),
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
      addAttachmentBtn: document.querySelector("#addAttachmentBtn"),
      attachmentsList: document.querySelector("#attachmentsList"),
      attachmentsEmpty: document.querySelector("#attachmentsEmpty"),
      storageInfo: document.querySelector("#storageInfo"),
      reviewStats: document.querySelector("#reviewStats"),
      reviewDiveFilter: document.querySelector("#reviewDiveFilter"),
      reviewTypeFilter: document.querySelector("#reviewTypeFilter"),
      reviewBoard: document.querySelector("#reviewBoard"),
      cardsCollected: document.querySelector("#cards-collected"),
      cardsPending: document.querySelector("#cards-pending"),
      cardsConfirmed: document.querySelector("#cards-confirmed"),
      cardsRevisit: document.querySelector("#cards-revisit"),
      countCollected: document.querySelector("#count-collected"),
      countPending: document.querySelector("#count-pending"),
      countConfirmed: document.querySelector("#count-confirmed"),
      countRevisit: document.querySelector("#count-revisit"),
      reviewDetail: document.querySelector("#reviewDetail"),
      reviewDetailTitle: document.querySelector("#reviewDetailTitle"),
      reviewDetailContent: document.querySelector("#reviewDetailContent"),
      closeReviewDetail: document.querySelector("#closeReviewDetail"),
      revisitTab: document.querySelector("#revisitTab"),
      revisitStats: document.querySelector("#revisitStats"),
      revisitDiveFilter: document.querySelector("#revisitDiveFilter"),
      revisitTypeFilter: document.querySelector("#revisitTypeFilter"),
      revisitTaskList: document.querySelector("#revisitTaskList"),
      createDiveFromPlanBtn: document.querySelector("#createDiveFromPlanBtn"),
      refreshRevisitPlanBtn: document.querySelector("#refreshRevisitPlanBtn"),
      heatmapBtn: document.querySelector("#heatmapBtn"),
      heatmapControls: document.querySelector("#heatmapControls"),
      heatmapFilter: document.querySelector("#heatmapFilter"),
      heatmapOpacity: document.querySelector("#heatmapOpacity"),
      heatmapOpacityValue: document.querySelector("#heatmapOpacityValue"),
      heatmapLegendBar: document.querySelector("#heatmapLegendBar"),
      heatmapEmptyTip: document.querySelector("#heatmapEmptyTip"),
      baseMapBtn: document.querySelector("#baseMapBtn"),
      baseMapImage: document.querySelector("#baseMapImage"),
      wreckEl: document.querySelector(".wreck"),
      reportBtn: document.querySelector("#reportBtn"),
      projectSelect: document.querySelector("#projectSelect"),
      manageProjectBtn: document.querySelector("#manageProjectBtn"),
      addParticipantBtn: document.querySelector("#addParticipantBtn"),
      participantsList: document.querySelector("#participantsList"),
      participantsEmpty: document.querySelector("#participantsEmpty"),
      viewSelector: document.querySelector("#viewSelector"),
      saveViewBtn: document.querySelector("#saveViewBtn"),
      manageViewsBtn: document.querySelector("#manageViewsBtn"),
    };

    marks = deps.marks;
    dives = deps.dives;
    measurements = deps.measurements || [];
    scale = deps.scale || null;
    gridConfig = deps.gridConfig || { enabled: false, size: 1, showLabels: true };
    baseMap = deps.baseMap || null;
    pending = deps.pending;
    currentEditId = deps.currentEditId;
    importErrors = deps.importErrors || [];
    currentProject = deps.currentProject || null;
    views = deps.views || [];
    revisitPlan = deps.revisitPlan || [];

    if (gridConfig.size) {
      elements.gridSize.value = gridConfig.size;
    }
    if (gridConfig.showLabels !== undefined) {
      elements.showGridLabels.checked = gridConfig.showLabels;
    }

    callbacks = deps.callbacks;

    if (callbacks && typeof callbacks.onImportErrorsUpdate !== "function") {
      callbacks.onImportErrorsUpdate = (errors) => {
        importErrors = errors || [];
      };
    }

    initRibs();
    initBaseMap();
    renderBaseMap();
    bindEvents(callbacks);
    updateProjectSelector();
    updateDiveSelect();
    updateDiveFilter();
    updateReviewDiveFilter();
    updateScaleDisplay();
    updateMeasureDiveSelect();
    renderGrid();
    renderAttachments();
    renderStorageInfo();
    Heatmap.init();
    if (elements.heatmapLegendBar) {
      elements.heatmapLegendBar.style.background = Heatmap.getGradientCSS();
    }
    updateHeatmapDiveFilter();
    updateHeatmapConditionFilter();
    updateViewSelector(views);
    updateRevisitDiveFilter();
  }

  function initRibs() {
    for (let i = 0; i < 7; i++) {
      const rib = document.createElement("div");
      rib.className = "rib";
      rib.style.left = 28 + i * 7 + "%";
      elements.map.appendChild(rib);
    }
  }

  function initBaseMap() {
    const existingImg = elements.map.querySelector("#baseMapImage");
    if (existingImg) {
      elements.baseMapImage = existingImg;
    } else {
      const baseMapImg = document.createElement("img");
      baseMapImg.id = "baseMapImage";
      baseMapImg.className = "basemap-image";
      baseMapImg.alt = "沉船平面图底图";
      elements.map.insertBefore(baseMapImg, elements.map.firstChild);
      elements.baseMapImage = baseMapImg;
    }

    const toolbar = document.querySelector(".map-toolbar");
    if (toolbar) {
      const existingBtn = toolbar.querySelector("#baseMapBtn");
      if (existingBtn) {
        elements.baseMapBtn = existingBtn;
      } else {
        const divider = document.createElement("div");
        divider.className = "toolbar-divider";
        toolbar.appendChild(divider);

        const baseMapBtn = document.createElement("button");
        baseMapBtn.type = "button";
        baseMapBtn.id = "baseMapBtn";
        baseMapBtn.className = "secondary";
        baseMapBtn.textContent = "底图设置";
        toolbar.appendChild(baseMapBtn);
        elements.baseMapBtn = baseMapBtn;
      }
    }
  }

  function renderBaseMap() {
    if (!elements.baseMapImage) return;

    if (baseMap && baseMap.imageData) {
      elements.baseMapImage.src = baseMap.imageData;
      elements.baseMapImage.style.display = "block";
      if (elements.wreckEl) {
        elements.wreckEl.style.display = "none";
      }
      document.querySelectorAll(".rib").forEach(rib => {
        rib.style.display = "none";
      });
      elements.map.classList.add("has-custom-basemap");
    } else {
      elements.baseMapImage.removeAttribute("src");
      elements.baseMapImage.style.display = "none";
      if (elements.wreckEl) {
        elements.wreckEl.style.display = "block";
      }
      document.querySelectorAll(".rib").forEach(rib => {
        rib.style.display = "block";
      });
      elements.map.classList.remove("has-custom-basemap");
    }
  }

  async function handleBaseMapUpload() {
    try {
      const file = await DataIO.triggerImageInput();
      const processed = await DataIO.processImageFile(file);

      const newBaseMap = {
        id: crypto.randomUUID(),
        name: file.name,
        imageData: processed.fullImage,
        width: processed.width,
        height: processed.height,
        uploadedAt: new Date().toISOString(),
      };

      if (callbacks && callbacks.onUpdateBaseMap) {
        callbacks.onUpdateBaseMap(newBaseMap);
      }
    } catch (e) {
      if (e.message !== "No file selected" && e.message !== "File selection cancelled") {
        showToast("底图上传失败: " + e.message, "error");
      }
    }
  }

  function handleBaseMapReset() {
    if (confirm("确定要重置为默认沉船示意图吗？")) {
      if (callbacks && callbacks.onUpdateBaseMap) {
        callbacks.onUpdateBaseMap(null);
      }
    }
  }

  function showBaseMapModal() {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal modal-basemap";

    let baseMapInfo = "";
    if (baseMap) {
      const sizeKB = (new Blob([baseMap.imageData]).size / 1024).toFixed(1);
      baseMapInfo = `
        <div class="basemap-preview">
          <img src="${baseMap.imageData}" alt="当前底图预览">
        </div>
        <div class="basemap-details">
          <div class="muted">文件名：${escapeHtml(baseMap.name || "未命名")}</div>
          <div class="muted">尺寸：${baseMap.width || "?"} × ${baseMap.height || "?"} 像素</div>
          <div class="muted">大小：${sizeKB} KB</div>
          <div class="muted">上传时间：${baseMap.uploadedAt ? new Date(baseMap.uploadedAt).toLocaleString("zh-CN") : "未知"}</div>
        </div>
      `;
    } else {
      baseMapInfo = `
        <div class="basemap-preview basemap-preview-default">
          <div class="basemap-default-hint">当前使用默认沉船示意图</div>
        </div>
        <div class="basemap-details">
          <div class="muted">使用 CSS 绘制的默认沉船平面示意图作为底图</div>
          <div class="muted">您可以上传自定义的沉船平面图图片作为底图</div>
        </div>
      `;
    }

    modal.innerHTML = `
      <h2>底图设置</h2>
      <div class="basemap-modal-content">
        ${baseMapInfo}
      </div>
      <div class="basemap-modal-actions">
        <button id="basemapUploadBtn" class="secondary">上传图片</button>
        ${baseMap ? '<button id="basemapResetBtn" class="danger">重置为默认</button>' : ''}
        <button id="basemapCloseBtn" class="secondary">关闭</button>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        document.body.removeChild(backdrop);
      }
    };

    const uploadBtn = modal.querySelector("#basemapUploadBtn");
    if (uploadBtn) {
      uploadBtn.onclick = async () => {
        try {
          const file = await DataIO.triggerImageInput();
          const processed = await DataIO.processImageFile(file);

          const newBaseMap = {
            id: crypto.randomUUID(),
            name: file.name,
            imageData: processed.fullImage,
            width: processed.width,
            height: processed.height,
            uploadedAt: new Date().toISOString(),
          };

          if (callbacks && callbacks.onUpdateBaseMap) {
            callbacks.onUpdateBaseMap(newBaseMap);
          }

          document.body.removeChild(backdrop);
          showToast("底图上传成功", "success");
        } catch (e) {
          if (e.message !== "No file selected" && e.message !== "File selection cancelled") {
            showToast("底图上传失败: " + e.message, "error");
          }
        }
      };
    }

    const resetBtn = modal.querySelector("#basemapResetBtn");
    if (resetBtn) {
      resetBtn.onclick = () => {
        if (confirm("确定要重置为默认沉船示意图吗？")) {
          if (callbacks && callbacks.onUpdateBaseMap) {
            callbacks.onUpdateBaseMap(null);
          }
          document.body.removeChild(backdrop);
        }
      };
    }

    const closeBtn = modal.querySelector("#basemapCloseBtn");
    if (closeBtn) {
      closeBtn.onclick = () => {
        document.body.removeChild(backdrop);
      };
    }
  }

  function bindEvents(callbacks) {
    elements.map.addEventListener("click", (event) => {
      if (event.target.closest(".heatmap-controls")) return;
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
      currentAttachments = [];
      elements.form.code.value = "M-" + String(marks.length + 1).padStart(3, "0");
      if (dives.length > 0) {
        elements.form.dive.value = dives[0].code;
      }
      renderAttachments();
      renderStorageInfo();
      render();
    });

    elements.form.onsubmit = (event) => {
      event.preventDefault();
      if (!pending) pending = { x: 50, y: 50 };
      const data = Object.fromEntries(new FormData(elements.form).entries());
      data.attachments = getCurrentAttachments();
      callbacks.onSaveMark(data, pending);
    };

    elements.diveForm.onsubmit = (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(elements.diveForm).entries());
      data.participants = getCurrentParticipants();
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

    if (elements.exportOfflineBtn) {
      elements.exportOfflineBtn.onclick = () => {
        if (callbacks.onExportOfflineMerge) {
          callbacks.onExportOfflineMerge();
        }
      };
    }

    elements.importBtn.onclick = () => {
      callbacks.onImport();
    };

    if (elements.importCSVBtn) {
      elements.importCSVBtn.onclick = () => {
        if (callbacks.onImportCSV) {
          callbacks.onImportCSV();
        }
      };
    }

    if (elements.reportBtn) {
      elements.reportBtn.onclick = () => {
        showReportModal();
      };
    }

    if (elements.projectSelect) {
      elements.projectSelect.onchange = () => {
        const projectId = elements.projectSelect.value;
        if (projectId && callbacks.onSwitchProject) {
          callbacks.onSwitchProject(projectId);
        }
      };
    }

    if (elements.manageProjectBtn) {
      elements.manageProjectBtn.onclick = () => {
        showProjectManagerModal();
      };
    }

    elements.addAttachmentBtn.onclick = handleAddAttachment;

    elements.addParticipantBtn.onclick = handleAddParticipant;

    elements.filter.onchange = () => { render(); renderHeatmap(); updateViewSelectorValue(); };
    elements.diveFilter.onchange = () => { render(); renderHeatmap(); updateViewSelectorValue(); };
    elements.reviewFilter.onchange = () => { render(); renderHeatmap(); updateViewSelectorValue(); };
    elements.view.onchange = () => { render(); updateViewSelectorValue(); };

    if (elements.viewSelector) {
      elements.viewSelector.onchange = () => {
        const viewId = elements.viewSelector.value;
        if (viewId && callbacks.onApplyView) {
          callbacks.onApplyView(viewId);
        }
      };
    }
    if (elements.saveViewBtn) {
      elements.saveViewBtn.onclick = () => {
        showSaveViewModal();
      };
    }
    if (elements.manageViewsBtn) {
      elements.manageViewsBtn.onclick = () => {
        showManageViewsModal();
      };
    }

    if (elements.heatmapBtn) {
      elements.heatmapBtn.onclick = toggleHeatmap;
    }
    if (elements.baseMapBtn) {
      elements.baseMapBtn.onclick = showBaseMapModal;
    }
    if (elements.heatmapFilter) {
      elements.heatmapFilter.onchange = () => {
        Heatmap.setState({ filterMode: elements.heatmapFilter.value });
        renderHeatmap();
        updateViewSelectorValue();
      };
    }
    if (elements.heatmapOpacity) {
      elements.heatmapOpacity.oninput = () => {
        const val = Number(elements.heatmapOpacity.value);
        Heatmap.setState({ opacity: val / 100 });
        if (elements.heatmapOpacityValue) {
          elements.heatmapOpacityValue.textContent = val + "%";
        }
        renderHeatmap();
      };
    }

    elements.reviewDiveFilter.onchange = renderReviewTab;
    elements.reviewTypeFilter.onchange = renderReviewTab;
    if (elements.closeReviewDetail) {
      elements.closeReviewDetail.onclick = () => {
        elements.reviewDetail.classList.add("hidden");
      };
    }

    window.handleKanbanDragOver = (e) => {
      e.preventDefault();
      e.currentTarget.classList.add("drag-over");
    };

    window.handleKanbanDrop = (e, newStatus) => {
      e.preventDefault();
      e.currentTarget.classList.remove("drag-over");
      const markId = e.dataTransfer.getData("text/mark-id");
      if (markId) {
        handleStatusChange(markId, newStatus);
      }
    };

    document.addEventListener("dragleave", (e) => {
      if (e.target.classList && e.target.classList.contains("review-column")) {
        e.target.classList.remove("drag-over");
      }
    });

    elements.tabs.forEach(tab => {
      tab.onclick = () => {
        switchTab(tab.dataset.tab);
      };
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderGrid();
        renderHeatmap();
        if (isCalibrating) {
          renderCalibrate();
        } else if (isMeasuring) {
          renderMeasure();
        } else {
          renderMeasurements();
        }
      }, 150);
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
        line.setAttribute("x1", calibratePoints[0].x);
        line.setAttribute("y1", calibratePoints[0].y);
        line.setAttribute("x2", calibratePoints[1].x);
        line.setAttribute("y2", calibratePoints[1].y);
        line.setAttribute("class", "calibrate-line");
        svg.appendChild(line);
      }

      calibratePoints.forEach((point, index) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", point.x);
        circle.setAttribute("cy", point.y);
        circle.setAttribute("r", "1.2");
        circle.setAttribute("class", "calibrate-point");
        svg.appendChild(circle);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", point.x);
        text.setAttribute("y", point.y - 1.8);
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
    remeasureOriginal = null;
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

    if (remeasureOriginal && remeasureOriginal.points && remeasureOriginal.points.length >= 2) {
      const pathData = remeasureOriginal.points.map((p, i) =>
        (i === 0 ? "M" : "L") + p.x + " " + p.y
      ).join(" ");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData);
      path.setAttribute("class", "measure-line-original");
      svg.appendChild(path);

      remeasureOriginal.points.forEach((point, index) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", point.x);
        circle.setAttribute("cy", point.y);
        circle.setAttribute("r", "0.8");
        circle.setAttribute("class", "measure-point-original");
        svg.appendChild(circle);
      });

      const midPoint = calculateMidPoint(remeasureOriginal.points);
      const labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      labelText.setAttribute("x", midPoint.x);
      labelText.setAttribute("y", midPoint.y - 2);
      labelText.setAttribute("class", "measure-label");
      labelText.setAttribute("opacity", "0.6");
      labelText.textContent = "原: " + remeasureOriginal.code + " " + Number(remeasureOriginal.length).toFixed(2) + "m";
      svg.appendChild(labelText);
    }

    if (measurePoints.length > 0) {
      if (measurePoints.length >= 2) {
        const pathData = measurePoints.map((p, i) =>
          (i === 0 ? "M" : "L") + p.x + " " + p.y
        ).join(" ");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        path.setAttribute("class", "measure-line");
        svg.appendChild(path);
      }

      measurePoints.forEach((point, index) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", point.x);
        circle.setAttribute("cy", point.y);
        circle.setAttribute("r", "1");
        circle.setAttribute("class", "measure-point");
        svg.appendChild(circle);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", point.x);
        text.setAttribute("y", point.y - 1.5);
        text.setAttribute("class", "measure-label");
        text.textContent = "P" + (index + 1);
        svg.appendChild(text);
      });

      if (measurePoints.length >= 2 && scale) {
        const midPoint = calculateMidPoint(measurePoints);
        const length = calculateRealLength(measurePoints);
        const lengthText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        lengthText.setAttribute("x", midPoint.x);
        lengthText.setAttribute("y", midPoint.y + 2);
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
        (i === 0 ? "M" : "L") + p.x + " " + p.y
      ).join(" ");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData);
      path.setAttribute("class", "measure-line-saved");
      if (isSelected) {
        path.setAttribute("stroke", "#ffc107");
        path.setAttribute("stroke-width", "0.4");
      }
      svg.appendChild(path);

      measurement.points.forEach((point, index) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", point.x);
        circle.setAttribute("cy", point.y);
        circle.setAttribute("r", isSelected ? "1.2" : "0.8");
        circle.setAttribute("class", "measure-point-saved");
        if (isSelected) {
          circle.setAttribute("fill", "#ffc107");
        }
        svg.appendChild(circle);
      });

      const midPoint = calculateMidPoint(measurement.points);
      const labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      labelText.setAttribute("x", midPoint.x);
      labelText.setAttribute("y", midPoint.y + 2);
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
      line.setAttribute("x1", x);
      line.setAttribute("y1", 0);
      line.setAttribute("x2", x);
      line.setAttribute("y2", 100);
      line.setAttribute("class", (x % (gridSizePercent * 5) < 0.01 || x === 0) ? "grid-line-major" : "grid-line");
      svg.appendChild(line);

      if (gridConfig.showLabels) {
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", x + 0.3);
        label.setAttribute("y", 2);
        label.setAttribute("class", "grid-label");
        label.textContent = ((x / gridSizePercent) * gridConfig.size).toFixed(1) + "m";
        svg.appendChild(label);
      }
    }

    for (let y = 0; y <= 100; y += gridSizePercentY) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", 0);
      line.setAttribute("y1", y);
      line.setAttribute("x2", 100);
      line.setAttribute("y2", y);
      line.setAttribute("class", (y % (gridSizePercentY * 5) < 0.01 || y === 0) ? "grid-line-major" : "grid-line");
      svg.appendChild(line);

      if (gridConfig.showLabels) {
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", 0.3);
        label.setAttribute("y", y + 1.5);
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
    remeasureOriginal = null;
    renderRelatedMarks();
    renderMeasure();
  }

  function switchTab(tab) {
    activeTab = tab;
    elements.tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    elements.marksTab.classList.toggle("hidden", tab !== "marks");
    elements.reviewTab.classList.toggle("hidden", tab !== "review");
    elements.revisitTab.classList.toggle("hidden", tab !== "revisit");
    elements.divesTab.classList.toggle("hidden", tab !== "dives");
    elements.measureTab.classList.toggle("hidden", tab !== "measure");
    updateViewSelectorValue();
    if (tab === "dives") {
      renderDives();
    } else if (tab === "measure") {
      renderMeasureTab();
    } else if (tab === "review") {
      renderReviewTab();
    } else if (tab === "revisit") {
      renderRevisitTab();
    } else {
      render();
      renderAttachments();
      renderStorageInfo();
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

  function updateReviewDiveFilter() {
    if (!elements.reviewDiveFilter) return;
    elements.reviewDiveFilter.innerHTML = '<option value="">全部潜次</option>';
    dives.forEach(dive => {
      const option = document.createElement("option");
      option.value = dive.code;
      option.textContent = dive.code + " - " + dive.date;
      elements.reviewDiveFilter.appendChild(option);
    });
  }

  function updateRevisitDiveFilter() {
    if (!elements.revisitDiveFilter) return;
    elements.revisitDiveFilter.innerHTML = '<option value="">全部潜次</option>';
    dives.forEach(dive => {
      const option = document.createElement("option");
      option.value = dive.code;
      option.textContent = dive.code + " - " + dive.date;
      elements.revisitDiveFilter.appendChild(option);
    });
  }

  function getReviewStatus(mark) {
    return mark.review?.status || "collected";
  }

  function updateState(newMarks, newDives, newMeasurements, newScale, newGridConfig, newPending, newCurrentEditId, newCurrentEditMeasureId, newBaseMap, newRevisitPlan) {
    marks = newMarks;
    dives = newDives;
    measurements = newMeasurements || measurements;
    scale = newScale !== undefined ? newScale : scale;
    gridConfig = newGridConfig || gridConfig;
    pending = newPending;
    currentEditId = newCurrentEditId;
    currentEditMeasureId = newCurrentEditMeasureId !== undefined ? newCurrentEditMeasureId : currentEditMeasureId;
    if (newBaseMap !== undefined) {
      baseMap = newBaseMap;
      renderBaseMap();
    }
    if (newRevisitPlan !== undefined) {
      revisitPlan = newRevisitPlan;
    }

    updateDiveSelect();
    updateDiveFilter();
    updateReviewDiveFilter();
    updateRevisitDiveFilter();
    updateMeasureDiveSelect();
    updateHeatmapDiveFilter();
    updateHeatmapConditionFilter();
    updateScaleDisplay();
    renderGrid();

    if (activeTab === "dives") {
      renderDives();
    } else if (activeTab === "measure") {
      renderMeasureTab();
    } else if (activeTab === "review") {
      render();
      renderReviewTab();
    } else if (activeTab === "revisit") {
      render();
      renderRevisitTab();
    } else {
      render();
      renderAttachments();
      renderStorageInfo();
    }
    renderHeatmap();
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
    if (elements.reviewFilter.value) {
      filtered = filtered.filter((m) => getReviewStatus(m) === elements.reviewFilter.value);
    }

    const totalVisible = filtered.length;
    const diveInfo = elements.diveFilter.value
      ? " · 潜次: " + elements.diveFilter.value
      : "";
    const reviewInfo = elements.reviewFilter.value
      ? " · 状态: " + reviewStatusNames[elements.reviewFilter.value]
      : "";
    elements.mapStats.textContent = `显示 ${totalVisible} 个标记` + diveInfo + reviewInfo;

    filtered.forEach((mark) => {
      const status = getReviewStatus(mark);
      const el = document.createElement("button");
      el.className =
        "marker " + mark.type + " review-status-" + status + (mark.id === currentEditId ? " selected" : "");
      el.style.left = mark.x + "%";
      el.style.top = mark.y + "%";
      el.textContent = mark.code.slice(0, 2);
      el.title = mark.code + " [" + reviewStatusNames[status] + "]";
      el.setAttribute("draggable", "true");
      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/mark-id", mark.id);
        e.dataTransfer.effectAllowed = "move";
      });
      el.onclick = (event) => {
        event.stopPropagation();
        edit(mark.id);
      };
      elements.map.appendChild(el);
    });

    if (pending) {
      const pendingEl = document.createElement("button");
      pendingEl.className = "marker unknown selected review-status-collected";
      pendingEl.style.left = pending.x + "%";
      pendingEl.style.top = pending.y + "%";
      pendingEl.textContent = "?";
      pendingEl.title = "新标记 [采集]";
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
        (m) => {
          const attCount = m.attachments ? m.attachments.length : 0;
          const attBadge = attCount > 0 
            ? '<span class="attachment-badge" title="' + attCount + '个附件">📷 ' + attCount + '</span>' 
            : '';
          const status = getReviewStatus(m);
          const statusBadge = '<span class="pill pill-review pill-review-' + status + '">' + reviewStatusNames[status] + '</span>';
          const sampleNo = m.sampling?.sampleNo;
          const sampleBadge = sampleNo 
            ? '<span class="pill pill-sampling" title="样品编号: ' + escapeHtml(sampleNo) + '">🧪 ' + escapeHtml(sampleNo) + '</span>' 
            : '';
          
          const sampling = m.sampling || {};
          const hasSampling = sampling.sampleNo || sampling.sampleMethod || sampling.sampler || sampling.sampleTime;
          let samplingInfo = '';
          if (hasSampling) {
            const parts = [];
            if (sampling.sampleMethod) parts.push('方式: ' + escapeHtml(sampling.sampleMethod));
            if (sampling.sampler) parts.push('采样人: ' + escapeHtml(sampling.sampler));
            if (sampling.sampleTime) parts.push('时间: ' + escapeHtml(sampling.sampleTime));
            if (parts.length > 0) {
              samplingInfo = '<div class="sampling-info muted small">' + parts.join(' · ') + '</div>';
            }
          }
          
          return '<div class="item ' +
            (m.id === currentEditId ? "active" : "") +
            '" data-id="' +
            m.id +
            '"><div class="item-header"><b>' +
            m.code +
            '</b> <span class="pill">' +
            typeNames[m.type] +
            '</span>' + statusBadge + sampleBadge + attBadge + '</div><div class="muted">' +
            m.dive +
            " · " +
            m.depth +
            " · " +
            (m.orientation || "") +
            "</div><div>" +
            (m.condition || "") +
            "</div>" + samplingInfo + "</div>";
        }
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
        ([dive, items]) => {
          const totalAttachments = items.reduce((sum, i) => sum + (i.attachments ? i.attachments.length : 0), 0);
          const attBadge = totalAttachments > 0
            ? '<span class="attachment-badge" title="' + totalAttachments + '个附件">📷 ' + totalAttachments + '</span>'
            : '';
          return '<div class="item"><b>' +
            dive +
            '</b> ' + attBadge + '<div class="muted">新增' +
            items.length +
            "个标记</div>" +
            items
              .map((i) => {
                const attCount = i.attachments ? i.attachments.length : 0;
                const itemAttBadge = attCount > 0
                  ? ' <span class="attachment-badge small-badge">📷 ' + attCount + '</span>'
                  : '';
                return "<div>" + i.code + " · " + typeNames[i.type] + itemAttBadge + "</div>";
              })
              .join("") +
            "</div>";
        }
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
    const totalParticipants = dives.reduce((sum, d) => sum + (d.participants ? d.participants.length : 0), 0);

    const typeCounts = marks.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    }, {});

    let statsHtml = '<div class="stats-grid">';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + totalDives + '</div><div class="stat-label">潜次总数</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + totalMarks + '</div><div class="stat-label">标记总数</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + avgMarksPerDive + '</div><div class="stat-label">平均每潜次</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + totalParticipants + '</div><div class="stat-label">参与人次</div></div>';
    statsHtml += '</div>';

    elements.diveStats.innerHTML = statsHtml;
  }

  function renderDiveList() {
    elements.diveList.innerHTML = dives
      .map(
        (d) => {
          const pCount = d.participants ? d.participants.length : 0;
          const participantBadge = pCount > 0
            ? ' <span class="pill pill-participant">' + pCount + '人</span>'
            : '';
          return '<div class="dive-item ' +
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
          '</span>' + participantBadge + ' <span class="muted">标记: ' +
          marks.filter(m => m.dive === d.code).length +
          '个</span></div><div class="dive-item-actions"><button type="button" class="secondary" data-action="edit" data-id="' +
          d.id +
          '">编辑</button><button type="button" class="secondary" data-action="detail" data-id="' +
          d.id +
          '">详情</button></div></div>';
        }
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
    const diveMeasurements = measurements.filter(m => m.dive === dive.code);
    const participants = dive.participants || [];

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

    if (participants.length > 0) {
      detailHtml += '<div class="detail-section">';
      detailHtml += '<h3>参与人员与设备 (' + participants.length + '人)</h3>';
      detailHtml += '<div class="participants-detail-list">';
      participants.forEach(p => {
        detailHtml += '<div class="participant-detail-item">';
        detailHtml += '<div class="participant-detail-name">' + escapeHtml(p.name || "未填写") + '</div>';
        detailHtml += '<div class="participant-detail-info">';
        if (p.role) detailHtml += '<span class="pill pill-role">' + escapeHtml(p.role) + '</span>';
        if (p.equipment) detailHtml += '<span class="muted">设备: ' + escapeHtml(p.equipment) + '</span>';
        detailHtml += '</div>';
        detailHtml += '</div>';
      });
      detailHtml += '</div>';
      detailHtml += '</div>';
    }

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

    if (diveMeasurements.length > 0) {
      detailHtml += '<div class="detail-section">';
      detailHtml += '<h3>关联测距 (' + diveMeasurements.length + '条)</h3>';
      detailHtml += '<div class="marks-in-dive">';
      diveMeasurements.forEach(m => {
        detailHtml += '<div class="mark-in-dive"><span class="pill pill-measure">' + Number(m.length).toFixed(2) + ' 米</span> <b>' + m.code + '</b>' + (m.note ? ' · ' + escapeHtml(m.note) : '') + '</div>';
      });
      detailHtml += '</div>';
      detailHtml += '</div>';
    }

    elements.diveDetailContent.innerHTML = detailHtml;
    elements.diveDetail.classList.remove("hidden");
  }

  function renderReviewTab() {
    renderReviewStats();
    renderReviewCards();
  }

  function renderReviewStats() {
    if (!elements.reviewStats) return;
    const counts = { collected: 0, pending: 0, confirmed: 0, revisit: 0 };
    marks.forEach((m) => {
      const s = getReviewStatus(m);
      if (counts[s] !== undefined) counts[s]++;
    });
    const total = marks.length;
    const confirmedRate = total > 0 ? ((counts.confirmed / total) * 100).toFixed(1) : 0;

    let html = '<div class="stats-grid">';
    html += '<div class="stat-card"><div class="stat-value">' + total + '</div><div class="stat-label">标记总数</div></div>';
    html += '<div class="stat-card"><div class="stat-value">' + counts.collected + '</div><div class="stat-label">采集</div></div>';
    html += '<div class="stat-card"><div class="stat-value">' + counts.pending + '</div><div class="stat-label">待复核</div></div>';
    html += '<div class="stat-card"><div class="stat-value">' + confirmedRate + '%</div><div class="stat-label">已确认率</div></div>';
    html += '</div>';

    elements.reviewStats.innerHTML = html;
  }

  function getFilteredReviewMarks() {
    let filtered = marks;
    if (elements.reviewDiveFilter && elements.reviewDiveFilter.value) {
      filtered = filtered.filter((m) => m.dive === elements.reviewDiveFilter.value);
    }
    if (elements.reviewTypeFilter && elements.reviewTypeFilter.value) {
      filtered = filtered.filter((m) => m.type === elements.reviewTypeFilter.value);
    }
    return filtered;
  }

  function renderReviewCards() {
    const filtered = getFilteredReviewMarks();
    const byStatus = { collected: [], pending: [], confirmed: [], revisit: [] };
    filtered.forEach((m) => {
      const s = getReviewStatus(m);
      if (byStatus[s]) byStatus[s].push(m);
    });

    REVIEW_STATUSES.forEach((status) => {
      const countEl = elements["count" + status.charAt(0).toUpperCase() + status.slice(1)];
      const cardsEl = elements["cards" + status.charAt(0).toUpperCase() + status.slice(1)];
      if (countEl) countEl.textContent = byStatus[status].length;
      if (cardsEl) cardsEl.innerHTML = byStatus[status].map((m) => buildReviewCard(m)).join("");
    });

    bindReviewCardEvents();
  }

  function buildReviewCard(mark) {
    const status = getReviewStatus(mark);
    const attCount = mark.attachments ? mark.attachments.length : 0;
    const comment = mark.review?.comment || "";
    const shortComment = comment.length > 30 ? comment.slice(0, 30) + "..." : comment;
    const sampleNo = mark.sampling?.sampleNo;
    const sampleBadge = sampleNo ? ' <span class="pill pill-sampling small" title="样品编号: ' + escapeHtml(sampleNo) + '">🧪 ' + escapeHtml(sampleNo) + '</span>' : '';

    let statusButtons = "";
    REVIEW_STATUSES.forEach((s) => {
      if (s !== status) {
        statusButtons += '<button type="button" class="secondary small review-status-btn" data-action="status" data-status="' + s + '" data-id="' + mark.id + '" title="设为' + reviewStatusNames[s] + '">' + reviewStatusNames[s] + '</button>';
      }
    });

    return '<div class="review-card review-card-' + status + '" draggable="true" data-id="' + mark.id + '">' +
      '<div class="review-card-header">' +
      '<b>' + mark.code + '</b>' +
      '<span class="pill ' + mark.type + '">' + typeNames[mark.type] + '</span>' +
      sampleBadge +
      (attCount > 0 ? '<span class="attachment-badge">📷 ' + attCount + '</span>' : '') +
      '</div>' +
      '<div class="review-card-info">' +
      '<span class="muted">' + mark.dive + ' · ' + mark.depth + '</span>' +
      '</div>' +
      (shortComment ? '<div class="review-card-comment" title="' + comment.replace(/"/g, '&quot;') + '">' + shortComment + '</div>' : '') +
      '<div class="review-card-actions">' +
      '<button type="button" class="secondary small" data-action="edit" data-id="' + mark.id + '">编辑</button>' +
      '<button type="button" class="secondary small" data-action="detail" data-id="' + mark.id + '">详情</button>' +
      '</div>' +
      '<div class="review-card-status-actions">' + statusButtons + '</div>' +
      '</div>';
  }

  function bindReviewCardEvents() {
    document.querySelectorAll(".review-card").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/mark-id", card.dataset.id);
        e.dataTransfer.effectAllowed = "move";
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
      });
    });

    document.querySelectorAll(".review-card [data-action]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === "edit") {
          switchTab("marks");
          edit(id);
        } else if (action === "detail") {
          showReviewDetail(id);
        } else if (action === "status") {
          handleStatusChange(id, btn.dataset.status);
        }
      };
    });

    document.querySelectorAll(".review-card").forEach((card) => {
      card.onclick = () => showReviewDetail(card.dataset.id);
    });
  }

  function handleStatusChange(markId, newStatus) {
    const mark = marks.find((m) => m.id === markId);
    if (!mark) return;
    const oldStatus = getReviewStatus(mark);
    if (oldStatus === newStatus) return;

    showStatusChangeModal(mark, oldStatus, newStatus);
  }

  function showStatusChangeModal(mark, oldStatus, newStatus) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal modal-review";

    let html = "<h2>变更审核状态</h2>";
    html += '<div class="review-change-info">';
    html += '<div><span class="muted">标记</span><div><b>' + mark.code + '</b> · ' + typeNames[mark.type] + '</div></div>';
    html += '<div class="review-change-status">';
    html += '<span class="pill pill-review pill-review-' + oldStatus + '">' + reviewStatusNames[oldStatus] + '</span>';
    html += '<span class="review-arrow">→</span>';
    html += '<span class="pill pill-review pill-review-' + newStatus + '">' + reviewStatusNames[newStatus] + '</span>';
    html += '</div>';
    html += '</div>';
    html += '<label>复核意见</label>';
    html += '<textarea id="statusChangeComment" placeholder="请输入复核意见..."></textarea>';
    html += '<label>审核人</label>';
    html += '<input id="statusChangeReviewer" placeholder="例如：李教授" value="' + (mark.review?.reviewer || "") + '">';
    html += '<div class="toolbar" style="margin-top:16px">';
    html += '<button type="button" id="confirmStatusChangeBtn">确认变更</button>';
    html += '<button type="button" class="secondary" id="cancelStatusChangeBtn">取消</button>';
    html += '</div>';

    modal.innerHTML = html;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    modal.querySelector("#cancelStatusChangeBtn").onclick = () => {
      document.body.removeChild(backdrop);
    };

    modal.querySelector("#confirmStatusChangeBtn").onclick = () => {
      const comment = modal.querySelector("#statusChangeComment").value.trim();
      const reviewer = modal.querySelector("#statusChangeReviewer").value.trim();
      document.body.removeChild(backdrop);
      applyStatusChange(mark.id, newStatus, comment, reviewer);
    };

    backdrop.onclick = (e) => {
      if (e.target === backdrop) document.body.removeChild(backdrop);
    };
  }

  function applyStatusChange(markId, newStatus, comment, reviewer) {
    if (callbacks.onUpdateReviewStatus) {
      callbacks.onUpdateReviewStatus(markId, newStatus, comment, reviewer);
    }
  }

  function showReviewDetail(id) {
    const mark = marks.find((m) => m.id === id);
    if (!mark || !elements.reviewDetail || !elements.reviewDetailContent) return;

    const status = getReviewStatus(mark);
    elements.reviewDetailTitle.textContent = mark.code + " - 审核详情";

    let html = '<div class="detail-section">';
    html += '<h3>基本信息</h3>';
    html += '<div class="detail-grid">';
    html += '<div><span class="muted">编号</span><div><b>' + mark.code + '</b></div></div>';
    html += '<div><span class="muted">类型</span><div><span class="pill ' + mark.type + '">' + typeNames[mark.type] + '</span></div></div>';
    html += '<div><span class="muted">潜次</span><div>' + mark.dive + '</div></div>';
    html += '<div><span class="muted">深度</span><div>' + mark.depth + '</div></div>';
    html += '<div><span class="muted">审核状态</span><div><span class="pill pill-review pill-review-' + status + '">' + reviewStatusNames[status] + '</span></div></div>';
    html += '<div><span class="muted">审核人</span><div>' + (mark.review?.reviewer || "未指定") + '</div></div>';
    html += '</div></div>';

    html += '<div class="detail-section">';
    html += '<h3>标记信息</h3>';
    if (mark.orientation) html += '<div><span class="muted">朝向</span><div>' + mark.orientation + '</div></div>';
    if (mark.condition) html += '<div><span class="muted">保存状态</span><div>' + mark.condition + '</div></div>';
    if (mark.note) html += '<div><span class="muted">备注</span><div>' + mark.note + '</div></div>';
    html += '</div>';

    html += '<div class="detail-section">';
    html += '<h3>采样记录</h3>';
    html += '<div class="detail-grid">';
    html += '<div><span class="muted">样品编号</span><div>' + (mark.sampling?.sampleNo ? escapeHtml(mark.sampling.sampleNo) : '<span class="muted">—</span>') + '</div></div>';
    html += '<div><span class="muted">采样方式</span><div>' + (mark.sampling?.sampleMethod ? escapeHtml(mark.sampling.sampleMethod) : '<span class="muted">—</span>') + '</div></div>';
    html += '<div><span class="muted">采样人</span><div>' + (mark.sampling?.sampler ? escapeHtml(mark.sampling.sampler) : '<span class="muted">—</span>') + '</div></div>';
    html += '<div><span class="muted">采样时间</span><div>' + (mark.sampling?.sampleTime ? escapeHtml(mark.sampling.sampleTime) : '<span class="muted">—</span>') + '</div></div>';
    html += '</div></div>';

    html += '<div class="detail-section">';
    html += '<h3>复核意见</h3>';
    if (mark.review?.comment) {
      html += '<div class="objective-text">' + mark.review.comment + '</div>';
    } else {
      html += '<div class="muted">暂无复核意见</div>';
    }
    html += '</div>';

    if (mark.review?.history && mark.review.history.length > 0) {
      html += '<div class="detail-section">';
      html += '<h3>状态变更历史</h3>';
      html += '<div class="review-history">';
      mark.review.history.slice().reverse().forEach((h, idx) => {
        const dateStr = h.at ? new Date(h.at).toLocaleString("zh-CN") : "-";
        html += '<div class="review-history-item">';
        html += '<div class="review-history-header">';
        html += '<span class="pill pill-review pill-review-' + h.status + '">' + reviewStatusNames[h.status] + '</span>';
        html += '<span class="muted small">' + dateStr + '</span>';
        html += '</div>';
        if (h.reviewer) html += '<div class="small">审核人: ' + h.reviewer + '</div>';
        if (h.comment) html += '<div class="small muted">' + h.comment + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    html += '<div class="toolbar">';
    html += '<button type="button" id="reviewDetailEditBtn">编辑标记</button>';
    html += '<button type="button" class="secondary" id="reviewDetailChangeBtn">变更状态</button>';
    html += '</div>';

    elements.reviewDetailContent.innerHTML = html;
    elements.reviewDetail.classList.remove("hidden");

    const editBtn = elements.reviewDetailContent.querySelector("#reviewDetailEditBtn");
    if (editBtn) editBtn.onclick = () => { switchTab("marks"); edit(id); };
    const changeBtn = elements.reviewDetailContent.querySelector("#reviewDetailChangeBtn");
    if (changeBtn) changeBtn.onclick = () => {
      const modal = document.createElement("div");
      showStatusChangeModal2(id);
    };
  }

  function showStatusChangeModal2(markId) {
    const mark = marks.find((m) => m.id === markId);
    if (!mark) return;
    const currentStatus = getReviewStatus(mark);
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const modal = document.createElement("div");
    modal.className = "modal modal-review";

    let html = "<h2>变更审核状态</h2>";
    html += '<div class="review-change-info">';
    html += '<div><span class="muted">标记</span><div><b>' + mark.code + '</b> · ' + typeNames[mark.type] + '</div></div>';
    html += '<div><span class="muted">当前状态</span><div><span class="pill pill-review pill-review-' + currentStatus + '">' + reviewStatusNames[currentStatus] + '</span></div></div>';
    html += '</div>';
    html += '<label>新状态</label>';
    html += '<select id="statusSelect">';
    REVIEW_STATUSES.forEach((s) => {
      html += '<option value="' + s + '"' + (s === currentStatus ? ' selected' : '') + '>' + reviewStatusNames[s] + '</option>';
    });
    html += '</select>';
    html += '<label>复核意见</label>';
    html += '<textarea id="statusChangeComment" placeholder="请输入复核意见...">' + (mark.review?.comment || "") + '</textarea>';
    html += '<label>审核人</label>';
    html += '<input id="statusChangeReviewer" placeholder="例如：李教授" value="' + (mark.review?.reviewer || "") + '">';
    html += '<div class="toolbar" style="margin-top:16px">';
    html += '<button type="button" id="confirmStatusChangeBtn">确认变更</button>';
    html += '<button type="button" class="secondary" id="cancelStatusChangeBtn">取消</button>';
    html += '</div>';

    modal.innerHTML = html;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    modal.querySelector("#cancelStatusChangeBtn").onclick = () => {
      document.body.removeChild(backdrop);
    };
    modal.querySelector("#confirmStatusChangeBtn").onclick = () => {
      const newStatus = modal.querySelector("#statusSelect").value;
      const comment = modal.querySelector("#statusChangeComment").value.trim();
      const reviewer = modal.querySelector("#statusChangeReviewer").value.trim();
      document.body.removeChild(backdrop);
      applyStatusChange(markId, newStatus, comment, reviewer);
    };
    backdrop.onclick = (e) => {
      if (e.target === backdrop) document.body.removeChild(backdrop);
    };
  }

  const priorityNames = { high: "高", medium: "中", low: "低" };
  const handlingMethodOptions = ["采样", "拍照记录", "测量", "进一步勘查", "提取标本", "其他"];

  function getFilteredRevisitTasks() {
    let tasks = [];
    if (callbacks && callbacks.onGetRevisitTasks) {
      tasks = callbacks.onGetRevisitTasks() || [];
    }
    if (elements.revisitDiveFilter && elements.revisitDiveFilter.value) {
      tasks = tasks.filter(t => t.dive === elements.revisitDiveFilter.value);
    }
    if (elements.revisitTypeFilter && elements.revisitTypeFilter.value) {
      tasks = tasks.filter(t => t.type === elements.revisitTypeFilter.value);
    }
    return tasks;
  }

  function renderRevisitTab() {
    renderRevisitStats();
    renderRevisitTaskList();
    bindRevisitEvents();
  }

  function renderRevisitStats() {
    if (!elements.revisitStats) return;
    const tasks = getFilteredRevisitTasks();
    const totalTasks = tasks.length;
    const totalMarks = tasks.reduce((sum, t) => sum + (t.marks ? t.marks.length : 0), 0);
    const highPriority = tasks.filter(t => t.priority === "high").length;
    const diveCount = new Set(tasks.map(t => t.dive)).size;

    let html = '<div class="stats-grid">';
    html += '<div class="stat-card"><div class="stat-value">' + totalTasks + '</div><div class="stat-label">任务组数</div></div>';
    html += '<div class="stat-card"><div class="stat-value">' + totalMarks + '</div><div class="stat-label">标记总数</div></div>';
    html += '<div class="stat-card"><div class="stat-value">' + highPriority + '</div><div class="stat-label">高优先级</div></div>';
    html += '<div class="stat-card"><div class="stat-value">' + diveCount + '</div><div class="stat-label">涉及潜次</div></div>';
    html += '</div>';

    elements.revisitStats.innerHTML = html;
  }

  function renderRevisitTaskList() {
    if (!elements.revisitTaskList) return;
    const tasks = getFilteredRevisitTasks();

    if (tasks.length === 0) {
      elements.revisitTaskList.innerHTML = '<div class="revisit-empty"><div class="empty-icon">📋</div><div class="muted">暂无待处理的返潜任务</div><div class="muted small">审核状态为「待复核」或「需返潜」的标记将自动聚合到这里</div></div>';
      return;
    }

    let html = '';
    tasks.forEach(task => {
      const isSelected = selectedRevisitTasks.has(task.id);
      html += buildRevisitTaskCard(task, isSelected);
    });

    elements.revisitTaskList.innerHTML = html;
  }

  function buildRevisitTaskCard(task, isSelected) {
    const typeLabel = typeNames[task.type] || task.type;
    const priorityLabel = priorityNames[task.priority] || task.priority;
    const markCount = task.marks ? task.marks.length : 0;
    const isSelectedClass = isSelected ? ' selected' : '';

    let markPreviews = '';
    if (task.marks && task.marks.length > 0) {
      const previewMarks = task.marks.slice(0, 3);
      markPreviews = '<div class="revisit-marks-preview">';
      previewMarks.forEach(m => {
        const status = m.reviewStatus || "pending";
        markPreviews += '<span class="pill ' + m.type + ' small" title="' + escapeHtml(m.code) + ' · ' + escapeHtml(m.depth || "") + '">' + escapeHtml(m.code) + '</span>';
      });
      if (task.marks.length > 3) {
        markPreviews += '<span class="muted small">+' + (task.marks.length - 3) + '个</span>';
      }
      markPreviews += '</div>';
    }

    return '<div class="revisit-task-card priority-' + task.priority + isSelectedClass + '" data-id="' + task.id + '">' +
      '<div class="revisit-task-header">' +
      '<label class="checkbox-label revisit-checkbox">' +
      '<input type="checkbox" class="revisit-task-select" data-id="' + task.id + '"' + (isSelected ? ' checked' : '') + '>' +
      '<span class="priority-badge priority-' + task.priority + '">' + priorityLabel + '优先</span>' +
      '</label>' +
      '<span class="pill ' + task.type + '">' + typeLabel + '</span>' +
      '</div>' +
      '<div class="revisit-task-info">' +
      '<div class="revisit-task-title">' +
      '<b>' + escapeHtml(task.depthRange) + '</b> · ' + escapeHtml(task.locationZone) +
      '</div>' +
      '<div class="muted small">来源潜次: ' + escapeHtml(task.dive) + ' · ' + markCount + '个标记</div>' +
      markPreviews +
      '</div>' +
      '<div class="revisit-task-fields">' +
      '<div class="revisit-field">' +
      '<label>处理方式</label>' +
      '<select class="revisit-handling-method" data-id="' + task.id + '">' +
      '<option value="">未设置</option>' +
      handlingMethodOptions.map(m => '<option value="' + m + '"' + (task.handlingMethod === m ? ' selected' : '') + '>' + m + '</option>').join('') +
      '</select>' +
      '</div>' +
      '<div class="revisit-field">' +
      '<label>优先级</label>' +
      '<select class="revisit-priority" data-id="' + task.id + '">' +
      '<option value="high"' + (task.priority === 'high' ? ' selected' : '') + '>高</option>' +
      '<option value="medium"' + (task.priority === 'medium' ? ' selected' : '') + '>中</option>' +
      '<option value="low"' + (task.priority === 'low' ? ' selected' : '') + '>低</option>' +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div class="revisit-task-notes">' +
      '<label>备注</label>' +
      '<textarea class="revisit-notes-input" data-id="' + task.id + '" placeholder="添加任务备注...">' + escapeHtml(task.notes || '') + '</textarea>' +
      '</div>' +
      '<div class="revisit-task-actions">' +
      '<button type="button" class="secondary small revisit-save-btn" data-id="' + task.id + '">保存设置</button>' +
      '<button type="button" class="secondary small revisit-view-marks-btn" data-id="' + task.id + '">查看标记</button>' +
      '</div>' +
      '</div>';
  }

  function bindRevisitEvents() {
    if (!elements.revisitTaskList) return;

    document.querySelectorAll(".revisit-task-select").forEach(checkbox => {
      checkbox.onclick = (e) => {
        e.stopPropagation();
        const taskId = checkbox.dataset.id;
        if (checkbox.checked) {
          selectedRevisitTasks.add(taskId);
        } else {
          selectedRevisitTasks.delete(taskId);
        }
      };
    });

    document.querySelectorAll(".revisit-save-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.id;
        saveRevisitTask(taskId);
      };
    });

    document.querySelectorAll(".revisit-view-marks-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.id;
        showRevisitTaskMarks(taskId);
      };
    });

    if (elements.revisitDiveFilter) {
      elements.revisitDiveFilter.onchange = () => {
        renderRevisitTab();
      };
    }

    if (elements.revisitTypeFilter) {
      elements.revisitTypeFilter.onchange = () => {
        renderRevisitTab();
      };
    }

    if (elements.refreshRevisitPlanBtn) {
      elements.refreshRevisitPlanBtn.onclick = () => {
        renderRevisitTab();
        showToast("已刷新任务聚合", "success");
      };
    }

    if (elements.createDiveFromPlanBtn) {
      elements.createDiveFromPlanBtn.onclick = () => {
        if (selectedRevisitTasks.size === 0) {
          showToast("请先选择要创建潜次的任务", "error");
          return;
        }
        if (callbacks && callbacks.onCreateDiveFromRevisitPlan) {
          const taskIds = Array.from(selectedRevisitTasks);
          const result = callbacks.onCreateDiveFromRevisitPlan(taskIds);
          if (result) {
            selectedRevisitTasks.clear();
            switchTab("dives");
          }
        }
      };
    }
  }

  function saveRevisitTask(taskId) {
    const tasks = getFilteredRevisitTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const priorityEl = document.querySelector('.revisit-priority[data-id="' + taskId + '"]');
    const methodEl = document.querySelector('.revisit-handling-method[data-id="' + taskId + '"]');
    const notesEl = document.querySelector('.revisit-notes-input[data-id="' + taskId + '"]');

    const taskData = {
      id: taskId,
      key: task.key,
      dive: task.dive,
      type: task.type,
      depthRange: task.depthRange,
      locationZone: task.locationZone,
      priority: priorityEl ? priorityEl.value : task.priority,
      handlingMethod: methodEl ? methodEl.value : task.handlingMethod,
      notes: notesEl ? notesEl.value : task.notes,
    };

    if (callbacks && callbacks.onSaveRevisitTask) {
      callbacks.onSaveRevisitTask(taskData);
      showToast("任务设置已保存", "success");
    }
  }

  function showRevisitTaskMarks(taskId) {
    const tasks = getFilteredRevisitTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.marks) return;

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal modal-revisit-marks";

    let html = '<h2>任务包含的标记</h2>';
    html += '<div class="muted" style="margin-bottom:12px;">' + escapeHtml(task.depthRange) + ' · ' + escapeHtml(task.locationZone) + ' · 共' + task.marks.length + '个标记</div>';
    html += '<div class="revisit-marks-detail">';

    task.marks.forEach(mark => {
      const statusLabel = reviewStatusNames[mark.reviewStatus] || mark.reviewStatus;
      html += '<div class="revisit-mark-item">';
      html += '<div class="revisit-mark-header">';
      html += '<b>' + escapeHtml(mark.code) + '</b>';
      html += '<span class="pill ' + mark.type + '">' + (typeNames[mark.type] || mark.type) + '</span>';
      html += '<span class="pill pill-review pill-review-' + mark.reviewStatus + '">' + statusLabel + '</span>';
      html += '</div>';
      html += '<div class="muted small">深度: ' + escapeHtml(mark.depth || "—") + '</div>';
      if (mark.condition) {
        html += '<div class="muted small">保存状态: ' + escapeHtml(mark.condition) + '</div>';
      }
      if (mark.reviewComment) {
        html += '<div class="revisit-mark-comment">' + escapeHtml(mark.reviewComment) + '</div>';
      }
      html += '<button type="button" class="secondary small revisit-mark-edit-btn" data-id="' + mark.id + '">编辑标记</button>';
      html += '</div>';
    });

    html += '</div>';
    html += '<div class="toolbar" style="margin-top:16px;">';
    html += '<button type="button" id="closeRevisitMarksBtn" class="secondary">关闭</button>';
    html += '</div>';

    modal.innerHTML = html;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    modal.querySelector("#closeRevisitMarksBtn").onclick = () => {
      document.body.removeChild(backdrop);
    };

    modal.querySelectorAll(".revisit-mark-edit-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const markId = btn.dataset.id;
        document.body.removeChild(backdrop);
        switchTab("marks");
        edit(markId);
      };
    });

    backdrop.onclick = (e) => {
      if (e.target === backdrop) document.body.removeChild(backdrop);
    };
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
          '</div><div class="measure-item-actions"><button type="button" class="secondary" data-action="remeasure" data-id="' +
          m.id +
          '">快速复测</button><button type="button" class="secondary" data-action="edit" data-id="' +
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
        if (action === "remeasure") {
          startRemeasure(id);
        } else if (action === "edit") {
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

  function generateRemeasureCode(originalCode) {
    const existingCodes = new Set(measurements.map((m) => m.code));
    const base = originalCode.replace(/-R\d+$/, "");
    let counter = 1;
    let newCode;
    do {
      newCode = base + "-R" + String(counter).padStart(2, "0");
      counter++;
    } while (existingCodes.has(newCode));
    return newCode;
  }

  function startRemeasure(id) {
    const measurement = measurements.find((m) => m.id === id);
    if (!measurement) return;

    if (!scale) {
      showToast("请先校准比例尺", "error");
      return;
    }

    cancelMeasuring();
    currentEditMeasureId = null;
    remeasureOriginal = measurement;
    measurePoints = [];
    selectedRelatedMarks = measurement.relatedMarks ? [...measurement.relatedMarks] : [];

    isMeasuring = true;
    elements.map.classList.add("measuring");
    elements.measureBtn.textContent = "取消测距";
    elements.measureBtn.classList.remove("secondary");
    switchTab("measure");

    elements.measureForm.id.value = "";
    elements.measureForm.code.value = generateRemeasureCode(measurement.code);
    elements.measureForm.dive.value = measurement.dive;
    elements.measureForm.length.value = "";
    elements.measureForm.note.value = measurement.note
      ? "[复测来源: " + measurement.code + "] " + measurement.note
      : "[复测来源: " + measurement.code + "]";

    renderRelatedMarks();
    renderMeasureTab();
    showToast("快速复测模式：原测线已半透明显示，请点击地图绘制新测线", "info");
  }

  function edit(id) {
    const mark = marks.find((m) => m.id === id);
    if (!mark) return;
    for (const [key, value] of Object.entries(mark)) {
      if (elements.form[key]) elements.form[key].value = value;
    }
    if (mark.sampling) {
      if (elements.form.sampleNo) elements.form.sampleNo.value = mark.sampling.sampleNo || "";
      if (elements.form.sampleMethod) elements.form.sampleMethod.value = mark.sampling.sampleMethod || "";
      if (elements.form.sampler) elements.form.sampler.value = mark.sampling.sampler || "";
      if (elements.form.sampleTime) elements.form.sampleTime.value = mark.sampling.sampleTime || "";
    } else {
      if (elements.form.sampleNo) elements.form.sampleNo.value = "";
      if (elements.form.sampleMethod) elements.form.sampleMethod.value = "";
      if (elements.form.sampler) elements.form.sampler.value = "";
      if (elements.form.sampleTime) elements.form.sampleTime.value = "";
    }
    if (mark.review) {
      if (elements.form.reviewStatus) elements.form.reviewStatus.value = mark.review.status || "collected";
      if (elements.form.reviewComment) elements.form.reviewComment.value = mark.review.comment || "";
      if (elements.form.reviewer) elements.form.reviewer.value = mark.review.reviewer || "";
    } else {
      if (elements.form.reviewStatus) elements.form.reviewStatus.value = "collected";
      if (elements.form.reviewComment) elements.form.reviewComment.value = "";
      if (elements.form.reviewer) elements.form.reviewer.value = "";
    }
    pending = { x: mark.x, y: mark.y };
    currentEditId = id;
    currentAttachments = mark.attachments ? JSON.parse(JSON.stringify(mark.attachments)) : [];
    renderAttachments();
    renderStorageInfo();
    render();
  }

  function editDive(id) {
    const dive = dives.find((d) => d.id === id);
    if (!dive) return;
    for (const [key, value] of Object.entries(dive)) {
      if (elements.diveForm[key]) elements.diveForm[key].value = value;
    }
    currentEditDiveId = id;
    currentParticipants = dive.participants ? JSON.parse(JSON.stringify(dive.participants)) : [];
    renderParticipants();
    renderDives();
  }

  function resetForm() {
    elements.form.reset();
    elements.form.id.value = "";
    if (elements.form.sampleNo) elements.form.sampleNo.value = "";
    if (elements.form.sampleMethod) elements.form.sampleMethod.value = "";
    if (elements.form.sampler) elements.form.sampler.value = "";
    if (elements.form.sampleTime) elements.form.sampleTime.value = "";
    currentEditId = null;
    pending = null;
    currentAttachments = [];
    renderAttachments();
    renderStorageInfo();
  }

  function resetDiveForm() {
    elements.diveForm.reset();
    elements.diveForm.id.value = "";
    currentEditDiveId = null;
    currentParticipants = [];
    renderParticipants();
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
          const sampleNo = mark.sampling?.sampleNo;
          const sampleBadge = sampleNo ? ' <span class="pill pill-sampling small">🧪 ' + escapeHtml(sampleNo) + '</span>' : '';
          const sampling = mark.sampling || {};
          const hasSamplingDetail = sampling.sampleMethod || sampling.sampler || sampling.sampleTime;
          let samplingDetail = '';
          if (hasSamplingDetail) {
            const parts = [];
            if (sampling.sampleMethod) parts.push('方式: ' + escapeHtml(sampling.sampleMethod));
            if (sampling.sampler) parts.push('采样人: ' + escapeHtml(sampling.sampler));
            if (sampling.sampleTime) parts.push('时间: ' + escapeHtml(sampling.sampleTime));
            samplingDetail = '<div class="preview-item-detail muted small">' + parts.join(' · ') + '</div>';
          }
          html +=
            '<div class="preview-item"><div><span><b>' +
            mark.code +
            "</b> " +
            typeNames[mark.type] +
            ' · ' +
            mark.dive +
            " · " +
            mark.depth +
            sampleBadge +
            "</span><span class='pill pill-new'>新增</span></div>" + samplingDetail + "</div>";
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
          const diff = conflict.reviewDiff;
          let reviewDiffHtml = "";
          if (diff && (diff.statusChanged || diff.commentChanged || diff.reviewerChanged)) {
            reviewDiffHtml = '<div class="conflict-review-diff">';
            if (diff.statusChanged) {
              reviewDiffHtml += '<div class="review-diff-row">';
              reviewDiffHtml += '<span class="muted small">状态:</span>';
              reviewDiffHtml += '<span class="pill pill-review pill-review-' + diff.localStatus + '">本地:' + reviewStatusNames[diff.localStatus] + '</span>';
              reviewDiffHtml += '<span class="review-arrow">→</span>';
              reviewDiffHtml += '<span class="pill pill-review pill-review-' + diff.importedStatus + '">导入:' + reviewStatusNames[diff.importedStatus] + '</span>';
              reviewDiffHtml += '</div>';
            }
            if (diff.commentChanged) {
              reviewDiffHtml += '<div class="review-diff-row">';
              reviewDiffHtml += '<span class="muted small">意见:</span>';
              reviewDiffHtml += '<span class="conflict-local-val" title="' + (diff.localComment || '无').replace(/"/g, '&quot;') + '">本地: ' + ((diff.localComment && diff.localComment.length > 20) ? diff.localComment.slice(0, 20) + '...' : (diff.localComment || '无')) + '</span>';
              reviewDiffHtml += '<span class="review-arrow">→</span>';
              reviewDiffHtml += '<span class="conflict-imported-val" title="' + (diff.importedComment || '无').replace(/"/g, '&quot;') + '">导入: ' + ((diff.importedComment && diff.importedComment.length > 20) ? diff.importedComment.slice(0, 20) + '...' : (diff.importedComment || '无')) + '</span>';
              reviewDiffHtml += '</div>';
            }
            if (diff.reviewerChanged) {
              reviewDiffHtml += '<div class="review-diff-row">';
              reviewDiffHtml += '<span class="muted small">审核人:</span>';
              reviewDiffHtml += '<span class="conflict-local-val">本地: ' + (diff.localReviewer || '未指定') + '</span>';
              reviewDiffHtml += '<span class="review-arrow">→</span>';
              reviewDiffHtml += '<span class="conflict-imported-val">导入: ' + (diff.importedReviewer || '未指定') + '</span>';
              reviewDiffHtml += '</div>';
            }
            reviewDiffHtml += '</div>';
          }
          const sampleNo = conflict.imported.sampling?.sampleNo;
          const sampleBadge = sampleNo ? ' <span class="pill pill-sampling small">🧪 ' + escapeHtml(sampleNo) + '</span>' : '';
          const sampling = conflict.imported.sampling || {};
          const hasSamplingDetail = sampling.sampleMethod || sampling.sampler || sampling.sampleTime;
          let samplingDetail = '';
          if (hasSamplingDetail) {
            const parts = [];
            if (sampling.sampleMethod) parts.push('方式: ' + escapeHtml(sampling.sampleMethod));
            if (sampling.sampler) parts.push('采样人: ' + escapeHtml(sampling.sampler));
            if (sampling.sampleTime) parts.push('时间: ' + escapeHtml(sampling.sampleTime));
            samplingDetail = '<div class="preview-item-detail muted small">' + parts.join(' · ') + '</div>';
          }
          html +=
            '<div class="preview-item preview-item-conflict" data-mark-conflict-index="' +
            idx + '"><div class="preview-item-main"><span><b>' +
            conflict.imported.code +
            "</b> " +
            typeNames[conflict.imported.type] +
            ' · ' +
            conflict.imported.dive +
            sampleBadge +
            "</span>";
          html += '<select data-mark-resolution-index="' + idx + '">';
          html += '<option value="keep">保留本地</option>';
          html += '<option value="overwrite">覆盖本地</option>';
          html += '<option value="saveas">另存为新编号</option>';
          html += "</select></div>" + samplingDetail + reviewDiffHtml + "</div>";
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

  function showMergePreview(analysis, onConfirm, onCancel) {
    let currentEntity = "marks";
    let currentCategory = "new";

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal merge-modal";

    const markResolutions = {
      new: (analysis.marks?.new || []).map(() => "add"),
      modified: (analysis.marks?.modified || []).map(() => "keep"),
      deleted: (analysis.marks?.deleted || []).map(() => "keep"),
      diverged: (analysis.marks?.diverged || []).map(() => "saveas"),
      positionDuplicates: (analysis.marks?.positionDuplicates || []).map(() => "skip"),
    };

    function initAttachmentResolutionsForMarks(markItems) {
      return (markItems || []).map((item) => {
        if (!item.attachments) return null;
        return {
          new: (item.attachments.new || []).map(() => "add"),
          sameNameDiffImage: (item.attachments.sameNameDiffImage || []).map(() => "keep"),
          metaChanged: (item.attachments.metaChanged || []).map(() => "merge"),
          deleted: (item.attachments.deleted || []).map(() => "keep"),
        };
      });
    }

    const attachmentResolutions = {
      new: initAttachmentResolutionsForMarks(analysis.marks?.new),
      modified: initAttachmentResolutionsForMarks(analysis.marks?.modified),
      deleted: initAttachmentResolutionsForMarks(analysis.marks?.deleted),
      diverged: initAttachmentResolutionsForMarks(analysis.marks?.diverged),
      positionDuplicates: initAttachmentResolutionsForMarks(analysis.marks?.positionDuplicates),
    };

    const diveResolutions = {
      new: (analysis.dives?.new || []).map(() => "add"),
      modified: (analysis.dives?.modified || []).map(() => "keep"),
      deleted: (analysis.dives?.deleted || []).map(() => "keep"),
      diverged: (analysis.dives?.diverged || []).map(() => "saveas"),
    };

    const measurementResolutions = {
      new: (analysis.measurements?.new || []).map(() => "add"),
      modified: (analysis.measurements?.modified || []).map(() => "keep"),
      deleted: (analysis.measurements?.deleted || []).map(() => "keep"),
      diverged: (analysis.measurements?.diverged || []).map(() => "saveas"),
    };

    function getResolutions(entity, category) {
      if (entity === "marks") return markResolutions[category] || [];
      if (entity === "dives") return diveResolutions[category] || [];
      if (entity === "measurements") return measurementResolutions[category] || [];
      return [];
    }

    function getAnalysisData(entity) {
      if (entity === "marks") return analysis.marks || {};
      if (entity === "dives") return analysis.dives || {};
      if (entity === "measurements") return analysis.measurements || {};
      return {};
    }

    function getCategoryLabel(category) {
      const labels = {
        new: "新增",
        modified: "修改",
        deleted: "删除",
        diverged: "分叉编辑",
        positionDuplicates: "位置疑似重复",
        unchanged: "未变更",
        errors: "错误",
      };
      return labels[category] || category;
    }

    function getCategoryCount(entity, category) {
      const data = getAnalysisData(entity);
      const items = data[category];
      return Array.isArray(items) ? items.length : 0;
    }

    function renderSummary() {
      const data = getAnalysisData(currentEntity);
      const summary = analysis.summary?.[currentEntity] || {};
      let html = '<div class="merge-summary-grid">';

      const categories = [
        { key: "new", class: "new", icon: "➕" },
        { key: "modified", class: "modified", icon: "✏️" },
        { key: "deleted", class: "deleted", icon: "🗑️" },
        { key: "diverged", class: "diverged", icon: "🔀" },
      ];

      if (currentEntity === "marks") {
        categories.push({ key: "positionDuplicates", class: "duplicate", icon: "📍" });
      }

      categories.push({ key: "unchanged", class: "unchanged", icon: "✓" });

      categories.forEach((cat) => {
        const count = getCategoryCount(currentEntity, cat.key);
        const isActive = currentCategory === cat.key;
        html +=
          '<div class="merge-summary-item ' +
          (isActive ? "active" : "") +
          '" data-category="' +
          cat.key +
          '">' +
          '<div class="merge-summary-count ' +
          cat.class +
          '">' +
          count +
          "</div>" +
          '<div class="merge-summary-label">' +
          getCategoryLabel(cat.key) +
          "</div>" +
          "</div>";
      });

      html += "</div>";

      if (currentEntity === "marks" && summary.attachments) {
        const attStats = summary.attachments;
        if (attStats.new > 0 || attStats.modified > 0 || attStats.deleted > 0) {
          html += '<div class="merge-attachment-summary">';
          html += '<span class="muted small">📷 附件变化：</span>';
          if (attStats.new > 0) html += '<span class="pill new">' + attStats.new + ' 新增</span>';
          if (attStats.modified > 0) html += '<span class="pill modified">' + attStats.modified + ' 变化</span>';
          if (attStats.deleted > 0) html += '<span class="pill deleted">' + attStats.deleted + ' 删除</span>';
          html += '</div>';
        }
      }

      return html;
    }

    function renderEntityTabs() {
      const entities = [
        { key: "marks", label: "标记数据" },
        { key: "dives", label: "潜次档案" },
        { key: "measurements", label: "测距记录" },
      ];

      let html = '<div class="merge-entity-tabs">';
      entities.forEach((ent) => {
        const count = analysis.summary?.[ent.key]?.total || 0;
        html +=
          '<button type="button" class="merge-entity-tab ' +
          (currentEntity === ent.key ? "active" : "") +
          '" data-entity="' +
          ent.key +
          '">' +
          ent.label +
          " (" +
          count +
          ")" +
          "</button>";
      });
      html += "</div>";
      return html;
    }

    function renderDiff(diff) {
      if (!diff || !diff.changed || diff.changed.length === 0) return "";

      let html = '<div class="merge-item-detail">';
      html += '<div class="merge-item-detail-grid">';
      html += '<div class="merge-item-detail-section local"><h4>本地数据</h4>';
      diff.changed.forEach((change) => {
        html +=
          '<div class="diff-field"><span class="diff-field-name">' +
          change.field +
          '</span><span class="diff-local">' +
          escapeHtml(String(change.local ?? "-")) +
          "</span></div>";
      });
      html += "</div>";

      html += '<div class="merge-item-detail-section imported"><h4>导入数据</h4>';
      diff.changed.forEach((change) => {
        html +=
          '<div class="diff-field"><span class="diff-field-name">' +
          change.field +
          '</span><span class="diff-imported">' +
          escapeHtml(String(change.imported ?? "-")) +
          "</span></div>";
      });
      html += "</div>";
      html += "</div></div>";

      return html;
    }

    function getResolutionOptions(entity, category) {
      const options = {
        marks: {
          new: [
            { value: "add", label: "添加" },
            { value: "skip", label: "跳过" },
          ],
          modified: [
            { value: "keep", label: "保留本地" },
            { value: "overwrite", label: "覆盖本地" },
          ],
          deleted: [
            { value: "keep", label: "保留本地" },
            { value: "delete", label: "确认删除" },
          ],
          diverged: [
            { value: "keep", label: "保留本地" },
            { value: "overwrite", label: "覆盖本地" },
            { value: "saveas", label: "另存新编号" },
          ],
          positionDuplicates: [
            { value: "skip", label: "跳过" },
            { value: "merge", label: "合并到本地" },
            { value: "keepboth", label: "两者都保留" },
          ],
        },
        dives: {
          new: [
            { value: "add", label: "添加" },
            { value: "skip", label: "跳过" },
          ],
          modified: [
            { value: "keep", label: "保留本地" },
            { value: "overwrite", label: "覆盖本地" },
          ],
          deleted: [
            { value: "keep", label: "保留本地" },
            { value: "delete", label: "确认删除" },
          ],
          diverged: [
            { value: "keep", label: "保留本地" },
            { value: "overwrite", label: "覆盖本地" },
            { value: "saveas", label: "另存新编号" },
          ],
        },
        measurements: {
          new: [
            { value: "add", label: "添加" },
            { value: "skip", label: "跳过" },
          ],
          modified: [
            { value: "keep", label: "保留本地" },
            { value: "overwrite", label: "覆盖本地" },
          ],
          deleted: [
            { value: "keep", label: "保留本地" },
            { value: "delete", label: "确认删除" },
          ],
          diverged: [
            { value: "keep", label: "保留本地" },
            { value: "overwrite", label: "覆盖本地" },
            { value: "saveas", label: "另存新编号" },
          ],
        },
      };

      return options[entity]?.[category] || [];
    }

    function getAttachmentResolutionOptions(attCategory) {
      const options = {
        new: [
          { value: "add", label: "添加" },
          { value: "skip", label: "跳过" },
        ],
        sameNameDiffImage: [
          { value: "keep", label: "保留本地" },
          { value: "overwrite", label: "覆盖本地" },
          { value: "keepboth", label: "两者都保留" },
        ],
        metaChanged: [
          { value: "keep", label: "保留本地" },
          { value: "overwrite", label: "覆盖本地" },
          { value: "merge", label: "合并说明" },
        ],
        deleted: [
          { value: "keep", label: "保留本地" },
          { value: "delete", label: "确认删除" },
        ],
      };
      return options[attCategory] || [];
    }

    function getAttachmentCategoryLabel(category) {
      const labels = {
        new: "新增附件",
        sameNameDiffImage: "同名不同图",
        metaChanged: "描述/角度变化",
        unchanged: "未变更附件",
        deleted: "删除附件",
      };
      return labels[category] || category;
    }

    function renderAttachmentThumbnail(att, size = 64) {
      if (!att) return "";
      const thumb = att.thumbnail || att.fullImage || "";
      if (!thumb) {
        return `<div class="attachment-thumb-placeholder" style="width:${size}px;height:${size}px;">🖼️</div>`;
      }
      return `<img src="${thumb}" alt="${escapeHtml(att.name || '')}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:6px;">`;
    }

    function renderAttachmentItems(attachmentsAnalysis, markResolutions, markIdx) {
      if (!attachmentsAnalysis) return "";
      const categories = ["new", "sameNameDiffImage", "metaChanged", "deleted"];
      const attResolutions = markResolutions || {};

      let html = '<div class="attachment-merge-section">';
      let hasContent = false;

      categories.forEach((attCat) => {
        const items = attachmentsAnalysis[attCat];
        if (!Array.isArray(items) || items.length === 0) return;
        hasContent = true;
        const catLabel = getAttachmentCategoryLabel(attCat);
        const options = getAttachmentResolutionOptions(attCat);
        const resolutions = attResolutions[attCat] || [];

        html += `<div class="attachment-merge-category">`;
        html += `<div class="attachment-merge-category-header"><b>${catLabel}</b><span class="muted small"> (${items.length})</span></div>`;
        html += `<div class="attachment-merge-list">`;

        items.forEach((item, attIdx) => {
          const resolution = resolutions[attIdx] || item.resolution || "keep";
          const localAtt = item.local;
          const importAtt = item.imported;
          const displayAtt = importAtt || localAtt;
          const sizeKB = displayAtt ? ((displayAtt.size || 0) / 1024).toFixed(1) : 0;
          const angleLabel = displayAtt ? (angleNames[displayAtt.angle] || displayAtt.angle || "未设置") : "";

          html += `<div class="attachment-merge-item" data-mark-idx="${markIdx}" data-att-cat="${attCat}" data-att-idx="${attIdx}">`;
          html += `<div class="attachment-merge-item-body">`;

          if (attCat === "new") {
            html += `<div class="attachment-compare-single">`;
            html += renderAttachmentThumbnail(importAtt);
            html += `<div class="attachment-merge-info">`;
            html += `<div class="attachment-merge-name">📥 ${escapeHtml(displayAtt?.name || '未命名')}</div>`;
            html += `<div class="muted small">${sizeKB} KB · ${displayAtt?.width || 0}×${displayAtt?.height || 0}</div>`;
            if (displayAtt?.angle) html += `<div class="muted small">角度: ${escapeHtml(angleLabel)}</div>`;
            if (displayAtt?.description) html += `<div class="muted small">说明: ${escapeHtml(displayAtt.description)}</div>`;
            html += `</div></div>`;
          } else if (attCat === "deleted") {
            html += `<div class="attachment-compare-single">`;
            html += renderAttachmentThumbnail(localAtt);
            html += `<div class="attachment-merge-info">`;
            html += `<div class="attachment-merge-name">🗑️ ${escapeHtml(displayAtt?.name || '未命名')}</div>`;
            html += `<div class="muted small">${sizeKB} KB · ${displayAtt?.width || 0}×${displayAtt?.height || 0}</div>`;
            html += `</div></div>`;
          } else {
            html += `<div class="attachment-compare-pair">`;
            html += `<div class="attachment-compare-side">`;
            html += `<div class="muted small">本地</div>`;
            html += renderAttachmentThumbnail(localAtt);
            html += `<div class="attachment-merge-info">`;
            const localAngle = localAtt ? (angleNames[localAtt.angle] || localAtt.angle || "") : "";
            if (localAngle) html += `<div class="muted small">角度: ${escapeHtml(localAngle)}</div>`;
            if (localAtt?.description) html += `<div class="muted small">说明: ${escapeHtml(localAtt.description)}</div>`;
            html += `</div></div>`;
            html += `<div class="attachment-compare-arrow">→</div>`;
            html += `<div class="attachment-compare-side">`;
            html += `<div class="muted small">导入</div>`;
            html += renderAttachmentThumbnail(importAtt);
            html += `<div class="attachment-merge-info">`;
            const importAngle = importAtt ? (angleNames[importAtt.angle] || importAtt.angle || "") : "";
            if (importAngle) html += `<div class="muted small">角度: ${escapeHtml(importAngle)}</div>`;
            if (importAtt?.description) html += `<div class="muted small">说明: ${escapeHtml(importAtt.description)}</div>`;
            html += `</div></div>`;
            html += `</div>`;
          }

          if (item.note) {
            html += `<div class="merge-item-note">⚠️ ${escapeHtml(item.note)}</div>`;
          }
          if (item.diff && item.diff.changed && item.diff.changed.length > 0) {
            html += `<div class="attachment-diff-summary">`;
            item.diff.changed.forEach((c) => {
              const fieldLabel = {
                name: "文件名",
                size: "大小",
                width: "宽度",
                height: "高度",
                angle: "角度",
                description: "说明",
                content: "图片内容",
              };
              html += `<span class="diff-tag">${escapeHtml(fieldLabel[c.field] || c.field)}</span>`;
            });
            html += `</div>`;
          }

          html += `</div>`;
          html += `<div class="attachment-merge-actions">`;
          html += `<select data-att-resolution data-att-cat="${attCat}" data-mark-idx="${markIdx}" data-att-idx="${attIdx}">`;
          options.forEach((opt) => {
            html += `<option value="${opt.value}" ${resolution === opt.value ? "selected" : ""}>${opt.label}</option>`;
          });
          html += `</select>`;
          html += `</div>`;
          html += `</div>`;
        });

        html += `</div></div>`;
      });

      html += `</div>`;
      return hasContent ? html : "";
    }

    function renderMergeList() {
      const data = getAnalysisData(currentEntity);
      const items = data[currentCategory] || [];
      const resolutions = getResolutions(currentEntity, currentCategory);

      if (items.length === 0) {
        return (
          '<div class="merge-list"><div class="merge-empty"><div class="merge-empty-icon">📭</div><div>暂无' +
          getCategoryLabel(currentCategory) +
          "的数据</div></div></div>"
        );
      }

      let html = '<div class="merge-list">';

      items.forEach((item, idx) => {
        const resolution = resolutions[idx] || item.resolution || "keep";
        const options = getResolutionOptions(currentEntity, currentCategory);

        let title = "";
        let subtitle = "";
        let typePill = "";
        let noteHtml = "";
        let diffHtml = "";

        if (currentEntity === "marks") {
          const mark = item.imported || item.local || item.importedMark || item.localMark;
          title = mark.code || "未命名";
          subtitle = (mark.dive || "") + " · " + (mark.depth || "");
          typePill =
            '<span class="pill ' +
            (mark.type || "unknown") +
            '">' +
            (typeNames[mark.type] || "未知") +
            "</span>";
          const sampleNo = mark.sampling?.sampleNo;
          if (sampleNo) {
            typePill += ' <span class="pill pill-sampling small">🧪 ' + escapeHtml(sampleNo) + '</span>';
          }
          if (item.hasAttachmentChanges && item.attachments) {
            const attSummary = item.attachments;
            const attBadgeParts = [];
            if (attSummary.new && attSummary.new.length > 0) attBadgeParts.push(`➕${attSummary.new.length}`);
            if (attSummary.sameNameDiffImage && attSummary.sameNameDiffImage.length > 0) attBadgeParts.push(`🔄${attSummary.sameNameDiffImage.length}`);
            if (attSummary.metaChanged && attSummary.metaChanged.length > 0) attBadgeParts.push(`✏️${attSummary.metaChanged.length}`);
            if (attSummary.deleted && attSummary.deleted.length > 0) attBadgeParts.push(`🗑️${attSummary.deleted.length}`);
            if (attBadgeParts.length > 0) {
              typePill += ' <span class="pill pill-attachments small" title="附件变化">📷 ' + attBadgeParts.join(" ") + "</span>";
            }
          }

          if (currentCategory === "positionDuplicates") {
            const dist = item.distance || 0;
            noteHtml =
              '<div class="merge-item-note">⚠️ 位置接近，距离约 ' +
              dist.toFixed(2) +
              "%，可能为同一标记</div>";
          }
          if (item.note) {
            noteHtml = '<div class="merge-item-note">⚠️ ' + escapeHtml(item.note) + "</div>";
          }
          const sampling = mark.sampling || {};
          const hasSamplingDetail = sampling.sampleMethod || sampling.sampler || sampling.sampleTime;
          if (hasSamplingDetail) {
            const parts = [];
            if (sampling.sampleMethod) parts.push('方式: ' + escapeHtml(sampling.sampleMethod));
            if (sampling.sampler) parts.push('采样人: ' + escapeHtml(sampling.sampler));
            if (sampling.sampleTime) parts.push('时间: ' + escapeHtml(sampling.sampleTime));
            noteHtml = (noteHtml || '') + '<div class="merge-item-note merge-item-sampling">🧪 ' + parts.join(' · ') + '</div>';
          }
          if (item.diff) {
            diffHtml = renderDiff(item.diff);
          }
          if (item.hasAttachmentChanges && item.attachments) {
            const markAttResolutions = (attachmentResolutions[currentCategory] || [])[idx];
            const attHtml = renderAttachmentItems(item.attachments, markAttResolutions, idx);
            if (attHtml) {
              diffHtml = (diffHtml || '') + attHtml;
            }
          }
        } else if (currentEntity === "dives") {
          const dive = item.imported || item.local;
          title = dive.code || "未命名";
          subtitle = (dive.date || "") + " · " + (dive.leader || "");
          typePill =
            '<span class="pill">' + (weatherNames[dive.weather] || "未知") + "</span>";

          if (item.note) {
            noteHtml = '<div class="merge-item-note">⚠️ ' + escapeHtml(item.note) + "</div>";
          }
          if (item.diff) {
            diffHtml = renderDiff(item.diff);
          }
        } else if (currentEntity === "measurements") {
          const meas = item.imported || item.local;
          title = meas.code || "未命名";
          subtitle = (meas.dive || "") + " · " + (meas.length || 0) + "米";
          typePill = '<span class="pill pill-measure">测距</span>';

          if (item.note) {
            noteHtml = '<div class="merge-item-note">⚠️ ' + escapeHtml(item.note) + "</div>";
          }
        }

        html += '<div class="merge-item" data-index="' + idx + '">';
        html += '<div class="merge-item-header">';
        html += '<div class="merge-item-title">';
        html += "<b>" + escapeHtml(title) + "</b>";
        html += typePill;
        html += '<span class="muted small">' + escapeHtml(subtitle) + "</span>";
        html += "</div>";
        html += '<div class="merge-item-actions">';
        html +=
          '<select data-resolution data-entity="' +
          currentEntity +
          '" data-category="' +
          currentCategory +
          '" data-index="' +
          idx +
          '">';
        options.forEach((opt) => {
          html +=
            '<option value="' +
            opt.value +
            '" ' +
            (resolution === opt.value ? "selected" : "") +
            ">" +
            opt.label +
            "</option>";
        });
        html += "</select>";
        html +=
          '<button type="button" class="secondary small" data-toggle-detail data-entity="' +
          currentEntity +
          '" data-category="' +
          currentCategory +
          '" data-index="' +
          idx +
          '">详情</button>';
        html += "</div></div>";

        if (noteHtml) {
          html += noteHtml;
        }
        if (diffHtml) {
          html += '<div class="merge-item-detail-wrapper hidden">' + diffHtml + "</div>";
        }
        html += "</div>";
      });

      html += "</div>";
      return html;
    }

    function renderErrors() {
      const data = getAnalysisData(currentEntity);
      const errors = data.errors || [];

      if (errors.length === 0) return "";

      let html = '<div class="merge-error">';
      html += "<b>验证错误 (" + errors.length + " 项)</b>";
      html += "<ul>";
      errors.forEach((err) => {
        const code =
          (err.mark && err.mark.code) ||
          (err.dive && err.dive.code) ||
          (err.measurement && err.measurement.code) ||
          "第 " + (err.index + 1) + " 项";
        html +=
          "<li><b>" +
          escapeHtml(code) +
          "</b>: " +
          escapeHtml((err.errors || []).join("; ")) +
          "</li>";
      });
      html += "</ul></div>";
      return html;
    }

    function render() {
      const exportDate = analysis.exportDate
        ? new Date(analysis.exportDate).toLocaleString("zh-CN")
        : "未知";
      const deviceName = analysis.deviceName || analysis.deviceId || "未知设备";

      let html = "<h2>离线数据合并预览</h2>";

      html += '<div class="merge-header">';
      html += '<div class="merge-device-info">';
      html +=
        "<div><span class='muted'>设备编号</span><b>" +
        escapeHtml(analysis.deviceId || "未知") +
        "</b></div>";
      html +=
        "<div><span class='muted'>设备名称</span><b>" +
        escapeHtml(deviceName) +
        "</b></div>";
      html +=
        "<div><span class='muted'>导出时间</span><b>" +
        escapeHtml(exportDate) +
        "</b></div>";
      html += "</div>";
      html +=
        '<div class="muted small">请逐项确认合并方式，确认后将应用到当前项目数据。</div>';
      html += "</div>";

      html += renderEntityTabs();
      html += renderSummary();
      html += renderErrors();
      html += renderMergeList();

      html += '<div class="merge-toolbar">';
      html += '<div class="merge-toolbar-left">';
      html +=
        '<span class="muted">批量操作:</span>';
      html +=
        '<select class="merge-batch-select" id="batchSelect"><option value="">选择批量操作...</option>';
      const batchOptions = getResolutionOptions(currentEntity, currentCategory);
      batchOptions.forEach((opt) => {
        html +=
          '<option value="' + opt.value + '">全部' + opt.label + "</option>";
      });
      html += "</select>";
      html += "</div>";
      html += '<div class="merge-toolbar-right">';
      html +=
        '<button type="button" class="secondary" id="cancelMergeBtn">取消</button>';
      html +=
        '<button type="button" class="merge-apply-all-btn" id="confirmMergeBtn">确认合并</button>';
      html += "</div></div>";

      modal.innerHTML = html;
      bindEvents();
    }

    function bindEvents() {
      modal.querySelectorAll(".merge-entity-tab").forEach((tab) => {
        tab.onclick = () => {
          currentEntity = tab.dataset.entity;
          currentCategory = "new";
          render();
        };
      });

      modal.querySelectorAll(".merge-summary-item").forEach((item) => {
        item.onclick = () => {
          currentCategory = item.dataset.category;
          render();
        };
      });

      modal.querySelectorAll("[data-resolution]").forEach((select) => {
        select.onchange = (e) => {
          const entity = e.target.dataset.entity;
          const category = e.target.dataset.category;
          const idx = parseInt(e.target.dataset.index);
          const resolutions = getResolutions(entity, category);
          if (resolutions[idx] !== undefined) {
            resolutions[idx] = e.target.value;
          }
        };
      });

      modal.querySelectorAll("[data-att-resolution]").forEach((select) => {
        select.onchange = (e) => {
          const attCat = e.target.dataset.attCat;
          const markIdx = parseInt(e.target.dataset.markIdx);
          const attIdx = parseInt(e.target.dataset.attIdx);
          const category = currentCategory;
          const markAttResolutions = attachmentResolutions[category]?.[markIdx];
          if (markAttResolutions && markAttResolutions[attCat] && markAttResolutions[attCat][attIdx] !== undefined) {
            markAttResolutions[attCat][attIdx] = e.target.value;
          }
        };
      });

      modal.querySelectorAll("[data-toggle-detail]").forEach((btn) => {
        btn.onclick = (e) => {
          const idx = parseInt(e.target.dataset.index);
          const item = modal.querySelector(
            '.merge-item[data-index="' + idx + '"]'
          );
          const detail = item.querySelector(".merge-item-detail-wrapper");
          if (detail) {
            detail.classList.toggle("hidden");
            btn.textContent = detail.classList.contains("hidden") ? "详情" : "收起";
          }
        };
      });

      const batchSelect = modal.querySelector("#batchSelect");
      if (batchSelect) {
        batchSelect.onchange = (e) => {
          const value = e.target.value;
          if (!value) return;

          const resolutions = getResolutions(currentEntity, currentCategory);
          resolutions.forEach((_, idx) => {
            resolutions[idx] = value;
            const select = modal.querySelector(
              '[data-resolution][data-entity="' +
                currentEntity +
                '"][data-category="' +
                currentCategory +
                '"][data-index="' +
                idx +
                '"]'
            );
            if (select) select.value = value;
          });

          batchSelect.value = "";
        };
      }

      modal.querySelector("#confirmMergeBtn").onclick = () => {
        document.body.removeChild(backdrop);
        onConfirm({
          markResolutions,
          diveResolutions,
          measurementResolutions,
          attachmentResolutions,
        });
      };

      modal.querySelector("#cancelMergeBtn").onclick = () => {
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

    render();
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  }

  function showRollbackNotice(snapshotDate, onRollback) {
    const notice = document.createElement("div");
    notice.className = "rollback-notice";
    notice.id = "rollbackNotice";

    const dateStr = snapshotDate
      ? new Date(snapshotDate).toLocaleString("zh-CN")
      : "未知时间";

    notice.innerHTML =
      '<span>⚠️ 最近一次合并前的快照可用（' +
      escapeHtml(dateStr) +
      '），如有问题可撤销合并。</span>' +
      '<button type="button" id="rollbackBtn">撤销合并</button>';

    const header = document.querySelector("header");
    if (header && !document.querySelector("#rollbackNotice")) {
      header.after(notice);
    }

    const rollbackBtn = document.querySelector("#rollbackBtn");
    if (rollbackBtn) {
      rollbackBtn.onclick = () => {
        if (confirm("确定要撤销最近一次合并操作吗？这将恢复到合并前的状态。")) {
          onRollback();
          notice.remove();
        }
      };
    }
  }

  function hideRollbackNotice() {
    const notice = document.querySelector("#rollbackNotice");
    if (notice) {
      notice.remove();
    }
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.style.cssText =
      "position:fixed;top:24px;right:24px;padding:12px 20px;background:#1d6c78;color:#fff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.3);z-index:2000;animation:slideIn .3s ease;";
    if (type === "error") toast.style.background = "#c0392b";
    if (type === "success") toast.style.background = "#28a745";
    if (type === "warning") toast.style.background = "#ffc107";
    if (type === "warning") toast.style.color = "#856404";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "slideOut .3s ease forwards";
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 2500);
  }

  async function handleAddAttachment() {
    try {
      const file = await DataIO.triggerImageInput();
      const capacity = DataIO.checkStorageCapacity(file.size * 3);

      if (capacity.willExceed) {
        showToast("存储空间不足，无法添加此图片", "error");
        return;
      }

      if (capacity.willWarn) {
        showToast("存储空间接近上限，建议清理或导出备份", "warning");
      }

      const attachment = await DataIO.processImageFile(file);
      currentAttachments.push(attachment);
      renderAttachments();
      renderStorageInfo();
      showToast("图片添加成功", "success");
    } catch (e) {
      if (e.message !== "No file selected" && e.message !== "File selection cancelled") {
        showToast("添加图片失败: " + e.message, "error");
      }
    }
  }

  function renderAttachments() {
    if (currentAttachments.length === 0) {
      elements.attachmentsList.innerHTML = "";
      elements.attachmentsEmpty.classList.remove("hidden");
      return;
    }

    elements.attachmentsEmpty.classList.add("hidden");

    elements.attachmentsList.innerHTML = currentAttachments.map((att, index) => {
      const sizeKB = (att.size / 1024).toFixed(1);
      const angleLabel = angleNames[att.angle] || att.angle || "未设置";

      return `
        <div class="attachment-card" data-id="${att.id}">
          <div class="attachment-thumbnail" data-action="preview">
            <img src="${att.thumbnail}" alt="${att.name}">
          </div>
          <div class="attachment-info">
            <div class="attachment-name" title="${att.name}">${att.name}</div>
            <div class="attachment-meta">
              <span class="muted small">${sizeKB} KB</span>
              <span class="muted small">${att.width}×${att.height}</span>
            </div>
            <div class="attachment-fields">
              <select class="attachment-angle" data-id="${att.id}">
                <option value="">拍摄角度</option>
                <option value="top" ${att.angle === "top" ? "selected" : ""}>俯视</option>
                <option value="side" ${att.angle === "side" ? "selected" : ""}>侧视</option>
                <option value="front" ${att.angle === "front" ? "selected" : ""}>正视</option>
                <option value="back" ${att.angle === "back" ? "selected" : ""}>后视</option>
                <option value="detail" ${att.angle === "detail" ? "selected" : ""}>细节</option>
                <option value="overview" ${att.angle === "overview" ? "selected" : ""}>全景</option>
                <option value="other" ${att.angle === "other" ? "selected" : ""}>其他</option>
              </select>
              <input type="text" class="attachment-desc" data-id="${att.id}" 
                     placeholder="图片说明..." value="${att.description || ''}">
            </div>
            <div class="attachment-actions">
              <button type="button" class="secondary small" data-action="preview" data-id="${att.id}">查看大图</button>
              <button type="button" class="secondary danger small" data-action="remove" data-id="${att.id}">移除</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    elements.attachmentsList.querySelectorAll("[data-action='remove']").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        removeAttachment(id);
      };
    });

    elements.attachmentsList.querySelectorAll("[data-action='preview']").forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const id = el.dataset.id || el.closest(".attachment-card").dataset.id;
        showImagePreview(id);
      };
    });

    elements.attachmentsList.querySelectorAll(".attachment-angle").forEach(select => {
      select.onchange = (e) => {
        const id = e.target.dataset.id;
        updateAttachmentAngle(id, e.target.value);
      };
    });

    elements.attachmentsList.querySelectorAll(".attachment-desc").forEach(input => {
      input.onchange = (e) => {
        const id = e.target.dataset.id;
        updateAttachmentDescription(id, e.target.value);
      };
    });
  }

  function removeAttachment(id) {
    if (!confirm("确定要移除这张图片吗？")) return;
    currentAttachments = currentAttachments.filter(a => a.id !== id);
    renderAttachments();
    renderStorageInfo();
    showToast("图片已移除", "info");
  }

  function updateAttachmentAngle(id, angle) {
    const attachment = currentAttachments.find(a => a.id === id);
    if (attachment) {
      attachment.angle = angle;
    }
  }

  function updateAttachmentDescription(id, description) {
    const attachment = currentAttachments.find(a => a.id === id);
    if (attachment) {
      attachment.description = description;
    }
  }

  function showImagePreview(id) {
    const attachment = currentAttachments.find(a => a.id === id);
    if (!attachment || !attachment.fullImage) return;

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal modal-image-preview";

    let html = '<div class="image-preview-container">';
    html += '<img src="' + attachment.fullImage + '" alt="' + attachment.name + '">';
    html += '</div>';
    html += '<div class="image-preview-info">';
    html += '<h3>' + attachment.name + '</h3>';
    html += '<div class="muted">';
    html += attachment.width + '×' + attachment.height + ' 像素 · ';
    html += (attachment.size / 1024).toFixed(1) + ' KB';
    if (attachment.angle) {
      html += ' · 角度: ' + (angleNames[attachment.angle] || attachment.angle);
    }
    html += '</div>';
    if (attachment.description) {
      html += '<div class="image-preview-desc">' + attachment.description + '</div>';
    }
    html += '<div class="toolbar" style="margin-top:12px">';
    html += '<button type="button" class="secondary" id="closePreviewBtn">关闭</button>';
    html += '</div>';
    html += '</div>';

    modal.innerHTML = html;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    modal.querySelector("#closePreviewBtn").onclick = () => {
      document.body.removeChild(backdrop);
    };

    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        document.body.removeChild(backdrop);
      }
    };
  }

  function renderStorageInfo() {
    const usage = DataIO.getStorageUsage();
    const percent = (usage.usagePercent * 100).toFixed(1);
    let statusClass = "storage-ok";
    if (usage.usagePercent >= 0.9) statusClass = "storage-danger";
    else if (usage.isNearLimit) statusClass = "storage-warning";

    elements.storageInfo.innerHTML = `
      <div class="storage-bar">
        <div class="storage-bar-fill ${statusClass}" style="width: ${percent}%"></div>
      </div>
      <div class="storage-text muted small">
        已用 ${usage.usedMB} MB / 约 ${usage.estimatedQuotaMB} MB
        <span class="storage-badge ${statusClass}">${percent}%</span>
      </div>
    `;
  }

  function getCurrentAttachments() {
    return currentAttachments.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      size: a.size,
      width: a.width,
      height: a.height,
      thumbnail: a.thumbnail,
      fullImage: a.fullImage,
      angle: a.angle || "",
      description: a.description || "",
      createdAt: a.createdAt,
    }));
  }

  function handleAddParticipant() {
    currentParticipants.push({ name: "", role: "", equipment: "" });
    renderParticipants();
  }

  function renderParticipants() {
    const container = elements.participantsList;
    const emptyTip = elements.participantsEmpty;

    if (currentParticipants.length === 0) {
      container.innerHTML = "";
      emptyTip.classList.remove("hidden");
      return;
    }

    emptyTip.classList.add("hidden");

    container.innerHTML = currentParticipants.map((p, idx) => {
      return '<div class="participant-item" data-idx="' + idx + '">' +
        '<div class="participant-fields">' +
        '<input type="text" class="participant-name" placeholder="姓名" value="' + escapeHtml(p.name) + '">' +
        '<input type="text" class="participant-role" placeholder="岗位（如：采样员）" value="' + escapeHtml(p.role) + '">' +
        '<input type="text" class="participant-equipment" placeholder="使用设备" value="' + escapeHtml(p.equipment) + '">' +
        '</div>' +
        '<button type="button" class="secondary small participant-remove" data-idx="' + idx + '" title="删除">✕</button>' +
        '</div>';
    }).join("");

    container.querySelectorAll(".participant-name").forEach((input, idx) => {
      input.oninput = () => { currentParticipants[idx].name = input.value; };
    });
    container.querySelectorAll(".participant-role").forEach((input, idx) => {
      input.oninput = () => { currentParticipants[idx].role = input.value; };
    });
    container.querySelectorAll(".participant-equipment").forEach((input, idx) => {
      input.oninput = () => { currentParticipants[idx].equipment = input.value; };
    });
    container.querySelectorAll(".participant-remove").forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx, 10);
        currentParticipants.splice(idx, 1);
        renderParticipants();
      };
    });
  }

  function getCurrentParticipants() {
    return currentParticipants.map(p => ({
      name: p.name || "",
      role: p.role || "",
      equipment: p.equipment || "",
    }));
  }

  const CSV_FIELD_LABELS = {
    dataType: "数据类型",
    code: "编号",
    type: "类型",
    dive: "潜次",
    depth: "深度",
    x: "X坐标",
    y: "Y坐标",
    orientation: "朝向",
    condition: "保存状态",
    note: "备注",
    sampleNo: "样品编号",
    sampleMethod: "采样方式",
    sampler: "采样人",
    sampleTime: "采样时间",
    date: "日期",
    leader: "负责人",
    weather: "天气",
    current: "水流",
    visibility: "能见度",
    objective: "任务目标",
    participants: "参与人员",
    length: "长度",
    x1: "起点X坐标",
    y1: "起点Y坐标",
    x2: "终点X坐标",
    y2: "终点Y坐标",
    points: "坐标点序列",
    relatedMarks: "关联标记",
  };

  const CSV_FIELDS_BY_TYPE = {
    common: ["dataType", "code", "dive"],
    mark: ["type", "depth", "x", "y", "orientation", "condition", "note", "sampleNo", "sampleMethod", "sampler", "sampleTime"],
    dive: ["date", "leader", "weather", "current", "visibility", "objective", "participants"],
    measurement: ["length", "x1", "y1", "x2", "y2", "points", "relatedMarks"],
  };

  const CSV_FIELDS_ORDER = [
    "dataType",
    "code",
    "type",
    "dive",
    "date",
    "leader",
    "weather",
    "current",
    "visibility",
    "objective",
    "participants",
    "depth",
    "x",
    "y",
    "orientation",
    "condition",
    "note",
    "sampleNo",
    "sampleMethod",
    "sampler",
    "sampleTime",
    "length",
    "x1",
    "y1",
    "x2",
    "y2",
    "points",
    "relatedMarks",
  ];

  function getFieldRequiredInfo(field, dataType) {
    const markRequired = ["code", "type", "dive", "depth"];
    const diveRequired = ["code", "date", "leader", "visibility", "objective"];
    const measurementRequired = ["code", "dive", "length"];

    if (dataType === "mark" && markRequired.includes(field)) return true;
    if (dataType === "dive" && diveRequired.includes(field)) return true;
    if (dataType === "measurement" && measurementRequired.includes(field)) return true;
    return false;
  }

  function showCSVFieldMappingPreview(csvParseResult, onConfirm, onCancel) {
    const { headers, mapping, rows, marks = [], dives = [], measurements = [] } = csvParseResult;
    const currentMapping = { ...mapping };

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal modal-csv";

    const hasMarks = marks.length > 0;
    const hasDives = dives.length > 0;
    const hasMeasurements = measurements.length > 0;

    let html = "<h2>CSV 字段映射</h2>";
    html += '<div class="muted" style="margin-bottom:16px;">请确认 CSV 列与系统字段的对应关系，可通过下拉菜单调整。</div>';

    html += '<div class="summary-bar">';
    html += '<span class="pill">共 ' + rows.length + ' 行数据</span>';
    if (hasMarks) html += '<span class="pill pill-mark">标记 ' + marks.length + ' 项</span>';
    if (hasDives) html += '<span class="pill pill-dive">潜次 ' + dives.length + ' 项</span>';
    if (hasMeasurements) html += '<span class="pill pill-measurement">测距 ' + measurements.length + ' 项</span>';
    html += '</div>';

    const typeSections = [];
    if (hasMarks) typeSections.push({ type: "common", title: "通用字段" });
    if (hasMarks) typeSections.push({ type: "mark", title: "标记字段" });
    if (hasDives) typeSections.push({ type: "dive", title: "潜次字段" });
    if (hasMeasurements) typeSections.push({ type: "measurement", title: "测距字段" });

    const seenFields = new Set();
    typeSections.forEach((section) => {
      const fields = CSV_FIELDS_BY_TYPE[section.type] || [];
      const visibleFields = fields.filter(f => !seenFields.has(f));
      visibleFields.forEach(f => seenFields.add(f));

      if (visibleFields.length === 0) return;

      html += '<div class="csv-mapping-section">';
      html += '<h3 class="csv-section-title csv-section-' + section.type + '">' + section.title + '</h3>';
      html += '<div class="csv-mapping-grid">';
      visibleFields.forEach((field) => {
        const label = CSV_FIELD_LABELS[field];
        const isRequired = getFieldRequiredInfo(field, section.type);
        const currentHeader = currentMapping[field] || "";

        html += '<div class="csv-mapping-row" data-field-type="' + section.type + '">';
        html += '<div class="csv-mapping-label">';
        html += '<span>' + label + '</span>';
        if (isRequired) html += '<span class="csv-required">*</span>';
        html += '</div>';
        html += '<select data-mapping-field="' + field + '">';
        html += '<option value="">-- 不映射 --</option>';
        headers.forEach((h) => {
          html += '<option value="' + escapeHtml(h) + '"' + (currentHeader === h ? " selected" : "") + ">" + escapeHtml(h) + "</option>";
        });
        html += "</select>";
        html += "</div>";
      });
      html += "</div>";
      html += "</div>";
    });

    html += '<div class="csv-preview-section">';
    html += '<h3>数据预览（前 ' + Math.min(rows.length, 5) + ' 行）</h3>';
    html += '<div class="csv-preview-table-wrapper">';
    html += '<table class="csv-preview-table">';
    html += "<thead><tr>";
    html += '<th style="width:50px;">行号</th>';
    headers.forEach((h) => {
      html += "<th>" + escapeHtml(h) + "</th>";
    });
    html += "</tr></thead>";
    html += "<tbody>";
    rows.slice(0, 5).forEach((row, idx) => {
      html += "<tr>";
      html += '<td class="csv-row-num">' + (idx + 2) + "</td>";
      headers.forEach((h) => {
        const val = row[h] || "";
        html += "<td>" + escapeHtml(val.length > 20 ? val.slice(0, 20) + "..." : val) + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    html += "</div>";
    html += "</div>";

    html += '<div class="toolbar" style="margin-top:16px">';
    html += '<button type="button" id="confirmCSVMappingBtn">确认映射并继续</button>';
    html += '<button type="button" class="secondary" id="cancelCSVMappingBtn">取消</button>';
    html += "</div>";

    modal.innerHTML = html;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    modal.querySelectorAll("[data-mapping-field]").forEach((select) => {
      select.onchange = (e) => {
        const field = e.target.dataset.mappingField;
        currentMapping[field] = e.target.value || undefined;
      };
    });

    modal.querySelector("#confirmCSVMappingBtn").onclick = () => {
      document.body.removeChild(backdrop);
      onConfirm(currentMapping);
    };

    modal.querySelector("#cancelCSVMappingBtn").onclick = () => {
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

  function renderCSVMarkSection(markComparison, markResolutions, modal) {
    let html = "";
    if (!markComparison) return html;

    html += '<div class="preview-section">';
    html += '<h3 class="csv-section-title csv-section-mark">标记数据</h3>';
    html += '<div class="summary-bar">';
    html += '<span class="pill">共 ' + markComparison.summary.total + " 项</span>";
    html += '<span class="pill pill-new">新增 ' + markComparison.summary.new + " 项</span>";
    html += '<span class="pill pill-conflict">冲突 ' + markComparison.summary.conflict + " 项</span>";
    html += '<span class="pill pill-error">错误 ' + markComparison.summary.error + " 项</span>";
    html += "</div>";

    if (markComparison.newMarks && markComparison.newMarks.length > 0) {
      html += '<div class="preview-list">';
      markComparison.newMarks.forEach((mark) => {
        const sampleNo = mark.sampling?.sampleNo;
        const sampleBadge = sampleNo ? ' <span class="pill pill-sampling small">🧪 ' + escapeHtml(sampleNo) + '</span>' : '';
        const sampling = mark.sampling || {};
        const hasSamplingDetail = sampling.sampleMethod || sampling.sampler || sampling.sampleTime;
        let samplingDetail = '';
        if (hasSamplingDetail) {
          const parts = [];
          if (sampling.sampleMethod) parts.push('方式: ' + escapeHtml(sampling.sampleMethod));
          if (sampling.sampler) parts.push('采样人: ' + escapeHtml(sampling.sampler));
          if (sampling.sampleTime) parts.push('时间: ' + escapeHtml(sampling.sampleTime));
          samplingDetail = '<div class="preview-item-detail muted small">' + parts.join(' · ') + '</div>';
        }
        html +=
          '<div class="preview-item"><div><span><b>' +
          escapeHtml(mark.code) +
          "</b> " +
          escapeHtml(typeNames[mark.type] || mark.type) +
          ' · ' +
          escapeHtml(mark.dive) +
          " · " +
          escapeHtml(mark.depth) +
          sampleBadge +
          "</span><span class='pill pill-new'>新增</span></div>" + samplingDetail + "</div>";
      });
      html += "</div>";
    }

    if (markComparison.conflicts && markComparison.conflicts.length > 0) {
      html += '<div class="toolbar-3">';
      html += '<button type="button" class="secondary" data-bulk-mark-csv="keep">全部保留本地</button>';
      html += '<button type="button" class="secondary" data-bulk-mark-csv="overwrite">全部覆盖本地</button>';
      html += '<button type="button" class="secondary" data-bulk-mark-csv="saveas">全部另存新编号</button>';
      html += "</div>";
      html += '<div class="preview-list">';
      markComparison.conflicts.forEach((conflict, idx) => {
        const diff = conflict.reviewDiff;
        let reviewDiffHtml = "";
        if (diff && (diff.statusChanged || diff.commentChanged || diff.reviewerChanged)) {
          reviewDiffHtml = '<div class="conflict-review-diff">';
          if (diff.statusChanged) {
            reviewDiffHtml += '<div class="review-diff-row">';
            reviewDiffHtml += '<span class="muted small">状态:</span>';
            reviewDiffHtml +=
              '<span class="pill pill-review pill-review-' +
              diff.localStatus +
              '">本地:' +
              reviewStatusNames[diff.localStatus] +
              "</span>";
            reviewDiffHtml += '<span class="review-arrow">→</span>';
            reviewDiffHtml +=
              '<span class="pill pill-review pill-review-' +
              diff.importedStatus +
              '">导入:' +
              reviewStatusNames[diff.importedStatus] +
              "</span>";
            reviewDiffHtml += "</div>";
          }
          if (diff.commentChanged) {
            reviewDiffHtml += '<div class="review-diff-row">';
            reviewDiffHtml += '<span class="muted small">意见:</span>';
            reviewDiffHtml +=
              '<span class="conflict-local-val" title="' +
              escapeHtml(diff.localComment || "无") +
              '">本地: ' +
              escapeHtml((diff.localComment && diff.localComment.length > 20)
                ? diff.localComment.slice(0, 20) + "..."
                : diff.localComment || "无") +
              "</span>";
            reviewDiffHtml += '<span class="review-arrow">→</span>';
            reviewDiffHtml +=
              '<span class="conflict-imported-val" title="' +
              escapeHtml(diff.importedComment || "无") +
              '">导入: ' +
              escapeHtml((diff.importedComment && diff.importedComment.length > 20)
                ? diff.importedComment.slice(0, 20) + "..."
                : diff.importedComment || "无") +
              "</span>";
            reviewDiffHtml += "</div>";
          }
          if (diff.reviewerChanged) {
            reviewDiffHtml += '<div class="review-diff-row">';
            reviewDiffHtml += '<span class="muted small">审核人:</span>';
            reviewDiffHtml += '<span class="conflict-local-val">本地: ' + escapeHtml(diff.localReviewer || "未指定") + "</span>";
            reviewDiffHtml += '<span class="review-arrow">→</span>';
            reviewDiffHtml += '<span class="conflict-imported-val">导入: ' + escapeHtml(diff.importedReviewer || "未指定") + "</span>";
            reviewDiffHtml += "</div>";
          }
          reviewDiffHtml += "</div>";
        }
        const sampleNo = conflict.imported.sampling?.sampleNo;
        const sampleBadge = sampleNo ? ' <span class="pill pill-sampling small">🧪 ' + escapeHtml(sampleNo) + '</span>' : '';
        const sampling = conflict.imported.sampling || {};
        const hasSamplingDetail = sampling.sampleMethod || sampling.sampler || sampling.sampleTime;
        let samplingDetail = '';
        if (hasSamplingDetail) {
          const parts = [];
          if (sampling.sampleMethod) parts.push('方式: ' + escapeHtml(sampling.sampleMethod));
          if (sampling.sampler) parts.push('采样人: ' + escapeHtml(sampling.sampler));
          if (sampling.sampleTime) parts.push('时间: ' + escapeHtml(sampling.sampleTime));
          samplingDetail = '<div class="preview-item-detail muted small">' + parts.join(' · ') + '</div>';
        }
        html +=
          '<div class="preview-item preview-item-conflict" data-mark-conflict-csv-index="' +
          idx +
          '"><div class="preview-item-main"><span><b>' +
          escapeHtml(conflict.imported.code) +
          "</b> " +
          escapeHtml(typeNames[conflict.imported.type] || conflict.imported.type) +
          ' · ' +
          escapeHtml(conflict.imported.dive) +
          sampleBadge +
          "</span>";
        html += '<select data-mark-csv-resolution-index="' + idx + '">';
        html += '<option value="keep">保留本地</option>';
        html += '<option value="overwrite">覆盖本地</option>';
        html += '<option value="saveas">另存为新编号</option>';
        html += "</select></div>" + samplingDetail + reviewDiffHtml + "</div>";
      });
      html += "</div>";
    }

    if (markComparison.errors && markComparison.errors.length > 0) {
      html += '<div class="preview-list">';
      markComparison.errors.forEach((err) => {
        const lineInfo = err.lineNumber ? " (第 " + err.lineNumber + " 行)" : "";
        const code = err.mark && err.mark.code ? err.mark.code : "第 " + (err.index + 1) + " 项";
        html +=
          '<div class="preview-item"><span><b>' +
          escapeHtml(code) +
          "</b>" +
          lineInfo +
          "</span><span class='muted'>" +
          escapeHtml(err.errors.join("; ")) +
          "</span></div>";
      });
      html += "</div>";
    }
    html += "</div>";

    return html;
  }

  function renderCSVDiveSection(diveComparison, diveResolutions, modal) {
    let html = "";
    if (!diveComparison) return html;

    html += '<div class="preview-section">';
    html += '<h3 class="csv-section-title csv-section-dive">潜次数据</h3>';
    html += '<div class="summary-bar">';
    html += '<span class="pill">共 ' + diveComparison.summary.total + " 项</span>";
    html += '<span class="pill pill-new">新增 ' + diveComparison.summary.new + " 项</span>";
    html += '<span class="pill pill-conflict">冲突 ' + diveComparison.summary.conflict + " 项</span>";
    html += '<span class="pill pill-error">错误 ' + diveComparison.summary.error + " 项</span>";
    html += "</div>";

    if (diveComparison.newDives && diveComparison.newDives.length > 0) {
      html += '<div class="preview-list">';
      diveComparison.newDives.forEach((dive) => {
        html +=
          '<div class="preview-item"><div><span><b>' +
          escapeHtml(dive.code) +
          "</b> " +
          escapeHtml(dive.date || "") +
          ' · ' +
          escapeHtml(dive.leader || "") +
          "</span><span class='pill pill-new'>新增</span></div>";
        if (dive.objective) {
          html += '<div class="preview-item-detail muted small">' + escapeHtml(dive.objective) + '</div>';
        }
        html += "</div>";
      });
      html += "</div>";
    }

    if (diveComparison.conflicts && diveComparison.conflicts.length > 0) {
      html += '<div class="toolbar-3">';
      html += '<button type="button" class="secondary" data-bulk-dive-csv="keep">全部保留本地</button>';
      html += '<button type="button" class="secondary" data-bulk-dive-csv="overwrite">全部覆盖本地</button>';
      html += '<button type="button" class="secondary" data-bulk-dive-csv="saveas">全部另存新编号</button>';
      html += "</div>";
      html += '<div class="preview-list">';
      diveComparison.conflicts.forEach((conflict, idx) => {
        html +=
          '<div class="preview-item preview-item-conflict" data-dive-conflict-csv-index="' +
          idx +
          '"><div class="preview-item-main"><span><b>' +
          escapeHtml(conflict.imported.code) +
          "</b> " +
          escapeHtml(conflict.imported.date || "") +
          ' · ' +
          escapeHtml(conflict.imported.leader || "") +
          "</span>";
        html += '<select data-dive-csv-resolution-index="' + idx + '">';
        html += '<option value="keep">保留本地</option>';
        html += '<option value="overwrite">覆盖本地</option>';
        html += '<option value="saveas">另存为新编号</option>';
        html += "</select></div>";
        if (conflict.imported.objective) {
          html += '<div class="preview-item-detail muted small">' + escapeHtml(conflict.imported.objective) + '</div>';
        }
        html += "</div>";
      });
      html += "</div>";
    }

    if (diveComparison.errors && diveComparison.errors.length > 0) {
      html += '<div class="preview-list">';
      diveComparison.errors.forEach((err) => {
        const lineInfo = err.lineNumber ? " (第 " + err.lineNumber + " 行)" : "";
        const code = err.dive && err.dive.code ? err.dive.code : "第 " + (err.index + 1) + " 项";
        html +=
          '<div class="preview-item"><span><b>' +
          escapeHtml(code) +
          "</b>" +
          lineInfo +
          "</span><span class='muted'>" +
          escapeHtml(err.errors.join("; ")) +
          "</span></div>";
      });
      html += "</div>";
    }
    html += "</div>";

    return html;
  }

  function renderCSVMeasurementSection(measurementComparison, measurementResolutions, modal) {
    let html = "";
    if (!measurementComparison) return html;

    html += '<div class="preview-section">';
    html += '<h3 class="csv-section-title csv-section-measurement">测距数据</h3>';
    html += '<div class="summary-bar">';
    html += '<span class="pill">共 ' + measurementComparison.summary.total + " 项</span>";
    html += '<span class="pill pill-new">新增 ' + measurementComparison.summary.new + " 项</span>";
    html += '<span class="pill pill-conflict">冲突 ' + measurementComparison.summary.conflict + " 项</span>";
    html += '<span class="pill pill-error">错误 ' + measurementComparison.summary.error + " 项</span>";
    html += "</div>";

    if (measurementComparison.newMeasurements && measurementComparison.newMeasurements.length > 0) {
      html += '<div class="preview-list">';
      measurementComparison.newMeasurements.forEach((measurement) => {
        html +=
          '<div class="preview-item"><div><span><b>' +
          escapeHtml(measurement.code) +
          "</b> " +
          escapeHtml(measurement.dive || "") +
          ' · ' +
          (measurement.length ? measurement.length + "m" : "") +
          "</span><span class='pill pill-new'>新增</span></div>";
        if (measurement.points && measurement.points.length >= 2) {
          html += '<div class="preview-item-detail muted small">';
          html += '点: ' + measurement.points.map(p => `(${p.x},${p.y})`).join(' → ');
          if (measurement.relatedMarks && measurement.relatedMarks.length > 0) {
            html += ' · 关联: ' + measurement.relatedMarks.join(', ');
          }
          html += '</div>';
        }
        html += "</div>";
      });
      html += "</div>";
    }

    if (measurementComparison.conflicts && measurementComparison.conflicts.length > 0) {
      html += '<div class="toolbar-3">';
      html += '<button type="button" class="secondary" data-bulk-measurement-csv="keep">全部保留本地</button>';
      html += '<button type="button" class="secondary" data-bulk-measurement-csv="overwrite">全部覆盖本地</button>';
      html += '<button type="button" class="secondary" data-bulk-measurement-csv="saveas">全部另存新编号</button>';
      html += "</div>";
      html += '<div class="preview-list">';
      measurementComparison.conflicts.forEach((conflict, idx) => {
        html +=
          '<div class="preview-item preview-item-conflict" data-measurement-conflict-csv-index="' +
          idx +
          '"><div class="preview-item-main"><span><b>' +
          escapeHtml(conflict.imported.code) +
          "</b> " +
          escapeHtml(conflict.imported.dive || "") +
          ' · ' +
          (conflict.imported.length ? conflict.imported.length + "m" : "") +
          "</span>";
        html += '<select data-measurement-csv-resolution-index="' + idx + '">';
        html += '<option value="keep">保留本地</option>';
        html += '<option value="overwrite">覆盖本地</option>';
        html += '<option value="saveas">另存为新编号</option>';
        html += "</select></div>";
        if (conflict.imported.points && conflict.imported.points.length >= 2) {
          html += '<div class="preview-item-detail muted small">';
          html += '点: ' + conflict.imported.points.map(p => `(${p.x},${p.y})`).join(' → ');
          if (conflict.imported.relatedMarks && conflict.imported.relatedMarks.length > 0) {
            html += ' · 关联: ' + conflict.imported.relatedMarks.join(', ');
          }
          html += '</div>';
        }
        html += "</div>";
      });
      html += "</div>";
    }

    if (measurementComparison.errors && measurementComparison.errors.length > 0) {
      html += '<div class="preview-list">';
      measurementComparison.errors.forEach((err) => {
        const lineInfo = err.lineNumber ? " (第 " + err.lineNumber + " 行)" : "";
        const code = err.measurement && err.measurement.code ? err.measurement.code : "第 " + (err.index + 1) + " 项";
        html +=
          '<div class="preview-item"><span><b>' +
          escapeHtml(code) +
          "</b>" +
          lineInfo +
          "</span><span class='muted'>" +
          escapeHtml(err.errors.join("; ")) +
          "</span></div>";
      });
      html += "</div>";
    }
    html += "</div>";

    return html;
  }

  function showCSVImportPreview(csvParseResult, comparison, onConfirm, onCancel) {
    const { headers, mapping, marks = [], dives = [], measurements = [] } = csvParseResult;
    const { marks: markComparison, dives: diveComparison, measurements: measurementComparison } = comparison;

    const markResolutions = (markComparison?.conflicts || []).map(() => "keep");
    const diveResolutions = (diveComparison?.conflicts || []).map(() => "keep");
    const measurementResolutions = (measurementComparison?.conflicts || []).map(() => "keep");

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal";

    const totalRecords = marks.length + dives.length + measurements.length;

    let html = "<h2>CSV 导入预览</h2>";

    html += '<div class="summary-bar">';
    html += '<span class="pill">CSV 格式</span>';
    html += '<span class="pill">共 ' + totalRecords + " 条记录</span>";
    if (marks.length > 0) html += '<span class="pill pill-mark">标记 ' + marks.length + " 项</span>";
    if (dives.length > 0) html += '<span class="pill pill-dive">潜次 ' + dives.length + " 项</span>";
    if (measurements.length > 0) html += '<span class="pill pill-measurement">测距 ' + measurements.length + " 项</span>";
    html += "</div>";

    html += '<div class="preview-section">';
    html += '<h3>字段映射</h3>';
    html += '<div class="csv-mapping-summary">';
    CSV_FIELDS_ORDER.forEach((field) => {
      const label = CSV_FIELD_LABELS[field];
      const mappedHeader = mapping[field] || "未映射";
      const isMarkRequired = ["code", "type", "dive", "depth"].includes(field);
      const isDiveRequired = ["date", "leader", "visibility", "objective"].includes(field);
      const isMeasurementRequired = ["length"].includes(field);
      const isRequired = isMarkRequired || isDiveRequired || isMeasurementRequired;
      html += '<div class="csv-mapping-summary-item">';
      html += '<span class="csv-mapping-field-label">' + label + (isRequired ? "*" : "") + "</span>";
      html += '<span class="csv-mapping-arrow">→</span>';
      html += '<span class="csv-mapping-header ' + (mapping[field] ? "" : "csv-unmapped") + '">' + escapeHtml(mappedHeader) + "</span>";
      html += "</div>";
    });
    html += "</div>";
    html += "</div>";

    if (markComparison && markComparison.summary.total > 0) {
      html += renderCSVMarkSection(markComparison, markResolutions, modal);
    }

    if (diveComparison && diveComparison.summary.total > 0) {
      html += renderCSVDiveSection(diveComparison, diveResolutions, modal);
    }

    if (measurementComparison && measurementComparison.summary.total > 0) {
      html += renderCSVMeasurementSection(measurementComparison, measurementResolutions, modal);
    }

    html += '<div class="toolbar">';
    html += '<button type="button" id="confirmCSVImportBtn">确认导入</button>';
    html += '<button type="button" class="secondary" id="cancelCSVImportBtn">取消</button>';
    html += "</div>";

    modal.innerHTML = html;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    modal.querySelectorAll("[data-mark-csv-resolution-index]").forEach((select) => {
      select.onchange = (e) => {
        const idx = parseInt(e.target.dataset.markCsvResolutionIndex);
        markResolutions[idx] = e.target.value;
      };
    });

    modal.querySelectorAll("[data-bulk-mark-csv]").forEach((btn) => {
      btn.onclick = (e) => {
        const action = e.target.dataset.bulkMarkCsv;
        (markComparison?.conflicts || []).forEach((_, idx) => {
          markResolutions[idx] = action;
          const select = modal.querySelector('[data-mark-csv-resolution-index="' + idx + '"]');
          if (select) select.value = action;
        });
      };
    });

    modal.querySelectorAll("[data-dive-csv-resolution-index]").forEach((select) => {
      select.onchange = (e) => {
        const idx = parseInt(e.target.dataset.diveCsvResolutionIndex);
        diveResolutions[idx] = e.target.value;
      };
    });

    modal.querySelectorAll("[data-bulk-dive-csv]").forEach((btn) => {
      btn.onclick = (e) => {
        const action = e.target.dataset.bulkDiveCsv;
        (diveComparison?.conflicts || []).forEach((_, idx) => {
          diveResolutions[idx] = action;
          const select = modal.querySelector('[data-dive-csv-resolution-index="' + idx + '"]');
          if (select) select.value = action;
        });
      };
    });

    modal.querySelectorAll("[data-measurement-csv-resolution-index]").forEach((select) => {
      select.onchange = (e) => {
        const idx = parseInt(e.target.dataset.measurementCsvResolutionIndex);
        measurementResolutions[idx] = e.target.value;
      };
    });

    modal.querySelectorAll("[data-bulk-measurement-csv]").forEach((btn) => {
      btn.onclick = (e) => {
        const action = e.target.dataset.bulkMeasurementCsv;
        (measurementComparison?.conflicts || []).forEach((_, idx) => {
          measurementResolutions[idx] = action;
          const select = modal.querySelector('[data-measurement-csv-resolution-index="' + idx + '"]');
          if (select) select.value = action;
        });
      };
    });

    modal.querySelector("#confirmCSVImportBtn").onclick = () => {
      document.body.removeChild(backdrop);
      onConfirm({ markResolutions, diveResolutions, measurementResolutions });
    };

    modal.querySelector("#cancelCSVImportBtn").onclick = () => {
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

  function toggleHeatmap() {
    const enabled = Heatmap.toggle();
    if (elements.heatmapBtn) {
      elements.heatmapBtn.classList.toggle("heatmap-btn-active", enabled);
      elements.heatmapBtn.textContent = enabled ? "关闭热力图" : "热力图";
    }
    if (elements.heatmapControls) {
      elements.heatmapControls.classList.toggle("hidden", !enabled);
    }
    if (!enabled && elements.heatmapEmptyTip) {
      elements.heatmapEmptyTip.classList.add("hidden");
    }
    renderHeatmap();
  }

  function renderHeatmap() {
    if (!Heatmap.getState().enabled) return;
    let filtered = marks;
    if (elements.filter.value) {
      filtered = filtered.filter((m) => m.type === elements.filter.value);
    }
    if (elements.diveFilter.value) {
      filtered = filtered.filter((m) => m.dive === elements.diveFilter.value);
    }
    if (elements.reviewFilter.value) {
      filtered = filtered.filter((m) => getReviewStatus(m) === elements.reviewFilter.value);
    }
    Heatmap.render(filtered);
  }

  function updateHeatmapDiveFilter() {
    if (!elements.heatmapFilter) return;
    const currentVal = elements.heatmapFilter.value;
    const optgroupDive = elements.heatmapFilter.querySelector('optgroup[label="按潜次"]');
    if (optgroupDive) {
      optgroupDive.remove();
    }
    const newOptgroup = document.createElement("optgroup");
    newOptgroup.label = "按潜次";
    dives.forEach((dive) => {
      const option = document.createElement("option");
      option.value = "dive_" + dive.code;
      option.textContent = dive.code;
      newOptgroup.appendChild(option);
    });
    elements.heatmapFilter.appendChild(newOptgroup);
    if (currentVal) {
      elements.heatmapFilter.value = currentVal;
    }
  }

  function updateHeatmapConditionFilter() {
    if (!elements.heatmapFilter) return;
    const currentVal = elements.heatmapFilter.value;
    const optgroupCondition = elements.heatmapFilter.querySelector('optgroup[label="按保存状况"]');
    if (optgroupCondition) {
      optgroupCondition.remove();
    }

    const conditionSet = new Set();
    let hasEmpty = false;
    marks.forEach((m) => {
      const cond = m.condition?.trim() || "";
      if (cond === "") {
        hasEmpty = true;
      } else {
        conditionSet.add(cond);
      }
    });

    const conditions = Array.from(conditionSet).sort();

    if (conditions.length > 0 || hasEmpty) {
      const newOptgroup = document.createElement("optgroup");
      newOptgroup.label = "按保存状况";

      conditions.forEach((cond) => {
        const option = document.createElement("option");
        option.value = "condition_" + encodeURIComponent(cond);
        option.textContent = cond;
        newOptgroup.appendChild(option);
      });

      if (hasEmpty) {
        const option = document.createElement("option");
        option.value = "condition___empty__";
        option.textContent = "未填写";
        newOptgroup.appendChild(option);
      }

      elements.heatmapFilter.appendChild(newOptgroup);
    }

    if (currentVal) {
      elements.heatmapFilter.value = currentVal;
    }
  }

  function showReportModal() {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal modal-report";

    let html = "<h2>现场报告生成</h2>";
    html += '<div class="muted" style="margin-bottom:16px;">选择报告范围后生成可打印的HTML报告，支持浏览器打印预览。</div>';

    html += '<div class="report-config">';
    html += '<div class="report-config-row">';
    html += '<label>报告范围</label>';
    html += '<select id="reportScope">';
    html += '<option value="all">全部数据</option>';
    html += '<option value="dive">按潜次筛选</option>';
    html += '<option value="type">按类型筛选</option>';
    html += '<option value="review">按审核状态筛选</option>';
    html += '<option value="revisit">返潜计划</option>';
    html += '</select>';
    html += '</div>';

    html += '<div class="report-config-row" id="reportDiveRow" style="display:none;">';
    html += '<label>选择潜次</label>';
    html += '<select id="reportScopeDive">';
    dives.forEach(d => {
      html += '<option value="' + d.code + '">' + d.code + ' - ' + d.date + '</option>';
    });
    html += '</select>';
    html += '</div>';

    html += '<div class="report-config-row" id="reportTypeRow" style="display:none;">';
    html += '<label>选择类型</label>';
    html += '<select id="reportScopeType">';
    Object.entries(typeNames).forEach(([key, name]) => {
      html += '<option value="' + key + '">' + name + '</option>';
    });
    html += '</select>';
    html += '</div>';

    html += '<div class="report-config-row" id="reportReviewRow" style="display:none;">';
    html += '<label>选择审核状态</label>';
    html += '<select id="reportScopeReview">';
    Object.entries(reviewStatusNames).forEach(([key, name]) => {
      html += '<option value="' + key + '">' + name + '</option>';
    });
    html += '</select>';
    html += '</div>';
    html += '</div>';

    html += '<div id="reportPreview" class="report-preview hidden"></div>';

    html += '<div class="toolbar" style="margin-top:16px">';
    html += '<button type="button" id="generateReportBtn">生成报告</button>';
    html += '<button type="button" id="printReportBtn" class="secondary" style="display:none;">打印报告</button>';
    html += '<button type="button" class="secondary" id="cancelReportBtn">关闭</button>';
    html += '</div>';

    modal.innerHTML = html;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const scopeSelect = modal.querySelector("#reportScope");
    const diveRow = modal.querySelector("#reportDiveRow");
    const typeRow = modal.querySelector("#reportTypeRow");
    const reviewRow = modal.querySelector("#reportReviewRow");
    const previewEl = modal.querySelector("#reportPreview");
    const generateBtn = modal.querySelector("#generateReportBtn");
    const printBtn = modal.querySelector("#printReportBtn");

    scopeSelect.onchange = () => {
      diveRow.style.display = scopeSelect.value === "dive" ? "" : "none";
      typeRow.style.display = scopeSelect.value === "type" ? "" : "none";
      reviewRow.style.display = scopeSelect.value === "review" ? "" : "none";
      previewEl.classList.add("hidden");
      printBtn.style.display = "none";
    };

    generateBtn.onclick = () => {
      const options = {
        marks,
        dives,
        measurements,
        scale,
        gridConfig,
        baseMap,
        scope: scopeSelect.value,
        scopeDive: scopeSelect.value === "dive" ? modal.querySelector("#reportScopeDive").value : "",
        scopeType: scopeSelect.value === "type" ? modal.querySelector("#reportScopeType").value : "",
        scopeReview: scopeSelect.value === "review" ? modal.querySelector("#reportScopeReview").value : "",
        importErrors: importErrors || [],
        revisitPlan: revisitPlan || [],
      };

      const data = Report.aggregate(options);
      const reportHTML = Report.renderHTML(data);

      previewEl.innerHTML = reportHTML;
      previewEl.classList.remove("hidden");
      printBtn.style.display = "";
    };

    printBtn.onclick = () => {
      const reportContent = previewEl.querySelector(".report-page");
      if (!reportContent) return;

      const printWindow = window.open("", "_blank");
      printWindow.document.write('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>水下考古现场报告</title>');
      printWindow.document.write('<style>');
      printWindow.document.write(getReportPrintCSS());
      printWindow.document.write('</style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write(reportContent.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); }, 300);
    };

    modal.querySelector("#cancelReportBtn").onclick = () => {
      document.body.removeChild(backdrop);
    };

    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        document.body.removeChild(backdrop);
      }
    };
  }

  function getReportPrintCSS() {
    return `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; color: #183035; padding: 24px; background: #fff; }
      h1 { font-size: 22px; margin-bottom: 8px; color: #1d6c78; border-bottom: 2px solid #1d6c78; padding-bottom: 8px; }
      h2 { font-size: 16px; margin: 20px 0 10px; color: #1d6c78; }
      h3 { font-size: 14px; margin: 12px 0 6px; }
      .report-header { margin-bottom: 20px; }
      .report-meta { font-size: 12px; color: #5c7378; margin-top: 4px; }
      .report-summary-cards { display: flex; gap: 12px; margin: 12px 0; }
      .report-stat-card { flex: 1; text-align: center; padding: 12px; border: 1px solid #d7e4e5; border-radius: 6px; background: #f5fafb; }
      .report-stat-value { font-size: 24px; font-weight: 800; color: #1d6c78; }
      .report-stat-label { font-size: 12px; color: #5c7378; margin-top: 4px; }
      .report-section { margin: 16px 0; padding-top: 12px; border-top: 1px solid #e1ecee; }
      .report-table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0; }
      .report-table th, .report-table td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #e1ecee; }
      .report-table th { background: #f5fafb; font-weight: 600; }
      .pill { display: inline-block; padding: 2px 8px; border: 1px solid #c9dadc; border-radius: 999px; font-size: 12px; }
      .pill.ceramic { background: #f5e6d8; border-color: #b56c38; color: #8b4f2a; }
      .pill.wood { background: #e8ddd2; border-color: #6c4b2f; color: #5a3e27; }
      .pill.metal { background: #e5e8eb; border-color: #6e7880; color: #555e65; }
      .pill.unknown { background: #ece6f7; border-color: #725ca6; color: #5c4a8a; }
      .pill-review-collected { background: #e3f2fd; border-color: #2196f3; color: #1565c0; border-width: 2px; font-weight: 600; }
      .pill-review-pending { background: #fff8e1; border-color: #ffc107; color: #ff8f00; border-width: 2px; font-weight: 600; }
      .pill-review-confirmed { background: #e8f5e9; border-color: #4caf50; color: #2e7d32; border-width: 2px; font-weight: 600; }
      .pill-review-revisit { background: #fce4ec; border-color: #e91e63; color: #c2185b; border-width: 2px; font-weight: 600; }
      .report-map-overview { text-align: center; margin: 12px 0; }
      .report-map-overview svg { max-width: 100%; height: auto; border: 1px solid #d7e4e5; border-radius: 6px; }
      .report-map-legend { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 8px; font-size: 13px; }
      .report-legend-title { font-weight: 600; margin-right: 4px; }
      .report-legend-item { display: flex; align-items: center; gap: 4px; }
      .report-dive-block { margin: 12px 0; padding: 12px; border: 1px solid #d7e4e5; border-radius: 6px; page-break-inside: avoid; }
      .report-dive-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px; }
      .report-dive-objective { padding: 8px; background: #f5fafb; border-radius: 4px; margin: 8px 0; font-size: 13px; line-height: 1.5; }
      .report-dive-participants { margin: 8px 0; }
      .report-dive-participants-title { font-weight: 600; font-size: 13px; margin-bottom: 6px; }
      .report-scale-info { font-size: 13px; color: #5c7378; }
      .report-import-summary { background: #f5fafb; border: 1px solid #d7e4e5; border-radius: 6px; padding: 8px 12px; margin: 8px 0 12px; font-size: 12px; }
      .muted { color: #5c7378; font-size: 13px; }
      @media print {
        body { padding: 0; }
        .report-dive-block { page-break-inside: avoid; }
        .report-table { page-break-inside: auto; }
        .report-section { page-break-inside: avoid; }
      }
    `;
  }

  function updateProjectSelector() {
    if (!elements.projectSelect) return;
    const projects = ProjectManager.getActiveProjects();
    currentProject = ProjectManager.getCurrentProject();
    const currentId = currentProject ? currentProject.id : null;

    elements.projectSelect.innerHTML = projects.map((p) => {
      return '<option value="' + p.id + '"' + (p.id === currentId ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>';
    }).join("");
  }

  function getCurrentViewState() {
    return {
      dive: elements.diveFilter.value,
      type: elements.filter.value,
      reviewStatus: elements.reviewFilter.value,
      heatmapGroup: elements.heatmapFilter ? elements.heatmapFilter.value : "",
      activeTab: activeTab,
      viewMode: elements.view.value,
    };
  }

  function updateViewSelector(viewList) {
    views = viewList || [];
    if (!elements.viewSelector) return;
    const current = getCurrentViewState();
    let html = '<option value="">默认视图</option>';
    for (const v of views) {
      const match = v.dive === current.dive &&
        v.type === current.type &&
        v.reviewStatus === current.reviewStatus &&
        v.heatmapGroup === current.heatmapGroup &&
        v.activeTab === current.activeTab &&
        v.viewMode === current.viewMode;
      html += '<option value="' + v.id + '"' + (match ? ' selected' : '') + '>' + escapeHtml(v.name) + '</option>';
    }
    elements.viewSelector.innerHTML = html;
  }

  function updateViewSelectorValue() {
    if (!elements.viewSelector) return;
    const current = getCurrentViewState();
    let foundId = null;
    for (const v of views) {
      if (v.dive === current.dive &&
          v.type === current.type &&
          v.reviewStatus === current.reviewStatus &&
          v.heatmapGroup === current.heatmapGroup &&
          v.activeTab === current.activeTab &&
          v.viewMode === current.viewMode) {
        foundId = v.id;
        break;
      }
    }
    elements.viewSelector.value = foundId || "";
  }

  function applyViewState(view) {
    if (!view) return;
    elements.diveFilter.value = view.dive || "";
    elements.filter.value = view.type || "all";
    elements.reviewFilter.value = view.reviewStatus || "all";
    if (elements.heatmapFilter && view.heatmapGroup) {
      elements.heatmapFilter.value = view.heatmapGroup;
      Heatmap.setState({ filterMode: view.heatmapGroup });
    }
    elements.view.value = view.viewMode || "list";
    switchTab(view.activeTab || "marks");
  }

  function buildViewSummary(view) {
    const parts = [];
    if (view.dive) parts.push("潜次: " + view.dive);
    const typeLabel = view.type === "all" ? "全部类型" : typeNames[view.type];
    parts.push("类型: " + (typeLabel || view.type));
    const reviewLabel = view.reviewStatus === "all" ? "全部状态" : reviewStatusNames[view.reviewStatus];
    parts.push("审核: " + (reviewLabel || view.reviewStatus));
    if (view.heatmapGroup) {
      const hmLabels = { dive: "按潜次", type: "按类型", review: "按审核", none: "不显示" };
      parts.push("热力图: " + (hmLabels[view.heatmapGroup] || view.heatmapGroup));
    }
    const tabLabels = { marks: "文物点", review: "审核", dives: "潜次", measure: "测量", revisit: "返潜计划" };
    parts.push("标签: " + (tabLabels[view.activeTab] || view.activeTab));
    const modeLabels = { list: "列表", timeline: "时间线" };
    parts.push("模式: " + (modeLabels[view.viewMode] || view.viewMode));
    return parts.join(" | ");
  }

  function showSaveViewModal() {
    const state = getCurrentViewState();
    const summary = buildViewSummary({ ...state });
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const modal = document.createElement("div");
    modal.className = "modal modal-view-form";
    modal.innerHTML =
      '<h2>保存工作视图</h2>' +
      '<div class="view-form-summary">' + escapeHtml(summary) + '</div>' +
      '<label class="view-form-label">视图名称</label>' +
      '<input type="text" id="viewNameInput" maxlength="50" placeholder="例如：2024秋季陶片审核">' +
      '<div class="view-form-actions">' +
      '<button type="button" id="cancelSaveViewBtn" class="secondary">取消</button>' +
      '<button type="button" id="confirmSaveViewBtn">保存</button>' +
      '</div>';
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    const nameInput = modal.querySelector("#viewNameInput");
    setTimeout(() => nameInput.focus(), 50);
    backdrop.onclick = (e) => { if (e.target === backdrop) { document.body.removeChild(backdrop); } };
    modal.querySelector("#cancelSaveViewBtn").onclick = () => { document.body.removeChild(backdrop); };
    modal.querySelector("#confirmSaveViewBtn").onclick = () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      if (callbacks.onSaveView) {
        callbacks.onSaveView({ name, ...state });
      }
      document.body.removeChild(backdrop);
    };
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") modal.querySelector("#confirmSaveViewBtn").click();
    });
  }

  function showManageViewsModal() {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const modal = document.createElement("div");
    modal.className = "modal modal-view-form";
    const renderList = () => {
      let listHtml = '<h2>管理工作视图</h2>';
      if (views.length === 0) {
        listHtml += '<div class="view-empty">暂无保存的视图</div>';
      } else {
        listHtml += '<div class="view-list">';
        for (const v of views) {
          listHtml +=
            '<div class="view-item" data-id="' + v.id + '">' +
            '<div class="view-item-name">' + escapeHtml(v.name) + '</div>' +
            '<div class="view-item-summary">' + escapeHtml(buildViewSummary(v)) + '</div>' +
            '<div class="view-item-actions">' +
            '<button type="button" class="secondary view-apply-btn" data-id="' + v.id + '">应用</button>' +
            '<button type="button" class="secondary view-rename-btn" data-id="' + v.id + '">重命名</button>' +
            '<button type="button" class="danger view-delete-btn" data-id="' + v.id + '">删除</button>' +
            '</div>' +
            '</div>';
        }
        listHtml += '</div>';
      }
      listHtml += '<div class="view-form-actions"><button type="button" id="closeManageViewsBtn">关闭</button></div>';
      modal.innerHTML = listHtml;
      modal.querySelector("#closeManageViewsBtn").onclick = () => { document.body.removeChild(backdrop); };
      modal.querySelectorAll(".view-apply-btn").forEach((btn) => {
        btn.onclick = () => {
          const id = btn.dataset.id;
          if (callbacks.onApplyView) callbacks.onApplyView(id);
          document.body.removeChild(backdrop);
        };
      });
      modal.querySelectorAll(".view-rename-btn").forEach((btn) => {
        btn.onclick = () => {
          const id = btn.dataset.id;
          const v = views.find((x) => x.id === id);
          if (!v) return;
          const newName = prompt("请输入新的视图名称：", v.name);
          if (newName !== null) {
            const trimmed = newName.trim();
            if (trimmed && callbacks.onRenameView) {
              callbacks.onRenameView(id, trimmed);
              renderList();
            }
          }
        };
      });
      modal.querySelectorAll(".view-delete-btn").forEach((btn) => {
        btn.onclick = () => {
          const id = btn.dataset.id;
          const v = views.find((x) => x.id === id);
          if (!v) return;
          if (confirm("确定要删除视图「" + v.name + "」吗？")) {
            if (callbacks.onDeleteView) callbacks.onDeleteView(id);
            renderList();
          }
        };
      });
    };
    renderList();
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    backdrop.onclick = (e) => { if (e.target === backdrop) { document.body.removeChild(backdrop); } };
  }

  function resetAllState() {
    pending = null;
    currentEditId = null;
    currentEditDiveId = null;
    currentEditMeasureId = null;
    currentAttachments = [];
    currentParticipants = [];
    activeTab = "marks";
    isCalibrating = false;
    calibratePoints = [];
    isMeasuring = false;
    measurePoints = [];
    selectedRelatedMarks = [];
    importErrors = [];

    if (elements.form) elements.form.reset();
    if (elements.diveForm) elements.diveForm.reset();
    if (elements.measureForm) elements.measureForm.reset();

    elements.tabs.forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === "marks");
    });
    elements.marksTab.classList.remove("hidden");
    elements.reviewTab.classList.add("hidden");
    elements.divesTab.classList.add("hidden");
    elements.measureTab.classList.add("hidden");

    elements.filter.value = "";
    elements.diveFilter.value = "";
    elements.reviewFilter.value = "";
    elements.view.value = "list";
    views = [];
    updateViewSelector([]);
  }

  function showProjectManagerModal() {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal modal-project";

    renderProjectManagerContent(modal, backdrop);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        document.body.removeChild(backdrop);
      }
    };
  }

  function renderProjectManagerContent(modal, backdrop) {
    const allProjects = ProjectManager.getAllProjects();
    const currentId = currentProject ? currentProject.id : null;

    let html = '<h2>多遗址项目管理</h2>';

    html += '<div class="project-create-row">';
    html += '<input type="text" id="newProjectNameInput" placeholder="输入新遗址项目名称">';
    html += '<button id="createProjectBtn">创建项目</button>';
    html += '</div>';

    html += '<div class="project-list">';
    if (allProjects.length === 0) {
      html += '<div class="muted">暂无项目</div>';
    } else {
      allProjects.forEach((p) => {
        const isActive = p.id === currentId;
        const isArchived = p.archived;
        const usageBytes = ProjectManager.getProjectStorageUsage(p.id);
        const usageKB = (usageBytes / 1024).toFixed(1);
        const markCount = ProjectManager.loadProjectData(p.id, "marks").length;
        const diveCount = ProjectManager.loadProjectData(p.id, "dives").length;

        html += '<div class="project-card' + (isActive ? ' project-active' : '') + (isArchived ? ' project-archived' : '') + '">';
        html += '<div class="project-card-header">';
        html += '<div class="project-card-name">' + escapeHtml(p.name) + '</div>';
        if (isActive) {
          html += '<span class="pill pill-new">当前项目</span>';
        }
        if (isArchived) {
          html += '<span class="pill pill-error">已归档</span>';
        }
        html += '</div>';
        html += '<div class="project-card-info">';
        html += '<span>' + markCount + ' 个标记</span>';
        html += '<span>' + diveCount + ' 个潜次</span>';
        html += '<span>' + usageKB + ' KB</span>';
        html += '</div>';
        html += '<div class="project-card-actions">';
        if (!isActive) {
          html += '<button class="project-switch-btn" data-id="' + p.id + '">切换</button>';
        }
        if (!isArchived) {
          html += '<button class="secondary project-rename-btn" data-id="' + p.id + '" data-name="' + escapeHtml(p.name) + '">重命名</button>';
          html += '<button class="secondary project-archive-btn" data-id="' + p.id + '">归档</button>';
        } else {
          html += '<button class="secondary project-unarchive-btn" data-id="' + p.id + '">恢复</button>';
        }
        if (!isActive && allProjects.length > 1) {
          html += '<button class="danger project-delete-btn" data-id="' + p.id + '">删除</button>';
        }
        html += '</div>';
        html += '</div>';
      });
    }
    html += '</div>';

    html += '<div class="project-list-footer muted">项目数据存储在浏览器本地，清除浏览器数据将导致数据丢失，请定期导出备份。</div>';

    modal.innerHTML = html;

    modal.querySelector("#createProjectBtn").onclick = () => {
      const nameInput = modal.querySelector("#newProjectNameInput");
      const name = nameInput.value.trim();
      if (!name) {
        showToast("请输入项目名称", "error");
        return;
      }
      if (callbacks.onCreateProject) {
        callbacks.onCreateProject(name);
        renderProjectManagerContent(modal, backdrop);
        updateProjectSelector();
      }
    };

    modal.querySelectorAll(".project-switch-btn").forEach(btn => {
      btn.onclick = () => {
        const projectId = btn.dataset.id;
        if (callbacks.onSwitchProject) {
          callbacks.onSwitchProject(projectId);
          renderProjectManagerContent(modal, backdrop);
          updateProjectSelector();
        }
      };
    });

    modal.querySelectorAll(".project-rename-btn").forEach(btn => {
      btn.onclick = () => {
        const projectId = btn.dataset.id;
        const oldName = btn.dataset.name;
        const newName = prompt("请输入新名称", oldName);
        if (newName && newName.trim() && newName.trim() !== oldName) {
          if (callbacks.onRenameProject) {
            callbacks.onRenameProject(projectId, newName.trim());
            renderProjectManagerContent(modal, backdrop);
          }
        }
      };
    });

    modal.querySelectorAll(".project-archive-btn").forEach(btn => {
      btn.onclick = () => {
        const projectId = btn.dataset.id;
        if (confirm("确定要归档此项目吗？归档后可在项目管理中恢复。")) {
          if (callbacks.onArchiveProject) {
            callbacks.onArchiveProject(projectId);
            renderProjectManagerContent(modal, backdrop);
            updateProjectSelector();
          }
        }
      };
    });

    modal.querySelectorAll(".project-unarchive-btn").forEach(btn => {
      btn.onclick = () => {
        const projectId = btn.dataset.id;
        if (callbacks.onUnarchiveProject) {
          callbacks.onUnarchiveProject(projectId);
          renderProjectManagerContent(modal, backdrop);
          updateProjectSelector();
        }
      };
    });

    modal.querySelectorAll(".project-delete-btn").forEach(btn => {
      btn.onclick = () => {
        const projectId = btn.dataset.id;
        if (confirm("确定要删除此项目吗？此操作不可撤销，所有标记、潜次和测距数据将被永久删除。")) {
          if (callbacks.onDeleteProject) {
            callbacks.onDeleteProject(projectId);
            renderProjectManagerContent(modal, backdrop);
            updateProjectSelector();
          }
        }
      };
    });
  }

  return {
    init,
    updateState,
    render,
    renderDives,
    renderReviewTab,
    renderMeasureTab,
    edit,
    editDive,
    editMeasurement,
    resetForm,
    resetDiveForm,
    resetMeasureForm,
    resetAllState,
    showImportPreview,
    showMergePreview,
    showRollbackNotice,
    hideRollbackNotice,
    showCSVFieldMappingPreview,
    showCSVImportPreview,
    showToast,
    switchTab,
    renderAttachments,
    renderStorageInfo,
    getCurrentAttachments,
    showReportModal,
    updateProjectSelector,
    updateViewSelector,
    applyViewState,
    showSaveViewModal,
    showManageViewsModal,
    typeNames,
    weatherNames,
    currentNames,
    angleNames,
    reviewStatusNames,
    REVIEW_STATUSES,
  };
})();
