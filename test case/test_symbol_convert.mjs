const SYMBOL_SHORTCUTS = [
    { pattern: /\$(?:\\odot|o\.|ew\*|ElementwiseProduct)\$/g, symbol: '⊙' },
    { pattern: /\$(?:\\otimes|ox|t\*|TensorProduct)\$/g, symbol: '⊗' },
];

function applySymbolShortcuts(text) {
    let result = text;
    for (const { pattern, symbol } of SYMBOL_SHORTCUTS) {
        result = result.replace(pattern, symbol);
    }
    return result;
}

const tests = [
    ['$\\odot$', '⊙'],
    ['$o.$', '⊙'],
    ['$ew*$', '⊙'],
    ['$ElementwiseProduct$', '⊙'],
    ['$\\otimes$', '⊗'],
    ['$ox$', '⊗'],
    ['$t*$', '⊗'],
    ['$TensorProduct$', '⊗'],
    ['x $\\odot$ y $ox$ z', 'x ⊙ y ⊗ z'],
];

let failed = 0;
for (const [input, expected] of tests) {
    const got = applySymbolShortcuts(input);
    if (got !== expected) {
        console.error('FAIL', JSON.stringify(input), '->', JSON.stringify(got), 'expected', JSON.stringify(expected));
        failed++;
    } else {
        console.log('PASS', JSON.stringify(input), '->', JSON.stringify(got));
    }
}

if (failed) process.exit(1);
console.log('All symbol convert tests passed.');
