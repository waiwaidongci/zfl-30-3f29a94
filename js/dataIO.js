const DataIO = (() => {
  const MARKS_STORAGE_KEY = "zfl30Marks";
  const DIVES_STORAGE_KEY = "zfl30Dives";

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

  function exportFullData(marks, dives, filename = "dive-records.json") {
    const data = {
      version: "2.0",
      exportDate: new Date().toISOString(),
      dives: dives,
      marks: marks,
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

  return {
    loadMarks,
    saveMarks,
    loadDives,
    saveDives,
    exportFullData,
    exportMarksOnly,
    readFileAsText,
    parseJSON,
    triggerFileInput,
    isFullDataFormat,
  };
})();
