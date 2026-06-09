/**
 * Monaco snippet contributions for Quanta.
 */
(function () {
    const SNIPPETS = [
        { label: 'gate Bell', insertText: '/// - ${1:name} gate\n/// qbit ${2:a} - first parameter\n/// qbit ${3:b} - second parameter\ngate ${1:name}(${2:a}, ${3:b}) {\n    H(${2:a})\n    CNot(${2:a}, ${3:b})\n}\n', docs: 'Bell pair gate macro' },
        { label: 'func add', insertText: '/// - ${1:add} function\n/// var ${2:a} - first variable\n/// var ${3:b} - second variable\n/// return: int - result\nfunc int ${1:add}(${2:a}, ${3:b}) {\n    return ${2:a} + ${3:b};\n}\n', docs: 'Classical function with /// docs' },
        { label: 'qint QAdd', insertText: 'qint[${1:4}] a, b, result\nQAdd(a, b, result)\nPrint(f"{result:prob}")\n', docs: 'Quantum addition snippet' },
        { label: 'debug bloch', insertText: 'qbit q\nH(q)\nPrint(f"${q:bloch}")\n', docs: 'Debug Bloch sphere output' },
        { label: 'debug summary', insertText: 'qbit[${1:2}] q\nH(q[0])\nPrint(f"{q:summary}")\n', docs: 'Debug state summary' },
        { label: 'ctrl block', insertText: 'ctrl {\n    ${1:CNot(control, target)}\n}\n', docs: 'Controlled gate block' },
        { label: 'Grover', insertText: 'qint[${1:3}] x\n// uniform superposition on x required\nGrover(x, ${2:target})\n', docs: 'Grover iteration' },
    ];

    const FORMAT_SPECS = ['prob', 'bloch', 'summary', 'circuit', 'entropy', 'density', 'amplitudes', 'sym', 'bv'];

    window.setupQuantaSnippets = function setupQuantaSnippets(monaco) {
        if (!monaco) return;
        monaco.languages.registerCompletionItemProvider('quanta', {
            triggerCharacters: [':', '/'],
            provideCompletionItems: (model, position) => {
                const line = model.getLineContent(position.lineNumber);
                const before = line.substring(0, position.column - 1);
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: position.column,
                };
                const suggestions = [];

                if (before.endsWith('{') || before.match(/\{[^}:]*:$/)) {
                    FORMAT_SPECS.forEach(spec => {
                        suggestions.push({
                            label: `:${spec}`,
                            kind: monaco.languages.CompletionItemKind.Value,
                            detail: `Print format :${spec}`,
                            insertText: spec,
                            range,
                        });
                    });
                }

                if (before.trim() === '/' || before.endsWith('//')) {
                    suggestions.push({
                        label: '/// doc template',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: '/// - ${1:description}\n',
                        documentation: 'Start /// documentation block',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        range,
                    });
                }

                SNIPPETS.forEach(s => {
                    suggestions.push({
                        label: s.label,
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        documentation: s.docs,
                        insertText: s.insertText,
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        range,
                    });
                });
                return { suggestions };
            },
        });
    };
})();
