const { test, expect } = require('@playwright/test');
const path = require('path');

const INDEX_HTML = 'file://' + path.resolve(__dirname, '..', 'index.html');

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

test.describe('应用加载 - 直接打开 index.html', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(INDEX_HTML);
    await clearLocalStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test('页面标题正确', async ({ page }) => {
    await expect(page).toHaveTitle(/水下考古潜水记录/);
  });

  test('页面能正常加载，无 JS 错误', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    await page.reload();
    await waitForAppReady(page);
    expect(errors).toEqual([]);
  });
});

test.describe('核心模块 - 无打包加载方式', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(INDEX_HTML);
    await clearLocalStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test('App 模块已加载', async ({ page }) => {
    const hasApp = await page.evaluate(() => typeof App !== 'undefined');
    expect(hasApp).toBe(true);
  });

  test('DataIO 模块已加载', async ({ page }) => {
    const hasDataIO = await page.evaluate(() => typeof DataIO !== 'undefined');
    expect(hasDataIO).toBe(true);
  });

  test('ProjectManager 模块已加载', async ({ page }) => {
    const hasPM = await page.evaluate(() => typeof ProjectManager !== 'undefined');
    expect(hasPM).toBe(true);
  });

  test('所有模块通过 script 标签顺序加载，无模块打包工具', async ({ page }) => {
    const scriptCount = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[src]');
      return scripts.length;
    });
    expect(scriptCount).toBeGreaterThanOrEqual(8);
  });
});
