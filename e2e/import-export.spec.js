const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const INDEX_HTML = 'file://' + path.resolve(__dirname, '..', 'index.html');
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

function getFixturePath(filename) {
  return path.join(FIXTURES_DIR, filename);
}

function readFixtureJSON(filename) {
  return JSON.parse(fs.readFileSync(getFixturePath(filename), 'utf-8'));
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

async function getMarkCount(page) {
  return await page.evaluate(() => {
    const list = document.getElementById('list');
    return list ? list.children.length : 0;
  });
}

async function getDiveCount(page) {
  return await page.evaluate(() => {
    const list = document.getElementById('diveList');
    return list ? list.children.length : 0;
  });
}

test.describe('数据导入导出 - JSON 样例数据', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(INDEX_HTML);
    await clearLocalStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test('能导入完整的 JSON 样例数据', async ({ page }) => {
    const sampleData = readFixtureJSON('sample-project.json');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#importBtn');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(getFixturePath('sample-project.json'));

    await page.waitForSelector('#confirmImportBtn', { state: 'visible' });
    await page.waitForTimeout(300);

    await page.click('#confirmImportBtn');
    await page.waitForTimeout(800);

    const storedMarks = await page.evaluate(() => {
      const proj = ProjectManager.getCurrentProject();
      if (!proj) return [];
      DataIO.setProjectId(proj.id);
      return DataIO.loadMarks();
    });

    expect(storedMarks.length).toBeGreaterThanOrEqual(2);
  });

  test('导入后数据能在 localStorage 中正确存储', async ({ page }) => {
    const sampleData = readFixtureJSON('sample-project.json');

    await page.evaluate((data) => {
      const proj = ProjectManager.getCurrentProject();
      DataIO.setProjectId(proj.id);
      DataIO.saveMarks(data.marks);
      DataIO.saveDives(data.dives);
      DataIO.saveMeasurements(data.measurements || []);
    }, sampleData);

    const storedMarks = await page.evaluate(() => {
      const proj = ProjectManager.getCurrentProject();
      if (!proj) return [];
      DataIO.setProjectId(proj.id);
      return DataIO.loadMarks();
    });

    expect(storedMarks.length).toBe(sampleData.marks.length);
    expect(storedMarks[0].code).toBe(sampleData.marks[0].code);
  });

  test('能正确导入标记的审核状态', async ({ page }) => {
    const sampleData = readFixtureJSON('sample-project.json');

    await page.evaluate((data) => {
      const proj = ProjectManager.getCurrentProject();
      DataIO.setProjectId(proj.id);
      DataIO.saveMarks(data.marks);
    }, sampleData);

    const markWithReview = await page.evaluate(() => {
      const proj = ProjectManager.getCurrentProject();
      if (!proj) return null;
      DataIO.setProjectId(proj.id);
      const marks = DataIO.loadMarks();
      return marks.find(m => m.review && m.review.status === 'confirmed') || null;
    });

    expect(markWithReview).toBeTruthy();
    expect(markWithReview.review.status).toBe('confirmed');
    expect(markWithReview.review.history.length).toBeGreaterThan(0);
  });

  test('能正确导入采样信息', async ({ page }) => {
    const sampleData = readFixtureJSON('sample-project.json');

    await page.evaluate((data) => {
      const proj = ProjectManager.getCurrentProject();
      DataIO.setProjectId(proj.id);
      DataIO.saveMarks(data.marks);
    }, sampleData);

    const markWithSampling = await page.evaluate(() => {
      const proj = ProjectManager.getCurrentProject();
      if (!proj) return null;
      DataIO.setProjectId(proj.id);
      const marks = DataIO.loadMarks();
      return marks.find(m => m.sampling && m.sampling.sampleNo) || null;
    });

    expect(markWithSampling).toBeTruthy();
    expect(markWithSampling.sampling.sampleNo).toBe('S-001');
  });

  test('能正确导入测距记录', async ({ page }) => {
    const sampleData = readFixtureJSON('sample-project.json');

    await page.evaluate((data) => {
      const proj = ProjectManager.getCurrentProject();
      DataIO.setProjectId(proj.id);
      DataIO.saveMeasurements(data.measurements || []);
    }, sampleData);

    const measurements = await page.evaluate(() => {
      const proj = ProjectManager.getCurrentProject();
      if (!proj) return [];
      DataIO.setProjectId(proj.id);
      return DataIO.loadMeasurements();
    });

    expect(measurements.length).toBeGreaterThanOrEqual(1);
    expect(measurements[0].code).toBe('DIST-001');
    expect(measurements[0].points.length).toBe(2);
  });

  test('导出功能能生成文件下载', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.click('#exportBtn');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.json$/);

    const downloadPath = await download.path();
    const content = fs.readFileSync(downloadPath, 'utf-8');
    const data = JSON.parse(content);

    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('marks');
    expect(data).toHaveProperty('dives');
    expect(Array.isArray(data.marks)).toBe(true);
    expect(Array.isArray(data.dives)).toBe(true);
  });

  test('导出数据包含完整的版本信息', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.click('#exportBtn');
    const download = await downloadPromise;

    const downloadPath = await download.path();
    const content = fs.readFileSync(downloadPath, 'utf-8');
    const data = JSON.parse(content);

    expect(data.version).toBeTruthy();
    expect(parseFloat(data.version)).toBeGreaterThanOrEqual(7.0);
    expect(data.exportDate).toBeTruthy();
  });
});
