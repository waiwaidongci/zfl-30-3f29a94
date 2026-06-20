const UI = (() => {
  const typeNames = { ceramic: "陶片", wood: "木构件", metal: "金属件", unknown: "未知物" };
  const weatherNames = { sunny: "晴", cloudy: "多云", rainy: "雨", windy: "大风", foggy: "雾" };
  const currentNames = { calm: "无流", weak: "弱流", moderate: "中流", strong: "强流" };

  let elements = {};
  let marks = [];
  let dives = [];
  let pending = null;
  let currentEditId = null;
  let currentEditDiveId = null;
  let activeTab = "marks";

  function init(deps) {
    elements = {
      map: document.querySelector("#map"),
      form: document.querySelector("#form"),
      list: document.querySelector("#list"),
      filter: document.querySelector("#filter"),
      diveFilter: document.querySelector("#diveFilter"),
      view: document.querySelector("#view"),
      listTitle: document.querySelector("#listTitle"),
      exportBtn: document.querySelector("#exportBtn"),
      importBtn: document.querySelector("#importBtn"),
      deleteBtn: document.querySelector("#deleteBtn"),
      mapStats: document.querySelector("#mapStats"),
      tabs: document.querySelectorAll(".tab"),
      marksTab: document.querySelector("#marksTab"),
      divesTab: document.querySelector("#divesTab"),
      diveForm: document.querySelector("#diveForm"),
      diveList: document.querySelector("#diveList"),
      diveStats: document.querySelector("#diveStats"),
      diveDetail: document.querySelector("#diveDetail"),
      diveDetailContent: document.querySelector("#diveDetailContent"),
      deleteDiveBtn: document.querySelector("#deleteDiveBtn"),
    };

    marks = deps.marks;
    dives = deps.dives;
    pending = deps.pending;
    currentEditId = deps.currentEditId;

    initRibs();
    bindEvents(deps.callbacks);
    updateDiveSelect();
    updateDiveFilter();
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
      if (event.target !== elements.map) return;
      const rect = elements.map.getBoundingClientRect();
      pending = {
        x: Number(((event.clientX - rect.left) / rect.width * 100).toFixed(2)),
        y: Number(((event.clientY - rect.top) / rect.height * 100).toFixed(2)),
      };
      elements.form.reset();
      elements.form.id.value = "";
      currentEditId = null;
      elements.form.code.value = "M-" + String(marks.length + 1).padStart(3, "0");
      if (dives.length > 0) {
        elements.form.dive.value = dives[0].code;
      }
      render();
    });

    elements.form.onsubmit = (event) => {
      event.preventDefault();
      if (!pending) pending = { x: 50, y: 50 };
      const data = Object.fromEntries(new FormData(elements.form).entries());
      callbacks.onSaveMark(data, pending);
    };

    elements.diveForm.onsubmit = (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(elements.diveForm).entries());
      callbacks.onSaveDive(data);
    };

    elements.deleteBtn.onclick = () => {
      if (!elements.form.id.value) return;
      callbacks.onDeleteMark(elements.form.id.value);
    };

    elements.deleteDiveBtn.onclick = () => {
      if (!elements.diveForm.id.value) return;
      callbacks.onDeleteDive(elements.diveForm.id.value);
    };

    elements.exportBtn.onclick = () => {
      callbacks.onExport();
    };

    elements.importBtn.onclick = () => {
      callbacks.onImport();
    };

    elements.filter.onchange = render;
    elements.diveFilter.onchange = render;
    elements.view.onchange = render;

    elements.tabs.forEach(tab => {
      tab.onclick = () => {
        switchTab(tab.dataset.tab);
      };
    });
  }

  function switchTab(tab) {
    activeTab = tab;
    elements.tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    elements.marksTab.classList.toggle("hidden", tab !== "marks");
    elements.divesTab.classList.toggle("hidden", tab !== "dives");
    if (tab === "dives") {
      renderDives();
    } else {
      render();
    }
  }

  function updateDiveSelect() {
    const diveSelect = elements.form.querySelector('select[name="dive"]');
    diveSelect.innerHTML = '<option value="">请选择潜次</option>';
    dives.forEach(dive => {
      const option = document.createElement("option");
      option.value = dive.code;
      option.textContent = dive.code + " - " + dive.date;
      diveSelect.appendChild(option);
    });
  }

  function updateDiveFilter() {
    elements.diveFilter.innerHTML = '<option value="">全部潜次</option>';
    dives.forEach(dive => {
      const option = document.createElement("option");
      option.value = dive.code;
      option.textContent = dive.code + " - " + dive.date;
      elements.diveFilter.appendChild(option);
    });
  }

  function updateState(newMarks, newDives, newPending, newCurrentEditId) {
    marks = newMarks;
    dives = newDives;
    pending = newPending;
    currentEditId = newCurrentEditId;
    updateDiveSelect();
    updateDiveFilter();
    if (activeTab === "dives") {
      renderDives();
    } else {
      render();
    }
  }

  function render() {
    elements.map.querySelectorAll(".marker").forEach((el) => el.remove());

    let filtered = marks;
    if (elements.filter.value) {
      filtered = filtered.filter((m) => m.type === elements.filter.value);
    }
    if (elements.diveFilter.value) {
      filtered = filtered.filter((m) => m.dive === elements.diveFilter.value);
    }

    const totalVisible = filtered.length;
    const diveInfo = elements.diveFilter.value
      ? " · 潜次: " + elements.diveFilter.value
      : "";
    elements.mapStats.textContent = `显示 ${totalVisible} 个标记` + diveInfo;

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

    if (pending) {
      const pendingEl = document.createElement("button");
      pendingEl.className = "marker unknown selected";
      pendingEl.style.left = pending.x + "%";
      pendingEl.style.top = pending.y + "%";
      pendingEl.textContent = "?";
      pendingEl.onclick = (e) => e.stopPropagation();
      elements.map.appendChild(pendingEl);
    }

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

  function renderDives() {
    renderDiveStats();
    renderDiveList();
  }

  function renderDiveStats() {
    const totalDives = dives.length;
    const totalMarks = marks.length;
    const avgMarksPerDive = totalDives > 0 ? (totalMarks / totalDives).toFixed(1) : 0;

    const typeCounts = marks.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    }, {});

    let statsHtml = '<div class="stats-grid">';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + totalDives + '</div><div class="stat-label">潜次总数</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + totalMarks + '</div><div class="stat-label">标记总数</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + avgMarksPerDive + '</div><div class="stat-label">平均每潜次</div></div>';
    statsHtml += '<div class="stat-card"><div class="stat-value">' + Object.keys(typeCounts).length + '</div><div class="stat-label">类型数</div></div>';
    statsHtml += '</div>';

    elements.diveStats.innerHTML = statsHtml;
  }

  function renderDiveList() {
    elements.diveList.innerHTML = dives
      .map(
        (d) =>
          '<div class="dive-item ' +
          (d.id === currentEditDiveId ? "active" : "") +
          '" data-id="' +
          d.id +
          '"><div class="dive-item-header"><b>' +
          d.code +
          '</b> <span class="muted">' +
          d.date +
          '</span></div><div class="dive-item-info"><span class="pill">' +
          weatherNames[d.weather] +
          '</span> <span class="pill">' +
          currentNames[d.current] +
          '</span> <span class="muted">能见度: ' +
          d.visibility +
          '</span></div><div class="dive-item-meta"><span>负责人: ' +
          d.leader +
          '</span> <span class="muted">标记: ' +
          marks.filter(m => m.dive === d.code).length +
          '个</span></div><div class="dive-item-actions"><button type="button" class="secondary" data-action="edit" data-id="' +
          d.id +
          '">编辑</button><button type="button" class="secondary" data-action="detail" data-id="' +
          d.id +
          '">详情</button></div></div>'
      )
      .join("");

    elements.diveList.querySelectorAll("[data-action]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === "edit") {
          editDive(id);
        } else if (action === "detail") {
          showDiveDetail(id);
        }
      };
    });

    elements.diveList.querySelectorAll(".dive-item").forEach((el) => {
      el.onclick = (e) => {
        if (!e.target.closest("[data-action]")) {
          showDiveDetail(el.dataset.id);
        }
      };
    });
  }

  function showDiveDetail(id) {
    const dive = dives.find((d) => d.id === id);
    if (!dive) return;

    const diveMarks = marks.filter(m => m.dive === dive.code);

    let detailHtml = '<div class="detail-section">';
    detailHtml += '<h3>基本信息</h3>';
    detailHtml += '<div class="detail-grid">';
    detailHtml += '<div><span class="muted">潜次编号</span><div><b>' + dive.code + '</b></div></div>';
    detailHtml += '<div><span class="muted">下潜日期</span><div>' + dive.date + '</div></div>';
    detailHtml += '<div><span class="muted">负责人</span><div>' + dive.leader + '</div></div>';
    detailHtml += '<div><span class="muted">天气</span><div>' + weatherNames[dive.weather] + '</div></div>';
    detailHtml += '<div><span class="muted">水流</span><div>' + currentNames[dive.current] + '</div></div>';
    detailHtml += '<div><span class="muted">能见度</span><div>' + dive.visibility + '</div></div>';
    detailHtml += '</div>';
    detailHtml += '</div>';

    detailHtml += '<div class="detail-section">';
    detailHtml += '<h3>任务目标</h3>';
    detailHtml += '<div class="objective-text">' + dive.objective + '</div>';
    detailHtml += '</div>';

    detailHtml += '<div class="detail-section">';
    detailHtml += '<h3>关联标记 (' + diveMarks.length + '个)</h3>';
    if (diveMarks.length > 0) {
      detailHtml += '<div class="marks-in-dive">';
      diveMarks.forEach(m => {
        detailHtml += '<div class="mark-in-dive"><span class="pill ' + m.type + '">' + typeNames[m.type] + '</span> <b>' + m.code + '</b> · ' + m.depth + ' · ' + (m.condition || '');
        detailHtml += '</div>';
      });
      detailHtml += '</div>';
    } else {
      detailHtml += '<div class="muted">该潜次暂无关联标记</div>';
    }
    detailHtml += '</div>';

    elements.diveDetailContent.innerHTML = detailHtml;
    elements.diveDetail.classList.remove("hidden");
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

  function editDive(id) {
    const dive = dives.find((d) => d.id === id);
    if (!dive) return;
    for (const [key, value] of Object.entries(dive)) {
      if (elements.diveForm[key]) elements.diveForm[key].value = value;
    }
    currentEditDiveId = id;
    renderDives();
  }

  function resetForm() {
    elements.form.reset();
    elements.form.id.value = "";
    currentEditId = null;
    pending = null;
  }

  function resetDiveForm() {
    elements.diveForm.reset();
    elements.diveForm.id.value = "";
    currentEditDiveId = null;
    elements.diveDetail.classList.add("hidden");
  }

  function showImportPreview(comparison, onConfirm, onCancel) {
    const isFullFormat = comparison.isFullFormat;
    const markComparison = comparison.marks;
    const diveComparison = comparison.dives;

    const markResolutions = (markComparison?.conflicts || []).map(() => "keep");
    const diveResolutions = (diveComparison?.conflicts || []).map(() => "keep");

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal";

    let html = "<h2>导入预览</h2>";

    if (isFullFormat) {
      html += '<div class="summary-bar">';
      html += '<span class="pill">完整数据格式 (v' + comparison.version + ')</span>';
      html += "</div>";
    }

    if (diveComparison) {
      html += '<div class="preview-section">';
      html += '<h3>潜次档案</h3>';
      html += '<div class="summary-bar">';
      html += '<span class="pill">共 ' + diveComparison.summary.total + " 项</span>";
      html += '<span class="pill pill-new">新增 ' + diveComparison.summary.new + " 项</span>";
      html += '<span class="pill pill-conflict">冲突 ' + diveComparison.summary.conflict + " 项</span>";
      html += '<span class="pill pill-error">错误 ' + diveComparison.summary.error + " 项</span>";
      html += "</div>";

      if (diveComparison.newDives.length > 0) {
        html += '<div class="preview-list">';
        diveComparison.newDives.forEach((dive) => {
          html +=
            '<div class="preview-item"><span><b>' +
            dive.code +
            "</b> " +
            dive.date +
            ' · ' +
            dive.leader +
            " · " +
            weatherNames[dive.weather] +
            "</span><span class='pill pill-new'>新增</span></div>";
        });
        html += "</div>";
      }

      if (diveComparison.conflicts.length > 0) {
        html += '<div class="toolbar-3">';
        html += '<button type="button" class="secondary" data-bulk-dive="keep">全部保留本地</button>';
        html += '<button type="button" class="secondary" data-bulk-dive="overwrite">全部覆盖本地</button>';
        html += '<button type="button" class="secondary" data-bulk-dive="saveas">全部另存新编号</button>';
        html += "</div>";
        html += '<div class="preview-list">';
        diveComparison.conflicts.forEach((conflict, idx) => {
          html +=
            '<div class="preview-item" data-dive-conflict-index="' +
            idx +
            '"><span><b>' +
            conflict.imported.code +
            "</b> " +
            conflict.imported.date +
            ' · ' +
            conflict.imported.leader +
            "</span>";
          html += '<select data-dive-resolution-index="' + idx + '">';
          html += '<option value="keep">保留本地</option>';
          html += '<option value="overwrite">覆盖本地</option>';
          html += '<option value="saveas">另存为新编号</option>';
          html += "</select></div>";
        });
        html += "</div>";
      }

      if (diveComparison.errors.length > 0) {
        html += '<div class="preview-list">';
        diveComparison.errors.forEach((err) => {
          const code = err.dive && err.dive.code ? err.dive.code : "第 " + (err.index + 1) + " 项";
          html +=
            '<div class="preview-item"><span><b>' +
            code +
            "</b></span><span class='muted'>" +
            err.errors.join("; ") +
            "</span></div>";
        });
        html += "</div>";
      }
      html += "</div>";
    }

    if (markComparison) {
      html += '<div class="preview-section">';
      html += '<h3>标记数据</h3>';
      html += '<div class="summary-bar">';
      html += '<span class="pill">共 ' + markComparison.summary.total + " 项</span>";
      html += '<span class="pill pill-new">新增 ' + markComparison.summary.new + " 项</span>";
      html += '<span class="pill pill-conflict">冲突 ' + markComparison.summary.conflict + " 项</span>";
      html += '<span class="pill pill-error">错误 ' + markComparison.summary.error + " 项</span>";
      html += "</div>";

      if (markComparison.newMarks.length > 0) {
        html += '<div class="preview-list">';
        markComparison.newMarks.forEach((mark) => {
          html +=
            '<div class="preview-item"><span><b>' +
            mark.code +
            "</b> " +
            typeNames[mark.type] +
            ' · ' +
            mark.dive +
            " · " +
            mark.depth +
            "</span><span class='pill pill-new'>新增</span></div>";
        });
        html += "</div>";
      }

      if (markComparison.conflicts.length > 0) {
        html += '<div class="toolbar-3">';
        html += '<button type="button" class="secondary" data-bulk-mark="keep">全部保留本地</button>';
        html += '<button type="button" class="secondary" data-bulk-mark="overwrite">全部覆盖本地</button>';
        html += '<button type="button" class="secondary" data-bulk-mark="saveas">全部另存新编号</button>';
        html += "</div>";
        html += '<div class="preview-list">';
        markComparison.conflicts.forEach((conflict, idx) => {
          html +=
            '<div class="preview-item" data-mark-conflict-index="' +
            idx +
            '"><span><b>' +
            conflict.imported.code +
            "</b> " +
            typeNames[conflict.imported.type] +
            ' · ' +
            conflict.imported.dive +
            "</span>";
          html += '<select data-mark-resolution-index="' + idx + '">';
          html += '<option value="keep">保留本地</option>';
          html += '<option value="overwrite">覆盖本地</option>';
          html += '<option value="saveas">另存为新编号</option>';
          html += "</select></div>";
        });
        html += "</div>";
      }

      if (markComparison.errors.length > 0) {
        html += '<div class="preview-list">';
        markComparison.errors.forEach((err) => {
          const code = err.mark && err.mark.code ? err.mark.code : "第 " + (err.index + 1) + " 项";
          html +=
            '<div class="preview-item"><span><b>' +
            code +
            "</b></span><span class='muted'>" +
            err.errors.join("; ") +
            "</span></div>";
        });
        html += "</div>";
      }
      html += "</div>";
    }

    html += '<div class="toolbar">';
    html += '<button type="button" id="confirmImportBtn">确认导入</button>';
    html += '<button type="button" class="secondary" id="cancelImportBtn">取消</button>';
    html += "</div>";

    modal.innerHTML = html;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    modal.querySelectorAll("[data-mark-resolution-index]").forEach((select) => {
      select.onchange = (e) => {
        const idx = parseInt(e.target.dataset.markResolutionIndex);
        markResolutions[idx] = e.target.value;
      };
    });

    modal.querySelectorAll("[data-dive-resolution-index]").forEach((select) => {
      select.onchange = (e) => {
        const idx = parseInt(e.target.dataset.diveResolutionIndex);
        diveResolutions[idx] = e.target.value;
      };
    });

    modal.querySelectorAll("[data-bulk-mark]").forEach((btn) => {
      btn.onclick = (e) => {
        const action = e.target.dataset.bulkMark;
        (markComparison?.conflicts || []).forEach((_, idx) => {
          markResolutions[idx] = action;
          const select = modal.querySelector(
            '[data-mark-resolution-index="' + idx + '"]'
          );
          if (select) select.value = action;
        });
      };
    });

    modal.querySelectorAll("[data-bulk-dive]").forEach((btn) => {
      btn.onclick = (e) => {
        const action = e.target.dataset.bulkDive;
        (diveComparison?.conflicts || []).forEach((_, idx) => {
          diveResolutions[idx] = action;
          const select = modal.querySelector(
            '[data-dive-resolution-index="' + idx + '"]'
          );
          if (select) select.value = action;
        });
      };
    });

    modal.querySelector("#confirmImportBtn").onclick = () => {
      document.body.removeChild(backdrop);
      onConfirm({ markResolutions, diveResolutions });
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
    renderDives,
    edit,
    editDive,
    resetForm,
    resetDiveForm,
    showImportPreview,
    showToast,
    switchTab,
    typeNames,
    weatherNames,
    currentNames,
  };
})();
