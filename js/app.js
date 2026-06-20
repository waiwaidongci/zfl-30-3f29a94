const App = (() => {
  let marks = [];
  let dives = [];
  let measurements = [];
  let scale = null;
  let gridConfig = { enabled: false, size: 1, showLabels: true };
  let baseMap = null;
  let pending = null;
  let currentEditId = null;
  let currentEditMeasureId = null;
  let importErrors = [];
  let currentProject = null;
  let views = [];
  let revisitPlan = [];

  function setImportErrors(errors) {
    importErrors = errors || [];
    DataIO.saveImportErrors(importErrors);
    if (callbacks && callbacks.onImportErrorsUpdate) {
      callbacks.onImportErrorsUpdate(importErrors);
    }
  }

  let callbacks = null;

  function getDefaultDives() {
    return [
      {
        id: crypto.randomUUID(),
        code: "DIVE-01",
        date: "2025-06-15",
        leader: "张教授",
        weather: "sunny",
        current: "weak",
        visibility: "5-8米",
        objective: "勘查船艉区域，采集陶瓷标本",
        participants: [
          { name: "张教授", role: "潜次负责人", equipment: "潜水表、水下相机" },
          { name: "王研究员", role: "采样员", equipment: "采样箱、标签贴纸" },
          { name: "李技术员", role: "摄像记录", equipment: "水下摄像机、照明灯" },
        ],
      },
      {
        id: crypto.randomUUID(),
        code: "DIVE-02",
        date: "2025-06-16",
        leader: "李研究员",
        weather: "cloudy",
        current: "moderate",
        visibility: "3-5米",
        objective: "记录船体结构，测量船肋间距",
        participants: [
          { name: "李研究员", role: "潜次负责人", equipment: "测量板、卷尺" },
          { name: "赵技术员", role: "测绘员", equipment: "全站仪、标志浮标" },
        ],
      },
    ];
  }

  function getDefaultReview(status = "collected") {
    return {
      status: status,
      comment: "",
      reviewer: "",
      reviewedAt: status === "collected" ? null : new Date().toISOString(),
      history: [
        {
          status: status,
          at: new Date().toISOString(),
          comment: "",
          reviewer: "",
        },
      ],
    };
  }

  function getDefaultMarks() {
    return [
      {
        id: crypto.randomUUID(),
        code: "A-017",
        type: "ceramic",
        dive: "DIVE-01",
        x: 42,
        y: 46,
        depth: "17.8m",
        orientation: "东",
        condition: "边缘残缺",
        note: "靠近船肋",
        sampling: {
          sampleNo: "",
          sampleMethod: "",
          sampler: "",
          sampleTime: "",
        },
        review: getDefaultReview("collected"),
      },
      {
        id: crypto.randomUUID(),
        code: "W-003",
        type: "wood",
        dive: "DIVE-02",
        x: 58,
        y: 39,
        depth: "18.2m",
        orientation: "西北",
        condition: "稳定",
        note: "疑似横梁",
        sampling: {
          sampleNo: "",
          sampleMethod: "",
          sampler: "",
          sampleTime: "",
        },
        review: getDefaultReview("pending"),
      },
    ];
  }

  function autoCreateDivesFromMarks() {
    const diveCodes = new Set(marks.map(m => m.dive).filter(Boolean));
    const existingCodes = new Set(dives.map(d => d.code));

    diveCodes.forEach(code => {
      if (!existingCodes.has(code)) {
        dives.push({
          id: crypto.randomUUID(),
          code: code,
          date: new Date().toISOString().split("T")[0],
          leader: "未指定",
          weather: "sunny",
          current: "calm",
          visibility: "待记录",
          objective: "请补充任务目标",
          participants: [],
        });
      }
    });

    if (dives.length > 0) {
      saveDives();
    }
  }

  function loadProjectData(includeDefaultData = false) {
    DataIO.setProjectId(currentProject.id);
    if (typeof MergeModule !== "undefined" && typeof MergeModule.setProjectId === "function") {
      MergeModule.setProjectId(currentProject.id);
    }
    if (typeof SnapshotModule !== "undefined" && typeof SnapshotModule.setProjectId === "function") {
      SnapshotModule.setProjectId(currentProject.id);
    }
    marks = DataIO.loadMarks();
    dives = DataIO.loadDives();
    measurements = DataIO.loadMeasurements();
    scale = DataIO.loadScale();
    importErrors = DataIO.loadImportErrors();
    baseMap = DataIO.loadBaseMap();
    views = DataIO.loadViews();
    views = validateAndDegradeViews(views);
    saveViews();
    revisitPlan = DataIO.loadRevisitPlan();
    const savedGridConfig = DataIO.loadGridConfig();
    if (savedGridConfig) {
      gridConfig = savedGridConfig;
    } else {
      gridConfig = { enabled: false, size: 1, showLabels: true };
    }

    if (includeDefaultData && !dives.length && !marks.length) {
      dives = getDefaultDives();
      marks = getDefaultMarks();
      save();
      saveDives();
    } else if (!dives.length && marks.length) {
      autoCreateDivesFromMarks();
    }

    if (typeof SnapshotModule !== "undefined" && typeof SnapshotModule.ensureInitialSnapshot === "function") {
      SnapshotModule.ensureInitialSnapshot();
    }
  }

  function recordChange(entityType, action, entityId, entityCode, beforeData, afterData) {
    if (typeof MergeModule !== "undefined" && typeof MergeModule.recordChange === "function") {
      MergeModule.recordChange(entityType, action, entityId, entityCode, beforeData, afterData);
    }
    if (typeof SnapshotModule !== "undefined" && typeof SnapshotModule.recordChange === "function") {
      SnapshotModule.recordChange(entityType, action, entityId, entityCode, beforeData, afterData);
    }
  }

  function init() {
    const shouldSeedDefaultData = ProjectManager.getAllProjects().length === 0;
    currentProject = ProjectManager.init();
    loadProjectData(shouldSeedDefaultData);

    document.addEventListener('deleteMeasurement', (e) => {
      handleDeleteMeasurement(e.detail.id);
    });

    callbacks = {
      onSaveMark: handleSaveMark,
      onDeleteMark: handleDeleteMark,
      onSaveDive: handleSaveDive,
      onDeleteDive: handleDeleteDive,
      onSaveMeasurement: handleSaveMeasurement,
      onDeleteMeasurement: handleDeleteMeasurement,
      onUpdateScale: handleUpdateScale,
      onUpdateGridConfig: handleUpdateGridConfig,
      onUpdateBaseMap: handleUpdateBaseMap,
      onExport: handleExport,
      onExportOfflineMerge: handleExportOfflineMerge,
      onImport: handleImport,
      onImportCSV: handleImportCSV,
      onUpdateReviewStatus: handleUpdateReviewStatus,
      onSwitchProject: handleSwitchProject,
      onCreateProject: handleCreateProject,
      onRenameProject: handleRenameProject,
      onArchiveProject: handleArchiveProject,
      onUnarchiveProject: handleUnarchiveProject,
      onDeleteProject: handleDeleteProject,
      onSaveView: handleSaveView,
      onApplyView: handleApplyView,
      onDeleteView: handleDeleteView,
      onRenameView: handleRenameView,
      onGetViews: handleGetViews,
      onGetRevisitTasks: aggregateRevisitTasks,
      onSaveRevisitTask: handleSaveRevisitTask,
      onDeleteRevisitTask: handleDeleteRevisitTask,
      onCreateDiveFromRevisitPlan: handleCreateDiveFromRevisitPlan,
      onGetTimeline: handleGetTimeline,
      onGetSnapshotDetail: handleGetSnapshotDetail,
      onCheckRollbackConflicts: handleCheckRollbackConflicts,
      onRollbackToSnapshot: handleRollbackToSnapshot,
      onCreateManualSnapshot: handleCreateManualSnapshot,
      onGetSnapshotDiff: handleGetSnapshotDiff,
      onGetSnapshotStorageStats: handleGetSnapshotStorageStats,
      onExportSnapshot: handleExportSnapshot,
      onImportSnapshot: handleImportSnapshot,
    };

    UI.init({
      marks,
      dives,
      measurements,
      scale,
      gridConfig,
      baseMap,
      pending,
      currentEditId,
      importErrors,
      callbacks,
      currentProject,
      views,
      revisitPlan,
    });

    UI.render();
    checkMergeSnapshot();
  }

  function handleSwitchProject(projectId) {
    if (currentProject && currentProject.id === projectId) return;
    currentProject = ProjectManager.switchProject(projectId)
      ? ProjectManager.getCurrentProject()
      : currentProject;
    if (!currentProject) return;

    pending = null;
    currentEditId = null;
    currentEditMeasureId = null;
    importErrors = [];

    loadProjectData();

    UI.resetAllState();
    UI.init({
      marks,
      dives,
      measurements,
      scale,
      gridConfig,
      baseMap,
      pending,
      currentEditId,
      importErrors,
      callbacks,
      currentProject,
      views,
      revisitPlan,
    });
    UI.render();
    UI.showToast("已切换到项目「" + currentProject.name + "」", "success");
  }

  function handleCreateProject(name) {
    const project = ProjectManager.createProject(name);
    handleSwitchProject(project.id);
    return project;
  }

  function handleRenameProject(projectId, newName) {
    const result = ProjectManager.renameProject(projectId, newName);
    if (result) {
      currentProject = ProjectManager.getCurrentProject();
      UI.updateProjectSelector();
      UI.showToast("项目已重命名", "success");
    }
    return result;
  }

  function handleArchiveProject(projectId) {
    const nextId = ProjectManager.archiveProject(projectId);
    if (nextId === false) {
      UI.showToast("无法归档：至少需要保留一个活动项目", "error");
      return false;
    }
    if (nextId && typeof nextId === "string") {
      handleSwitchProject(nextId);
    } else if (nextId === null && currentProject && currentProject.id === projectId) {
      currentProject = ProjectManager.getCurrentProject();
      UI.updateProjectSelector();
      UI.showToast("项目已归档", "success");
    }
    return nextId;
  }

  function handleUnarchiveProject(projectId) {
    const result = ProjectManager.unarchiveProject(projectId);
    if (result) {
      UI.updateProjectSelector();
      UI.showToast("项目已恢复", "success");
    }
    return result;
  }

  function handleDeleteProject(projectId) {
    const nextId = ProjectManager.deleteProject(projectId);
    if (nextId && typeof nextId === "string") {
      handleSwitchProject(nextId);
    } else if (nextId === null && currentProject && currentProject.id === projectId) {
      currentProject = ProjectManager.getCurrentProject();
      if (currentProject) {
        loadProjectData();
        UI.resetAllState();
        UI.init({
          marks,
          dives,
          measurements,
          scale,
          gridConfig,
          baseMap,
          pending,
          currentEditId,
          importErrors,
          callbacks,
          currentProject,
          views,
          revisitPlan,
        });
        UI.render();
      }
      UI.showToast("项目已删除", "info");
    }
    return nextId;
  }

  function save() {
    try {
      DataIO.saveMarks(marks);
    } catch (e) {
      UI.showToast("保存失败：存储空间不足，请清理附件后重试", "error");
      throw e;
    }
  }

  function saveDives() {
    DataIO.saveDives(dives);
  }

  function saveMeasurements() {
    DataIO.saveMeasurements(measurements);
  }

  function saveScale() {
    DataIO.saveScale(scale);
  }

  function saveGridConfig() {
    DataIO.saveGridConfig(gridConfig);
  }

  function saveBaseMap() {
    DataIO.saveBaseMap(baseMap);
  }

  function saveViews() {
    DataIO.saveViews(views);
  }

  function saveRevisitPlan() {
    DataIO.saveRevisitPlan(revisitPlan);
  }

  function validateAndDegradeViews(viewList) {
    if (!Array.isArray(viewList)) return [];
    const validDiveCodes = new Set(dives.map(d => d.code));
    const validTypes = new Set(["ceramic", "wood", "metal", "unknown"]);
    const validStatuses = new Set(["collected", "pending", "confirmed", "revisit"]);
    const validTabs = new Set(["marks", "review", "revisit", "dives", "measure"]);
    const validViewModes = new Set(["list", "timeline"]);

    return viewList.map(view => {
      const degraded = { ...view };
      let changed = false;

      if (degraded.dive && !validDiveCodes.has(degraded.dive)) {
        degraded.dive = "";
        changed = true;
      }
      if (degraded.type && !validTypes.has(degraded.type)) {
        degraded.type = "";
        changed = true;
      }
      if (degraded.reviewStatus && !validStatuses.has(degraded.reviewStatus)) {
        degraded.reviewStatus = "";
        changed = true;
      }
      if (degraded.activeTab && !validTabs.has(degraded.activeTab)) {
        degraded.activeTab = "marks";
        changed = true;
      }
      if (degraded.viewMode && !validViewModes.has(degraded.viewMode)) {
        degraded.viewMode = "list";
        changed = true;
      }
      if (degraded.heatmapGroup) {
        let heatmapValid = degraded.heatmapGroup === "all";
        if (!heatmapValid) {
          if (degraded.heatmapGroup.startsWith("type_")) {
            const t = degraded.heatmapGroup.replace("type_", "");
            heatmapValid = validTypes.has(t);
          } else if (degraded.heatmapGroup.startsWith("status_")) {
            const s = degraded.heatmapGroup.replace("status_", "");
            heatmapValid = validStatuses.has(s);
          } else if (degraded.heatmapGroup.startsWith("dive_")) {
            const d = degraded.heatmapGroup.replace("dive_", "");
            heatmapValid = validDiveCodes.has(d);
          } else if (degraded.heatmapGroup.startsWith("condition_")) {
            heatmapValid = true;
          }
        }
        if (!heatmapValid) {
          degraded.heatmapGroup = "all";
          changed = true;
        }
      }
      degraded._degraded = changed;
      return degraded;
    });
  }

  function handleSaveView(viewData) {
    const name = (viewData?.name || "").trim();
    if (!name) {
      UI.showToast("请输入视图名称", "error");
      return null;
    }
    const existingIdx = views.findIndex(v => v.id === viewData?.id);
    const now = new Date().toISOString();

    if (existingIdx >= 0) {
      views[existingIdx] = {
        ...views[existingIdx],
        ...viewData,
        name,
        updatedAt: now,
      };
      delete views[existingIdx]._degraded;
    } else {
      const newView = {
        id: crypto.randomUUID(),
        name,
        dive: viewData?.dive || "",
        type: viewData?.type || "",
        reviewStatus: viewData?.reviewStatus || "",
        heatmapGroup: viewData?.heatmapGroup || "all",
        activeTab: viewData?.activeTab || "marks",
        viewMode: viewData?.viewMode || "list",
        createdAt: now,
        updatedAt: now,
      };
      views.push(newView);
    }
    saveViews();
    UI.updateViewSelector(views);
    UI.showToast(existingIdx >= 0 ? "视图已更新" : "视图已保存", "success");
    return views;
  }

  function handleApplyView(viewId) {
    const view = views.find(v => v.id === viewId);
    if (!view) {
      UI.showToast("视图不存在", "error");
      return null;
    }
    const wasDegraded = view._degraded;
    UI.applyViewState(view);
    if (wasDegraded) {
      UI.showToast("部分筛选条件已失效，已自动降级", "info");
    }
    return view;
  }

  function handleDeleteView(viewId) {
    const idx = views.findIndex(v => v.id === viewId);
    if (idx < 0) return false;
    views.splice(idx, 1);
    saveViews();
    UI.updateViewSelector(views);
    UI.showToast("视图已删除", "info");
    return true;
  }

  function handleRenameView(viewId, newName) {
    const view = views.find(v => v.id === viewId);
    if (!view) return false;
    const trimmed = (newName || "").trim();
    if (!trimmed) {
      UI.showToast("视图名称不能为空", "error");
      return false;
    }
    view.name = trimmed;
    view.updatedAt = new Date().toISOString();
    saveViews();
    UI.updateViewSelector(views);
    UI.showToast("视图已重命名", "success");
    return true;
  }

  function handleGetViews() {
    return views;
  }

  function buildReviewFromForm(data, existingMark) {
    const newStatus = data.reviewStatus || "collected";
    const comment = data.reviewComment || "";
    const reviewer = data.reviewer || "";
    const now = new Date().toISOString();

    if (existingMark && existingMark.review) {
      const oldStatus = existingMark.review.status || "collected";
      const updatedReview = {
        ...existingMark.review,
        status: newStatus,
        comment: comment,
        reviewer: reviewer,
        reviewedAt: newStatus !== "collected" ? now : null,
      };
      if (!updatedReview.history) {
        updatedReview.history = [{ status: oldStatus, at: now, comment, reviewer }];
      }
      const lastHistory = updatedReview.history[updatedReview.history.length - 1];
      if (lastHistory.status !== newStatus || lastHistory.comment !== comment || lastHistory.reviewer !== reviewer) {
        updatedReview.history.push({ status: newStatus, at: now, comment, reviewer });
      }
      return updatedReview;
    } else {
      return {
        status: newStatus,
        comment: comment,
        reviewer: reviewer,
        reviewedAt: newStatus !== "collected" ? now : null,
        history: [{ status: newStatus, at: now, comment, reviewer }],
      };
    }
  }

  function handleSaveMark(data, pendingPos) {
    const attachments = data.attachments || [];
    delete data.attachments;

    const reviewStatus = data.reviewStatus;
    const reviewComment = data.reviewComment;
    const reviewer = data.reviewer;
    delete data.reviewStatus;
    delete data.reviewComment;
    delete data.reviewer;

    const sampleNo = data.sampleNo || "";
    const sampleMethod = data.sampleMethod || "";
    const sampler = data.sampler || "";
    const sampleTime = data.sampleTime || "";
    delete data.sampleNo;
    delete data.sampleMethod;
    delete data.sampler;
    delete data.sampleTime;

    const sampling = { sampleNo, sampleMethod, sampler, sampleTime };

    if (data.id) {
      const mark = marks.find((m) => m.id === data.id);
      if (mark) {
        const beforeData = JSON.parse(JSON.stringify(mark));
        Object.assign(mark, data, pendingPos);
        mark.attachments = attachments;
        mark.sampling = sampling;
        mark.review = buildReviewFromForm(
          { reviewStatus, reviewComment, reviewer },
          mark
        );
        recordChange("mark", "modify", mark.id, mark.code, beforeData, mark);
      }
    } else {
      const newMark = {
        ...data,
        id: crypto.randomUUID(),
        ...pendingPos,
        attachments: attachments,
        sampling: sampling,
      };
      newMark.review = buildReviewFromForm(
        { reviewStatus, reviewComment, reviewer },
        null
      );
      marks.push(newMark);
      recordChange("mark", "add", newMark.id, newMark.code, null, newMark);
    }
    save();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, data.id || null);
    UI.showToast("标记已保存", "success");
  }

  function handleUpdateReviewStatus(markId, newStatus, comment, reviewer) {
    const mark = marks.find((m) => m.id === markId);
    if (!mark) return;

    if (!mark.review) {
      mark.review = DataIO.getDefaultReview ? DataIO.getDefaultReview() : getDefaultReview();
    }

    const beforeData = JSON.parse(JSON.stringify(mark));
    const oldStatus = mark.review.status || "collected";
    const now = new Date().toISOString();

    mark.review.status = newStatus;
    mark.review.comment = comment || mark.review.comment || "";
    mark.review.reviewer = reviewer || mark.review.reviewer || "";
    mark.review.reviewedAt = newStatus !== "collected" ? now : null;

    if (!mark.review.history || !Array.isArray(mark.review.history)) {
      mark.review.history = [
        { status: oldStatus, at: now, comment: mark.review.comment, reviewer: mark.review.reviewer },
      ];
    }
    mark.review.history.push({
      status: newStatus,
      at: now,
      comment: mark.review.comment,
      reviewer: mark.review.reviewer,
    });

    recordChange("mark", "modify", mark.id, mark.code, beforeData, mark);

    save();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, markId);
    UI.showToast(`状态已变更为「${UI.reviewStatusNames[newStatus]}」`, "success");
  }

  function parseDepthValue(depthStr) {
    if (!depthStr) return 0;
    const match = String(depthStr).match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 0;
  }

  function getDepthRange(depthStr) {
    const val = parseDepthValue(depthStr);
    if (val <= 0) return "未知";
    if (val < 10) return "0-10米";
    if (val < 15) return "10-15米";
    if (val < 20) return "15-20米";
    if (val < 25) return "20-25米";
    if (val < 30) return "25-30米";
    return "30米以上";
  }

  function getLocationZone(x, y) {
    if (x === undefined || y === undefined) return "未知区域";
    const col = x < 33 ? "艉" : (x < 66 ? "中" : "艏");
    const row = y < 33 ? "左舷" : (y < 66 ? "中部" : "右舷");
    return row + col;
  }

  function buildRevisitTaskKey(dive, type, depthRange, locationZone) {
    return `${dive || "未知"}|${type || "unknown"}|${depthRange || "未知"}|${locationZone || "未知区域"}`;
  }

  function hashKeyToStableId(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const chr = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return "rt-" + Math.abs(hash).toString(36);
  }

  function aggregateRevisitTasks() {
    const targetMarks = marks.filter(m => {
      const status = m.review?.status || "collected";
      return status === "pending" || status === "revisit";
    });

    const groups = new Map();

    targetMarks.forEach(mark => {
      const dive = mark.dive || "未知";
      const type = mark.type || "unknown";
      const depthRange = getDepthRange(mark.depth);
      const locationZone = getLocationZone(mark.x, mark.y);
      const key = buildRevisitTaskKey(dive, type, depthRange, locationZone);
      const stableId = hashKeyToStableId(key);

      if (!groups.has(stableId)) {
        groups.set(stableId, {
          id: stableId,
          key,
          dive,
          type,
          depthRange,
          locationZone,
          markIds: [],
          marks: [],
          priority: "medium",
          handlingMethod: "",
          notes: "",
        });
      }
      const group = groups.get(stableId);
      group.markIds.push(mark.id);
      group.marks.push({
        id: mark.id,
        code: mark.code,
        type: mark.type,
        depth: mark.depth,
        x: mark.x,
        y: mark.y,
        condition: mark.condition || "",
        note: mark.note || "",
        reviewStatus: mark.review?.status || "collected",
        reviewComment: mark.review?.comment || "",
      });
    });

    const result = [];
    groups.forEach(group => {
      const saved = revisitPlan.find(p => p.id === group.id);
      if (saved) {
        result.push({
          ...group,
          priority: saved.priority || "medium",
          handlingMethod: saved.handlingMethod || "",
          notes: saved.notes || "",
          createdAt: saved.createdAt || group.createdAt,
          updatedAt: saved.updatedAt || new Date().toISOString(),
        });
      } else {
        result.push({
          ...group,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    result.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return (a.dive || "").localeCompare(b.dive || "");
    });

    return result;
  }

  function handleSaveRevisitTask(taskData) {
    const existingIndex = revisitPlan.findIndex(t => t.id === taskData.id);
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      revisitPlan[existingIndex] = {
        ...revisitPlan[existingIndex],
        priority: taskData.priority,
        handlingMethod: taskData.handlingMethod,
        notes: taskData.notes,
        updatedAt: now,
      };
    } else {
      revisitPlan.push({
        id: taskData.id,
        key: taskData.key,
        dive: taskData.dive,
        type: taskData.type,
        depthRange: taskData.depthRange,
        locationZone: taskData.locationZone,
        priority: taskData.priority || "medium",
        handlingMethod: taskData.handlingMethod || "",
        notes: taskData.notes || "",
        createdAt: now,
        updatedAt: now,
      });
    }

    saveRevisitPlan();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, currentEditId, null, baseMap, revisitPlan);
    return true;
  }

  function handleDeleteRevisitTask(taskId) {
    revisitPlan = revisitPlan.filter(t => t.id !== taskId);
    saveRevisitPlan();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, currentEditId, null, baseMap, revisitPlan);
  }

  function handleCreateDiveFromRevisitPlan(taskIds) {
    const allTasks = aggregateRevisitTasks();
    const tasks = allTasks.filter(t => taskIds.includes(t.id));
    if (tasks.length === 0) {
      UI.showToast("请选择至少一个任务", "error");
      return null;
    }

    const diveNum = dives.length + 1;
    const diveCode = `DIVE-${String(diveNum).padStart(2, '0')}`;
    const today = new Date().toISOString().split('T')[0];

    const objectives = tasks.map(t => {
      const typeName = UI.typeNames[t.type] || t.type;
      const count = t.marks.length;
      return `[${typeName}] ${t.depthRange} ${t.locationZone}（${count}个标记）`;
    }).join("；");

    const allMarkIds = tasks.flatMap(t => t.markIds || []);
    const totalMarks = allMarkIds.length;

    const newDive = {
      id: crypto.randomUUID(),
      code: diveCode,
      date: today,
      leader: "",
      weather: "sunny",
      current: "weak",
      visibility: "",
      objective: `返潜任务：共${tasks.length}组任务，${totalMarks}个标记。${objectives}`,
      participants: [],
      revisitTasks: tasks.map(t => ({
        taskId: t.id,
        taskKey: t.key,
        dive: t.dive,
        type: t.type,
        depthRange: t.depthRange,
        locationZone: t.locationZone,
        priority: t.priority,
        handlingMethod: t.handlingMethod,
        notes: t.notes,
        markCount: t.marks.length,
        markIds: [...t.markIds],
      })),
    };

    dives.push(newDive);
    saveDives();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, currentEditId, null, baseMap, revisitPlan);
    UI.showToast(`已创建潜次「${diveCode}」，包含${tasks.length}组返潜任务`, "success");
    return newDive;
  }

  function handleDeleteMark(id) {
    const mark = marks.find((m) => m.id === id);
    if (mark) {
      recordChange("mark", "delete", mark.id, mark.code, mark, null);
    }
    marks = marks.filter((m) => m.id !== id);
    UI.resetForm();
    save();
    UI.updateState(marks, dives, measurements, scale, gridConfig, null, null);
  }

  function handleSaveDive(data) {
    const formData = { ...data };
    const participants = formData.participants || [];
    delete formData.participants;
    const isEdit = !!formData.id;
    const oldDive = isEdit ? dives.find(d => d.id === formData.id) : null;
    const oldCode = oldDive ? oldDive.code : null;

    if (isEdit && oldDive) {
      const beforeData = JSON.parse(JSON.stringify(oldDive));
      Object.assign(oldDive, formData);
      oldDive.participants = participants;

      if (oldCode && oldCode !== formData.code) {
        marks.forEach(m => {
          if (m.dive === oldCode) {
            const beforeMark = JSON.parse(JSON.stringify(m));
            m.dive = formData.code;
            recordChange("mark", "modify", m.id, m.code, beforeMark, m);
          }
        });
        measurements.forEach(m => {
          if (m.dive === oldCode) {
            const beforeMeas = JSON.parse(JSON.stringify(m));
            m.dive = formData.code;
            recordChange("measurement", "modify", m.id, m.code, beforeMeas, m);
          }
        });
        views.forEach(v => {
          if (v.dive === oldCode) {
            v.dive = formData.code;
          }
          if (v.heatmapGroup === "dive_" + oldCode) {
            v.heatmapGroup = "dive_" + formData.code;
          }
        });
        saveViews();
        save();
        saveMeasurements();
      }

      recordChange("dive", "modify", oldDive.id, oldDive.code, beforeData, oldDive);
    } else {
      const newDive = {
        ...formData,
        id: crypto.randomUUID(),
        participants: participants,
      };
      dives.push(newDive);
      recordChange("dive", "add", newDive.id, newDive.code, null, newDive);
    }
    saveDives();
    UI.resetDiveForm();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, currentEditId);
    UI.showToast("潜次档案已保存", "success");
  }

  function handleDeleteDive(id) {
    const dive = dives.find(d => d.id === id);
    if (!dive) return;

    const diveSnapshot = JSON.parse(JSON.stringify(dive));
    const associatedMarks = marks.filter(m => m.dive === dive.code);
    const associatedMeasurements = measurements.filter(m => m.dive === dive.code);

    if (associatedMarks.length > 0 || associatedMeasurements.length > 0) {
      if (!confirm(`该潜次关联了 ${associatedMarks.length} 个标记和 ${associatedMeasurements.length} 条测距记录，删除后这些关联字段将被清空。确定删除吗？`)) {
        return;
      }
      marks.forEach(m => {
        if (m.dive === dive.code) {
          const beforeMark = JSON.parse(JSON.stringify(m));
          m.dive = "";
          recordChange("mark", "modify", m.id, m.code, beforeMark, m);
        }
      });
      measurements.forEach(m => {
        if (m.dive === dive.code) {
          const beforeMeas = JSON.parse(JSON.stringify(m));
          m.dive = "";
          recordChange("measurement", "modify", m.id, m.code, beforeMeas, m);
        }
      });
      save();
      saveMeasurements();
    }

    recordChange("dive", "delete", diveSnapshot.id, diveSnapshot.code, diveSnapshot, null);
    dives = dives.filter((d) => d.id !== id);
    views = validateAndDegradeViews(views);
    const hasDegraded = views.some(v => v._degraded);
    if (hasDegraded) {
      views.forEach(v => delete v._degraded);
    }
    saveViews();
    UI.resetDiveForm();
    saveDives();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, currentEditId);
    UI.updateViewSelector(views);
    UI.showToast(hasDegraded ? "潜次档案已删除，相关视图条件已降级" : "潜次档案已删除", hasDegraded ? "info" : "info");
  }

  function handleSaveMeasurement(data) {
    const validation = Validation.validateMeasurement(data, 0);
    if (!validation.valid) {
      UI.showToast(validation.errors[0], "error");
      return;
    }

    if (!data.points || data.points.length < 2) {
      UI.showToast("请至少在地图上点击2个点", "error");
      return;
    }

    if (data.id) {
      const measurement = measurements.find((m) => m.id === data.id);
      if (measurement) {
        const beforeData = JSON.parse(JSON.stringify(measurement));
        Object.assign(measurement, data);
        recordChange("measurement", "modify", measurement.id, measurement.code, beforeData, measurement);
      }
    } else {
      const newMeasurement = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      measurements.push(newMeasurement);
      recordChange("measurement", "add", newMeasurement.id, newMeasurement.code, null, newMeasurement);
    }
    saveMeasurements();
    UI.resetMeasureForm();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, currentEditId, data.id || null);
    UI.showToast("测距记录已保存", "success");
  }

  function handleDeleteMeasurement(id) {
    const measurement = measurements.find((m) => m.id === id);
    if (measurement) {
      recordChange("measurement", "delete", measurement.id, measurement.code, measurement, null);
    }
    measurements = measurements.filter((m) => m.id !== id);
    UI.resetMeasureForm();
    saveMeasurements();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, currentEditId, null);
    UI.showToast("测距记录已删除", "info");
  }

  function handleUpdateScale(newScale) {
    scale = newScale;
    saveScale();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, currentEditId);
    UI.showToast("比例尺校准成功", "success");
  }

  function handleUpdateGridConfig(newConfig) {
    gridConfig = newConfig;
    saveGridConfig();
  }

  function handleUpdateBaseMap(newBaseMap) {
    baseMap = newBaseMap;
    saveBaseMap();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, currentEditId, null, baseMap);
    UI.showToast(newBaseMap ? "底图已更新" : "底图已重置为默认", "success");
  }

  function handleExport() {
    const projectName = currentProject ? currentProject.name : "dive-records";
    const safeName = projectName.replace(/[^\w\u4e00-\u9fff-]/g, "_");
    DataIO.exportFullData(marks, dives, measurements, scale, gridConfig, baseMap, revisitPlan, safeName + ".json");
  }

  function handleExportOfflineMerge() {
    const projectName = currentProject ? currentProject.name : "dive-records";
    const safeName = projectName.replace(/[^\w\u4e00-\u9fff-]/g, "_");
    if (typeof MergeModule !== "undefined" && typeof MergeModule.buildExportData === "function") {
      DataIO.exportOfflineMerge(marks, dives, measurements, scale, gridConfig, baseMap, safeName + "-offline.json");
    } else {
      handleExport();
    }
  }

  async function handleImport() {
    try {
      const file = await DataIO.triggerFileInput();
      const text = await DataIO.readFileAsText(file);
      const parsed = DataIO.parseJSON(text);

      if (!parsed.success) {
        UI.showToast("JSON 解析失败: " + parsed.error, "error");
        return;
      }

      const isSnapshotExport = DataIO.isSnapshotExportFormat(parsed.data);
      if (isSnapshotExport && typeof SnapshotModule !== "undefined") {
        if (currentProject && currentProject.archived) {
          UI.showToast("归档项目无法导入快照，请先恢复项目", "error");
          return;
        }
        if (!confirm(`检测到快照导出文件：\n「${parsed.data.snapshotDescription || "未命名快照"}」\n\n导入后将添加到当前项目的版本历史中，您可以随后选择回滚到此快照。\n\n是否继续导入？`)) {
          UI.showToast("已取消导入", "info");
          return;
        }
        const result = SnapshotModule.importSnapshotData(parsed.data, { autoRollback: false });
        if (result.success) {
          UI.showToast("快照已导入到版本历史，可在项目管理中查看并回滚", "success");
        } else {
          UI.showToast(result.error || "快照导入失败", "error");
        }
        return;
      }

      const isOfflineMerge = DataIO.isOfflineMergeFormat(parsed.data);
      if (isOfflineMerge && typeof MergeModule !== "undefined") {
        const localData = {
          marks,
          dives,
          measurements,
          scale,
          gridConfig,
        };
        const analysis = MergeModule.analyzeMerge(localData, parsed.data);
        UI.showMergePreview(
          analysis,
          (resolutions) => {
            applyOfflineMerge(analysis, resolutions);
          },
          () => {
            UI.showToast("已取消合并", "info");
          }
        );
        return;
      }

      const isFullFormat = DataIO.isFullDataFormat(parsed.data);
      const isFullFormatV3 = DataIO.isFullDataFormatV3(parsed.data);
      const isFullFormatV4 = DataIO.isFullDataFormatV4(parsed.data);
      const isFullFormatV5 = DataIO.isFullDataFormatV5(parsed.data);
      const isFullFormatV6 = DataIO.isFullDataFormatV6(parsed.data);
      const isFullFormatV7 = DataIO.isFullDataFormatV7(parsed.data);
      let comparison;

      if (isFullFormatV7) {
        const markComparison = Validation.compareMarks(marks, parsed.data.marks || []);
        const diveComparison = Validation.compareDives(dives, parsed.data.dives || []);
        const measurementComparison = Validation.compareMeasurements(measurements, parsed.data.measurements || []);

        if (!markComparison.valid) {
          UI.showToast(markComparison.errors[0], "error");
          return;
        }
        if (!diveComparison.valid) {
          UI.showToast(diveComparison.errors[0], "error");
          return;
        }
        if (!measurementComparison.valid) {
          UI.showToast(measurementComparison.errors[0], "error");
          return;
        }

        comparison = {
          isFullFormat: true,
          isFullFormatV3: true,
          isFullFormatV4: true,
          isFullFormatV5: true,
          isFullFormatV6: true,
          isFullFormatV7: true,
          version: parsed.data.version || "7.0",
          marks: markComparison,
          dives: diveComparison,
          measurements: measurementComparison,
          scale: parsed.data.scale,
          gridConfig: parsed.data.gridConfig,
          baseMap: parsed.data.baseMap,
          revisitPlan: parsed.data.revisitPlan || [],
        };
      } else if (isFullFormatV6) {
        const markComparison = Validation.compareMarks(marks, parsed.data.marks || []);
        const diveComparison = Validation.compareDives(dives, parsed.data.dives || []);
        const measurementComparison = Validation.compareMeasurements(measurements, parsed.data.measurements || []);

        if (!markComparison.valid) {
          UI.showToast(markComparison.errors[0], "error");
          return;
        }
        if (!diveComparison.valid) {
          UI.showToast(diveComparison.errors[0], "error");
          return;
        }
        if (!measurementComparison.valid) {
          UI.showToast(measurementComparison.errors[0], "error");
          return;
        }

        comparison = {
          isFullFormat: true,
          isFullFormatV3: true,
          isFullFormatV4: true,
          isFullFormatV5: true,
          isFullFormatV6: true,
          version: parsed.data.version || "6.0",
          marks: markComparison,
          dives: diveComparison,
          measurements: measurementComparison,
          scale: parsed.data.scale,
          gridConfig: parsed.data.gridConfig,
        };
      } else if (isFullFormatV5) {
        const markComparison = Validation.compareMarks(marks, parsed.data.marks || []);
        const diveComparison = Validation.compareDives(dives, parsed.data.dives || []);
        const measurementComparison = Validation.compareMeasurements(measurements, parsed.data.measurements || []);

        if (!markComparison.valid) {
          UI.showToast(markComparison.errors[0], "error");
          return;
        }
        if (!diveComparison.valid) {
          UI.showToast(diveComparison.errors[0], "error");
          return;
        }
        if (!measurementComparison.valid) {
          UI.showToast(measurementComparison.errors[0], "error");
          return;
        }

        comparison = {
          isFullFormat: true,
          isFullFormatV3: true,
          isFullFormatV4: true,
          isFullFormatV5: true,
          version: parsed.data.version || "5.0",
          marks: markComparison,
          dives: diveComparison,
          measurements: measurementComparison,
          scale: parsed.data.scale,
          gridConfig: parsed.data.gridConfig,
        };
      } else if (isFullFormatV4) {
        const markComparison = Validation.compareMarks(marks, parsed.data.marks || []);
        const diveComparison = Validation.compareDives(dives, parsed.data.dives || []);
        const measurementComparison = Validation.compareMeasurements(measurements, parsed.data.measurements || []);

        if (!markComparison.valid) {
          UI.showToast(markComparison.errors[0], "error");
          return;
        }
        if (!diveComparison.valid) {
          UI.showToast(diveComparison.errors[0], "error");
          return;
        }
        if (!measurementComparison.valid) {
          UI.showToast(measurementComparison.errors[0], "error");
          return;
        }

        comparison = {
          isFullFormat: true,
          isFullFormatV3: true,
          isFullFormatV4: true,
          isFullFormatV5: false,
          version: parsed.data.version || "4.0",
          marks: markComparison,
          dives: diveComparison,
          measurements: measurementComparison,
          scale: parsed.data.scale,
          gridConfig: parsed.data.gridConfig,
        };
      } else if (isFullFormatV3) {
        const markComparison = Validation.compareMarks(marks, parsed.data.marks || []);
        const diveComparison = Validation.compareDives(dives, parsed.data.dives || []);

        if (!markComparison.valid) {
          UI.showToast(markComparison.errors[0], "error");
          return;
        }
        if (!diveComparison.valid) {
          UI.showToast(diveComparison.errors[0], "error");
          return;
        }

        comparison = {
          isFullFormat: true,
          isFullFormatV3: false,
          version: parsed.data.version || "2.0",
          marks: markComparison,
          dives: diveComparison,
        };
      } else {
        const markComparison = Validation.compareMarks(marks, parsed.data);

        if (!markComparison.valid) {
          UI.showToast(markComparison.errors[0], "error");
          return;
        }

        comparison = {
          isFullFormat: false,
          isFullFormatV3: false,
          marks: markComparison,
        };
      }

      UI.showImportPreview(
        comparison,
        (resolutions) => {
          applyImport(comparison, resolutions);
        },
        () => {
          UI.showToast("已取消导入", "info");
        }
      );
    } catch (e) {
      if (e.message !== "File selection cancelled") {
        UI.showToast("导入失败: " + e.message, "error");
      }
    }
  }

  async function handleImportCSV() {
    try {
      const file = await DataIO.triggerCSVInput();
      const text = await DataIO.readFileAsText(file);
      const parsed = DataIO.parseCSVToMultiType(text);

      if (!parsed.success) {
        UI.showToast("CSV 解析失败: " + parsed.error, "error");
        return;
      }

      if (parsed.rows.length === 0) {
        UI.showToast("CSV 文件中没有数据行", "error");
        return;
      }

      UI.showCSVFieldMappingPreview(
        parsed,
        (userMapping) => {
          const remappedMarks = [];
          const remappedDives = [];
          const remappedMeasurements = [];

          parsed.rows.forEach((row, idx) => {
            const mapped = {};
            for (const [field, header] of Object.entries(userMapping)) {
              if (header && row[header] !== undefined) {
                mapped[field] = row[header];
              }
            }

            const lineNumber = idx + 2;
            const dataType = mapped.dataType ? DataIO.mapDataType(mapped.dataType) : null;

            let detectedType = dataType;
            if (!detectedType) {
              const hasDiveFields = mapped.date || mapped.leader || mapped.objective;
              const hasMeasurementFields = mapped.length || mapped.x1 || mapped.x2 || mapped.points;
              const hasMarkFields = mapped.type || mapped.depth || mapped.orientation || mapped.condition;

              if (hasDiveFields && !hasMeasurementFields && !hasMarkFields) {
                detectedType = "dive";
              } else if (hasMeasurementFields && !hasDiveFields && !hasMarkFields) {
                detectedType = "measurement";
              } else {
                detectedType = "mark";
              }
            }

            if (detectedType === "dive") {
              const participants = [];
              if (mapped.participants && mapped.participants.trim()) {
                const names = mapped.participants.split(/[;；,，]/).filter(n => n.trim());
                names.forEach(name => {
                  participants.push({
                    name: name.trim(),
                    role: "",
                    equipment: "",
                  });
                });
              }

              const dive = {
                code: mapped.code ? mapped.code.trim() : "",
                date: mapped.date ? mapped.date.trim() : "",
                leader: mapped.leader ? mapped.leader.trim() : "",
                weather: DataIO.mapWeather(mapped.weather),
                current: DataIO.mapCurrent(mapped.current),
                visibility: mapped.visibility ? mapped.visibility.trim() : "",
                objective: mapped.objective ? mapped.objective.trim() : "",
                participants,
                _csvLineNumber: lineNumber,
                _rawRow: { ...row },
              };
              remappedDives.push(dive);
            } else if (detectedType === "measurement") {
              const points = [];

              if (mapped.points && mapped.points.trim()) {
                const coordPairs = mapped.points.split(/[;；]/).filter(p => p.trim());
                coordPairs.forEach(pair => {
                  const coords = pair.split(/[,，\s]+/).filter(c => c.trim());
                  if (coords.length >= 2) {
                    const x = DataIO.parseCoordinate(coords[0]);
                    const y = DataIO.parseCoordinate(coords[1]);
                    if (x !== null && y !== null) {
                      points.push({ x, y });
                    }
                  }
                });
              }

              if (points.length < 2) {
                const x1 = DataIO.parseCoordinate(mapped.x1);
                const y1 = DataIO.parseCoordinate(mapped.y1);
                const x2 = DataIO.parseCoordinate(mapped.x2);
                const y2 = DataIO.parseCoordinate(mapped.y2);
                if (x1 !== null && y1 !== null) {
                  points.push({ x: x1, y: y1 });
                }
                if (x2 !== null && y2 !== null) {
                  points.push({ x: x2, y: y2 });
                }
              }

              const relatedMarks = [];
              if (mapped.relatedMarks && mapped.relatedMarks.trim()) {
                const codes = mapped.relatedMarks.split(/[;；,，]/).filter(c => c.trim());
                relatedMarks.push(...codes.map(c => c.trim()));
              }

              const length = mapped.length ? DataIO.parseCoordinate(mapped.length) : null;

              const measurement = {
                code: mapped.code ? mapped.code.trim() : "",
                dive: mapped.dive ? mapped.dive.trim() : "",
                length: length || 0,
                points,
                relatedMarks,
                _csvLineNumber: lineNumber,
                _rawRow: { ...row },
              };
              remappedMeasurements.push(measurement);
            } else {
              const mark = {
                code: mapped.code ? mapped.code.trim() : "",
                type: DataIO.mapType(mapped.type),
                dive: mapped.dive ? mapped.dive.trim() : "",
                depth: mapped.depth ? mapped.depth.trim() : "",
                orientation: mapped.orientation ? mapped.orientation.trim() : "",
                condition: mapped.condition ? mapped.condition.trim() : "",
                note: mapped.note ? mapped.note.trim() : "",
                sampling: {
                  sampleNo: mapped.sampleNo ? mapped.sampleNo.trim() : "",
                  sampleMethod: mapped.sampleMethod ? mapped.sampleMethod.trim() : "",
                  sampler: mapped.sampler ? mapped.sampler.trim() : "",
                  sampleTime: mapped.sampleTime ? mapped.sampleTime.trim() : "",
                },
              };

              if (mapped.x !== undefined) {
                const x = DataIO.parseCoordinate(mapped.x);
                if (x !== null) mark.x = x;
              }
              if (mapped.y !== undefined) {
                const y = DataIO.parseCoordinate(mapped.y);
                if (y !== null) mark.y = y;
              }

              mark._csvLineNumber = lineNumber;
              mark._rawRow = { ...row };
              remappedMarks.push(mark);
            }
          });

          const remappedParseResult = {
            ...parsed,
            mapping: userMapping,
            marks: remappedMarks,
            dives: remappedDives,
            measurements: remappedMeasurements,
          };

          const markComparison = remappedMarks.length > 0
            ? Validation.compareCSVMarks(marks, { ...remappedParseResult, marks: remappedMarks })
            : null;

          const diveComparison = remappedDives.length > 0
            ? Validation.compareCSVDives(dives, { ...remappedParseResult, dives: remappedDives })
            : null;

          const measurementComparison = remappedMeasurements.length > 0
            ? Validation.compareCSVMeasurements(measurements, { ...remappedParseResult, measurements: remappedMeasurements })
            : null;

          const comparison = {
            marks: markComparison,
            dives: diveComparison,
            measurements: measurementComparison,
          };

          UI.showCSVImportPreview(
            remappedParseResult,
            comparison,
            (resolutions) => {
              applyCSVImport(remappedParseResult, comparison, resolutions);
            },
            () => {
              UI.showToast("已取消CSV导入", "info");
            }
          );
        },
        () => {
          UI.showToast("已取消CSV导入", "info");
        }
      );
    } catch (e) {
      if (e.message !== "File selection cancelled" && e.message !== "No file selected") {
        UI.showToast("CSV导入失败: " + e.message, "error");
      }
    }
  }

  function applyCSVImport(csvParseResult, comparison, resolutions) {
    const { markResolutions, diveResolutions, measurementResolutions } = resolutions;
    const { marks: markComparison, dives: diveComparison, measurements: measurementComparison } = comparison;

    let updatedMarks = [...marks];
    let updatedDives = [...dives];
    let updatedMeasurements = [...measurements];

    if (markComparison) {
      const { newMarks, conflicts } = markComparison;

      if (conflicts.length > 0) {
        updatedMarks = Validation.resolveMarkConflicts(
          updatedMarks,
          conflicts,
          markResolutions || []
        );
      }

      if (newMarks.length > 0) {
        updatedMarks = Validation.addNewMarks(updatedMarks, newMarks);
      }
    }

    if (diveComparison) {
      const { newDives, conflicts } = diveComparison;

      if (conflicts.length > 0) {
        updatedDives = Validation.resolveDiveConflicts(
          updatedDives,
          conflicts,
          diveResolutions || []
        );
      }

      if (newDives.length > 0) {
        updatedDives = Validation.addNewDives(updatedDives, newDives);
      }
    }

    if (measurementComparison) {
      const { newMeasurements, conflicts } = measurementComparison;

      if (conflicts.length > 0) {
        updatedMeasurements = Validation.resolveMeasurementConflicts(
          updatedMeasurements,
          conflicts,
          measurementResolutions || []
        );
      }

      if (newMeasurements.length > 0) {
        updatedMeasurements = Validation.addNewMeasurements(updatedMeasurements, newMeasurements);
      }
    }

    marks = updatedMarks;
    dives = updatedDives;
    measurements = updatedMeasurements;

    autoCreateDivesFromMarks();

    save();
    saveDives();
    saveMeasurements();
    saveScale();
    saveGridConfig();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, currentEditId);

    let message = "CSV导入完成：";
    let parts = [];

    if (markComparison) {
      const markSummary = markComparison.summary;
      const markAdded = markSummary.new + (markResolutions?.filter((r) => r === "saveas").length || 0);
      const markOverwritten = markResolutions?.filter((r) => r === "overwrite").length || 0;
      if (markAdded > 0) parts.push(`标记新增 ${markAdded} 项`);
      if (markOverwritten > 0) parts.push(`标记覆盖 ${markOverwritten} 项`);
      if (markSummary.error > 0) parts.push(`标记跳过 ${markSummary.error} 项错误`);
    }

    if (diveComparison) {
      const diveSummary = diveComparison.summary;
      const diveAdded = diveSummary.new + (diveResolutions?.filter((r) => r === "saveas").length || 0);
      const diveOverwritten = diveResolutions?.filter((r) => r === "overwrite").length || 0;
      if (diveAdded > 0) parts.push(`潜次新增 ${diveAdded} 项`);
      if (diveOverwritten > 0) parts.push(`潜次覆盖 ${diveOverwritten} 项`);
      if (diveSummary.error > 0) parts.push(`潜次跳过 ${diveSummary.error} 项错误`);
    }

    if (measurementComparison) {
      const measurementSummary = measurementComparison.summary;
      const measureAdded = measurementSummary.new + (measurementResolutions?.filter((r) => r === "saveas").length || 0);
      const measureOverwritten = measurementResolutions?.filter((r) => r === "overwrite").length || 0;
      if (measureAdded > 0) parts.push(`测距新增 ${measureAdded} 项`);
      if (measureOverwritten > 0) parts.push(`测距覆盖 ${measureOverwritten} 项`);
      if (measurementSummary.error > 0) parts.push(`测距跳过 ${measurementSummary.error} 项错误`);
    }

    UI.showToast(message + parts.join("，"), "success");

    const newImportErrors = [];
    const now = new Date().toISOString();

    if (markComparison && markComparison.errors && markComparison.errors.length > 0) {
      markComparison.errors.forEach((err) => {
        newImportErrors.push({
          source: "csv",
          category: "marks",
          importedAt: now,
          index: err.index,
          lineNumber: err.lineNumber,
          code: err.mark?.code || null,
          errors: err.errors || [],
        });
      });
    }

    if (diveComparison && diveComparison.errors && diveComparison.errors.length > 0) {
      diveComparison.errors.forEach((err) => {
        newImportErrors.push({
          source: "csv",
          category: "dives",
          importedAt: now,
          index: err.index,
          lineNumber: err.lineNumber,
          code: err.dive?.code || null,
          errors: err.errors || [],
        });
      });
    }

    if (measurementComparison && measurementComparison.errors && measurementComparison.errors.length > 0) {
      measurementComparison.errors.forEach((err) => {
        newImportErrors.push({
          source: "csv",
          category: "measurements",
          importedAt: now,
          index: err.index,
          lineNumber: err.lineNumber,
          code: err.measurement?.code || null,
          errors: err.errors || [],
        });
      });
    }

    newImportErrors.sort((a, b) => (a.lineNumber || 0) - (b.lineNumber || 0));

    setImportErrors(newImportErrors);

    if (typeof SnapshotModule !== "undefined" && typeof SnapshotModule.handleImportSnapshot === "function") {
      SnapshotModule.handleImportSnapshot({ source: "csv", rows: parsed.rows.length }, "csv");
    }
  }

  function applyImport(comparison, resolutions) {
    const { markResolutions, diveResolutions, measurementResolutions } = resolutions;

    let updatedMarks = [...marks];
    let updatedDives = [...dives];
    let updatedMeasurements = [...measurements];

    if (comparison.dives) {
      const { newDives, conflicts, summary } = comparison.dives;

      if (conflicts.length > 0) {
        updatedDives = Validation.resolveDiveConflicts(
          updatedDives,
          conflicts,
          diveResolutions || []
        );
      }

      if (newDives.length > 0) {
        updatedDives = Validation.addNewDives(updatedDives, newDives);
      }
    }

    if (comparison.marks) {
      const { newMarks, conflicts, summary } = comparison.marks;

      if (conflicts.length > 0) {
        updatedMarks = Validation.resolveMarkConflicts(
          updatedMarks,
          conflicts,
          markResolutions || []
        );
      }

      if (newMarks.length > 0) {
        updatedMarks = Validation.addNewMarks(updatedMarks, newMarks);
      }
    }

    if (comparison.measurements) {
      const { newMeasurements, conflicts, summary } = comparison.measurements;

      if (conflicts.length > 0) {
        updatedMeasurements = Validation.resolveMeasurementConflicts(
          updatedMeasurements,
          conflicts,
          measurementResolutions || []
        );
      }

      if (newMeasurements.length > 0) {
        updatedMeasurements = Validation.addNewMeasurements(updatedMeasurements, newMeasurements);
      }

      if (comparison.scale) {
        const scaleValidation = Validation.validateScale(comparison.scale);
        if (scaleValidation.valid) {
          scale = comparison.scale;
        }
      }

      if (comparison.gridConfig) {
        const gridValidation = Validation.validateGridConfig(comparison.gridConfig);
        if (gridValidation.valid) {
          gridConfig = comparison.gridConfig;
        }
      }

      if (comparison.baseMap !== undefined) {
        baseMap = comparison.baseMap;
      }
    }

    if (comparison.revisitPlan && Array.isArray(comparison.revisitPlan)) {
      revisitPlan = comparison.revisitPlan;
    }

    marks = updatedMarks;
    dives = updatedDives;
    measurements = updatedMeasurements;

    autoCreateDivesFromMarks();

    save();
    saveDives();
    saveMeasurements();
    saveScale();
    saveGridConfig();
    saveBaseMap();
    saveRevisitPlan();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, currentEditId, null, baseMap, revisitPlan);

    const markSummary = comparison.marks?.summary;
    const diveSummary = comparison.dives?.summary;
    const measurementSummary = comparison.measurements?.summary;

    let message = "导入完成：";
    let parts = [];

    if (diveSummary) {
      const diveAdded = diveSummary.new + (diveResolutions?.filter((r) => r === "saveas").length || 0);
      const diveOverwritten = diveResolutions?.filter((r) => r === "overwrite").length || 0;
      if (diveAdded > 0) parts.push(`潜次新增 ${diveAdded} 项`);
      if (diveOverwritten > 0) parts.push(`潜次覆盖 ${diveOverwritten} 项`);
      if (diveSummary.error > 0) parts.push(`潜次跳过 ${diveSummary.error} 项错误`);
    }

    if (markSummary) {
      const markAdded = markSummary.new + (markResolutions?.filter((r) => r === "saveas").length || 0);
      const markOverwritten = markResolutions?.filter((r) => r === "overwrite").length || 0;
      if (markAdded > 0) parts.push(`标记新增 ${markAdded} 项`);
      if (markOverwritten > 0) parts.push(`标记覆盖 ${markOverwritten} 项`);
      if (markSummary.error > 0) parts.push(`标记跳过 ${markSummary.error} 项错误`);
    }

    if (measurementSummary) {
      const measureAdded = measurementSummary.new + (measurementResolutions?.filter((r) => r === "saveas").length || 0);
      const measureOverwritten = measurementResolutions?.filter((r) => r === "overwrite").length || 0;
      if (measureAdded > 0) parts.push(`测距新增 ${measureAdded} 项`);
      if (measureOverwritten > 0) parts.push(`测距覆盖 ${measureOverwritten} 项`);
      if (measurementSummary.error > 0) parts.push(`测距跳过 ${measurementSummary.error} 项错误`);
    }

    UI.showToast(message + parts.join("，"), "success");

    const newImportErrors = [];
    const now = new Date().toISOString();

    if (comparison.marks && comparison.marks.errors && comparison.marks.errors.length > 0) {
      comparison.marks.errors.forEach((err) => {
        newImportErrors.push({
          source: "json",
          category: "marks",
          importedAt: now,
          index: err.index,
          code: err.mark?.code || null,
          errors: err.errors || [],
        });
      });
    }

    if (comparison.dives && comparison.dives.errors && comparison.dives.errors.length > 0) {
      comparison.dives.errors.forEach((err) => {
        newImportErrors.push({
          source: "json",
          category: "dives",
          importedAt: now,
          index: err.index,
          code: err.dive?.code || null,
          errors: err.errors || [],
        });
      });
    }

    if (comparison.measurements && comparison.measurements.errors && comparison.measurements.errors.length > 0) {
      comparison.measurements.errors.forEach((err) => {
        newImportErrors.push({
          source: "json",
          category: "measurements",
          importedAt: now,
          index: err.index,
          code: err.measurement?.code || null,
          errors: err.errors || [],
        });
      });
    }

    setImportErrors(newImportErrors);

    if (typeof SnapshotModule !== "undefined" && typeof SnapshotModule.handleImportSnapshot === "function") {
      SnapshotModule.handleImportSnapshot(comparison, comparison.version || "7.0");
    }
  }

  function applyOfflineMerge(analysis, resolutions) {
    if (typeof MergeModule === "undefined") return;

    if (typeof UI.hideRollbackNotice === "function") {
      UI.hideRollbackNotice();
    }

    const localData = {
      marks,
      dives,
      measurements,
      scale,
      gridConfig,
    };

    const result = MergeModule.applyMerge(localData, analysis, resolutions);

    const testData = {
      marks: result.marks,
      dives: result.dives,
      measurements: result.measurements,
      scale: result.scale,
      gridConfig: result.gridConfig,
      baseMap: analysis.baseMap || baseMap,
    };
    const estimatedSize = new Blob([JSON.stringify(testData)]).size;
    const capacityCheck = DataIO.checkStorageCapacity(estimatedSize);
    if (capacityCheck.willExceed) {
      UI.showToast("合并失败：存储空间不足，请清理附件或导出备份后再试", "error");
      return;
    }

    MergeModule.saveSnapshot(marks, dives, measurements, scale, gridConfig, baseMap);

    marks = result.marks;
    dives = result.dives;
    measurements = result.measurements;
    scale = result.scale;
    gridConfig = result.gridConfig;

    if (analysis.baseMap !== undefined && analysis.baseMap !== null) {
      baseMap = analysis.baseMap;
    }

    autoCreateDivesFromMarks();

    try {
      save();
    } catch (e) {
      const snapshot = MergeModule.rollbackFromSnapshot();
      if (snapshot) {
        marks = snapshot.marks || [];
        dives = snapshot.dives || [];
        measurements = snapshot.measurements || [];
        scale = snapshot.scale || null;
        gridConfig = snapshot.gridConfig || { enabled: false, size: 1, showLabels: true };
        baseMap = snapshot.baseMap !== undefined ? snapshot.baseMap : baseMap;
      }
      MergeModule.clearSnapshot();
      UI.showToast("合并失败：保存数据时存储空间不足，已自动回滚", "error");
      UI.updateState(
        marks,
        dives,
        measurements,
        scale,
        gridConfig,
        pending,
        currentEditId,
        currentEditMeasureId,
        baseMap
      );
      return;
    }

    saveDives();
    saveMeasurements();
    saveScale();
    saveGridConfig();
    saveBaseMap();

    UI.updateState(
      marks,
      dives,
      measurements,
      scale,
      gridConfig,
      pending,
      currentEditId,
      currentEditMeasureId,
      baseMap
    );

    const summary = analysis.summary;
    let parts = [];

    if (summary?.marks) {
      const markAdded = summary.marks.new;
      const markModified = summary.marks.modified;
      const markDiverged = summary.marks.diverged;
      const markDeleted = summary.marks.deleted;
      if (markAdded > 0) parts.push(`标记新增 ${markAdded} 项`);
      if (markModified > 0) parts.push(`标记修改 ${markModified} 项`);
      if (markDiverged > 0) parts.push(`标记分叉 ${markDiverged} 项`);
      if (markDeleted > 0) parts.push(`标记删除 ${markDeleted} 项`);
      if (summary.marks.attachments) {
        const attNew = summary.marks.attachments.new || 0;
        const attMod = summary.marks.attachments.modified || 0;
        const attDel = summary.marks.attachments.deleted || 0;
        if (attNew > 0) parts.push(`附件新增 ${attNew} 项`);
        if (attMod > 0) parts.push(`附件变化 ${attMod} 项`);
        if (attDel > 0) parts.push(`附件删除 ${attDel} 项`);
      }
    }

    if (summary?.dives) {
      const diveAdded = summary.dives.new;
      const diveModified = summary.dives.modified;
      if (diveAdded > 0) parts.push(`潜次新增 ${diveAdded} 项`);
      if (diveModified > 0) parts.push(`潜次修改 ${diveModified} 项`);
    }

    if (summary?.measurements) {
      const measAdded = summary.measurements.new;
      if (measAdded > 0) parts.push(`测距新增 ${measAdded} 项`);
    }

    UI.showToast("合并完成：" + (parts.length > 0 ? parts.join("，") : "无变更"), capacityCheck.willWarn ? "warning" : "success");

    if (capacityCheck.willWarn) {
      setTimeout(() => {
        UI.showToast("提示：存储空间接近上限，建议清理旧附件或导出备份", "warning");
      }, 2500);
    }

    if (typeof SnapshotModule !== "undefined" && typeof SnapshotModule.handleMergeSnapshot === "function") {
      SnapshotModule.handleMergeSnapshot({
        deviceId: analysis.deviceId,
        deviceName: analysis.deviceName,
        exportDate: analysis.exportDate,
      });
    }

    const snapshot = MergeModule.loadSnapshot();
    if (snapshot) {
      UI.showRollbackNotice(snapshot.timestamp, () => {
        rollbackFromMerge();
      });
    }
  }

  function rollbackFromMerge() {
    if (typeof MergeModule === "undefined") return;

    const snapshot = MergeModule.rollbackFromSnapshot();
    if (!snapshot) {
      UI.showToast("没有可撤销的合并快照", "error");
      return;
    }

    marks = snapshot.marks || [];
    dives = snapshot.dives || [];
    measurements = snapshot.measurements || [];
    scale = snapshot.scale || null;
    gridConfig = snapshot.gridConfig || { enabled: false, size: 1, showLabels: true };
    baseMap = snapshot.baseMap !== undefined ? snapshot.baseMap : baseMap;

    save();
    saveDives();
    saveMeasurements();
    saveScale();
    saveGridConfig();
    saveBaseMap();

    UI.updateState(
      marks,
      dives,
      measurements,
      scale,
      gridConfig,
      pending,
      currentEditId,
      currentEditMeasureId,
      baseMap
    );

    MergeModule.clearSnapshot();
    if (typeof UI.hideRollbackNotice === "function") {
      UI.hideRollbackNotice();
    }

    UI.showToast("已撤销合并，数据已恢复", "success");
  }

  function checkMergeSnapshot() {
    if (typeof MergeModule === "undefined") return;
    if (MergeModule.hasSnapshot()) {
      const snapshot = MergeModule.loadSnapshot();
      if (snapshot) {
        UI.showRollbackNotice(snapshot.timestamp, () => {
          rollbackFromMerge();
        });
      }
    }
  }

  function handleGetTimeline(options) {
    if (typeof SnapshotModule === "undefined") return { total: 0, items: [] };
    return SnapshotModule.getTimeline(options);
  }

  function handleGetSnapshotDetail(snapshotId) {
    if (typeof SnapshotModule === "undefined") return null;
    const snapshot = SnapshotModule.getSnapshotById(snapshotId);
    if (!snapshot) return null;
    return {
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      description: snapshot.description,
      entityType: snapshot.entityType,
      action: snapshot.action,
      entityCode: snapshot.entityCode,
      tags: snapshot.tags,
      metadata: snapshot.metadata,
      fieldDiff: snapshot.metadata?.fieldDiff,
      stats: snapshot.data ? {
        markCount: snapshot.data.marks?.length || 0,
        diveCount: snapshot.data.dives?.length || 0,
        measurementCount: snapshot.data.measurements?.length || 0,
        hasScale: !!snapshot.data.scale,
        hasGridConfig: !!snapshot.data.gridConfig,
        hasBaseMap: !!snapshot.data.baseMap,
        viewCount: snapshot.data.views?.length || 0,
        revisitPlanCount: snapshot.data.revisitPlan?.length || 0,
      } : null,
    };
  }

  function handleCheckRollbackConflicts(snapshotId) {
    if (typeof SnapshotModule === "undefined") return { valid: false, error: "快照模块未加载" };
    const snapshot = SnapshotModule.getSnapshotById(snapshotId);
    if (!snapshot) return { valid: false, error: "快照不存在" };
    return SnapshotModule.checkRollbackConflicts(snapshot);
  }

  function handleRollbackToSnapshot(snapshotId, options) {
    if (typeof SnapshotModule === "undefined") return { success: false, error: "快照模块未加载" };

    const currentProject = ProjectManager.getCurrentProject();
    if (currentProject && currentProject.archived) {
      return { success: false, error: "归档项目无法回滚，请先恢复项目" };
    }

    const result = SnapshotModule.rollbackToSnapshot(snapshotId, options);

    if (result.success) {
      marks = result.data.marks || [];
      dives = result.data.dives || [];
      measurements = result.data.measurements || [];
      scale = result.data.scale || null;
      gridConfig = result.data.gridConfig || { enabled: false, size: 1, showLabels: true };
      baseMap = result.data.baseMap || null;
      views = result.data.views || [];
      revisitPlan = result.data.revisitPlan || [];

      UI.resetAllState();
      UI.init({
        marks,
        dives,
        measurements,
        scale,
        gridConfig,
        baseMap,
        pending: null,
        currentEditId: null,
        importErrors,
        callbacks,
        currentProject,
        views,
        revisitPlan,
      });
      UI.render();
    }

    return result;
  }

  function handleCreateManualSnapshot(description) {
    if (typeof SnapshotModule === "undefined") return null;

    const currentProject = ProjectManager.getCurrentProject();
    if (currentProject && currentProject.archived) {
      UI.showToast("归档项目无法创建快照", "error");
      return null;
    }

    const snapshot = SnapshotModule.recordManualSnapshot(description);
    if (snapshot) {
      UI.showToast("快照已创建", "success");
    }
    return snapshot;
  }

  function handleGetSnapshotDiff(snapshotId1, snapshotId2) {
    if (typeof SnapshotModule === "undefined") return null;
    return SnapshotModule.getSnapshotDiff(snapshotId1, snapshotId2);
  }

  function handleGetSnapshotStorageStats() {
    if (typeof SnapshotModule === "undefined") return null;
    return SnapshotModule.getStorageStats();
  }

  function handleExportSnapshot(snapshotId) {
    if (typeof SnapshotModule === "undefined") {
      UI.showToast("快照模块未加载", "error");
      return;
    }
    const data = SnapshotModule.exportSnapshotData(snapshotId);
    if (!data) {
      UI.showToast("快照不存在", "error");
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `snapshot-${data.snapshotId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    UI.showToast("快照已导出", "success");
  }

  async function handleImportSnapshot() {
    if (typeof SnapshotModule === "undefined") {
      UI.showToast("快照模块未加载", "error");
      return;
    }

    const currentProject = ProjectManager.getCurrentProject();
    if (currentProject && currentProject.archived) {
      UI.showToast("归档项目无法导入快照", "error");
      return;
    }

    try {
      const file = await DataIO.triggerFileInput();
      const text = await DataIO.readFileAsText(file);
      const parsed = JSON.parse(text);

      const result = SnapshotModule.importSnapshotData(parsed, { autoRollback: false });
      if (!result.success) {
        UI.showToast(result.error, "error");
        return;
      }

      UI.showToast("快照已导入，可在版本历史中查看并回滚", "success");
      return result;
    } catch (e) {
      if (e.message !== "File selection cancelled" && e.message !== "No file selected") {
        UI.showToast("导入失败: " + e.message, "error");
      }
    }
  }

  function handleApplyOfflineMergeSnapshot(importData) {
    if (typeof SnapshotModule !== "undefined" && typeof SnapshotModule.handleMergeSnapshot === "function") {
      SnapshotModule.handleMergeSnapshot(importData);
    }
  }

  function handleApplyImportSnapshot(importData, version) {
    if (typeof SnapshotModule !== "undefined" && typeof SnapshotModule.handleImportSnapshot === "function") {
      SnapshotModule.handleImportSnapshot(importData, version);
    }
  }

  return {
    init,
  };
})();

document.addEventListener("DOMContentLoaded", App.init);
