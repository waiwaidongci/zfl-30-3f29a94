const MergeModule = (() => {
  const MERGE_VERSION = "8.1";
  const DEVICE_ID_KEY = "zfl30_deviceId";
  const CHANGE_LOG_KEY_SUFFIX = "changeLog";
  const MERGE_SNAPSHOT_KEY_SUFFIX = "mergeSnapshot";
  const POSITION_THRESHOLD = 3;
  const MAX_CHANGE_LOG_ENTRIES = 500;

  let _projectId = null;

  function setProjectId(projectId) {
    _projectId = projectId;
  }

  function _changeLogKey() {
    return _projectId
      ? ProjectManager.projKey(_projectId, CHANGE_LOG_KEY_SUFFIX)
      : "zfl30_" + CHANGE_LOG_KEY_SUFFIX;
  }

  function _snapshotKey() {
    return _projectId
      ? ProjectManager.projKey(_projectId, MERGE_SNAPSHOT_KEY_SUFFIX)
      : "zfl30_" + MERGE_SNAPSHOT_KEY_SUFFIX;
  }

  function getDeviceId() {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = "DEV-" + crypto.randomUUID().slice(0, 8).toUpperCase();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }

  function setDeviceId(deviceId) {
    if (deviceId && deviceId.trim()) {
      localStorage.setItem(DEVICE_ID_KEY, deviceId.trim());
    }
  }

  function loadChangeLog() {
    try {
      return JSON.parse(localStorage.getItem(_changeLogKey()) || "[]");
    } catch (e) {
      console.error("Failed to load change log:", e);
      return [];
    }
  }

  function saveChangeLog(log) {
    const trimmed = log.slice(-MAX_CHANGE_LOG_ENTRIES);
    localStorage.setItem(_changeLogKey(), JSON.stringify(trimmed));
  }

  function recordChange(entityType, action, entityId, entityCode, beforeData, afterData) {
    const log = loadChangeLog();
    const entry = {
      id: crypto.randomUUID(),
      entityType,
      action,
      entityId,
      entityCode,
      beforeData: beforeData ? JSON.parse(JSON.stringify(beforeData)) : null,
      afterData: afterData ? JSON.parse(JSON.stringify(afterData)) : null,
      deviceId: getDeviceId(),
      timestamp: new Date().toISOString(),
    };
    log.push(entry);
    saveChangeLog(log);
    return entry;
  }

  function clearChangeLog() {
    localStorage.removeItem(_changeLogKey());
  }

  function buildAttachmentSummary(attachments) {
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return { count: 0, totalSize: 0, items: [] };
    }
    const items = attachments.map((att) => ({
      id: att.id,
      name: att.name,
      size: att.size,
      type: att.type,
      width: att.width,
      height: att.height,
      angle: att.angle || "",
      description: att.description || "",
      thumbnail: att.thumbnail,
      hasThumbnail: !!att.thumbnail,
      hasFullImage: !!att.fullImage,
      createdAt: att.createdAt,
      contentHash: _computeHash(att),
    }));
    const totalSize = items.reduce((sum, i) => sum + (i.size || 0), 0);
    return {
      count: items.length,
      totalSize: totalSize,
      totalSizeKB: (totalSize / 1024).toFixed(1),
      items: items,
    };
  }

  function simpleHash(str) {
    if (!str) return "";
    let hash = 0;
    const len = Math.min(str.length, 1000);
    for (let i = 0; i < len; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  function buildExportData(marks, dives, measurements, scale, gridConfig, baseMap) {
    const deviceId = getDeviceId();
    const changeLog = loadChangeLog();
    const processedMarks = marks.map((m) => {
      const processed = DataIO.ensureReviewData ? DataIO.ensureReviewData({ ...m }) : { ...m };
      if (processed.attachments && Array.isArray(processed.attachments)) {
        processed.attachments = processed.attachments.map((att) => ({
          ...att,
          contentHash: _computeHash(att),
        }));
      }
      return processed;
    });

    const attachmentStats = computeAttachmentStats(processedMarks);

    return {
      version: MERGE_VERSION,
      format: "offline-merge",
      exportDate: new Date().toISOString(),
      deviceId: deviceId,
      deviceName: "",
      snapshot: {
        marks: processedMarks,
        dives: dives || [],
        measurements: measurements || [],
        scale: scale || null,
        gridConfig: gridConfig || null,
        baseMap: baseMap || null,
      },
      changeLog: changeLog,
      attachmentDigest: attachmentStats,
      stats: {
        markCount: processedMarks.length,
        diveCount: (dives || []).length,
        measurementCount: (measurements || []).length,
        changeLogCount: changeLog.length,
        attachmentCount: attachmentStats.totalCount,
        attachmentTotalSizeKB: attachmentStats.totalSizeKB,
      },
    };
  }

  function computeAttachmentStats(marks) {
    let totalCount = 0;
    let totalSize = 0;
    const perMark = {};

    marks.forEach((m) => {
      const atts = m.attachments || [];
      const summary = buildAttachmentSummary(atts);
      totalCount += summary.count;
      totalSize += summary.totalSize;
      perMark[m.id || m.code] = summary;
    });

    return {
      totalCount,
      totalSize,
      totalSizeKB: (totalSize / 1024).toFixed(1),
      perMark,
    };
  }

  function isOfflineMergeFormat(data) {
    return !!(
      data &&
      typeof data === "object" &&
      data.format === "offline-merge" &&
      data.snapshot &&
      data.changeLog
    );
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function shallowEqual(obj1, obj2, ignoreKeys = []) {
    if (!obj1 || !obj2) return obj1 === obj2;
    const keys1 = Object.keys(obj1).filter((k) => !ignoreKeys.includes(k));
    const keys2 = Object.keys(obj2).filter((k) => !ignoreKeys.includes(k));
    if (keys1.length !== keys2.length) return false;
    return keys1.every((k) => {
      const v1 = obj1[k];
      const v2 = obj2[k];
      if (typeof v1 === "object" && typeof v2 === "object") {
        return JSON.stringify(v1) === JSON.stringify(v2);
      }
      return v1 === v2;
    });
  }

  function calculateDistance(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function hasAttachmentChanges(attAnalysis) {
    if (!attAnalysis) return false;
    return (
      (attAnalysis.new && attAnalysis.new.length > 0) ||
      (attAnalysis.sameNameDiffImage && attAnalysis.sameNameDiffImage.length > 0) ||
      (attAnalysis.metaChanged && attAnalysis.metaChanged.length > 0) ||
      (attAnalysis.deleted && attAnalysis.deleted.length > 0)
    );
  }

  function countAttachmentChanges(items, key) {
    if (!Array.isArray(items)) return { new: 0, modified: 0, deleted: 0 };
    let newCount = 0;
    let modifiedCount = 0;
    let deletedCount = 0;
    items.forEach((item) => {
      const att = item.attachments;
      if (!att) return;
      if (key === "new") {
        newCount += (att.new || []).length;
        modifiedCount += (att.sameNameDiffImage || []).length + (att.metaChanged || []).length;
      } else {
        newCount += (att.new || []).length;
        modifiedCount += (att.sameNameDiffImage || []).length + (att.metaChanged || []).length;
        deletedCount += (att.deleted || []).length;
      }
    });
    return { new: newCount, modified: modifiedCount, deleted: deletedCount };
  }

  function findPositionDuplicates(marks1, marks2, threshold = POSITION_THRESHOLD) {
    const duplicates = [];
    marks1.forEach((m1) => {
      if (m1.x === undefined || m1.y === undefined) return;
      marks2.forEach((m2) => {
        if (m1.id === m2.id || m1.code === m2.code) return;
        if (m2.x === undefined || m2.y === undefined) return;
        const dist = calculateDistance(m1.x, m1.y, m2.x, m2.y);
        if (dist <= threshold) {
          duplicates.push({
            mark1: m1,
            mark2: m2,
            distance: dist,
          });
        }
      });
    });
    return duplicates;
  }

  function analyzeMerge(localData, importData) {
    const localMarks = localData.marks || [];
    const localDives = localData.dives || [];
    const localMeasurements = localData.measurements || [];

    const importSnapshot = importData.snapshot || {};
    const importMarks = importSnapshot.marks || [];
    const importDives = importSnapshot.dives || [];
    const importMeasurements = importSnapshot.measurements || [];
    const importChangeLog = importData.changeLog || [];

    const localMarkById = new Map(localMarks.map((m) => [m.id, m]));
    const localMarkByCode = new Map(localMarks.map((m) => [m.code, m]));
    const importMarkById = new Map(importMarks.map((m) => [m.id, m]));
    const importMarkByCode = new Map(importMarks.map((m) => [m.code, m]));

    const localDiveById = new Map(localDives.map((d) => [d.id, d]));
    const localDiveByCode = new Map(localDives.map((d) => [d.code, d]));
    const importDiveById = new Map(importDives.map((d) => [d.id, d]));
    const importDiveByCode = new Map(importDives.map((d) => [d.code, d]));

    const result = {
      deviceId: importData.deviceId,
      deviceName: importData.deviceName || "",
      exportDate: importData.exportDate,
      marks: {
        new: [],
        modified: [],
        deleted: [],
        diverged: [],
        positionDuplicates: [],
        unchanged: [],
        errors: [],
      },
      dives: {
        new: [],
        modified: [],
        deleted: [],
        diverged: [],
        unchanged: [],
        errors: [],
      },
      measurements: {
        new: [],
        modified: [],
        deleted: [],
        diverged: [],
        unchanged: [],
        errors: [],
      },
      scale: importSnapshot.scale || null,
      gridConfig: importSnapshot.gridConfig || null,
      baseMap: importSnapshot.baseMap || null,
      importChangeLog: importChangeLog,
    };

    const markValidation = Validation.validateMarkArray(importMarks);
    markValidation.results.forEach((r, idx) => {
      if (!r.valid) {
        result.marks.errors.push({
          index: idx,
          mark: r.mark,
          errors: r.errors,
        });
      }
    });

    const validImportMarks = importMarks.filter(
      (m, idx) => markValidation.results[idx]?.valid
    );

    validImportMarks.forEach((importMark) => {
      const localMarkByIdMatch = localMarkById.get(importMark.id);
      const localMarkByCodeMatch = localMarkByCode.get(importMark.code);

      if (!localMarkByIdMatch && !localMarkByCodeMatch) {
        const attachmentAnalysis = analyzeAttachments([], importMark.attachments || []);
        result.marks.new.push({
          imported: importMark,
          resolution: "add",
          attachments: attachmentAnalysis,
          hasAttachmentChanges: hasAttachmentChanges(attachmentAnalysis),
        });
      } else if (localMarkByIdMatch) {
        const isSame = shallowEqual(localMarkByIdMatch, importMark, ["id", "review", "attachments"]);
        const reviewSame = JSON.stringify(localMarkByIdMatch.review) === JSON.stringify(importMark.review);
        const attachmentAnalysis = analyzeAttachments(localMarkByIdMatch.attachments || [], importMark.attachments || []);
        const attSame = !hasAttachmentChanges(attachmentAnalysis);

        if (isSame && reviewSame && attSame) {
          result.marks.unchanged.push({
            local: localMarkByIdMatch,
            imported: importMark,
          });
        } else {
          const importHasChanges = importChangeLog.some(
            (log) =>
              log.entityType === "mark" &&
              log.entityId === importMark.id &&
              log.deviceId === importData.deviceId
          );

          if (importHasChanges) {
            const localHasChanges = loadChangeLog().some(
              (log) => log.entityType === "mark" && log.entityId === importMark.id
            );

            if (localHasChanges) {
              result.marks.diverged.push({
                local: localMarkByIdMatch,
                imported: importMark,
                resolution: "keep",
                diff: getMarkDiff(localMarkByIdMatch, importMark),
                attachments: attachmentAnalysis,
                hasAttachmentChanges: hasAttachmentChanges(attachmentAnalysis),
              });
            } else {
              result.marks.modified.push({
                local: localMarkByIdMatch,
                imported: importMark,
                resolution: "overwrite",
                diff: getMarkDiff(localMarkByIdMatch, importMark),
                attachments: attachmentAnalysis,
                hasAttachmentChanges: hasAttachmentChanges(attachmentAnalysis),
              });
            }
          } else {
            result.marks.modified.push({
              local: localMarkByIdMatch,
              imported: importMark,
              resolution: "keep",
              diff: getMarkDiff(localMarkByIdMatch, importMark),
              attachments: attachmentAnalysis,
              hasAttachmentChanges: hasAttachmentChanges(attachmentAnalysis),
            });
          }
        }
      } else if (localMarkByCodeMatch) {
        const attachmentAnalysis = analyzeAttachments(localMarkByCodeMatch.attachments || [], importMark.attachments || []);
        result.marks.diverged.push({
          local: localMarkByCodeMatch,
          imported: importMark,
          resolution: "saveas",
          diff: getMarkDiff(localMarkByCodeMatch, importMark),
          note: "编号相同但ID不同，可能为分叉编辑",
          attachments: attachmentAnalysis,
          hasAttachmentChanges: hasAttachmentChanges(attachmentAnalysis),
        });
      }
    });

    const importMarkIds = new Set(validImportMarks.map((m) => m.id));
    const importMarkCodes = new Set(validImportMarks.map((m) => m.code));

    localMarks.forEach((localMark) => {
      if (
        !importMarkIds.has(localMark.id) &&
        !importMarkCodes.has(localMark.code)
      ) {
        const wasDeletedInImport = importChangeLog.some(
          (log) =>
            log.entityType === "mark" &&
            (log.entityId === localMark.id || log.entityCode === localMark.code) &&
            log.action === "delete" &&
            log.deviceId === importData.deviceId
        );

        if (wasDeletedInImport) {
          result.marks.deleted.push({
            local: localMark,
            resolution: "keep",
          });
        }
      }
    });

    const posDups = findPositionDuplicates(localMarks, validImportMarks);
    posDups.forEach((dup) => {
      const isNewOrModified =
        result.marks.new.some((m) => m.imported.id === dup.mark2.id) ||
        result.marks.modified.some((m) => m.imported.id === dup.mark2.id) ||
        result.marks.diverged.some((m) => m.imported.id === dup.mark2.id);

      if (isNewOrModified) {
        const diff = getMarkDiff(dup.mark1, dup.mark2);
        result.marks.positionDuplicates.push({
          localMark: dup.mark1,
          importedMark: dup.mark2,
          local: dup.mark1,
          imported: dup.mark2,
          distance: dup.distance,
          diff: diff,
          resolution: "skip",
        });
      }
    });

    const diveValidation = Validation.validateDiveArray(importDives);
    diveValidation.results.forEach((r, idx) => {
      if (!r.valid) {
        result.dives.errors.push({
          index: idx,
          dive: r.dive,
          errors: r.errors,
        });
      }
    });

    const validImportDives = importDives.filter(
      (d, idx) => diveValidation.results[idx]?.valid
    );

    validImportDives.forEach((importDive) => {
      const localDiveByIdMatch = localDiveById.get(importDive.id);
      const localDiveByCodeMatch = localDiveByCode.get(importDive.code);

      if (!localDiveByIdMatch && !localDiveByCodeMatch) {
        result.dives.new.push({
          imported: importDive,
          resolution: "add",
        });
      } else if (localDiveByIdMatch) {
        const isSame = shallowEqual(localDiveByIdMatch, importDive, ["id"]);
        if (isSame) {
          result.dives.unchanged.push({
            local: localDiveByIdMatch,
            imported: importDive,
          });
        } else {
          result.dives.modified.push({
            local: localDiveByIdMatch,
            imported: importDive,
            resolution: "keep",
            diff: getDiveDiff(localDiveByIdMatch, importDive),
          });
        }
      } else if (localDiveByCodeMatch) {
        result.dives.diverged.push({
          local: localDiveByCodeMatch,
          imported: importDive,
          resolution: "saveas",
          diff: getDiveDiff(localDiveByCodeMatch, importDive),
          note: "编号相同但ID不同，可能为分叉编辑",
        });
      }
    });

    const importDiveIds = new Set(validImportDives.map((d) => d.id));
    const importDiveCodes = new Set(validImportDives.map((d) => d.code));

    localDives.forEach((localDive) => {
      if (
        !importDiveIds.has(localDive.id) &&
        !importDiveCodes.has(localDive.code)
      ) {
        const wasDeletedInImport = importChangeLog.some(
          (log) =>
            log.entityType === "dive" &&
            (log.entityId === localDive.id || log.entityCode === localDive.code) &&
            log.action === "delete" &&
            log.deviceId === importData.deviceId
        );

        if (wasDeletedInImport) {
          result.dives.deleted.push({
            local: localDive,
            resolution: "keep",
          });
        }
      }
    });

    const measurementValidation = Validation.validateMeasurementArray(
      importMeasurements
    );
    measurementValidation.results.forEach((r, idx) => {
      if (!r.valid) {
        result.measurements.errors.push({
          index: idx,
          measurement: r.measurement,
          errors: r.errors,
        });
      }
    });

    const validImportMeasurements = importMeasurements.filter(
      (m, idx) => measurementValidation.results[idx]?.valid
    );

    validImportMeasurements.forEach((importMeas) => {
      const localMeasById = localMeasurements.find((m) => m.id === importMeas.id);
      const localMeasByCode = localMeasurements.find(
        (m) => m.code === importMeas.code
      );

      if (!localMeasById && !localMeasByCode) {
        result.measurements.new.push({
          imported: importMeas,
          resolution: "add",
        });
      } else if (localMeasById) {
        const isSame = shallowEqual(localMeasById, importMeas, ["id"]);
        if (isSame) {
          result.measurements.unchanged.push({
            local: localMeasById,
            imported: importMeas,
          });
        } else {
          result.measurements.modified.push({
            local: localMeasById,
            imported: importMeas,
            resolution: "keep",
          });
        }
      } else if (localMeasByCode) {
        result.measurements.diverged.push({
          local: localMeasByCode,
          imported: importMeas,
          resolution: "saveas",
          note: "编号相同但ID不同，可能为分叉编辑",
        });
      }
    });

    const importMeasIds = new Set(validImportMeasurements.map((m) => m.id));
    const importMeasCodes = new Set(validImportMeasurements.map((m) => m.code));

    localMeasurements.forEach((localMeas) => {
      if (
        !importMeasIds.has(localMeas.id) &&
        !importMeasCodes.has(localMeas.code)
      ) {
        const wasDeletedInImport = importChangeLog.some(
          (log) =>
            log.entityType === "measurement" &&
            (log.entityId === localMeas.id || log.entityCode === localMeas.code) &&
            log.action === "delete" &&
            log.deviceId === importData.deviceId
        );

        if (wasDeletedInImport) {
          result.measurements.deleted.push({
            local: localMeas,
            resolution: "keep",
          });
        }
      }
    });

    const newAtts = countAttachmentChanges(result.marks.new, "new");
    const modAtts = countAttachmentChanges(result.marks.modified, "modified");
    const divAtts = countAttachmentChanges(result.marks.diverged, "diverged");
    const delAtts = countAttachmentChanges(result.marks.deleted, "deleted");

    result.summary = {
      marks: {
        total: validImportMarks.length,
        new: result.marks.new.length,
        modified: result.marks.modified.length,
        deleted: result.marks.deleted.length,
        diverged: result.marks.diverged.length,
        positionDuplicates: result.marks.positionDuplicates.length,
        unchanged: result.marks.unchanged.length,
        errors: result.marks.errors.length,
        attachments: {
          new: newAtts.new + modAtts.new + divAtts.new,
          modified: newAtts.modified + modAtts.modified + divAtts.modified,
          deleted: modAtts.deleted + divAtts.deleted + delAtts.deleted,
        },
      },
      dives: {
        total: validImportDives.length,
        new: result.dives.new.length,
        modified: result.dives.modified.length,
        deleted: result.dives.deleted.length,
        diverged: result.dives.diverged.length,
        unchanged: result.dives.unchanged.length,
        errors: result.dives.errors.length,
      },
      measurements: {
        total: validImportMeasurements.length,
        new: result.measurements.new.length,
        modified: result.measurements.modified.length,
        deleted: result.measurements.deleted.length,
        diverged: result.measurements.diverged.length,
        unchanged: result.measurements.unchanged.length,
        errors: result.measurements.errors.length,
      },
    };

    return result;
  }

  function getMarkDiff(localMark, importMark) {
    const diff = {
      fields: [],
      changed: [],
    };

    const fieldsToCompare = [
      "code",
      "type",
      "dive",
      "depth",
      "x",
      "y",
      "orientation",
      "condition",
      "note",
    ];

    fieldsToCompare.forEach((field) => {
      const localVal = localMark[field];
      const importVal = importMark[field];
      if (localVal !== importVal) {
        diff.fields.push(field);
        diff.changed.push({
          field,
          local: localVal,
          imported: importVal,
        });
      }
    });

    const localReviewStatus = localMark.review?.status || "collected";
    const importReviewStatus = importMark.review?.status || "collected";
    if (localReviewStatus !== importReviewStatus) {
      diff.fields.push("review.status");
      diff.changed.push({
        field: "review.status",
        local: localReviewStatus,
        imported: importReviewStatus,
      });
    }

    const localReviewComment = localMark.review?.comment || "";
    const importReviewComment = importMark.review?.comment || "";
    if (localReviewComment !== importReviewComment) {
      diff.fields.push("review.comment");
      diff.changed.push({
        field: "review.comment",
        local: localReviewComment,
        imported: importReviewComment,
      });
    }

    return diff;
  }

  function _computeHash(att) {
    if (!att) return "";
    if (att.contentHash) return att.contentHash;
    const src = att.fullImage || att.thumbnail;
    if (src) return simpleHash(src);
    const parts = [att.name || "", att.size || 0, att.width || 0, att.height || 0].join("|");
    return simpleHash(parts);
  }

  function analyzeAttachments(localAttachments, importAttachments) {
    const result = {
      new: [],
      sameNameDiffImage: [],
      metaChanged: [],
      unchanged: [],
      deleted: [],
    };

    const localAtts = Array.isArray(localAttachments) ? localAttachments : [];
    const importAtts = Array.isArray(importAttachments) ? importAttachments : [];

    const localById = new Map();
    const localByName = new Map();
    localAtts.forEach((att) => {
      if (att.id) localById.set(att.id, att);
      if (att.name) {
        if (!localByName.has(att.name)) {
          localByName.set(att.name, []);
        }
        localByName.get(att.name).push(att);
      }
    });

    const importById = new Map();
    const importByName = new Map();
    importAtts.forEach((att) => {
      if (att.id) importById.set(att.id, att);
      if (att.name) {
        if (!importByName.has(att.name)) {
          importByName.set(att.name, []);
        }
        importByName.get(att.name).push(att);
      }
    });

    const matchedLocalIds = new Set();
    const matchedLocalNames = new Set();

    importAtts.forEach((importAtt) => {
      const localByIdMatch = importAtt.id ? localById.get(importAtt.id) : null;
      const localByNameMatches = importAtt.name ? (localByName.get(importAtt.name) || []) : [];
      const localByNameMatch = localByNameMatches.find(
        (a) => !matchedLocalNames.has(a.id || a.name)
      ) || null;

      const importHash = _computeHash(importAtt);

      if (!localByIdMatch && !localByNameMatch) {
        result.new.push({
          imported: importAtt,
          resolution: "add",
        });
      } else if (localByIdMatch) {
        matchedLocalIds.add(localByIdMatch.id);
        matchedLocalNames.add(localByIdMatch.id || localByIdMatch.name);
        const localHash = _computeHash(localByIdMatch);
        const hashSame = localHash && importHash && localHash === importHash;
        const nameSame = localByIdMatch.name === importAtt.name;
        const angleSame = (localByIdMatch.angle || "") === (importAtt.angle || "");
        const descSame = (localByIdMatch.description || "") === (importAtt.description || "");

        if (hashSame && nameSame && angleSame && descSame) {
          result.unchanged.push({
            local: localByIdMatch,
            imported: importAtt,
          });
        } else if (!hashSame) {
          result.sameNameDiffImage.push({
            local: localByIdMatch,
            imported: importAtt,
            resolution: "keep",
            diff: getAttachmentDiff(localByIdMatch, importAtt),
          });
        } else {
          result.metaChanged.push({
            local: localByIdMatch,
            imported: importAtt,
            resolution: "merge",
            diff: getAttachmentDiff(localByIdMatch, importAtt),
          });
        }
      } else if (localByNameMatch) {
        matchedLocalNames.add(localByNameMatch.id || localByNameMatch.name);
        const localHash = _computeHash(localByNameMatch);
        const hashSame = localHash && importHash && localHash === importHash;
        const angleSame = (localByNameMatch.angle || "") === (importAtt.angle || "");
        const descSame = (localByNameMatch.description || "") === (importAtt.description || "");

        if (!hashSame) {
          result.sameNameDiffImage.push({
            local: localByNameMatch,
            imported: importAtt,
            resolution: "keep",
            diff: getAttachmentDiff(localByNameMatch, importAtt),
            note: "文件名相同但内容不同，可能为不同版本",
          });
        } else if (!angleSame || !descSame) {
          result.metaChanged.push({
            local: localByNameMatch,
            imported: importAtt,
            resolution: "merge",
            diff: getAttachmentDiff(localByNameMatch, importAtt),
            note: "文件名和内容相同，仅描述或角度不同",
          });
        } else {
          result.unchanged.push({
            local: localByNameMatch,
            imported: importAtt,
          });
        }
      }
    });

    localAtts.forEach((localAtt) => {
      const inImport = importAtts.some(
        (ia) => (localAtt.id && ia.id === localAtt.id) || (localAtt.name && ia.name === localAtt.name)
      );
      if (!inImport) {
        result.deleted.push({
          local: localAtt,
          resolution: "keep",
        });
      }
    });

    return result;
  }

  function getAttachmentDiff(localAtt, importAtt) {
    const diff = {
      fields: [],
      changed: [],
    };

    const fieldsToCompare = ["name", "size", "width", "height", "angle", "description"];
    fieldsToCompare.forEach((field) => {
      const localVal = localAtt[field];
      const importVal = importAtt[field];
      if (localVal !== importVal) {
        diff.fields.push(field);
        diff.changed.push({
          field,
          local: localVal,
          imported: importVal,
        });
      }
    });

    const localHash = _computeHash(localAtt);
    const importHash = _computeHash(importAtt);
    if (localHash && importHash && localHash !== importHash) {
      diff.fields.push("content");
      diff.changed.push({
        field: "content",
        local: "图片内容（本地）",
        imported: "图片内容（导入）",
      });
    }

    return diff;
  }

  function getDiveDiff(localDive, importDive) {
    const diff = {
      fields: [],
      changed: [],
    };

    const fieldsToCompare = [
      "code",
      "date",
      "leader",
      "weather",
      "current",
      "visibility",
      "objective",
    ];

    fieldsToCompare.forEach((field) => {
      const localVal = localDive[field];
      const importVal = importDive[field];
      if (localVal !== importVal) {
        diff.fields.push(field);
        diff.changed.push({
          field,
          local: localVal,
          imported: importVal,
        });
      }
    });

    const localParticipants = localDive.participants || [];
    const importParticipants = importDive.participants || [];
    if (JSON.stringify(localParticipants) !== JSON.stringify(importParticipants)) {
      diff.fields.push("participants");
      diff.changed.push({
        field: "participants",
        local: localParticipants,
        imported: importParticipants,
      });
    }

    return diff;
  }

  function applyAttachmentResolutions(localAttachments, attachmentAnalysis, attachmentResolutions, importAttachments) {
    let result = Array.isArray(localAttachments) ? [...localAttachments] : [];
    const byId = new Map();
    const byName = new Map();
    result.forEach((att, idx) => {
      if (att.id) byId.set(att.id, { att, idx });
      if (att.name) byName.set(att.name, { att, idx });
    });

    function updateResultArray() {
      result = result.filter(Boolean);
      byId.clear();
      byName.clear();
      result.forEach((att, idx) => {
        if (att.id) byId.set(att.id, { att, idx });
        if (att.name) byName.set(att.name, { att, idx });
      });
    }

    function findOrAddLocal(item) {
      if (!item?.local) return null;
      const localKey = item.local.id ? "id" : "name";
      const localVal = item.local.id || item.local.name;
      let localInfo = localKey === "id" ? byId.get(localVal) : byName.get(localVal);
      if (!localInfo) {
        const att = { ...item.local };
        result.push(att);
        updateResultArray();
        localInfo = localKey === "id" ? byId.get(localVal) : byName.get(localVal);
      }
      return localInfo;
    }

    if (attachmentAnalysis?.unchanged && attachmentAnalysis.unchanged.length > 0) {
      attachmentAnalysis.unchanged.forEach((item) => {
        const att = item.imported || item.local;
        if (!att) return;
        const exists = result.some((a) =>
          (a.id && att.id && a.id === att.id) || (a.name && att.name && a.name === att.name)
        );
        if (!exists) {
          result.push({ ...att });
        }
      });
      updateResultArray();
    }

    if (attachmentAnalysis?.new && attachmentAnalysis.new.length > 0) {
      attachmentAnalysis.new.forEach((item, idx) => {
        const res = attachmentResolutions?.new?.[idx] || item.resolution || "add";
        if (res === "add") {
          const importedAtt = { ...item.imported };
          if (!importedAtt.id) importedAtt.id = crypto.randomUUID();
          const exists = result.some((a) =>
            (a.id && a.id === importedAtt.id) || (a.name && a.name === importedAtt.name)
          );
          if (!exists) {
            result.push(importedAtt);
          }
        }
      });
    }

    if (attachmentAnalysis?.sameNameDiffImage && attachmentAnalysis.sameNameDiffImage.length > 0) {
      attachmentAnalysis.sameNameDiffImage.forEach((item, idx) => {
        const res = attachmentResolutions?.sameNameDiffImage?.[idx] || item.resolution || "keep";
        const localKey = item.local?.id ? "id" : "name";
        const localVal = item.local?.id || item.local?.name;

        if (res === "overwrite") {
          let localInfo = localKey === "id" ? byId.get(localVal) : byName.get(localVal);
          if (!localInfo) {
            localInfo = findOrAddLocal(item);
          }
          if (localInfo) {
            const imported = { ...item.imported, id: item.local.id || localInfo.att.id || crypto.randomUUID() };
            result[localInfo.idx] = imported;
          }
        } else if (res === "keepboth") {
          const imported = { ...item.imported };
          const existingCodes = new Set(result.map((a) => a.name));
          imported.name = generateUniqueAttachmentName(existingCodes, imported.name);
          imported.id = crypto.randomUUID();
          result.push(imported);
        }
      });
      updateResultArray();
    }

    if (attachmentAnalysis?.metaChanged && attachmentAnalysis.metaChanged.length > 0) {
      attachmentAnalysis.metaChanged.forEach((item, idx) => {
        const res = attachmentResolutions?.metaChanged?.[idx] || item.resolution || "merge";
        const localKey = item.local?.id ? "id" : "name";
        const localVal = item.local?.id || item.local?.name;
        let localInfo = localKey === "id" ? byId.get(localVal) : byName.get(localVal);
        if (!localInfo) {
          localInfo = findOrAddLocal(item);
        }

        if (!localInfo) return;

        if (res === "overwrite") {
          result[localInfo.idx] = {
            ...item.imported,
            id: item.local.id || result[localInfo.idx].id,
          };
        } else if (res === "keep") {
        } else if (res === "merge") {
          const merged = { ...result[localInfo.idx] };
          merged.angle = item.imported.angle || merged.angle || "";
          const localDesc = merged.description || "";
          const importDesc = item.imported.description || "";
          if (localDesc && importDesc && localDesc !== importDesc) {
            merged.description = localDesc + "\n" + importDesc;
          } else {
            merged.description = localDesc || importDesc || "";
          }
          result[localInfo.idx] = merged;
        }
      });
    }

    if (attachmentAnalysis?.deleted && attachmentAnalysis.deleted.length > 0) {
      attachmentAnalysis.deleted.forEach((item, idx) => {
        const res = attachmentResolutions?.deleted?.[idx] || item.resolution || "keep";
        if (res === "delete") {
          const localKey = item.local?.id ? "id" : "name";
          const localVal = item.local?.id || item.local?.name;
          let localInfo = localKey === "id" ? byId.get(localVal) : byName.get(localVal);
          if (!localInfo) {
            localInfo = findOrAddLocal(item);
          }
          if (localInfo) {
            result[localInfo.idx] = null;
          }
        }
      });
      result = result.filter(Boolean);
    }

    return result;
  }

  function generateUniqueAttachmentName(existingNames, baseName) {
    if (!existingNames.has(baseName)) return baseName;
    const dotIdx = baseName.lastIndexOf(".");
    const namePart = dotIdx > 0 ? baseName.slice(0, dotIdx) : baseName;
    const extPart = dotIdx > 0 ? baseName.slice(dotIdx) : "";
    let counter = 1;
    let newName;
    do {
      newName = `${namePart}_${counter}${extPart}`;
      counter++;
    } while (existingNames.has(newName));
    return newName;
  }

  function applyMerge(localData, analysis, resolutions) {
    let updatedMarks = [...(localData.marks || [])];
    let updatedDives = [...(localData.dives || [])];
    let updatedMeasurements = [...(localData.measurements || [])];
    let updatedScale = localData.scale || null;
    let updatedGridConfig = localData.gridConfig || null;

    const { markResolutions, diveResolutions, measurementResolutions, attachmentResolutions } =
      resolutions || {};

    if (analysis.marks) {
      const newMarks = analysis.marks.new || [];
      const modifiedMarks = analysis.marks.modified || [];
      const divergedMarks = analysis.marks.diverged || [];
      const deletedMarks = analysis.marks.deleted || [];
      const positionDuplicates = analysis.marks.positionDuplicates || [];
      const positionDuplicateImportKeys = new Set();

      function getMarkIdentityKeys(mark) {
        if (!mark) return [];
        return [
          mark.id ? `id:${mark.id}` : null,
          mark.code ? `code:${mark.code}` : null,
        ].filter(Boolean);
      }

      positionDuplicates.forEach((item) => {
        getMarkIdentityKeys(item.importedMark || item.imported).forEach((key) => {
          positionDuplicateImportKeys.add(key);
        });
      });

      function isPositionDuplicateImport(mark) {
        return getMarkIdentityKeys(mark).some((key) =>
          positionDuplicateImportKeys.has(key)
        );
      }

      newMarks.forEach((item, idx) => {
        if (isPositionDuplicateImport(item.imported)) return;
        const res = markResolutions?.new?.[idx] || item.resolution || "add";
        if (res === "add") {
          const exists = updatedMarks.some((m) => m.code === item.imported.code);
          if (!exists) {
            const mark = DataIO.ensureReviewData
              ? DataIO.ensureReviewData({ ...item.imported })
              : { ...item.imported };
            const markAttResolutions = attachmentResolutions?.new?.[idx];
            if (item.hasAttachmentChanges && mark.attachments) {
              mark.attachments = applyAttachmentResolutions(
                [],
                item.attachments,
                markAttResolutions
              );
            }
            updatedMarks.push({
              ...mark,
              id: mark.id || crypto.randomUUID(),
              x: mark.x ?? 50,
              y: mark.y ?? 50,
            });
            recordChange("mark", "add", mark.id, mark.code, null, mark);
          }
        }
      });

      modifiedMarks.forEach((item, idx) => {
        if (isPositionDuplicateImport(item.imported)) return;
        const res =
          markResolutions?.modified?.[idx] || item.resolution || "keep";
        const markAttResolutions = attachmentResolutions?.modified?.[idx];
        if (res === "overwrite") {
          const idx2 = updatedMarks.findIndex(
            (m) => m.id === item.local.id || m.code === item.local.code
          );
          if (idx2 !== -1) {
            const oldMark = { ...updatedMarks[idx2] };
            const imported = DataIO.ensureReviewData
              ? DataIO.ensureReviewData({ ...item.imported })
              : { ...item.imported };
            if (item.hasAttachmentChanges) {
              imported.attachments = applyAttachmentResolutions(
                oldMark.attachments || [],
                item.attachments,
                markAttResolutions
              );
            } else {
              imported.attachments = oldMark.attachments || [];
            }
            updatedMarks[idx2] = {
              ...imported,
              id: item.local.id,
              x: imported.x ?? item.local.x,
              y: imported.y ?? item.local.y,
            };
            recordChange(
              "mark",
              "modify",
              item.local.id,
              item.local.code,
              oldMark,
              updatedMarks[idx2]
            );
          }
        } else if (res === "keep" && item.hasAttachmentChanges) {
          const idx2 = updatedMarks.findIndex(
            (m) => m.id === item.local.id || m.code === item.local.code
          );
          if (idx2 !== -1) {
            const oldMark = { ...updatedMarks[idx2] };
            const mergedAttachments = applyAttachmentResolutions(
              oldMark.attachments || [],
              item.attachments,
              markAttResolutions
            );
            updatedMarks[idx2] = {
              ...oldMark,
              attachments: mergedAttachments,
            };
            if (JSON.stringify(oldMark.attachments || []) !== JSON.stringify(mergedAttachments)) {
              recordChange(
                "mark",
                "modify",
                item.local.id,
                item.local.code,
                oldMark,
                updatedMarks[idx2]
              );
            }
          }
        }
      });

      divergedMarks.forEach((item, idx) => {
        if (isPositionDuplicateImport(item.imported)) return;
        const res =
          markResolutions?.diverged?.[idx] || item.resolution || "saveas";
        const markAttResolutions = attachmentResolutions?.diverged?.[idx];
        if (res === "overwrite") {
          const idx2 = updatedMarks.findIndex(
            (m) => m.code === item.local.code
          );
          if (idx2 !== -1) {
            const oldMark = { ...updatedMarks[idx2] };
            const imported = DataIO.ensureReviewData
              ? DataIO.ensureReviewData({ ...item.imported })
              : { ...item.imported };
            if (item.hasAttachmentChanges) {
              imported.attachments = applyAttachmentResolutions(
                oldMark.attachments || [],
                item.attachments,
                markAttResolutions
              );
            } else {
              imported.attachments = oldMark.attachments || [];
            }
            updatedMarks[idx2] = {
              ...imported,
              id: item.local.id,
              x: imported.x ?? item.local.x,
              y: imported.y ?? item.local.y,
            };
            recordChange(
              "mark",
              "modify",
              item.local.id,
              item.local.code,
              oldMark,
              updatedMarks[idx2]
            );
          }
        } else if (res === "saveas") {
          const existingCodes = new Set(updatedMarks.map((m) => m.code));
          const newCode = generateNewMergeCode(existingCodes, item.imported.code);
          existingCodes.add(newCode);
          const imported = DataIO.ensureReviewData
            ? DataIO.ensureReviewData({ ...item.imported })
            : { ...item.imported };
          if (item.hasAttachmentChanges) {
            imported.attachments = applyAttachmentResolutions(
              [],
              item.attachments,
              markAttResolutions
            );
          }
          const newMark = {
            ...imported,
            id: crypto.randomUUID(),
            code: newCode,
            x: imported.x ?? 50,
            y: imported.y ?? 50,
          };
          updatedMarks.push(newMark);
          recordChange("mark", "add", newMark.id, newCode, null, newMark);
        } else if (res === "keep" && item.hasAttachmentChanges) {
          const idx2 = updatedMarks.findIndex(
            (m) => m.id === item.local.id || m.code === item.local.code
          );
          if (idx2 !== -1) {
            const oldMark = { ...updatedMarks[idx2] };
            const mergedAttachments = applyAttachmentResolutions(
              oldMark.attachments || [],
              item.attachments,
              markAttResolutions
            );
            updatedMarks[idx2] = {
              ...oldMark,
              attachments: mergedAttachments,
            };
            if (JSON.stringify(oldMark.attachments || []) !== JSON.stringify(mergedAttachments)) {
              recordChange(
                "mark",
                "modify",
                item.local.id,
                item.local.code,
                oldMark,
                updatedMarks[idx2]
              );
            }
          }
        }
      });

      deletedMarks.forEach((item, idx) => {
        const res =
          markResolutions?.deleted?.[idx] || item.resolution || "keep";
        if (res === "delete") {
          const idx2 = updatedMarks.findIndex(
            (m) => m.id === item.local.id || m.code === item.local.code
          );
          if (idx2 !== -1) {
            const oldMark = { ...updatedMarks[idx2] };
            updatedMarks.splice(idx2, 1);
            recordChange(
              "mark",
              "delete",
              oldMark.id,
              oldMark.code,
              oldMark,
              null
            );
          }
        }
      });

      positionDuplicates.forEach((item, idx) => {
        const res =
          markResolutions?.positionDuplicates?.[idx] || item.resolution || "skip";
        if (res === "skip") {
          return;
        } else if (res === "merge") {
          const idx2 = updatedMarks.findIndex(
            (m) => m.id === item.localMark.id || m.code === item.localMark.code
          );
          if (idx2 !== -1) {
            const oldMark = { ...updatedMarks[idx2] };
            const imported = DataIO.ensureReviewData
              ? DataIO.ensureReviewData({ ...item.importedMark })
              : { ...item.importedMark };

            const mergedMark = { ...oldMark };
            const ignoreKeys = ["id", "code", "x", "y"];
            Object.keys(imported).forEach((key) => {
              if (ignoreKeys.includes(key)) return;
              if (mergedMark[key] === undefined || mergedMark[key] === null || mergedMark[key] === "") {
                mergedMark[key] = imported[key];
              }
            });

            if (!mergedMark.note) mergedMark.note = "";
            const mergeNote = `[合并自位置重复标记 ${imported.code}]`;
            mergedMark.note = mergedMark.note
              ? `${mergedMark.note}\n${mergeNote}`
              : mergeNote;

            updatedMarks[idx2] = mergedMark;
            recordChange(
              "mark",
              "modify",
              mergedMark.id,
              mergedMark.code,
              oldMark,
              mergedMark
            );
          }
        } else if (res === "keepboth") {
          const localIdx = updatedMarks.findIndex(
            (m) => m.id === item.localMark.id || m.code === item.localMark.code
          );
          const importIdx = updatedMarks.findIndex(
            (m) => m.id === item.importedMark.id || m.code === item.importedMark.code
          );

          if (localIdx !== -1 && importIdx === -1) {
            const existingCodes = new Set(updatedMarks.map((m) => m.code));
            const newCode = generateNewMergeCode(existingCodes, item.importedMark.code);
            existingCodes.add(newCode);
            const imported = DataIO.ensureReviewData
              ? DataIO.ensureReviewData({ ...item.importedMark })
              : { ...item.importedMark };
            const newMark = {
              ...imported,
              id: crypto.randomUUID(),
              code: newCode,
              x: imported.x ?? 50,
              y: imported.y ?? 50,
            };
            updatedMarks.push(newMark);
            recordChange("mark", "add", newMark.id, newCode, null, newMark);
          }
        }
      });
    }

    if (analysis.dives) {
      const newDives = analysis.dives.new || [];
      const modifiedDives = analysis.dives.modified || [];
      const divergedDives = analysis.dives.diverged || [];
      const deletedDives = analysis.dives.deleted || [];

      newDives.forEach((item, idx) => {
        const res = diveResolutions?.new?.[idx] || item.resolution || "add";
        if (res === "add") {
          const exists = updatedDives.some((d) => d.code === item.imported.code);
          if (!exists) {
            const newDive = {
              ...item.imported,
              id: item.imported.id || crypto.randomUUID(),
            };
            updatedDives.push(newDive);
            recordChange("dive", "add", newDive.id, newDive.code, null, newDive);
          }
        }
      });

      modifiedDives.forEach((item, idx) => {
        const res =
          diveResolutions?.modified?.[idx] || item.resolution || "keep";
        if (res === "overwrite") {
          const idx2 = updatedDives.findIndex(
            (d) => d.id === item.local.id || d.code === item.local.code
          );
          if (idx2 !== -1) {
            const oldDive = { ...updatedDives[idx2] };
            const oldCode = oldDive.code;
            updatedDives[idx2] = {
              ...item.imported,
              id: item.local.id,
            };
            const newCode = updatedDives[idx2].code;
            if (oldCode !== newCode) {
              updatedMarks.forEach((m) => {
                if (m.dive === oldCode) m.dive = newCode;
              });
              updatedMeasurements.forEach((m) => {
                if (m.dive === oldCode) m.dive = newCode;
              });
            }
            recordChange(
              "dive",
              "modify",
              item.local.id,
              item.local.code,
              oldDive,
              updatedDives[idx2]
            );
          }
        }
      });

      divergedDives.forEach((item, idx) => {
        const res =
          diveResolutions?.diverged?.[idx] || item.resolution || "saveas";
        if (res === "overwrite") {
          const idx2 = updatedDives.findIndex(
            (d) => d.code === item.local.code
          );
          if (idx2 !== -1) {
            const oldDive = { ...updatedDives[idx2] };
            const oldCode = oldDive.code;
            updatedDives[idx2] = {
              ...item.imported,
              id: item.local.id,
            };
            const newCode = updatedDives[idx2].code;
            if (oldCode !== newCode) {
              updatedMarks.forEach((m) => {
                if (m.dive === oldCode) m.dive = newCode;
              });
              updatedMeasurements.forEach((m) => {
                if (m.dive === oldCode) m.dive = newCode;
              });
            }
            recordChange(
              "dive",
              "modify",
              item.local.id,
              item.local.code,
              oldDive,
              updatedDives[idx2]
            );
          }
        } else if (res === "saveas") {
          const existingCodes = new Set(updatedDives.map((d) => d.code));
          const newCode = generateNewMergeCode(
            existingCodes,
            item.imported.code
          );
          existingCodes.add(newCode);
          const newDive = {
            ...item.imported,
            id: crypto.randomUUID(),
            code: newCode,
          };
          updatedDives.push(newDive);
          recordChange("dive", "add", newDive.id, newCode, null, newDive);
        }
      });

      deletedDives.forEach((item, idx) => {
        const res =
          diveResolutions?.deleted?.[idx] || item.resolution || "keep";
        if (res === "delete") {
          const idx2 = updatedDives.findIndex(
            (d) => d.id === item.local.id || d.code === item.local.code
          );
          if (idx2 !== -1) {
            const oldDive = { ...updatedDives[idx2] };
            const oldCode = oldDive.code;
            updatedDives.splice(idx2, 1);
            updatedMarks.forEach((m) => {
              if (m.dive === oldCode) m.dive = "";
            });
            updatedMeasurements.forEach((m) => {
              if (m.dive === oldCode) m.dive = "";
            });
            recordChange(
              "dive",
              "delete",
              oldDive.id,
              oldDive.code,
              oldDive,
              null
            );
          }
        }
      });
    }

    if (analysis.measurements) {
      const newMeasurements = analysis.measurements.new || [];
      const modifiedMeasurements = analysis.measurements.modified || [];
      const divergedMeasurements = analysis.measurements.diverged || [];
      const deletedMeasurements = analysis.measurements.deleted || [];

      newMeasurements.forEach((item, idx) => {
        const res =
          measurementResolutions?.new?.[idx] || item.resolution || "add";
        if (res === "add") {
          const exists = updatedMeasurements.some(
            (m) => m.code === item.imported.code
          );
          if (!exists) {
            const newMeas = {
              ...item.imported,
              id: item.imported.id || crypto.randomUUID(),
              createdAt: item.imported.createdAt || new Date().toISOString(),
            };
            updatedMeasurements.push(newMeas);
            recordChange(
              "measurement",
              "add",
              newMeas.id,
              newMeas.code,
              null,
              newMeas
            );
          }
        }
      });

      modifiedMeasurements.forEach((item, idx) => {
        const res =
          measurementResolutions?.modified?.[idx] || item.resolution || "keep";
        if (res === "overwrite") {
          const idx2 = updatedMeasurements.findIndex(
            (m) => m.id === item.local.id || m.code === item.local.code
          );
          if (idx2 !== -1) {
            const oldMeas = { ...updatedMeasurements[idx2] };
            updatedMeasurements[idx2] = {
              ...item.imported,
              id: item.local.id,
            };
            recordChange(
              "measurement",
              "modify",
              item.local.id,
              item.local.code,
              oldMeas,
              updatedMeasurements[idx2]
            );
          }
        }
      });

      divergedMeasurements.forEach((item, idx) => {
        const res =
          measurementResolutions?.diverged?.[idx] ||
          item.resolution ||
          "saveas";
        if (res === "overwrite") {
          const idx2 = updatedMeasurements.findIndex(
            (m) => m.code === item.local.code
          );
          if (idx2 !== -1) {
            const oldMeas = { ...updatedMeasurements[idx2] };
            updatedMeasurements[idx2] = {
              ...item.imported,
              id: item.local.id,
            };
            recordChange(
              "measurement",
              "modify",
              item.local.id,
              item.local.code,
              oldMeas,
              updatedMeasurements[idx2]
            );
          }
        } else if (res === "saveas") {
          const existingCodes = new Set(
            updatedMeasurements.map((m) => m.code)
          );
          const newCode = generateNewMergeCode(
            existingCodes,
            item.imported.code
          );
          existingCodes.add(newCode);
          const newMeas = {
            ...item.imported,
            id: crypto.randomUUID(),
            code: newCode,
            createdAt: new Date().toISOString(),
          };
          updatedMeasurements.push(newMeas);
          recordChange(
            "measurement",
            "add",
            newMeas.id,
            newCode,
            null,
            newMeas
          );
        }
      });

      deletedMeasurements.forEach((item, idx) => {
        const res =
          measurementResolutions?.deleted?.[idx] || item.resolution || "keep";
        if (res === "delete") {
          const idx2 = updatedMeasurements.findIndex(
            (m) => m.id === item.local.id || m.code === item.local.code
          );
          if (idx2 !== -1) {
            const oldMeas = { ...updatedMeasurements[idx2] };
            updatedMeasurements.splice(idx2, 1);
            recordChange(
              "measurement",
              "delete",
              oldMeas.id,
              oldMeas.code,
              oldMeas,
              null
            );
          }
        }
      });
    }

    if (analysis.scale) {
      const scaleValidation = Validation.validateScale(analysis.scale);
      if (scaleValidation.valid) {
        updatedScale = analysis.scale;
      }
    }

    if (analysis.gridConfig) {
      const gridValidation = Validation.validateGridConfig(
        analysis.gridConfig
      );
      if (gridValidation.valid) {
        updatedGridConfig = analysis.gridConfig;
      }
    }

    return {
      marks: updatedMarks,
      dives: updatedDives,
      measurements: updatedMeasurements,
      scale: updatedScale,
      gridConfig: updatedGridConfig,
    };
  }

  function generateNewMergeCode(existingCodes, baseCode) {
    let counter = 1;
    let newCode;
    const base = baseCode.replace(/-\d+$/, "");
    const suffixMatch = baseCode.match(/-(\d+)$/);
    let startNum = suffixMatch ? parseInt(suffixMatch[1]) + 1 : 1;
    counter = startNum;
    do {
      const numStr = String(counter).padStart(3, "0");
      newCode = `${base}-${numStr}`;
      counter++;
    } while (existingCodes.has(newCode));
    return newCode;
  }

  function saveSnapshot(marks, dives, measurements, scale, gridConfig, baseMap) {
    const snapshot = {
      timestamp: new Date().toISOString(),
      marks: deepClone(marks),
      dives: deepClone(dives),
      measurements: deepClone(measurements),
      scale: scale ? deepClone(scale) : null,
      gridConfig: gridConfig ? deepClone(gridConfig) : null,
      baseMap: baseMap ? deepClone(baseMap) : null,
    };
    localStorage.setItem(_snapshotKey(), JSON.stringify(snapshot));
    return snapshot;
  }

  function loadSnapshot() {
    try {
      const raw = localStorage.getItem(_snapshotKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error("Failed to load merge snapshot:", e);
      return null;
    }
  }

  function clearSnapshot() {
    localStorage.removeItem(_snapshotKey());
  }

  function hasSnapshot() {
    return localStorage.getItem(_snapshotKey()) !== null;
  }

  function rollbackFromSnapshot() {
    const snapshot = loadSnapshot();
    if (!snapshot) return null;
    return snapshot;
  }

  function getStats() {
    const changeLog = loadChangeLog();
    const snapshot = loadSnapshot();

    return {
      deviceId: getDeviceId(),
      changeLogCount: changeLog.length,
      hasSnapshot: !!snapshot,
      snapshotDate: snapshot ? snapshot.timestamp : null,
    };
  }

  return {
    MERGE_VERSION,
    POSITION_THRESHOLD,
    setProjectId,
    getDeviceId,
    setDeviceId,
    loadChangeLog,
    saveChangeLog,
    recordChange,
    clearChangeLog,
    buildExportData,
    isOfflineMergeFormat,
    analyzeMerge,
    analyzeAttachments,
    getAttachmentDiff,
    applyMerge,
    applyAttachmentResolutions,
    saveSnapshot,
    loadSnapshot,
    clearSnapshot,
    hasSnapshot,
    rollbackFromSnapshot,
    findPositionDuplicates,
    getMarkDiff,
    getDiveDiff,
    getStats,
    buildAttachmentSummary,
    hasAttachmentChanges,
    simpleHash,
  };
})();
