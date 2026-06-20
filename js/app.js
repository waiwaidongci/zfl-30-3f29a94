const App = (() => {
  let marks = [];
  let dives = [];
  let pending = null;
  let currentEditId = null;

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
      },
    ];
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
        });
      }
    });

    if (dives.length > 0) {
      saveDives();
    }
  }

  function init() {
    marks = DataIO.loadMarks();
    dives = DataIO.loadDives();

    if (!dives.length && !marks.length) {
      dives = getDefaultDives();
      marks = getDefaultMarks();
      save();
      saveDives();
    } else if (!dives.length && marks.length) {
      autoCreateDivesFromMarks();
    } else if (!marks.length) {
      marks = getDefaultMarks();
      save();
    }

    UI.init({
      marks,
      dives,
      pending,
      currentEditId,
      callbacks: {
        onSaveMark: handleSaveMark,
        onDeleteMark: handleDeleteMark,
        onSaveDive: handleSaveDive,
        onDeleteDive: handleDeleteDive,
        onExport: handleExport,
        onImport: handleImport,
      },
    });

    UI.render();
  }

  function save() {
    DataIO.saveMarks(marks);
  }

  function saveDives() {
    DataIO.saveDives(dives);
  }

  function handleSaveMark(data, pendingPos) {
    if (data.id) {
      const mark = marks.find((m) => m.id === data.id);
      if (mark) {
        Object.assign(mark, data, pendingPos);
      }
    } else {
      marks.push({
        ...data,
        id: crypto.randomUUID(),
        ...pendingPos,
      });
    }
    save();
    UI.updateState(marks, dives, pending, data.id || null);
  }

  function handleDeleteMark(id) {
    marks = marks.filter((m) => m.id !== id);
    UI.resetForm();
    save();
    UI.updateState(marks, dives, null, null);
  }

  function handleSaveDive(data) {
    const oldCode = data.id ? dives.find(d => d.id === data.id)?.code : null;

    if (data.id) {
      const dive = dives.find((d) => d.id === data.id);
      if (dive) {
        Object.assign(dive, data);
        if (oldCode && oldCode !== data.code) {
          marks.forEach(m => {
            if (m.dive === oldCode) {
              m.dive = data.code;
            }
          });
          save();
        }
      }
    } else {
      dives.push({
        ...data,
        id: crypto.randomUUID(),
      });
    }
    saveDives();
    UI.resetDiveForm();
    UI.updateState(marks, dives, pending, currentEditId);
    UI.showToast("潜次档案已保存", "success");
  }

  function handleDeleteDive(id) {
    const dive = dives.find(d => d.id === id);
    if (!dive) return;

    const associatedMarks = marks.filter(m => m.dive === dive.code);
    if (associatedMarks.length > 0) {
      if (!confirm(`该潜次关联了 ${associatedMarks.length} 个标记，删除后这些标记的潜次字段将被清空。确定删除吗？`)) {
        return;
      }
      marks.forEach(m => {
        if (m.dive === dive.code) {
          m.dive = "";
        }
      });
      save();
    }

    dives = dives.filter((d) => d.id !== id);
    UI.resetDiveForm();
    saveDives();
    UI.updateState(marks, dives, pending, currentEditId);
    UI.showToast("潜次档案已删除", "info");
  }

  function handleExport() {
    DataIO.exportFullData(marks, dives);
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

      const isFullFormat = DataIO.isFullDataFormat(parsed.data);
      let comparison;

      if (isFullFormat) {
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
          version: parsed.data.version || "1.0",
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

  function applyImport(comparison, resolutions) {
    const { markResolutions, diveResolutions } = resolutions;

    let updatedMarks = [...marks];
    let updatedDives = [...dives];

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

    marks = updatedMarks;
    dives = updatedDives;

    autoCreateDivesFromMarks();

    save();
    saveDives();
    UI.updateState(marks, dives, pending, currentEditId);

    const markSummary = comparison.marks?.summary;
    const diveSummary = comparison.dives?.summary;

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

    UI.showToast(message + parts.join("，"), "success");
  }

  return {
    init,
  };
})();

document.addEventListener("DOMContentLoaded", App.init);
