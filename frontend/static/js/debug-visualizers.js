/**
 * Debug output visualizers for Quanta Print formats (:prob, :summary, :circuit, etc.)
 * Extends bloch-sphere.js with unified block rendering from structured API blocks.
 */
(function () {
    const KIND_STYLES = {
        bloch: 'decoration-emerald-700/50 hover:bg-emerald-950/50',
        prob: 'decoration-sky-700/50 hover:bg-sky-950/50',
        summary: 'decoration-violet-700/50 hover:bg-violet-950/50',
        circuit: 'decoration-amber-700/50 hover:bg-amber-950/50',
        density: 'decoration-rose-700/50 hover:bg-rose-950/50',
        amplitudes: 'decoration-cyan-700/50 hover:bg-cyan-950/50',
        symbolic: 'decoration-lime-700/50 hover:bg-lime-950/50',
        fidelity: 'decoration-yellow-700/50 hover:bg-yellow-950/50',
    };

    function clampPos(el, left, top) {
        const pad = 8;
        const w = el.offsetWidth || 280;
        const h = el.offsetHeight || 200;
        let x = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
        let y = Math.max(pad, Math.min(top, window.innerHeight - h - pad));
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
    }

    function renderProbHtml(data) {
        const entries = data.entries || [];
        const max = Math.max(...entries.map(e => e.pct), 1);
        return entries.map(e => {
            const w = Math.round((e.pct / max) * 100);
            return `<div class="flex items-center gap-2 text-xs font-mono mb-1">
                <span class="w-16 truncate">${e.ket}</span>
                <div class="flex-1 bg-gray-800 rounded h-3"><div class="bg-sky-500 h-3 rounded" style="width:${w}%"></div></div>
                <span class="w-10 text-right">${e.pct}%</span></div>`;
        }).join('');
    }

    function renderAmplitudesHtml(data) {
        return (data.entries || []).map(e =>
            `<div class="text-xs font-mono">${e.ket} : ${e.mag}</div>`
        ).join('');
    }

    function renderSummaryHtml(data) {
        return `<pre class="text-xs font-mono whitespace-pre-wrap text-gray-300 max-h-64 overflow-auto">${(data.text || '').replace(/</g, '&lt;')}</pre>`;
    }

    function renderCircuitHtml(data) {
        const trace = (data.trace || []).map(l =>
            `<div class="text-xs font-mono text-gray-300">${l.replace(/</g, '&lt;')}</div>`
        ).join('');
        const stats = `<div class="text-[10px] text-gray-500 mt-2">Gates: ${data.total_gates ?? '?'} · Depth: ${data.depth ?? '?'} · Qubits: ${data.qubits ?? '?'}</div>`;
        return trace + stats;
    }

    function parseDensityValue(cell) {
        const s = String(cell).trim();
        const m = s.match(/^([\d.]+)/);
        return m ? parseFloat(m[1]) : 0;
    }

    function renderDensityHeatmap(rows) {
        const n = rows.length;
        if (!n) return '<div class="text-xs text-gray-500">Empty matrix</div>';
        const vals = rows.flat().map(parseDensityValue);
        const max = Math.max(...vals, 1e-9);
        const cell = 18;
        const pad = 2;
        const w = n * (cell + pad) + pad;
        const h = n * (cell + pad) + pad;
        let rects = '';
        rows.forEach((row, i) => {
            row.forEach((c, j) => {
                const v = parseDensityValue(c) / max;
                const hue = 200 - Math.round(v * 200);
                const x = pad + j * (cell + pad);
                const y = pad + i * (cell + pad);
                rects += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="hsl(${hue},70%,${30 + v * 40}%)" stroke="#374151" stroke-width="0.5"/>`;
            });
        });
        return `<svg width="${w}" height="${h}" class="density-heatmap">${rects}</svg>
            <pre class="text-[10px] font-mono text-gray-500 mt-2 leading-tight">${rows.map(r => `[${r.join(', ')}]`).join('\n')}</pre>`;
    }

    function renderDensityHtml(data) {
        const rows = data.rows || [];
        return renderDensityHeatmap(rows);
    }

    function renderSymbolicHtml(data) {
        return `<div class="text-sm font-mono text-lime-300">${(data.expression || '').replace(/</g, '&lt;')}</div>
            <button type="button" class="copy-sym mt-2 text-xs text-gray-400 hover:text-white">Copy</button>`;
    }

    function renderBlockHtml(kind, data) {
        switch (kind) {
            case 'prob': return renderProbHtml(data);
            case 'amplitudes': return renderAmplitudesHtml(data);
            case 'summary': return renderSummaryHtml(data);
            case 'circuit': return renderCircuitHtml(data);
            case 'density': return renderDensityHtml(data);
            case 'symbolic': return renderSymbolicHtml(data);
            case 'fidelity': return `<div class="text-lg font-mono text-yellow-300">Fidelity: ${data.value}</div>`;
            default: return '<div class="text-xs text-gray-400">No preview</div>';
        }
    }

    window.setupDebugVisualizers = function setupDebugVisualizers(debugOutputEl, blochHandlers) {
        if (!debugOutputEl) return;

        let hintEl = document.getElementById('debugHint');
        let warningEl = document.getElementById('debugWarning');
        const hoverEl = document.createElement('div');
        hoverEl.id = 'debugHoverPopover';
        hoverEl.className = 'hidden fixed z-40 bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl p-3 max-w-sm pointer-events-none';
        document.body.appendChild(hoverEl);

        const pinnedByKey = new Map();
        let pinCounter = 0;

        function hideHover() {
            hoverEl.classList.add('hidden');
        }

        function showHover(kind, data, title, rect) {
            if (kind === 'bloch' && blochHandlers?.showHover) {
                blochHandlers.showHover(data, rect);
                return;
            }
            hoverEl.innerHTML = `<div class="text-xs text-emerald-400 mb-2 font-medium truncate">${title}</div>${renderBlockHtml(kind, data)}`;
            hoverEl.classList.remove('hidden');
            clampPos(hoverEl, rect.right + 8, rect.top);
        }

        function createPinnedPanel(title, bodyHtml, key) {
            if (pinnedByKey.has(key)) {
                const existing = pinnedByKey.get(key);
                existing.el.style.zIndex = String(60 + pinnedByKey.size);
                return;
            }
            const el = document.createElement('div');
            el.className = 'debug-pinned-panel fixed z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden select-none max-w-md';
            el.innerHTML = `
                <div class="debug-panel-header flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-950 cursor-move">
                    <span class="text-sm font-medium text-emerald-400 truncate max-w-[240px]">${title}</span>
                    <button type="button" class="debug-panel-close text-gray-400 hover:text-white text-lg leading-none">&times;</button>
                </div>
                <div class="p-3 max-h-80 overflow-auto">${bodyHtml}</div>`;
            document.body.appendChild(el);
            const offset = pinCounter++ * 24;
            clampPos(el, window.innerWidth / 2 - 180 + offset, window.innerHeight / 2 - 160 + offset);
            const panel = { el, key };
            pinnedByKey.set(key, panel);
            el.querySelector('.debug-panel-close').addEventListener('click', () => {
                pinnedByKey.delete(key);
                el.remove();
            });
            const header = el.querySelector('.debug-panel-header');
            let dragging = false, ox = 0, oy = 0;
            header.addEventListener('mousedown', (e) => {
                if (e.target.closest('.debug-panel-close')) return;
                dragging = true;
                const r = el.getBoundingClientRect();
                ox = e.clientX - r.left;
                oy = e.clientY - r.top;
            });
            window.addEventListener('mousemove', (e) => {
                if (!dragging) return;
                clampPos(el, e.clientX - ox, e.clientY - oy);
            });
            window.addEventListener('mouseup', () => { dragging = false; });
            el.addEventListener('click', (e) => {
                const btn = e.target.closest('.copy-sym');
                if (btn) {
                    const sym = el.querySelector('.text-lime-300');
                    if (sym) navigator.clipboard.writeText(sym.textContent);
                }
            });
        }

        function pinBlock(kind, data, title, index) {
            hideHover();
            if (kind === 'bloch' && blochHandlers?.pinBlock) {
                blochHandlers.pinBlock({
                    x: data.x, y: data.y, z: data.z,
                    theta: data.theta, phi: data.phi,
                    title, index,
                });
                return;
            }
            createPinnedPanel(title, renderBlockHtml(kind, data), `${kind}-${index}`);
        }

        function closeAllPinned() {
            pinnedByKey.forEach(p => p.el.remove());
            pinnedByKey.clear();
            if (blochHandlers?.closeAll) blochHandlers.closeAll();
            pinCounter = 0;
        }

        debugOutputEl.addEventListener('mouseover', (e) => {
            const span = e.target.closest('.debug-block');
            if (!span) return;
            const kind = span.dataset.kind;
            const data = JSON.parse(span.dataset.payload || '{}');
            showHover(kind, data, span.dataset.title || kind, span.getBoundingClientRect());
        });

        debugOutputEl.addEventListener('mouseout', (e) => {
            if (!e.target.closest('.debug-block')) return;
            hideHover();
            if (blochHandlers?.hideHover) blochHandlers.hideHover();
        });

        debugOutputEl.addEventListener('click', (e) => {
            const span = e.target.closest('.debug-block');
            if (!span) return;
            e.preventDefault();
            e.stopPropagation();
            pinBlock(span.dataset.kind, JSON.parse(span.dataset.payload || '{}'), span.dataset.title, span.dataset.blockIndex);
        });

        (debugOutputEl.closest('.overflow-auto') || debugOutputEl)
            .addEventListener('scroll', () => { hideHover(); if (blochHandlers?.hideHover) blochHandlers.hideHover(); }, { passive: true });

        window.updateDebugOutput = function updateDebugOutput(payload) {
            closeAllPinned();
            hideHover();

            const output = typeof payload === 'string' ? payload : (payload.output || '');
            const blocks = typeof payload === 'object' && payload.blocks ? payload.blocks : [];
            const warnings = typeof payload === 'object' && payload.warnings ? payload.warnings : [];

            debugOutputEl.textContent = '';
            if (!blocks.length) {
                debugOutputEl.textContent = output;
            } else {
                let last = 0;
                blocks.forEach((block, index) => {
                    if (block.start > last) {
                        debugOutputEl.appendChild(document.createTextNode(output.slice(last, block.start)));
                    }
                    const span = document.createElement('span');
                    const kind = block.kind || 'symbolic';
                    const style = KIND_STYLES[kind] || KIND_STYLES.symbolic;
                    span.className = `debug-block underline decoration-dotted underline-offset-2 cursor-pointer rounded-sm ${style}`;
                    span.dataset.kind = kind;
                    span.dataset.blockIndex = String(index);
                    span.dataset.title = block.title || kind;
                    span.dataset.payload = JSON.stringify(block.data || {});
                    if (kind === 'bloch' && block.data) {
                        Object.assign(span.dataset, {
                            x: block.data.x, y: block.data.y, z: block.data.z,
                            theta: block.data.theta, phi: block.data.phi,
                        });
                    }
                    span.title = `${block.title} — hover preview, click to pin`;
                    span.textContent = output.slice(block.start, block.end);
                    debugOutputEl.appendChild(span);
                    last = block.end;
                });
                if (last < output.length) {
                    debugOutputEl.appendChild(document.createTextNode(output.slice(last)));
                }
            }

            if (!hintEl) {
                hintEl = document.createElement('p');
                hintEl.id = 'debugHint';
                hintEl.className = 'text-[11px] text-emerald-700/80 mt-1 shrink-0 hidden';
                debugOutputEl.parentElement.parentElement.insertBefore(hintEl, debugOutputEl.parentElement);
            }
            if (blocks.length) {
                const kinds = [...new Set(blocks.map(b => b.kind))].join(', ');
                hintEl.textContent = `${blocks.length} linked block(s) [${kinds}] — hover preview, click pin (× close)`;
                hintEl.classList.remove('hidden');
            } else {
                hintEl.classList.add('hidden');
            }

            if (!warningEl) {
                warningEl = document.createElement('p');
                warningEl.id = 'debugWarning';
                warningEl.className = 'text-[11px] text-amber-500 mt-1 shrink-0 hidden';
                debugOutputEl.parentElement.parentElement.insertBefore(warningEl, debugOutputEl.parentElement);
            }
            if (warnings.length) {
                warningEl.textContent = warnings.join(' ');
                warningEl.classList.remove('hidden');
            } else {
                warningEl.classList.add('hidden');
            }
        };

        window.updateDebugOutputWithBloch = window.updateDebugOutput;
    };
})();
