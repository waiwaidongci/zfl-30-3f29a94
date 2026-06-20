const UI = (() => {
  const typeNames = { ceramic: "陶片", wood: "木构件", metal: "金属件", unknown: "未知物" };

  let elements = {};
  let marks = [];
  let pending = null;
  let currentEditId = null;

  function init(deps) {
    elements = {
      map: document.querySelector("#map"),
      form: document.querySelector("#form"),
      list: document.querySelector("#list"),
      filter: document.querySelector("#filter"),
      view: document.querySelector("#view"),
      listTitle: document.querySelector("#listTitle"),
      exportBtn: document.querySelector("#exportBtn"),
      importBtn: document.querySelector("#importBtn"),
      deleteBtn: document.querySelector("#deleteBtn"),
    };

    marks = deps.marks;
    pending = deps.pending;
    currentEditId = deps.currentEditId;

    initRibs();
    bindEvents(deps.callbacks);
  }

  function initRibs() {
    for (let i = 0; i < 7; i++) {
      const rib = document.createElement("div");
      rib.className = "rib";
      rib.style.left = 28 + i * 7 + "%";
      elements.map.appendChild(rib);
    }
  }

  function bindEvents(callbacks) {
    elements.map.addEventListener("click", (event) => {
      const rect = elements.map.getBoundingClientRect();
      pending = {
        x: Number(((event.clientX - rect.left) / rect.width * 100).toFixed(2)),
        y: Number(((event.clientY - rect.top) / rect.height * 100).toFixed(2)),
      };
      elements.form.reset();
      elements.form.id.value = "";
      currentEditId = null;
      elements.form.code.value = "M-" + String(marks.length + 1).padStart(3, "0");
      elements.form.dive.value = "DIVE-01";
      render();
    });

    elements.form.onsubmit = (event) => {
      event.preventDefault();
      if (!pending) pending = { x: 50, y: 50 };
      const data = Object.fromEntries(new FormData(elements.form).entries());
      callbacks.onSave(data, pending);
    };

    elements.deleteBtn.onclick = () => {
      if (!elements.form.id.value) return;
      callbacks.onDelete(elements.form.id.value);
    };

    elements.exportBtn.onclick = () => {
      callbacks.onExport();
    };

    elements.importBtn.onclick = () => {
      callbacks.onImport();
    };

    elements.filter.onchange = render;
    elements.view.onchange = render;
  }

  function updateState(newMarks, newPending, newCurrentEditId) {
    marks = newMarks;
    pending = newPending;
    currentEditId = newCurrentEditId;
    render();
  }

  function render() {
    elements.map.querySelectorAll(".marker").forEach((el) => el.remove());
    const filtered = elements.filter.value
      ? marks.filter((m) => m.type === elements.filter.value)
      : marks;

    filtered.forEach((mark) => {
      const el = document.createElement("button");
      el.className =
        "marker " + mark.type + (mark.id === currentEditId ? " selected" : "");
      el.style.left = mark.x + "%";
      el.style.top = mark.y + "%";
      el.textContent = mark.code.slice(0, 2);
      el.onclick = (event) => {
        event.stopPropagation();
        edit(mark.id);
      };
      elements.map.appendChild(el);
    });

    if (elements.view.value === "timeline") {
      renderTimeline(filtered);
    } else {
      renderList(filtered);
    }
  }

  function renderList(data) {
    elements.listTitle.textContent = "标记列表";
    elements.list.className = "list";
    elements.list.innerHTML = data
      .map(
        (m) =>
          '<div class="item ' +
          (m.id === currentEditId ? "active" : "") +
          '" data-id="' +
          m.id +
          '"><b>' +
          m.code +
          '</b> <span class="pill">' +
          typeNames[m.type] +
          '</span><div class="muted">' +
          m.dive +
          " · " +
          m.depth +
          " · " +
          (m.orientation || "") +
          "</div><div>" +
          (m.condition || "") +
          "</div></div>"
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
        ([dive, items]) =>
          '<div class="item"><b>' +
          dive +
          '</b><div class="muted">新增' +
          items.length +
          "个标记</div>" +
          items
            .map((i) => "<div>" + i.code + " · " + typeNames[i.type] + "</div>")
            .join("") +
          "</div>"
      )
      .join("");
  }

  function edit(id) {
    const mark = marks.find((m) => m.id === id);
    if (!mark) return;
    for (const [key, value] of Object.entries(mark)) {
      if (elements.form[key]) elements.form[key].value = value;
    }
    pending = { x: mark.x, y: mark.y };
    currentEditId = id;
    render();
  }

  function resetForm() {
    elements.form.reset();
    elements.form.id.value = "";
    currentEditId = null;
    pending = null;
  }

  function showImportPreview(comparison, onConfirm, onCancel) {
    const { newMarks, conflicts, errors, summary } = comparison;
    const resolutions = conflicts.map(() => "keep");

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal";

    let html = "<h2>导入预览</h2>";

    html += '<div class="summary-bar">';
    html += '<span class="pill">共 ' + summary.total + " 项</span>";
    html += '<span class="pill pill-new">新增 ' + summary.new + " 项</span>";
    html += '<span class="pill pill-conflict">冲突 ' + summary.conflict + " 项</span>";
    html += '<span class="pill pill-error">错误 ' + summary.error + " 项</span>";
    html += "</div>";

    if (newMarks.length > 0) {
      html += '<div class="preview-section">';
      html += '<h3><span class="pill pill-new">新增</span> 以下标记将被添加</h3>';
      html += '<div class="preview-list">';
      newMarks.forEach((mark) => {
        html +=
          '<div class="preview-item"><span><b>' +
          mark.code +
          "</b> " +
          typeNames[mark.type] +
          ' · ' +
          mark.dive +
          " · " +
          mark.depth +
          "</span></div>";
      });
      html += "</div></div>";
    }

    if (conflicts.length > 0) {
      html += '<div class="preview-section">';
      html += '<h3><span class="pill pill-conflict">冲突</span> 同编号标记，请选择处理方式</h3>';
      html += '<div class="toolbar-3">';
      html += '<button type="button" class="secondary" data-bulk="keep">全部保留本地</button>';
      html += '<button type="button" class="secondary" data-bulk="overwrite">全部覆盖本地</button>';
      html += '<button type="button" class="secondary" data-bulk="saveas">全部另存新编号</button>';
      html += "</div>";
      html += '<div class="preview-list">';
      conflicts.forEach((conflict, idx) => {
        html +=
          '<div class="preview-item" data-conflict-index="' +
          idx +
          '"><span><b>' +
          conflict.imported.code +
          "</b> " +
          typeNames[conflict.imported.type] +
          ' · ' +
          conflict.imported.dive +
          "</span>";
        html += '<select data-resolution-index="' + idx + '">';
        html += '<option value="keep">保留本地</option>';
        html += '<option value="overwrite">覆盖本地</option>';
        html += '<option value="saveas">另存为新编号</option>';
        html += "</select></div>";
      });
      html += "</div></div>";
    }

    if (errors.length > 0) {
      html += '<div class="preview-section">';
      html += '<h3><span class="pill pill-error">错误</span> 以下项格式有误，将被跳过</h3>';
      html += '<div class="preview-list">';
      errors.forEach((err) => {
        const code = err.mark && err.mark.code ? err.mark.code : "第 " + (err.index + 1) + " 项";
        html +=
          '<div class="preview-item"><span><b>' +
          code +
          "</b></span><span class='muted'>" +
          err.errors.join("; ") +
          "</span></div>";
      });
      html += "</div></div>";
    }

    html += '<div class="toolbar">';
    html += '<button type="button" id="confirmImportBtn">确认导入</button>';
    html += '<button type="button" class="secondary" id="cancelImportBtn">取消</button>';
    html += "</div>";

    modal.innerHTML = html;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    modal.querySelectorAll("[data-resolution-index]").forEach((select) => {
      select.onchange = (e) => {
        const idx = parseInt(e.target.dataset.resolutionIndex);
        resolutions[idx] = e.target.value;
      };
    });

    modal.querySelectorAll("[data-bulk]").forEach((btn) => {
      btn.onclick = (e) => {
        const action = e.target.dataset.bulk;
        conflicts.forEach((_, idx) => {
          resolutions[idx] = action;
          const select = modal.querySelector(
            '[data-resolution-index="' + idx + '"]'
          );
          if (select) select.value = action;
        });
      };
    });

    modal.querySelector("#confirmImportBtn").onclick = () => {
      document.body.removeChild(backdrop);
      onConfirm(resolutions);
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

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.style.cssText =
      "position:fixed;top:24px;right:24px;padding:12px 20px;background:#1d6c78;color:#fff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.3);z-index:2000;animation:slideIn .3s ease;";
    if (type === "error") toast.style.background = "#c0392b";
    if (type === "success") toast.style.background = "#28a745";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "slideOut .3s ease forwards";
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 2500);
  }

  return {
    init,
    updateState,
    render,
    edit,
    resetForm,
    showImportPreview,
    showToast,
    typeNames,
  };
})();
