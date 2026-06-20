const App = (() => {
  let marks = [];
  let dives = [];
  let measurements = [];
  let scale = null;
  let gridConfig = { enabled: false, size: 1, showLabels: true };
  let pending = null;
  let currentEditId = null;
  let currentEditMeasureId = null;
  let importErrors = [];
  let currentProject = null;

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
    marks = DataIO.loadMarks();
    dives = DataIO.loadDives();
    measurements = DataIO.loadMeasurements();
    scale = DataIO.loadScale();
    importErrors = DataIO.loadImportErrors();
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
  }

  function recordChange(entityType, action, entityId, entityCode, beforeData, afterData) {
    if (typeof MergeModule !== "undefined" && typeof MergeModule.recordChange === "function") {
      MergeModule.recordChange(entityType, action, entityId, entityCode, beforeData, afterData);
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
    };

    UI.init({
      marks,
      dives,
      measurements,
      scale,
      gridConfig,
      pending,
      currentEditId,
      importErrors,
      callbacks,
      currentProject,
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
      pending,
      currentEditId,
      importErrors,
      callbacks,
      currentProject,
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
          pending,
          currentEditId,
          importErrors,
          callbacks,
          currentProject,
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
    UI.resetDiveForm();
    saveDives();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, currentEditId);
    UI.showToast("潜次档案已删除", "info");
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

  function handleExport() {
    const projectName = currentProject ? currentProject.name : "dive-records";
    const safeName = projectName.replace(/[^\w\u4e00-\u9fff-]/g, "_");
    DataIO.exportFullData(marks, dives, measurements, scale, gridConfig, safeName + ".json");
  }

  function handleExportOfflineMerge() {
    const projectName = currentProject ? currentProject.name : "dive-records";
    const safeName = projectName.replace(/[^\w\u4e00-\u9fff-]/g, "_");
    if (typeof MergeModule !== "undefined" && typeof MergeModule.buildExportData === "function") {
      DataIO.exportOfflineMerge(marks, dives, measurements, scale, gridConfig, safeName + "-offline.json");
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
      let comparison;

      if (isFullFormatV6) {
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
      const parsed = DataIO.parseCSVToMarks(text);

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
          const remappedMarks = parsed.rows.map((row, idx) => {
            const mapped = {};
            for (const [field, header] of Object.entries(userMapping)) {
              if (header && row[header] !== undefined) {
                mapped[field] = row[header];
              }
            }

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

            mark._csvLineNumber = idx + 2;
            mark._rawRow = { ...row };
            return mark;
          });

          const remappedParseResult = {
            ...parsed,
            mapping: userMapping,
            marks: remappedMarks,
          };

          const comparison = Validation.compareCSVMarks(marks, remappedParseResult);

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
    const { markResolutions } = resolutions;

    let updatedMarks = [...marks];

    const { newMarks, conflicts, summary } = comparison;

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

    marks = updatedMarks;

    autoCreateDivesFromMarks();

    save();
    saveDives();
    saveMeasurements();
    saveScale();
    saveGridConfig();
    UI.updateState(marks, dives, measurements, scale, gridConfig, pending, currentEditId);

    const markAdded = summary.new + (markResolutions?.filter((r) => r === "saveas").length || 0);
    const markOverwritten = markResolutions?.filter((r) => r === "overwrite").length || 0;

    let message = "CSV导入完成：";
    let parts = [];
    if (markAdded > 0) parts.push(`标记新增 ${markAdded} 项`);
    if (markOverwritten > 0) parts.push(`标记覆盖 ${markOverwritten} 项`);
    if (summary.error > 0) parts.push(`跳过 ${summary.error} 项错误`);

    UI.showToast(message + parts.join("，"), "success");

    const newImportErrors = [];
    const now = new Date().toISOString();

    if (comparison.errors && comparison.errors.length > 0) {
      comparison.errors.forEach((err) => {
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

    setImportErrors(newImportErrors);
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
  }

  function applyOfflineMerge(analysis, resolutions) {
    if (typeof MergeModule === "undefined") return;

    if (typeof UI.hideRollbackNotice === "function") {
      UI.hideRollbackNotice();
    }

    MergeModule.saveSnapshot(marks, dives, measurements, scale, gridConfig);

    const localData = {
      marks,
      dives,
      measurements,
      scale,
      gridConfig,
    };

    const result = MergeModule.applyMerge(localData, analysis, resolutions);

    marks = result.marks;
    dives = result.dives;
    measurements = result.measurements;
    scale = result.scale;
    gridConfig = result.gridConfig;

    autoCreateDivesFromMarks();

    save();
    saveDives();
    saveMeasurements();
    saveScale();
    saveGridConfig();

    UI.updateState(
      marks,
      dives,
      measurements,
      scale,
      gridConfig,
      pending,
      currentEditId,
      currentEditMeasureId
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

    UI.showToast("合并完成：" + (parts.length > 0 ? parts.join("，") : "无变更"), "success");

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

    save();
    saveDives();
    saveMeasurements();
    saveScale();
    saveGridConfig();

    UI.updateState(
      marks,
      dives,
      measurements,
      scale,
      gridConfig,
      pending,
      currentEditId,
      currentEditMeasureId
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

  return {
    init,
  };
})();

document.addEventListener("DOMContentLoaded", App.init);
