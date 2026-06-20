const Validation = (() => {
  const MARK_REQUIRED_FIELDS = ["code", "type", "dive", "depth"];
  const VALID_TYPES = ["ceramic", "wood", "metal", "unknown"];
  const VALID_REVIEW_STATUSES = ["collected", "pending", "confirmed", "revisit"];
  const DIVE_REQUIRED_FIELDS = ["code", "date", "leader", "visibility", "objective"];
  const VALID_WEATHER = ["sunny", "cloudy", "rainy", "windy", "foggy"];
  const VALID_CURRENT = ["calm", "weak", "moderate", "strong"];
  const MEASUREMENT_REQUIRED_FIELDS = ["code", "dive", "length", "points"];
  const ATTACHMENT_REQUIRED_FIELDS = ["id", "name", "thumbnail"];
  const VALID_ANGLES = ["top", "side", "front", "back", "detail", "overview", "other"];

  function validateSampling(sampling, index) {
    const errors = [];

    if (sampling === undefined || sampling === null) {
      return { valid: true, errors, sampling };
    }

    if (typeof sampling !== "object" || Array.isArray(sampling)) {
      errors.push("sampling 必须是对象");
      return { valid: false, errors, sampling };
    }

    if (sampling.sampleNo !== undefined && typeof sampling.sampleNo !== "string") {
      errors.push("sampling.sampleNo 必须是字符串");
    }

    if (sampling.sampleMethod !== undefined && typeof sampling.sampleMethod !== "string") {
      errors.push("sampling.sampleMethod 必须是字符串");
    }

    if (sampling.sampler !== undefined && typeof sampling.sampler !== "string") {
      errors.push("sampling.sampler 必须是字符串");
    }

    if (sampling.sampleTime !== undefined && typeof sampling.sampleTime !== "string") {
      errors.push("sampling.sampleTime 必须是字符串");
    }

    return { valid: errors.length === 0, errors, sampling };
  }

  function validateReview(review, index) {
    const errors = [];

    if (review === undefined || review === null) {
      return { valid: true, errors, review };
    }

    if (typeof review !== "object" || Array.isArray(review)) {
      errors.push("review 必须是对象");
      return { valid: false, errors, review };
    }

    if (review.status && !VALID_REVIEW_STATUSES.includes(review.status)) {
      errors.push(`无效的审核状态: ${review.status}，有效值为: ${VALID_REVIEW_STATUSES.join(", ")}`);
    }

    if (review.comment !== undefined && typeof review.comment !== "string") {
      errors.push("review.comment 必须是字符串");
    }

    if (review.reviewer !== undefined && typeof review.reviewer !== "string") {
      errors.push("review.reviewer 必须是字符串");
    }

    if (review.reviewedAt !== undefined && review.reviewedAt !== null && typeof review.reviewedAt !== "string") {
      errors.push("review.reviewedAt 必须是字符串");
    }

    if (review.history !== undefined) {
      if (!Array.isArray(review.history)) {
        errors.push("review.history 必须是数组");
      } else {
        review.history.forEach((item, hIdx) => {
          if (typeof item !== "object" || item === null) {
            errors.push(`history 第 ${hIdx + 1} 项不是有效的对象`);
          } else {
            if (item.status && !VALID_REVIEW_STATUSES.includes(item.status)) {
              errors.push(`history 第 ${hIdx + 1} 项: 无效的状态 ${item.status}`);
            }
          }
        });
      }
    }

    return { valid: errors.length === 0, errors, review };
  }

  function validateMark(mark, index) {
    const errors = [];

    if (typeof mark !== "object" || mark === null || Array.isArray(mark)) {
      return { valid: false, errors: [`第 ${index + 1} 项不是有效的对象`], mark };
    }

    for (const field of MARK_REQUIRED_FIELDS) {
      if (!mark[field] || typeof mark[field] !== "string" || !mark[field].trim()) {
        errors.push(`缺少必填字段: ${field}`);
      }
    }

    if (mark.type && !VALID_TYPES.includes(mark.type)) {
      errors.push(`无效的类型: ${mark.type}，有效值为: ${VALID_TYPES.join(", ")}`);
    }

    if (mark.x !== undefined && (typeof mark.x !== "number" || mark.x < 0 || mark.x > 100)) {
      errors.push(`x 坐标必须是 0-100 之间的数字`);
    }

    if (mark.y !== undefined && (typeof mark.y !== "number" || mark.y < 0 || mark.y > 100)) {
      errors.push(`y 坐标必须是 0-100 之间的数字`);
    }

    if (mark.attachments !== undefined) {
      if (!Array.isArray(mark.attachments)) {
        errors.push("attachments 必须是数组");
      } else {
        mark.attachments.forEach((att, attIndex) => {
          const attResult = validateAttachment(att, attIndex);
          if (!attResult.valid) {
            errors.push(`附件 ${attIndex + 1}: ${attResult.errors.join("; ")}`);
          }
        });
      }
    }

    if (mark.review !== undefined) {
      const reviewResult = validateReview(mark.review, index);
      if (!reviewResult.valid) {
        errors.push(...reviewResult.errors.map((e) => `审核信息: ${e}`));
      }
    }

    if (mark.sampling !== undefined) {
      const samplingResult = validateSampling(mark.sampling, index);
      if (!samplingResult.valid) {
        errors.push(...samplingResult.errors.map((e) => `采样信息: ${e}`));
      }
    }

    if (DataIO && typeof DataIO.ensureReviewData === "function") {
      mark = DataIO.ensureReviewData(mark);
    }
    if (DataIO && typeof DataIO.ensureSamplingData === "function") {
      mark = DataIO.ensureSamplingData(mark);
    }

    return { valid: errors.length === 0, errors, mark };
  }

  function validateMarkArray(data) {
    if (!Array.isArray(data)) {
      return { valid: false, error: "标记数据必须是数组" };
    }

    const results = data.map((mark, index) => validateMark(mark, index));
    const valid = results.every(r => r.valid);

    return { valid, results, total: data.length };
  }

  function validateDive(dive, index) {
    const errors = [];

    if (typeof dive !== "object" || dive === null || Array.isArray(dive)) {
      return { valid: false, errors: [`第 ${index + 1} 项不是有效的对象`], dive };
    }

    for (const field of DIVE_REQUIRED_FIELDS) {
      if (!dive[field] || typeof dive[field] !== "string" || !dive[field].trim()) {
        errors.push(`缺少必填字段: ${field}`);
      }
    }

    if (dive.weather && !VALID_WEATHER.includes(dive.weather)) {
      errors.push(`无效的天气: ${dive.weather}，有效值为: ${VALID_WEATHER.join(", ")}`);
    }

    if (dive.current && !VALID_CURRENT.includes(dive.current)) {
      errors.push(`无效的水流: ${dive.current}，有效值为: ${VALID_CURRENT.join(", ")}`);
    }

    if (dive.date) {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(dive.date)) {
        errors.push(`日期格式无效: ${dive.date}，应为 YYYY-MM-DD 格式`);
      }
    }

    return { valid: errors.length === 0, errors, dive };
  }

  function validateDiveArray(data) {
    if (!Array.isArray(data)) {
      return { valid: false, error: "潜次数据必须是数组" };
    }

    const results = data.map((dive, index) => validateDive(dive, index));
    const valid = results.every(r => r.valid);

    return { valid, results, total: data.length };
  }

  function getReviewStatusDiff(localMark, importedMark) {
    const localStatus = localMark.review?.status || "collected";
    const importedStatus = importedMark.review?.status || "collected";
    const localComment = localMark.review?.comment || "";
    const importedComment = importedMark.review?.comment || "";
    const localReviewer = localMark.review?.reviewer || "";
    const importedReviewer = importedMark.review?.reviewer || "";

    return {
      statusChanged: localStatus !== importedStatus,
      localStatus,
      importedStatus,
      commentChanged: localComment !== importedComment,
      localComment,
      importedComment,
      reviewerChanged: localReviewer !== importedReviewer,
      localReviewer,
      importedReviewer,
    };
  }

  function compareMarks(localMarks, importedMarks) {
    const localByCode = new Map(localMarks.map(m => [m.code, m]));
    const newMarks = [];
    const conflicts = [];
    const errors = [];

    const validation = validateMarkArray(importedMarks);

    if (!validation.valid && validation.error) {
      return { newMarks, conflicts, errors: [validation.error], valid: false };
    }

    validation.results.forEach((result, index) => {
      if (!result.valid) {
        errors.push({
          index,
          mark: result.mark,
          errors: result.errors,
        });
        return;
      }

      const mark = result.mark;
      const localMark = localByCode.get(mark.code);

      if (localMark) {
        conflicts.push({
          local: localMark,
          imported: mark,
          resolution: "keep",
          reviewDiff: getReviewStatusDiff(localMark, mark),
        });
      } else {
        newMarks.push(mark);
      }
    });

    return {
      newMarks,
      conflicts,
      errors,
      valid: true,
      summary: {
        total: importedMarks.length,
        new: newMarks.length,
        conflict: conflicts.length,
        error: errors.length,
      },
    };
  }

  function compareDives(localDives, importedDives) {
    const localByCode = new Map(localDives.map(d => [d.code, d]));
    const newDives = [];
    const conflicts = [];
    const errors = [];

    const validation = validateDiveArray(importedDives);

    if (!validation.valid && validation.error) {
      return { newDives, conflicts, errors: [validation.error], valid: false };
    }

    validation.results.forEach((result, index) => {
      if (!result.valid) {
        errors.push({
          index,
          dive: result.dive,
          errors: result.errors,
        });
        return;
      }

      const dive = result.dive;
      const localDive = localByCode.get(dive.code);

      if (localDive) {
        conflicts.push({
          local: localDive,
          imported: dive,
          resolution: "keep",
        });
      } else {
        newDives.push(dive);
      }
    });

    return {
      newDives,
      conflicts,
      errors,
      valid: true,
      summary: {
        total: importedDives.length,
        new: newDives.length,
        conflict: conflicts.length,
        error: errors.length,
      },
    };
  }

  function generateNewCode(existingCodes, baseCode) {
    let counter = 1;
    let newCode;
    const base = baseCode.replace(/-\d+$/, "");
    do {
      newCode = `${base}-${String(counter).padStart(3, "0")}`;
      counter++;
    } while (existingCodes.has(newCode));
    return newCode;
  }

  function resolveMarkConflicts(localMarks, conflicts, resolutions) {
    const result = [...localMarks];
    const existingCodes = new Set(result.map(m => m.code));

    conflicts.forEach((conflict, index) => {
      const resolution = resolutions[index] || conflict.resolution;

      switch (resolution) {
        case "overwrite": {
          const idx = result.findIndex(m => m.code === conflict.local.code);
          if (idx !== -1) {
            const imported = DataIO && DataIO.ensureReviewData
              ? DataIO.ensureReviewData({ ...conflict.imported })
              : conflict.imported;
            result[idx] = {
              ...imported,
              id: conflict.local.id,
              x: conflict.imported.x ?? conflict.local.x,
              y: conflict.imported.y ?? conflict.local.y,
            };
          }
          break;
        }
        case "saveas": {
          const newCode = generateNewCode(existingCodes, conflict.imported.code);
          existingCodes.add(newCode);
          const imported = DataIO && DataIO.ensureReviewData
            ? DataIO.ensureReviewData({ ...conflict.imported })
            : conflict.imported;
          result.push({
            ...imported,
            id: crypto.randomUUID(),
            code: newCode,
            x: conflict.imported.x ?? 50,
            y: conflict.imported.y ?? 50,
          });
          break;
        }
        case "keep":
        default:
          break;
      }
    });

    return result;
  }

  function resolveDiveConflicts(localDives, conflicts, resolutions) {
    const result = [...localDives];
    const existingCodes = new Set(result.map(d => d.code));

    conflicts.forEach((conflict, index) => {
      const resolution = resolutions[index] || conflict.resolution;

      switch (resolution) {
        case "overwrite": {
          const idx = result.findIndex(d => d.code === conflict.local.code);
          if (idx !== -1) {
            result[idx] = {
              ...conflict.imported,
              id: conflict.local.id,
            };
          }
          break;
        }
        case "saveas": {
          const newCode = generateNewCode(existingCodes, conflict.imported.code);
          existingCodes.add(newCode);
          result.push({
            ...conflict.imported,
            id: crypto.randomUUID(),
            code: newCode,
          });
          break;
        }
        case "keep":
        default:
          break;
      }
    });

    return result;
  }

  function addNewMarks(localMarks, newMarks) {
    const result = [...localMarks];
    const existingCodes = new Set(result.map(m => m.code));

    newMarks.forEach(mark => {
      let code = mark.code;
      if (existingCodes.has(code)) {
        code = generateNewCode(existingCodes, code);
      }
      existingCodes.add(code);
      const processedMark = DataIO && DataIO.ensureReviewData
        ? DataIO.ensureReviewData({ ...mark })
        : mark;
      result.push({
        ...processedMark,
        id: crypto.randomUUID(),
        code,
        x: mark.x ?? 50,
        y: mark.y ?? 50,
      });
    });

    return result;
  }

  function addNewDives(localDives, newDives) {
    const result = [...localDives];
    const existingCodes = new Set(result.map(d => d.code));

    newDives.forEach(dive => {
      let code = dive.code;
      if (existingCodes.has(code)) {
        code = generateNewCode(existingCodes, code);
      }
      existingCodes.add(code);
      result.push({
        ...dive,
        id: crypto.randomUUID(),
        code,
      });
    });

    return result;
  }

  function validateMeasurement(measurement, index) {
    const errors = [];

    if (typeof measurement !== "object" || measurement === null || Array.isArray(measurement)) {
      return { valid: false, errors: [`第 ${index + 1} 项不是有效的对象`], measurement };
    }

    for (const field of MEASUREMENT_REQUIRED_FIELDS) {
      if (measurement[field] === undefined || measurement[field] === null || measurement[field] === "") {
        errors.push(`缺少必填字段: ${field}`);
      }
    }

    if (measurement.points) {
      if (!Array.isArray(measurement.points)) {
        errors.push("points 必须是数组");
      } else if (measurement.points.length < 2) {
        errors.push("points 至少需要2个点");
      } else {
        measurement.points.forEach((point, pIndex) => {
          if (typeof point !== "object" || point === null) {
            errors.push(`第 ${pIndex + 1} 个点格式无效`);
          } else {
            if (point.x !== undefined && (typeof point.x !== "number" || point.x < 0 || point.x > 100)) {
              errors.push(`第 ${pIndex + 1} 个点的 x 坐标必须是 0-100 之间的数字`);
            }
            if (point.y !== undefined && (typeof point.y !== "number" || point.y < 0 || point.y > 100)) {
              errors.push(`第 ${pIndex + 1} 个点的 y 坐标必须是 0-100 之间的数字`);
            }
          }
        });
      }
    }

    if (measurement.length !== undefined && (typeof measurement.length !== "number" || measurement.length <= 0)) {
      errors.push("长度必须是大于0的数字");
    }

    if (measurement.relatedMarks !== undefined && !Array.isArray(measurement.relatedMarks)) {
      errors.push("relatedMarks 必须是数组");
    }

    return { valid: errors.length === 0, errors, measurement };
  }

  function validateMeasurementArray(data) {
    if (!Array.isArray(data)) {
      return { valid: false, error: "测距数据必须是数组" };
    }

    const results = data.map((measurement, index) => validateMeasurement(measurement, index));
    const valid = results.every(r => r.valid);

    return { valid, results, total: data.length };
  }

  function validateScale(scale) {
    const errors = [];

    if (scale === null || scale === undefined) {
      return { valid: true, errors: [], scale };
    }

    if (typeof scale !== "object") {
      return { valid: false, errors: ["比例尺数据格式无效"], scale };
    }

    if (scale.pixelDistance === undefined || typeof scale.pixelDistance !== "number" || scale.pixelDistance <= 0) {
      errors.push("pixelDistance 必须是大于0的数字");
    }

    if (scale.realDistance === undefined || typeof scale.realDistance !== "number" || scale.realDistance <= 0) {
      errors.push("realDistance 必须是大于0的数字");
    }

    if (scale.unit && typeof scale.unit !== "string") {
      errors.push("unit 必须是字符串");
    }

    return { valid: errors.length === 0, errors, scale };
  }

  function validateGridConfig(config) {
    const errors = [];

    if (config === null || config === undefined) {
      return { valid: true, errors: [], config };
    }

    if (typeof config !== "object") {
      return { valid: false, errors: ["网格配置格式无效"], config };
    }

    if (config.enabled !== undefined && typeof config.enabled !== "boolean") {
      errors.push("enabled 必须是布尔值");
    }

    if (config.size !== undefined && (typeof config.size !== "number" || config.size <= 0)) {
      errors.push("size 必须是大于0的数字");
    }

    if (config.originX !== undefined && (typeof config.originX !== "number" || config.originX < 0 || config.originX > 100)) {
      errors.push("originX 必须是 0-100 之间的数字");
    }

    if (config.originY !== undefined && (typeof config.originY !== "number" || config.originY < 0 || config.originY > 100)) {
      errors.push("originY 必须是 0-100 之间的数字");
    }

    if (config.showLabels !== undefined && typeof config.showLabels !== "boolean") {
      errors.push("showLabels 必须是布尔值");
    }

    return { valid: errors.length === 0, errors, config };
  }

  function compareMeasurements(localMeasurements, importedMeasurements) {
    const localByCode = new Map(localMeasurements.map(m => [m.code, m]));
    const newMeasurements = [];
    const conflicts = [];
    const errors = [];

    const validation = validateMeasurementArray(importedMeasurements);

    if (!validation.valid && validation.error) {
      return { newMeasurements, conflicts, errors: [validation.error], valid: false };
    }

    validation.results.forEach((result, index) => {
      if (!result.valid) {
        errors.push({
          index,
          measurement: result.measurement,
          errors: result.errors,
        });
        return;
      }

      const measurement = result.measurement;
      const localMeasurement = localByCode.get(measurement.code);

      if (localMeasurement) {
        conflicts.push({
          local: localMeasurement,
          imported: measurement,
          resolution: "keep",
        });
      } else {
        newMeasurements.push(measurement);
      }
    });

    return {
      newMeasurements,
      conflicts,
      errors,
      valid: true,
      summary: {
        total: importedMeasurements.length,
        new: newMeasurements.length,
        conflict: conflicts.length,
        error: errors.length,
      },
    };
  }

  function resolveMeasurementConflicts(localMeasurements, conflicts, resolutions) {
    const result = [...localMeasurements];
    const existingCodes = new Set(result.map(m => m.code));

    conflicts.forEach((conflict, index) => {
      const resolution = resolutions[index] || conflict.resolution;

      switch (resolution) {
        case "overwrite": {
          const idx = result.findIndex(m => m.code === conflict.local.code);
          if (idx !== -1) {
            result[idx] = {
              ...conflict.imported,
              id: conflict.local.id,
            };
          }
          break;
        }
        case "saveas": {
          const newCode = generateNewCode(existingCodes, conflict.imported.code);
          existingCodes.add(newCode);
          result.push({
            ...conflict.imported,
            id: crypto.randomUUID(),
            code: newCode,
          });
          break;
        }
        case "keep":
        default:
          break;
      }
    });

    return result;
  }

  function addNewMeasurements(localMeasurements, newMeasurements) {
    const result = [...localMeasurements];
    const existingCodes = new Set(result.map(m => m.code));

    newMeasurements.forEach(measurement => {
      let code = measurement.code;
      if (existingCodes.has(code)) {
        code = generateNewCode(existingCodes, code);
      }
      existingCodes.add(code);
      result.push({
        ...measurement,
        id: crypto.randomUUID(),
        code,
      });
    });

    return result;
  }

  function validateAttachment(attachment, index) {
    const errors = [];

    if (typeof attachment !== "object" || attachment === null || Array.isArray(attachment)) {
      return { valid: false, errors: [`第 ${index + 1} 个附件不是有效的对象`], attachment };
    }

    for (const field of ATTACHMENT_REQUIRED_FIELDS) {
      if (!attachment[field] || typeof attachment[field] !== "string" || !attachment[field].trim()) {
        errors.push(`缺少必填字段: ${field}`);
      }
    }

    if (attachment.angle && typeof attachment.angle !== "string") {
      errors.push("angle 必须是字符串");
    }

    if (attachment.description !== undefined && typeof attachment.description !== "string") {
      errors.push("description 必须是字符串");
    }

    if (attachment.size !== undefined && typeof attachment.size !== "number") {
      errors.push("size 必须是数字");
    }

    if (attachment.thumbnail && typeof attachment.thumbnail === "string") {
      if (!attachment.thumbnail.startsWith("data:image/")) {
        errors.push("thumbnail 必须是有效的图片 data URL");
      }
    }

    if (attachment.fullImage && typeof attachment.fullImage === "string") {
      if (!attachment.fullImage.startsWith("data:image/")) {
        errors.push("fullImage 必须是有效的图片 data URL");
      }
    }

    return { valid: errors.length === 0, errors, attachment };
  }

  function validateAttachmentArray(attachments) {
    if (!Array.isArray(attachments)) {
      return { valid: false, error: "附件数据必须是数组" };
    }

    const results = attachments.map((att, index) => validateAttachment(att, index));
    const valid = results.every(r => r.valid);

    return { valid, results, total: attachments.length };
  }

  function validateCSVMarks(csvMarks, headers, mapping) {
    const results = [];
    const codeCounts = new Map();

    const requiredFields = ["code", "type", "dive", "depth"];
    const unmappedRequired = requiredFields.filter((f) => !mapping[f]);

    csvMarks.forEach((mark, index) => {
      const errors = [];
      const warnings = [];

      if (unmappedRequired.length > 0) {
        errors.push(
          "缺少必要列映射: " +
            unmappedRequired
              .map((f) => {
                const names = {
                  code: "编号",
                  type: "类型",
                  dive: "潜次",
                  depth: "深度",
                };
                return names[f] || f;
              })
              .join("、")
        );
      }

      const isEmpty = !mark.code && !mark.type && !mark.dive && !mark.depth && !mark.orientation && !mark.condition && !mark.note;
      if (isEmpty) {
        errors.push("空行，已跳过");
      } else {
        if (!mark.code || !mark.code.trim()) {
          errors.push("缺少编号");
        } else {
          const count = codeCounts.get(mark.code) || 0;
          codeCounts.set(mark.code, count + 1);
        }

        if (!mark.type || !mark.type.trim()) {
          errors.push("缺少类型");
        } else if (!VALID_TYPES.includes(mark.type)) {
          errors.push(`未知类型: ${mark.type}`);
        }

        if (!mark.dive || !mark.dive.trim()) {
          errors.push("缺少潜次");
        }

        if (!mark.depth || !mark.depth.trim()) {
          errors.push("缺少深度");
        }

        if (mark.x !== undefined && (mark.x < 0 || mark.x > 100)) {
          errors.push(`X坐标越界: ${mark.x} (需在0-100之间)`);
        }

        if (mark.y !== undefined && (mark.y < 0 || mark.y > 100)) {
          errors.push(`Y坐标越界: ${mark.y} (需在0-100之间)`);
        }
      }

      results.push({
        index,
        lineNumber: mark._csvLineNumber,
        mark,
        rawRow: mark._rawRow,
        errors,
        warnings,
        valid: errors.length === 0,
      });
    });

    results.forEach((result) => {
      if (result.mark.code && codeCounts.get(result.mark.code) > 1) {
        result.errors.push(`编号重复: ${result.mark.code} (CSV文件内出现 ${codeCounts.get(result.mark.code)} 次)`);
        result.valid = false;
      }
    });

    return {
      results,
      valid: results.every((r) => r.valid),
      summary: {
        total: results.length,
        valid: results.filter((r) => r.valid).length,
        invalid: results.filter((r) => !r.valid).length,
        empty: results.filter((r) => r.errors.includes("空行，已跳过")).length,
      },
    };
  }

  function compareCSVMarks(localMarks, csvParseResult) {
    const { marks, headers, mapping } = csvParseResult;
    const validation = validateCSVMarks(marks, headers, mapping);
    const localByCode = new Map(localMarks.map((m) => [m.code, m]));

    const validMarks = validation.results
      .filter((r) => r.valid)
      .map((r) => {
        const cleanMark = { ...r.mark };
        delete cleanMark._csvLineNumber;
        delete cleanMark._rawRow;
        return cleanMark;
      });

    const newMarks = [];
    const conflicts = [];
    const errors = validation.results
      .filter((r) => !r.valid)
      .map((r) => ({
        index: r.index,
        mark: r.mark,
        errors: r.errors,
        lineNumber: r.lineNumber,
        rawRow: r.rawRow,
      }));

    validMarks.forEach((mark) => {
      const localMark = localByCode.get(mark.code);
      if (localMark) {
        conflicts.push({
          local: localMark,
          imported: mark,
          resolution: "keep",
          reviewDiff: getReviewStatusDiff(localMark, mark),
        });
      } else {
        newMarks.push(mark);
      }
    });

    return {
      isCSV: true,
      headers,
      mapping,
      newMarks,
      conflicts,
      errors,
      valid: true,
      csvValidation: validation,
      summary: {
        total: marks.length,
        new: newMarks.length,
        conflict: conflicts.length,
        error: errors.length,
      },
    };
  }

  return {
    validateMark,
    validateMarkArray,
    validateReview,
    validateSampling,
    validateDive,
    validateDiveArray,
    validateMeasurement,
    validateMeasurementArray,
    validateScale,
    validateGridConfig,
    validateAttachment,
    validateAttachmentArray,
    compareMarks,
    compareDives,
    compareMeasurements,
    resolveMarkConflicts,
    resolveDiveConflicts,
    resolveMeasurementConflicts,
    addNewMarks,
    addNewDives,
    addNewMeasurements,
    generateNewCode,
    getReviewStatusDiff,
    validateCSVMarks,
    compareCSVMarks,
    VALID_TYPES,
    VALID_REVIEW_STATUSES,
    VALID_WEATHER,
    VALID_CURRENT,
    VALID_ANGLES,
    MARK_REQUIRED_FIELDS,
    DIVE_REQUIRED_FIELDS,
    MEASUREMENT_REQUIRED_FIELDS,
    ATTACHMENT_REQUIRED_FIELDS,
  };
})();
