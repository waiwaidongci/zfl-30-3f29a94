const Report = (() => {
  const typeNames = { ceramic: "陶片", wood: "木构件", metal: "金属件", unknown: "未知物" };
  const weatherNames = { sunny: "晴", cloudy: "多云", rainy: "雨", windy: "大风", foggy: "雾" };
  const currentNames = { calm: "无流", weak: "弱流", moderate: "中流", strong: "强流" };
  const reviewStatusNames = { collected: "采集", pending: "待复核", confirmed: "已确认", revisit: "需返潜" };

  function aggregate(options) {
    const { marks, dives, measurements, scale, gridConfig, importErrors } = options;
    const scope = options.scope || "all";
    const scopeDive = options.scopeDive || "";

    let filteredMarks = marks;
    let filteredDives = dives;
    let filteredMeasurements = measurements || [];

    if (scope === "dive" && scopeDive) {
      filteredMarks = marks.filter(m => m.dive === scopeDive);
      filteredDives = dives.filter(d => d.code === scopeDive);
      filteredMeasurements = (measurements || []).filter(m => m.dive === scopeDive);
    } else if (scope === "type" && options.scopeType) {
      filteredMarks = marks.filter(m => m.type === options.scopeType);
      filteredDives = dives.filter(d =>
        filteredMarks.some(m => m.dive === d.code)
      );
      filteredMeasurements = (measurements || []).filter(m =>
        filteredDives.some(d => d.code === m.dive)
      );
    } else if (scope === "review" && options.scopeReview) {
      filteredMarks = marks.filter(m => (m.review?.status || "collected") === options.scopeReview);
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
    }));

    const mapSnapshotMarks = filteredMarks.map(m => ({
      code: m.code,
      type: m.type,
      x: m.x,
      y: m.y,
      reviewStatus: m.review?.status || "collected",
    }));

    return {
      generatedAt: new Date().toISOString(),
      scope,
      scopeDive,
      scopeType: options.scopeType || "",
      scopeReview: options.scopeReview || "",
      totalMarks: filteredMarks.length,
      totalDives: filteredDives.length,
      totalMeasurements: filteredMeasurements.length,
      typeCounts,
      reviewCounts,
      conditionCounts,
      diveTimeline,
      highlightMarks,
      mapSnapshotMarks,
      importErrors: importErrors || [],
      scale: scale ? {
        ratio: (scale.pixelDistance / scale.realDistance).toFixed(2),
        realDistance: scale.realDistance,
        pixelDistance: scale.pixelDistance.toFixed(0),
        unit: scale.unit,
      } : null,
      gridConfig: gridConfig || null,
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
    const svgWidth = 400;
    const svgHeight = 300;

    const bgColor = "#0f5262";
    const wreckColor = "rgba(220,235,224,.55)";

    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + svgWidth + '" height="' + svgHeight + '" viewBox="0 0 100 75">';
    svg += '<rect width="100" height="75" fill="' + bgColor + '"/>';

    svg += '<ellipse cx="50" cy="32" rx="26" ry="11.5" fill="none" stroke="' + wreckColor + '" stroke-width="0.8" transform="rotate(-7 50 32)"/>';

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

    const scopeLabels = { all: "全部数据", dive: "按潜次", type: "按类型", review: "按审核状态" };
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
      html += '<table class="report-table"><thead><tr><th>编号</th><th>类型</th><th>潜次</th><th>深度</th><th>状态</th><th>复核意见</th></tr></thead><tbody>';
      data.highlightMarks.forEach(m => {
        html += '<tr>';
        html += '<td>' + escapeHtml(m.code) + '</td>';
        html += '<td><span class="pill ' + m.typeKey + '">' + escapeHtml(m.type) + '</span></td>';
        html += '<td>' + escapeHtml(m.dive) + '</td>';
        html += '<td>' + escapeHtml(m.depth) + '</td>';
        html += '<td><span class="pill pill-review pill-review-' + m.reviewStatusKey + '">' + escapeHtml(m.reviewStatus) + '</span></td>';
        html += '<td>' + escapeHtml(m.reviewComment || "—") + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
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

        if (dive.marks.length > 0) {
          html += '<table class="report-table"><thead><tr><th>编号</th><th>类型</th><th>深度</th><th>朝向</th><th>保存状态</th><th>审核状态</th></tr></thead><tbody>';
          dive.marks.forEach(m => {
            html += '<tr>';
            html += '<td>' + escapeHtml(m.code) + '</td>';
            html += '<td><span class="pill ' + m.typeKey + '">' + escapeHtml(m.type) + '</span></td>';
            html += '<td>' + escapeHtml(m.depth) + '</td>';
            html += '<td>' + escapeHtml(m.orientation || "—") + '</td>';
            html += '<td>' + escapeHtml(m.condition || "—") + '</td>';
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
      html += '<table class="report-table"><thead><tr><th>编号/行号</th><th>错误信息</th></tr></thead><tbody>';
      data.importErrors.forEach(err => {
        const label = err.code ? escapeHtml(err.code) : "第 " + (err.index + 1) + " 项";
        html += '<tr><td>' + label + '</td><td>' + escapeHtml(err.errors.join("; ")) + '</td></tr>';
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
