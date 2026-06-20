const SnapshotModule = (() => {
  const SNAPSHOT_VERSION = "8.0";
  const SNAPSHOT_KEY_SUFFIX = "snapshots";
  const CURRENT_SNAPSHOT_KEY_SUFFIX = "currentSnapshotId";
  const MAX_SNAPSHOTS = 100;
  const SNAPSHOT_AUTO_THRESHOLD = 10;

  let _projectId = null;
  let _pendingChanges = 0;

  const ENTITY_TYPE_NAMES = {
    mark: "标记",
    dive: "潜次",
    measurement: "测距",
    scale: "比例尺",
    grid: "网格",
    attachment: "附件",
    projectConfig: "项目配置",
    baseMap: "底图",
    view: "视图",
    revisitPlan: "返潜计划",
  };

  const ACTION_NAMES = {
    add: "新增",
    modify: "编辑",
    delete: "删除",
    update: "更新",
    import: "导入",
    merge: "合并",
    rollback: "回滚",
    migrate: "迁移",
  };

  function setProjectId(projectId) {
    _projectId = projectId;
    _pendingChanges = 0;
  }

  function _snapshotsKey() {
    return _projectId
      ? ProjectManager.projKey(_projectId, SNAPSHOT_KEY_SUFFIX)
      : "zfl30_" + SNAPSHOT_KEY_SUFFIX;
  }

  function _currentSnapshotKey() {
    return _projectId
      ? ProjectManager.projKey(_projectId, CURRENT_SNAPSHOT_KEY_SUFFIX)
      : "zfl30_" + CURRENT_SNAPSHOT_KEY_SUFFIX;
  }

  function loadSnapshots() {
    try {
      return JSON.parse(localStorage.getItem(_snapshotsKey()) || "[]");
    } catch (e) {
      console.error("Failed to load snapshots:", e);
      return [];
    }
  }

  function saveSnapshots(snapshots) {
    const trimmed = snapshots.slice(-MAX_SNAPSHOTS);
    localStorage.setItem(_snapshotsKey(), JSON.stringify(trimmed));
  }

  function loadCurrentSnapshotId() {
    return localStorage.getItem(_currentSnapshotKey()) || null;
  }

  function saveCurrentSnapshotId(id) {
    if (id) {
      localStorage.setItem(_currentSnapshotKey(), id);
    } else {
      localStorage.removeItem(_currentSnapshotKey());
    }
  }

  function generateDescription(entityType, action, entityCode, extraInfo) {
    const typeName = ENTITY_TYPE_NAMES[entityType] || entityType;
    const actionName = ACTION_NAMES[action] || action;

    let desc = `${actionName}${typeName}`;
    if (entityCode) {
      desc += `「${entityCode}」`;
    }
    if (extraInfo) {
      desc += ` - ${extraInfo}`;
    }
    return desc;
  }

  function generateFieldDiffSummary(beforeData, afterData, ignoreKeys = []) {
    if (!beforeData || !afterData) return null;

    const changes = [];
    const allKeys = new Set([...Object.keys(beforeData), ...Object.keys(afterData)]);

    allKeys.forEach((key) => {
      if (ignoreKeys.includes(key)) return;
      if (key === "id" || key === "createdAt" || key === "updatedAt") return;

      const beforeVal = beforeData[key];
      const afterVal = afterData[key];

      const beforeStr = JSON.stringify(beforeVal);
      const afterStr = JSON.stringify(afterVal);

      if (beforeStr !== afterStr) {
        let displayBefore = beforeVal;
        let displayAfter = afterVal;

        if (typeof beforeVal === "object" && beforeVal !== null) {
          displayBefore = "[复杂数据]";
        }
        if (typeof afterVal === "object" && afterVal !== null) {
          displayAfter = "[复杂数据]";
        }

        changes.push({
          field: key,
          before: displayBefore,
          after: displayAfter,
        });
      }
    });

    return changes.length > 0 ? changes : null;
  }

  function captureProjectSnapshot() {
    return {
      marks: JSON.parse(JSON.stringify(DataIO.loadMarks() || [])),
      dives: JSON.parse(JSON.stringify(DataIO.loadDives() || [])),
      measurements: JSON.parse(JSON.stringify(DataIO.loadMeasurements() || [])),
      scale: JSON.parse(JSON.stringify(DataIO.loadScale() || null)),
      gridConfig: JSON.parse(JSON.stringify(DataIO.loadGridConfig() || null)),
      baseMap: JSON.parse(JSON.stringify(DataIO.loadBaseMap() || null)),
      views: JSON.parse(JSON.stringify(DataIO.loadViews() || [])),
      revisitPlan: JSON.parse(JSON.stringify(DataIO.loadRevisitPlan() || [])),
    };
  }

  function recordSnapshot(options = {}) {
    const {
      entityType,
      action,
      entityId,
      entityCode,
      beforeData,
      afterData,
      description,
      tags = [],
      metadata = {},
      auto = false,
    } = options;

    const snapshots = loadSnapshots();
    const now = new Date().toISOString();
    const deviceId = typeof MergeModule !== "undefined" && typeof MergeModule.getDeviceId === "function"
      ? MergeModule.getDeviceId()
      : null;

    let finalDescription = description;
    if (!finalDescription) {
      let extraInfo = null;
      if (action === "modify" && beforeData && afterData) {
        const diff = generateFieldDiffSummary(beforeData, afterData);
        if (diff && diff.length > 0) {
          const fieldNames = diff.slice(0, 3).map((d) => d.field).join("、");
          extraInfo = `修改${diff.length}个字段：${fieldNames}${diff.length > 3 ? "..." : ""}`;
        }
      }
      finalDescription = generateDescription(entityType, action, entityCode, extraInfo);
    }

    const snapshot = {
      id: crypto.randomUUID(),
      version: SNAPSHOT_VERSION,
      timestamp: now,
      description: finalDescription,
      entityType: entityType || null,
      action: action || null,
      entityId: entityId || null,
      entityCode: entityCode || null,
      deviceId: deviceId,
      author: metadata.author || "",
      tags: Array.isArray(tags) ? tags : [],
      metadata: {
        ...metadata,
        auto: auto,
        fieldDiff: generateFieldDiffSummary(beforeData, afterData),
      },
      parentId: loadCurrentSnapshotId(),
      data: captureProjectSnapshot(),
    };

    snapshots.push(snapshot);
    saveSnapshots(snapshots);
    saveCurrentSnapshotId(snapshot.id);
    _pendingChanges = 0;

    return snapshot;
  }

  function recordChange(entityType, action, entityId, entityCode, beforeData, afterData, metadata = {}) {
    _pendingChanges++;

    if (_pendingChanges >= SNAPSHOT_AUTO_THRESHOLD ||
        action === "delete" ||
        entityType === "scale" ||
        entityType === "grid" ||
        entityType === "projectConfig" ||
        entityType === "baseMap") {
      return recordSnapshot({
        entityType,
        action,
        entityId,
        entityCode,
        beforeData,
        afterData,
        metadata,
        auto: true,
      });
    }

    return null;
  }

  function recordManualSnapshot(description, tags = []) {
    return recordSnapshot({
      description: description || `手动快照 - ${new Date().toLocaleString()}`,
      tags: ["manual", ...tags],
      auto: false,
    });
  }

  function getSnapshotById(id) {
    const snapshots = loadSnapshots();
    return snapshots.find((s) => s.id === id) || null;
  }

  function getSnapshots(options = {}) {
    const {
      limit = 50,
      offset = 0,
      entityType = null,
      action = null,
      tags = null,
      search = null,
    } = options;

    let snapshots = loadSnapshots();

    if (entityType) {
      snapshots = snapshots.filter((s) => s.entityType === entityType);
    }
    if (action) {
      snapshots = snapshots.filter((s) => s.action === action);
    }
    if (tags && tags.length > 0) {
      snapshots = snapshots.filter((s) =>
        tags.some((tag) => s.tags && s.tags.includes(tag))
      );
    }
    if (search) {
      const lowerSearch = search.toLowerCase();
      snapshots = snapshots.filter((s) =>
        s.description.toLowerCase().includes(lowerSearch) ||
        (s.entityCode && s.entityCode.toLowerCase().includes(lowerSearch))
      );
    }

    snapshots.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      total: snapshots.length,
      items: snapshots.slice(offset, offset + limit),
    };
  }

  function getTimeline(options = {}) {
    const result = getSnapshots(options);
    return {
      ...result,
      items: result.items.map((s) => ({
        id: s.id,
        timestamp: s.timestamp,
        description: s.description,
        entityType: s.entityType,
        action: s.action,
        entityCode: s.entityCode,
        tags: s.tags,
        isCurrent: s.id === loadCurrentSnapshotId(),
        hasData: !!s.data,
      })),
    };
  }

  function validateSnapshot(snapshot) {
    if (!snapshot || !snapshot.data) {
      return { valid: false, error: "快照数据不存在" };
    }
    if (!snapshot.data.marks || !Array.isArray(snapshot.data.marks)) {
      return { valid: false, error: "快照标记数据格式错误" };
    }
    if (!snapshot.data.dives || !Array.isArray(snapshot.data.dives)) {
      return { valid: false, error: "快照潜次数据格式错误" };
    }
    return { valid: true };
  }

  function checkRollbackConflicts(snapshot) {
    const validation = validateSnapshot(snapshot);
    if (!validation.valid) return validation;

    const currentData = captureProjectSnapshot();
    const targetData = snapshot.data;
    const conflicts = [];

    const currentMarkIds = new Set(currentData.marks.map((m) => m.id));
    const targetMarkIds = new Set(targetData.marks.map((m) => m.id));
    currentData.marks.forEach((mark) => {
      if (!targetMarkIds.has(mark.id)) {
        conflicts.push({
          type: "mark",
          action: "will_delete",
          entityId: mark.id,
          entityCode: mark.code,
          description: `标记「${mark.code}」将被删除`,
        });
      }
    });
    targetData.marks.forEach((mark) => {
      if (!currentMarkIds.has(mark.id)) {
        conflicts.push({
          type: "mark",
          action: "will_add",
          entityId: mark.id,
          entityCode: mark.code,
          description: `标记「${mark.code}」将被恢复`,
        });
      }
    });

    const currentDiveIds = new Set(currentData.dives.map((d) => d.id));
    const targetDiveIds = new Set(targetData.dives.map((d) => d.id));
    currentData.dives.forEach((dive) => {
      if (!targetDiveIds.has(dive.id)) {
        conflicts.push({
          type: "dive",
          action: "will_delete",
          entityId: dive.id,
          entityCode: dive.code,
          description: `潜次「${dive.code}」将被删除`,
        });
      }
    });

    const hasMergeTag = snapshot.tags && snapshot.tags.some((t) => t === "merge");
    const hasImportTag = snapshot.tags && snapshot.tags.some((t) => t === "import");
    if (hasMergeTag || hasImportTag) {
      conflicts.push({
        type: "warning",
        action: "merge_import",
        description: hasMergeTag
          ? "此快照包含离线合并数据，回滚后合并记录将保留"
          : "此快照来自数据导入，回滚后导入来源将记录",
      });
    }

    return {
      valid: true,
      conflicts,
      stats: {
        marksToDelete: conflicts.filter((c) => c.type === "mark" && c.action === "will_delete").length,
        marksToAdd: conflicts.filter((c) => c.type === "mark" && c.action === "will_add").length,
        divesToDelete: conflicts.filter((c) => c.type === "dive" && c.action === "will_delete").length,
        totalConflicts: conflicts.length,
      },
    };
  }

  function rollbackToSnapshot(snapshotId, options = {}) {
    const { force = false, createUndoSnapshot = true } = options;

    const snapshot = getSnapshotById(snapshotId);
    if (!snapshot) {
      return { success: false, error: "快照不存在" };
    }

    const validation = validateSnapshot(snapshot);
    if (!validation.valid) {
      return validation;
    }

    const conflictCheck = checkRollbackConflicts(snapshot);
    if (!force && conflictCheck.conflicts.length > 0) {
      const seriousConflicts = conflictCheck.conflicts.filter(
        (c) => c.type !== "warning"
      );
      if (seriousConflicts.length > 0) {
        return {
          success: false,
          error: "存在数据冲突，请确认后强制执行",
          conflicts: conflictCheck.conflicts,
        };
      }
    }

    let undoSnapshot = null;
    if (createUndoSnapshot) {
      undoSnapshot = recordSnapshot({
        description: `回滚前自动备份 - 准备回滚到「${snapshot.description}」`,
        tags: ["rollback-undo", "auto"],
        metadata: {
          rollbackTargetId: snapshotId,
          rollbackTargetDesc: snapshot.description,
        },
      });
    }

    const data = snapshot.data;
    try {
      if (data.marks !== undefined) DataIO.saveMarks(data.marks);
      if (data.dives !== undefined) DataIO.saveDives(data.dives);
      if (data.measurements !== undefined) DataIO.saveMeasurements(data.measurements);
      if (data.scale !== undefined) DataIO.saveScale(data.scale);
      if (data.gridConfig !== undefined) DataIO.saveGridConfig(data.gridConfig);
      if (data.baseMap !== undefined) DataIO.saveBaseMap(data.baseMap);
      if (data.views !== undefined) DataIO.saveViews(data.views);
      if (data.revisitPlan !== undefined) DataIO.saveRevisitPlan(data.revisitPlan);
    } catch (e) {
      return { success: false, error: "保存回滚数据失败: " + e.message };
    }

    saveCurrentSnapshotId(snapshotId);

    if (typeof MergeModule !== "undefined" && typeof MergeModule.clearChangeLog === "function") {
      if (snapshot.metadata && snapshot.metadata.preserveChangeLog) {
      } else {
        MergeModule.clearChangeLog();
      }
    }

    if (typeof MergeModule !== "undefined" && typeof MergeModule.recordChange === "function") {
      MergeModule.recordChange(
        "projectConfig",
        "rollback",
        snapshotId,
        null,
        null,
        { rollbackTo: snapshot.description }
      );
    }

    const rollbackRecord = recordSnapshot({
      description: `回滚到历史版本：${snapshot.description}`,
      tags: ["rollback"],
      metadata: {
        rollbackFromId: undoSnapshot ? undoSnapshot.id : null,
        rollbackTargetId: snapshotId,
        rollbackTargetDesc: snapshot.description,
        originalTimestamp: snapshot.timestamp,
        conflicts: conflictCheck.conflicts,
      },
    });

    return {
      success: true,
      data: data,
      undoSnapshotId: undoSnapshot ? undoSnapshot.id : null,
      rollbackRecordId: rollbackRecord ? rollbackRecord.id : null,
      conflicts: conflictCheck.conflicts,
    };
  }

  function exportSnapshotData(snapshotId) {
    const snapshot = getSnapshotById(snapshotId);
    if (!snapshot) return null;

    return {
      version: SNAPSHOT_VERSION,
      exportType: "snapshot",
      exportDate: new Date().toISOString(),
      snapshotId: snapshot.id,
      snapshotTimestamp: snapshot.timestamp,
      snapshotDescription: snapshot.description,
      originalData: snapshot.data,
    };
  }

  function importSnapshotData(snapshotData, options = {}) {
    const { createNew = false, autoRollback = true } = options;

    if (!snapshotData || snapshotData.exportType !== "snapshot") {
      return { success: false, error: "无效的快照导出格式" };
    }

    if (!snapshotData.originalData) {
      return { success: false, error: "快照数据不完整" };
    }

    const snapshots = loadSnapshots();
    const now = new Date().toISOString();

    const importedSnapshot = {
      id: createNew ? crypto.randomUUID() : snapshotData.snapshotId || crypto.randomUUID(),
      version: SNAPSHOT_VERSION,
      timestamp: now,
      description: `导入快照：${snapshotData.snapshotDescription || "未命名快照"}`,
      entityType: "projectConfig",
      action: "import",
      entityId: null,
      entityCode: null,
      deviceId: typeof MergeModule !== "undefined" && typeof MergeModule.getDeviceId === "function"
        ? MergeModule.getDeviceId()
        : null,
      author: "",
      tags: ["import", "snapshot-import"],
      metadata: {
        importedFrom: snapshotData,
        originalTimestamp: snapshotData.snapshotTimestamp,
      },
      parentId: loadCurrentSnapshotId(),
      data: snapshotData.originalData,
    };

    snapshots.push(importedSnapshot);
    saveSnapshots(snapshots);

    if (autoRollback) {
      saveCurrentSnapshotId(importedSnapshot.id);
    }

    return {
      success: true,
      snapshot: importedSnapshot,
      autoRollback,
    };
  }

  function getSnapshotDiff(snapshotId1, snapshotId2) {
    const snap1 = getSnapshotById(snapshotId1);
    const snap2 = getSnapshotById(snapshotId2);

    if (!snap1 || !snap2 || !snap1.data || !snap2.data) {
      return null;
    }

    const diff = {
      marks: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
      },
      dives: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
      },
      measurements: {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
      },
      scale: { changed: false, before: snap1.data.scale, after: snap2.data.scale },
      gridConfig: { changed: false, before: snap1.data.gridConfig, after: snap2.data.gridConfig },
    };

    const snap1Marks = new Map(snap1.data.marks.map((m) => [m.id, m]));
    const snap2Marks = new Map(snap2.data.marks.map((m) => [m.id, m]));

    snap2Marks.forEach((mark, id) => {
      if (!snap1Marks.has(id)) {
        diff.marks.added.push(mark);
      } else {
        const oldMark = snap1Marks.get(id);
        if (JSON.stringify(oldMark) !== JSON.stringify(mark)) {
          diff.marks.modified.push({
            id,
            code: mark.code,
            changes: generateFieldDiffSummary(oldMark, mark),
          });
        } else {
          diff.marks.unchanged.push(id);
        }
      }
    });

    snap1Marks.forEach((mark, id) => {
      if (!snap2Marks.has(id)) {
        diff.marks.removed.push(mark);
      }
    });

    const snap1Dives = new Map(snap1.data.dives.map((d) => [d.id, d]));
    const snap2Dives = new Map(snap2.data.dives.map((d) => [d.id, d]));

    snap2Dives.forEach((dive, id) => {
      if (!snap1Dives.has(id)) {
        diff.dives.added.push(dive);
      } else {
        const oldDive = snap1Dives.get(id);
        if (JSON.stringify(oldDive) !== JSON.stringify(dive)) {
          diff.dives.modified.push({
            id,
            code: dive.code,
            changes: generateFieldDiffSummary(oldDive, dive),
          });
        } else {
          diff.dives.unchanged.push(id);
        }
      }
    });

    snap1Dives.forEach((dive, id) => {
      if (!snap2Dives.has(id)) {
        diff.dives.removed.push(dive);
      }
    });

    if (JSON.stringify(snap1.data.scale) !== JSON.stringify(snap2.data.scale)) {
      diff.scale.changed = true;
    }
    if (JSON.stringify(snap1.data.gridConfig) !== JSON.stringify(snap2.data.gridConfig)) {
      diff.gridConfig.changed = true;
    }

    return diff;
  }

  function clearSnapshots(keepFirst = 0) {
    const snapshots = loadSnapshots();
    if (keepFirst > 0) {
      const toKeep = snapshots.slice(0, keepFirst);
      saveSnapshots(toKeep);
    } else {
      localStorage.removeItem(_snapshotsKey());
      localStorage.removeItem(_currentSnapshotKey());
    }
  }

  function getStorageStats() {
    const snapshots = loadSnapshots();
    const rawData = JSON.stringify(snapshots);
    const sizeBytes = new Blob([rawData]).size;

    let dataSizeTotal = 0;
    snapshots.forEach((s) => {
      if (s.data) {
        dataSizeTotal += new Blob([JSON.stringify(s.data)]).size;
      }
    });

    return {
      count: snapshots.length,
      totalSizeBytes: sizeBytes,
      totalSizeKB: (sizeBytes / 1024).toFixed(1),
      totalSizeMB: (sizeBytes / (1024 * 1024)).toFixed(2),
      dataSizeTotalBytes: dataSizeTotal,
      dataSizeTotalMB: (dataSizeTotal / (1024 * 1024)).toFixed(2),
      avgSizeBytes: snapshots.length > 0 ? Math.round(sizeBytes / snapshots.length) : 0,
    };
  }

  function ensureInitialSnapshot() {
    const snapshots = loadSnapshots();
    if (snapshots.length === 0) {
      return recordSnapshot({
        description: "项目初始状态",
        tags: ["initial", "auto"],
        auto: true,
      });
    }
    return null;
  }

  function handleMergeSnapshot(snapshotData) {
    return recordSnapshot({
      description: `离线合并完成 - ${snapshotData.deviceName || snapshotData.deviceId || "未知设备"}`,
      entityType: "projectConfig",
      action: "merge",
      tags: ["merge", "offline"],
      metadata: {
        mergeSource: snapshotData,
        deviceId: snapshotData.deviceId,
        deviceName: snapshotData.deviceName,
        exportDate: snapshotData.exportDate,
      },
    });
  }

  function handleImportSnapshot(importData, version) {
    return recordSnapshot({
      description: `数据导入完成 - 格式版本 ${version}`,
      entityType: "projectConfig",
      action: "import",
      tags: ["import", `v${version}`],
      metadata: {
        importFormat: version,
        importData: importData,
      },
    });
  }

  return {
    setProjectId,
    recordSnapshot,
    recordChange,
    recordManualSnapshot,
    getSnapshotById,
    getSnapshots,
    getTimeline,
    validateSnapshot,
    checkRollbackConflicts,
    rollbackToSnapshot,
    exportSnapshotData,
    importSnapshotData,
    getSnapshotDiff,
    clearSnapshots,
    getStorageStats,
    ensureInitialSnapshot,
    handleMergeSnapshot,
    handleImportSnapshot,
    loadSnapshots,
    loadCurrentSnapshotId,
    generateDescription,
    ENTITY_TYPE_NAMES,
    ACTION_NAMES,
    SNAPSHOT_VERSION,
  };
})();
