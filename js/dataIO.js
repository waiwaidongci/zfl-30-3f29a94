const DataIO = (() => {
  const MARKS_STORAGE_KEY = "zfl30Marks";
  const DIVES_STORAGE_KEY = "zfl30Dives";
  const MEASUREMENTS_STORAGE_KEY = "zfl30Measurements";
  const SCALE_STORAGE_KEY = "zfl30Scale";
  const GRID_STORAGE_KEY = "zfl30Grid";
  const THUMBNAIL_MAX_SIZE = 200;
  const MAX_IMAGE_SIZE_MB = 5;
  const STORAGE_WARNING_THRESHOLD = 0.8;

  function loadMarks() {
    try {
      return JSON.parse(localStorage.getItem(MARKS_STORAGE_KEY) || "[]");
    } catch (e) {
      console.error("Failed to load marks:", e);
      return [];
    }
  }

  function saveMarks(marks) {
    localStorage.setItem(MARKS_STORAGE_KEY, JSON.stringify(marks));
  }

  function loadDives() {
    try {
      return JSON.parse(localStorage.getItem(DIVES_STORAGE_KEY) || "[]");
    } catch (e) {
      console.error("Failed to load dives:", e);
      return [];
    }
  }

  function saveDives(dives) {
    localStorage.setItem(DIVES_STORAGE_KEY, JSON.stringify(dives));
  }

  function loadMeasurements() {
    try {
      return JSON.parse(localStorage.getItem(MEASUREMENTS_STORAGE_KEY) || "[]");
    } catch (e) {
      console.error("Failed to load measurements:", e);
      return [];
    }
  }

  function saveMeasurements(measurements) {
    localStorage.setItem(MEASUREMENTS_STORAGE_KEY, JSON.stringify(measurements));
  }

  function loadScale() {
    try {
      return JSON.parse(localStorage.getItem(SCALE_STORAGE_KEY) || "null");
    } catch (e) {
      console.error("Failed to load scale:", e);
      return null;
    }
  }

  function saveScale(scale) {
    localStorage.setItem(SCALE_STORAGE_KEY, JSON.stringify(scale));
  }

  function loadGridConfig() {
    try {
      return JSON.parse(localStorage.getItem(GRID_STORAGE_KEY) || "null");
    } catch (e) {
      console.error("Failed to load grid config:", e);
      return null;
    }
  }

  function saveGridConfig(config) {
    localStorage.setItem(GRID_STORAGE_KEY, JSON.stringify(config));
  }

  function exportFullData(marks, dives, measurements, scale, gridConfig, filename = "dive-records.json") {
    const data = {
      version: "4.0",
      exportDate: new Date().toISOString(),
      dives: dives,
      marks: marks,
      measurements: measurements || [],
      scale: scale || null,
      gridConfig: gridConfig || null,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
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
    const keys = [MARKS_STORAGE_KEY, DIVES_STORAGE_KEY, MEASUREMENTS_STORAGE_KEY, SCALE_STORAGE_KEY, GRID_STORAGE_KEY];

    keys.forEach((key) => {
      const value = localStorage.getItem(key);
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

  return {
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
    exportFullData,
    exportMarksOnly,
    readFileAsText,
    readFileAsDataURL,
    parseJSON,
    triggerFileInput,
    triggerImageInput,
    isFullDataFormat,
    isFullDataFormatV3,
    isFullDataFormatV4,
    generateThumbnail,
    getImageDimensions,
    processImageFile,
    getStorageUsage,
    checkStorageCapacity,
    THUMBNAIL_MAX_SIZE,
    MAX_IMAGE_SIZE_MB,
    STORAGE_WARNING_THRESHOLD,
  };
})();
