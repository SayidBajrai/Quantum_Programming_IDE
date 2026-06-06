import { chromium } from 'playwright';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:5010';

async function testTabSwitch(page, path, outputTabLabel, otherTabLabel) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
  await page.click(`button.right-tab >> text=${outputTabLabel}`);
  await page.waitForTimeout(300);

  const outputSection = page.locator('#outputSection');
  const outputVisible = await outputSection.isVisible();
  const runBtnVisible = await page.locator('#runBtn').isVisible();
  const outputBox = await outputSection.boundingBox();

  await page.click(`button.right-tab >> text=${otherTabLabel}`);
  await page.waitForTimeout(200);
  const outputHiddenAfterSwitch = await outputSection.isHidden();

  return {
    path,
    outputVisible,
    runBtnVisible,
    outputHeight: outputBox?.height ?? 0,
    outputHiddenAfterSwitch,
  };
}

async function testCompilerRun(page) {
  await page.goto(`${BASE_URL}/compiler`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.monacoEditor !== 'undefined' && window.monacoEditor !== null, null, { timeout: 15000 });

  await page.evaluate(() => {
    window.monacoEditor.setValue(`OPENQASM 3;
include "stdgates.inc";
qubit[2] q;
bit[2] c;
h q[0];
cx q[0], q[1];
measure q -> c;`);
  });

  await page.click('button.right-tab >> text=Simulation Results');
  await page.locator('#runBtn').click();

  await page.waitForFunction(() => {
    const results = document.getElementById('resultsDisplay');
    const error = document.getElementById('errorDisplay');
    const resultsVisible = results && !results.classList.contains('hidden');
    const errorVisible = error && !error.classList.contains('hidden');
    return resultsVisible || errorVisible;
  }, null, { timeout: 15000 });

  const resultsVisible = await page.locator('#resultsDisplay').isVisible();
  const errorVisible = await page.locator('#errorDisplay').isVisible();

  return {
    path: '/compiler run',
    resultsVisible,
    errorVisible,
    status: (await page.locator('#statusIndicator').textContent())?.trim(),
    errorText: errorVisible ? await page.locator('#errorMessage').textContent() : '',
  };
}

async function testCircuitRun(page) {
  await page.goto(`${BASE_URL}/circuit`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.circuitBuilderMonacoEditor !== 'undefined' && window.circuitBuilderMonacoEditor !== null, null, { timeout: 15000 });
  await page.click('button.right-tab >> text=Simulation Results');
  await page.locator('#runBtn').click();

  await page.waitForFunction(() => {
    const results = document.getElementById('resultsDisplay');
    const error = document.getElementById('errorDisplay');
    const resultsVisible = results && !results.classList.contains('hidden');
    const errorVisible = error && !error.classList.contains('hidden');
    return resultsVisible || errorVisible;
  }, null, { timeout: 15000 });

  return {
    path: '/circuit run',
    resultsVisible: await page.locator('#resultsDisplay').isVisible(),
    errorVisible: await page.locator('#errorDisplay').isVisible(),
    status: (await page.locator('#statusIndicator').textContent())?.trim(),
  };
}

function assertTabResult(result) {
  if (!result.outputVisible) throw new Error(`${result.path}: output tab not visible`);
  if (!result.runBtnVisible) throw new Error(`${result.path}: run button not visible`);
  if (result.outputHeight < 50) throw new Error(`${result.path}: output panel height too small (${result.outputHeight})`);
  if (!result.outputHiddenAfterSwitch) throw new Error(`${result.path}: output tab did not hide when switching away`);
}

function assertRunResult(result) {
  if (!result.resultsVisible) {
    const detail = result.errorText ? `: ${result.errorText}` : '';
    throw new Error(`${result.path}: simulation results not visible${detail}`);
  }
  if (result.errorVisible) throw new Error(`${result.path}: unexpected error display`);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];

try {
  const compilerTabs = await testTabSwitch(page, '/compiler', 'Simulation Results', 'Circuit Diagram');
  assertTabResult(compilerTabs);
  console.log('PASS compiler tab switching');

  const circuitTabs = await testTabSwitch(page, '/circuit', 'Simulation Results', 'Generated QASM Code');
  assertTabResult(circuitTabs);
  console.log('PASS circuit tab switching');

  const compilerRun = await testCompilerRun(page);
  assertRunResult(compilerRun);
  console.log('PASS compiler simulation run');

  const circuitRun = await testCircuitRun(page);
  assertRunResult(circuitRun);
  console.log('PASS circuit simulation run');

  console.log(JSON.stringify({ compilerTabs, circuitTabs, compilerRun, circuitRun }, null, 2));
} catch (error) {
  errors.push(error.message);
  console.error('FAIL', error.message);
} finally {
  await browser.close();
}

if (errors.length) {
  process.exit(1);
}
