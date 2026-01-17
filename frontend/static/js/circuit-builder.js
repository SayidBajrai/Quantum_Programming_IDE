/**
 * Circuit Builder - Drag and Drop Quantum Circuit Builder
 */

// Circuit state
let circuitState = {
    qubits: 2, // Number of qubits
    gates: []  // Array of {id: string, qubit: number, column: number, gate: string, params: object, targetQubit: number}
};

// Gate definitions
const gateDefinitions = {
    'h': { name: 'H', label: 'H', singleQubit: true, color: '#10b981' },
    'x': { name: 'X', label: 'X', singleQubit: true, color: '#10b981' },
    'y': { name: 'Y', label: 'Y', singleQubit: true, color: '#10b981' },
    'z': { name: 'Z', label: 'Z', singleQubit: true, color: '#10b981' },
    's': { name: 'S', label: 'S', singleQubit: true, color: '#10b981' },
    't': { name: 'T', label: 'T', singleQubit: true, color: '#10b981' },
    'rx': { name: 'RX', label: 'RX(θ)', singleQubit: true, hasParam: true, paramName: 'theta', color: '#10b981' },
    'ry': { name: 'RY', label: 'RY(θ)', singleQubit: true, hasParam: true, paramName: 'theta', color: '#10b981' },
    'rz': { name: 'RZ', label: 'RZ(θ)', singleQubit: true, hasParam: true, paramName: 'theta', color: '#10b981' },
    'cx': { name: 'CX', label: 'CX', singleQubit: false, color: '#10b981' },
    'cy': { name: 'CY', label: 'CY', singleQubit: false, color: '#10b981' },
    'cz': { name: 'CZ', label: 'CZ', singleQubit: false, color: '#10b981' },
    'swap': { name: 'SWAP', label: 'SWAP', singleQubit: false, color: '#10b981' },
    'measure': { name: 'M', label: 'M', singleQubit: true, color: '#70ff98' }
};

// Global variables for circuit builder
let circuitBuilderMonacoEditor = null;
let draggedGate = null;
let circuitBuilder = null;
let gatePalette = null;
let isCircuitBuilderPage = false;

// Initialize circuit builder
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the circuit builder page
    if (!document.getElementById('circuitBuilder')) {
        return; // Not on circuit builder page
    }

    isCircuitBuilderPage = true;
    circuitBuilder = document.getElementById('circuitBuilder');
    gatePalette = document.getElementById('gatePalette');
    
    initializeGatePalette();
    initializeCircuitBuilder();
    initializeMonacoEditor();
    setupEventListeners();
    renderCircuit();
    updateQASMCode();
});

function initializeGatePalette() {
    if (!gatePalette) return;
    
    gatePalette.innerHTML = '';
    
    // Single qubit gates
    const singleQubitGates = Object.entries(gateDefinitions).filter(([_, def]) => def.singleQubit);
    const multiQubitGates = Object.entries(gateDefinitions).filter(([_, def]) => !def.singleQubit);
    
    // Create section for single qubit gates
    const singleSection = document.createElement('div');
    singleSection.className = 'mb-4';
    const singleTitle = document.createElement('div');
    singleTitle.className = 'text-xs text-gray-500 mb-2 px-2';
    singleTitle.textContent = 'Single Qubit';
    singleSection.appendChild(singleTitle);
    
    singleQubitGates.forEach(([key, def]) => {
        const button = createGateButton(key, def);
        singleSection.appendChild(button);
    });
    
    // Create section for multi-qubit gates
    const multiSection = document.createElement('div');
    multiSection.className = 'mb-4';
    const multiTitle = document.createElement('div');
    multiTitle.className = 'text-xs text-gray-500 mb-2 px-2';
    multiTitle.textContent = 'Multi Qubit';
    multiSection.appendChild(multiTitle);
    
    multiQubitGates.forEach(([key, def]) => {
        const button = createGateButton(key, def);
        multiSection.appendChild(button);
    });
    
    gatePalette.appendChild(singleSection);
    gatePalette.appendChild(multiSection);
}

function createGateButton(key, def) {
    const button = document.createElement('button');
    button.className = 'w-full text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition text-sm mb-2 draggable-gate';
    button.setAttribute('draggable', 'true');
    button.setAttribute('data-gate', key);
    button.textContent = def.label;
    button.style.borderLeft = `3px solid ${def.color}`;
    
    button.addEventListener('dragstart', (e) => {
        draggedGate = { key, def };
        e.dataTransfer.effectAllowed = 'copy';
        button.style.opacity = '0.5';
    });
    
    button.addEventListener('dragend', () => {
        button.style.opacity = '1';
        draggedGate = null;
    });
    
    return button;
}

function initializeCircuitBuilder() {
    if (!circuitBuilder) return;
    
    let draggedExistingGate = null;
    
    circuitBuilder.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    
    circuitBuilder.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Get SVG element to calculate proper coordinates
        const svg = circuitBuilder.querySelector('svg');
        if (!svg) return;
        
        const svgRect = svg.getBoundingClientRect();
        const point = svg.createSVGPoint();
        point.x = e.clientX;
        point.y = e.clientY;
        const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
        
        // Calculate which qubit and column based on SVG coordinates
        const qubitHeight = 60;
        const columnWidth = 80;
        const qubit = Math.floor(svgPoint.y / qubitHeight);
        const column = Math.max(0, Math.floor((svgPoint.x - 100) / columnWidth)); // Account for qubit labels
        
        if (qubit >= 0 && qubit < circuitState.qubits && column >= 0) {
            if (window.draggedExistingGate) {
                // Moving an existing gate
                const gate = circuitState.gates.find(g => g.id === window.draggedExistingGate);
                if (gate) {
                    const gateDef = gateDefinitions[gate.gate];
                    const success = addGate(qubit, column, gate.gate, gateDef, window.draggedExistingGate);
                    if (!success) {
                        // If move failed, reset opacity and transform
                        const gateGroup = svg.querySelector(`[data-gate-id="${window.draggedExistingGate}"]`);
                        if (gateGroup) {
                            gateGroup.style.opacity = '1';
                            gateGroup.setAttribute('transform', '');
                            gateGroup.style.pointerEvents = 'auto';
                        }
                    }
                }
                window.draggedExistingGate = null;
            } else if (draggedGate) {
                // Adding a new gate from palette
                addGate(qubit, column, draggedGate.key, draggedGate.def);
            }
        } else {
            // Reset opacity and transform if drop was outside valid area
            if (window.draggedExistingGate) {
                const gateGroup = svg.querySelector(`[data-gate-id="${window.draggedExistingGate}"]`);
                if (gateGroup) {
                    gateGroup.style.opacity = '1';
                    gateGroup.setAttribute('transform', '');
                    gateGroup.style.pointerEvents = 'auto';
                }
                window.draggedExistingGate = null;
            }
        }
    });
    
    // Also allow clicking on grid positions to remove gates (but not when dragging)
    circuitBuilder.addEventListener('click', (e) => {
        // Don't remove if we're in the middle of a drag operation
        if (window.draggedExistingGate) {
            return;
        }
        
        // Check if click was on a gate element (if so, don't remove - let drag handle it)
        const target = e.target;
        if (target.closest && target.closest('[data-gate-id]')) {
            return;
        }
        
        // If no gate is being dragged, allow clicking to remove gates
        const rect = circuitBuilder.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const qubitHeight = 60;
        const columnWidth = 80;
        const qubit = Math.floor(y / qubitHeight);
        const column = Math.max(0, Math.floor((x - 100) / columnWidth));
        
        // Check if there's a gate at this position
        const gateAtPosition = circuitState.gates.find(
            g => g.qubit === qubit && g.column === column
        );
        
        if (gateAtPosition) {
            removeGate(gateAtPosition.id);
        }
    });
    
    // Initialize draggedExistingGate
    window.draggedExistingGate = null;
    window.dragOffsetX = 0;
    window.dragOffsetY = 0;
    window.dragGateX = 0;
    window.dragGateY = 0;
    
    // Global mousemove handler to update gate position during drag
    const globalMouseMoveHandler = (e) => {
        if (window.draggedExistingGate) {
            const svg = circuitBuilder.querySelector('svg');
            if (!svg) return;
            
            const gateGroup = svg.querySelector(`[data-gate-id="${window.draggedExistingGate}"]`);
            if (!gateGroup) return;
            
            // Convert mouse coordinates to SVG coordinates
            const point = svg.createSVGPoint();
            point.x = e.clientX;
            point.y = e.clientY;
            const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
            
            // Calculate new position relative to original
            const newX = svgPoint.x - window.dragOffsetX;
            const newY = svgPoint.y - window.dragOffsetY;
            
            // Apply transform to move gate
            gateGroup.setAttribute('transform', `translate(${newX - window.dragGateX}, ${newY - window.dragGateY})`);
        }
    };
    
    // Global mouseup handler to place the gate at new position
    const globalMouseUpHandler = (e) => {
        if (window.draggedExistingGate) {
            const svg = circuitBuilder.querySelector('svg');
            if (!svg) {
                window.draggedExistingGate = null;
                return;
            }
            
            const gateGroup = svg.querySelector(`[data-gate-id="${window.draggedExistingGate}"]`);
            if (!gateGroup) {
                window.draggedExistingGate = null;
                return;
            }
            
            // Calculate drop position based on mouse coordinates
            const point = svg.createSVGPoint();
            point.x = e.clientX;
            point.y = e.clientY;
            const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
            
            // Calculate which qubit and column
            const qubitHeight = 60;
            const columnWidth = 80;
            const qubit = Math.floor(svgPoint.y / qubitHeight);
            const column = Math.max(0, Math.floor((svgPoint.x - 100) / columnWidth)); // Account for qubit labels
            
            // Check if drop is within valid area
            if (qubit >= 0 && qubit < circuitState.qubits && column >= 0) {
                // Try to move the gate to new position
                const gate = circuitState.gates.find(g => g.id === window.draggedExistingGate);
                if (gate) {
                    const gateDef = gateDefinitions[gate.gate];
                    const success = addGate(qubit, column, gate.gate, gateDef, window.draggedExistingGate);
                    if (success) {
                        // Gate moved successfully - renderCircuit will update the display
                        // Reset transform and opacity will happen in renderCircuit
                    } else {
                        // Move failed - reset to original position
                        gateGroup.setAttribute('transform', '');
                        gateGroup.style.opacity = '1';
                        gateGroup.style.pointerEvents = 'auto';
                    }
                }
            } else {
                // Dropped outside valid area - reset to original position
                gateGroup.setAttribute('transform', '');
                gateGroup.style.opacity = '1';
                gateGroup.style.pointerEvents = 'auto';
            }
            
            window.draggedExistingGate = null;
        }
    };
    
    document.addEventListener('mousemove', globalMouseMoveHandler);
    document.addEventListener('mouseup', globalMouseUpHandler);
}

function isPositionOccupied(qubit, column, targetQubit = null, excludeGateId = null) {
    // Check if position is occupied by any gate (excluding the gate being moved)
    return circuitState.gates.some(g => {
        // Skip the gate we're moving
        if (excludeGateId && g.id === excludeGateId) {
            return false;
        }
        
        // Check based on gate definition
        const gateDef = gateDefinitions[g.gate];
        if (gateDef && gateDef.singleQubit) {
            // Single qubit gate - check exact position
            return g.qubit === qubit && g.column === column;
        } else {
            // Multi-qubit gate - check if it occupies either qubit at this column
            return (g.qubit === qubit || g.targetQubit === qubit || 
                   (targetQubit !== null && (g.qubit === targetQubit || g.targetQubit === targetQubit))) &&
                   g.column === column;
        }
    });
}

function addGate(qubit, column, gateKey, gateDef, existingGateId = null) {
    // Validate qubit index
    if (qubit < 0 || qubit >= circuitState.qubits) {
        return false;
    }
    
    // For multi-qubit gates, we need a target qubit
    let targetQubit = null;
    if (!gateDef.singleQubit) {
        // For now, use the next qubit as target (can be improved with UI)
        targetQubit = qubit + 1;
        if (targetQubit >= circuitState.qubits) {
            targetQubit = qubit - 1;
            if (targetQubit < 0) {
                alert('Need at least 2 qubits for multi-qubit gates');
                return false;
            }
        }
    }
    
    // Check if position is already occupied (unless we're moving an existing gate)
    if (existingGateId === null) {
        if (isPositionOccupied(qubit, column, targetQubit)) {
            alert('Position already occupied. Please choose a different position.');
            return false;
        }
    } else {
        // When moving, check if new position is occupied (excluding the gate being moved)
        if (isPositionOccupied(qubit, column, targetQubit, existingGateId)) {
            alert('Position already occupied. Please choose a different position.');
            return false;
        }
    }
    
    // Get parameter value if needed
    let params = {};
    if (existingGateId === null && gateDef.hasParam) {
        // New gate with parameter - prompt user
        const paramValue = prompt(`Enter value for ${gateDef.paramName} (e.g., π/2, pi/2, 1.57, or pi/4):`, 'π/2');
        if (paramValue === null || paramValue.trim() === '') return false; // User cancelled or empty
        params[gateDef.paramName] = paramValue.trim();
    } else if (existingGateId !== null) {
        // Moving existing gate - preserve parameters BEFORE removing the gate
        const oldGate = circuitState.gates.find(g => g.id === existingGateId);
        if (oldGate) {
            params = oldGate.params || {};
            // Also preserve targetQubit for multi-qubit gates
            if (!gateDef.singleQubit && oldGate.targetQubit !== null) {
                targetQubit = oldGate.targetQubit;
            }
        }
        // Now remove the old gate
        circuitState.gates = circuitState.gates.filter(g => g.id !== existingGateId);
    }
    
    // Generate unique ID for gate
    const gateId = existingGateId || `gate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const gate = {
        id: gateId,
        qubit,
        targetQubit,
        column,
        gate: gateKey,
        params
    };
    
    circuitState.gates.push(gate);
    renderCircuit();
    updateQASMCode();
    return true;
}

function removeGate(gateId) {
    circuitState.gates = circuitState.gates.filter(g => g.id !== gateId);
    renderCircuit();
    updateQASMCode();
}

function removeGateByPosition(qubit, column) {
    const gate = circuitState.gates.find(
        g => g.qubit === qubit && g.column === column
    );
    if (gate) {
        removeGate(gate.id);
    }
}

function renderCircuit() {
    if (!circuitBuilder) return;
    
    // Calculate number of columns needed
    const maxColumn = circuitState.gates.length > 0 
        ? Math.max(...circuitState.gates.map(g => g.column)) + 1 
        : 0;
    const numColumns = Math.max(maxColumn, 5); // Minimum 5 columns
    
    // Create SVG for circuit visualization
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', `${circuitState.qubits * 60}`);
    svg.setAttribute('viewBox', `0 0 ${numColumns * 80} ${circuitState.qubits * 60}`);
    svg.style.background = 'transparent';
    
    // Draw qubit lines
    for (let q = 0; q < circuitState.qubits; q++) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', (q * 60 + 30).toString());
        line.setAttribute('x2', (numColumns * 80).toString());
        line.setAttribute('y2', (q * 60 + 30).toString());
        line.setAttribute('stroke', '#4b5563');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
        
        // Qubit label
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', '-30');
        label.setAttribute('y', (q * 60 + 35).toString());
        label.setAttribute('fill', '#9ca3af');
        label.setAttribute('font-size', '12');
        label.setAttribute('font-family', 'monospace');
        label.textContent = `q[${q}]`;
        svg.appendChild(label);
    }
    
    // Draw gates
    circuitState.gates.forEach(gate => {
        const gateDef = gateDefinitions[gate.gate];
        const x = gate.column * 80 + 40;
        const y = gate.qubit * 60 + 30;
        
        // Create a group for the gate to make it draggable
        const gateGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gateGroup.setAttribute('data-gate-id', gate.id);
        gateGroup.style.cursor = 'move';
        
        if (gateDef.singleQubit) {
            // Draw single qubit gate
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', (x - 25).toString());
            rect.setAttribute('y', (y - 20).toString());
            rect.setAttribute('width', '50');
            rect.setAttribute('height', '40');
            rect.setAttribute('fill', gateDef.color);
            rect.setAttribute('stroke', '#ffffff');
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('rx', '4');
            gateGroup.appendChild(rect);
            
            // Gate label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x.toString());
            text.setAttribute('y', (y + 5).toString());
            text.setAttribute('fill', '#ffffff');
            text.setAttribute('font-size', gate.params && Object.keys(gate.params).length > 0 ? '12' : '14');
            text.setAttribute('font-family', 'monospace');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('text-anchor', 'middle');
            
            // Display parameter if present
            if (gate.params && Object.keys(gate.params).length > 0) {
                const paramValue = gate.params[Object.keys(gate.params)[0]];
                // Show shortened version for display
                let displayParam = paramValue.replace(/π/g, 'π').substring(0, 8);
                if (paramValue.length > 8) displayParam += '...';
                text.textContent = `${gateDef.name}(${displayParam})`;
            } else {
                text.textContent = gateDef.label;
            }
            gateGroup.appendChild(text);
        } else {
            // Draw multi-qubit gate (control-target)
            const controlY = gate.qubit * 60 + 30;
            const targetY = gate.targetQubit * 60 + 30;
            
            // Control dot
            const controlDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            controlDot.setAttribute('cx', x.toString());
            controlDot.setAttribute('cy', controlY.toString());
            controlDot.setAttribute('r', '5');
            controlDot.setAttribute('fill', gateDef.color);
            controlDot.setAttribute('stroke', '#ffffff');
            controlDot.setAttribute('stroke-width', '2');
            gateGroup.appendChild(controlDot);
            
            // Control line
            const controlLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            controlLine.setAttribute('x1', x.toString());
            controlLine.setAttribute('y1', controlY.toString());
            controlLine.setAttribute('x2', x.toString());
            controlLine.setAttribute('y2', targetY.toString());
            controlLine.setAttribute('stroke', gateDef.color);
            controlLine.setAttribute('stroke-width', '2');
            gateGroup.appendChild(controlLine);
            
            // Target gate
            const targetRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            targetRect.setAttribute('x', (x - 25).toString());
            targetRect.setAttribute('y', (targetY - 20).toString());
            targetRect.setAttribute('width', '50');
            targetRect.setAttribute('height', '40');
            targetRect.setAttribute('fill', gateDef.color);
            targetRect.setAttribute('stroke', '#ffffff');
            targetRect.setAttribute('stroke-width', '2');
            targetRect.setAttribute('rx', '4');
            gateGroup.appendChild(targetRect);
            
            // Target label
            const targetText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            targetText.setAttribute('x', x.toString());
            targetText.setAttribute('y', (targetY + 5).toString());
            targetText.setAttribute('fill', '#ffffff');
            targetText.setAttribute('font-size', '14');
            targetText.setAttribute('font-family', 'monospace');
            targetText.setAttribute('font-weight', 'bold');
            targetText.setAttribute('text-anchor', 'middle');
            targetText.textContent = gateDef.label;
            gateGroup.appendChild(targetText);
        }
        
        // Make gate draggable
        gateGroup.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            window.draggedExistingGate = gate.id;
            
            // Calculate offset from mouse to gate center in SVG coordinates
            const point = svg.createSVGPoint();
            point.x = e.clientX;
            point.y = e.clientY;
            const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
            
            window.dragOffsetX = svgPoint.x - x;
            window.dragOffsetY = svgPoint.y - y;
            window.dragGateX = x;
            window.dragGateY = y;
            
            // Make gate semi-transparent
            gateGroup.style.opacity = '0.5';
            gateGroup.style.pointerEvents = 'none';
        });
        
        svg.appendChild(gateGroup);
    });
    
    circuitBuilder.innerHTML = '';
    circuitBuilder.appendChild(svg);
}

function updateQASMCode() {
    if (!circuitBuilderMonacoEditor) return;
    
    // Generate QASM code from circuit state
    let code = 'OPENQASM 3;\n';
    code += 'include "stdgates.inc";\n';
    code += `qubit[${circuitState.qubits}] q;\n`;
    code += `bit[${circuitState.qubits}] c;\n\n`;
    
    // Sort gates by column, then by qubit
    const sortedGates = [...circuitState.gates].sort((a, b) => {
        if (a.column !== b.column) return a.column - b.column;
        return a.qubit - b.qubit;
    });
    
    // Group gates by column
    const gatesByColumn = {};
    sortedGates.forEach(gate => {
        if (!gatesByColumn[gate.column]) {
            gatesByColumn[gate.column] = [];
        }
        gatesByColumn[gate.column].push(gate);
    });
    
    // Generate code column by column
    Object.keys(gatesByColumn).sort((a, b) => parseInt(a) - parseInt(b)).forEach(column => {
        gatesByColumn[column].forEach(gate => {
            const gateDef = gateDefinitions[gate.gate];
            let gateLine = '';
            
            if (gateDef.singleQubit) {
                if (gate.params && Object.keys(gate.params).length > 0) {
                    const paramValue = gate.params[Object.keys(gate.params)[0]];
                    // Handle parameter formatting - convert π to pi, ensure proper spacing
                    let formattedParam = paramValue.replace(/π/g, 'pi').trim();
                    gateLine = `${gate.gate}(${formattedParam}) q[${gate.qubit}];`;
                } else {
                    gateLine = `${gate.gate} q[${gate.qubit}];`;
                }
            } else {
                // Multi-qubit gate
                if (gate.gate === 'swap') {
                    // SWAP gate syntax: swap q[0], q[1];
                    gateLine = `swap q[${gate.qubit}], q[${gate.targetQubit}];`;
                } else {
                    // Control gates: cx q[0], q[1];
                    gateLine = `${gate.gate} q[${gate.qubit}], q[${gate.targetQubit}];`;
                }
            }
            
            code += gateLine + '\n';
        });
    });
    
    // Add measurements at the end
    code += '\n';
    for (let i = 0; i < circuitState.qubits; i++) {
        code += `measure q[${i}] -> c[${i}];\n`;
    }
    
    // Update Monaco editor
    circuitBuilderMonacoEditor.setValue(code);
    
    // Also update global monacoEditor if it exists (for app.js compatibility)
    if (typeof window.monacoEditor !== 'undefined' && window.monacoEditor) {
        window.monacoEditor.setValue(code);
    }
}

function initializeMonacoEditor() {
    if (typeof require === 'undefined') {
        console.error('Monaco Editor loader not found');
        return;
    }
    
    const codeEditorContainer = document.getElementById('codeEditor');
    if (!codeEditorContainer) return;
    
    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
    
    require(['vs/editor/editor.main'], function () {
        // Register OpenQASM 3 language (reuse from app.js if available)
        if (!monaco.languages.getLanguages().find(l => l.id === 'openqasm3')) {
            monaco.languages.register({ id: 'openqasm3' });
            
            // Set up basic tokenizer if not already set up by app.js
            // (app.js should have already set this up, but just in case)
            try {
                monaco.languages.setMonarchTokensProvider('openqasm3', {
                    tokenizer: {
                        root: [
                            [/\/\/.*$/, 'comment'],
                            [/\/\*[\s\S]*?\*\//, 'comment'],
                            [/\b(include|if|else|for|while|break|continue|return)\b/, 'controlflow'],
                            [/\b(h|x|y|z|s|cx|cy|cz|ch|swap|ccx|cswap|u|p|rx|ry|rz|r|crx|cry|crz|cu|cp|phase|cphase|id|tdg|sdg)\b/, 'function-like'],
                            [/\b(measure|reset)\b/, 'function-like-2'],
                            [/\b(qubit|bit|let|gate|box|const|input|float)\b/, 'keyword'],
                            [/[+\-*/=<>!&|]+/, 'operator'],
                            [/[(),;\[\]{}]/, 'delimiter'],
                            [/\d+\.?\d*/, 'number'],
                            [/["'][^"']*["']/, 'string'],
                            [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],
                            [/\s+/, 'white']
                        ]
                    }
                });
            } catch (e) {
                // Already registered by app.js, ignore
            }
        }
        
        // Get current theme
        const currentTheme = localStorage.getItem('theme') || 'dark';
        const isDark = currentTheme === 'dark';
        
        // Define theme if not already defined
        try {
            monaco.editor.defineTheme('openqasm-theme', {
                base: isDark ? 'vs-dark' : 'vs',
                inherit: true,
                rules: [
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
                    { token: 'identifier', foreground: isDark ? '#D4D4D4' : '#000000' }
                ],
                colors: {
                    'editor.background': isDark ? '#000000' : '#FFFFFF',
                    'editor.foreground': isDark ? '#FFFFFF' : '#000000'
                }
            });
        } catch (e) {
            // Theme already defined, ignore
        }
        
        // Create editor instance (read-only)
        circuitBuilderMonacoEditor = monaco.editor.create(codeEditorContainer, {
            value: 'OPENQASM 3;\n',
            language: 'openqasm3',
            theme: 'openqasm-theme',
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            readOnly: true, // Make it non-editable
            renderWhitespace: 'selection',
            tabSize: 4,
            insertSpaces: true
        });
        
        // Make it accessible globally for app.js functions
        window.monacoEditor = circuitBuilderMonacoEditor;
        
        // Update initial code
        updateQASMCode();
    });
}

function setupEventListeners() {
    // Add qubit button - adds exactly one qubit
    const addQubitBtn = document.getElementById('addQubitBtn');
    if (addQubitBtn) {
        // Remove any existing listeners by cloning the button
        const newAddBtn = addQubitBtn.cloneNode(true);
        addQubitBtn.parentNode.replaceChild(newAddBtn, addQubitBtn);
        
        newAddBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            circuitState.qubits = circuitState.qubits + 1; // Add exactly one qubit
            renderCircuit();
            updateQASMCode();
        });
    }
    
    // Remove qubit button - removes exactly one qubit
    const removeQubitBtn = document.getElementById('removeQubitBtn');
    if (removeQubitBtn) {
        // Remove any existing listeners by cloning the button
        const newRemoveBtn = removeQubitBtn.cloneNode(true);
        removeQubitBtn.parentNode.replaceChild(newRemoveBtn, removeQubitBtn);
        
        newRemoveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (circuitState.qubits > 1) {
                circuitState.qubits = circuitState.qubits - 1; // Remove exactly one qubit
                // Remove gates on removed qubit
                circuitState.gates = circuitState.gates.filter(g => 
                    g.qubit < circuitState.qubits && 
                    (g.targetQubit === null || g.targetQubit < circuitState.qubits)
                );
                renderCircuit();
                updateQASMCode();
            }
        });
    }
    
    // Clear circuit button
    const clearCircuitBtn = document.getElementById('clearCircuitBtn');
    if (clearCircuitBtn) {
        clearCircuitBtn.addEventListener('click', () => {
            if (confirm('Clear the entire circuit?')) {
                circuitState.gates = [];
                renderCircuit();
                updateQASMCode();
            }
        });
    }
    
    // Custom run simulation function for circuit builder
    async function runCircuitSimulation() {
        const code = circuitBuilderMonacoEditor ? circuitBuilderMonacoEditor.getValue().trim() : '';
        const shotsInput = document.getElementById('shotsInput');
        const shots = shotsInput ? parseInt(shotsInput.value) || 1024 : 1024;
        
        const runBtn = document.getElementById('runBtn');
        const statusIndicator = document.getElementById('statusIndicator');
        const errorDisplay = document.getElementById('errorDisplay');
        const errorMessage = document.getElementById('errorMessage');
        const resultsDisplay = document.getElementById('resultsDisplay');
        const emptyState = document.getElementById('emptyState');
        
        if (!code) {
            if (errorDisplay && errorMessage) {
                errorMessage.textContent = 'Please enter some OpenQASM 3 code';
                errorDisplay.classList.remove('hidden');
            }
            return;
        }
        
        // Update UI
        if (runBtn) {
            runBtn.disabled = true;
            const originalHTML = runBtn.innerHTML;
            runBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
        }
        if (statusIndicator) statusIndicator.textContent = 'Compiling...';
        if (errorDisplay) errorDisplay.classList.add('hidden');
        if (resultsDisplay) resultsDisplay.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        
        try {
            const response = await fetch('/compile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code: code,
                    shots: shots
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Use displayResults from app.js if available, otherwise use our own
                if (typeof displayResults === 'function') {
                    displayResults(data);
                } else {
                    displayCircuitResults(data);
                }
            } else {
                if (errorDisplay && errorMessage) {
                    errorMessage.textContent = data.error || 'Unknown error occurred';
                    errorDisplay.classList.remove('hidden');
                    if (emptyState) emptyState.classList.add('hidden');
                }
            }
        } catch (error) {
            if (errorDisplay && errorMessage) {
                errorMessage.textContent = `Network error: ${error.message}`;
                errorDisplay.classList.remove('hidden');
                if (emptyState) emptyState.classList.add('hidden');
            }
        } finally {
            if (runBtn) {
                runBtn.disabled = false;
                const currentTheme = localStorage.getItem('theme') || 'dark';
                const isDark = currentTheme === 'dark';
                const strokeColor = isDark ? '#ffffff' : '#000000';
                runBtn.innerHTML = `<svg id="runBtnIcon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`;
            }
            if (statusIndicator) statusIndicator.textContent = 'Ready';
        }
    }
    
    // Custom display results function for circuit builder
    function displayCircuitResults(data) {
        const { counts, qubits, shots } = data;
        const qubitsInfo = document.getElementById('qubitsInfo');
        const shotsInfo = document.getElementById('shotsInfo');
        const resultsDisplay = document.getElementById('resultsDisplay');
        const emptyState = document.getElementById('emptyState');
        const histogramCanvas = document.getElementById('histogramCanvas');
        const countsTableBody = document.getElementById('countsTableBody');
        
        // Update info
        if (qubitsInfo) qubitsInfo.textContent = `${qubits} qubit${qubits !== 1 ? 's' : ''}`;
        if (shotsInfo) shotsInfo.textContent = `${shots} shots`;
        
        // Show results
        if (resultsDisplay) resultsDisplay.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
        
        // Draw histogram if function exists
        if (typeof drawHistogram === 'function' && histogramCanvas) {
            setTimeout(() => {
                drawHistogram(counts);
            }, 10);
        }
        
        // Populate table
        if (countsTableBody) {
            countsTableBody.innerHTML = '';
            
            const states = Object.keys(counts).sort();
            
            states.forEach(state => {
                const count = counts[state];
                const probability = ((count / shots) * 100).toFixed(2);
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
    }
    
    // Run button
    const runBtn = document.getElementById('runBtn');
    if (runBtn) {
        // Remove any existing listeners
        const newRunBtn = runBtn.cloneNode(true);
        runBtn.parentNode.replaceChild(newRunBtn, runBtn);
        
        newRunBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            runCircuitSimulation();
        });
    }
    
    // Save button - reuse from app.js if available
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        // Remove any existing listeners
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        newSaveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Use circuit builder's editor for save
            if (typeof saveFile === 'function') {
                // Temporarily set monacoEditor to circuit builder's editor
                const originalMonaco = window.monacoEditor;
                window.monacoEditor = circuitBuilderMonacoEditor;
                try {
                    saveFile();
                } finally {
                    window.monacoEditor = originalMonaco;
                }
            } else {
                // Fallback: custom save function
                const code = circuitBuilderMonacoEditor ? circuitBuilderMonacoEditor.getValue().trim() : '';
                if (!code) {
                    alert('Please enter some OpenQASM 3 code to save');
                    return;
                }
                
                const filename = prompt('Enter a filename for your circuit (without .qasm extension):');
                if (!filename || !filename.trim()) {
                    return;
                }
                
                fetch('/save-file', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        filename: filename.trim(),
                        code: code
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert(data.message || 'File saved successfully!');
                    } else {
                        alert(`Error saving file: ${data.error || 'Unknown error'}`);
                    }
                })
                .catch(error => {
                    alert(`Error saving file: ${error.message}`);
                });
            }
        });
    }
    
    // Handle resize handles (reuse from app.js if available)
    // The resize handles should work automatically if app.js is loaded
    // But we can add a check to ensure they're set up
    setTimeout(() => {
        const horizontalResizeHandle = document.getElementById('horizontalResizeHandle');
        const editorSection = document.getElementById('editorSection');
        const circuitBuilderSection = document.getElementById('circuitBuilderSection');
        const codeEditorSection = document.getElementById('codeEditorSection');
        
        if (horizontalResizeHandle && editorSection && circuitBuilderSection && codeEditorSection) {
            // Setup resize if not already done by app.js
            if (!horizontalResizeHandle.hasAttribute('data-resize-setup')) {
                setupHorizontalResize(horizontalResizeHandle, circuitBuilderSection, codeEditorSection, editorSection);
                horizontalResizeHandle.setAttribute('data-resize-setup', 'true');
            }
        }
    }, 500);
}

function setupHorizontalResize(handle, leftSection, rightSection, container) {
    let isResizing = false;
    
    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const handleWidth = handle.offsetWidth;
        const availableWidth = containerWidth - handleWidth;
        
        const newLeftWidth = e.clientX - containerRect.left;
        const newRightWidth = containerWidth - newLeftWidth - handleWidth;
        
        const minWidth = 200;
        
        if (newLeftWidth >= minWidth && newRightWidth >= minWidth && availableWidth > 0) {
            const leftPercent = (newLeftWidth / availableWidth) * 100;
            const rightPercent = (newRightWidth / availableWidth) * 100;
            
            leftSection.style.width = `${leftPercent}%`;
            rightSection.style.width = `${rightPercent}%`;
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Save to localStorage
            localStorage.setItem('circuitBuilderWidth', leftSection.style.width);
            localStorage.setItem('codeEditorWidth', rightSection.style.width);
        }
    });
}
