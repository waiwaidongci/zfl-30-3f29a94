const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const INDEX_HTML = 'file://' + path.resolve(__dirname, '..', 'index.html');
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

function readFixtureJSON(filename) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf-8'));
}

async function clearLocalStorage(page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

async function waitForAppReady(page) {
  await page.waitForSelector('#projectSelect', { state: 'attached' });
  await page.waitForSelector('#list', { state: 'attached' });
  await page.waitForTimeout(200);
}

test.describe('快照模块 - 快照记录与回滚', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(INDEX_HTML);
    await clearLocalStorage(page);
    await page.reload();
    await waitForAppReady(page);
    await page.evaluate(() => {
      const proj = ProjectManager.getCurrentProject();
      DataIO.setProjectId(proj.id);
      SnapshotModule.setProjectId(proj.id);
      MergeModule.setProjectId(proj.id);
    });
  });

  test('初始状态有初始快照', async ({ page }) => {
    const snapshots = await page.evaluate(() => {
      return SnapshotModule.getSnapshots();
    });

    expect(snapshots.total).toBeGreaterThanOrEqual(1);
    expect(snapshots.items.length).toBeGreaterThanOrEqual(1);
  });

  test('添加标记后会生成新快照', async ({ page }) => {
    const initialSnapshots = await page.evaluate(() => {
      return SnapshotModule.getSnapshots().total;
    });

    await page.evaluate(() => {
      const marks = DataIO.loadMarks();
      const newMark = {
        id: 'test-mark-' + Date.now(),
        code: 'TEST-001',
        type: 'ceramic',
        dive: '',
        depth: '10m',
        x: 50,
        y: 50,
      };
      marks.push(newMark);
      DataIO.saveMarks(marks);
      SnapshotModule.recordChange('mark', 'add', newMark.id, newMark.code, null, newMark);
    });

    const newSnapshots = await page.evaluate(() => {
      return SnapshotModule.getSnapshots().total;
    });

    expect(newSnapshots).toBeGreaterThan(initialSnapshots);
  });

  test('能创建手动快照', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return SnapshotModule.recordManualSnapshot('测试手动快照', ['test']);
    });

    expect(snapshot).toBeTruthy();
    expect(snapshot.id).toBeTruthy();
    expect(snapshot.description).toContain('测试手动快照');
    expect(snapshot.tags).toContain('manual');
    expect(snapshot.tags).toContain('test');
    expect(snapshot.data).toBeTruthy();
    expect(snapshot.data.marks).toBeTruthy();
    expect(snapshot.data.dives).toBeTruthy();
  });

  test('快照数据结构完整', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return SnapshotModule.recordManualSnapshot('数据结构测试');
    });

    expect(snapshot).toHaveProperty('id');
    expect(snapshot).toHaveProperty('version');
    expect(snapshot).toHaveProperty('timestamp');
    expect(snapshot).toHaveProperty('description');
    expect(snapshot).toHaveProperty('data');
    expect(snapshot.data).toHaveProperty('marks');
    expect(snapshot.data).toHaveProperty('dives');
    expect(snapshot.data).toHaveProperty('measurements');
    expect(snapshot.data).toHaveProperty('scale');
    expect(snapshot.data).toHaveProperty('gridConfig');
    expect(snapshot.data).toHaveProperty('views');
    expect(snapshot.data).toHaveProperty('revisitPlan');
    expect(Array.isArray(snapshot.data.marks)).toBe(true);
    expect(Array.isArray(snapshot.data.dives)).toBe(true);
  });

  test('能回滚到指定快照', async ({ page }) => {
    const snapshotBefore = await page.evaluate(() => {
      return SnapshotModule.recordManualSnapshot('回滚测试-前');
    });

    const markCountBefore = await page.evaluate(() => {
      return DataIO.loadMarks().length;
    });

    await page.evaluate(() => {
      const marks = DataIO.loadMarks();
      const newMark = {
        id: 'rollback-test-' + Date.now(),
        code: 'ROLLBACK-TEST',
        type: 'wood',
        dive: '',
        depth: '15m',
        x: 30,
        y: 30,
      };
      marks.push(newMark);
      DataIO.saveMarks(marks);
      SnapshotModule.recordChange('mark', 'add', newMark.id, newMark.code, null, newMark);
    });

    const markCountAfter = await page.evaluate(() => {
      return DataIO.loadMarks().length;
    });
    expect(markCountAfter).toBe(markCountBefore + 1);

    const result = await page.evaluate((snapId) => {
      return SnapshotModule.rollbackToSnapshot(snapId, { force: true, createUndoSnapshot: false });
    }, snapshotBefore.id);

    expect(result.success).toBe(true);

    const markCountRollback = await page.evaluate(() => {
      return DataIO.loadMarks().length;
    });

    expect(markCountRollback).toBe(markCountBefore);
  });

  test('回滚前会创建撤销快照', async ({ page }) => {
    const snapshotBefore = await page.evaluate(() => {
      return SnapshotModule.recordManualSnapshot('撤销测试-前');
    });

    const countBefore = await page.evaluate(() => {
      return SnapshotModule.getSnapshots().total;
    });

    await page.evaluate(() => {
      const marks = DataIO.loadMarks();
      const newMark = {
        id: 'undo-test-' + Date.now(),
        code: 'UNDO-TEST',
        type: 'metal',
        dive: '',
        depth: '20m',
        x: 40,
        y: 40,
      };
      marks.push(newMark);
      DataIO.saveMarks(marks);
      SnapshotModule.recordChange('mark', 'add', newMark.id, newMark.code, null, newMark);
    });

    const result = await page.evaluate((snapId) => {
      return SnapshotModule.rollbackToSnapshot(snapId, { force: true, createUndoSnapshot: true });
    }, snapshotBefore.id);

    const countAfter = await page.evaluate(() => {
      return SnapshotModule.getSnapshots().total;
    });

    expect(countAfter).toBeGreaterThan(countBefore);

    const undoSnapshot = await page.evaluate(() => {
      const result = SnapshotModule.getSnapshots({ tags: ['rollback-undo'] });
      return result.items.length > 0 ? result.items[0] : null;
    });

    expect(undoSnapshot).toBeTruthy();
    expect(undoSnapshot.tags).toContain('rollback-undo');
  });

  test('能检查回滚冲突', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return SnapshotModule.recordManualSnapshot('冲突测试');
    });

    await page.evaluate(() => {
      const marks = DataIO.loadMarks();
      const newMark = {
        id: 'conflict-test-' + Date.now(),
        code: 'CONFLICT-TEST',
        type: 'ceramic',
        dive: '',
        depth: '25m',
        x: 60,
        y: 60,
      };
      marks.push(newMark);
      DataIO.saveMarks(marks);
      SnapshotModule.recordChange('mark', 'add', newMark.id, newMark.code, null, newMark);
    });

    const conflictResult = await page.evaluate((snapId) => {
      const snap = SnapshotModule.getSnapshotById(snapId);
      return SnapshotModule.checkRollbackConflicts(snap);
    }, snapshot.id);

    expect(conflictResult.valid).toBe(true);
    expect(conflictResult.conflicts).toBeTruthy();
    expect(conflictResult.stats.marksToDelete).toBeGreaterThan(0);
  });
});

test.describe('快照模块 - 快照导出导入', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(INDEX_HTML);
    await clearLocalStorage(page);
    await page.reload();
    await waitForAppReady(page);
    await page.evaluate(() => {
      const proj = ProjectManager.getCurrentProject();
      DataIO.setProjectId(proj.id);
      SnapshotModule.setProjectId(proj.id);
      MergeModule.setProjectId(proj.id);
    });
  });

  test('能导出快照数据', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return SnapshotModule.recordManualSnapshot('导出测试快照');
    });

    const exported = await page.evaluate((snapId) => {
      return SnapshotModule.exportSnapshotData(snapId);
    }, snapshot.id);

    expect(exported).toBeTruthy();
    expect(exported.snapshotId).toBe(snapshot.id);
    expect(exported.exportType).toBe('snapshot');
    expect(exported.version).toBeTruthy();
    expect(exported.originalData).toBeTruthy();
    expect(exported.originalData.marks).toBeTruthy();
  });

  test('能导入快照数据', async ({ page }) => {
    const snapshot = await page.evaluate(() => {
      return SnapshotModule.recordManualSnapshot('导入源快照');
    });

    const exported = await page.evaluate((snapId) => {
      return SnapshotModule.exportSnapshotData(snapId);
    }, snapshot.id);

    const snapshotCountBefore = await page.evaluate(() => {
      return SnapshotModule.getSnapshots().total;
    });

    const result = await page.evaluate((snapData) => {
      return SnapshotModule.importSnapshotData(snapData, { autoRollback: false });
    }, exported);

    expect(result.success).toBe(true);

    const snapshotCountAfter = await page.evaluate(() => {
      return SnapshotModule.getSnapshots().total;
    });

    expect(snapshotCountAfter).toBe(snapshotCountBefore + 1);
  });
});

test.describe('离线合并模块', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(INDEX_HTML);
    await clearLocalStorage(page);
    await page.reload();
    await waitForAppReady(page);
    await page.evaluate(() => {
      const proj = ProjectManager.getCurrentProject();
      DataIO.setProjectId(proj.id);
      SnapshotModule.setProjectId(proj.id);
      MergeModule.setProjectId(proj.id);
    });
  });

  test('离线合并模块已加载并可用', async ({ page }) => {
    const hasModule = await page.evaluate(() => typeof MergeModule !== 'undefined');
    expect(hasModule).toBe(true);

    const hasBuildExport = await page.evaluate(() => typeof MergeModule.buildExportData === 'function');
    expect(hasBuildExport).toBe(true);

    const hasAnalyzeMerge = await page.evaluate(() => typeof MergeModule.analyzeMerge === 'function');
    expect(hasAnalyzeMerge).toBe(true);
  });

  test('能构建设备ID', async ({ page }) => {
    const deviceId = await page.evaluate(() => {
      return MergeModule.getDeviceId();
    });

    expect(deviceId).toBeTruthy();
    expect(deviceId).toMatch(/^DEV-/);
  });

  test('能构建离线导出数据', async ({ page }) => {
    const sampleData = readFixtureJSON('sample-project.json');

    await page.evaluate((data) => {
      DataIO.saveMarks(data.marks);
      DataIO.saveDives(data.dives);
      DataIO.saveMeasurements(data.measurements || []);
    }, sampleData);

    const exportData = await page.evaluate(() => {
      const marks = DataIO.loadMarks();
      const dives = DataIO.loadDives();
      const measurements = DataIO.loadMeasurements();
      const scale = DataIO.loadScale();
      const gridConfig = DataIO.loadGridConfig();
      const baseMap = DataIO.loadBaseMap();
      return MergeModule.buildExportData(marks, dives, measurements, scale, gridConfig, baseMap);
    });

    expect(exportData).toBeTruthy();
    expect(exportData.format).toBe('offline-merge');
    expect(exportData.version).toBeTruthy();
    expect(exportData.deviceId).toBeTruthy();
    expect(exportData.snapshot).toBeTruthy();
    expect(exportData.snapshot.marks).toBeTruthy();
    expect(exportData.snapshot.marks.length).toBe(sampleData.marks.length);
    expect(exportData.changeLog).toBeTruthy();
    expect(Array.isArray(exportData.changeLog)).toBe(true);
  });

  test('能识别离线合并格式', async ({ page }) => {
    const sampleData = readFixtureJSON('sample-project.json');

    await page.evaluate((data) => {
      DataIO.saveMarks(data.marks);
      DataIO.saveDives(data.dives);
    }, sampleData);

    const exportData = await page.evaluate(() => {
      const marks = DataIO.loadMarks();
      const dives = DataIO.loadDives();
      return MergeModule.buildExportData(marks, dives, [], null, null, null);
    });

    const isOfflineMerge = await page.evaluate((data) => {
      return MergeModule.isOfflineMergeFormat(data);
    }, exportData);

    expect(isOfflineMerge).toBe(true);

    const notOfflineMerge = await page.evaluate(() => {
      return MergeModule.isOfflineMergeFormat({ marks: [], dives: [] });
    });

    expect(notOfflineMerge).toBe(false);
  });

  test('变更记录会被记录', async ({ page }) => {
    const initialLogCount = await page.evaluate(() => {
      return MergeModule.loadChangeLog().length;
    });

    await page.evaluate(() => {
      const marks = DataIO.loadMarks();
      const newMark = {
        id: 'changelog-test-' + Date.now(),
        code: 'CHANGELOG-TEST',
        type: 'ceramic',
        dive: '',
        depth: '12m',
        x: 55,
        y: 55,
      };
      marks.push(newMark);
      DataIO.saveMarks(marks);
      MergeModule.recordChange('mark', 'add', newMark.id, newMark.code, null, newMark);
    });

    const newLogCount = await page.evaluate(() => {
      return MergeModule.loadChangeLog().length;
    });

    expect(newLogCount).toBeGreaterThan(initialLogCount);

    const lastEntry = await page.evaluate(() => {
      const log = MergeModule.loadChangeLog();
      return log[log.length - 1];
    });

    expect(lastEntry).toBeTruthy();
    expect(lastEntry.entityType).toBe('mark');
    expect(lastEntry.action).toBe('add');
    expect(lastEntry.entityCode).toBe('CHANGELOG-TEST');
    expect(lastEntry.deviceId).toBeTruthy();
    expect(lastEntry.timestamp).toBeTruthy();
  });

  test('能分析离线合并差异', async ({ page }) => {
    const sampleData = readFixtureJSON('sample-project.json');

    await page.evaluate((data) => {
      DataIO.saveMarks(data.marks);
      DataIO.saveDives(data.dives);
      DataIO.saveMeasurements(data.measurements || []);
    }, sampleData);

    const exportData = await page.evaluate(() => {
      const marks = DataIO.loadMarks();
      const dives = DataIO.loadDives();
      const measurements = DataIO.loadMeasurements();
      return MergeModule.buildExportData(marks, dives, measurements, null, null, null);
    });

    await page.evaluate(() => {
      const marks = DataIO.loadMarks();
      const newMark = {
        id: 'local-new-' + Date.now(),
        code: 'LOCAL-NEW',
        type: 'wood',
        dive: '',
        depth: '14m',
        x: 70,
        y: 70,
      };
      marks.push(newMark);
      DataIO.saveMarks(marks);
      MergeModule.recordChange('mark', 'add', newMark.id, newMark.code, null, newMark);
    });

    const analysis = await page.evaluate((exportData) => {
      const localData = {
        marks: DataIO.loadMarks(),
        dives: DataIO.loadDives(),
        measurements: DataIO.loadMeasurements(),
        scale: null,
        gridConfig: null,
      };
      return MergeModule.analyzeMerge(localData, exportData);
    }, exportData);

    expect(analysis).toBeTruthy();
    expect(analysis.marks).toBeTruthy();
    expect(Array.isArray(analysis.marks.new)).toBe(true);
    expect(Array.isArray(analysis.marks.diverged)).toBe(true);
    expect(Array.isArray(analysis.marks.modified)).toBe(true);
    expect(Array.isArray(analysis.marks.unchanged)).toBe(true);
  });
});
