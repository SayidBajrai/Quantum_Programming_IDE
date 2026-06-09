/**
 * Auto-convert $...$ math shortcuts to Quanta operator symbols in the editor.
 *
 * $\odot$ | $\o.$ | $\ew*$ | $\ElementwiseProduct$  -> ⊙
 * $\otimes$ | $\ox$ | $\t*$ | $\TensorProduct$      -> ⊗
 */
(function () {
    const SYMBOL_SHORTCUTS = [
        {
            pattern: /\$(?:\\odot|o\.|ew\*|ElementwiseProduct)\$/g,
            symbol: '⊙'
        },
        {
            pattern: /\$(?:\\otimes|ox|t\*|TensorProduct)\$/g,
            symbol: '⊗'
        }
    ];

    function applySymbolShortcuts(text) {
        let result = text;
        let changed = false;

        for (const { pattern, symbol } of SYMBOL_SHORTCUTS) {
            const next = result.replace(pattern, symbol);
            if (next !== result) {
                result = next;
                changed = true;
            }
        }

        return changed ? result : null;
    }

    function tryConvertSymbolShortcuts(model, lineNumber) {
        const lineContent = model.getLineContent(lineNumber);
        const converted = applySymbolShortcuts(lineContent);
        if (converted === null) return false;

        window._quantaSymbolConverting = true;
        try {
            model.pushEditOperations([], [{
                range: {
                    startLineNumber: lineNumber,
                    startColumn: 1,
                    endLineNumber: lineNumber,
                    endColumn: lineContent.length + 1
                },
                text: converted
            }], () => null);
        } finally {
            window._quantaSymbolConverting = false;
        }
        return true;
    }

    window.setupQuantaSymbolConvert = function setupQuantaSymbolConvert(editor) {
        if (!editor) return;

        editor.onDidChangeModelContent((event) => {
            if (window._quantaSymbolConverting) return;

            const model = editor.getModel();
            if (!model || model.getLanguageId() !== 'quanta') return;

            queueMicrotask(() => {
                if (window._quantaSymbolConverting) return;

                const linesToCheck = new Set();
                for (const change of event.changes) {
                    linesToCheck.add(change.range.endLineNumber);
                    if (change.range.startLineNumber !== change.range.endLineNumber) {
                        linesToCheck.add(change.range.startLineNumber);
                    }
                }

                for (const lineNumber of linesToCheck) {
                    if (tryConvertSymbolShortcuts(model, lineNumber)) break;
                }
            });
        });
    };
})();
