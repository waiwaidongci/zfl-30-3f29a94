const MultiAnalysis = (() => {
  const typeNames = { ceramic: "陶片", wood: "木构件", metal: "金属件", unknown: "未知物" };
  const reviewStatusNames = { collected: "采集", pending: "待复核", confirmed: "已确认", revisit: "需返潜" };
  const weatherNames = { sunny: "晴", cloudy: "多云", rainy: "雨", windy: "大风", foggy: "雾" };
  const currentNames = { calm: "无流", weak: "弱流", moderate: "中流", strong: "强流" };
  const priorityNames = { high: "高", medium: "中", low: "低" };

  function getDefaultSampling() {
    return { sampleNo: "", sampleMethod: "", sampler: "", sampleTime: "" };
  }

  function getDefaultReview() {
    return {
      status: "collected",
      comment: "",
      reviewer: "",
      reviewedAt: null,
      history: [{ status: "collected", at: new Date().toISOString(), comment: "", reviewer: "" }],
    };
  }

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
    if (x === undefined || y === undefined || x === null || y === null) return "未知区域";
    const col = x < 33 ? "艉" : (x < 66 ? "中" : "艏");
    const row = y < 33 ? "左舷" : (y < 66 ? "中部" : "右舷");
    return row + col;
  }

  function buildRevisitTaskKey(dive, type, depthRange, locationZone) {
    return `${dive || "未知"}|${type || "unknown"}|${depthRange || "未知"}|${locationZone || "未知区域"}`;
  }

  function hashKeyToStableId(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const chr = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return "rt-" + Math.abs(hash).toString(36);
  }

  function loadProjectSafely(projectId) {
    const rawMarks = ProjectManager.loadProjectData(projectId, "marks") || [];
    const rawDives = ProjectManager.loadProjectData(projectId, "dives") || [];
    const rawMeasurements = ProjectManager.loadProjectData(projectId, "measurements") || [];
    const rawScale = ProjectManager.loadProjectData(projectId, "scale");
    const rawGridConfig = ProjectManager.loadProjectData(projectId, "grid");
    const rawImportErrors = ProjectManager.loadProjectData(projectId, "importErrors") || [];
    const rawRevisitPlan = ProjectManager.loadProjectData(projectId, "revisitPlan") || [];
    const rawBaseMap = ProjectManager.loadProjectData(projectId, "baseMap");

    const hasScale = rawScale !== null && rawScale !== undefined && typeof rawScale === "object";
    const hasGrid = rawGridConfig !== null && rawGridConfig !== undefined && typeof rawGridConfig === "object";

    const safeMarks = rawMarks.map(m => {
      const mark = { ...m };
      if (!mark.sampling) mark.sampling = getDefaultSampling();
      else {
        if (mark.sampling.sampleNo === undefined) mark.sampling.sampleNo = "";
        if (mark.sampling.sampleMethod === undefined) mark.sampling.sampleMethod = "";
        if (mark.sampling.sampler === undefined) mark.sampling.sampler = "";
        if (mark.sampling.sampleTime === undefined) mark.sampling.sampleTime = "";
      }
      if (!mark.review) mark.review = getDefaultReview();
      else {
        if (!mark.review.status) mark.review.status = "collected";
        if (mark.review.comment === undefined) mark.review.comment = "";
        if (mark.review.reviewer === undefined) mark.review.reviewer = "";
        if (mark.review.reviewedAt === undefined) mark.review.reviewedAt = null;
        if (!mark.review.history || !Array.isArray(mark.review.history)) {
          mark.review.history = [{
            status: mark.review.status,
            at: mark.review.reviewedAt || new Date().toISOString(),
            comment: mark.review.comment,
            reviewer: mark.review.reviewer,
          }];
        }
      }
      if (!mark.attachments) mark.attachments = [];
      if (mark.x === undefined) mark.x = null;
      if (mark.y === undefined) mark.y = null;
      return mark;
    });

    const hasAttachments = safeMarks.some(m => m.attachments && m.attachments.length > 0);

    const safeDives = rawDives.map(d => {
      const dive = { ...d };
      if (!dive.participants || !Array.isArray(dive.participants)) {
        dive.participants = [];
      } else {
        dive.participants = dive.participants.map(p => ({
          name: p.name || "",
          role: p.role || "",
          equipment: p.equipment || "",
        }));
      }
      if (!dive.weather) dive.weather = "sunny";
      if (!dive.current) dive.current = "calm";
      return dive;
    });

    const safeMeasurements = rawMeasurements.map(m => {
      const meas = { ...m };
      if (!meas.points || !Array.isArray(meas.points)) meas.points = [];
      if (!meas.relatedMarks || !Array.isArray(meas.relatedMarks)) meas.relatedMarks = [];
      return meas;
    });

    const safeImportErrors = Array.isArray(rawImportErrors) ? rawImportErrors : [];
    const safeRevisitPlan = Array.isArray(rawRevisitPlan) ? rawRevisitPlan : [];

    return {
      marks: safeMarks,
      dives: safeDives,
      measurements: safeMeasurements,
      scale: hasScale ? rawScale : null,
      gridConfig: hasGrid ? rawGridConfig : null,
      baseMap: rawBaseMap || null,
      importErrors: safeImportErrors,
      revisitPlan: safeRevisitPlan,
      hasScale,
      hasGrid,
      hasAttachments,
      hasBaseMap: !!rawBaseMap,
      markCount: safeMarks.length,
      diveCount: safeDives.length,
      measurementCount: safeMeasurements.length,
      importErrorCount: safeImportErrors.length,
    };
  }

  function getProjectInfo(projectId) {
    const projects = ProjectManager.getAllProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) return null;
    return {
      id: project.id,
      name: project.name,
      archived: !!project.archived,
      createdAt: project.createdAt || null,
      updatedAt: project.updatedAt || null,
    };
  }

  function aggregateProjectData(projectIds) {
    const results = [];
    projectIds.forEach(pid => {
      const info = getProjectInfo(pid);
      if (!info) return;
      const data = loadProjectSafely(pid);
      results.push({ ...info, data });
    });
    return results;
  }

  function computeRevisitTasks(marks, revisitPlan) {
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
      const key = buildRevisitTaskKey(dive, type, depthRange, locationZone);
      const stableId = hashKeyToStableId(key);

      if (!groups.has(stableId)) {
        groups.set(stableId, {
          id: stableId,
          key,
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
      const group = groups.get(stableId);
      group.markIds.push(mark.id);
      group.marks.push({
        id: mark.id,
        code: mark.code,
        type: mark.type,
        depth: mark.depth,
        x: mark.x,
        y: mark.y,
        condition: mark.condition || "",
        note: mark.note || "",
        reviewStatus: mark.review?.status || "collected",
        reviewComment: mark.review?.comment || "",
      });
    });

    const result = [];
    groups.forEach(group => {
      const saved = (revisitPlan || []).find(p => p.id === group.id);
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

  function computeDiveEfficiency(project) {
    const { marks, dives, measurements } = project.data;
    const totalDives = dives.length;
    const totalMarks = marks.length;
    const totalMeasurements = measurements.length;
    const totalParticipants = dives.reduce((s, d) => s + (d.participants ? d.participants.length : 0), 0);

    const marksPerDive = totalDives > 0 ? (totalMarks / totalDives).toFixed(1) : "0.0";
    const measurementsPerDive = totalDives > 0 ? (totalMeasurements / totalDives).toFixed(1) : "0.0";
    const participantsPerDive = totalDives > 0 ? (totalParticipants / totalDives).toFixed(1) : "0.0";

    const diveDetails = dives.map(dive => {
      const diveMarks = marks.filter(m => m.dive === dive.code);
      const diveMeasurements = measurements.filter(m => m.dive === dive.code);
      return {
        code: dive.code,
        date: dive.date,
        leader: dive.leader,
        weather: dive.weather,
        markCount: diveMarks.length,
        measurementCount: diveMeasurements.length,
        participantCount: dive.participants ? dive.participants.length : 0,
      };
    });

    diveDetails.sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date);
      return a.code.localeCompare(b.code);
    });

    return {
      totalDives,
      totalMarks,
      totalMeasurements,
      totalParticipants,
      marksPerDive,
      measurementsPerDive,
      participantsPerDive,
      diveDetails,
    };
  }

  function computeImportErrorTrends(projects) {
    const allErrors = [];
    const byDate = {};
    const byProject = {};
    const byCategory = {};
    const bySource = {};

    projects.forEach(p => {
      const errors = p.data.importErrors || [];
      byProject[p.id] = {
        name: p.name,
        total: errors.length,
        byCategory: {},
        byDate: {},
      };

      errors.forEach(err => {
        const dateKey = (err.importedAt || "").split("T")[0] || "未知日期";
        const category = err.category || "marks";
        const source = err.source || "unknown";

        const entry = {
          date: dateKey,
          projectId: p.id,
          projectName: p.name,
          category,
          source,
          total: 1,
          error: err,
        };
        allErrors.push(entry);

        if (!byDate[dateKey]) byDate[dateKey] = { total: 0, byProject: {}, byCategory: {} };
        byDate[dateKey].total++;
        if (!byDate[dateKey].byProject[p.id]) byDate[dateKey].byProject[p.id] = 0;
        byDate[dateKey].byProject[p.id]++;
        if (!byDate[dateKey].byCategory[category]) byDate[dateKey].byCategory[category] = 0;
        byDate[dateKey].byCategory[category]++;

        if (!byProject[p.id].byCategory[category]) byProject[p.id].byCategory[category] = 0;
        byProject[p.id].byCategory[category]++;
        if (!byProject[p.id].byDate[dateKey]) byProject[p.id].byDate[dateKey] = 0;
        byProject[p.id].byDate[dateKey]++;

        if (!byCategory[category]) byCategory[category] = 0;
        byCategory[category]++;

        if (!bySource[source]) bySource[source] = 0;
        bySource[source]++;
      });
    });

    const timeline = Object.entries(byDate)
      .map(([date, info]) => ({ date, ...info }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalErrors: allErrors.length,
      timeline,
      byProject,
      byCategory,
      bySource,
    };
  }

  function computeDashboard(projects) {
    const totalMarks = projects.reduce((s, p) => s + p.data.marks.length, 0);
    const totalDives = projects.reduce((s, p) => s + p.data.dives.length, 0);
    const totalMeasurements = projects.reduce((s, p) => s + p.data.measurements.length, 0);
    const totalParticipants = projects.reduce((s, p) => {
      return s + p.data.dives.reduce((ds, d) => ds + (d.participants ? d.participants.length : 0), 0);
    }, 0);

    const typeCountsGlobal = {};
    Object.keys(typeNames).forEach(t => { typeCountsGlobal[t] = 0; });
    projects.forEach(p => {
      p.data.marks.forEach(m => {
        if (typeCountsGlobal[m.type] !== undefined) typeCountsGlobal[m.type]++;
        else typeCountsGlobal[m.type] = (typeCountsGlobal[m.type] || 0) + 1;
      });
    });

    const reviewCountsGlobal = {};
    Object.keys(reviewStatusNames).forEach(s => { reviewCountsGlobal[s] = 0; });
    projects.forEach(p => {
      p.data.marks.forEach(m => {
        const status = m.review?.status || "collected";
        if (reviewCountsGlobal[status] !== undefined) reviewCountsGlobal[status]++;
        else reviewCountsGlobal[status] = (reviewCountsGlobal[status] || 0) + 1;
      });
    });

    const conditionCountsGlobal = {};
    projects.forEach(p => {
      p.data.marks.forEach(m => {
        const c = m.condition?.trim() || "未填写";
        conditionCountsGlobal[c] = (conditionCountsGlobal[c] || 0) + 1;
      });
    });

    const pendingTotal = (reviewCountsGlobal.pending || 0) + (reviewCountsGlobal.revisit || 0);
    const backlogRate = totalMarks > 0 ? ((pendingTotal / totalMarks) * 100).toFixed(1) : "0.0";

    const perProject = projects.map(p => {
      const typeCounts = {};
      Object.keys(typeNames).forEach(t => { typeCounts[t] = 0; });
      p.data.marks.forEach(m => {
        if (typeCounts[m.type] !== undefined) typeCounts[m.type]++;
        else typeCounts[m.type] = 1;
      });

      const reviewCounts = {};
      Object.keys(reviewStatusNames).forEach(s => { reviewCounts[s] = 0; });
      p.data.marks.forEach(m => {
        const status = m.review?.status || "collected";
        if (reviewCounts[status] !== undefined) reviewCounts[status]++;
        else reviewCounts[status] = 1;
      });

      const conditionCounts = {};
      p.data.marks.forEach(m => {
        const c = m.condition?.trim() || "未填写";
        conditionCounts[c] = (conditionCounts[c] || 0) + 1;
      });

      const revisitMarks = p.data.marks.filter(m => {
        const status = m.review?.status || "collected";
        return status === "pending" || status === "revisit";
      });

      const backlog = (reviewCounts.pending || 0) + (reviewCounts.revisit || 0);
      const projectBacklogRate = p.data.marks.length > 0 ? ((backlog / p.data.marks.length) * 100).toFixed(1) : "0.0";

      const efficiency = computeDiveEfficiency(p);
      const revisitTasks = computeRevisitTasks(p.data.marks, p.data.revisitPlan);

      const importErrorsByDate = {};
      (p.data.importErrors || []).forEach(err => {
        const dateKey = (err.importedAt || "").split("T")[0] || "未知日期";
        if (!importErrorsByDate[dateKey]) importErrorsByDate[dateKey] = { total: 0, byCategory: {} };
        importErrorsByDate[dateKey].total++;
        const cat = err.category || "marks";
        importErrorsByDate[dateKey].byCategory[cat] = (importErrorsByDate[dateKey].byCategory[cat] || 0) + 1;
      });

      const heatmapMarks = p.data.marks.map(m => ({
        code: m.code,
        type: m.type,
        x: m.x,
        y: m.y,
        reviewStatus: m.review?.status || "collected",
        projectId: p.id,
        projectName: p.name,
      }));

      return {
        id: p.id,
        name: p.name,
        archived: p.archived,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        totalMarks: p.data.marks.length,
        totalDives: p.data.dives.length,
        totalMeasurements: p.data.measurements.length,
        totalParticipants: efficiency.totalParticipants,
        typeCounts,
        reviewCounts,
        conditionCounts,
        revisitMarkCount: revisitMarks.length,
        backlogRate: projectBacklogRate,
        marksPerDive: efficiency.marksPerDive,
        measurementsPerDive: efficiency.measurementsPerDive,
        participantsPerDive: efficiency.participantsPerDive,
        diveDetails: efficiency.diveDetails,
        importErrorsCount: p.data.importErrors.length,
        importErrorsByDate,
        heatmapMarks,
        hasScale: p.data.hasScale,
        hasGrid: p.data.hasGrid,
        hasAttachments: p.data.hasAttachments,
        hasBaseMap: p.data.hasBaseMap,
        revisitTasks,
        revisitHighlights: revisitMarks.slice(0, 20).map(m => ({
          code: m.code,
          type: m.type,
          dive: m.dive,
          depth: m.depth,
          condition: m.condition || "",
          note: m.note || "",
          reviewStatus: m.review?.status || "collected",
          reviewComment: m.review?.comment || "",
          x: m.x,
          y: m.y,
        })),
        scale: p.data.scale,
        gridConfig: p.data.gridConfig,
        baseMap: p.data.baseMap,
      };
    });

    const allHeatmapMarks = projects.flatMap(p =>
      p.data.marks.map(m => ({
        code: m.code,
        type: m.type,
        x: m.x,
        y: m.y,
        reviewStatus: m.review?.status || "collected",
        projectId: p.id,
        projectName: p.name,
      }))
    );

    const importErrorAnalysis = computeImportErrorTrends(projects);

    const compatibilityWarnings = [];
    perProject.forEach(pp => {
      if (!pp.hasScale) compatibilityWarnings.push({ projectName: pp.name, projectId: pp.id, field: "比例尺" });
      if (!pp.hasGrid) compatibilityWarnings.push({ projectName: pp.name, projectId: pp.id, field: "网格配置" });
      if (!pp.hasAttachments) compatibilityWarnings.push({ projectName: pp.name, projectId: pp.id, field: "附件" });
      if (!pp.hasBaseMap) compatibilityWarnings.push({ projectName: pp.name, projectId: pp.id, field: "底图" });
    });

    const allRevisitTasks = [];
    perProject.forEach(pp => {
      pp.revisitTasks.forEach(task => {
        allRevisitTasks.push({
          ...task,
          projectId: pp.id,
          projectName: pp.name,
        });
      });
    });
    allRevisitTasks.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return (a.dive || "").localeCompare(b.dive || "");
    });

    return {
      generatedAt: new Date().toISOString(),
      projectCount: projects.length,
      totalMarks,
      totalDives,
      totalMeasurements,
      totalParticipants,
      pendingTotal,
      backlogRate,
      typeCountsGlobal,
      reviewCountsGlobal,
      conditionCountsGlobal,
      perProject,
      allHeatmapMarks,
      importErrorAnalysis,
      importErrorsTimeline: importErrorAnalysis.timeline,
      compatibilityWarnings,
      allRevisitTasks,
      isReadOnly: true,
    };
  }

  return {
    aggregateProjectData,
    computeDashboard,
    loadProjectSafely,
    getProjectInfo,
    computeRevisitTasks,
    computeDiveEfficiency,
    computeImportErrorTrends,
    typeNames,
    reviewStatusNames,
    weatherNames,
    currentNames,
    priorityNames,
    getDepthRange,
    getLocationZone,
  };
})();
