const Validation = (() => {
  const REQUIRED_FIELDS = ["code", "type", "dive", "depth"];
  const VALID_TYPES = ["ceramic", "wood", "metal", "unknown"];

  function validateMark(mark, index) {
    const errors = [];

    if (typeof mark !== "object" || mark === null || Array.isArray(mark)) {
      return { valid: false, errors: [`第 ${index + 1} 项不是有效的对象`], mark };
    }

    for (const field of REQUIRED_FIELDS) {
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
      return { valid: false, error: "JSON 根节点必须是数组" };
    }

    const results = data.map((mark, index) => validateMark(mark, index));
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

  function resolveConflicts(localMarks, conflicts, resolutions) {
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

  return {
    validateMark,
    validateMarkArray,
    compareMarks,
    resolveConflicts,
    addNewMarks,
    generateNewCode,
    VALID_TYPES,
    REQUIRED_FIELDS,
  };
})();
