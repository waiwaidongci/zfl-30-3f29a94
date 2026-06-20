const DataIO = (() => {
  const OLD_MARKS_STORAGE_KEY = "zfl30Marks";
  const OLD_DIVES_STORAGE_KEY = "zfl30Dives";
  const OLD_MEASUREMENTS_STORAGE_KEY = "zfl30Measurements";
  const OLD_SCALE_STORAGE_KEY = "zfl30Scale";
  const OLD_GRID_STORAGE_KEY = "zfl30Grid";
  const OLD_IMPORT_ERRORS_STORAGE_KEY = "zfl30ImportErrors";
  const OLD_BASEMAP_STORAGE_KEY = "zfl30BaseMap";
  const THUMBNAIL_MAX_SIZE = 200;
  const MAX_IMAGE_SIZE_MB = 5;
  const STORAGE_WARNING_THRESHOLD = 0.8;

  let _projectId = null;

  function setProjectId(projectId) {
    _projectId = projectId;
  }

  function getProjectId() {
    return _projectId;
  }

  function _marksKey() { return _projectId ? ProjectManager.projKey(_projectId, "marks") : OLD_MARKS_STORAGE_KEY; }
  function _divesKey() { return _projectId ? ProjectManager.projKey(_projectId, "dives") : OLD_DIVES_STORAGE_KEY; }
  function _measurementsKey() { return _projectId ? ProjectManager.projKey(_projectId, "measurements") : OLD_MEASUREMENTS_STORAGE_KEY; }
  function _scaleKey() { return _projectId ? ProjectManager.projKey(_projectId, "scale") : OLD_SCALE_STORAGE_KEY; }
  function _gridKey() { return _projectId ? ProjectManager.projKey(_projectId, "grid") : OLD_GRID_STORAGE_KEY; }
  function _importErrorsKey() { return _projectId ? ProjectManager.projKey(_projectId, "importErrors") : OLD_IMPORT_ERRORS_STORAGE_KEY; }
  function _baseMapKey() { return _projectId ? ProjectManager.projKey(_projectId, "baseMap") : OLD_BASEMAP_STORAGE_KEY; }

  function getDefaultSampling() {
    return {
      sampleNo: "",
      sampleMethod: "",
      sampler: "",
      sampleTime: "",
    };
  }

  function ensureSamplingData(mark) {
    if (!mark.sampling) {
      mark.sampling = getDefaultSampling();
    } else {
      if (mark.sampling.sampleNo === undefined) mark.sampling.sampleNo = "";
      if (mark.sampling.sampleMethod === undefined) mark.sampling.sampleMethod = "";
      if (mark.sampling.sampler === undefined) mark.sampling.sampler = "";
      if (mark.sampling.sampleTime === undefined) mark.sampling.sampleTime = "";
    }
    return mark;
  }

  function getDefaultReview() {
    return {
      status: "collected",
      comment: "",
      reviewer: "",
      reviewedAt: null,
      history: [
        {
          status: "collected",
          at: new Date().toISOString(),
          comment: "",
          reviewer: "",
        },
      ],
    };
  }

  function ensureReviewData(mark) {
    if (!mark.review) {
      mark.review = getDefaultReview();
    } else {
      if (!mark.review.status) mark.review.status = "collected";
      if (mark.review.comment === undefined) mark.review.comment = "";
      if (mark.review.reviewer === undefined) mark.review.reviewer = "";
      if (mark.review.reviewedAt === undefined) mark.review.reviewedAt = null;
      if (!mark.review.history || !Array.isArray(mark.review.history)) {
        mark.review.history = [
          {
            status: mark.review.status,
            at: mark.review.reviewedAt || new Date().toISOString(),
            comment: mark.review.comment,
            reviewer: mark.review.reviewer,
          },
        ];
      }
    }
    return mark;
  }

  function ensureParticipantsData(dive) {
    if (!dive.participants || !Array.isArray(dive.participants)) {
      dive.participants = [];
    } else {
      dive.participants = dive.participants.map(p => ({
        name: p.name || "",
        role: p.role || "",
        equipment: p.equipment || "",
      }));
    }
    return dive;
  }

  function loadMarks() {
    try {
      const raw = JSON.parse(localStorage.getItem(_marksKey()) || "[]");
      return raw.map((m) => {
        m = ensureReviewData(m);
        m = ensureSamplingData(m);
        return m;
      });
    } catch (e) {
      console.error("Failed to load marks:", e);
      return [];
    }
  }

  function saveMarks(marks) {
    localStorage.setItem(_marksKey(), JSON.stringify(marks));
  }

  function loadDives() {
    try {
      const raw = JSON.parse(localStorage.getItem(_divesKey()) || "[]");
      return raw.map(d => ensureParticipantsData(d));
    } catch (e) {
      console.error("Failed to load dives:", e);
      return [];
    }
  }

  function saveDives(dives) {
    localStorage.setItem(_divesKey(), JSON.stringify(dives));
  }

  function loadMeasurements() {
    try {
      return JSON.parse(localStorage.getItem(_measurementsKey()) || "[]");
    } catch (e) {
      console.error("Failed to load measurements:", e);
      return [];
    }
  }

  function saveMeasurements(measurements) {
    localStorage.setItem(_measurementsKey(), JSON.stringify(measurements));
  }

  function loadScale() {
    try {
      return JSON.parse(localStorage.getItem(_scaleKey()) || "null");
    } catch (e) {
      console.error("Failed to load scale:", e);
      return null;
    }
  }

  function saveScale(scale) {
    localStorage.setItem(_scaleKey(), JSON.stringify(scale));
  }

  function loadGridConfig() {
    try {
      return JSON.parse(localStorage.getItem(_gridKey()) || "null");
    } catch (e) {
      console.error("Failed to load grid config:", e);
      return null;
    }
  }

  function saveGridConfig(config) {
    localStorage.setItem(_gridKey(), JSON.stringify(config));
  }

  function loadBaseMap() {
    try {
      return JSON.parse(localStorage.getItem(_baseMapKey()) || "null");
    } catch (e) {
      console.error("Failed to load base map:", e);
      return null;
    }
  }

  function saveBaseMap(baseMap) {
    if (baseMap) {
      localStorage.setItem(_baseMapKey(), JSON.stringify(baseMap));
    } else {
      localStorage.removeItem(_baseMapKey());
    }
  }

  function loadImportErrors() {
    try {
      return JSON.parse(localStorage.getItem(_importErrorsKey()) || "[]");
    } catch (e) {
      console.error("Failed to load import errors:", e);
      return [];
    }
  }

  function saveImportErrors(errors) {
    localStorage.setItem(_importErrorsKey(), JSON.stringify(errors || []));
  }

  function exportFullData(marks, dives, measurements, scale, gridConfig, baseMap, filename = "dive-records.json") {
    const processedMarks = marks.map((m) => {
      m = ensureReviewData(m);
      m = ensureSamplingData(m);
      return m;
    });
    const data = {
      version: "7.0",
      exportDate: new Date().toISOString(),
      dives: dives,
      marks: processedMarks,
      measurements: measurements || [],
      scale: scale || null,
      gridConfig: gridConfig || null,
      baseMap: baseMap || null,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportOfflineMerge(marks, dives, measurements, scale, gridConfig, baseMap, filename = "dive-records-offline.json") {
    if (MergeModule && typeof MergeModule.buildExportData === "function") {
      const data = MergeModule.buildExportData(marks, dives, measurements, scale, gridConfig, baseMap);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } else {
      exportFullData(marks, dives, measurements, scale, gridConfig, baseMap, filename);
    }
  }

  function exportMarksOnly(marks, filename = "dive-marks.json") {
    const blob = new Blob([JSON.stringify(marks, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  function parseJSON(text) {
    try {
      const data = JSON.parse(text);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  function triggerFileInput(accept = ".json,application/json") {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.onchange = () => {
        if (input.files && input.files[0]) {
          resolve(input.files[0]);
        } else {
          reject(new Error("No file selected"));
        }
      };
      input.oncancel = () => reject(new Error("File selection cancelled"));
      input.click();
    });
  }

  function isFullDataFormat(data) {
    return data && typeof data === "object" && "dives" in data && "marks" in data;
  }

  function isFullDataFormatV3(data) {
    return isFullDataFormat(data) && "measurements" in data;
  }

  function isFullDataFormatV4(data) {
    return isFullDataFormatV3(data) && data.version && parseFloat(data.version) >= 4.0;
  }

  function isFullDataFormatV5(data) {
    return isFullDataFormatV4(data) && data.version && parseFloat(data.version) >= 5.0 && parseFloat(data.version) < 6.0;
  }

  function isFullDataFormatV6(data) {
    return isFullDataFormatV4(data) && data.version && parseFloat(data.version) >= 6.0 && parseFloat(data.version) < 7.0;
  }

  function isFullDataFormatV7(data) {
    return isFullDataFormatV4(data) && data.version && parseFloat(data.version) >= 7.0;
  }

  function isOfflineMergeFormat(data) {
    if (typeof MergeModule !== "undefined" && typeof MergeModule.isOfflineMergeFormat === "function") {
      return MergeModule.isOfflineMergeFormat(data);
    }
    return !!(data && typeof data === "object" && data.format === "offline-merge" && data.snapshot && data.changeLog);
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function generateThumbnail(dataUrl, maxSize = THUMBNAIL_MAX_SIZE) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = dataUrl;
    });
  }

  function getImageDimensions(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = dataUrl;
    });
  }

  async function processImageFile(file) {
    if (!file.type.startsWith("image/")) {
      throw new Error("请选择图片文件");
    }

    const maxSizeBytes = MAX_IMAGE_SIZE_MB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new Error(`图片大小不能超过 ${MAX_IMAGE_SIZE_MB}MB`);
    }

    const dataUrl = await readFileAsDataURL(file);
    const thumbnail = await generateThumbnail(dataUrl);
    const dimensions = await getImageDimensions(dataUrl);

    return {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      width: dimensions.width,
      height: dimensions.height,
      thumbnail: thumbnail,
      fullImage: dataUrl,
      angle: "",
      description: "",
      createdAt: new Date().toISOString(),
    };
  }

  function getStorageUsage() {
    let totalSize = 0;
    const keyFn = [_marksKey, _divesKey, _measurementsKey, _scaleKey, _gridKey, _importErrorsKey, _baseMapKey];

    keyFn.forEach((fn) => {
      const value = localStorage.getItem(fn());
      if (value) {
        totalSize += new Blob([value]).size;
      }
    });

    const estimatedQuota = 5 * 1024 * 1024;
    const usagePercent = totalSize / estimatedQuota;

    return {
      usedBytes: totalSize,
      usedKB: (totalSize / 1024).toFixed(1),
      usedMB: (totalSize / (1024 * 1024)).toFixed(2),
      estimatedQuotaMB: estimatedQuota / (1024 * 1024),
      usagePercent: usagePercent,
      isNearLimit: usagePercent >= STORAGE_WARNING_THRESHOLD,
    };
  }

  function checkStorageCapacity(additionalBytes = 0) {
    const usage = getStorageUsage();
    const projectedUsage = usage.usedBytes + additionalBytes;
    const estimatedQuota = usage.estimatedQuotaMB * 1024 * 1024;
    const projectedPercent = projectedUsage / estimatedQuota;

    return {
      ...usage,
      projectedUsagePercent: projectedPercent,
      willExceed: projectedPercent >= 0.95,
      willWarn: projectedPercent >= STORAGE_WARNING_THRESHOLD,
    };
  }

  function triggerImageInput() {
    return triggerFileInput("image/*");
  }

  const CSV_COLUMN_MAPPINGS = {
    code: ["编号", "编号", "code", "id", "编号code", "标记编号", "标本编号"],
    type: ["类型", "类别", "type", "category", "种类", "文物类型"],
    dive: ["潜次", "潜次编号", "dive", "diveCode", "潜水批次", "潜次号"],
    depth: ["深度", "水深", "depth", "深度m", "深度(米)", "埋藏深度"],
    x: ["x坐标", "x", "经度", "横坐标", "位置x", "x轴", "X坐标"],
    y: ["y坐标", "y", "纬度", "纵坐标", "位置y", "y轴", "Y坐标"],
    orientation: ["朝向", "方向", "orientation", "direction", "方位", "摆放方向"],
    condition: ["保存状态", "保存状况", "condition", "状态", "保存情况", "文物状态"],
    note: ["备注", "说明", "note", "remark", "comment", "描述", "附注"],
    sampleNo: ["样品编号", "样本编号", "sampleNo", "sample_no", "采样编号", "标本号"],
    sampleMethod: ["采样方式", "采样方法", "sampleMethod", "sample_method", "采集方式"],
    sampler: ["采样人", "采集人", "sampler", "采样员"],
    sampleTime: ["采样时间", "采集时间", "sampleTime", "sample_time", "采样日期"],
  };

  const TYPE_NAME_MAPPINGS = {
    "陶片": "ceramic",
    "陶瓷": "ceramic",
    "瓷器": "ceramic",
    "ceramic": "ceramic",
    "木构件": "wood",
    "木材": "wood",
    "木质": "wood",
    "wood": "wood",
    "金属件": "metal",
    "金属": "metal",
    "铁器": "metal",
    "铜器": "metal",
    "metal": "metal",
    "未知物": "unknown",
    "未知": "unknown",
    "其他": "unknown",
    "unknown": "unknown",
  };

  function parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
    }
    result.push(current.trim());
    return result;
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length === 0) {
      return { success: false, error: "CSV 文件为空" };
    }

    const headers = parseCSVLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.every((v) => v.trim() === "")) continue;
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || "";
      });
      rows.push(row);
    }

    return { success: true, headers, rows };
  }

  function detectColumnMapping(headers) {
    const mapping = {};
    const usedHeaders = new Set();

    for (const [field, possibleNames] of Object.entries(CSV_COLUMN_MAPPINGS)) {
      for (const name of possibleNames) {
        const matched = headers.find(
          (h) => !usedHeaders.has(h) && h.toLowerCase().trim() === name.toLowerCase().trim()
        );
        if (matched) {
          mapping[field] = matched;
          usedHeaders.add(matched);
          break;
        }
      }
    }

    return mapping;
  }

  function mapType(rawType) {
    if (!rawType) return "unknown";
    const cleaned = rawType.trim().toLowerCase();
    for (const [name, value] of Object.entries(TYPE_NAME_MAPPINGS)) {
      if (name.toLowerCase() === cleaned) {
        return value;
      }
    }
    return rawType.trim();
  }

  function parseCoordinate(raw) {
    if (!raw || raw.trim() === "") return null;
    const num = Number(raw);
    if (isNaN(num)) return null;
    return num;
  }

  function applyColumnMapping(row, mapping) {
    const result = {};
    for (const [field, header] of Object.entries(mapping)) {
      if (row[header] !== undefined) {
        result[field] = row[header];
      }
    }
    return result;
  }

  function convertCSVRowToMark(rawRow, mapping, lineNumber) {
    const mapped = applyColumnMapping(rawRow, mapping);
    const mark = {
      code: mapped.code ? mapped.code.trim() : "",
      type: mapType(mapped.type),
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
      const x = parseCoordinate(mapped.x);
      if (x !== null) mark.x = x;
    }
    if (mapped.y !== undefined) {
      const y = parseCoordinate(mapped.y);
      if (y !== null) mark.y = y;
    }

    mark._csvLineNumber = lineNumber;
    mark._rawRow = { ...rawRow };
    return mark;
  }

  function parseCSVToMarks(text) {
    const parsed = parseCSV(text);
    if (!parsed.success) {
      return { success: false, error: parsed.error };
    }

    const mapping = detectColumnMapping(parsed.headers);
    const marks = parsed.rows.map((row, idx) =>
      convertCSVRowToMark(row, mapping, idx + 2)
    );

    return {
      success: true,
      headers: parsed.headers,
      mapping,
      rows: parsed.rows,
      marks,
    };
  }

  function triggerCSVInput() {
    return triggerFileInput(".csv,text/csv,application/vnd.ms-excel");
  }

  return {
    setProjectId,
    getProjectId,
    loadMarks,
    saveMarks,
    loadDives,
    saveDives,
    loadMeasurements,
    saveMeasurements,
    loadScale,
    saveScale,
    loadGridConfig,
    saveGridConfig,
    loadImportErrors,
    saveImportErrors,
    exportFullData,
    exportOfflineMerge,
    exportMarksOnly,
    readFileAsText,
    readFileAsDataURL,
    parseJSON,
    triggerFileInput,
    triggerImageInput,
    isFullDataFormat,
    isFullDataFormatV3,
    isFullDataFormatV4,
    isFullDataFormatV5,
    isFullDataFormatV6,
    isFullDataFormatV7,
    isOfflineMergeFormat,
    getDefaultReview,
    ensureReviewData,
    ensureParticipantsData,
    getDefaultSampling,
    ensureSamplingData,
    loadBaseMap,
    saveBaseMap,
    generateThumbnail,
    getImageDimensions,
    processImageFile,
    getStorageUsage,
    checkStorageCapacity,
    THUMBNAIL_MAX_SIZE,
    MAX_IMAGE_SIZE_MB,
    STORAGE_WARNING_THRESHOLD,
    parseCSV,
    parseCSVToMarks,
    detectColumnMapping,
    mapType,
    parseCoordinate,
    triggerCSVInput,
    CSV_COLUMN_MAPPINGS,
    TYPE_NAME_MAPPINGS,
  };
})();
