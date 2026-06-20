const Report = (() => {
  const typeNames = { ceramic: "陶片", wood: "木构件", metal: "金属件", unknown: "未知物" };
  const weatherNames = { sunny: "晴", cloudy: "多云", rainy: "雨", windy: "大风", foggy: "雾" };
  const currentNames = { calm: "无流", weak: "弱流", moderate: "中流", strong: "强流" };
  const reviewStatusNames = { collected: "采集", pending: "待复核", confirmed: "已确认", revisit: "需返潜" };
  const priorityNames = { high: "高", medium: "中", low: "低" };

  function parseDepthValue(depthStr) {
    if (!depthStr) return 0;
    const match = String(depthStr).match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 0;
  }

  function getDepthRange(depthStr) {
    const val = parseDepthValue(depthStr);
    if (val <= 0) return "未知";
    if (val < 10) return "0-10米";
    if (val < 15) return "10-15米";
    if (val < 20) return "15-20米";
    if (val < 25) return "20-25米";
    if (val < 30) return "25-30米";
    return "30米以上";
  }

  function getLocationZone(x, y) {
    if (x === undefined || y === undefined) return "未知区域";
    const col = x < 33 ? "艉" : (x < 66 ? "中" : "艏");
    const row = y < 33 ? "左舷" : (y < 66 ? "中部" : "右舷");
    return row + col;
  }

  function aggregateRevisitTasks(marks, revisitPlan) {
    const targetMarks = marks.filter(m => {
      const status = m.review?.status || "collected";
      return status === "pending" || status === "revisit";
    });

    const groups = new Map();

    targetMarks.forEach(mark => {
      const dive = mark.dive || "未知";
      const type = mark.type || "unknown";
      const depthRange = getDepthRange(mark.depth);
      const locationZone = getLocationZone(mark.x, mark.y);
      const key = `${dive}|${type}|${depthRange}|${locationZone}`;

      if (!groups.has(key)) {
        groups.set(key, {
          dive,
          type,
          depthRange,
          locationZone,
          markIds: [],
          marks: [],
          priority: "medium",
          handlingMethod: "",
          notes: "",
        });
      }
      const group = groups.get(key);
      group.markIds.push(mark.id);
      group.marks.push({
        id: mark.id,
        code: mark.code,
        type: mark.type,
        depth: mark.depth,
        condition: mark.condition || "",
        note: mark.note || "",
        reviewStatus: mark.review?.status || "collected",
        reviewComment: mark.review?.comment || "",
      });
    });

    const result = [];
    groups.forEach(group => {
      const saved = (revisitPlan || []).find(p =>
        p.dive === group.dive &&
        p.type === group.type &&
        p.depthRange === group.depthRange &&
        p.locationZone === group.locationZone
      );
      if (saved) {
        result.push({
          ...group,
          priority: saved.priority || "medium",
          handlingMethod: saved.handlingMethod || "",
          notes: saved.notes || "",
        });
      } else {
        result.push(group);
      }
    });

    result.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return (a.dive || "").localeCompare(b.dive || "");
    });

    return result;
  }

  function aggregate(options) {
    const { marks, dives, measurements, scale, gridConfig, importErrors, baseMap, revisitPlan } = options;
    const scope = options.scope || "all";
    const scopeDive = options.scopeDive || "";

    let filteredMarks = marks;
    let filteredDives = dives;
    let filteredMeasurements = measurements || [];
    let revisitTasks = aggregateRevisitTasks(marks, revisitPlan || []);

    if (scope === "dive" && scopeDive) {
      filteredMarks = marks.filter(m => m.dive === scopeDive);
      filteredDives = dives.filter(d => d.code === scopeDive);
      filteredMeasurements = (measurements || []).filter(m => m.dive === scopeDive);
      revisitTasks = revisitTasks.filter(t => t.dive === scopeDive);
    } else if (scope === "type" && options.scopeType) {
      filteredMarks = marks.filter(m => m.type === options.scopeType);
      filteredDives = dives.filter(d =>
        filteredMarks.some(m => m.dive === d.code)
      );
      filteredMeasurements = (measurements || []).filter(m =>
        filteredDives.some(d => d.code === m.dive)
      );
      revisitTasks = revisitTasks.filter(t => t.type === options.scopeType);
    } else if (scope === "review" && options.scopeReview) {
      filteredMarks = marks.filter(m => (m.review?.status || "collected") === options.scopeReview);
      filteredDives = dives.filter(d =>
        filteredMarks.some(m => m.dive === d.code)
      );
      filteredMeasurements = (measurements || []).filter(m =>
        filteredDives.some(d => d.code === m.dive)
      );
    } else if (scope === "revisit") {
      filteredMarks = marks.filter(m => {
        const s = m.review?.status || "collected";
        return s === "pending" || s === "revisit";
      });
      filteredDives = dives.filter(d =>
        filteredMarks.some(m => m.dive === d.code)
      );
      filteredMeasurements = (measurements || []).filter(m =>
        filteredDives.some(d => d.code === m.dive)
      );
    }

    const typeCounts = {};
    Object.keys(typeNames).forEach(t => { typeCounts[t] = 0; });
    filteredMarks.forEach(m => {
      if (typeCounts[m.type] !== undefined) typeCounts[m.type]++;
      else typeCounts[m.type] = 1;
    });

    const reviewCounts = {};
    Object.keys(reviewStatusNames).forEach(s => { reviewCounts[s] = 0; });
    filteredMarks.forEach(m => {
      const s = m.review?.status || "collected";
      if (reviewCounts[s] !== undefined) reviewCounts[s]++;
      else reviewCounts[s] = 1;
    });

    const conditionCounts = {};
    filteredMarks.forEach(m => {
      const c = m.condition?.trim() || "未填写";
      conditionCounts[c] = (conditionCounts[c] || 0) + 1;
    });

    const diveTimeline = filteredDives.map(d => {
      const diveMarks = filteredMarks.filter(m => m.dive === d.code);
      return {
        code: d.code,
        date: d.date,
        leader: d.leader,
        weather: weatherNames[d.weather] || d.weather,
        current: currentNames[d.current] || d.current,
        visibility: d.visibility,
        objective: d.objective,
        participants: (d.participants || []).map(p => ({
          name: p.name || "",
          role: p.role || "",
          equipment: p.equipment || "",
        })),
        markCount: diveMarks.length,
        marks: diveMarks.map(m => ({
          code: m.code,
          type: typeNames[m.type] || m.type,
          typeKey: m.type,
          depth: m.depth,
          orientation: m.orientation || "",
          condition: m.condition || "",
          note: m.note || "",
          x: m.x,
          y: m.y,
          reviewStatus: reviewStatusNames[m.review?.status || "collected"],
          reviewStatusKey: m.review?.status || "collected",
          sampling: m.sampling || { sampleNo: "", sampleMethod: "", sampler: "", sampleTime: "" },
        })),
      };
    });

    const highlightMarks = filteredMarks.filter(m => {
      const s = m.review?.status || "collected";
      return s === "revisit" || s === "pending";
    }).map(m => ({
      code: m.code,
      type: typeNames[m.type] || m.type,
      typeKey: m.type,
      dive: m.dive,
      depth: m.depth,
      condition: m.condition || "",
      note: m.note || "",
      reviewStatus: reviewStatusNames[m.review?.status || "collected"],
      reviewStatusKey: m.review?.status || "collected",
      reviewComment: m.review?.comment || "",
      x: m.x,
      y: m.y,
      sampling: m.sampling || { sampleNo: "", sampleMethod: "", sampler: "", sampleTime: "" },
    }));

    const mapSnapshotMarks = filteredMarks.map(m => ({
      code: m.code,
      type: m.type,
      x: m.x,
      y: m.y,
      reviewStatus: m.review?.status || "collected",
    }));

    const normalizedImportErrors = (importErrors || []).map(err => ({
      source: err.source || "unknown",
      category: err.category || "marks",
      importedAt: err.importedAt || new Date().toISOString(),
      index: err.index,
      lineNumber: err.lineNumber || null,
      code: err.code || null,
      errors: err.errors || [],
    }));

    const importErrorsSummary = (() => {
      const bySource = {};
      const byCategory = {};
      let earliestAt = null;
      let latestAt = null;

      normalizedImportErrors.forEach(err => {
        bySource[err.source] = (bySource[err.source] || 0) + 1;
        byCategory[err.category] = (byCategory[err.category] || 0) + 1;
        if (!earliestAt || err.importedAt < earliestAt) earliestAt = err.importedAt;
        if (!latestAt || err.importedAt > latestAt) latestAt = err.importedAt;
      });

      return {
        total: normalizedImportErrors.length,
        bySource,
        byCategory,
        earliestAt,
        latestAt,
      };
    })();

    return {
      generatedAt: new Date().toISOString(),
      scope,
      scopeDive,
      scopeType: options.scopeType || "",
      scopeReview: options.scopeReview || "",
      totalMarks: filteredMarks.length,
      totalDives: filteredDives.length,
      totalMeasurements: filteredMeasurements.length,
      totalParticipants: filteredDives.reduce((sum, d) => sum + (d.participants ? d.participants.length : 0), 0),
      typeCounts,
      reviewCounts,
      conditionCounts,
      diveTimeline,
      highlightMarks,
      mapSnapshotMarks,
      importErrors: normalizedImportErrors,
      importErrorsSummary,
      revisitTasks,
      revisitTasksSummary: {
        totalTasks: revisitTasks.length,
        totalMarks: revisitTasks.reduce((sum, t) => sum + (t.marks ? t.marks.length : 0), 0),
        highPriority: revisitTasks.filter(t => t.priority === "high").length,
        byDive: (() => {
          const byDive = {};
          revisitTasks.forEach(t => {
            if (!byDive[t.dive]) byDive[t.dive] = { tasks: 0, marks: 0 };
            byDive[t.dive].tasks++;
            byDive[t.dive].marks += t.marks ? t.marks.length : 0;
          });
          return byDive;
        })(),
      },
      scale: scale ? {
        ratio: (scale.pixelDistance / scale.realDistance).toFixed(2),
        realDistance: scale.realDistance,
        pixelDistance: scale.pixelDistance.toFixed(0),
        unit: scale.unit,
      } : null,
      gridConfig: gridConfig || null,
      baseMap: baseMap || null,
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function generateMapSnapshotSVG(data) {
    const marks = data.mapSnapshotMarks || [];
    const baseMap = data.baseMap || null;
    const svgWidth = 400;
    const svgHeight = 300;

    const bgColor = "#0f5262";
    const wreckColor = "rgba(220,235,224,.55)";

    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + svgWidth + '" height="' + svgHeight + '" viewBox="0 0 100 75">';

    if (baseMap && baseMap.imageData) {
      svg += '<image href="' + baseMap.imageData + '" x="0" y="0" width="100" height="75" preserveAspectRatio="none"/>';
    } else {
      svg += '<rect width="100" height="75" fill="' + bgColor + '"/>';
      svg += '<ellipse cx="50" cy="32" rx="26" ry="11.5" fill="none" stroke="' + wreckColor + '" stroke-width="0.8" transform="rotate(-7 50 32)"/>';
    }

    const typeColors = { ceramic: "#b56c38", wood: "#6c4b2f", metal: "#6e7880", unknown: "#725ca6" };
    const statusBorders = { collected: "#2196f3", pending: "#ffc107", confirmed: "#4caf50", revisit: "#e91e63" };

    marks.forEach(m => {
      const adjustedY = (m.y / 100) * 75;
      const fillColor = typeColors[m.type] || "#725ca6";
      const borderColor = statusBorders[m.reviewStatus] || "#fff";
      svg += '<circle cx="' + m.x + '" cy="' + adjustedY + '" r="2.2" fill="' + fillColor + '" stroke="' + borderColor + '" stroke-width="0.6"/>';
    });

    svg += '</svg>';
    return svg;
  }

  function renderHTML(data) {
    const svg = generateMapSnapshotSVG(data);
    const generatedDate = new Date(data.generatedAt).toLocaleString("zh-CN");

    let html = '<div class="report-page">';

    html += '<div class="report-header">';
    html += '<h1>水下考古现场报告</h1>';
    html += '<div class="report-meta">生成时间：' + generatedDate + '</div>';

    const scopeLabels = { all: "全部数据", dive: "按潜次", type: "按类型", review: "按审核状态", revisit: "返潜计划" };
    html += '<div class="report-meta">报告范围：' + (scopeLabels[data.scope] || "全部数据");
    if (data.scope === "dive" && data.scopeDive) html += ' · ' + escapeHtml(data.scopeDive);
    if (data.scope === "type" && data.scopeType) html += ' · ' + (typeNames[data.scopeType] || data.scopeType);
    if (data.scope === "review" && data.scopeReview) html += ' · ' + (reviewStatusNames[data.scopeReview] || data.scopeReview);
    html += '</div>';
    html += '</div>';

    html += '<div class="report-summary">';
    html += '<div class="report-summary-cards">';
    html += '<div class="report-stat-card"><div class="report-stat-value">' + data.totalDives + '</div><div class="report-stat-label">潜次</div></div>';
    html += '<div class="report-stat-card"><div class="report-stat-value">' + data.totalMarks + '</div><div class="report-stat-label">标记</div></div>';
    html += '<div class="report-stat-card"><div class="report-stat-value">' + data.totalMeasurements + '</div><div class="report-stat-label">测距</div></div>';
    html += '<div class="report-stat-card"><div class="report-stat-value">' + data.totalParticipants + '</div><div class="report-stat-label">参与人次</div></div>';
    html += '<div class="report-stat-card"><div class="report-stat-value">' + data.highlightMarks.length + '</div><div class="report-stat-label">重点标记</div></div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="report-section">';
    html += '<h2>类型统计</h2>';
    html += '<table class="report-table"><thead><tr><th>类型</th><th>数量</th><th>占比</th></tr></thead><tbody>';
    Object.keys(typeNames).forEach(t => {
      const count = data.typeCounts[t] || 0;
      const pct = data.totalMarks > 0 ? ((count / data.totalMarks) * 100).toFixed(1) : "0.0";
      html += '<tr><td><span class="pill ' + t + '">' + typeNames[t] + '</span></td><td>' + count + '</td><td>' + pct + '%</td></tr>';
    });
    html += '</tbody></table>';
    html += '</div>';

    html += '<div class="report-section">';
    html += '<h2>审核状态统计</h2>';
    html += '<table class="report-table"><thead><tr><th>状态</th><th>数量</th><th>占比</th></tr></thead><tbody>';
    Object.keys(reviewStatusNames).forEach(s => {
      const count = data.reviewCounts[s] || 0;
      const pct = data.totalMarks > 0 ? ((count / data.totalMarks) * 100).toFixed(1) : "0.0";
      html += '<tr><td><span class="pill pill-review pill-review-' + s + '">' + reviewStatusNames[s] + '</span></td><td>' + count + '</td><td>' + pct + '%</td></tr>';
    });
    html += '</tbody></table>';
    html += '</div>';

    html += '<div class="report-section">';
    html += '<h2>沉船平面图概览</h2>';
    html += '<div class="report-map-overview">' + svg + '</div>';

    if (data.mapSnapshotMarks.length > 0) {
      html += '<div class="report-map-legend">';
      html += '<div class="report-legend-title">图例</div>';
      Object.keys(typeNames).forEach(t => {
        if ((data.typeCounts[t] || 0) > 0) {
          html += '<div class="report-legend-item"><span class="pill ' + t + '">' + typeNames[t] + '</span> ' + data.typeCounts[t] + '个</div>';
        }
      });
      html += '</div>';
    }
    html += '</div>';

    if (data.highlightMarks.length > 0) {
      html += '<div class="report-section">';
      html += '<h2>重点标记（待复核 / 需返潜）</h2>';
      html += '<table class="report-table"><thead><tr><th>编号</th><th>类型</th><th>潜次</th><th>深度</th><th>样品编号</th><th>采样方式</th><th>采样人</th><th>采样时间</th><th>状态</th><th>复核意见</th></tr></thead><tbody>';
      data.highlightMarks.forEach(m => {
        html += '<tr>';
        html += '<td>' + escapeHtml(m.code) + '</td>';
        html += '<td><span class="pill ' + m.typeKey + '">' + escapeHtml(m.type) + '</span></td>';
        html += '<td>' + escapeHtml(m.dive) + '</td>';
        html += '<td>' + escapeHtml(m.depth) + '</td>';
        html += '<td>' + escapeHtml(m.sampling?.sampleNo || "—") + '</td>';
        html += '<td>' + escapeHtml(m.sampling?.sampleMethod || "—") + '</td>';
        html += '<td>' + escapeHtml(m.sampling?.sampler || "—") + '</td>';
        html += '<td>' + escapeHtml(m.sampling?.sampleTime || "—") + '</td>';
        html += '<td><span class="pill pill-review pill-review-' + m.reviewStatusKey + '">' + escapeHtml(m.reviewStatus) + '</span></td>';
        html += '<td>' + escapeHtml(m.reviewComment || "—") + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += '</div>';
    }

    if (data.revisitTasks && data.revisitTasks.length > 0) {
      html += '<div class="report-section">';
      html += '<h2>返潜计划摘要</h2>';

      const summary = data.revisitTasksSummary || {};
      html += '<div class="report-summary-cards">';
      html += '<div class="report-stat-card"><div class="report-stat-value">' + (summary.totalTasks || 0) + '</div><div class="report-stat-label">任务组数</div></div>';
      html += '<div class="report-stat-card"><div class="report-stat-value">' + (summary.totalMarks || 0) + '</div><div class="report-stat-label">涉及标记</div></div>';
      html += '<div class="report-stat-card"><div class="report-stat-value">' + (summary.highPriority || 0) + '</div><div class="report-stat-label">高优先级</div></div>';
      html += '<div class="report-stat-card"><div class="report-stat-value">' + (summary.byDive ? Object.keys(summary.byDive).length : 0) + '</div><div class="report-stat-label">来源潜次</div></div>';
      html += '</div>';

      html += '<table class="report-table"><thead><tr><th>优先级</th><th>类型</th><th>深度范围</th><th>位置区域</th><th>来源潜次</th><th>标记数</th><th>预计处理方式</th><th>备注</th></tr></thead><tbody>';
      data.revisitTasks.forEach(task => {
        const typeLabel = typeNames[task.type] || task.type;
        const priorityLabel = priorityNames[task.priority] || task.priority;
        html += '<tr>';
        html += '<td><span class="pill pill-priority pill-priority-' + task.priority + '">' + priorityLabel + '</span></td>';
        html += '<td><span class="pill ' + task.type + '">' + escapeHtml(typeLabel) + '</span></td>';
        html += '<td>' + escapeHtml(task.depthRange) + '</td>';
        html += '<td>' + escapeHtml(task.locationZone) + '</td>';
        html += '<td>' + escapeHtml(task.dive) + '</td>';
        html += '<td>' + (task.marks ? task.marks.length : 0) + '</td>';
        html += '<td>' + escapeHtml(task.handlingMethod || "—") + '</td>';
        html += '<td>' + escapeHtml(task.notes || "—") + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';

      html += '<div class="revisit-task-details">';
      data.revisitTasks.forEach((task, idx) => {
        const typeLabel = typeNames[task.type] || task.type;
        const priorityLabel = priorityNames[task.priority] || task.priority;
        html += '<div class="revisit-task-detail-block">';
        html += '<h3>任务 ' + (idx + 1) + ': ' + escapeHtml(typeLabel) + ' · ' + escapeHtml(task.depthRange) + ' · ' + escapeHtml(task.locationZone) + '</h3>';
        html += '<div class="revisit-task-meta">';
        html += '<span class="pill pill-priority pill-priority-' + task.priority + '">' + priorityLabel + '优先级</span>';
        html += '<span class="muted">来源潜次: ' + escapeHtml(task.dive) + '</span>';
        html += '<span class="muted">标记数: ' + (task.marks ? task.marks.length : 0) + '</span>';
        if (task.handlingMethod) {
          html += '<span class="muted">处理方式: ' + escapeHtml(task.handlingMethod) + '</span>';
        }
        html += '</div>';
        if (task.notes) {
          html += '<div class="revisit-task-notes-text">备注: ' + escapeHtml(task.notes) + '</div>';
        }
        if (task.marks && task.marks.length > 0) {
          html += '<div class="revisit-task-marks-list">';
          html += '<div class="muted small" style="margin-bottom:6px;">包含标记:</div>';
          task.marks.forEach(m => {
            const statusLabel = reviewStatusNames[m.reviewStatus] || m.reviewStatus;
            html += '<div class="revisit-mark-row">';
            html += '<b>' + escapeHtml(m.code) + '</b>';
            html += '<span class="pill ' + m.type + ' small">' + escapeHtml(typeNames[m.type] || m.type) + '</span>';
            html += '<span class="pill pill-review pill-review-' + m.reviewStatus + ' small">' + statusLabel + '</span>';
            html += '<span class="muted small">深度: ' + escapeHtml(m.depth || "—") + '</span>';
            if (m.reviewComment) {
              html += '<span class="muted small">意见: ' + escapeHtml(m.reviewComment) + '</span>';
            }
            html += '</div>';
          });
          html += '</div>';
        }
        html += '</div>';
      });
      html += '</div>';

      html += '</div>';
    }

    if (data.diveTimeline.length > 0) {
      html += '<div class="report-section">';
      html += '<h2>潜次时间线</h2>';
      data.diveTimeline.forEach(dive => {
        html += '<div class="report-dive-block">';
        html += '<div class="report-dive-header">';
        html += '<h3>' + escapeHtml(dive.code) + '</h3>';
        html += '<span class="muted">' + dive.date + ' · ' + escapeHtml(dive.leader) + ' · ' + dive.weather + ' · ' + dive.current + ' · 能见度: ' + escapeHtml(dive.visibility) + '</span>';
        html += '</div>';
        html += '<div class="report-dive-objective">' + escapeHtml(dive.objective) + '</div>';

        if (dive.participants && dive.participants.length > 0) {
          html += '<div class="report-dive-participants">';
          html += '<div class="report-dive-participants-title">参与人员 (' + dive.participants.length + '人)</div>';
          html += '<table class="report-table"><thead><tr><th>姓名</th><th>岗位</th><th>使用设备</th></tr></thead><tbody>';
          dive.participants.forEach(p => {
            html += '<tr>';
            html += '<td>' + escapeHtml(p.name || "—") + '</td>';
            html += '<td>' + escapeHtml(p.role || "—") + '</td>';
            html += '<td>' + escapeHtml(p.equipment || "—") + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
          html += '</div>';
        }

        if (dive.marks.length > 0) {
          html += '<table class="report-table"><thead><tr><th>编号</th><th>类型</th><th>深度</th><th>朝向</th><th>保存状态</th><th>样品编号</th><th>采样方式</th><th>采样人</th><th>采样时间</th><th>审核状态</th></tr></thead><tbody>';
          dive.marks.forEach(m => {
            html += '<tr>';
            html += '<td>' + escapeHtml(m.code) + '</td>';
            html += '<td><span class="pill ' + m.typeKey + '">' + escapeHtml(m.type) + '</span></td>';
            html += '<td>' + escapeHtml(m.depth) + '</td>';
            html += '<td>' + escapeHtml(m.orientation || "—") + '</td>';
            html += '<td>' + escapeHtml(m.condition || "—") + '</td>';
            html += '<td>' + escapeHtml(m.sampling?.sampleNo || "—") + '</td>';
            html += '<td>' + escapeHtml(m.sampling?.sampleMethod || "—") + '</td>';
            html += '<td>' + escapeHtml(m.sampling?.sampler || "—") + '</td>';
            html += '<td>' + escapeHtml(m.sampling?.sampleTime || "—") + '</td>';
            html += '<td><span class="pill pill-review pill-review-' + m.reviewStatusKey + '">' + escapeHtml(m.reviewStatus) + '</span></td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
        } else {
          html += '<div class="muted">该潜次暂无标记</div>';
        }

        html += '</div>';
      });
      html += '</div>';
    }

    if (data.importErrors.length > 0) {
      html += '<div class="report-section">';
      html += '<h2>导入错误摘要</h2>';

      const summary = data.importErrorsSummary;
      const categoryLabels = { marks: "标记", dives: "潜次", measurements: "测距" };
      const sourceLabels = { json: "JSON 导入", csv: "CSV 导入", unknown: "其他" };

      html += '<div class="report-import-summary">';
      html += '<div class="report-meta">共 ' + summary.total + ' 条错误记录</div>';
      if (summary.earliestAt && summary.latestAt) {
        const fmtTime = (t) => new Date(t).toLocaleString("zh-CN");
        html += '<div class="report-meta">导入时间：' + fmtTime(summary.earliestAt);
        if (summary.earliestAt !== summary.latestAt) {
          html += ' 至 ' + fmtTime(summary.latestAt);
        }
        html += '</div>';
      }

      const srcKeys = Object.keys(summary.bySource);
      if (srcKeys.length > 0) {
        html += '<div class="report-meta">来源：' + srcKeys.map(k => (sourceLabels[k] || k) + ' ' + summary.bySource[k] + '条').join("，") + '</div>';
      }

      const catKeys = Object.keys(summary.byCategory);
      if (catKeys.length > 0) {
        html += '<div class="report-meta">分类：' + catKeys.map(k => (categoryLabels[k] || k) + ' ' + summary.byCategory[k] + '条').join("，") + '</div>';
      }
      html += '</div>';

      html += '<table class="report-table"><thead><tr><th>来源</th><th>分类</th><th>编号/行号</th><th>错误信息</th></tr></thead><tbody>';
      data.importErrors.forEach(err => {
        let label = "";
        if (err.code) {
          label = escapeHtml(err.code);
        } else if (err.lineNumber !== null && err.lineNumber !== undefined) {
          label = "第 " + err.lineNumber + " 行";
        } else {
          label = "第 " + (err.index + 1) + " 项";
        }
        html += '<tr>';
        html += '<td>' + escapeHtml(sourceLabels[err.source] || err.source) + '</td>';
        html += '<td>' + escapeHtml(categoryLabels[err.category] || err.category) + '</td>';
        html += '<td>' + label + '</td>';
        html += '<td>' + escapeHtml(err.errors.join("; ")) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += '</div>';
    }

    if (data.scale) {
      html += '<div class="report-section">';
      html += '<h2>比例尺信息</h2>';
      html += '<div class="report-scale-info">比例尺：' + data.scale.ratio + ' px/米（' + data.scale.realDistance + '米 = ' + data.scale.pixelDistance + 'px）</div>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  return {
    aggregate,
    renderHTML,
    generateMapSnapshotSVG,
    typeNames,
    weatherNames,
    currentNames,
    reviewStatusNames,
  };
})();
