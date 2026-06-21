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

async function getLocalStorageItem(page, key) {
  return await page.evaluate((k) => {
    return localStorage.getItem(k);
  }, key);
}

test.describe('项目切换 - 数据隔离', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(INDEX_HTML);
    await clearLocalStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test('能创建新项目', async ({ page }) => {
    const initialProjectCount = await page.evaluate(() => {
      return ProjectManager.getAllProjects().length;
    });

    const newProjectName = '测试新项目' + Date.now();
    const result = await page.evaluate((name) => {
      const proj = ProjectManager.createProject(name);
      return proj;
    }, newProjectName);

    expect(result).toBeTruthy();
    expect(result.name).toBe(newProjectName);

    const newProjectCount = await page.evaluate(() => {
      return ProjectManager.getAllProjects().length;
    });

    expect(newProjectCount).toBe(initialProjectCount + 1);
  });

  test('切换项目后数据相互隔离', async ({ page }) => {
    const projAName = '项目A-' + Date.now();
    const projBName = '项目B-' + Date.now();

    const sampleDataA = readFixtureJSON('sample-project.json');
    const sampleDataB = readFixtureJSON('sample-project-b.json');

    const projA = await page.evaluate(([name, data]) => {
      const proj = ProjectManager.createProject(name);
      ProjectManager.switchProject(proj.id);
      DataIO.setProjectId(proj.id);
      SnapshotModule.setProjectId(proj.id);
      MergeModule.setProjectId(proj.id);
      DataIO.saveMarks(data.marks);
      DataIO.saveDives(data.dives);
      DataIO.saveMeasurements(data.measurements || []);
      return proj;
    }, [projAName, sampleDataA]);

    const markCountA = await page.evaluate(() => {
      DataIO.setProjectId(ProjectManager.getCurrentProject().id);
      return DataIO.loadMarks().length;
    });
    expect(markCountA).toBe(sampleDataA.marks.length);

    const projB = await page.evaluate(([name, data]) => {
      const proj = ProjectManager.createProject(name);
      ProjectManager.switchProject(proj.id);
      DataIO.setProjectId(proj.id);
      SnapshotModule.setProjectId(proj.id);
      MergeModule.setProjectId(proj.id);
      DataIO.saveMarks(data.marks);
      DataIO.saveDives(data.dives);
      DataIO.saveMeasurements(data.measurements || []);
      return proj;
    }, [projBName, sampleDataB]);

    const markCountB = await page.evaluate(() => {
      return DataIO.loadMarks().length;
    });
    expect(markCountB).toBe(sampleDataB.marks.length);

    const currentProject = await page.evaluate(() => {
      return ProjectManager.getCurrentProject();
    });
    expect(currentProject.name).toBe(projBName);

    const projAMarks = await page.evaluate((projId) => {
      DataIO.setProjectId(projId);
      return DataIO.loadMarks();
    }, projA.id);
    expect(projAMarks.length).toBe(sampleDataA.marks.length);

    const projBMarks = await page.evaluate((projId) => {
      DataIO.setProjectId(projId);
      return DataIO.loadMarks();
    }, projB.id);
    expect(projBMarks.length).toBe(sampleDataB.marks.length);

    const codesA = projAMarks.map(m => m.code).sort();
    const codesB = projBMarks.map(m => m.code).sort();
    expect(codesA).not.toEqual(codesB);
  });

  test('项目数据使用不同的 localStorage 键前缀', async ({ page }) => {
    const projAName = '键测试A-' + Date.now();
    const projBName = '键测试B-' + Date.now();

    const projAId = await page.evaluate(name => {
      const proj = ProjectManager.createProject(name);
      ProjectManager.switchProject(proj.id);
      DataIO.setProjectId(proj.id);
      DataIO.saveMarks([{ id: 'test-a', code: 'A-001', type: 'ceramic', dive: '', depth: '10m' }]);
      return proj.id;
    }, projAName);

    const projBId = await page.evaluate(name => {
      const proj = ProjectManager.createProject(name);
      ProjectManager.switchProject(proj.id);
      DataIO.setProjectId(proj.id);
      DataIO.saveMarks([{ id: 'test-b', code: 'B-001', type: 'wood', dive: '', depth: '20m' }]);
      return proj.id;
    }, projBName);

    const keyA = await page.evaluate(id => {
      return ProjectManager.projKey(id, 'marks');
    }, projAId);

    const keyB = await page.evaluate(id => {
      return ProjectManager.projKey(id, 'marks');
    }, projBId);

    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain('zfl30_proj_');

    const dataA = await getLocalStorageItem(page, keyA);
    const dataB = await getLocalStorageItem(page, keyB);

    expect(dataA).toBeTruthy();
    expect(dataB).toBeTruthy();

    const marksA = JSON.parse(dataA);
    const marksB = JSON.parse(dataB);

    expect(marksA[0].code).toBe('A-001');
    expect(marksB[0].code).toBe('B-001');
  });

  test('删除项目会清除对应项目数据', async ({ page }) => {
    const projName = '待删除项目-' + Date.now();

    const projId = await page.evaluate(name => {
      const proj = ProjectManager.createProject(name);
      ProjectManager.switchProject(proj.id);
      DataIO.setProjectId(proj.id);
      DataIO.saveMarks([{ id: 'del-test', code: 'DEL-001', type: 'ceramic', dive: '', depth: '10m' }]);
      return proj.id;
    }, projName);

    const marksKey = await page.evaluate(id => {
      return ProjectManager.projKey(id, 'marks');
    }, projId);

    const dataBefore = await getLocalStorageItem(page, marksKey);
    expect(dataBefore).toBeTruthy();

    await page.evaluate(id => {
      const allProjects = ProjectManager.getAllProjects();
      const activeProjects = allProjects.filter(p => !p.archived);
      if (activeProjects.length <= 1) {
        ProjectManager.createProject('保留项目');
      }
      ProjectManager.deleteProject(id);
    }, projId);

    const dataAfter = await getLocalStorageItem(page, marksKey);
    expect(dataAfter).toBeNull();

    const projects = await page.evaluate(() => {
      return ProjectManager.getAllProjects();
    });
    const deletedProject = projects.find(p => p.id === projId);
    expect(deletedProject).toBeUndefined();
  });
});
