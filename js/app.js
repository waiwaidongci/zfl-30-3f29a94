const App = (() => {
  let marks = [];
  let pending = null;
  let currentEditId = null;

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

  function init() {
    marks = DataIO.loadMarks();
    if (!marks.length) {
      marks = getDefaultMarks();
      save();
    }

    UI.init({
      marks,
      pending,
      currentEditId,
      callbacks: {
        onSave: handleSave,
        onDelete: handleDelete,
        onExport: handleExport,
        onImport: handleImport,
      },
    });

    UI.render();
  }

  function save() {
    DataIO.saveMarks(marks);
  }

  function handleSave(data, pendingPos) {
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
    UI.updateState(marks, pending, data.id || null);
  }

  function handleDelete(id) {
    marks = marks.filter((m) => m.id !== id);
    UI.resetForm();
    save();
    UI.updateState(marks, null, null);
  }

  function handleExport() {
    DataIO.exportJSON(marks);
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

      const comparison = Validation.compareMarks(marks, parsed.data);

      if (!comparison.valid) {
        UI.showToast(comparison.errors[0], "error");
        return;
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
    const { newMarks, conflicts, summary } = comparison;

    let updatedMarks = [...marks];

    if (conflicts.length > 0) {
      updatedMarks = Validation.resolveConflicts(
        updatedMarks,
        conflicts,
        resolutions
      );
    }

    if (newMarks.length > 0) {
      updatedMarks = Validation.addNewMarks(updatedMarks, newMarks);
    }

    marks = updatedMarks;
    save();
    UI.updateState(marks, pending, currentEditId);

    const addedCount = summary.new + resolutions.filter((r) => r === "saveas").length;
    const overwrittenCount = resolutions.filter((r) => r === "overwrite").length;

    let message = `导入完成：新增 ${addedCount} 项`;
    if (overwrittenCount > 0) message += `，覆盖 ${overwrittenCount} 项`;
    if (summary.error > 0) message += `，跳过 ${summary.error} 项错误`;

    UI.showToast(message, "success");
  }

  return {
    init,
  };
})();

document.addEventListener("DOMContentLoaded", App.init);
