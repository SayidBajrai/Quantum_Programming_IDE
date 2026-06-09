import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:5010';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DOC_GATE_PATH = join(__dirname, '..', 'frontend', 'static', 'Saved', 'doc_gate.qta');

const EXPECTED_DOC_LINES = [
    { line: 1, text: '/// - Bellgate gate', tokens: { keyword: 0, identifier: 0, controlflow: 0 } },
    { line: 2, text: '/// qbit a - first parameter', tokens: { keyword: 1, identifier: 1, controlflow: 0 } },
    { line: 3, text: '/// qbit b - second parameter', tokens: { keyword: 1, identifier: 1, controlflow: 0 } },
    { line: 16, text: '/// int a - first variable', tokens: { keyword: 1, identifier: 1, controlflow: 0 } },
    { line: 17, text: '/// int b - second variable', tokens: { keyword: 1, identifier: 1, controlflow: 0 } },
    { line: 18, text: '/// return: int - result of add', tokens: { keyword: 1, identifier: 0, controlflow: 1 } },
    { line: 24, text: '/// float a - first variable', tokens: { keyword: 1, identifier: 1, controlflow: 0 } },
    { line: 26, text: '/// return: float - result of add', tokens: { keyword: 1, identifier: 0, controlflow: 1 } },
    { line: 32, text: '/// var a - first variable', tokens: { keyword: 1, identifier: 1, controlflow: 0 } },
    { line: 34, text: '/// return: var - result of add', tokens: { keyword: 1, identifier: 0, controlflow: 1 } },
];

function countTokens(lineTokens) {
    const counts = { keyword: 0, identifier: 0, controlflow: 0, comment: 0 };
    for (const token of lineTokens) {
        const type = (token.type || '').split('.')[0];
        if (counts[type] !== undefined) counts[type]++;
    }
    return counts;
}

function tokenDetails(lineTokens, lineText) {
    return lineTokens.map((token) => ({
        type: token.type,
        text: lineText.slice(token.offset, token.offset + token.type.length > 0 ? undefined : 0),
    }));
}

const browser = await chromium.launch();
const context = await browser.newContext();
await context.route('**/*.js', async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers(), 'cache-control': 'no-cache' };
    await route.fulfill({ response, headers });
});
const page = await context.newPage();
const errors = [];

try {
    const source = readFileSync(DOC_GATE_PATH, 'utf8');
    await page.goto(`${BASE_URL}/compiler`, { waitUntil: 'networkidle' });
    await page.waitForFunction(
        () => typeof window.monacoEditor !== 'undefined' && window.monacoEditor !== null,
        null,
        { timeout: 15000 }
    );

    const result = await page.evaluate(async (code) => {
        const editor = window.monacoEditor;
        const monaco = window.monaco;
        monaco.editor.setModelLanguage(editor.getModel(), 'quanta');
        editor.updateOptions({ theme: 'quanta-theme' });
        editor.setValue(code);

        const lines = code.split('\n');
        const tokenized = monaco.editor.tokenize(code, 'quanta');

        const ruleColors = {};
        const configResp = await fetch('/api/config');
        if (configResp.ok) {
            const config = await configResp.json();
            const rules = config?.monacoThemes?.quanta?.dark?.rules || [];
            for (const rule of rules) {
                ruleColors[rule.token] = rule.foreground;
            }
        }

        const lineResults = [];
        for (let i = 0; i < lines.length; i++) {
            const lineNumber = i + 1;
            const lineText = lines[i];
            const lineTokens = tokenized[i] || [];
            const counts = {};
            const parts = [];
            for (let j = 0; j < lineTokens.length; j++) {
                const token = lineTokens[j];
                const start = token.offset;
                const end = j + 1 < lineTokens.length ? lineTokens[j + 1].offset : lineText.length;
                const baseType = (token.type || '').split('.')[0];
                counts[baseType] = (counts[baseType] || 0) + 1;
                parts.push({ type: token.type, baseType, text: lineText.slice(start, end), color: ruleColors[baseType] || null });
            }
            lineResults.push({ lineNumber, lineText, counts, parts });
        }

        return { lineResults, ruleColors };
    }, source);

    console.log('Theme token colors:', result.ruleColors);

    for (const expected of EXPECTED_DOC_LINES) {
        const actual = result.lineResults.find((r) => r.lineNumber === expected.line);
        if (!actual) {
            errors.push(`Line ${expected.line}: missing from tokenize output`);
            continue;
        }
        if (actual.lineText.trim() !== expected.text.trim()) {
            errors.push(`Line ${expected.line}: text mismatch\n  expected: ${expected.text}\n  actual:   ${actual.lineText}`);
            continue;
        }
        for (const [tokenType, count] of Object.entries(expected.tokens)) {
            const got = actual.counts[tokenType] || 0;
            if (got !== count) {
                errors.push(
                    `Line ${expected.line}: expected ${count} '${tokenType}' token(s), got ${got}\n  line: ${actual.lineText}\n  tokens: ${JSON.stringify(actual.parts)}`
                );
            }
        }
        console.log(`PASS line ${expected.line}: ${actual.lineText}`);
        console.log(`      ${actual.parts.map((p) => `${p.text}|${p.baseType}`).join(' ')}`);
    }

    const returnLine = result.lineResults.find((r) => r.lineNumber === 20);
    if (returnLine) {
        const returnTokens = returnLine.parts.filter((p) => p.baseType === 'controlflow' && p.text.trim() === 'return');
        if (returnTokens.length !== 1) {
            errors.push(`Line 20 code 'return' should be controlflow, got: ${JSON.stringify(returnLine.parts)}`);
        } else {
            console.log('PASS line 20 code return is controlflow');
        }
    }

    if (errors.length) {
        console.error('\nFAILURES:');
        for (const err of errors) console.error('-', err);
        process.exit(1);
    }

    console.log('\nAll doc_gate.qta color token tests passed.');
} catch (error) {
    console.error('FAIL', error.message);
    process.exit(1);
} finally {
    await browser.close();
}
