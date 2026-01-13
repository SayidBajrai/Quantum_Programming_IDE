/**
 * OpenQASM 3 Compiler & Simulator - Frontend JavaScript
 */

// DOM Elements
const codeEditor = document.getElementById('codeEditor');
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
const resizeHandle = document.getElementById('resizeHandle');
const editorSection = document.getElementById('editorSection');
const outputSection = document.getElementById('outputSection');
const savedToggle = document.getElementById('savedToggle');
const savedExamples = document.getElementById('savedExamples');

// Load saved examples from files
async function loadSavedExample(exampleName) {
    try {
        // Handle both filename with and without extension
        let filename = exampleName;
        if (!filename.endsWith('.qasm') && !filename.endsWith('.qasm3')) {
            filename = `${exampleName}.qasm`;
        }
        const response = await fetch(`/static/Saved/${filename}`);
        if (!response.ok) {
            throw new Error(`Failed to load ${filename}`);
        }
        return await response.text();
    } catch (error) {
        console.error(`Error loading ${exampleName}:`, error);
        return '';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeThemeIcon();
    loadTheme();
    loadSidebarState();
    loadResizeState();
    loadSavedState();
    setupEventListeners();
    // Initial circuit diagram update
    if (circuitDiagram) {
        setTimeout(() => updateCircuitDiagram(), 100);
    }
});

function loadResizeState() {
    if (editorSection && outputSection) {
        const savedEditorHeight = localStorage.getItem('editorHeight');
        const savedOutputHeight = localStorage.getItem('outputHeight');
        
        if (savedEditorHeight && savedOutputHeight) {
            editorSection.style.height = savedEditorHeight;
            outputSection.style.height = savedOutputHeight;
        }
    }
}

function loadSavedState() {
    if (savedExamples) {
        const isCollapsed = localStorage.getItem('savedCollapsed') === 'true';
        const toggleIcon = document.getElementById('savedToggleIcon');
        
        if (isCollapsed) {
            savedExamples.classList.add('hidden');
            if (toggleIcon) {
                // Collapsed: arrow down
                toggleIcon.setAttribute('d', 'M19 9l-7 7-7-7');
            }
        } else {
            savedExamples.classList.remove('hidden');
            // Load saved files when expanded
            loadSavedFiles();
            if (toggleIcon) {
                // Expanded: arrow up
                toggleIcon.setAttribute('d', 'M5 15l7-7 7 7');
            }
        }
    }
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
                nameSpan.textContent = file.name;
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
                    if (code) {
                        codeEditor.value = code;
                        updateCircuitDiagram();
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
    const currentName = nameElement.textContent.trim();
    const newName = prompt('Enter new filename (without .qasm extension):', currentName);
    
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
            // Reload the saved files list
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
            // Reload the saved files list
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
    runBtn.addEventListener('click', runSimulation);
    if (saveBtn) {
        saveBtn.addEventListener('click', saveFile);
    }
    themeToggle.addEventListener('click', toggleTheme);
    
    // Sidebar toggle
    if (sidebarToggleDesktop) {
        sidebarToggleDesktop.addEventListener('click', toggleSidebar);
    }
    if (sidebarToggleMobile) {
        sidebarToggleMobile.addEventListener('click', toggleSidebar);
    }
    
    // Saved section toggle
    if (savedToggle && savedExamples) {
        savedToggle.addEventListener('click', () => {
            const isCollapsed = savedExamples.classList.contains('hidden');
            const toggleIcon = document.getElementById('savedToggleIcon');
            
            if (isCollapsed) {
                // Expanding: show arrow up, load files
                savedExamples.classList.remove('hidden');
                localStorage.setItem('savedCollapsed', 'false');
                loadSavedFiles(); // Refresh files when expanding
                if (toggleIcon) {
                    // Expanded: arrow up
                    toggleIcon.setAttribute('d', 'M5 15l7-7 7 7');
                }
            } else {
                // Collapsing: show arrow down
                savedExamples.classList.add('hidden');
                localStorage.setItem('savedCollapsed', 'true');
                if (toggleIcon) {
                    // Collapsed: arrow down
                    toggleIcon.setAttribute('d', 'M19 9l-7 7-7-7');
                }
            }
        });
    }
    
    // Keyboard shortcut: Ctrl+Enter to run
    codeEditor.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            runSimulation();
        }
    });
    
    // Real-time circuit diagram updates (debounced)
    let circuitUpdateTimeout;
    codeEditor.addEventListener('input', () => {
        clearTimeout(circuitUpdateTimeout);
        circuitUpdateTimeout = setTimeout(() => {
            updateCircuitDiagram();
        }, 500); // 500ms debounce
    });
    
    // Drag and drop support for .qasm files
    codeEditor.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        codeEditor.classList.add('border-green-500');
    });
    
    codeEditor.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        codeEditor.classList.remove('border-green-500');
    });
    
    codeEditor.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        codeEditor.classList.remove('border-green-500');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.qasm') || file.name.endsWith('.qasm3')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    codeEditor.value = event.target.result;
                    updateCircuitDiagram();
                };
                reader.readAsText(file);
            } else {
                alert('Please drop a .qasm or .qasm3 file');
            }
        }
    });
    
    // Resize handle functionality
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
            
            const deltaY = e.clientY - startY;
            const container = editorSection.parentElement;
            const containerHeight = container.offsetHeight;
            const resizeHandleHeight = resizeHandle.offsetHeight;
            
            const newEditorHeight = startEditorHeight + deltaY;
            const newOutputHeight = startOutputHeight - deltaY;
            
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
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                // Save heights to localStorage
                localStorage.setItem('editorHeight', editorSection.style.height);
                localStorage.setItem('outputHeight', outputSection.style.height);
            }
        });
    }
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
    const code = codeEditor.value.trim();
    
    if (!code) {
        alert('Please enter some OpenQASM 3 code to save');
        return;
    }
    
    // Prompt for filename
    const filename = prompt('Enter a filename for your circuit (without .qasm extension):');
    
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
            const overwrite = confirm(`File "${finalFilename}.qasm" already exists. Do you want to overwrite it?`);
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
                code: code
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message || 'File saved successfully!');
            // Refresh the saved files list if the sidebar is expanded
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
    const code = codeEditor.value.trim();
    const shots = parseInt(shotsInput.value) || 1024;
    
    if (!code) {
        showError('Please enter some OpenQASM 3 code');
        return;
    }
    
    // Update UI
    runBtn.disabled = true;
    runBtn.textContent = 'Running...';
    statusIndicator.textContent = 'Compiling...';
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
                shots: shots
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
        runBtn.disabled = false;
        runBtn.innerHTML = `<svg id="runBtnIcon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${themeConfig[localStorage.getItem('theme') || 'dark'].btnIcon.stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`;
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
        
        const row = document.createElement('tr');
        row.className = 'border-t border-gray-700';
        row.innerHTML = `
            <td class="px-4 py-2 font-mono">${state}</td>
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
}

function hideError() {
    errorDisplay.classList.add('hidden');
}

function showResults() {
    resultsDisplay.classList.remove('hidden');
    emptyState.classList.add('hidden');
    errorDisplay.classList.add('hidden');
}

function hideResults() {
    resultsDisplay.classList.add('hidden');
    emptyState.classList.remove('hidden');
}

async function updateCircuitDiagram() {
    if (!circuitDiagram || !circuitStatus) return;
    
    const code = codeEditor.value.trim();
    
    // Get current theme for text colors
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const isDark = currentTheme === 'dark';
    const textColor = isDark ? 'text-gray-500' : 'text-gray-600';
    const codeTextColor = isDark ? 'text-green-400' : 'text-green-700';
    
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
        const response = await fetch('/circuit-diagram', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.svg) {
                // Display SVG diagram
                circuitDiagram.innerHTML = data.svg;
                circuitStatus.textContent = 'Valid';
                
                // Style the SVG for theme
                const svg = circuitDiagram.querySelector('svg');
                if (svg) {
                    svg.style.maxWidth = '100%';
                    svg.style.height = 'auto';
                    // Make text readable based on theme
                    const textElements = svg.querySelectorAll('text');
                    textElements.forEach(text => {
                        if (text.getAttribute('fill') !== 'none') {
                            text.setAttribute('fill', isDark ? '#10b981' : '#059669');
                        }
                    });
                }
            } else if (data.text) {
                // Display text diagram as fallback (use theme-aware text color)
                circuitDiagram.innerHTML = `
                    <pre class="${codeTextColor} font-mono text-xs whitespace-pre overflow-x">${escapeHtml(data.text)}</pre>
                `;
                circuitStatus.textContent = 'Valid (text)';
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

// Theme management
const themeConfig = {
    dark: {
        body: { bg: 'bg-[#0f0f0f]', text: 'text-gray-100' },
        topBar: { bg: 'bg-[#1a1a1a]', border: 'border-gray-800' },
        sidebar: { bg: 'bg-[#1a1a1a]', border: 'border-gray-800', text: 'text-gray-300' },
        mainContent: { bg: 'bg-transparent' },
        codeEditor: { bg: 'bg-black', text: 'text-green-400', border: 'border-gray-800' },
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
        codeEditor: { bg: 'bg-white', text: 'text-green-700', border: 'border-gray-300' },
        outputPanel: { bg: 'bg-gray-50', border: 'border-gray-300' },
        button: { primary: 'bg-green-500 hover:bg-green-600', secondary: 'bg-gray-200 hover:bg-gray-300' },
        input: { bg: 'bg-white', border: 'border-gray-300', text: 'text-gray-900' },
        table: { bg: 'bg-white', text: 'text-gray-700', border: 'border-gray-300' },
        canvas: { bg: '#f9fafb' },
        btnIcon: { stroke: '#000000' },
    }
};

function applyTheme(theme) {
    const config = themeConfig[theme];
    const isDark = theme === 'dark';
    
    // Update body
    document.body.className = `${config.body.bg} ${config.body.text} min-h-screen`;
    document.body.setAttribute('data-theme', theme);
    
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
                // Active nav button
                btn.className = btn.className.replace(/bg-gray-800|bg-gray-200/g, isDark ? 'bg-gray-800' : 'bg-gray-200');
                btn.className = btn.className.replace(/text-green-400/g, 'text-green-400'); // Keep green for active
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
        
        // Update saved toggle button
        const savedToggleBtn = document.getElementById('savedToggle');
        if (savedToggleBtn) {
            savedToggleBtn.className = savedToggleBtn.className.replace(/hover:bg-gray-800|hover:bg-gray-200/g, isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200');
        }
    }
    
    // Update code editor container
    const editorContainer = codeEditor?.parentElement;
    if (editorContainer) {
        editorContainer.className = editorContainer.className.replace(/bg-black|bg-white/g, config.codeEditor.bg);
        editorContainer.className = editorContainer.className.replace(/border-gray-800|border-gray-300/g, config.codeEditor.border);
    }
    
    // Update code editor
    if (codeEditor) {
        codeEditor.className = codeEditor.className.replace(/bg-black|bg-white/g, config.codeEditor.bg);
        codeEditor.className = codeEditor.className.replace(/text-green-400|text-green-700/g, config.codeEditor.text);
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
            el.className = el.className.replace(/text-green-400|text-green-700/g, config.codeEditor.text);
        });
    }
    
    // Update output panel
    const outputPanel = document.getElementById('outputSection');
    if (outputPanel) {
        outputPanel.className = outputPanel.className.replace(/bg-\[#1a1a1a\]|bg-gray-50/g, config.outputPanel.bg);
        outputPanel.className = outputPanel.className.replace(/border-gray-800|border-gray-300/g, config.outputPanel.border);
    }
    
    // Update resize handle
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
    
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.className = themeBtn.className.replace(/bg-gray-700|bg-gray-200/g, isDark ? 'bg-gray-700' : 'bg-gray-200');
        themeBtn.className = themeBtn.className.replace(/hover:bg-gray-600|hover:bg-gray-300/g, isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-300');
        themeBtn.className = themeBtn.className.replace(/text-gray-\d+/g, isDark ? 'text-gray-100' : 'text-gray-900');
    }
    
    // Update inputs
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.className = input.className.replace(/bg-gray-800|bg-white/g, config.input.bg);
        input.className = input.className.replace(/border-gray-700|border-gray-300/g, config.input.border);
        input.className = input.className.replace(/text-gray-100|text-gray-900/g, config.input.text);
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
            const count = parseInt(row.querySelector('td:nth-child(2)')?.textContent);
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
