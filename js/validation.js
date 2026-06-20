const Validation = (() => {
  const MARK_REQUIRED_FIELDS = ["code", "type", "dive", "depth"];
  const VALID_TYPES = ["ceramic", "wood", "metal", "unknown"];
  const DIVE_REQUIRED_FIELDS = ["code", "date", "leader", "visibility", "objective"];
  const VALID_WEATHER = ["sunny", "cloudy", "rainy", "windy", "foggy"];
  const VALID_CURRENT = ["calm", "weak", "moderate", "strong"];
  const MEASUREMENT_REQUIRED_FIELDS = ["code", "dive", "length", "points"];

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
            result[idx] = {
              ...conflict.imported,
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
          result.push({
            ...conflict.imported,
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
      result.push({
        ...mark,
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

  return {
    validateMark,
    validateMarkArray,
    validateDive,
    validateDiveArray,
    validateMeasurement,
    validateMeasurementArray,
    validateScale,
    validateGridConfig,
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
    VALID_TYPES,
    VALID_WEATHER,
    VALID_CURRENT,
    MARK_REQUIRED_FIELDS,
    DIVE_REQUIRED_FIELDS,
    MEASUREMENT_REQUIRED_FIELDS,
  };
})();
