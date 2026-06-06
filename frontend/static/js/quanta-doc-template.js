/**
 * Auto-generate /// documentation templates above func/gate declarations in Quanta.
 *
 * Format matches quanta-lang comment_parser (summary, typed params, return:).
 */
(function () {
    const QUANTA_BASE_TYPES = new Set([
        'int', 'float', 'bool', 'str', 'var', 'list', 'dict',
        'qbit', 'bit', 'qint', 'bint', 'qdec', 'qfloat'
    ]);

    const PARAM_ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];

    function isQuantaType(typeName) {
        if (!typeName) return false;
        const base = typeName.replace(/\[.*$/, '');
        if (QUANTA_BASE_TYPES.has(base)) return true;
        return /^(qint|qdec|float|qfloat)\[/i.test(typeName);
    }

    function parseParamList(paramStr, defaultType) {
        if (!paramStr || !paramStr.trim()) return [];
        return paramStr.split(',').map((raw, index) => {
            const part = raw.trim();
            const typed = part.match(/^(\S+)\s+(\w+)$/);
            if (typed && isQuantaType(typed[1])) {
                return { type: typed[1], name: typed[2], index };
            }
            const name = part.split(/\s+/).pop() || `arg${index + 1}`;
            return { type: defaultType, name, index };
        });
    }

    function parseFuncOrGate(text) {
        const gateMatch = text.match(/^gate\s+(\w+)\s*\(([^)]*)\)/);
        if (gateMatch) {
            return {
                kind: 'gate',
                name: gateMatch[1],
                returnType: null,
                params: parseParamList(gateMatch[2], 'qbit')
            };
        }

        const funcMatch = text.match(/^func\s+(.+?)\s*\(([^)]*)\)/);
        if (!funcMatch) return null;

        const beforeParen = funcMatch[1].trim();
        const parts = beforeParen.split(/\s+/);
        let returnType = null;
        let name;

        if (parts.length >= 2 && isQuantaType(parts[0])) {
            returnType = parts[0];
            name = parts[parts.length - 1];
        } else {
            name = parts[parts.length - 1];
        }

        return {
            kind: 'func',
            name,
            returnType,
            params: parseParamList(funcMatch[2], 'var')
        };
    }

    function findNextNonEmptyLine(model, lineNumber) {
        const total = model.getLineCount();
        for (let ln = lineNumber + 1; ln <= total; ln++) {
            const text = model.getLineContent(ln).trim();
            if (text) return { lineNumber: ln, text };
        }
        return null;
    }

    function generateDocTemplate(parsed) {
        const lines = [];
        const kindLabel = parsed.kind === 'gate' ? 'gate' : 'function';
        lines.push(`/// - ${parsed.name} ${kindLabel}`);

        parsed.params.forEach((param) => {
            const ordinal = PARAM_ORDINALS[param.index] || `${param.index + 1}th`;
            const label = parsed.kind === 'func' ? `${ordinal} variable` : `${ordinal} parameter`;
            lines.push(`/// ${param.type} ${param.name} - ${label}`);
        });

        if (parsed.kind === 'func' && parsed.returnType) {
            lines.push(`/// return: ${parsed.returnType} - result of ${parsed.name}`);
        }

        return lines.join('\n');
    }

    function tryExpandDocTemplate(model, lineNumber) {
        const lineContent = model.getLineContent(lineNumber);
        if (lineContent.trim() !== '///') return false;

        const next = findNextNonEmptyLine(model, lineNumber);
        if (!next) return false;

        const parsed = parseFuncOrGate(next.text);
        if (!parsed) return false;

        const template = generateDocTemplate(parsed);
        window._quantaDocGenerating = true;
        try {
            model.pushEditOperations([], [{
                range: {
                    startLineNumber: lineNumber,
                    startColumn: 1,
                    endLineNumber: lineNumber,
                    endColumn: lineContent.length + 1
                },
                text: template
            }], () => null);
        } finally {
            window._quantaDocGenerating = false;
        }
        return true;
    }

    window.setupQuantaDocAutoGenerate = function setupQuantaDocAutoGenerate(editor) {
        if (!editor) return;

        editor.onDidChangeModelContent((event) => {
            if (window._quantaDocGenerating) return;

            const model = editor.getModel();
            if (!model || model.getLanguageId() !== 'quanta') return;

            queueMicrotask(() => {
                if (window._quantaDocGenerating) return;
                const linesToCheck = new Set();
                for (const change of event.changes) {
                    linesToCheck.add(change.range.endLineNumber);
                    if (change.range.startLineNumber !== change.range.endLineNumber) {
                        linesToCheck.add(change.range.startLineNumber);
                    }
                }
                for (const lineNumber of linesToCheck) {
                    if (tryExpandDocTemplate(model, lineNumber)) break;
                }
            });
        });
    };
})();
