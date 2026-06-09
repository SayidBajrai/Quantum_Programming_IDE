/**
 * Monaco hover, signature help, and completion for Quanta (quanta-lang 0.1.16+).
 */
(function () {
    let functionCache = null;
    let cachePromise = null;
    const docFetchCache = new Map();
    let userFunctionCache = { source: '', functions: [] };

    const CATEGORIES = [
        { id: '', label: 'All' },
        { id: 'gate', label: 'Gates' },
        { id: 'high_level_gate', label: 'High-level gates' },
        { id: 'quantum_arithmetic', label: 'Arithmetic' },
        { id: 'stdlib', label: 'Stdlib' },
        { id: 'tensor', label: 'Tensor' },
    ];

    const MODIFIER_DOCS = {
        ctrl: 'Apply gates in the block conditionally when the control qubit is |1⟩.',
        inv: 'Invert (adjoint) of the gate block.',
    };

    async function loadFunctionCache(category) {
        const url = category ? `/list-functions?category=${category}` : '/list-functions';
        const res = await fetch(url);
        const data = await res.json();
        return data.success && Array.isArray(data.functions) ? data.functions : [];
    }

    async function loadAllFunctionCache() {
        if (functionCache) return functionCache;
        if (cachePromise) return cachePromise;
        cachePromise = loadFunctionCache('').then(fns => {
            functionCache = fns;
            return fns;
        }).catch(() => { functionCache = []; return []; });
        return cachePromise;
    }

    async function loadUserFunctions(source) {
        if (!source) return [];
        if (userFunctionCache.source === source) return userFunctionCache.functions;
        try {
            const res = await fetch('/list-user-functions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source }),
            });
            const data = await res.json();
            userFunctionCache = {
                source,
                functions: data.success ? data.functions : [],
            };
            return userFunctionCache.functions;
        } catch {
            return [];
        }
    }

    async function fetchFunctionDoc(name, source) {
        const cacheKey = `${name}\0${source || ''}`;
        if (docFetchCache.has(cacheKey)) return docFetchCache.get(cacheKey);
        const promise = fetch('/function-docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, source }),
        })
            .then(r => (r.ok ? r.json() : null))
            .then(data => (data && data.success ? data.doc : null))
            .catch(() => null);
        docFetchCache.set(cacheKey, promise);
        return promise;
    }

    function getTextBeforePosition(model, position) {
        const parts = [];
        for (let ln = 1; ln < position.lineNumber; ln++) parts.push(model.getLineContent(ln), '\n');
        parts.push(model.getLineContent(position.lineNumber).substring(0, position.column - 1));
        return parts.join('');
    }

    function countArgIndexAtDepthZero(text) {
        let depth = 0, commas = 0;
        for (const c of text) {
            if (c === '(') depth++;
            else if (c === ')') depth--;
            else if (c === ',' && depth === 0) commas++;
        }
        return commas;
    }

    function findCallContext(model, position) {
        const textBefore = getTextBeforePosition(model, position);
        let depth = 0, openParen = -1;
        for (let i = textBefore.length - 1; i >= 0; i--) {
            const c = textBefore[i];
            if (c === ')') depth++;
            else if (c === '(') {
                if (depth === 0) { openParen = i; break; }
                depth--;
            }
        }
        if (openParen < 0) return null;
        const beforeParen = textBefore.substring(0, openParen).trim();
        const calleeMatch = beforeParen.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
        if (!calleeMatch) return null;
        return {
            callee: calleeMatch[1],
            argIndex: countArgIndexAtDepthZero(textBefore.substring(openParen + 1)),
        };
    }

    function findDeclParamContext(model, position, paramName) {
        const line = model.getLineContent(position.lineNumber);
        const gateMatch = line.match(/^gate\s+(\w+)\s*\(([^)]*)\)/);
        if (gateMatch) {
            const params = gateMatch[2].split(',').map(p => p.trim().split(/\s+/).pop());
            const idx = params.indexOf(paramName);
            if (idx >= 0) return { callee: gateMatch[1], argIndex: idx };
        }
        const funcMatch = line.match(/^func\s+(.+?)\s*\(([^)]*)\)/);
        if (funcMatch) {
            const callee = funcMatch[1].trim().split(/\s+/).pop();
            const params = funcMatch[2].split(',').map(p => p.trim().split(/\s+/).pop());
            const idx = params.indexOf(paramName);
            if (idx >= 0) return { callee, argIndex: idx };
        }
        return null;
    }

    function toMarkdownHover(lines) {
        return { value: lines.join('  \n') };
    }

    function summaryLines(doc) {
        if (doc.summary) return doc.summary.split('\n').map(l => l.trim()).filter(Boolean);
        if (doc.name) return [doc.name];
        return [];
    }

    function formatFunctionHover(doc) {
        if (!doc) return null;
        const lines = summaryLines(doc);
        if (doc.params && doc.params.length) {
            lines.push('Parameters:');
            doc.params.forEach(p => {
                lines.push(`${p.name} (${p.type})${p.description ? ` — ${p.description}` : ''}`);
            });
        }
        if (doc.returns && doc.returns !== 'void') lines.push(`Returns: ${doc.returns}`);
        if (doc.notes && doc.notes.length) {
            lines.push('Notes:');
            doc.notes.forEach(n => lines.push(`  ${n}`));
        }
        if (!lines.length) return null;
        return toMarkdownHover(lines);
    }

    function formatParamHover(doc, argIndex) {
        if (!doc || !doc.params || argIndex < 0 || argIndex >= doc.params.length) return null;
        const p = doc.params[argIndex];
        return { value: `${p.name} (${p.type})${p.description ? ` — ${p.description}` : ''}` };
    }

    function buildSignatureHelp(doc, activeParameter) {
        if (!doc) return null;
        const parameters = (doc.params || []).map(p => ({
            label: p.type ? `${p.type} ${p.name}` : p.name,
            documentation: [
                p.description ? `${p.name} (${p.type}) — ${p.description}` : `${p.name} (${p.type})`,
                ...(doc.notes || []).map(n => `Note: ${n}`),
            ].join('\n'),
        }));
        const paramCount = parameters.length;
        const minNote = doc.min_args != null ? `Minimum arguments: ${doc.min_args}` : '';
        return {
            signatures: [{
                label: doc.signature || `${doc.name}(...)`,
                documentation: [doc.summary || '', minNote, ...(doc.notes || [])].filter(Boolean).join('\n'),
                parameters,
            }],
            activeSignature: 0,
            activeParameter: paramCount > 0 ? Math.min(Math.max(activeParameter, 0), paramCount - 1) : 0,
        };
    }

    window.setupQuantaIntelliSense = function setupQuantaIntelliSense(monaco) {
        if (!monaco) return;
        loadAllFunctionCache();

        monaco.languages.registerHoverProvider('quanta', {
            provideHover: async (model, position) => {
                const wordInfo = model.getWordAtPosition(position);
                if (!wordInfo) return null;
                const word = wordInfo.word;
                const source = model.getValue();

                if (MODIFIER_DOCS[word]) {
                    return { range: wordInfo, contents: [{ value: MODIFIER_DOCS[word] }] };
                }

                const callCtx = findCallContext(model, position);
                const declCtx = findDeclParamContext(model, position, word);
                const paramCtx = declCtx || (callCtx && callCtx.callee !== word ? callCtx : null);

                if (paramCtx) {
                    const doc = await fetchFunctionDoc(paramCtx.callee, source);
                    const paramHover = formatParamHover(doc, paramCtx.argIndex);
                    if (paramHover) return { range: wordInfo, contents: [paramHover] };
                }

                const doc = await fetchFunctionDoc(word, source);
                const content = formatFunctionHover(doc);
                if (!content) return null;
                return { range: wordInfo, contents: [content] };
            },
        });

        monaco.languages.registerSignatureHelpProvider('quanta', {
            signatureHelpTriggerCharacters: ['(', ','],
            signatureHelpRetriggerCharacters: [','],
            provideSignatureHelp: async (model, position) => {
                const callCtx = findCallContext(model, position);
                if (!callCtx) return { value: { signatures: [], activeSignature: 0, activeParameter: 0 }, dispose: () => {} };
                const doc = await fetchFunctionDoc(callCtx.callee, model.getValue());
                const value = buildSignatureHelp(doc, callCtx.argIndex);
                return { value: value || { signatures: [], activeSignature: 0, activeParameter: 0 }, dispose: () => {} };
            },
        });

        monaco.languages.registerCompletionItemProvider('quanta', {
            triggerCharacters: ['(', '.'],
            provideCompletionItems: async (model, position) => {
                const builtins = await loadAllFunctionCache();
                const userFns = await loadUserFunctions(model.getValue());
                const wordInfo = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: wordInfo.startColumn,
                    endColumn: position.column,
                };
                const prefix = wordInfo.word.toLowerCase();
                const seen = new Set();
                const suggestions = [];

                [...userFns, ...builtins].forEach(fn => {
                    if (seen.has(fn.name)) return;
                    if (prefix && !fn.name.toLowerCase().startsWith(prefix)) return;
                    seen.add(fn.name);
                    suggestions.push({
                        label: fn.name,
                        kind: monaco.languages.CompletionItemKind.Function,
                        detail: fn.signature || fn.category,
                        documentation: formatFunctionHover(fn)?.value || fn.summary,
                        insertText: fn.name,
                        range,
                        sortText: fn.category === 'user' || fn.category === 'user_gate' ? `0_${fn.name}` : `1_${fn.name}`,
                    });
                });

                ['qbit', 'bit', 'qint', 'gate', 'func', 'for', 'if', 'else', 'while', 'var', 'const', 'let', 'ctrl', 'inv'].forEach(kw => {
                    if (!prefix || kw.startsWith(prefix)) {
                        suggestions.push({
                            label: kw,
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: kw,
                            range,
                        });
                    }
                });
                return { suggestions };
            },
        });

        if (typeof setupQuantaSnippets === 'function') setupQuantaSnippets(monaco);
    };

    window.populateQuantaFunctionBrowser = async function populateQuantaFunctionBrowser(selectEl, listEl, source) {
        if (!selectEl || !listEl) return;
        selectEl.innerHTML = CATEGORIES.map(c =>
            `<option value="${c.id}">${c.label}</option>`
        ).join('');
        async function refresh() {
            const cat = selectEl.value;
            const builtins = await loadFunctionCache(cat);
            const userFns = await loadUserFunctions(source || '');
            const fns = [...userFns, ...builtins.filter(f => !cat || f.category === cat)];
            listEl.innerHTML = fns.map(f =>
                `<button type="button" class="quanta-fn-pick w-full text-left px-2 py-1 rounded hover:bg-gray-800 text-xs font-mono text-gray-300" data-name="${f.name}" title="${(f.summary || '').replace(/"/g, "'")}">${f.name}</button>`
            ).join('');
            listEl.querySelectorAll('.quanta-fn-pick').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (window.monacoEditor) {
                        const pos = window.monacoEditor.getPosition();
                        window.monacoEditor.executeEdits('fn-browser', [{
                            range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                            text: btn.dataset.name,
                        }]);
                        window.monacoEditor.focus();
                    }
                });
            });
        }
        selectEl.addEventListener('change', refresh);
        await refresh();
    };

    window.invalidateQuantaFunctionCache = function () {
        functionCache = null;
        cachePromise = null;
        docFetchCache.clear();
        userFunctionCache = { source: '', functions: [] };
    };

    window.invalidateQuantaDocCache = function () {
        docFetchCache.clear();
        userFunctionCache = { source: '', functions: [] };
    };

    window.setupQuantaDocCacheInvalidation = function setupQuantaDocCacheInvalidation(editor) {
        if (!editor) return;
        let timeout;
        editor.onDidChangeModelContent(() => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                docFetchCache.clear();
                userFunctionCache = { source: '', functions: [] };
            }, 600);
        });
    };
})();
