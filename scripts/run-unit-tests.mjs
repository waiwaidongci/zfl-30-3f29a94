import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testHtmlPath = 'file://' + path.resolve(__dirname, '..', 'test.html');

async function runUnitTests() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  let testResults = null;
  let failed = false;

  page.on('pageerror', (error) => {
    console.error('页面错误:', error.message);
    failed = true;
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('控制台错误:', msg.text());
    }
  });

  await page.goto(testHtmlPath);

  await page.waitForFunction(() => typeof TestRunner !== 'undefined');

  const runButton = await page.$('#runBtn');
  if (runButton) {
    await runButton.click();
  } else {
    await page.evaluate(async () => {
      return await TestRunner.runAll();
    });
  }

  await page.waitForFunction(() => {
    const totalEl = document.getElementById('totalCount');
    return totalEl && totalEl.textContent !== '0';
  }, { timeout: 10000 });

  const results = await page.evaluate(() => {
    const total = parseInt(document.getElementById('totalCount')?.textContent || '0', 10);
    const passed = parseInt(document.getElementById('passCount')?.textContent || '0', 10);
    const failed = parseInt(document.getElementById('failCount')?.textContent || '0', 10);
    const duration = document.getElementById('duration')?.textContent || '0ms';

    const failedTests = [];
    document.querySelectorAll('.test.fail').forEach(el => {
      const name = el.querySelector('.test-name')?.textContent || '';
      const error = el.querySelector('.error-detail')?.textContent || '';
      failedTests.push({ name, error });
    });

    return { total, passed, failed, duration, failedTests };
  });

  testResults = results;

  console.log('\n=== 单元测试结果 ===');
  console.log(`总计: ${results.total}`);
  console.log(`通过: ${results.passed} ✅`);
  console.log(`失败: ${results.failed} ❌`);
  console.log(`耗时: ${results.duration}`);

  if (results.failedTests.length > 0) {
    console.log('\n失败的测试:');
    results.failedTests.forEach((test, i) => {
      console.log(`\n  ${i + 1}. ${test.name}`);
      console.log(`     ${test.error.substring(0, 200)}`);
    });
    failed = true;
  }

  await browser.close();

  if (failed || results.failed > 0) {
    process.exit(1);
  } else {
    console.log('\n✅ 所有单元测试通过!');
    process.exit(0);
  }
}

runUnitTests().catch((err) => {
  console.error('运行单元测试时出错:', err);
  process.exit(1);
});
