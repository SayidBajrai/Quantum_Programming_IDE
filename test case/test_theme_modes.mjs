import { chromium } from 'playwright';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:5010';
const PAGES = [
    { path: '/home', name: 'home', shell: false },
    { path: '/compiler', name: 'compiler', shell: true },
    { path: '/circuit', name: 'circuit', shell: true },
];

async function getThemeState(page) {
    return page.evaluate(() => ({
        theme: localStorage.getItem('theme') || 'dark',
        bodyClass: document.body.className,
        dataTheme: document.body.getAttribute('data-theme'),
        htmlDataTheme: document.documentElement.getAttribute('data-theme'),
        hasAppShell: document.body.classList.contains('app-shell'),
        hasLightMode: document.body.classList.contains('light-mode'),
        hasDarkMode: document.body.classList.contains('dark-mode'),
    }));
}

async function clickThemeToggle(page) {
    await page.click('#themeToggle');
    await page.waitForTimeout(200);
}

const browser = await chromium.launch();
const context = await browser.newContext();
await context.route('**/*.js', async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers(), 'cache-control': 'no-cache' };
    await route.fulfill({ response, headers });
});

const errors = [];

try {
    for (const { path, name, shell } of PAGES) {
        const page = await context.newPage();
        await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });

        let state = await getThemeState(page);
        console.log(`[${name}] initial`, state);

        if (state.theme !== 'dark') {
            localStorage.setItem('theme', 'dark');
            await page.reload({ waitUntil: 'networkidle' });
            state = await getThemeState(page);
        }

        if (!state.hasDarkMode) {
            errors.push(`${name}: missing dark-mode class on load`);
        }
        if (shell && !state.hasAppShell) {
            errors.push(`${name}: app-shell class stripped on load`);
        }

        await clickThemeToggle(page);
        state = await getThemeState(page);

        if (state.theme !== 'light') {
            errors.push(`${name}: expected light theme after toggle, got ${state.theme}`);
        }
        if (!state.hasLightMode) {
            errors.push(`${name}: missing light-mode class after toggle`);
        }
        if (state.dataTheme !== 'light' || state.htmlDataTheme !== 'light') {
            errors.push(`${name}: data-theme not light on html/body`);
        }
        if (shell && !state.hasAppShell) {
            errors.push(`${name}: app-shell class stripped after light toggle`);
        }
        if (!state.bodyClass.includes('bg-gray-50')) {
            errors.push(`${name}: body missing light background class (${state.bodyClass})`);
        }

        await clickThemeToggle(page);
        state = await getThemeState(page);

        if (state.theme !== 'dark') {
            errors.push(`${name}: expected dark theme after second toggle, got ${state.theme}`);
        }
        if (!state.hasDarkMode) {
            errors.push(`${name}: missing dark-mode class after second toggle`);
        }
        if (shell && !state.hasAppShell) {
            errors.push(`${name}: app-shell class stripped after dark toggle`);
        }

        console.log(`PASS ${name} theme toggle`);
        await page.close();
    }

    if (errors.length) {
        console.error('\nFAILURES:');
        for (const err of errors) console.error('-', err);
        process.exit(1);
    }

    console.log('\nAll theme mode tests passed.');
} catch (error) {
    console.error('FAIL', error.message);
    process.exit(1);
} finally {
    await browser.close();
}
