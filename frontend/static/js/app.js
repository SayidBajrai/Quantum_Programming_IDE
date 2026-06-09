/**
 * OpenQASM 3 Compiler & Simulator - Frontend JavaScript
 */

// DOM Elements
const codeEditorContainer = document.getElementById('codeEditor');
let monacoEditor = null; // Will be initialized with Monaco
const runBtn = document.getElementById('runBtn');
const saveBtn = document.getElementById('saveBtn');
const shotsInput = document.getElementById('shotsInput');
const errorDisplay = document.getElementById('errorDisplay');
const errorMessage = document.getElementById('errorMessage');
const resultsDisplay = document.getElementById('resultsDisplay');
const emptyState = document.getElementById('emptyState');
const statusIndicator = document.getElementById('statusIndicator');
const histogramCanvas = document.getElementById('histogramCanvas');
const countsTableBody = document.getElementById('countsTableBody');
const qubitsInfo = document.getElementById('qubitsInfo');
const shotsInfo = document.getElementById('shotsInfo');
const themeToggle = document.getElementById('themeToggle');
const sidebarToggleDesktop = document.getElementById('sidebarToggleDesktop');
const sidebarToggleMobile = document.getElementById('sidebarToggleMobile');
const sidebar = document.getElementById('sidebar');
const circuitDiagram = document.getElementById('circuitDiagram');
const circuitStatus = document.getElementById('circuitStatus');
const downloadCircuitBtn = document.getElementById('downloadCircuitBtn');
const resizeHandle = document.getElementById('resizeHandle');
const horizontalResizeHandle = document.getElementById('horizontalResizeHandle');
const editorSection = document.getElementById('editorSection');
const outputSection = document.getElementById('outputSection');
const codeEditorSection = document.getElementById('codeEditorSection');
const circuitDiagramSection = document.getElementById('circuitDiagramSection');
const rightSection = document.getElementById('rightSection');
const savedToggle = document.getElementById('savedToggle');
const savedExamples = document.getElementById('savedExamples');
const codeFormatSelect = document.getElementById('codeFormatSelect');
const keepStructureLabel = document.getElementById('keepStructureLabel');
const keepStructureCheckbox = document.getElementById('keepStructureCheckbox');
const generatedQasm = document.getElementById('generatedQasm');
const qasmStatus = document.getElementById('qasmStatus');
const debugBtn = document.getElementById('debugBtn');
const debugOutput = document.getElementById('debugOutput');
const debugStatus = document.getElementById('debugStatus');
const debugErrorDisplay = document.getElementById('debugErrorDisplay');
const debugErrorMessage = document.getElementById('debugErrorMessage');
const copyQasmBtn = document.getElementById('copyQasmBtn');
const downloadQasmBtn = document.getElementById('downloadQasmBtn');
const compareQasmCheckbox = document.getElementById('compareQasmCheckbox');
const qasmSingleView = document.getElementById('qasmSingleView');
const qasmCompareView = document.getElementById('qasmCompareView');
const generatedQasmFlat = document.getElementById('generatedQasmFlat');
const generatedQasmStructured = document.getElementById('generatedQasmStructured');
const syntaxErrorBadge = document.getElementById('syntaxErrorBadge');
const liveDebugCheckbox = document.getElementById('liveDebugCheckbox');
const compileStatsPanel = document.getElementById('compileStatsPanel');
const quantaVersionBadge = document.getElementById('quantaVersionBadge');
const exampleCategory = document.getElementById('exampleCategory');
const exampleGallery = document.getElementById('exampleGallery');
const quantaFnCategory = document.getElementById('quantaFnCategory');
const quantaFnList = document.getElementById('quantaFnList');

let lastQuantaQasmText = '';
let liveDebugTimeout = null;
let debugRunning = false;

const EXAMPLE_GALLERY = [
    // Quanta — basics
    { file: 'START_HERE.qta', label: '★ Start here', category: 'basics', lang: 'quanta', tab: 'debug', debug: true },
    { file: 'Bell Quanta.qta', label: 'Bell state', category: 'basics', lang: 'quanta' },
    { file: 'superposition.qta', label: 'Superposition', category: 'basics', lang: 'quanta' },
    { file: 'ghz.qta', label: 'GHZ state', category: 'basics', lang: 'quanta' },
    { file: 'doc_gate.qta', label: 'Documented gate', category: 'basics', lang: 'quanta' },
    { file: 'ctrl_inv_demo.qta', label: 'ctrl / inv', category: 'basics', lang: 'quanta', tab: 'debug', debug: true },
    { file: 'structured_qasm.qta', label: 'Structured QASM', category: 'basics', lang: 'quanta', tab: 'qasm' },
    // Quanta — algorithms
    { file: 'grover.qta', label: 'Grover search', category: 'algorithms', lang: 'quanta' },
    { file: 'qft.qta', label: 'QFT', category: 'algorithms', lang: 'quanta' },
    // Quanta — debug
    { file: 'debug_formats.qta', label: 'Debug formats', category: 'debug', lang: 'quanta', tab: 'debug', debug: true },
    { file: 'bloch_sphere.qta', label: 'Bloch sphere', category: 'debug', lang: 'quanta', tab: 'debug', debug: true },
    { file: 'fidelity_demo.qta', label: 'Fidelity', category: 'debug', lang: 'quanta', tab: 'debug', debug: true },
    // Quanta — arithmetic
    { file: 'qint_arithmetic.qta', label: 'QInt arithmetic', category: 'arithmetic', lang: 'quanta', tab: 'debug', debug: true },
    // OpenQASM 3
    { file: 'bell.qasm', label: 'Bell state', category: 'basics', lang: 'openqasm3' },
    { file: 'superposition.qasm', label: 'Superposition', category: 'basics', lang: 'openqasm3' },
    { file: 'ghz.qasm', label: 'GHZ state', category: 'basics', lang: 'openqasm3' },
    { file: 'phase_demo.qasm', label: 'Rotations', category: 'basics', lang: 'openqasm3' },
    { file: 'teleportation.qasm', label: 'Teleportation', category: 'algorithms', lang: 'openqasm3' },
    { file: 'openqasm3_features.qasm', label: 'OQ3 advanced', category: 'advanced', lang: 'openqasm3' },
];

// Global variable to store Monaco theme configuration
let monacoThemeConfig = null;

// Currently opened saved file (null = new/unsaved file)
let currentOpenFilename = null;

function getFileBaseName(filename) {
    if (!filename) return '';
    return filename.replace(/\.(qasm3?|qta)$/i, '');
}

function setCurrentOpenFilename(filename) {
    currentOpenFilename = filename || null;
}

// Load Monaco theme configuration from config.json
async function loadMonacoThemeConfig() {
    try {
        const response = await fetch('/config.json');
        if (!response.ok) {
            throw new Error(`Failed to load config.json: ${response.status}`);
        }
        const config = await response.json();
        monacoThemeConfig = config.monacoThemes;
        console.log('Monaco theme config loaded successfully');
        return monacoThemeConfig;
    } catch (error) {
        console.error('Error loading Monaco theme config:', error);
        // Return null to indicate failure
        return null;
    }
}

function normalizeLineEndings(text) {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// Load saved examples from files
async function loadSavedExample(exampleName) {
    try {
        // Handle both filename with and without extension
        let filename = exampleName;
        if (!filename.endsWith('.qasm') && !filename.endsWith('.qasm3') && !filename.endsWith('.qta')) {
            // Try to determine extension from filename or default to .qasm
            filename = `${exampleName}.qasm`;
        }
        const response = await fetch(`/static/Saved/${filename}`);
        if (!response.ok) {
            throw new Error(`Failed to load ${filename}`);
        }
        return normalizeLineEndings(await response.text());
    } catch (error) {
        console.error(`Error loading ${exampleName}:`, error);
        return '';
    }
}

// Initialize Monaco Editor
function initializeMonacoEditor() {
    if (typeof require === 'undefined') {
        console.error('Monaco Editor loader not found');
        return;
    }
    
    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
    
    require(['vs/editor/editor.main'], function () {
        // Register OpenQASM 3 language
        monaco.languages.register({ id: 'openqasm3' });
        
        // Register Quanta language
        monaco.languages.register({ id: 'quanta' });
        
        // Define OpenQASM 3 language tokens
        monaco.languages.setMonarchTokensProvider('openqasm3', {
            tokenizer: {
                root: [
                    // Comments must come first to override everything else
                    [/\/\/.*$/, 'comment'],  // Single-line comments
                    [/\/\*[\s\S]*?\*\//, 'comment'],  // Multi-line comments
                    
                    // Control flow keywords (purple) - including break, continue, return
                    [/\b(include|if|else|for|while|break|continue|return)\b/, 'controlflow'],
                    [/else\s+if/, 'controlflow'],  // Handle "else if" as one token
                    
                    // Modifiers (italic) - ctrl, inv, gphase must come before gates to match them first
                    [/\b(ctrl|inv)\b/, 'modifiers'], 
                    
                    // Built-in gates (yellow - function-like)
                    // Match built-in gates as whole words (with or without following parenthesis)
                    [/\b(h|x|y|z|s|cx|cy|cz|ch|swap|ccx|cswap|u|p|rx|ry|rz|r|crx|cry|crz|cu|cp|phase|cphase|id|tdg|sdg)\b/, 'function-like'],
                    
                    // measure and reset (yellow - function-like)
                    [/\b(measure|reset)\b/, 'function-like-2'],
                    
                    // Gate/function definitions: match keyword and function name separately
                    [/\bgate\b/, 'keyword'],
                    [/\bdef\b/, 'keyword'],
                    [/\bcal\b/, 'keyword'],
                    [/\bdefcal\b/, 'keyword'],
                    
                    // Function/gate calls: identifier followed by ( , example: my_gate(a * 2) aliased[0], q[{1, 2}][0]; so the 'my_gate' is yellow and not 'my_gate('
                    // Built-in gates are already matched above, so remaining identifiers with ( are functions
                    [/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/, 'function'],
                    
                    // Language keyword (gray) - OPENQASM 3.0; or OPENQASM 3;
                    [/OPENQASM\s+\d+\.\d+;$/, 'language'],

                    // Keywords (dark blue) - qubit, bit, include, let, gate
                    [/\b(qubit|bit|let|gate|box|const|input|float)\b/, 'keyword'],
                    
                    // Operators
                    [/[+\-*/=<>!&|]+/, 'operator'],
                    [/[(),;\[\]{}]/, 'delimiter'],
                    
                    // Numbers
                    [/\d+\.?\d*/, 'number'], 
                    
                    // Strings
                    [/["'][^"']*["']/, 'string'],
                    
                    // Match parameters in gate/function definitions: identifiers after ) and before {
                    // Pattern: gate name(params) param1, param2 { or def name(params) param1, param2 {
                    // Match identifiers that appear after ) when followed by comma, space+comma, or space+{
                    [/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\s*[,{])/, 'in-value'],  // Parameters in gate/def signatures (c, t in gate my_gate(a) c, t {)
                    
                    // Identifiers
                    [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'], 
                    
                    // Whitespace
                    [/\s+/, 'white']
                ]
            }
        });
        
        // Define Quanta language tokens (0.1.14 spec)
        const quantaDocTypePattern = /\b(?:var|qbit|bit|qint|bint|qdec|qfloat|int|float|bool|str|list|dict)(?:\[[^\]]*\])?\b/;
        monaco.languages.setMonarchTokensProvider('quanta', {
            tokenizer: {
                root: [
                    [/\/\/\//, { token: 'comment', next: '@docline' }],
                    [/\/\/.*$/, 'comment'],

                    [/\b(if|else|for|while|break|continue|return)\b/, 'controlflow'],
                    [/else\s+if/, 'controlflow'],

                    [/\b(ctrl|inv)\b/, 'modifiers'],

                    [/\b(H|X|Y|Z|S|T|CNot|CNOT|CZ|Swap|SWAP|RZ|RY|RX|Measure|CCX|CCNot|Bell|GHZ|WState|SwapGate|QFT|InverseQFT)\b/, 'function-like'],
                    [/\b(QAdd|QMult|QSub|QDiv|QMod|QFTAdd|QTreeAdd|QExpEncMult|QTreeMult|Compare|Grover)\b/, 'function-like'],
                    [/\b(Print|Len|Range|Assert|Fidelity|Error|Warn|Shape|Reshape|DotProduct|CrossProduct|ElementwiseProduct|TensorProduct)\b/, 'function'],
                    [/\b(reset)\b/, 'function-like-2'],

                    [/\b(func|gate|class|var|let|const)\b/, 'keyword'],
                    [/\b(qbit|bit|qint|bint|qdec|qfloat|int|float|bool|str|list|dict)\b/, 'keyword'],

                    [/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/, 'function'],

                    [/[⊙⊗]/, 'operator'],
                    [/[+\-*/%=<>!&|.]+/, 'operator'],
                    [/[(),;\[\]{}]/, 'delimiter'],
                    [/\d+\.?\d*/, 'number'],
                    [/f"(?:\\.|[^"\\])*"/, 'string'],
                    [/"(?:\\.|[^"\\])*"/, 'string'],
                    [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],
                    [/\s+/, 'white']
                ],
                docline: [
                    [/\s+/, 'comment'],
                    [/-.*$/, 'comment', '@pop'],
                    [/\breturn\b/, 'controlflow'],
                    [/\s*:/, 'comment'],
                    [quantaDocTypePattern, 'keyword'],
                    [/\s+/, 'comment'],
                    [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],
                    [/\s+-\s+.*$/, 'comment', '@pop'],
                    [/.*$/, 'comment', '@pop']
                ]
            }
        });

        if (typeof setupQuantaIntelliSense === 'function') {
            setupQuantaIntelliSense(monaco);
        }
        
        // Define theme colors
        const currentTheme = localStorage.getItem('theme') || 'dark';
        const isDark = currentTheme === 'dark';
        
        updateMonacoEditorTheme(isDark);
        
        // Get initial language from selector (if available) or localStorage
        let savedLanguage = 'openqasm3';
        if (codeFormatSelect) {
            savedLanguage = codeFormatSelect.value || localStorage.getItem('codeFormat') || 'openqasm3';
        } else {
            savedLanguage = localStorage.getItem('codeFormat') || 'openqasm3';
        }
        const initialLanguage = savedLanguage === 'quanta' ? 'quanta' : 'openqasm3';
        const initialValue = initialLanguage === 'quanta' ? '// Quanta code\n' : 'OPENQASM 3;\n';
        const initialTheme = initialLanguage === 'quanta' ? 'quanta-theme' : 'openqasm-theme';
        
        // Create editor instance
        monacoEditor = monaco.editor.create(codeEditorContainer, {
            value: initialValue,
            language: initialLanguage,
            theme: initialTheme,
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            tabSize: 4,
            insertSpaces: true,
            formatOnPaste: false,
            formatOnType: false
        });

        window.monacoEditor = monacoEditor;

        if (typeof setupQuantaDocAutoGenerate === 'function') {
            setupQuantaDocAutoGenerate(monacoEditor);
        }
        if (typeof setupQuantaSymbolConvert === 'function') {
            setupQuantaSymbolConvert(monacoEditor);
        }
        if (typeof setupQuantaDocCacheInvalidation === 'function') {
            setupQuantaDocCacheInvalidation(monacoEditor);
        }
        
        // Set up real-time error detection
        setupMonacoErrorDetection();
        
        // Set up change listener for circuit diagram and QASM updates
        monacoEditor.onDidChangeModelContent(() => {
            clearTimeout(window.circuitUpdateTimeout);
            window.circuitUpdateTimeout = setTimeout(() => {
                updateCircuitDiagram();
                updateGeneratedQasm();
                refreshQuantaFunctionBrowser();
            }, 500);
            scheduleLiveDebug();
        });

        initExampleGallery();
        initQuantaExtras();
        
        // Keyboard shortcut: Ctrl+Enter to run, Ctrl+Shift+Enter to debug
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            runSimulation();
        });
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
            runDebug();
        });
        
        // Initialize circuit diagram and Quanta UI
        if (circuitDiagram) {
            setTimeout(async () => {
                updateCircuitDiagram();
                updateQuantaUI();
                await loadExampleFromUrl();
            }, 100);
        }
    });
}

// Set up real-time error detection for Monaco
function setupMonacoErrorDetection() {
    if (!monacoEditor) return;
    
    // Debounced error checking
    let errorCheckTimeout;
    monacoEditor.onDidChangeModelContent(() => {
        clearTimeout(errorCheckTimeout);
        errorCheckTimeout = setTimeout(() => {
            checkSyntaxErrors();
        }, 1000); // Check after 1 second of no typing
    });
}

function buildErrorMarkers(data, langId) {
    let line = data.line;
    let column = data.column;

    if (!line && data.error) {
        const lineMatch = data.error.match(/\(line\s+(\d+)(?:,\s*column\s+(\d+))?\)/i)
            || data.error.match(/line\s+(\d+)/i);
        if (lineMatch) {
            line = parseInt(lineMatch[1], 10);
            if (lineMatch[2]) column = parseInt(lineMatch[2], 10);
        }
    }

    const lineNumber = line || 1;
    const colNumber = column || 1;
    const category = data.category ? `[${data.category}] ` : '';
    const message = `${category}${data.error || 'Compilation error'}`;

    return [{
        severity: monaco.MarkerSeverity.Error,
        startLineNumber: lineNumber,
        startColumn: colNumber,
        endLineNumber: lineNumber,
        endColumn: colNumber + 1,
        message
    }];
}

function updateSyntaxErrorBadge(data, isValid) {
    if (!syntaxErrorBadge) return;
    if (isValid || !data || !data.error) {
        syntaxErrorBadge.classList.add('hidden');
        return;
    }
    const category = data.category || 'error';
    const colors = {
        syntax: 'border-red-600 text-red-400 bg-red-950/50',
        semantic: 'border-orange-600 text-orange-400 bg-orange-950/50',
        type: 'border-yellow-600 text-yellow-400 bg-yellow-950/50',
        compilation: 'border-red-600 text-red-400 bg-red-950/50',
        unknown: 'border-gray-600 text-gray-400 bg-gray-950/50'
    };
    syntaxErrorBadge.className = `absolute top-2 right-2 z-10 px-2 py-1 text-xs rounded border ${colors[category] || colors.unknown}`;
    syntaxErrorBadge.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    syntaxErrorBadge.title = data.error;
    syntaxErrorBadge.classList.remove('hidden');
}

// Check for syntax errors
async function checkSyntaxErrors() {
    if (!monacoEditor) return;

    const code = monacoEditor.getValue();
    const language = codeFormatSelect ? codeFormatSelect.value : 'openqasm3';
    const langId = language === 'quanta' ? 'quanta' : 'openqasm3';

    if (!code.trim()) {
        monaco.editor.setModelMarkers(monacoEditor.getModel(), langId, []);
        return;
    }

    try {
        const endpoint = language === 'quanta' ? '/check-quanta' : '/circuit-diagram';
        const body = language === 'quanta'
            ? { code: code }
            : { code: code, language: language };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (language === 'quanta') {
            if (!data.valid && data.error) {
                monaco.editor.setModelMarkers(
                    monacoEditor.getModel(), langId, buildErrorMarkers(data, langId)
                );
                updateSyntaxErrorBadge(data, false);
            } else {
                monaco.editor.setModelMarkers(monacoEditor.getModel(), langId, []);
                updateSyntaxErrorBadge(null, true);
            }
        } else if (!data.success && data.error) {
            monaco.editor.setModelMarkers(
                monacoEditor.getModel(), langId, buildErrorMarkers(data, langId)
            );
            updateSyntaxErrorBadge(data, false);
        } else {
            monaco.editor.setModelMarkers(monacoEditor.getModel(), langId, []);
            updateSyntaxErrorBadge(null, true);
        }
    } catch (error) {
        console.error('Error checking syntax:', error);
    }
}

function updateQuantaUI() {
    const language = codeFormatSelect ? codeFormatSelect.value : 'openqasm3';
    const isQuanta = language === 'quanta';

    document.querySelectorAll('.quanta-only').forEach(el => {
        el.classList.toggle('hidden', !isQuanta);
    });

    if (keepStructureLabel) {
        keepStructureLabel.classList.toggle('hidden', !isQuanta);
    }
    if (compileStatsPanel) {
        compileStatsPanel.classList.toggle('hidden', !isQuanta);
    }
    if (quantaVersionBadge) {
        quantaVersionBadge.classList.toggle('hidden', !isQuanta);
    }

    if (isQuanta) {
        updateGeneratedQasm();
        refreshQuantaFunctionBrowser();
        fetchQuantaVersion();
    } else if (generatedQasm) {
        generatedQasm.textContent = '// Generated QASM is available when editing Quanta code';
        if (qasmStatus) qasmStatus.textContent = 'N/A';
        if (compileStatsPanel) compileStatsPanel.innerHTML = '';
    }
}

async function fetchQuantaVersion() {
    if (!quantaVersionBadge) return;
    try {
        const res = await fetch('/quanta-version');
        const data = await res.json();
        if (data.success) {
            quantaVersionBadge.textContent = `quanta ${data.installed}`;
            quantaVersionBadge.title = `Required: >=${data.required_min}`;
        }
    } catch { /* ignore */ }
}

function refreshQuantaFunctionBrowser() {
    if (typeof populateQuantaFunctionBrowser !== 'function') return;
    const language = codeFormatSelect ? codeFormatSelect.value : 'openqasm3';
    if (language !== 'quanta') return;
    const source = monacoEditor ? monacoEditor.getValue() : '';
    populateQuantaFunctionBrowser(quantaFnCategory, quantaFnList, source);
}

function initQuantaExtras() {
    fetchQuantaVersion();
    refreshQuantaFunctionBrowser();
}

function initExampleGallery() {
    if (!exampleGallery) return;
    function render() {
        const cat = exampleCategory ? exampleCategory.value : 'all';
        const language = codeFormatSelect ? codeFormatSelect.value : 'openqasm3';
        const items = EXAMPLE_GALLERY.filter(e =>
            (cat === 'all' || e.category === cat) && e.lang === language
        );
        exampleGallery.innerHTML = items.length
            ? items.map(e =>
                `<button type="button" class="example-gallery-btn w-full text-left px-2 py-1 rounded hover:bg-gray-800 text-xs text-gray-300" data-file="${e.file}" data-tab="${e.tab || ''}" data-debug="${e.debug ? '1' : ''}">${e.label}</button>`
            ).join('')
            : '<div class="text-xs text-gray-500 px-2">No examples for this language/category</div>';
        exampleGallery.querySelectorAll('.example-gallery-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                loadExampleIntoEditor(btn.dataset.file, {
                    tab: btn.dataset.tab || undefined,
                    runDebug: btn.dataset.debug === '1',
                });
            });
        });
    }
    if (exampleCategory) exampleCategory.addEventListener('change', render);
    if (codeFormatSelect) codeFormatSelect.addEventListener('change', render);
    render();
}

async function loadExampleIntoEditor(filename, options = {}) {
    const code = await loadSavedExample(filename);
    if (!code || !monacoEditor) return false;

    const lang = options.lang
        || (filename.toLowerCase().endsWith('.qta') ? 'quanta' : 'openqasm3');

    if (codeFormatSelect) {
        codeFormatSelect.value = lang;
        localStorage.setItem('codeFormat', lang);
    }
    monaco.editor.setModelLanguage(monacoEditor.getModel(), lang === 'quanta' ? 'quanta' : 'openqasm3');
    monacoEditor.updateOptions({ theme: lang === 'quanta' ? 'quanta-theme' : 'openqasm-theme' });
    monacoEditor.setValue(code);
    setCurrentOpenFilename(filename);
    updateQuantaUI();
    updateCircuitDiagram();

    if (options.tab) switchRightTab(options.tab);
    if (options.runDebug && lang === 'quanta') {
        setTimeout(() => runDebug({ silent: false }), 300);
    }
    return true;
}

async function loadExampleFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const example = params.get('example');
    if (!example) return;
    const lang = params.get('lang') || undefined;
    const tab = params.get('tab') || undefined;
    const runDebug = params.get('debug') === '1' || tab === 'debug';
    await loadExampleIntoEditor(example, { lang, tab, runDebug });
}

window.loadExampleIntoEditor = loadExampleIntoEditor;

async function updateCompileStats(code) {
    if (!compileStatsPanel) return;
    if (!code || !code.trim()) {
        compileStatsPanel.innerHTML = '';
        return;
    }
    try {
        const res = await fetch('/compile-stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (!data.success || !data.stats) {
            compileStatsPanel.innerHTML = '';
            return;
        }
        const flat = data.stats.flat || {};
        const structured = data.stats.structured || {};
        compileStatsPanel.innerHTML = `
            <span>Flat: ${flat.qasm_lines ?? '?'} lines · ${flat.gate_ops ?? '?'} gates</span>
            <span>Structured: ${structured.qasm_lines ?? '?'} lines · ${structured.gate_ops ?? '?'} gates</span>
        `;
    } catch {
        compileStatsPanel.innerHTML = '';
    }
}

function scheduleLiveDebug() {
    if (!liveDebugCheckbox || !liveDebugCheckbox.checked) return;
    const language = codeFormatSelect ? codeFormatSelect.value : 'openqasm3';
    if (language !== 'quanta') return;
    clearTimeout(liveDebugTimeout);
    liveDebugTimeout = setTimeout(() => {
        if (!debugRunning) runDebug({ silent: true });
    }, 1500);
}

async function updateGeneratedQasm() {
    if (!generatedQasm || !qasmStatus) return;

    const language = codeFormatSelect ? codeFormatSelect.value : 'openqasm3';
    if (language !== 'quanta') return;

    const code = normalizeLineEndings(monacoEditor ? monacoEditor.getValue() : '').trim();
    const keepStructure = keepStructureCheckbox ? keepStructureCheckbox.checked : false;
    const compareModes = compareQasmCheckbox ? compareQasmCheckbox.checked : false;

    if (qasmSingleView && qasmCompareView) {
        qasmSingleView.classList.toggle('hidden', compareModes);
        qasmCompareView.classList.toggle('hidden', !compareModes);
        if (compareModes) {
            qasmSingleView.classList.remove('flex-1', 'min-h-0');
            qasmCompareView.classList.add('flex-1', 'min-h-0');
        } else {
            qasmSingleView.classList.add('flex-1', 'min-h-0');
        }
    }

    if (!code) {
        const empty = '// Generated QASM will appear here when editing Quanta code';
        generatedQasm.textContent = empty;
        if (generatedQasmFlat) generatedQasmFlat.textContent = empty;
        if (generatedQasmStructured) generatedQasmStructured.textContent = empty;
        lastQuantaQasmText = '';
        qasmStatus.textContent = 'Ready';
        return;
    }

    qasmStatus.textContent = 'Compiling...';

    try {
        const body = compareModes
            ? { code, include_both: true }
            : { code, keep_structure: keepStructure };

        const response = await fetch('/compile-to-qasm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (data.success) {
            if (compareModes) {
                if (generatedQasmFlat) generatedQasmFlat.textContent = data.qasm_flat;
                if (generatedQasmStructured) generatedQasmStructured.textContent = data.qasm_structured;
                lastQuantaQasmText = data.qasm_flat;
                qasmStatus.textContent = 'Valid (compare)';
            } else {
                generatedQasm.textContent = data.qasm;
                lastQuantaQasmText = data.qasm;
                qasmStatus.textContent = keepStructure ? 'Valid (structured)' : 'Valid (flattened)';
            }
            updateCompileStats(code);
        } else {
            const err = data.error || 'Compilation failed';
            generatedQasm.textContent = err;
            if (generatedQasmFlat) generatedQasmFlat.textContent = err;
            if (generatedQasmStructured) generatedQasmStructured.textContent = err;
            lastQuantaQasmText = '';
            qasmStatus.textContent = 'Invalid';
        }
    } catch (error) {
        const err = `Error: ${error.message}`;
        generatedQasm.textContent = err;
        if (generatedQasmFlat) generatedQasmFlat.textContent = err;
        if (generatedQasmStructured) generatedQasmStructured.textContent = err;
        lastQuantaQasmText = '';
        qasmStatus.textContent = 'Error';
    }
}

function getActiveQasmText() {
    if (compareQasmCheckbox && compareQasmCheckbox.checked && generatedQasmFlat) {
        return generatedQasmFlat.textContent || lastQuantaQasmText;
    }
    return lastQuantaQasmText || (generatedQasm ? generatedQasm.textContent : '');
}

async function copyGeneratedQasm() {
    const text = getActiveQasmText();
    if (!text || text.startsWith('//') || text.startsWith('Error')) {
        alert('No valid QASM to copy');
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        if (qasmStatus) qasmStatus.textContent = 'Copied to clipboard';
    } catch {
        alert('Failed to copy to clipboard');
    }
}

function downloadGeneratedQasm() {
    const text = getActiveQasmText();
    if (!text || text.startsWith('//') || text.startsWith('Error')) {
        alert('No valid QASM to download');
        return;
    }
    const base = currentOpenFilename ? getFileBaseName(currentOpenFilename) : 'circuit';
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}.qasm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (qasmStatus) qasmStatus.textContent = 'Downloaded';
}

function insertDebugSnippet(snippet) {
    if (!monacoEditor || !snippet) return;
    const model = monacoEditor.getModel();
    const pos = monacoEditor.getPosition();
    if (!pos) return;
    monacoEditor.executeEdits('debug-snippet', [{
        range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
        text: snippet + '\n',
        forceMoveMarkers: true
    }]);
    monacoEditor.focus();
}

async function runDebug(options = {}) {
    const silent = options.silent === true;
    if (!debugOutput) return;

    const code = normalizeLineEndings(monacoEditor ? monacoEditor.getValue() : '').trim();
    const language = codeFormatSelect ? codeFormatSelect.value : 'openqasm3';

    if (language !== 'quanta') {
        return;
    }

    if (!code) {
        if (!silent) {
            if (debugErrorMessage) debugErrorMessage.textContent = 'Please enter some Quanta code';
            if (debugErrorDisplay) debugErrorDisplay.classList.remove('hidden');
        }
        return;
    }

    if (debugRunning) return;
    debugRunning = true;
    if (debugBtn) debugBtn.disabled = true;
    if (debugStatus) debugStatus.textContent = silent ? 'Live debug...' : 'Running statevector debug...';
    if (debugErrorDisplay) debugErrorDisplay.classList.add('hidden');
    if (!silent) switchRightTab('debug');

    try {
        const response = await fetch('/debug-prints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });

        const data = await response.json();

        if (data.success) {
            if (typeof updateDebugOutput === 'function') {
                updateDebugOutput(data);
            } else {
                debugOutput.textContent = data.output || '(no output)';
            }
            if (debugStatus) {
                const warn = (data.warnings || []).join(' ');
                debugStatus.textContent = warn ? `Debug complete — ${warn}` : (silent ? 'Live debug ready' : 'Debug complete');
            }
        } else {
            if (!silent) {
                if (typeof updateDebugOutput === 'function') {
                    updateDebugOutput({ output: 'Run debug to see Print() output here', blocks: [], warnings: [] });
                } else {
                    debugOutput.textContent = 'Run debug to see Print() output here';
                }
                if (debugErrorMessage) debugErrorMessage.textContent = data.error || 'Debug failed';
                if (debugErrorDisplay) debugErrorDisplay.classList.remove('hidden');
                if (debugStatus) debugStatus.textContent = 'Debug failed';
            } else if (debugStatus) {
                debugStatus.textContent = data.error || 'Live debug error';
            }
        }
    } catch (error) {
        if (!silent) {
            if (debugErrorMessage) debugErrorMessage.textContent = `Network error: ${error.message}`;
            if (debugErrorDisplay) debugErrorDisplay.classList.remove('hidden');
        }
        if (debugStatus) debugStatus.textContent = 'Error';
    } finally {
        debugRunning = false;
        if (debugBtn) debugBtn.disabled = false;
    }
}

function syncAppShellLayout() {
    const topBar = document.getElementById('topBar');
    if (topBar) {
        document.documentElement.style.setProperty('--top-bar-height', `${topBar.offsetHeight}px`);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    syncAppShellLayout();
    initializeThemeIcon();
    loadTheme();
    syncAppShellLayout();
    loadSidebarState();
    loadResizeState();
    loadSidebarSectionStates();

    if (debugOutput) {
        const blochHandlers = typeof setupBlochHandlers === 'function' ? setupBlochHandlers() : null;
        if (typeof setupDebugVisualizers === 'function') {
            setupDebugVisualizers(debugOutput, blochHandlers);
        }
    }
    
    // Load Monaco theme config; circuit builder initializes its own editor instance
    loadMonacoThemeConfig().then(() => {
        if (codeEditorContainer && !document.getElementById('circuitBuilder')) {
            initializeMonacoEditor();
        }
    }).catch((error) => {
        console.error('Failed to load Monaco theme config, using defaults:', error);
        if (codeEditorContainer && !document.getElementById('circuitBuilder')) {
            initializeMonacoEditor();
        }
    });
    
    setupEventListeners();
    
    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            syncAppShellLayout();
            updateResizeOnWindowResize();
            if (monacoEditor) {
                monacoEditor.layout();
            }
            if (window.circuitBuilderMonacoEditor) {
                window.circuitBuilderMonacoEditor.layout();
            }
        }, 100); // Debounce resize events
    });
});

function loadResizeState() {
    const resizeTarget = rightSection || circuitDiagramSection;
    const resizeLeft = document.getElementById('circuitBuilderSection') || codeEditorSection;
    if (resizeLeft && resizeTarget) {
        const savedLeftWidth = localStorage.getItem('codeEditorWidth');
        const savedRightWidth = localStorage.getItem('circuitDiagramWidth');

        if (savedLeftWidth && savedRightWidth) {
            resizeLeft.style.width = savedLeftWidth;
            resizeTarget.style.width = savedRightWidth;
        }
    }
}

function updateResizeOnWindowResize() {
    const resizeTarget = rightSection || circuitDiagramSection;
    const resizeLeft = document.getElementById('circuitBuilderSection') || codeEditorSection;

    if (resizeLeft && resizeTarget) {
        const savedLeftWidth = localStorage.getItem('codeEditorWidth');
        const savedRightWidth = localStorage.getItem('circuitDiagramWidth');

        if (savedLeftWidth && savedRightWidth) {
            if (savedLeftWidth.includes('%')) {
                resizeLeft.style.width = savedLeftWidth;
                resizeTarget.style.width = savedRightWidth;
            } else if (savedLeftWidth.includes('px')) {
                const container = editorSection;
                if (container) {
                    const containerWidth = container.offsetWidth;
                    const resizeHandleWidth = horizontalResizeHandle ? horizontalResizeHandle.offsetWidth : 8;
                    const availableWidth = containerWidth - resizeHandleWidth;

                    const leftWidthPx = parseFloat(savedLeftWidth);
                    const rightWidthPx = parseFloat(savedRightWidth);
                    const totalSavedWidth = leftWidthPx + rightWidthPx;

                    if (totalSavedWidth > 0 && availableWidth > 0) {
                        const leftPercent = (leftWidthPx / availableWidth) * 100;
                        const rightPercent = (rightWidthPx / availableWidth) * 100;

                        resizeLeft.style.width = `${leftPercent}%`;
                        resizeTarget.style.width = `${rightPercent}%`;

                        localStorage.setItem('codeEditorWidth', resizeLeft.style.width);
                        localStorage.setItem('circuitDiagramWidth', resizeTarget.style.width);
                    }
                }
            }
        }
    }
    
    // Redraw histogram if visible (canvas might need resizing)
    if (histogramCanvas && resultsDisplay && !resultsDisplay.classList.contains('hidden')) {
        setTimeout(() => {
            const tableRows = document.querySelectorAll('#countsTableBody tr');
            const counts = {};
            tableRows.forEach(row => {
                const state = row.querySelector('td:first-child')?.textContent;
                const count = parseInt(row.querySelector('td:nth-child(2)')?.textContent);
                if (state && count) {
                    counts[state] = count;
                }
            });
            if (Object.keys(counts).length > 0) {
                drawHistogram(counts);
            }
        }, 10);
    }
}

const SIDEBAR_COLLAPSED_ICON = 'M19 9l-7 7-7-7';
const SIDEBAR_EXPANDED_ICON = 'M5 15l7-7 7 7';

function setSidebarSectionCollapsed(contentEl, toggleIcon, collapsed) {
    if (!contentEl) return;
    if (collapsed) {
        contentEl.classList.add('hidden');
        if (toggleIcon) toggleIcon.setAttribute('d', SIDEBAR_COLLAPSED_ICON);
    } else {
        contentEl.classList.remove('hidden');
        if (toggleIcon) toggleIcon.setAttribute('d', SIDEBAR_EXPANDED_ICON);
    }
}

function initSidebarSectionToggle(toggleBtn, contentEl, storageKey, onExpand) {
    if (!toggleBtn || !contentEl) return;
    const toggleIcon = toggleBtn.querySelector('path');
    const isCollapsed = localStorage.getItem(storageKey) === 'true';
    setSidebarSectionCollapsed(contentEl, toggleIcon, isCollapsed);
    if (!isCollapsed && onExpand) onExpand();

    toggleBtn.addEventListener('click', () => {
        const isCurrentlyCollapsed = contentEl.classList.contains('hidden');
        if (isCurrentlyCollapsed) {
            setSidebarSectionCollapsed(contentEl, toggleIcon, false);
            localStorage.setItem(storageKey, 'false');
            if (onExpand) onExpand();
        } else {
            setSidebarSectionCollapsed(contentEl, toggleIcon, true);
            localStorage.setItem(storageKey, 'true');
        }
    });
}

function loadSidebarSectionStates() {
    initSidebarSectionToggle(savedToggle, savedExamples, 'savedCollapsed', loadSavedFiles);
    initSidebarSectionToggle(
        document.getElementById('functionsToggle'),
        document.getElementById('functionsContent'),
        'functionsCollapsed',
        refreshQuantaFunctionBrowser
    );
    initSidebarSectionToggle(
        document.getElementById('examplesToggle'),
        document.getElementById('examplesContent'),
        'examplesCollapsed'
    );
}

async function loadSavedFiles() {
    if (!savedExamples) return;
    
    try {
        const response = await fetch('/saved-files');
        const data = await response.json();
        
        if (data.success && data.files) {
            savedExamples.innerHTML = '';
            
            if (data.files.length === 0) {
                savedExamples.innerHTML = '<div class="text-xs text-gray-500 px-3 py-2">No saved files</div>';
                return;
            }
            
            // Get current theme for button styling
            const currentTheme = localStorage.getItem('theme') || 'dark';
            const isDark = currentTheme === 'dark';
            const strokeColor = isDark ? '#ffffff' : '#000000';
            
            data.files.forEach(file => {
                // Create container with group class for hover effects
                const container = document.createElement('div');
                container.className = `example-btn-container group relative w-full rounded transition mb-2 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`;
                
                // Create main button
                const button = document.createElement('button');
                button.className = `w-full text-left px-3 py-2 text-sm flex items-center justify-between ${isDark ? 'text-gray-100' : 'text-gray-900'}`;
                button.setAttribute('data-example', file.filename);
                
                // File name span
                const nameSpan = document.createElement('span');
                nameSpan.className = 'flex-1 truncate';
                nameSpan.textContent = file.filename;
                nameSpan.setAttribute('data-filename', file.filename);
                
                // Actions container (only visible on hover)
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity';
                
                // Edit name button
                const editBtn = document.createElement('button');
                editBtn.className = `p-1 rounded transition ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-400'}`;
                editBtn.setAttribute('data-action', 'edit');
                editBtn.setAttribute('data-filename', file.filename);
                editBtn.title = 'Edit name';
                editBtn.innerHTML = `<svg class="edit-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path></svg>`;
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    editFileName(file.filename, nameSpan);
                });
                
                // Download button
                const downloadBtn = document.createElement('button');
                downloadBtn.className = `p-1 rounded transition ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-400'}`;
                downloadBtn.setAttribute('data-action', 'download');
                downloadBtn.setAttribute('data-filename', file.filename);
                downloadBtn.title = 'Download';
                downloadBtn.innerHTML = `<svg class="download-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>`;
                downloadBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    downloadFile(file.filename);
                });
                
                // Delete button
                const deleteBtn = document.createElement('button');
                deleteBtn.className = `p-1 rounded transition ${isDark ? 'hover:bg-red-600' : 'hover:bg-red-400'}`;
                deleteBtn.setAttribute('data-action', 'delete');
                deleteBtn.setAttribute('data-filename', file.filename);
                deleteBtn.title = 'Delete';
                deleteBtn.innerHTML = `<svg class="delete-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>`;
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteFile(file.filename);
                });
                
                // Add buttons to actions container
                actionsDiv.appendChild(editBtn);
                actionsDiv.appendChild(downloadBtn);
                actionsDiv.appendChild(deleteBtn);
                
                // Add name and actions to button
                button.appendChild(nameSpan);
                button.appendChild(actionsDiv);
                
                // Main button click handler (loads file)
                button.addEventListener('click', async () => {
                    const code = await loadSavedExample(file.filename);
                    if (code && monacoEditor) {
                        // Detect file extension and set language selector accordingly
                        const filename = file.filename.toLowerCase();
                        let detectedLanguage = 'openqasm3';
                        let detectedTheme = 'openqasm-theme';
                        
                        if (filename.endsWith('.qta')) {
                            detectedLanguage = 'quanta';
                            detectedTheme = 'quanta-theme';
                        } else if (filename.endsWith('.qasm') || filename.endsWith('.qasm3')) {
                            detectedLanguage = 'openqasm3';
                            detectedTheme = 'openqasm-theme';
                        }
                        
                        // Update language selector if it exists
                        if (codeFormatSelect) {
                            codeFormatSelect.value = detectedLanguage;
                            localStorage.setItem('codeFormat', detectedLanguage);
                        }
                        
                        // Update Monaco editor language and theme
                        monaco.editor.setModelLanguage(monacoEditor.getModel(), detectedLanguage);
                        monacoEditor.updateOptions({ theme: detectedTheme });
                        
                        // Set the code
                        monacoEditor.setValue(code);
                        setCurrentOpenFilename(file.filename);
                        updateCircuitDiagram();
                        updateQuantaUI();
                    }
                });
                
                // Add button to container
                container.appendChild(button);
                savedExamples.appendChild(container);
            });
        } else {
            savedExamples.innerHTML = '<div class="text-xs text-red-400 px-3 py-2">Error loading saved files</div>';
        }
    } catch (error) {
        console.error('Error loading saved files:', error);
        savedExamples.innerHTML = '<div class="text-xs text-red-400 px-3 py-2">Error loading saved files</div>';
    }
}

async function editFileName(filename, nameElement) {
    const currentName = getFileBaseName(filename);
    const isQta = filename.toLowerCase().endsWith('.qta');
    const extensionHint = isQta ? 'without .qta extension' : 'without .qasm extension';
    const newName = prompt(`Enter new filename (${extensionHint}):`, currentName);
    
    if (!newName || !newName.trim() || newName.trim() === currentName) {
        return;
    }
    
    try {
        const response = await fetch('/rename-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                oldFilename: filename,
                newFilename: newName.trim()
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (currentOpenFilename === filename) {
                const isQta = filename.toLowerCase().endsWith('.qta');
                const ext = isQta ? '.qta' : (filename.toLowerCase().endsWith('.qasm3') ? '.qasm3' : '.qasm');
                const renamed = newName.trim().endsWith(ext) ? newName.trim() : `${newName.trim()}${ext}`;
                setCurrentOpenFilename(renamed);
            }
            loadSavedFiles();
        } else {
            alert(`Error renaming file: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error renaming file:', error);
        alert(`Error renaming file: ${error.message}`);
    }
}

async function downloadFile(filename) {
    try {
        const content = await loadSavedExample(filename);
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading file:', error);
        alert(`Error downloading file: ${error.message}`);
    }
}

async function deleteFile(filename) {
    const confirmDelete = confirm(`Are you sure you want to delete "${filename}"?`);
    if (!confirmDelete) {
        return;
    }
    
    try {
        const response = await fetch('/delete-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: filename
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (currentOpenFilename === filename) {
                setCurrentOpenFilename(null);
            }
            loadSavedFiles();
        } else {
            alert(`Error deleting file: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        alert(`Error deleting file: ${error.message}`);
    }
} 

function setupEventListeners() {
    setupRightSectionTabs();

    if (runBtn) {
        runBtn.addEventListener('click', runSimulation);
    }
    if (saveBtn) {
        saveBtn.addEventListener('click', saveFile);
    }
    if (downloadCircuitBtn) {
        downloadCircuitBtn.addEventListener('click', downloadCircuitDiagram);
    }
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }
    
    // Code format selector
    if (codeFormatSelect) {
        // Load saved format preference
        const savedFormat = localStorage.getItem('codeFormat') || 'openqasm3';
        codeFormatSelect.value = savedFormat;
        
        // Set initial Monaco editor language if editor is already initialized
        if (monacoEditor) {
            const initialLanguage = savedFormat === 'quanta' ? 'quanta' : 'openqasm3';
            monaco.editor.setModelLanguage(monacoEditor.getModel(), initialLanguage);
        }
        
        codeFormatSelect.addEventListener('change', (e) => {
            const selectedFormat = e.target.value;
            localStorage.setItem('codeFormat', selectedFormat);

            if (monacoEditor) {
                const newLanguage = selectedFormat === 'quanta' ? 'quanta' : 'openqasm3';
                const newTheme = newLanguage === 'quanta' ? 'quanta-theme' : 'openqasm-theme';

                monaco.editor.setModelLanguage(monacoEditor.getModel(), newLanguage);
                monacoEditor.updateOptions({ theme: newTheme });

                updateCircuitDiagram();
                updateQuantaUI();
                checkSyntaxErrors();
            }
        });
    }

    if (keepStructureCheckbox) {
        const savedKeepStructure = localStorage.getItem('keepStructure') === 'true';
        keepStructureCheckbox.checked = savedKeepStructure;
        keepStructureCheckbox.addEventListener('change', (e) => {
            localStorage.setItem('keepStructure', e.target.checked ? 'true' : 'false');
            updateGeneratedQasm();
            updateCircuitDiagram();
        });
    }

    if (debugBtn) {
        debugBtn.addEventListener('click', () => runDebug());
    }

    if (liveDebugCheckbox) {
        const savedLive = localStorage.getItem('liveDebug') === 'true';
        liveDebugCheckbox.checked = savedLive;
        liveDebugCheckbox.addEventListener('change', (e) => {
            localStorage.setItem('liveDebug', e.target.checked ? 'true' : 'false');
            if (e.target.checked) scheduleLiveDebug();
        });
    }

    if (copyQasmBtn) {
        copyQasmBtn.addEventListener('click', copyGeneratedQasm);
    }
    if (downloadQasmBtn) {
        downloadQasmBtn.addEventListener('click', downloadGeneratedQasm);
    }
    if (compareQasmCheckbox) {
        const savedCompare = localStorage.getItem('compareQasm') === 'true';
        compareQasmCheckbox.checked = savedCompare;
        compareQasmCheckbox.addEventListener('change', (e) => {
            localStorage.setItem('compareQasm', e.target.checked ? 'true' : 'false');
            updateGeneratedQasm();
        });
    }

    document.querySelectorAll('.debug-snippet').forEach(btn => {
        btn.addEventListener('click', () => {
            insertDebugSnippet(btn.getAttribute('data-snippet'));
        });
    });
    
    // Sidebar toggle
    if (sidebarToggleDesktop) {
        sidebarToggleDesktop.addEventListener('click', toggleSidebar);
    }
    if (sidebarToggleMobile) {
        sidebarToggleMobile.addEventListener('click', toggleSidebar);
    }
    
    // Compiler editor listeners (not used on circuit builder page)
    if (codeEditorContainer && !document.getElementById('circuitBuilder')) {
        // Keyboard shortcut: Ctrl+Enter to run
        codeEditorContainer.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                runSimulation();
            }
        });

        // Real-time circuit diagram updates (debounced)
        let circuitUpdateTimeout;
        codeEditorContainer.addEventListener('input', () => {
            clearTimeout(circuitUpdateTimeout);
            circuitUpdateTimeout = setTimeout(() => {
                updateCircuitDiagram();
            }, 500);
        });

        // Drag and drop support for .qasm files
        codeEditorContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            codeEditorContainer.classList.add('border-green-500');
        });

        codeEditorContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            codeEditorContainer.classList.remove('border-green-500');
        });

        codeEditorContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            codeEditorContainer.classList.remove('border-green-500');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                const filename = file.name.toLowerCase();
                if (filename.endsWith('.qasm') || filename.endsWith('.qasm3') || filename.endsWith('.qta')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (monacoEditor) {
                            let detectedLanguage = 'openqasm3';
                            let detectedTheme = 'openqasm-theme';

                            if (filename.endsWith('.qta')) {
                                detectedLanguage = 'quanta';
                                detectedTheme = 'quanta-theme';
                            }

                            if (codeFormatSelect) {
                                codeFormatSelect.value = detectedLanguage;
                                localStorage.setItem('codeFormat', detectedLanguage);
                            }

                            monaco.editor.setModelLanguage(monacoEditor.getModel(), detectedLanguage);
                            monacoEditor.updateOptions({ theme: detectedTheme });
                            monacoEditor.setValue(normalizeLineEndings(event.target.result));
                            setCurrentOpenFilename(file.name);
                        }
                        updateCircuitDiagram();
                        updateQuantaUI();
                    };
                    reader.readAsText(file);
                } else {
                    alert('Please drop a .qasm, .qasm3, or .qta file');
                }
            }
        });
    }
    
    // Vertical resize handle functionality (between editor and output sections)
    if (resizeHandle && editorSection && outputSection) {
        let isResizing = false;
        let startY = 0;
        let startEditorHeight = 0;
        let startOutputHeight = 0;
        
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            startEditorHeight = editorSection.offsetHeight;
            startOutputHeight = outputSection.offsetHeight;
            document.body.classList.add('resizing');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            // const deltaY = e.clientY - startY;
            const container = editorSection.parentElement;
            const containerY = container.offsetTop;
            const containerHeight = container.offsetHeight;
            const resizeHandleHeight = resizeHandle.offsetHeight;
            
            const newEditorHeight = e.clientY - containerY;
            const newOutputHeight = containerHeight - newEditorHeight;
            
            // Minimum heights
            const minEditorHeight = 50;
            const minOutputHeight = 150;
            
            if (newEditorHeight >= minEditorHeight && newOutputHeight >= minOutputHeight) {
                const editorPercent = ((newEditorHeight) / containerHeight) * 100;
                const outputPercent = ((newOutputHeight) / containerHeight) * 100;
                
                editorSection.style.height = `${editorPercent}%`;
                outputSection.style.height = `${outputPercent}%`;
                
                // Redraw histogram if visible (canvas might need resizing)
                if (histogramCanvas && resultsDisplay && !resultsDisplay.classList.contains('hidden')) {
                    setTimeout(() => {
                        const tableRows = document.querySelectorAll('#countsTableBody tr');
                        const counts = {};
                        tableRows.forEach(row => {
                            const state = row.querySelector('td:first-child')?.textContent;
                            const count = parseInt(row.querySelector('td:nth-child(3)')?.textContent);
                            if (state && count) {
                                counts[state] = count;
                            }
                        });
                        if (Object.keys(counts).length > 0) {
                            drawHistogram(counts);
                        }
                    }, 10);
                }
            }
        });
        
        const handleMouseUp = () => {
            if (isResizing) {
                isResizing = false;
                document.body.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                // Save heights to localStorage
                localStorage.setItem('editorHeight', editorSection.style.height);
                localStorage.setItem('outputHeight', outputSection.style.height);
            }
        };
        
        document.addEventListener('mouseup', handleMouseUp);
    }
    
    // Horizontal resize handle functionality (between code editor and right panel)
    const resizeTarget = rightSection || circuitDiagramSection;
    const resizeLeft = document.getElementById('circuitBuilderSection') || codeEditorSection;
    if (horizontalResizeHandle && resizeLeft && resizeTarget && !horizontalResizeHandle.hasAttribute('data-resize-setup')) {
        let isResizingHorizontal = false;
        let startX = 0;
        let startLeftWidth = 0;
        let startRightWidth = 0;
        
        horizontalResizeHandle.addEventListener('mousedown', (e) => {
            isResizingHorizontal = true;
            startX = e.clientX;
            startLeftWidth = resizeLeft.offsetWidth;
            startRightWidth = resizeTarget.offsetWidth;
            document.body.classList.add('resizing', 'cursor-col-resize');
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizingHorizontal) return;
            
            const container = editorSection;
            const containerX = container.offsetLeft;
            const containerWidth = container.offsetWidth;
            const resizeHandleWidth = horizontalResizeHandle.offsetWidth;
            const availableWidth = containerWidth - resizeHandleWidth;
            
            const newLeftWidth = e.clientX - containerX;
            const newRightWidth = containerWidth - newLeftWidth;
            
            const minWidth = 200;
            
            if (newLeftWidth >= minWidth && newRightWidth >= minWidth && availableWidth > 0) {
                const leftPercent = (newLeftWidth / availableWidth) * 100;
                const rightPercent = (newRightWidth / availableWidth) * 100;
                
                resizeLeft.style.width = `${leftPercent}%`;
                resizeTarget.style.width = `${rightPercent}%`;
            }
        });
        
        const handleMouseUpHorizontal = () => {
            if (isResizingHorizontal) {
                isResizingHorizontal = false;
                document.body.classList.remove('resizing', 'cursor-col-resize');
                document.body.style.userSelect = '';
                
                localStorage.setItem('codeEditorWidth', resizeLeft.style.width);
                localStorage.setItem('circuitDiagramWidth', resizeTarget.style.width);
            }
        };
        
        document.addEventListener('mouseup', handleMouseUpHorizontal);
        horizontalResizeHandle.setAttribute('data-resize-setup', 'true');
    }
}

function switchRightTab(tabName) {
    const tabs = document.querySelectorAll('#rightSectionTabs .right-tab');
    const panels = document.querySelectorAll('#rightSectionPanels .tab-panel');
    if (!tabs.length || !panels.length) return;

    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    panels.forEach(panel => {
        const isActive = panel.dataset.tabPanel === tabName;
        if (isActive) {
            panel.classList.remove('hidden');
            panel.style.height = '';
            panel.style.width = '';
        } else {
            panel.classList.add('hidden');
        }
    });

    localStorage.setItem('rightSectionTab', tabName);

    if (tabName === 'code' || tabName === 'circuit') {
        setTimeout(() => {
            if (monacoEditor) monacoEditor.layout();
            if (window.circuitBuilderMonacoEditor) window.circuitBuilderMonacoEditor.layout();
        }, 10);
    }

    if (tabName === 'output' && histogramCanvas && resultsDisplay && !resultsDisplay.classList.contains('hidden')) {
        setTimeout(() => {
            const tableRows = document.querySelectorAll('#countsTableBody tr');
            const counts = {};
            tableRows.forEach(row => {
                const state = row.querySelector('td:first-child')?.textContent;
                const count = parseInt(row.querySelector('td:nth-child(3)')?.textContent);
                if (state && count) {
                    counts[state] = count;
                }
            });
            if (Object.keys(counts).length > 0) {
                drawHistogram(counts);
            }
        }, 10);
    }
}

function setupRightSectionTabs() {
    const tabBar = document.getElementById('rightSectionTabs');
    if (!tabBar) return;

    tabBar.addEventListener('click', (e) => {
        const tab = e.target.closest('.right-tab');
        if (!tab) return;
        switchRightTab(tab.dataset.tab);
    });

    const availableTabs = [...tabBar.querySelectorAll('.right-tab')].map(t => t.dataset.tab);
    const defaultTab = tabBar.querySelector('.right-tab.active')?.dataset.tab
        || availableTabs[0]
        || 'circuit';
    const savedTab = localStorage.getItem('rightSectionTab');
    switchRightTab(savedTab && availableTabs.includes(savedTab) ? savedTab : defaultTab);
}

function toggleSidebar() {
    if (!sidebar) return;
    
    // Check if mobile view
    const isMobile = window.innerWidth < 768;
    const toggleIcon = document.getElementById('sidebarToggleDesktopIcon');
    
    if (isMobile) {
        // Mobile: toggle overlay
        sidebar.classList.toggle('mobile-open');
    } else {
        // Desktop: toggle collapse
        const isCollapsed = sidebar.classList.contains('collapsed');
        
        if (isCollapsed) {
            // Expand
            sidebar.classList.remove('collapsed');
            sidebar.classList.remove('w-0');
            sidebar.classList.add('w-64');
            localStorage.setItem('sidebarCollapsed', 'false');
            // Update icon to point left (collapse)
            if (toggleIcon) {
                toggleIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path>';
            }
        } else {
            // Collapse
            sidebar.classList.add('collapsed');
            sidebar.classList.remove('w-64');
            sidebar.classList.add('w-0');
            localStorage.setItem('sidebarCollapsed', 'true');
            // Update icon to point right (expand)
            if (toggleIcon) {
                toggleIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path>';
            }
        }
    }
}

function loadSidebarState() {
    if (!sidebar) return;
    
    const toggleIcon = document.getElementById('sidebarToggleDesktopIcon');
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    
    if (isCollapsed) {
        sidebar.classList.add('collapsed', 'w-0');
        sidebar.classList.remove('w-64');
        // Set icon to point right (expand)
        if (toggleIcon) {
            toggleIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path>';
        }
    }
}

async function saveFile() {
    const code = normalizeLineEndings(monacoEditor ? monacoEditor.getValue() : '').trim();
    
    // Get current language from selector
    const language = codeFormatSelect ? codeFormatSelect.value : 'openqasm3';
    const langName = language === 'quanta' ? 'Quanta' : 'OpenQASM 3';
    const fileExtension = language === 'quanta' ? '.qta' : '.qasm';
    
    if (!code) {
        alert(`Please enter some ${langName} code to save`);
        return;
    }
    
    const extensionHint = language === 'quanta' ? 'without .qta extension' : 'without .qasm extension';
    const defaultName = currentOpenFilename ? getFileBaseName(currentOpenFilename) : '';
    const filename = prompt(`Enter a filename for your circuit (${extensionHint}):`, defaultName);
    
    if (!filename || !filename.trim()) {
        return; // User cancelled or entered empty name
    }
    
    let finalFilename = filename.trim();
    
    // Check if file exists
    try {
        const checkResponse = await fetch('/check-file-exists', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filename: finalFilename })
        });
        
        const checkData = await checkResponse.json();
        
        if (checkData.exists) {
            const overwrite = confirm(`File "${finalFilename}${fileExtension}" already exists. Do you want to overwrite it?`);
            if (!overwrite) {
                return; // User cancelled overwrite
            }
        }
    } catch (error) {
        console.error('Error checking file existence:', error);
        // Continue anyway
    }
    
    // Save the file
    try {
        saveBtn.disabled = true;
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = 'Saving...';
        
        const response = await fetch('/save-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: finalFilename,
                code: code,
                language: language  // Pass language so backend can set correct extension
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const savedName = finalFilename.endsWith(fileExtension)
                ? finalFilename
                : `${finalFilename}${fileExtension}`;
            setCurrentOpenFilename(savedName);
            alert(data.message || 'File saved successfully!');
            if (savedExamples && !savedExamples.classList.contains('hidden')) {
                loadSavedFiles();
            }
        } else {
            alert(`Error saving file: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error saving file:', error);
        alert(`Error saving file: ${error.message}`);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<svg id="saveBtnIcon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${themeConfig[localStorage.getItem('theme') || 'dark'].btnIcon.stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"></path><path d="M7 3v4a1 1 0 0 0 1 1h7"></path></svg>`;
        // Update icon stroke color based on current theme
        const currentTheme = localStorage.getItem('theme') || 'dark';
        const isDark = currentTheme === 'dark';
        const saveBtnIcon = document.getElementById('saveBtnIcon');
        if (saveBtnIcon) {
            saveBtnIcon.setAttribute('stroke', isDark ? '#ffffff' : '#000000');
        }
    }
}

async function runSimulation() {
    const code = normalizeLineEndings(monacoEditor ? monacoEditor.getValue() : '').trim();
    const shots = parseInt(shotsInput.value) || 1024;
    
    // Get current language from selector
    const language = codeFormatSelect ? codeFormatSelect.value : 'openqasm3';
    
    if (!code) {
        const langName = language === 'quanta' ? 'Quanta' : 'OpenQASM 3';
        showError(`Please enter some ${langName} code`);
        return;
    }
    
    // Update UI
    if (runBtn) {
        runBtn.disabled = true;
        runBtn.textContent = 'Running...';
    }
    statusIndicator.textContent = 'Compiling...';
    switchRightTab('output');
    hideError();
    hideResults();
    
    try {
        const response = await fetch('/compile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                shots: shots,
                language: language
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayResults(data);
        } else {
            showError(data.error || 'Unknown error occurred');
        }
    } catch (error) {
        showError(`Network error: ${error.message}`);
    } finally {
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.innerHTML = `<svg id="runBtnIcon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${themeConfig[localStorage.getItem('theme') || 'dark'].btnIcon.stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`;
        }
        statusIndicator.textContent = 'Ready';
    }
}

function displayResults(data) {
    const { counts, qubits, shots } = data;
    
    // Update info
    qubitsInfo.textContent = `${qubits} qubit${qubits !== 1 ? 's' : ''}`;
    shotsInfo.textContent = `${shots} shots`;
    
    // Show results first (so canvas is visible)
    showResults();
    
    // Wait a bit for DOM to update, then draw histogram
    setTimeout(() => {
        drawHistogram(counts);
    }, 10);
    
    // Populate table
    populateCountsTable(counts, shots);
}

function drawHistogram(counts) {
    const canvas = histogramCanvas;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Get canvas container dimensions
    const container = canvas.parentElement;
    const width = container ? container.clientWidth : 800;
    const height = 192; // Fixed height from h-48 class (48 * 4px = 192px)
    
    // Set canvas dimensions (important for proper rendering)
    canvas.width = width;
    canvas.height = height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Get sorted states and values
    const states = Object.keys(counts).sort();
    const values = states.map(state => counts[state]);
    
    if (states.length === 0 || values.length === 0) return;
    
    const maxValue = Math.max(...values);
    if (maxValue === 0) return;
    
    const barWidth = Math.max(20, (width - 20) / states.length); // Min bar width of 20px
    const padding = 4;
    const labelHeight = 30;
    const topPadding = 25;
    const bottomPadding = labelHeight;
    const chartHeight = height - topPadding - bottomPadding;
    
    // Get current theme for background color
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const bgColor = currentTheme === 'dark' ? '#111827' : '#f9fafb';
    const textColor = currentTheme === 'dark' ? '#9ca3af' : '#6b7280';
    
    // Draw background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
    
    // Draw bars
    states.forEach((state, index) => {
        const value = counts[state];
        const barHeight = (value / maxValue) * chartHeight;
        const x = index * barWidth + padding;
        const y = topPadding + (chartHeight - barHeight);
        
        // Bar color (green gradient)
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#10b981');
        gradient.addColorStop(1, '#059669');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth - padding * 2, barHeight);
        
        // State label at bottom
        ctx.fillStyle = textColor;
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const labelX = x + (barWidth - padding * 2) / 2;
        ctx.fillText(state, labelX, height - labelHeight + 5);
        
        // Value label on top of bar
        if (barHeight > 15) {
            ctx.fillStyle = '#10b981';
            ctx.font = '11px monospace';
            ctx.textBaseline = 'bottom';
            ctx.fillText(value.toString(), labelX, y - 3);
        }
    });
}

function populateCountsTable(counts, shots) {
    countsTableBody.innerHTML = '';
    
    const states = Object.keys(counts).sort();
    
    states.forEach(state => {
        const count = counts[state];
        const probability = ((count / shots) * 100).toFixed(2);
        // Format Dirac notation: |state⟩
        const diracNotation = `|${state}⟩`;
        
        const row = document.createElement('tr');
        row.className = 'border-t border-gray-700';
        row.innerHTML = `
            <td class="px-4 py-2 font-mono">${state}</td>
            <td class="px-4 py-2 font-mono">${diracNotation}</td>
            <td class="px-4 py-2">${count}</td>
            <td class="px-4 py-2">${probability}%</td>
        `;
        countsTableBody.appendChild(row);
    });
}

function showError(message) {
    errorMessage.textContent = message;
    errorDisplay.classList.remove('hidden');
    emptyState.classList.add('hidden');
    switchRightTab('output');
}

function hideError() {
    errorDisplay.classList.add('hidden');
}

function showResults() {
    resultsDisplay.classList.remove('hidden');
    emptyState.classList.add('hidden');
    errorDisplay.classList.add('hidden');
    switchRightTab('output');
}

function hideResults() {
    resultsDisplay.classList.add('hidden');
    emptyState.classList.remove('hidden');
}

async function updateCircuitDiagram() {
    if (!circuitDiagram || !circuitStatus) return;
    
    const code = normalizeLineEndings(monacoEditor ? monacoEditor.getValue() : '').trim();
    
    // Get current language from selector
    const language = codeFormatSelect ? codeFormatSelect.value : 'openqasm3';
    
    // Get current theme for text colors
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const isDark = currentTheme === 'dark';
    const textColor = isDark ? 'text-gray-500' : 'text-gray-600';
    const codeTextColor = isDark ? 'text-white' : 'text-black';
    
    if (!code) {
        circuitDiagram.innerHTML = `
            <div class="text-center ${textColor}">
                <div class="text-4xl mb-2">⚛️</div>
                <div class="text-sm">Circuit diagram will appear here</div>
                <div class="text-xs mt-2 ${textColor}">Start typing to see real-time preview</div>
            </div>
        `;
        circuitStatus.textContent = 'Ready';
        return;
    }
    
    circuitStatus.textContent = 'Generating...';
    
    try {
        const keepStructure = (language === 'quanta' && keepStructureCheckbox)
            ? keepStructureCheckbox.checked
            : false;
        const response = await fetch('/circuit-diagram', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                language: language,
                keep_structure: keepStructure,
            })
        });
        
        const data = await response.json();
        
        if (data.success) { 
            if (data.format === 'text') {
                // Display text diagram with multi-color syntax highlighting
                const coloredText = colorizeCircuitText(data.text, code, isDark);
                circuitDiagram.innerHTML = `
                    <pre class="font-mono text-xs whitespace-pre overflow-x">${coloredText}</pre>
                `;
                circuitStatus.textContent = keepStructure ? 'Valid (structured)' : 'Valid (text)';
            }
        } else {
            circuitDiagram.innerHTML = `
                <div class="text-center text-red-400">
                    <div class="text-2xl mb-2">⚠️</div>
                    <div class="text-sm">${escapeHtml(data.error || 'Invalid circuit')}</div>
                </div>
            `;
            circuitStatus.textContent = 'Invalid';
        }
    } catch (error) {
        circuitDiagram.innerHTML = `
            <div class="text-center text-yellow-400">
                <div class="text-2xl mb-2">⚠️</div>
                <div class="text-sm">Error generating diagram</div>
                <div class="text-xs mt-2 ${textColor}">${escapeHtml(error.message)}</div>
            </div>
        `;
        circuitStatus.textContent = 'Error';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Download circuit diagram as PNG using matplotlib backend
async function downloadCircuitDiagram() {
    if (!monacoEditor) return;
    
    const code = monacoEditor.getValue().trim();
    const language = codeFormatSelect ? codeFormatSelect.value : 'openqasm3';
    
    if (!code) {
        const langName = language === 'quanta' ? 'Quanta' : 'OpenQASM 3';
        alert(`Please enter some ${langName} code to download`);
        return;
    }
    
    try {
        // Disable button during download
        if (downloadCircuitBtn) {
            downloadCircuitBtn.disabled = true;
            const originalHTML = downloadCircuitBtn.innerHTML;
            downloadCircuitBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
        }
        
        const response = await fetch('/download-circuit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                code: code,
                language: language
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to download circuit diagram' }));
            throw new Error(errorData.error || 'Failed to download circuit diagram');
        }
        
        // Get the PNG blob from response
        const blob = await response.blob();
        
        // Get filename from Content-Disposition header if available
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `circuit.png`;
        // if (contentDisposition) {
        //     const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        //     if (filenameMatch && filenameMatch[1]) {
        //         filename = filenameMatch[1].replace(/['"]/g, '');
        //     }
        // }
        
        // Create download link
        // Note: Blob URLs on HTTP will show a security warning, but this is harmless for local development
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        // Clean up immediately to minimize security warning exposure
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
    } catch (error) {
        console.error('Error downloading circuit diagram:', error);
        alert('Failed to download circuit diagram: ' + error.message);
    } finally {
        // Re-enable button
        if (downloadCircuitBtn) {
            downloadCircuitBtn.disabled = false;
            const currentTheme = localStorage.getItem('theme') || 'dark';
            const isDark = currentTheme === 'dark';
            const strokeColor = isDark ? '#ffffff' : '#000000';
            downloadCircuitBtn.innerHTML = `<svg id="downloadCircuitBtnIcon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        }
    }
}

// Get Monaco theme colors based on token type
function getMonacoThemeColor(tokenType, isDark) {
    const colors = {
        'function': isDark ? '#DCDCAA' : '#A6A814',  // Yellow for user defined function/gates names
        'function-like': isDark ? '#b8ff75' : '#66BA14',  // Yellow-green for function-like gate names (h, cx, ry)
        'function-like-2': isDark ? '#70ff98' : '#0AB139',  // Light green for function-like names (measure, reset)
        'controlflow': '#C586C0',  // Purple for control flow
    };
    return colors[tokenType] || (isDark ? '#D4D4D4' : '#000000');
}

// Parse code to identify gate types and their colors based on Monaco theme
function parseGateColors(code, isDark) {
    const gateColors = {};
    
    // Function-like-2 gates (measure, reset) - light green
    const functionLike2Gates = ['measure', 'reset'];
    const functionLike2Color = getMonacoThemeColor('function-like-2', isDark);
    
    // Built-in gates (function-like) - yellow-green
    const builtInGates = ['h', 'x', 'y', 'z', 's', 'cx', 'cy', 'cz', 'ch', 'swap', 
                         'ccx', 'cswap', 'u', 'p', 'rx', 'ry', 'rz', 'r', 'crx', 'cry', 
                         'crz', 'cu', 'cp', 'phase', 'cphase', 'id', 'tdg', 'sdg'];
    const builtInColor = getMonacoThemeColor('function-like', isDark);
    
    // Extract user-defined function/gate names (function) - yellow
    const functionNames = extractFunctionNames(code);
    const functionColor = getMonacoThemeColor('function', isDark);
    
    // Parse code line by line
    const lines = code.split('\n');
    lines.forEach(line => {
        // Remove comments
        const cleanLine = line.split('//')[0].split('/*')[0];
        
        // Check for measure and reset (function-like-2)
        functionLike2Gates.forEach(gate => {
            const gateRegex = new RegExp(`\\b${gate}\\b\\s+\\w+(?:\\s*\\[[^\\]]+\\])?(?:\\s*->\\s*\\w+)?\\s*;`, 'i')
            if (gateRegex.test(cleanLine)) {
                if (gate === 'measure') {
                    gateColors['M'] = functionLike2Color; // M is the symbol for measure
                } else if (gate === 'reset') {
                    gateColors['|0>'] = functionLike2Color; // |0> is the symbol for reset
                }
            }
        });
        
        // Check for built-in gates (function-like)
        builtInGates.forEach(gate => {
            // Match gate name as whole word followed by space or (
            const gateRegex = new RegExp(`\\b${gate}\\b\\s+\\w+\\s*[[(]`, 'i')
            if (gateRegex.test(cleanLine)) {
                // Map gate names to their circuit diagram symbols
                const symbolMap = {
                    'h': 'H', 'x': 'X', 'y': 'Y', 'z': 'Z', 's': 'S',
                    'cx': 'X', 'cy': 'Y', 'cz': 'Z', 'ch': 'H',
                    'swap': 'SWAP', 'ccx': 'X', 'cswap': 'SWAP',
                    'u': 'U', 'p': 'P', 'rx': 'RX', 'ry': 'RY', 'rz': 'RZ', 'r': 'R',
                    'crx': 'RX', 'cry': 'RY', 'crz': 'RZ',
                    'cu': 'U', 'cp': 'P', 'phase': 'PHASE', 'cphase': 'PHASE',
                    'id': 'I', 'tdg': 'TDG', 'sdg': 'SDG'
                };
                
                const symbol = symbolMap[gate.toLowerCase()] || gate.toUpperCase();
                gateColors[symbol] = builtInColor;
            }
        });
        
        // Check for user-defined functions/gates (function)
        functionNames.forEach(funcName => {
            const funcRegex = new RegExp(`\\b${funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b\\s*[\\[(]`, 'i');
            if (funcRegex.test(cleanLine)) {
                // Use the function name as the symbol (circuit diagrams typically show the gate name)
                gateColors[funcName] = functionColor;
                // Also try uppercase version
                gateColors[funcName.toUpperCase()] = functionColor;
            }
        });
    });
    
    return gateColors;
}

// Colorize text circuit diagram with syntax-based colors
function colorizeCircuitText(text, code, isDark) {
    const gateColors = parseGateColors(code, isDark);
    // Use Monaco theme colors
    const functionColor = getMonacoThemeColor('function', isDark); // Yellow for custom functions
    const controlFlowColor = getMonacoThemeColor('controlflow', isDark); // Purple for control flow
    
    // Escape HTML first
    let coloredText = escapeHtml(text);
    
    // Extract function names from code
    const functionNames = extractFunctionNames(code);
    
    // Build a map of positions to colors to avoid overlapping replacements
    const colorMap = [];
    
    // Helper function to add color range
    function addColorRange(start, end, color) {
        colorMap.push({ start, end, color });
    }
    
    // Process line by line to avoid breaking the structure
    const lines = coloredText.split('\n');
    const processedLines = lines.map(line => {
        const lineColorMap = [];
        
        // Color custom function/gate names
        functionNames.forEach(funcName => {
            const regex = new RegExp(`\\b(${funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'g');
            let match;
            while ((match = regex.exec(line)) !== null) {
                lineColorMap.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    color: functionColor
                });
            }
        });
        
        // Color control flow keywords (While, If, End)
        const controlFlowKeywords = ['While', 'If', 'End'];
        controlFlowKeywords.forEach(keyword => {
            const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\d-]*)`, 'g');
            let match;
            while ((match = regex.exec(line)) !== null) {
                // Check for overlap
                const overlaps = lineColorMap.some(item => 
                    match.index < item.end && match.index + match[0].length > item.start
                );
                if (!overlaps) {
                    lineColorMap.push({
                        start: match.index,
                        end: match.index + match[0].length,
                        color: controlFlowColor
                    });
                }
            }
        });
        
        // Color built-in gate symbols
        const builtInSymbols = ['H', 'X', 'Y', 'Z', 'S', 'T', 'RX', 'RY', 'RZ', 'R', 'U', 'P', 'PHASE', 'I', 'TDG', 'SDG', 'SWAP'];
        builtInSymbols.forEach(symbol => {
            if (gateColors[symbol]) {
                const regex = new RegExp(`\\b(${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'g');
                let match;
                while ((match = regex.exec(line)) !== null) {
                    // Check for overlap
                    const overlaps = lineColorMap.some(item => 
                        match.index < item.end && match.index + match[0].length > item.start
                    );
                    if (!overlaps) {
                        lineColorMap.push({
                            start: match.index,
                            end: match.index + match[0].length,
                            color: gateColors[symbol]
                        });
                    }
                }
            }
        });
        
        // Color measure gates (M symbol and related box characters) - do this last
        if (gateColors['M']) {
            const measureChars = ['┤M├', '└╥┘', '┌─┐', '║', '╫', '╩', '╬', '╨', '╡', '╞'];
            measureChars.forEach(char => {
                const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedChar, 'g');
                let match;
                while ((match = regex.exec(line)) !== null) {
                    // Check for overlap
                    const overlaps = lineColorMap.some(item => 
                        match.index < item.end && match.index + match[0].length > item.start
                    );
                    if (!overlaps) {
                        lineColorMap.push({
                            start: match.index,
                            end: match.index + match[0].length,
                            color: gateColors['M']
                        });
                    }
                }
            });
        }
        
        // Color reset gates (|0> symbol only) - do this last
        if (gateColors['|0>']) {
            // Escape special regex characters in |0> (| needs to be escaped)
            const escapedReset = '\\|0>';
            const regex = new RegExp(escapedReset, 'g');
            let match;
            while ((match = regex.exec(line)) !== null) {
                // Check for overlap
                const overlaps = lineColorMap.some(item => 
                    match.index < item.end && match.index + match[0].length > item.start
                );
                if (!overlaps) {
                    lineColorMap.push({
                        start: match.index,
                        end: match.index + match[0].length,
                        color: gateColors['|0>']
                    });
                }
            }
        }
        
        // Sort by start position
        lineColorMap.sort((a, b) => a.start - b.start);
        
        // Apply colors from end to start to maintain correct indices
        lineColorMap.sort((a, b) => b.start - a.start);
        let result = line;
        for (const item of lineColorMap) {
            const before = result.substring(0, item.start);
            const text = result.substring(item.start, item.end);
            const after = result.substring(item.end);
            result = before + `<span style="color: ${item.color}">${text}</span>` + after;
        }
        
        return result;
    });
    
    return processedLines.join('\n');
}

// Extract function/gate names from code
function extractFunctionNames(code) {
    const functionNames = [];
    const lines = code.split('\n');
    
    lines.forEach(line => {
        // Remove comments
        const cleanLine = line.split('//')[0].split('/*')[0];
        
        // Match gate definitions: gate my_gate(...)
        const gateDefMatch = cleanLine.match(/\bgate\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
        if (gateDefMatch) {
            functionNames.push(gateDefMatch[1]);
        }
        
        // Match def definitions: def my_func(...)
        const defMatch = cleanLine.match(/\bdef\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
        if (defMatch) {
            functionNames.push(defMatch[1]);
        }
        
        // Match function calls that aren't built-in gates
        const functionCallMatch = cleanLine.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
        if (functionCallMatch) {
            const funcName = functionCallMatch[1];
            const builtInGates = ['h', 'x', 'y', 'z', 's', 't', 'cx', 'cy', 'cz', 'ch', 'swap', 
                                 'ccx', 'cswap', 'u', 'p', 'rx', 'ry', 'rz', 'r', 'crx', 'cry', 
                                 'crz', 'cu', 'cp', 'phase', 'cphase', 'id', 'tdg', 'sdg'];
            if (!builtInGates.includes(funcName.toLowerCase()) && 
                !['gate', 'def', 'cal', 'defcal', 'if', 'else', 'for', 'while', 'include', 
                  'qubit', 'bit', 'measure', 'box', 'let', 'const', 'break', 'continue', 'return'].includes(funcName.toLowerCase())) {
                if (!functionNames.includes(funcName)) {
                    functionNames.push(funcName);
                }
            }
        }
    });
    
    return functionNames;
}

// Apply colors to gate elements in SVG
function applyGateColors(svg, gateColors) {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const isDark = currentTheme === 'dark';
    const defaultTextColor = isDark ? '#10b981' : '#059669';
    
    // Find all gate groups and color them based on their text labels
    const gateGroups = svg.querySelectorAll('g');
    gateGroups.forEach(group => {
        const textInGroup = group.querySelector('text');
        if (textInGroup) {
            const gateName = textInGroup.textContent.trim();
            const gateColor = gateColors[gateName];
            
            if (gateColor) {
                // Color all shapes in this group
                const shapesInGroup = group.querySelectorAll('rect, path, polygon, circle, line');
                shapesInGroup.forEach(shape => {
                    const fill = shape.getAttribute('fill');
                    const stroke = shape.getAttribute('stroke');
                    
                    // Only update if not a gradient or pattern
                    if (fill && fill !== 'none' && fill !== 'transparent' && !fill.startsWith('url')) {
                        shape.setAttribute('fill', gateColor);
                    }
                    if (stroke && stroke !== 'none' && !stroke.startsWith('url')) {
                        shape.setAttribute('stroke', gateColor);
                    }
                });
                
                // Color the text label
                textInGroup.setAttribute('fill', gateColor);
            } else if (textInGroup.getAttribute('fill') !== 'none' && textInGroup.getAttribute('fill') !== 'transparent') {
                // Default color for other text
                textInGroup.setAttribute('fill', defaultTextColor);
            }
        }
    });
    
    // Also handle standalone text elements (for measure gates, reset gates, etc.)
    const textElements = svg.querySelectorAll('text');
    textElements.forEach(text => {
        const textContent = text.textContent.trim();
        if (gateColors[textContent] && text.getAttribute('fill') !== 'none') {
            text.setAttribute('fill', gateColors[textContent]);
        }
    });
}

// Theme management
const themeConfig = {
    dark: {
        body: { bg: 'bg-[#0f0f0f]', text: 'text-gray-100' },
        topBar: { bg: 'bg-[#1a1a1a]', border: 'border-gray-800' },
        sidebar: { bg: 'bg-[#1a1a1a]', border: 'border-gray-800', text: 'text-gray-300' },
        mainContent: { bg: 'bg-transparent' },
        codeEditor: { bg: 'bg-black', text: 'text-white', border: 'border-gray-800' },
        outputPanel: { bg: 'bg-[#1a1a1a]', border: 'border-gray-800' },
        button: { primary: 'bg-green-600 hover:bg-green-700', secondary: 'bg-gray-700 hover:bg-gray-600' },
        input: { bg: 'bg-gray-800', border: 'border-gray-700', text: 'text-gray-100' },
        table: { bg: 'bg-gray-800', text: 'text-gray-300', border: 'border-gray-700' },
        canvas: { bg: '#111827' },
        btnIcon: { stroke: '#ffffff' },
    },
    light: {
        body: { bg: 'bg-gray-50', text: 'text-gray-900' },
        topBar: { bg: 'bg-white', border: 'border-gray-300' },
        sidebar: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-700' },
        mainContent: { bg: 'bg-transparent' },
        codeEditor: { bg: 'bg-white', text: 'text-black', border: 'border-gray-300' },
        outputPanel: { bg: 'bg-gray-50', border: 'border-gray-300' },
        button: { primary: 'bg-green-500 hover:bg-green-600', secondary: 'bg-gray-200 hover:bg-gray-300' },
        input: { bg: 'bg-white', border: 'border-gray-300', text: 'text-gray-900' },
        table: { bg: 'bg-white', text: 'text-gray-700', border: 'border-gray-300' },
        canvas: { bg: '#f9fafb' },
        btnIcon: { stroke: '#000000' },
    }
};



function updateMonacoEditorTheme(isDark) {
    // Use config.json if available, otherwise fall back to default values
    const themeMode = isDark ? 'dark' : 'light';
    
    // Get OpenQASM 3 theme from config
    let openqasmTheme = null;
    if (monacoThemeConfig && monacoThemeConfig.openqasm3 && monacoThemeConfig.openqasm3[themeMode]) {
        openqasmTheme = monacoThemeConfig.openqasm3[themeMode];
    }
    
    // Get Quanta theme from config
    let quantaTheme = null;
    if (monacoThemeConfig && monacoThemeConfig.quanta && monacoThemeConfig.quanta[themeMode]) {
        quantaTheme = monacoThemeConfig.quanta[themeMode];
    }
    
    // Fallback to default theme if config is not available
    if (!openqasmTheme) {
        const defaultThemeRules = [
            { token: 'Language', foreground: '#808080', fontStyle: 'bold' },
            { token: 'keyword', foreground: '#4981B0', fontStyle: 'bold' },
            { token: 'controlflow', foreground: '#C586C0', fontStyle: 'bold' },
            { token: 'function', foreground: isDark ? '#DCDCAA' : '#A6A814' },
            { token: 'function-like', foreground: isDark ? '#9AD95D' : '#66BA14' },
            { token: 'function-like-2', foreground: isDark ? '#10B880' : '#0AB139' },
            { token: 'string', foreground: isDark ? '#CE9178' : '#9D3F1A' },
            { token: 'number', foreground: isDark ? '#B5CEA8' : '#407E1E' },
            { token: 'comment', foreground: '#808080', fontStyle: 'italic' },
            { token: 'operator', foreground: isDark ? '#D4D4D4' : '#000000' },
            { token: 'delimiter', foreground: isDark ? '#D4D4D4' : '#000000' },
            { token: 'identifier', foreground: isDark ? '#D4D4D4' : '#000000' },
            { token: 'in-value', foreground: isDark ? '#88C0D7' : '#197297' },
            { token: 'modifiers', fontStyle: 'italic' }
        ];
        
        const defaultThemeColors = {
            'editor.background': isDark ? '#000000' : '#FFFFFF',
            'editor.foreground': isDark ? '#FFFFFF' : '#000000',
            'editorLineNumber.foreground': isDark ? '#6A9955' : '#858585',
            'editor.selectionBackground': isDark ? '#264f78' : '#add6ff',
            'editor.lineHighlightBackground': isDark ? '#1e1e1e' : '#f0f0f0'
        };
        
        openqasmTheme = {
            base: isDark ? 'vs-dark' : 'vs',
            inherit: true,
            rules: defaultThemeRules,
            colors: defaultThemeColors
        };
    }
    
    // Use Quanta theme if available, otherwise use OpenQASM 3 theme as fallback
    if (!quantaTheme) {
        quantaTheme = openqasmTheme;
    }
    
    // Define theme for OpenQASM 3
    monaco.editor.defineTheme('openqasm-theme', {
        base: openqasmTheme.base,
        inherit: openqasmTheme.inherit,
        rules: openqasmTheme.rules,
        colors: openqasmTheme.colors
    });
    
    // Define theme for Quanta
    monaco.editor.defineTheme('quanta-theme', {
        base: quantaTheme.base,
        inherit: quantaTheme.inherit,
        rules: quantaTheme.rules,
        colors: quantaTheme.colors
    });
}


function applyHomePageTheme(theme) {
    const cards = document.querySelectorAll('.theme-feature-card, .theme-quickstart-card');
    if (!cards.length) return;

    const isDark = theme === 'dark';
    const config = themeConfig[theme];

    cards.forEach((card) => {
        card.className = card.className.replace(/bg-\[#1a1a1a\]|bg-gray-100/g, config.sidebar.bg);
        card.className = card.className.replace(/border-gray-800|border-gray-300/g, config.sidebar.border);
    });

    document.querySelectorAll('.theme-feature-text').forEach((el) => {
        el.className = el.className.replace(/text-gray-400|text-gray-600/g, isDark ? 'text-gray-400' : 'text-gray-600');
    });
    document.querySelectorAll('.theme-quickstart-text').forEach((el) => {
        el.className = el.className.replace(/text-gray-300|text-gray-700/g, isDark ? 'text-gray-300' : 'text-gray-700');
    });
    document.querySelectorAll('.theme-hero-subtitle').forEach((el) => {
        el.className = el.className.replace(/text-gray-400|text-gray-600/g, isDark ? 'text-gray-400' : 'text-gray-600');
    });
    document.querySelectorAll('.theme-muted-text').forEach((el) => {
        el.className = el.className.replace(/text-gray-500|text-gray-600/g, isDark ? 'text-gray-500' : 'text-gray-600');
    });
    document.querySelectorAll('.theme-secondary-btn').forEach((el) => {
        el.className = el.className.replace(/bg-gray-800|bg-gray-200/g, isDark ? 'bg-gray-800' : 'bg-gray-200');
        el.className = el.className.replace(/hover:bg-gray-700|hover:bg-gray-300/g, isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-300');
        el.className = el.className.replace(/border-gray-700|border-gray-300/g, isDark ? 'border-gray-700' : 'border-gray-300');
        el.className = el.className.replace(/text-white|text-gray-900/g, isDark ? 'text-white' : 'text-gray-900');
    });
    document.querySelectorAll('.theme-kbd').forEach((el) => {
        el.className = el.className.replace(/bg-gray-800|bg-gray-200/g, isDark ? 'bg-gray-800' : 'bg-gray-200');
    });
    document.querySelectorAll('.theme-table-head').forEach((el) => {
        el.className = el.className.replace(/text-gray-500|text-gray-600/g, isDark ? 'text-gray-500' : 'text-gray-600');
        el.className = el.className.replace(/border-gray-800|border-gray-300/g, config.sidebar.border);
    });
    document.querySelectorAll('.theme-table-divide').forEach((el) => {
        el.className = el.className.replace(/divide-gray-800\/80|divide-gray-300/g, isDark ? 'divide-gray-800/80' : 'divide-gray-300');
    });

    const homeSidebar = document.getElementById('sidebar');
    if (homeSidebar && document.getElementById('homeMain')) {
        homeSidebar.querySelectorAll('a.block').forEach((link) => {
            link.className = link.className.replace(/text-gray-300|text-gray-700/g, isDark ? 'text-gray-300' : 'text-gray-700');
            link.className = link.className.replace(/hover:bg-gray-800|hover:bg-gray-200/g, isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200');
        });
    }
}

function applyCircuitPageTheme(theme) {
    if (!document.getElementById('circuitBuilder')) return;

    const isDark = theme === 'dark';
    const config = themeConfig[theme];

    const circuitBuilderContainer = document.getElementById('circuitBuilderContainer');
    if (circuitBuilderContainer) {
        circuitBuilderContainer.className = circuitBuilderContainer.className.replace(/bg-black|bg-white/g, config.codeEditor.bg);
        circuitBuilderContainer.className = circuitBuilderContainer.className.replace(/border-gray-800|border-gray-300/g, config.codeEditor.border);
    }

    document.querySelectorAll('#clearCircuitBtn, #addQubitBtn, #removeQubitBtn, #saveBtn, #runBtn').forEach((btn) => {
        if (btn.id === 'addQubitBtn' || btn.id === 'removeQubitBtn') {
            btn.className = btn.className.replace(/text-gray-100|text-gray-900/g, 'text-white');
            return;
        }
        btn.className = btn.className.replace(/bg-gray-800|bg-gray-200/g, isDark ? 'bg-gray-800' : 'bg-gray-200');
        btn.className = btn.className.replace(/hover:bg-gray-700|hover:bg-gray-300/g, isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-300');
        btn.className = btn.className.replace(/text-gray-100|text-gray-900/g, isDark ? 'text-gray-100' : 'text-gray-900');
    });

    document.querySelectorAll('#shotsInput, #circuitCodeFormatSelect').forEach((input) => {
        input.className = input.className.replace(/bg-gray-800|bg-white/g, config.input.bg);
        input.className = input.className.replace(/border-gray-700|border-gray-300/g, config.input.border);
        input.className = input.className.replace(/text-gray-100|text-gray-900/g, config.input.text);
    });

    document.querySelectorAll('.theme-editor-container').forEach((container) => {
        container.className = container.className.replace(/bg-black|bg-white/g, config.codeEditor.bg);
        container.className = container.className.replace(/border-gray-800|border-gray-300/g, config.codeEditor.border);
    });

    const table = document.getElementById('countsTable');
    if (table) {
        const thead = table.querySelector('thead');
        if (thead) {
            thead.className = thead.className.replace(/bg-gray-800|bg-gray-200/g, config.table.bg);
        }
        const tbody = table.querySelector('tbody');
        if (tbody) {
            tbody.className = tbody.className.replace(/text-gray-300|text-gray-700/g, config.table.text);
        }
    }

    const canvas = document.getElementById('histogramCanvas');
    if (canvas) {
        canvas.className = canvas.className.replace(/bg-gray-900|bg-gray-100/g, isDark ? 'bg-gray-900' : 'bg-gray-100');
    }

    if (typeof window.circuitBuilderMonacoEditor !== 'undefined' && window.circuitBuilderMonacoEditor) {
        updateMonacoEditorTheme(isDark);
        const format = document.getElementById('circuitCodeFormatSelect')?.value || 'openqasm3';
        const monacoTheme = format === 'quanta' ? 'quanta-theme' : 'openqasm-theme';
        window.circuitBuilderMonacoEditor.updateOptions({ theme: monacoTheme });
    }

    if (typeof updateGatePaletteTheme === 'function') {
        updateGatePaletteTheme(isDark);
    }

    ['sidebarToggleDesktop', 'sidebarToggleMobile'].forEach((id) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.className = btn.className.replace(/hover:bg-gray-800|hover:bg-gray-200/g, isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200');
        }
    });
}

function applyTheme(theme) {
    const config = themeConfig[theme];
    const isDark = theme === 'dark';
    const shellClass = document.body.classList.contains('app-shell') ? ' app-shell' : '';
    
    // Update body
    document.body.className = `${config.body.bg} ${config.body.text} min-h-screen${shellClass}`;
    document.body.classList.remove('light-mode', 'dark-mode');
    document.body.classList.add(isDark ? 'dark-mode' : 'light-mode');
    document.body.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update top bar
    const topBar = document.getElementById('topBar') || document.querySelector('div.bg-\\[\\#1a1a1a\\], div.bg-white');
    if (topBar) {
        topBar.className = `${config.topBar.bg} border-b ${config.topBar.border} px-2 py-2`;
        
        // Update top bar headings
        const topBarHeadings = topBar.querySelectorAll('h1');
        topBarHeadings.forEach(h => {
            h.className = h.className.replace(/text-gray-\d+/g, isDark ? 'text-gray-100' : 'text-gray-900');
        });
    }
    
    // Update sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        const baseClasses = sidebar.className.split(' ').filter(c => 
            !c.startsWith('bg-') && !c.startsWith('border-') && !c.startsWith('text-')
        ).join(' ');
        sidebar.className = `${baseClasses} ${config.sidebar.bg} border-r ${config.sidebar.border} ${config.sidebar.text}`;
        
        // Update sidebar text elements
        const sidebarTexts = sidebar.querySelectorAll('h2, h3, .text-gray-300, .text-gray-400, .text-gray-700');
        sidebarTexts.forEach(el => {
            if (el.tagName === 'H2' || el.tagName === 'H3') {
                el.className = el.className.replace(/text-gray-\d+/g, config.sidebar.text);
            } else if (el.classList.contains('text-gray-400')) {
                el.className = el.className.replace(/text-gray-\d+/g, isDark ? 'text-gray-400' : 'text-gray-600');
            }
        });
        
        // Update sidebar navigation buttons
        const navButtons = sidebar.querySelectorAll('.nav-item');
        navButtons.forEach(btn => {
            if (btn.classList.contains('active')) {
                btn.className = btn.className.replace(/bg-gray-800|bg-gray-200/g, isDark ? 'bg-gray-800' : 'bg-gray-200');
                btn.className = btn.className.replace(/text-gray-900|text-gray-100/g, isDark ? 'text-gray-100' : 'text-gray-900');
            } else {
                // Regular nav buttons
                btn.className = btn.className.replace(/hover:bg-gray-800|hover:bg-gray-200/g, isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200');
            }
        });
        
        // Update sidebar example button containers
        const exampleContainers = sidebar.querySelectorAll('.example-btn-container');
        exampleContainers.forEach(container => {
            container.className = container.className.replace(/bg-gray-800|bg-gray-200/g, isDark ? 'bg-gray-800' : 'bg-gray-200');
            container.className = container.className.replace(/hover:bg-gray-700|hover:bg-gray-300/g, isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-300');
            
            const button = container.querySelector('button');
            if (button) {
                button.className = button.className.replace(/text-gray-\d+/g, isDark ? 'text-gray-100' : 'text-gray-900');
            }
            
            // Update action buttons stroke colors and hover states
            const actionButtons = container.querySelectorAll('[data-action]');
            actionButtons.forEach(btn => {
                const svg = btn.querySelector('svg');
                if (svg) {
                    svg.setAttribute('stroke', isDark ? '#ffffff' : '#000000');
                }
                // Update hover classes
                if (btn.getAttribute('data-action') === 'delete') {
                    btn.className = btn.className.replace(/hover:bg-red-600|hover:bg-red-400/g, isDark ? 'hover:bg-red-600' : 'hover:bg-red-400');
                } else {
                    btn.className = btn.className.replace(/hover:bg-gray-600|hover:bg-gray-400/g, isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-400');
                }
            });
        });
        
        // Update sidebar section toggle buttons
        ['savedToggle', 'functionsToggle', 'examplesToggle'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.className = btn.className.replace(/hover:bg-gray-800|hover:bg-gray-200/g, isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200');
            }
        });
    }
    
    // Update code editor container
    const editorContainer = codeEditorContainer?.parentElement;
    if (editorContainer) {
        editorContainer.className = editorContainer.className.replace(/bg-black|bg-white/g, config.codeEditor.bg);
        editorContainer.className = editorContainer.className.replace(/border-gray-800|border-gray-300/g, config.codeEditor.border);
    }
    
    // Update Monaco Editor theme
    if (monacoEditor) {
        updateMonacoEditorTheme(isDark);
        // Update editor theme based on current language
        const currentLanguage = codeFormatSelect ? codeFormatSelect.value : 'openqasm3';
        const currentTheme = currentLanguage === 'quanta' ? 'quanta-theme' : 'openqasm-theme';
        monacoEditor.updateOptions({ theme: currentTheme });
        // Update circuit diagram colors to match new theme
        updateCircuitDiagram();
    } 
    
    // Update circuit diagram container (same theme as code editor)
    const circuitContainer = circuitDiagram?.parentElement;
    if (circuitContainer) {
        circuitContainer.className = circuitContainer.className.replace(/bg-\[#0f0f0f\]|bg-black|bg-white/g, config.codeEditor.bg);
        circuitContainer.className = circuitContainer.className.replace(/border-gray-800|border-gray-300/g, config.codeEditor.border);
    }
    
    // Update circuit diagram text elements
    if (circuitDiagram) {
        // Update text colors in circuit diagram (empty state, error messages, etc.)
        const textElements = circuitDiagram.querySelectorAll('.text-gray-500, .text-gray-600, .text-gray-400, .text-red-400, .text-yellow-400');
        textElements.forEach(el => {
            if (el.classList.contains('text-gray-500') || el.classList.contains('text-gray-600')) {
                el.className = el.className.replace(/text-gray-500|text-gray-600/g, isDark ? 'text-gray-500' : 'text-gray-600');
            } else if (el.classList.contains('text-gray-400')) {
                el.className = el.className.replace(/text-gray-400/g, isDark ? 'text-gray-400' : 'text-gray-600');
            }
        });
        
        // Update pre/code text colors (for text circuit diagrams)
        const preElements = circuitDiagram.querySelectorAll('pre, code');
        preElements.forEach(el => {
            el.className = el.className.replace(/text-white|text-black/g, config.codeEditor.text);
        });
    }
    
    // Update output panel
    const outputPanel = document.getElementById('outputSection');
    if (outputPanel) {
        outputPanel.className = outputPanel.className.replace(/bg-\[#1a1a1a\]|bg-gray-50/g, config.outputPanel.bg);
        outputPanel.className = outputPanel.className.replace(/border-gray-800|border-gray-300/g, config.outputPanel.border);
    }

    const rightSectionTabs = document.getElementById('rightSectionTabs');
    if (rightSectionTabs) {
        rightSectionTabs.className = rightSectionTabs.className.replace(/bg-\[#1a1a1a\]|bg-gray-50/g, config.outputPanel.bg);
        rightSectionTabs.className = rightSectionTabs.className.replace(/border-gray-800|border-gray-300/g, config.outputPanel.border);
    }
    
    // Update vertical resize handle
    const resizeHandle = document.getElementById('resizeHandle');
    if (resizeHandle) {
        resizeHandle.className = resizeHandle.className.replace(/bg-gray-800|bg-gray-200/g, isDark ? 'bg-gray-800' : 'bg-gray-200');
        resizeHandle.className = resizeHandle.className.replace(/hover:bg-gray-700|hover:bg-gray-300/g, isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-300');
        const resizeHandleInner = resizeHandle.querySelector('div');
        if (resizeHandleInner) {
            resizeHandleInner.className = resizeHandleInner.className.replace(/bg-gray-600|bg-gray-400/g, isDark ? 'bg-gray-600' : 'bg-gray-400');
            resizeHandleInner.className = resizeHandleInner.className.replace(/group-hover:bg-gray-500|group-hover:bg-gray-500/g, isDark ? 'group-hover:bg-gray-500' : 'group-hover:bg-gray-500');
        }
    }
    
    // Update horizontal resize handle
    const horizontalResizeHandle = document.getElementById('horizontalResizeHandle');
    if (horizontalResizeHandle) {
        horizontalResizeHandle.className = horizontalResizeHandle.className.replace(/bg-gray-800|bg-gray-200/g, isDark ? 'bg-gray-800' : 'bg-gray-200');
        horizontalResizeHandle.className = horizontalResizeHandle.className.replace(/hover:bg-gray-700|hover:bg-gray-300/g, isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-300');
        const horizontalResizeHandleInner = horizontalResizeHandle.querySelector('div');
        if (horizontalResizeHandleInner) {
            horizontalResizeHandleInner.className = horizontalResizeHandleInner.className.replace(/bg-gray-600|bg-gray-400/g, isDark ? 'bg-gray-600' : 'bg-gray-400');
            horizontalResizeHandleInner.className = horizontalResizeHandleInner.className.replace(/group-hover:bg-gray-500|group-hover:bg-gray-500/g, isDark ? 'group-hover:bg-gray-500' : 'group-hover:bg-gray-500');
        }
    }
    
    // Update headings
    const headings = document.querySelectorAll('h1, h2, h3');
    headings.forEach(h => {
        if (isDark) {
            h.className = h.className.replace(/text-gray-\d+/g, 'text-gray-100');
        } else {
            h.className = h.className.replace(/text-gray-\d+/g, 'text-gray-900');
        }
    });
    
    // Update buttons (like example-btn)
    const runBtn = document.getElementById('runBtn');
    if (runBtn) {
        runBtn.className = runBtn.className.replace(/bg-gray-800|bg-gray-200/g, isDark ? 'bg-gray-800' : 'bg-gray-200');
        runBtn.className = runBtn.className.replace(/hover:bg-gray-700|hover:bg-gray-300/g, isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-300');
        runBtn.className = runBtn.className.replace(/text-gray-100|text-gray-900/g, isDark ? 'text-gray-100' : 'text-gray-900');
    }
    
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.className = saveBtn.className.replace(/bg-gray-800|bg-gray-200/g, isDark ? 'bg-gray-800' : 'bg-gray-200');
        saveBtn.className = saveBtn.className.replace(/hover:bg-gray-700|hover:bg-gray-300/g, isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-300');
        saveBtn.className = saveBtn.className.replace(/text-gray-100|text-gray-900/g, isDark ? 'text-gray-100' : 'text-gray-900');
    }
    
    const downloadCircuitBtn = document.getElementById('downloadCircuitBtn');
    if (downloadCircuitBtn) {
        downloadCircuitBtn.className = downloadCircuitBtn.className.replace(/bg-gray-800|bg-gray-200/g, isDark ? 'bg-gray-800' : 'bg-gray-200');
        downloadCircuitBtn.className = downloadCircuitBtn.className.replace(/hover:bg-gray-700|hover:bg-gray-300/g, isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-300');
        downloadCircuitBtn.className = downloadCircuitBtn.className.replace(/text-gray-100|text-gray-900/g, isDark ? 'text-gray-100' : 'text-gray-900');
    }
    
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.className = themeBtn.className.replace(/bg-gray-700|bg-gray-200/g, isDark ? 'bg-gray-700' : 'bg-gray-200');
        themeBtn.className = themeBtn.className.replace(/hover:bg-gray-600|hover:bg-gray-300/g, isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-300');
        themeBtn.className = themeBtn.className.replace(/text-gray-\d+/g, isDark ? 'text-gray-100' : 'text-gray-900');
    }
    
    // Update inputs and selects
    const formControls = document.querySelectorAll('input, select');
    formControls.forEach(control => {
        control.className = control.className.replace(/bg-gray-800|bg-white/g, config.input.bg);
        control.className = control.className.replace(/border-gray-700|border-gray-300/g, config.input.border);
        control.className = control.className.replace(/text-gray-100|text-gray-900|text-gray-200/g, config.input.text);
    });

    document.querySelectorAll('.theme-editor-container').forEach((container) => {
        container.className = container.className.replace(/bg-black|bg-white/g, config.codeEditor.bg);
        container.className = container.className.replace(/border-gray-800|border-gray-300/g, config.codeEditor.border);
    });

    document.querySelectorAll('label span.text-sm, .text-sm.text-gray-400').forEach((el) => {
        if (el.closest('#sidebar')) return;
        el.className = el.className.replace(/text-gray-400|text-gray-600/g, isDark ? 'text-gray-400' : 'text-gray-600');
    });
    
    // Update status indicators and info text
    const statusTexts = document.querySelectorAll('#statusIndicator, #circuitStatus, .text-gray-400');
    statusTexts.forEach(el => {
        el.className = el.className.replace(/text-gray-\d+/g, isDark ? 'text-gray-400' : 'text-gray-600');
    });
    
    // Update tables
    const thead = document.querySelector('#countsTable thead');
    if (thead) {
        thead.className = thead.className.replace(/bg-gray-800|bg-white/g, config.table.bg);
        thead.className = thead.className.replace(/text-gray-\d+/g, config.table.text);
    }
    
    const tbody = document.querySelector('#countsTableBody');
    if (tbody) {
        tbody.className = tbody.className.replace(/text-gray-300|text-gray-700/g, config.table.text);
    }
    
    // Update table rows
    const tableRows = document.querySelectorAll('#countsTableBody tr');
    tableRows.forEach(row => {
        row.className = row.className.replace(/border-gray-700|border-gray-300/g, config.table.border);
    });
    
    // Update canvas - redraw histogram if visible
    const canvas = document.getElementById('histogramCanvas');
    if (canvas && resultsDisplay && !resultsDisplay.classList.contains('hidden')) {
        // Get current counts from the table if available
        const counts = {};
        tableRows.forEach(row => {
            const state = row.querySelector('td:first-child')?.textContent;
            const count = parseInt(row.querySelector('td:nth-child(3)')?.textContent);
            if (state && count) {
                counts[state] = count;
            }
        });
        if (Object.keys(counts).length > 0) {
            drawHistogram(counts);
        }
    }
    
    // Update empty state and error messages
    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
        emptyState.className = emptyState.className.replace(/text-gray-500|text-gray-700/g, isDark ? 'text-gray-500' : 'text-gray-600');
    }
    
    // Update SVG icon stroke colors
    const logoIcon = document.getElementById('logoIcon');
    if (logoIcon) {
        const svg = logoIcon.querySelector('svg');
        if (svg) {
            svg.setAttribute('stroke', isDark ? '#ffffff' : '#000000');
        }
    }
    
    const circuitEmptyIcon = document.getElementById('circuitEmptyIcon');
    if (circuitEmptyIcon) {
        const svg = circuitEmptyIcon.querySelector('svg');
        if (svg) {
            svg.setAttribute('stroke', isDark ? '#ffffff' : '#000000');
        }
    }
    
    const emptyStateIcon = document.getElementById('emptyStateIcon');
    if (emptyStateIcon) {
        const svg = emptyStateIcon.querySelector('svg');
        if (svg) {
            svg.setAttribute('stroke', isDark ? '#ffffff' : '#000000');
        }
    }
    
    // Update compiler navigation icon
    const compilerNavIcon = document.getElementById('compilerNavIcon');
    if (compilerNavIcon) {
        compilerNavIcon.setAttribute('stroke', isDark ? '#ffffff' : '#000000');
        compilerNavIcon.parentElement.className = compilerNavIcon.parentElement.className.replace( isDark ? /text-gray-900/g : /text-gray-100/g, isDark ? 'text-gray-100' : 'text-gray-900');
    }
    
    // Update save button icon
    const saveBtnIcon = document.getElementById('saveBtnIcon');
    if (saveBtnIcon) {
        saveBtnIcon.setAttribute('stroke', isDark ? '#ffffff' : '#000000');
    }
    
    // Update run button icon
    const runBtnIcon = document.getElementById('runBtnIcon');
    if (runBtnIcon) {
        runBtnIcon.setAttribute('stroke', isDark ? '#ffffff' : '#000000');
    }
    
    // Update download circuit button icon
    const downloadCircuitBtnIcon = document.getElementById('downloadCircuitBtnIcon');
    if (downloadCircuitBtnIcon) {
        downloadCircuitBtnIcon.setAttribute('stroke', isDark ? '#ffffff' : '#000000');
    }
    
    // Update theme button icon
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        if (isDark) {
            // Dark mode: show moon icon
            themeIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                </svg>
            `;
        } else {
            // Light mode: show sun icon
            themeIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 2v2"></path>
                    <path d="M12 20v2"></path>
                    <path d="m4.93 4.93 1.41 1.41"></path>
                    <path d="m17.66 17.66 1.41 1.41"></path>
                    <path d="M2 12h2"></path>
                    <path d="M20 12h2"></path>
                    <path d="m6.34 17.66-1.41 1.41"></path>
                    <path d="m19.07 4.93-1.41 1.41"></path>
                </svg>
            `;
        }
    }

    applyHomePageTheme(theme);
    applyCircuitPageTheme(theme);
    syncAppShellLayout();
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
}

// Initialize theme icon on page load
function initializeThemeIcon() {
    const theme = localStorage.getItem('theme') || 'dark';
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        const isDark = theme === 'dark';
        if (isDark) {
            // Dark mode: show moon icon
            themeIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                </svg>
            `;
        } else {
            // Light mode: show sun icon
            themeIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 2v2"></path>
                    <path d="M12 20v2"></path>
                    <path d="m4.93 4.93 1.41 1.41"></path>
                    <path d="m17.66 17.66 1.41 1.41"></path>
                    <path d="M2 12h2"></path>
                    <path d="M20 12h2"></path>
                    <path d="m6.34 17.66-1.41 1.41"></path>
                    <path d="m19.07 4.93-1.41 1.41"></path>
                </svg>
            `;
        }
    }
}

function loadTheme() {
    const theme = localStorage.getItem('theme') || 'dark';
    applyTheme(theme);
}
