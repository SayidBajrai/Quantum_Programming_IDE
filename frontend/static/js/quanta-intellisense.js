/**
 * Monaco hover, signature help, and completion for Quanta (quanta-lang 0.1.16+).
 */
(function () {
    let functionCache = null;
    let cachePromise = null;
    const docFetchCache = new Map();

    async function loadFunctionCache() {
        if (functionCache) return functionCache;
        if (cachePromise) return cachePromise;
        cachePromise = fetch('/list-functions')
            .then(r => r.json())
            .then(data => {
                if (data.success && Array.isArray(data.functions)) {
                    functionCache = data.functions;
                } else {
                    functionCache = [];
                }
                return functionCache;
            })
            .catch(() => {
                functionCache = [];
                return functionCache;
            });
        return cachePromise;
    }

    async function fetchFunctionDoc(name, source) {
        const cacheKey = `${name}\0${source || ''}`;
        if (docFetchCache.has(cacheKey)) {
            return docFetchCache.get(cacheKey);
        }
        const promise = fetch('/function-docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, source })
        })
            .then(r => (r.ok ? r.json() : null))
            .then(data => (data && data.success ? data.doc : null))
            .catch(() => null);
        docFetchCache.set(cacheKey, promise);
        return promise;
    }

    function getWordAtPosition(model, position) {
        return model.getWordAtPosition(position);
    }

    function getTextBeforePosition(model, position) {
        const parts = [];
        for (let ln = 1; ln < position.lineNumber; ln++) {
            parts.push(model.getLineContent(ln), '\n');
        }
        parts.push(model.getLineContent(position.lineNumber).substring(0, position.column - 1));
        return parts.join('');
    }

    function countArgIndexAtDepthZero(text) {
        let depth = 0;
        let commas = 0;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (c === '(') depth++;
            else if (c === ')') depth--;
            else if (c === ',' && depth === 0) commas++;
        }
        return commas;
    }

    function findCallContext(model, position) {
        const textBefore = getTextBeforePosition(model, position);
        let depth = 0;
        let openParen = -1;

        for (let i = textBefore.length - 1; i >= 0; i--) {
            const c = textBefore[i];
            if (c === ')') depth++;
            else if (c === '(') {
                if (depth === 0) {
                    openParen = i;
                    break;
                }
                depth--;
            }
        }
        if (openParen < 0) return null;

        const beforeParen = textBefore.substring(0, openParen).trim();
        const calleeMatch = beforeParen.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
        if (!calleeMatch) return null;

        const insideParens = textBefore.substring(openParen + 1);
        return {
            callee: calleeMatch[1],
            argIndex: countArgIndexAtDepthZero(insideParens)
        };
    }

    function paramNamesFromList(paramStr) {
        if (!paramStr || !paramStr.trim()) return [];
        return paramStr.split(',').map(part => {
            const trimmed = part.trim();
            const tokens = trimmed.split(/\s+/);
            return tokens[tokens.length - 1];
        });
    }

    function findDeclParamContext(model, position, paramName) {
        const line = model.getLineContent(position.lineNumber);

        const gateMatch = line.match(/^gate\s+(\w+)\s*\(([^)]*)\)/);
        if (gateMatch) {
            const params = paramNamesFromList(gateMatch[2]);
            const idx = params.indexOf(paramName);
            if (idx >= 0) return { callee: gateMatch[1], argIndex: idx };
        }

        const funcMatch = line.match(/^func\s+(.+?)\s*\(([^)]*)\)/);
        if (funcMatch) {
            const beforeParts = funcMatch[1].trim().split(/\s+/);
            const callee = beforeParts[beforeParts.length - 1];
            const params = paramNamesFromList(funcMatch[2]);
            const idx = params.indexOf(paramName);
            if (idx >= 0) return { callee, argIndex: idx };
        }

        return null;
    }

    function toMarkdownHover(lines) {
        // Monaco renders hover as Markdown; single \n collapses to a space.
        // Trailing two spaces before \n forces a hard line break.
        return { value: lines.join('  \n') };
    }

    function summaryLines(doc) {
        if (doc.summary) {
            return doc.summary.split('\n').map(line => line.trim()).filter(Boolean);
        }
        if (doc.name) return [doc.name];
        return [];
    }

    function formatFunctionHover(doc) {
        if (!doc) return null;
        const lines = summaryLines(doc);
        if (doc.params && doc.params.length) {
            lines.push('Parameters:');
            doc.params.forEach(p => {
                const detail = p.description ? ` — ${p.description}` : '';
                lines.push(`${p.name} (${p.type})${detail}`);
            });
        }
        if (doc.returns && doc.returns !== 'void') {
            lines.push(`Returns: ${doc.returns}`);
        }
        if (!lines.length) return null;
        return toMarkdownHover(lines);
    }

    function formatParamHover(doc, argIndex) {
        if (!doc || !doc.params || argIndex < 0 || argIndex >= doc.params.length) return null;
        const p = doc.params[argIndex];
        const detail = p.description ? ` — ${p.description}` : '';
        return { value: `${p.name} (${p.type})${detail}` };
    }

    function buildSignatureHelp(doc, activeParameter) {
        if (!doc) return null;
        const label = doc.signature || `${doc.name}(...)`;
        const parameters = (doc.params || []).map(p => ({
            label: p.type ? `${p.type} ${p.name}` : p.name,
            documentation: p.description
                ? `${p.name} (${p.type}) — ${p.description}`
                : `${p.name} (${p.type})`
        }));

        const paramCount = parameters.length;
        const active = paramCount > 0
            ? Math.min(Math.max(activeParameter, 0), paramCount - 1)
            : 0;

        return {
            signatures: [{
                label,
                documentation: doc.summary || '',
                parameters
            }],
            activeSignature: 0,
            activeParameter: active
        };
    }

    window.setupQuantaIntelliSense = function setupQuantaIntelliSense(monaco) {
        if (!monaco) return;

        loadFunctionCache();

        monaco.languages.registerHoverProvider('quanta', {
            provideHover: async (model, position) => {
                const wordInfo = getWordAtPosition(model, position);
                if (!wordInfo) return null;

                const source = model.getValue();
                const word = wordInfo.word;

                const callCtx = findCallContext(model, position);
                const declCtx = findDeclParamContext(model, position, word);
                const paramCtx = declCtx || (callCtx && callCtx.callee !== word ? callCtx : null);

                if (paramCtx) {
                    const doc = await fetchFunctionDoc(paramCtx.callee, source);
                    const paramHover = formatParamHover(doc, paramCtx.argIndex);
                    if (paramHover) {
                        return {
                            range: wordInfo,
                            contents: [paramHover]
                        };
                    }
                }

                const doc = await fetchFunctionDoc(word, source);
                const content = formatFunctionHover(doc);
                if (!content) return null;
                return { range: wordInfo, contents: [content] };
            }
        });

        monaco.languages.registerSignatureHelpProvider('quanta', {
            signatureHelpTriggerCharacters: ['(', ','],
            signatureHelpRetriggerCharacters: [','],
            provideSignatureHelp: async (model, position) => {
                const callCtx = findCallContext(model, position);
                if (!callCtx) {
                    return { value: { signatures: [], activeSignature: 0, activeParameter: 0 }, dispose: () => {} };
                }

                const doc = await fetchFunctionDoc(callCtx.callee, model.getValue());
                const value = buildSignatureHelp(doc, callCtx.argIndex);
                if (!value) {
                    return { value: { signatures: [], activeSignature: 0, activeParameter: 0 }, dispose: () => {} };
                }

                return { value, dispose: () => {} };
            }
        });

        monaco.languages.registerCompletionItemProvider('quanta', {
            triggerCharacters: ['(', '.'],
            provideCompletionItems: async (model, position) => {
                await loadFunctionCache();
                const wordInfo = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: wordInfo.startColumn,
                    endColumn: position.column
                };
                const prefix = wordInfo.word.toLowerCase();

                const suggestions = (functionCache || [])
                    .filter(fn => !prefix || fn.name.toLowerCase().startsWith(prefix))
                    .map(fn => ({
                        label: fn.name,
                        kind: monaco.languages.CompletionItemKind.Function,
                        detail: fn.signature,
                        documentation: formatFunctionHover(fn)?.value || fn.summary,
                        insertText: fn.name,
                        range
                    }));

                const keywords = ['qbit', 'bit', 'qint', 'gate', 'func', 'for', 'if', 'else', 'while', 'var', 'const', 'let', 'ctrl', 'inv'];
                keywords.forEach(kw => {
                    if (!prefix || kw.startsWith(prefix)) {
                        suggestions.push({
                            label: kw,
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: kw,
                            range
                        });
                    }
                });

                return { suggestions };
            }
        });
    };

    window.invalidateQuantaFunctionCache = function () {
        functionCache = null;
        cachePromise = null;
        docFetchCache.clear();
    };

    window.invalidateQuantaDocCache = function () {
        docFetchCache.clear();
    };

    window.setupQuantaDocCacheInvalidation = function setupQuantaDocCacheInvalidation(editor) {
        if (!editor) return;
        let timeout;
        editor.onDidChangeModelContent(() => {
            clearTimeout(timeout);
            timeout = setTimeout(() => docFetchCache.clear(), 600);
        });
    };
})();
