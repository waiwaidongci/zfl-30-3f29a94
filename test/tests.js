const TestRunner = (() => {
  const suites = [];
  let currentSuite = null;

  function describe(name, fn) {
    const suite = { name, tests: [], beforeFns: [], afterFns: [] };
    currentSuite = suite;
    suites.push(suite);
    fn();
    currentSuite = null;
  }

  function it(name, fn) {
    if (!currentSuite) throw new Error("it() must be called inside describe()");
    currentSuite.tests.push({ name, fn });
  }

  function formatValidationError(message, context) {
    let msg = message;
    if (context) {
      const parts = [];
      if (context.index !== undefined) parts.push("第 " + (context.index + 1) + " 条");
      if (context.lineNumber !== undefined) parts.push("CSV 第 " + context.lineNumber + " 行");
      if (context.code) parts.push("编号: " + context.code);
      if (parts.length > 0) msg += "\n  📍 " + parts.join(" | ");
      if (context.errors) {
        msg += "\n  ❌ 错误列表 (" + context.errors.length + " 条):\n    - " + context.errors.join("\n    - ");
      }
      if (context.data) {
        msg += "\n  📋 数据: " + JSON.stringify(context.data).substring(0, 300);
      }
    }
    return msg;
  }

  function expect(actual) {
    return {
      toBe(expected) {
        if (actual !== expected) {
          throw new Error("期望 " + JSON.stringify(expected) + "，实际 " + JSON.stringify(actual));
        }
      },
      toEqual(expected) {
        const a = JSON.stringify(actual);
        const e = JSON.stringify(expected);
        if (a !== e) {
          throw new Error("期望 " + e + "，实际 " + a);
        }
      },
      toBeTruthy() {
        if (!actual) {
          throw new Error("期望为真值，实际 " + JSON.stringify(actual));
        }
      },
      toBeFalsy() {
        if (actual) {
          throw new Error("期望为假值，实际 " + JSON.stringify(actual));
        }
      },
      toContain(item) {
        if (!Array.isArray(actual) && typeof actual !== "string") {
          throw new Error("被检查值不是数组或字符串: " + typeof actual);
        }
        if (!actual.includes(item)) {
          throw new Error("期望包含 " + JSON.stringify(item) + "，实际 " + JSON.stringify(actual));
        }
      },
      toBeGreaterThan(n) {
        if (typeof actual !== "number" || actual <= n) {
          throw new Error("期望大于 " + n + "，实际 " + actual);
        }
      },
      toBeLessThan(n) {
        if (typeof actual !== "number" || actual >= n) {
          throw new Error("期望小于 " + n + "，实际 " + actual);
        }
      },
      toHaveLength(n) {
        if (actual?.length !== n) {
          throw new Error("期望长度为 " + n + "，实际 " + (actual?.length));
        }
      },
      toBeArray() {
        if (!Array.isArray(actual)) {
          throw new Error("期望是数组，实际 " + typeof actual);
        }
      },
      toBeObject() {
        if (typeof actual !== "object" || actual === null || Array.isArray(actual)) {
          throw new Error("期望是对象，实际 " + (Array.isArray(actual) ? "array" : typeof actual));
        }
      },
      toBeType(type) {
        if (typeof actual !== type) {
          throw new Error("期望类型为 " + type + "，实际 " + typeof actual);
        }
      },
      toHaveProperty(prop) {
        if (actual === null || actual === undefined || !(prop in actual)) {
          throw new Error("期望有属性 " + prop + "，实际没有");
        }
      },
    };
  }

  function expectValidation(result, context) {
    return {
      toBeValid() {
        if (!result.valid) {
          throw new Error(formatValidationError("期望校验通过，但实际校验失败", { ...context, errors: result.errors }));
        }
      },
      toBeInvalid() {
        if (result.valid) {
          throw new Error(formatValidationError("期望校验失败，但实际校验通过", context));
        }
      },
      toHaveError(errorSubstring) {
        const hasError = result.errors.some(function(e) { return e.indexOf(errorSubstring) !== -1; });
        if (!hasError) {
          throw new Error(formatValidationError("期望错误包含 \"" + errorSubstring + "\"，但未找到", {
            ...context,
            errors: result.errors
          }));
        }
      },
      toHaveErrorCount(count) {
        if (result.errors.length !== count) {
          throw new Error(formatValidationError("期望有 " + count + " 条错误，实际有 " + result.errors.length + " 条", {
            ...context,
            errors: result.errors
          }));
        }
      },
    };
  }

  async function runAll() {
    const results = [];
    const startTime = performance.now();

    for (const suite of suites) {
      const suiteResult = { name: suite.name, tests: [], passed: 0, failed: 0 };
      for (const test of suite.tests) {
        try {
          await test.fn();
          suiteResult.tests.push({ name: test.name, passed: true, duration: 0 });
          suiteResult.passed++;
        } catch (err) {
          suiteResult.tests.push({ name: test.name, passed: false, error: err.message });
          suiteResult.failed++;
        }
      }
      results.push(suiteResult);
    }

    return {
      suites: results,
      total: results.reduce((s, r) => s + r.tests.length, 0),
      passed: results.reduce((s, r) => s + r.passed, 0),
      failed: results.reduce((s, r) => s + r.failed, 0),
      duration: performance.now() - startTime,
    };
  }

  return { describe, it, expect, expectValidation, runAll, suites, formatValidationError };
})();

const { describe, it, expect, expectValidation } = TestRunner;

const TEST_SAMPLE_CSV = `编号,类型,潜次,深度,X坐标,Y坐标,朝向,保存状态,备注
C-100,陶片,DIVE-01,18.5m,35,45,东,完整,测试陶片
W-200,木构件,DIVE-02,19.2m,60,50,西北,稳定,测试木构件
M-300,金属件,DIVE-01,17.8m,45,55,南,锈蚀严重,测试金属件
U-400,未知物,DIVE-02,20.1m,70,30,东北,待鉴定,测试未知物
C-100,陶片,DIVE-01,18.5m,35,45,东,完整,重复编号测试
,陶片,DIVE-01,18.5m,35,45,东,完整,缺少编号
C-999,未知类型,DIVE-01,18.5m,150,45,东,完整,类型错误+坐标越界`;

const TEST_MULTITYPE_CSV = `dataType,编号,类型,潜次,深度,X坐标,Y坐标,朝向,保存状态,备注,采样编号,采样方法,采样人,采样时间,日期,领队,天气,水流,能见度,任务目标,参与人员,长度,X1,Y1,X2,Y2,坐标点,关联标记
mark,C-100,陶片,DIVE-01,18.5m,35,45,东,完整,测试陶片,S-001,浮选法,张三,2024-01-15,,,,,,,,,,,,,,
mark,W-200,木构件,DIVE-02,19.2m,60,50,西北,稳定,测试木构件,,,,,,,,,,,,,,,,,,
mark,M-300,金属件,DIVE-01,17.8m,45,55,南,锈蚀严重,测试金属件,,,,,,,,,,,,,,,,,,
dive,DIVE-01,,,,,,,,,,,,,2024-01-15,张三,晴,缓流,5米,水下调查测绘,李四;王五;赵六,,,,,,,
dive,DIVE-02,,,,,,,,,,,,,2024-01-16,李四,多云,中流,4米,重点区域发掘,张三;钱七,,,,,,,
measurement,DIST-001,,DIVE-01,,,,,,,,,,,,,,,,,,12.5,35,45,60,50,,C-100;W-200
measurement,DIST-002,,DIVE-02,,,,,,,,,,,,,,,,,,8.3,60,50,45,55,60,50;45,55;70,30,M-300
mark,C-100,陶片,DIVE-01,18.5m,35,45,东,完整,重复编号测试,,,,,,,,,,,,,,,,,,
mark,,陶片,DIVE-01,18.5m,35,45,东,完整,缺少编号,,,,,,,,,,,,,,,,,,
mark,C-999,未知类型,DIVE-01,18.5m,150,45,东,完整,类型错误+坐标越界,,,,,,,,,,,,,,,,,,
dive,,,,,,,,,缺少编号测试,,,,,错误日期,李四,多云,中流,4米,测试,张三,,,,,,,
measurement,DIST-003,,DIVE-03,,,,,,坐标越界,,,,,,,,,,,,999.9,,,,,150,45;200,50,`;

describe("Validation.validateMark - 必填字段校验", () => {
  it("完整数据应校验通过", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
    expect(result.errors).toHaveLength(0);
  });

  it("缺少 code 应报错", () => {
    const mark = { type: "ceramic", dive: "DIVE-01", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("缺少必填字段: code");
  });

  it("code 为空字符串应报错", () => {
    const mark = { code: "", type: "ceramic", dive: "DIVE-01", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("缺少必填字段: code");
  });

  it("code 为空白字符串应报错", () => {
    const mark = { code: "   ", type: "ceramic", dive: "DIVE-01", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("缺少必填字段: code");
  });

  it("缺少 type 应报错", () => {
    const mark = { code: "C-001", dive: "DIVE-01", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("缺少必填字段: type");
  });

  it("缺少 dive 应报错", () => {
    const mark = { code: "C-001", type: "ceramic", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("缺少必填字段: dive");
  });

  it("缺少 depth 应报错", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("缺少必填字段: depth");
  });

  it("缺少多个必填字段应报多个错", () => {
    const mark = { code: "C-001" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it("null 标记应返回无效", () => {
    const result = Validation.validateMark(null, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("非对象标记应返回无效", () => {
    const result = Validation.validateMark("not an object", 0);
    expect(result.valid).toBeFalsy();
  });

  it("数组标记应返回无效", () => {
    const result = Validation.validateMark([], 0);
    expect(result.valid).toBeFalsy();
  });

  it("错误信息中包含第N项", () => {
    const result = Validation.validateMark(null, 3);
    expect(result.errors[0]).toContain("第 4 项");
  });
});

describe("Validation.validateMark - 类型校验", () => {
  it("有效类型 ceramic 应通过", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("有效类型 wood 应通过", () => {
    const mark = { code: "W-001", type: "wood", dive: "DIVE-01", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("有效类型 metal 应通过", () => {
    const mark = { code: "M-001", type: "metal", dive: "DIVE-01", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("有效类型 unknown 应通过", () => {
    const mark = { code: "U-001", type: "unknown", dive: "DIVE-01", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("无效类型应报错", () => {
    const mark = { code: "C-001", type: "invalid_type", dive: "DIVE-01", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("无效的类型: invalid_type，有效值为: ceramic, wood, metal, unknown");
  });

  it("空类型会被认为缺少必填字段", () => {
    const mark = { code: "C-001", type: "", dive: "DIVE-01", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("缺少必填字段: type");
  });
});

describe("Validation.validateMark - 坐标越界校验", () => {
  it("x=0 应通过（边界）", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m", x: 0 };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("x=100 应通过（边界）", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m", x: 100 };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("x=50 应通过", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m", x: 50 };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("x=-1 应报错（越下界）", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m", x: -1 };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("x 坐标必须是 0-100 之间的数字");
  });

  it("x=101 应报错（越上界）", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m", x: 101 };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("x 坐标必须是 0-100 之间的数字");
  });

  it("y=0 应通过（边界）", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m", y: 0 };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("y=100 应通过（边界）", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m", y: 100 };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("y=-10 应报错（越下界）", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m", y: -10 };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("y 坐标必须是 0-100 之间的数字");
  });

  it("y=150 应报错（越上界）", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m", y: 150 };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("y 坐标必须是 0-100 之间的数字");
  });

  it("x 为字符串应报错", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m", x: "50" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("x 坐标必须是 0-100 之间的数字");
  });

  it("没有坐标字段应通过", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("x 和 y 同时越界应报两个错", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m", x: -5, y: 200 };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    const xErr = result.errors.some(e => e.includes("x 坐标"));
    const yErr = result.errors.some(e => e.includes("y 坐标"));
    expect(xErr).toBeTruthy();
    expect(yErr).toBeTruthy();
  });
});

describe("Validation.validateMark - 审核信息校验", () => {
  it("没有 review 字段应通过", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("有效审核状态 collected 应通过", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      review: { status: "collected" }
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("有效审核状态 pending 应通过", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      review: { status: "pending" }
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("有效审核状态 confirmed 应通过", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      review: { status: "confirmed" }
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("有效审核状态 revisit 应通过", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      review: { status: "revisit" }
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("无效审核状态应报错", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      review: { status: "invalid_status" }
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    const hasStatusError = result.errors.some(e => e.includes("无效的审核状态"));
    expect(hasStatusError).toBeTruthy();
  });

  it("review.comment 为数字应报错", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      review: { comment: 123 }
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    const hasCommentError = result.errors.some(e => e.includes("comment") && e.includes("字符串"));
    expect(hasCommentError).toBeTruthy();
  });

  it("review.reviewer 为数字应报错", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      review: { reviewer: 123 }
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    const hasReviewerError = result.errors.some(e => e.includes("reviewer") && e.includes("字符串"));
    expect(hasReviewerError).toBeTruthy();
  });

  it("review 为数组应报错", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      review: []
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    const hasObjError = result.errors.some(e => e.includes("必须是对象"));
    expect(hasObjError).toBeTruthy();
  });

  it("完整审核信息应通过", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      review: {
        status: "confirmed",
        comment: "已确认，年代为明代",
        reviewer: "李教授",
        reviewedAt: "2024-01-15T10:00:00Z",
        history: [
          { status: "collected", at: "2024-01-10T08:00:00Z", comment: "", reviewer: "" },
          { status: "pending", at: "2024-01-12T09:00:00Z", comment: "待复核", reviewer: "王研究员" },
          { status: "confirmed", at: "2024-01-15T10:00:00Z", comment: "已确认，年代为明代", reviewer: "李教授" }
        ]
      }
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("错误信息带 '审核信息:' 前缀", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      review: { status: "bad" }
    };
    const result = Validation.validateMark(mark, 0);
    const prefixed = result.errors.some(e => e.startsWith("审核信息:"));
    expect(prefixed).toBeTruthy();
  });
});

describe("Validation.validateMark - 采样信息校验", () => {
  it("没有 sampling 字段应通过", () => {
    const mark = { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m" };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("完整采样信息应通过", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      sampling: {
        sampleNo: "S-001",
        sampleMethod: "浮选法",
        sampler: "张三",
        sampleTime: "2024-01-15"
      }
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });

  it("sampling.sampleNo 为数字应报错", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      sampling: { sampleNo: 123 }
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    const hasError = result.errors.some(e => e.includes("sampleNo") && e.includes("字符串"));
    expect(hasError).toBeTruthy();
  });

  it("sampling.sampleMethod 为数字应报错", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      sampling: { sampleMethod: 123 }
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    const hasError = result.errors.some(e => e.includes("sampleMethod") && e.includes("字符串"));
    expect(hasError).toBeTruthy();
  });

  it("sampling.sampler 为数字应报错", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      sampling: { sampler: 123 }
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    const hasError = result.errors.some(e => e.includes("sampler") && e.includes("字符串"));
    expect(hasError).toBeTruthy();
  });

  it("sampling.sampleTime 为数字应报错", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      sampling: { sampleTime: 20240115 }
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    const hasError = result.errors.some(e => e.includes("sampleTime") && e.includes("字符串"));
    expect(hasError).toBeTruthy();
  });

  it("sampling 为数组应报错", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      sampling: []
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeFalsy();
    const hasObjError = result.errors.some(e => e.includes("必须是对象"));
    expect(hasObjError).toBeTruthy();
  });

  it("错误信息带 '采样信息:' 前缀", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      sampling: { sampleNo: 123 }
    };
    const result = Validation.validateMark(mark, 0);
    const prefixed = result.errors.some(e => e.startsWith("采样信息:"));
    expect(prefixed).toBeTruthy();
  });

  it("空字符串采样字段应通过", () => {
    const mark = {
      code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m",
      sampling: {
        sampleNo: "",
        sampleMethod: "",
        sampler: "",
        sampleTime: ""
      }
    };
    const result = Validation.validateMark(mark, 0);
    expect(result.valid).toBeTruthy();
  });
});

describe("Validation.validateDive - 必填字段校验", () => {
  it("完整数据应校验通过", () => {
    const dive = {
      code: "DIVE-01", date: "2024-01-15", leader: "张三",
      visibility: "5米", objective: "水下调查"
    };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeTruthy();
  });

  it("缺少 code 应报错", () => {
    const dive = { date: "2024-01-15", leader: "张三", visibility: "5米", objective: "水下调查" };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("缺少必填字段: code");
  });

  it("code 为空字符串应报错", () => {
    const dive = {
      code: "", date: "2024-01-15", leader: "张三",
      visibility: "5米", objective: "水下调查"
    };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("缺少必填字段: code");
  });

  it("缺少 date 应报错", () => {
    const dive = { code: "DIVE-01", leader: "张三", visibility: "5米", objective: "水下调查" };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("缺少必填字段: date");
  });

  it("缺少 leader 应报错", () => {
    const dive = { code: "DIVE-01", date: "2024-01-15", visibility: "5米", objective: "水下调查" };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("缺少必填字段: leader");
  });

  it("缺少 visibility 应报错", () => {
    const dive = { code: "DIVE-01", date: "2024-01-15", leader: "张三", objective: "水下调查" };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("缺少必填字段: visibility");
  });

  it("缺少 objective 应报错", () => {
    const dive = { code: "DIVE-01", date: "2024-01-15", leader: "张三", visibility: "5米" };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("缺少必填字段: objective");
  });

  it("缺少多个必填字段应报多个错", () => {
    const dive = { code: "DIVE-01" };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it("null 潜次应返回无效", () => {
    const result = Validation.validateDive(null, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("非对象潜次应返回无效", () => {
    const result = Validation.validateDive("not an object", 0);
    expect(result.valid).toBeFalsy();
  });
});

describe("Validation.validateDive - 日期格式校验", () => {
  it("正确格式 YYYY-MM-DD 应通过", () => {
    const dive = {
      code: "DIVE-01", date: "2024-01-15", leader: "张三",
      visibility: "5米", objective: "水下调查"
    };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeTruthy();
  });

  it("日期格式错误应报错", () => {
    const dive = {
      code: "DIVE-01", date: "2024/01/15", leader: "张三",
      visibility: "5米", objective: "水下调查"
    };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("日期格式无效: 2024/01/15，应为 YYYY-MM-DD 格式");
  });

  it("日期为纯数字应报错", () => {
    const dive = {
      code: "DIVE-01", date: "20240115", leader: "张三",
      visibility: "5米", objective: "水下调查"
    };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeFalsy();
    const hasDateError = result.errors.some(e => e.includes("日期格式无效"));
    expect(hasDateError).toBeTruthy();
  });

  it("日期为中文应报错", () => {
    const dive = {
      code: "DIVE-01", date: "二〇二四年一月十五日", leader: "张三",
      visibility: "5米", objective: "水下调查"
    };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeFalsy();
    const hasDateError = result.errors.some(e => e.includes("日期格式无效"));
    expect(hasDateError).toBeTruthy();
  });
});

describe("Validation.validateDive - 天气与水流校验", () => {
  it("有效天气 sunny 应通过", () => {
    const dive = {
      code: "DIVE-01", date: "2024-01-15", leader: "张三",
      visibility: "5米", objective: "水下调查", weather: "sunny"
    };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeTruthy();
  });

  it("有效天气 cloudy 应通过", () => {
    const dive = {
      code: "DIVE-01", date: "2024-01-15", leader: "张三",
      visibility: "5米", objective: "水下调查", weather: "cloudy"
    };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeTruthy();
  });

  it("无效天气应报错", () => {
    const dive = {
      code: "DIVE-01", date: "2024-01-15", leader: "张三",
      visibility: "5米", objective: "水下调查", weather: "hailing"
    };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("无效的天气: hailing，有效值为: sunny, cloudy, rainy, windy, foggy");
  });

  it("有效水流 calm 应通过", () => {
    const dive = {
      code: "DIVE-01", date: "2024-01-15", leader: "张三",
      visibility: "5米", objective: "水下调查", current: "calm"
    };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeTruthy();
  });

  it("有效水流 strong 应通过", () => {
    const dive = {
      code: "DIVE-01", date: "2024-01-15", leader: "张三",
      visibility: "5米", objective: "水下调查", current: "strong"
    };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeTruthy();
  });

  it("无效水流应报错", () => {
    const dive = {
      code: "DIVE-01", date: "2024-01-15", leader: "张三",
      visibility: "5米", objective: "水下调查", current: "turbulent"
    };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeFalsy();
    expect(result.errors).toContain("无效的水流: turbulent，有效值为: calm, weak, moderate, strong");
  });

  it("没有天气和水流字段应通过", () => {
    const dive = {
      code: "DIVE-01", date: "2024-01-15", leader: "张三",
      visibility: "5米", objective: "水下调查"
    };
    const result = Validation.validateDive(dive, 0);
    expect(result.valid).toBeTruthy();
  });
});

describe("DataIO.parseCSV - CSV 解析", () => {
  it("能正确解析 test-sample.csv 格式", () => {
    const result = DataIO.parseCSV(TEST_SAMPLE_CSV);
    expect(result.success).toBeTruthy();
    expect(result.headers.length).toBe(9);
    expect(result.rows.length).toBe(7);
  });

  it("能正确解析表头", () => {
    const result = DataIO.parseCSV(TEST_SAMPLE_CSV);
    expect(result.headers[0]).toBe("编号");
    expect(result.headers[1]).toBe("类型");
    expect(result.headers[2]).toBe("潜次");
    expect(result.headers[3]).toBe("深度");
  });

  it("能正确解析第一行数据", () => {
    const result = DataIO.parseCSV(TEST_SAMPLE_CSV);
    const row = result.rows[0];
    expect(row["编号"]).toBe("C-100");
    expect(row["类型"]).toBe("陶片");
    expect(row["潜次"]).toBe("DIVE-01");
    expect(row["深度"]).toBe("18.5m");
  });

  it("能正确解析 test-multitype.csv 格式", () => {
    const result = DataIO.parseCSV(TEST_MULTITYPE_CSV);
    expect(result.success).toBeTruthy();
    expect(result.headers.length).toBe(28);
    expect(result.rows.length).toBe(12);
  });

  it("空CSV应返回失败", () => {
    const result = DataIO.parseCSV("");
    expect(result.success).toBeFalsy();
  });

  it("只有表头的CSV应返回空数据", () => {
    const result = DataIO.parseCSV("编号,类型,深度\n");
    expect(result.success).toBeTruthy();
    expect(result.rows.length).toBe(0);
  });
});

describe("DataIO.parseCSVToMultiType - 多类型CSV解析", () => {
  it("能正确识别 mark、dive、measurement 三种类型", () => {
    const result = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    expect(result.success).toBeTruthy();
    expect(result.marks.length).toBe(6);
    expect(result.dives.length).toBe(3);
    expect(result.measurements.length).toBe(3);
  });

  it("标记数据包含采样信息", () => {
    const result = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    const mark = result.marks[0];
    expect(mark.code).toBe("C-100");
    expect(mark.sampling).toBeObject();
    expect(mark.sampling.sampleNo).toBe("S-001");
    expect(mark.sampling.sampleMethod).toBe("浮选法");
    expect(mark.sampling.sampler).toBe("张三");
    expect(mark.sampling.sampleTime).toBe("2024-01-15");
  });

  it("类型映射正确 - 陶片→ceramic", () => {
    const result = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    expect(result.marks[0].type).toBe("ceramic");
  });

  it("类型映射正确 - 木构件→wood", () => {
    const result = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    expect(result.marks[1].type).toBe("wood");
  });

  it("类型映射正确 - 金属件→metal", () => {
    const result = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    expect(result.marks[2].type).toBe("metal");
  });

  it("潜次数据解析正确", () => {
    const result = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    const dive = result.dives[0];
    expect(dive.code).toBe("DIVE-01");
    expect(dive.date).toBe("2024-01-15");
    expect(dive.leader).toBe("张三");
    expect(dive.weather).toBe("sunny");
    expect(dive.current).toBe("weak");
    expect(dive.visibility).toBe("5米");
    expect(dive.objective).toBe("水下调查测绘");
  });

  it("潜次参与人员解析正确", () => {
    const result = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    const dive = result.dives[0];
    expect(dive.participants).toBeArray();
    expect(dive.participants.length).toBe(3);
    expect(dive.participants[0].name).toBe("李四");
    expect(dive.participants[1].name).toBe("王五");
    expect(dive.participants[2].name).toBe("赵六");
  });

  it("测距数据解析正确", () => {
    const result = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    const meas = result.measurements[0];
    expect(meas.code).toBe("DIST-001");
    expect(meas.dive).toBe("DIVE-01");
    expect(meas.length).toBe(12.5);
    expect(meas.points.length).toBe(2);
    expect(meas.points[0].x).toBe(35);
    expect(meas.points[0].y).toBe(45);
    expect(meas.points[1].x).toBe(60);
    expect(meas.points[1].y).toBe(50);
  });

  it("关联标记解析正确", () => {
    const result = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    const meas = result.measurements[0];
    expect(meas.relatedMarks).toBeArray();
    expect(meas.relatedMarks).toContain("C-100");
    expect(meas.relatedMarks).toContain("W-200");
  });

  it("每一行都有 _csvLineNumber", () => {
    const result = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    result.marks.forEach(m => expect(m._csvLineNumber).toBeGreaterThan(1));
    result.dives.forEach(d => expect(d._csvLineNumber).toBeGreaterThan(1));
    result.measurements.forEach(m => expect(m._csvLineNumber).toBeGreaterThan(1));
  });

  it("每一行都有 _rawRow", () => {
    const result = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    result.marks.forEach(m => expect(m._rawRow).toBeObject());
  });
});

describe("DataIO.detectColumnMapping - 列映射检测", () => {
  it("能从中文表头检测出正确映射", () => {
    const headers = ["编号", "类型", "潜次", "深度", "X坐标", "Y坐标"];
    const mapping = DataIO.detectColumnMapping(headers);
    expect(mapping.code).toBe("编号");
    expect(mapping.type).toBe("类型");
    expect(mapping.dive).toBe("潜次");
    expect(mapping.depth).toBe("深度");
    expect(mapping.x).toBe("X坐标");
    expect(mapping.y).toBe("Y坐标");
  });

  it("能从英文表头检测出正确映射", () => {
    const headers = ["code", "type", "dive", "depth", "x", "y"];
    const mapping = DataIO.detectColumnMapping(headers);
    expect(mapping.code).toBe("code");
    expect(mapping.type).toBe("type");
    expect(mapping.dive).toBe("dive");
    expect(mapping.depth).toBe("depth");
    expect(mapping.x).toBe("x");
    expect(mapping.y).toBe("y");
  });

  it("混合表头也能检测", () => {
    const headers = ["编号", "type", "潜次编号", "深度m", "x坐标", "y坐标"];
    const mapping = DataIO.detectColumnMapping(headers);
    expect(mapping.code).toBe("编号");
    expect(mapping.type).toBe("type");
    expect(mapping.dive).toBe("潜次编号");
    expect(mapping.depth).toBe("深度m");
  });
});

describe("DataIO.mapType - 类型映射", () => {
  it("陶片 → ceramic", () => {
    expect(DataIO.mapType("陶片")).toBe("ceramic");
  });

  it("陶瓷 → ceramic", () => {
    expect(DataIO.mapType("陶瓷")).toBe("ceramic");
  });

  it("木构件 → wood", () => {
    expect(DataIO.mapType("木构件")).toBe("wood");
  });

  it("金属件 → metal", () => {
    expect(DataIO.mapType("金属件")).toBe("metal");
  });

  it("未知物 → unknown", () => {
    expect(DataIO.mapType("未知物")).toBe("unknown");
  });

  it("ceramic → ceramic (英文原值)", () => {
    expect(DataIO.mapType("ceramic")).toBe("ceramic");
  });

  it("空值 → unknown", () => {
    expect(DataIO.mapType("")).toBe("unknown");
  });

  it("未映射类型保持原值", () => {
    expect(DataIO.mapType("玉石")).toBe("玉石");
  });
});

describe("Validation.validateCSVMarks - CSV标记校验", () => {
  it("test-sample.csv 校验结果统计正确", () => {
    const parsed = DataIO.parseCSVToMarks(TEST_SAMPLE_CSV);
    const mapping = DataIO.detectColumnMapping(parsed.headers);
    const result = Validation.validateCSVMarks(parsed.marks, parsed.headers, mapping);
    expect(result.summary.total).toBe(7);
    expect(result.summary.invalid).toBeGreaterThan(0);
  });

  it("缺少编号的记录应被检出", () => {
    const parsed = DataIO.parseCSVToMarks(TEST_SAMPLE_CSV);
    const mapping = DataIO.detectColumnMapping(parsed.headers);
    const result = Validation.validateCSVMarks(parsed.marks, parsed.headers, mapping);
    const missingCode = result.results.filter(r => r.errors.includes("缺少编号"));
    expect(missingCode.length).toBeGreaterThan(0);
  });

  it("类型错误的记录应被检出", () => {
    const parsed = DataIO.parseCSVToMarks(TEST_SAMPLE_CSV);
    const mapping = DataIO.detectColumnMapping(parsed.headers);
    const result = Validation.validateCSVMarks(parsed.marks, parsed.headers, mapping);
    const badType = result.results.filter(r =>
      r.errors.some(e => e.startsWith("未知类型:"))
    );
    expect(badType.length).toBeGreaterThan(0);
  });

  it("X坐标越界的记录应被检出", () => {
    const parsed = DataIO.parseCSVToMarks(TEST_SAMPLE_CSV);
    const mapping = DataIO.detectColumnMapping(parsed.headers);
    const result = Validation.validateCSVMarks(parsed.marks, parsed.headers, mapping);
    const xOutOfRange = result.results.filter(r =>
      r.errors.some(e => e.includes("X坐标越界"))
    );
    expect(xOutOfRange.length).toBeGreaterThan(0);
  });

  it("编号重复的记录应被检出", () => {
    const parsed = DataIO.parseCSVToMarks(TEST_SAMPLE_CSV);
    const mapping = DataIO.detectColumnMapping(parsed.headers);
    const result = Validation.validateCSVMarks(parsed.marks, parsed.headers, mapping);
    const duplicates = result.results.filter(r =>
      r.errors.some(e => e.startsWith("编号重复:"))
    );
    expect(duplicates.length).toBeGreaterThan(0);
  });

  it("错误记录包含行号信息", () => {
    const parsed = DataIO.parseCSVToMarks(TEST_SAMPLE_CSV);
    const mapping = DataIO.detectColumnMapping(parsed.headers);
    const result = Validation.validateCSVMarks(parsed.marks, parsed.headers, mapping);
    const invalid = result.results.find(r => !r.valid);
    expect(invalid.lineNumber).toBeGreaterThan(1);
  });

  it("每条结果包含原始行数据", () => {
    const parsed = DataIO.parseCSVToMarks(TEST_SAMPLE_CSV);
    const mapping = DataIO.detectColumnMapping(parsed.headers);
    const result = Validation.validateCSVMarks(parsed.marks, parsed.headers, mapping);
    result.results.forEach(r => expect(r.rawRow).toBeObject());
  });
});

describe("Validation.validateCSVDives - CSV潜次校验", () => {
  it("test-multitype.csv 中的潜次校验统计正确", () => {
    const parsed = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    const result = Validation.validateCSVDives(parsed.dives, parsed.headers, parsed.mapping);
    expect(result.summary.total).toBe(3);
    expect(result.summary.invalid).toBeGreaterThan(0);
  });

  it("缺少编号的潜次应被检出", () => {
    const parsed = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    const result = Validation.validateCSVDives(parsed.dives, parsed.headers, parsed.mapping);
    const missingCode = result.results.filter(r => r.errors.includes("缺少编号"));
    expect(missingCode.length).toBeGreaterThan(0);
  });

  it("日期格式错误的潜次应被检出", () => {
    const parsed = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    const result = Validation.validateCSVDives(parsed.dives, parsed.headers, parsed.mapping);
    const badDate = result.results.filter(r =>
      r.errors.some(e => e.includes("日期格式无效"))
    );
    expect(badDate.length).toBeGreaterThan(0);
  });

  it("每条结果包含行号", () => {
    const parsed = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    const result = Validation.validateCSVDives(parsed.dives, parsed.headers, parsed.mapping);
    result.results.forEach(r => expect(r.lineNumber).toBeGreaterThan(1));
  });
});

describe("Validation.validateMarkArray - 批量校验", () => {
  it("全部有效时 valid 为 true", () => {
    const marks = [
      { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m" },
      { code: "C-002", type: "wood", dive: "DIVE-01", depth: "19m" },
    ];
    const result = Validation.validateMarkArray(marks);
    expect(result.valid).toBeTruthy();
    expect(result.total).toBe(2);
  });

  it("存在无效数据时 valid 为 false", () => {
    const marks = [
      { code: "C-001", type: "ceramic", dive: "DIVE-01", depth: "18m" },
      { code: "", type: "wood", dive: "DIVE-01", depth: "19m" },
    ];
    const result = Validation.validateMarkArray(marks);
    expect(result.valid).toBeFalsy();
    expect(result.results[0].valid).toBeTruthy();
    expect(result.results[1].valid).toBeFalsy();
  });

  it("非数组返回错误", () => {
    const result = Validation.validateMarkArray(null);
    expect(result.valid).toBeFalsy();
    expect(result.error).toBeTruthy();
  });
});

describe("错误定位 - 失败时可定位到具体记录和字段", () => {
  it("validateMark 返回的错误包含字段名", () => {
    const mark = { code: "C-001", type: "invalid", dive: "", depth: "18m", x: -1 };
    const result = Validation.validateMark(mark, 5);
    const hasType = result.errors.some(e => e.includes("类型") || e.includes("type"));
    const hasDive = result.errors.some(e => e.includes("dive"));
    const hasX = result.errors.some(e => e.includes("x"));
    expect(hasType).toBeTruthy();
    expect(hasDive).toBeTruthy();
    expect(hasX).toBeTruthy();
  });

  it("validateMark 返回的错误包含索引（第N项）", () => {
    const result = Validation.validateMark("bad", 3);
    expect(result.errors[0]).toContain("第 4 项");
  });

  it("validateCSVMarks 每条结果有 index 和 lineNumber", () => {
    const parsed = DataIO.parseCSVToMarks(TEST_SAMPLE_CSV);
    const mapping = DataIO.detectColumnMapping(parsed.headers);
    const result = Validation.validateCSVMarks(parsed.marks, parsed.headers, mapping);
    result.results.forEach((r, i) => {
      expect(r.index).toBe(i);
      expect(r.lineNumber).toBeTruthy();
    });
  });

  it("validateCSVMarks 错误记录能通过行号追溯原始数据", () => {
    const parsed = DataIO.parseCSVToMarks(TEST_SAMPLE_CSV);
    const mapping = DataIO.detectColumnMapping(parsed.headers);
    const result = Validation.validateCSVMarks(parsed.marks, parsed.headers, mapping);
    const invalidResults = result.results.filter(r => !r.valid);
    expect(invalidResults.length).toBeGreaterThan(0);
    invalidResults.forEach(r => {
      expect(r.rawRow).toBeTruthy();
      expect(r.lineNumber).toBeGreaterThan(1);
      expect(r.errors.length).toBeGreaterThan(0);
    });
  });

  it("validateCSVDives 错误记录能通过行号追溯", () => {
    const parsed = DataIO.parseCSVToMultiType(TEST_MULTITYPE_CSV);
    const result = Validation.validateCSVDives(parsed.dives, parsed.headers, parsed.mapping);
    const invalidResults = result.results.filter(r => !r.valid);
    expect(invalidResults.length).toBeGreaterThan(0);
    invalidResults.forEach(r => {
      expect(r.rawRow).toBeTruthy();
      expect(r.lineNumber).toBeGreaterThan(1);
      expect(r.errors.length).toBeGreaterThan(0);
    });
  });
});

function renderResults(results) {
  const container = document.getElementById("results");
  container.innerHTML = "";

  results.suites.forEach((suite, si) => {
    const suiteEl = document.createElement("div");
    suiteEl.className = "suite";

    const header = document.createElement("div");
    header.className = "suite-header";
    header.innerHTML = `
      <span class="suite-title">${suite.name}</span>
      <span class="suite-stats">${suite.passed} 通过 / ${suite.failed} 失败 / ${suite.tests.length} 总计</span>
    `;
    header.onclick = () => {
      const body = suiteEl.querySelector(".suite-body");
      body.classList.toggle("collapsed");
    };

    const body = document.createElement("div");
    body.className = "suite-body" + (suite.failed > 0 ? "" : " collapsed");

    suite.tests.forEach(test => {
      const testEl = document.createElement("div");
      testEl.className = "test " + (test.passed ? "pass" : "fail");
      testEl.innerHTML = `
        <div class="test-title">
          <span class="test-icon">${test.passed ? "✅" : "❌"}</span>
          <span class="test-name">${test.name}</span>
        </div>
      `;
      if (!test.passed) {
        const errEl = document.createElement("div");
        errEl.className = "error-detail";
        errEl.textContent = test.error;
        testEl.appendChild(errEl);
      }
      body.appendChild(testEl);
    });

    suiteEl.appendChild(header);
    suiteEl.appendChild(body);
    container.appendChild(suiteEl);
  });

  document.getElementById("totalCount").textContent = results.total;
  document.getElementById("passCount").textContent = results.passed;
  document.getElementById("failCount").textContent = results.failed;
  document.getElementById("duration").textContent = Math.round(results.duration) + "ms";
}

document.addEventListener("DOMContentLoaded", () => {
  const runBtn = document.getElementById("runBtn");
  const expandBtn = document.getElementById("expandBtn");
  const collapseBtn = document.getElementById("collapseBtn");
  const showFailOnlyBtn = document.getElementById("showFailOnlyBtn");

  let failOnly = false;

  async function runTests() {
    runBtn.textContent = "运行中...";
    runBtn.disabled = true;
    const results = await TestRunner.runAll();
    renderResults(results);
    runBtn.textContent = "▶ 运行全部测试";
    runBtn.disabled = false;
  }

  expandBtn.onclick = () => {
    document.querySelectorAll(".suite-body").forEach(el => el.classList.remove("collapsed"));
  };

  collapseBtn.onclick = () => {
    document.querySelectorAll(".suite-body").forEach(el => el.classList.add("collapsed"));
  };

  showFailOnlyBtn.onclick = () => {
    failOnly = !failOnly;
    showFailOnlyBtn.textContent = failOnly ? "显示全部" : "只看失败";
    document.querySelectorAll(".suite").forEach(suite => {
      const hasFail = suite.querySelector(".test.fail");
      suite.style.display = failOnly && !hasFail ? "none" : "";
    });
  };

  runBtn.onclick = runTests;

  const previewSampleBtn = document.getElementById("previewSampleBtn");
  const previewMultitypeBtn = document.getElementById("previewMultitypeBtn");
  const csvPreview = document.getElementById("csvPreview");
  const previewTitle = document.getElementById("previewTitle");
  const previewStats = document.getElementById("previewStats");
  const previewHead = document.getElementById("previewHead");
  const previewBody = document.getElementById("previewBody");

  function showCSVPreview(csvText, label, type) {
    const parsed = DataIO.parseCSVToMultiType(csvText);
    if (!parsed.success) {
      previewTitle.textContent = label + " - 解析失败: " + parsed.error;
      csvPreview.style.display = "block";
      return;
    }

    let validation;
    let records;
    if (type === "marks") {
      validation = Validation.validateCSVMarks(parsed.marks, parsed.headers, parsed.mapping);
      records = validation.results;
    } else if (type === "dives") {
      validation = Validation.validateCSVDives(parsed.dives, parsed.headers, parsed.mapping);
      records = validation.results;
    }

    previewTitle.textContent = label + " - " + (type === "marks" ? "标记校验" : "潜次校验");
    previewStats.innerHTML =
      "总计: " + validation.summary.total +
      " | 有效: <span style='color:#2ecc71'>" + validation.summary.valid + "</span>" +
      " | 无效: <span style='color:#e74c3c'>" + validation.summary.invalid + "</span>" +
      " | 空行: " + validation.summary.empty;

    const displayHeaders = type === "marks"
      ? ["行号", "编号", "类型", "潜次", "深度", "X", "Y", "状态", "错误"]
      : ["行号", "编号", "日期", "负责人", "能见度", "状态", "错误"];

    let headHtml = "<tr>";
    displayHeaders.forEach(function(h) { headHtml += "<th>" + h + "</th>"; });
    headHtml += "</tr>";
    previewHead.innerHTML = headHtml;

    let bodyHtml = "";
    records.forEach(function(r) {
      const rowClass = r.valid ? "" : "background:#ffebee";
      const statusIcon = r.valid ? "✅" : "❌";
      const errorText = r.errors.length > 0 ? r.errors.join("; ") : "-";

      if (type === "marks") {
        bodyHtml +=
          '<tr style="' + rowClass + '">' +
          "<td>" + r.lineNumber + "</td>" +
          "<td>" + (r.mark.code || "-") + "</td>" +
          "<td>" + (r.mark.type || "-") + "</td>" +
          "<td>" + (r.mark.dive || "-") + "</td>" +
          "<td>" + (r.mark.depth || "-") + "</td>" +
          "<td>" + (r.mark.x !== undefined ? r.mark.x : "-") + "</td>" +
          "<td>" + (r.mark.y !== undefined ? r.mark.y : "-") + "</td>" +
          "<td>" + statusIcon + "</td>" +
          '<td style="max-width:300px;font-size:11px;color:#c62828">' + errorText + "</td>" +
          "</tr>";
      } else {
        bodyHtml +=
          '<tr style="' + rowClass + '">' +
          "<td>" + r.lineNumber + "</td>" +
          "<td>" + (r.dive.code || "-") + "</td>" +
          "<td>" + (r.dive.date || "-") + "</td>" +
          "<td>" + (r.dive.leader || "-") + "</td>" +
          "<td>" + (r.dive.visibility || "-") + "</td>" +
          "<td>" + statusIcon + "</td>" +
          '<td style="max-width:300px;font-size:11px;color:#c62828">' + errorText + "</td>" +
          "</tr>";
      }
    });
    previewBody.innerHTML = bodyHtml;
    csvPreview.style.display = "block";
  }

  previewSampleBtn.onclick = function() {
    showCSVPreview(TEST_SAMPLE_CSV, "test-sample.csv", "marks");
  };

  previewMultitypeBtn.onclick = function() {
    showCSVPreview(TEST_MULTITYPE_CSV, "test-multitype.csv (标记)", "marks");
  };

  runTests();
});
