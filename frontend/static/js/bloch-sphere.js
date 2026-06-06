/**
 * Bloch sphere visualization for Quanta debug :bloch output.
 * Hover a BLOCH SPHERE block → small preview; click → pinned interactive view.
 */
(function () {
    const BLOCH_CORE_RE = /BLOCH SPHERE\r?\n- θ \(theta\): ([\d.]+)°\r?\n- φ \(phi\): ([\d.]+)°\r?\n- vector: \(([-\d.]+), ([-\d.]+), ([-\d.]+)\)(?:\r?\n\r?\nSTATE\r?\n[^\n]*)?/g;

    const BLOCH_TITLE_SUFFIX = 'BLOCH SPHERE';

    function lineStartAt(text, index) {
        const prev = text.lastIndexOf('\n', index - 1);
        return prev === -1 ? 0 : prev + 1;
    }

    function parseBlochBlocks(text) {
        const blocks = [];
        BLOCH_CORE_RE.lastIndex = 0;
        let match;
        while ((match = BLOCH_CORE_RE.exec(text)) !== null) {
            const blochStart = match.index;
            const linkStart = lineStartAt(text, blochStart);
            const titleEnd = blochStart + BLOCH_TITLE_SUFFIX.length;
            blocks.push({
                start: linkStart,
                end: match.index + match[0].length,
                title: text.slice(linkStart, titleEnd),
                theta: parseFloat(match[1]),
                phi: parseFloat(match[2]),
                x: parseFloat(match[3]),
                y: parseFloat(match[4]),
                z: parseFloat(match[5]),
                text: text.slice(linkStart, match.index + match[0].length)
            });
        }
        return blocks;
    }
    const ANGLE_EPS = 0.5;

    function rotateY(x, y, z, angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return [x * c + z * s, y, -x * s + z * c];
    }

    function rotateX(x, y, z, angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return [x, y * c - z * s, y * s + z * c];
    }

    function transformPoint(x, y, z, viewTheta, viewPhi) {
        let p = rotateY(x, y, z, viewTheta);
        p = rotateX(p[0], p[1], p[2], viewPhi);
        return p;
    }

    function unitVector(x, y, z) {
        const mag = Math.hypot(x, y, z);
        if (mag < 1e-9) return [0, 0, 1];
        return [x / mag, y / mag, z / mag];
    }

    function slerpOnSphere(from, to, t) {
        const lx = from[0] + (to[0] - from[0]) * t;
        const ly = from[1] + (to[1] - from[1]) * t;
        const lz = from[2] + (to[2] - from[2]) * t;
        return unitVector(lx, ly, lz);
    }

    class BlochSphereView {
        constructor(canvas, options = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.interactive = !!options.interactive;
            this.size = options.size || 200;
            this.viewTheta = options.viewTheta ?? 0.55;
            this.viewPhi = options.viewPhi ?? 0.45;
            this.vector = { x: 0, y: 0, z: 1 };
            this.theta = 0;
            this.phi = 0;
            this._dragging = false;
            this._lastX = 0;
            this._lastY = 0;

            canvas.width = this.size;
            canvas.height = this.size;

            if (this.interactive) {
                canvas.addEventListener('mousedown', (e) => this._onDown(e));
                canvas.addEventListener('mousemove', (e) => this._onMove(e));
                window.addEventListener('mouseup', () => { this._dragging = false; });
                canvas.addEventListener('touchstart', (e) => this._onDown(e.touches[0]), { passive: true });
                canvas.addEventListener('touchmove', (e) => this._onMove(e.touches[0]), { passive: true });
                window.addEventListener('touchend', () => { this._dragging = false; });
            }
        }

        setState(x, y, z, theta, phi) {
            this.vector = { x, y, z };
            this.theta = theta ?? 0;
            this.phi = phi ?? 0;
            this.draw();
        }

        _onDown(e) {
            this._dragging = true;
            this._lastX = e.clientX;
            this._lastY = e.clientY;
        }

        _onMove(e) {
            if (!this._dragging) return;
            const dx = e.clientX - this._lastX;
            const dy = e.clientY - this._lastY;
            this._lastX = e.clientX;
            this._lastY = e.clientY;
            this.viewTheta += dx * 0.012;
            this.viewPhi = Math.max(-1.2, Math.min(1.2, this.viewPhi + dy * 0.012));
            this.draw();
        }

        _project(x, y, z) {
            const cx = this.size / 2;
            const cy = this.size / 2;
            const scale = this.size * 0.36;
            const p = transformPoint(x, y, z, this.viewTheta, this.viewPhi);
            return { sx: cx + p[0] * scale, sy: cy - p[1] * scale, depth: p[2] };
        }

        _circleInPlane(getPoint, segments = 64) {
            const pts = [];
            for (let i = 0; i <= segments; i++) {
                const t = (i / segments) * Math.PI * 2;
                pts.push(getPoint(t));
            }
            return pts;
        }

        _drawPolyline(points, color, width = 1, alpha = 1, dashed = false) {
            const ctx = this.ctx;
            ctx.save();
            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = width;
            if (dashed) ctx.setLineDash([4, 3]);
            ctx.beginPath();
            points.forEach((pt, i) => {
                const pr = this._project(pt[0], pt[1], pt[2]);
                if (i === 0) ctx.moveTo(pr.sx, pr.sy);
                else ctx.lineTo(pr.sx, pr.sy);
            });
            ctx.stroke();
            ctx.restore();
        }

        _drawAxis(direction, color, label) {
            const ctx = this.ctx;
            const scale = 0.55;
            const tip = this._project(direction[0] * scale, direction[1] * scale, direction[2] * scale);
            const origin = this._project(0, 0, 0);

            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(origin.sx, origin.sy);
            ctx.lineTo(tip.sx, tip.sy);
            ctx.stroke();

            const fontSize = Math.max(9, this.size * 0.065);
            ctx.font = `bold ${fontSize}px Consolas, monospace`;
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const offset = fontSize * 0.75;
            const nx = tip.sx + (tip.sx - origin.sx) * 0.08;
            const ny = tip.sy + (tip.sy - origin.sy) * 0.08;
            ctx.fillText(label, nx, ny);
            ctx.restore();
        }

        _drawAngleArcs(uv) {
            const showTheta = Math.abs(this.theta) > ANGLE_EPS && Math.abs(this.theta - 180) > ANGLE_EPS;
            const xyMag = Math.hypot(this.vector.x, this.vector.y);
            const showPhi = Math.abs(this.phi) > ANGLE_EPS && xyMag > 1e-4;

            if (showTheta) {
                const north = [0, 0, 1];
                const arcPts = [];
                for (let i = 0; i <= 24; i++) {
                    arcPts.push(slerpOnSphere(north, uv, i / 24));
                }
                this._drawPolyline(arcPts, '#fb923c', 2, 0.95, true);
                const mid = arcPts[Math.floor(arcPts.length / 2)];
                const pr = this._project(mid[0], mid[1], mid[2]);
                this._drawAngleLabel(pr.sx, pr.sy, `θ=${Math.round(this.theta)}°`, '#fb923c');
            }

            if (showPhi) {
                const phiRad = Math.atan2(this.vector.y, this.vector.x);
                const arcR = 0.42;
                const arcPts = [];
                const steps = Math.max(8, Math.round(Math.abs(phiRad) / (Math.PI / 12)));
                for (let i = 0; i <= steps; i++) {
                    const a = (phiRad * i) / steps;
                    arcPts.push([arcR * Math.cos(a), arcR * Math.sin(a), 0]);
                }
                this._drawPolyline(arcPts, '#38bdf8', 2, 0.95, true);
                const midA = phiRad / 2;
                const pr = this._project(arcR * 0.65 * Math.cos(midA), arcR * 0.65 * Math.sin(midA), 0);
                this._drawAngleLabel(pr.sx, pr.sy, `φ=${Math.round(this.phi)}°`, '#38bdf8');
            }
        }

        _drawAngleLabel(x, y, text, color) {
            const ctx = this.ctx;
            const fontSize = Math.max(8, this.size * 0.058);
            ctx.save();
            ctx.font = `bold ${fontSize}px Consolas, monospace`;
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, y);
            ctx.restore();
        }

        draw() {
            const ctx = this.ctx;
            const s = this.size;
            ctx.clearRect(0, 0, s, s);

            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, s, s);

            const gridColor = '#374151';
            const equatorColor = '#4b5563';

            this._drawPolyline(
                this._circleInPlane(t => [Math.cos(t), Math.sin(t), 0]),
                equatorColor, 1.2, 0.9
            );
            this._drawPolyline(
                this._circleInPlane(t => [Math.cos(t), 0, Math.sin(t)]),
                gridColor, 1, 0.55
            );
            this._drawPolyline(
                this._circleInPlane(t => [0, Math.cos(t), Math.sin(t)]),
                gridColor, 1, 0.55
            );

            const outline = this._circleInPlane(t => [Math.cos(t), 0, Math.sin(t)]);
            ctx.save();
            ctx.strokeStyle = '#6b7280';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            outline.forEach((pt, i) => {
                const pr = this._project(pt[0], pt[1], pt[2]);
                if (i === 0) ctx.moveTo(pr.sx, pr.sy);
                else ctx.lineTo(pr.sx, pr.sy);
            });
            ctx.stroke();
            ctx.restore();

            this._drawAxis([1, 0, 0], '#f87171', '+X');
            this._drawAxis([0, 1, 0], '#4ade80', '+Y');
            this._drawAxis([0, 0, 1], '#60a5fa', '+Z');

            const poleRadius = 1.22;
            const poleLabels = [
                { x: 0, y: 0, z: 1, text: '|0⟩', color: '#86efac' },
                { x: 0, y: 0, z: -1, text: '|1⟩', color: '#fca5a5' }
            ];
            ctx.font = `${Math.max(10, s * 0.07)}px Consolas, monospace`;
            const centerPr = this._project(0, 0, 0);
            poleLabels.forEach(({ x, y, z, text, color }) => {
                const pr = this._project(x * poleRadius, y * poleRadius, z * poleRadius);
                const dx = pr.sx - centerPr.sx;
                const dy = pr.sy - centerPr.sy;
                const len = Math.hypot(dx, dy) || 1;
                const extra = Math.max(10, s * 0.045);
                ctx.fillStyle = color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, pr.sx + (dx / len) * extra, pr.sy + (dy / len) * extra);
            });

            const uv = unitVector(this.vector.x, this.vector.y, this.vector.z);
            this._drawAngleArcs(uv);

            const origin = this._project(0, 0, 0);
            const tip = this._project(this.vector.x, this.vector.y, this.vector.z);
            const mag = Math.hypot(this.vector.x, this.vector.y, this.vector.z);

            ctx.save();
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(origin.sx, origin.sy);
            ctx.lineTo(tip.sx, tip.sy);
            ctx.stroke();

            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(tip.sx, tip.sy, Math.max(3, s * 0.025), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (this.interactive || s >= 240) {
                ctx.fillStyle = '#9ca3af';
                ctx.font = `${Math.max(9, s * 0.055)}px Consolas, monospace`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'bottom';
                let footerY = s - 6;
                ctx.fillText(
                    `(${this.vector.x.toFixed(3)}, ${this.vector.y.toFixed(3)}, ${this.vector.z.toFixed(3)})`,
                    6, footerY
                );
                if (mag < 0.99) {
                    footerY -= 16;
                    ctx.fillStyle = '#fbbf24';
                    ctx.fillText(`mixed r=${mag.toFixed(3)}`, 6, footerY);
                }
            }
        }
    }

    function createPinnedPanel(index, onClose) {
        const el = document.createElement('div');
        el.className = 'bloch-pinned-panel fixed z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden select-none';
        el.innerHTML = `
            <div class="bloch-panel-header flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-950 cursor-move">
                <span class="bloch-panel-title text-sm font-medium text-emerald-400 pointer-events-none truncate max-w-[260px]" title=""></span>
                <button type="button" class="bloch-close text-gray-400 hover:text-white text-lg leading-none px-1 cursor-pointer" title="Close">&times;</button>
            </div>
            <div class="p-3">
                <canvas class="block mx-auto rounded-lg cursor-grab active:cursor-grabbing"></canvas>
                <p class="bloch-state-label text-xs text-emerald-300/90 text-center mt-2 font-mono leading-relaxed px-1"></p>
                <p class="bloch-angle-label text-xs text-gray-500 text-center mt-0.5 font-mono"></p>
                <p class="text-[10px] text-gray-600 text-center mt-1">Drag header to move · drag sphere to rotate</p>
            </div>`;
        document.body.appendChild(el);
        const canvas = el.querySelector('canvas');
        const view = new BlochSphereView(canvas, { size: 300, interactive: true });
        const panel = {
            el,
            view,
            stateLabel: el.querySelector('.bloch-state-label'),
            angleLabel: el.querySelector('.bloch-angle-label'),
            titleEl: el.querySelector('.bloch-panel-title'),
            header: el.querySelector('.bloch-panel-header'),
            closeBtn: el.querySelector('.bloch-close')
        };
        setupPanelDrag(panel);
        const offset = index * 28;
        clampPopoverPosition(
            el,
            window.innerWidth / 2 - 160 + offset,
            window.innerHeight / 2 - 180 + offset
        );
        panel.closeBtn.addEventListener('click', () => onClose(panel));
        return panel;
    }

    function createHoverPopover() {
        const el = document.createElement('div');
        el.id = 'blochHoverPopover';
        el.className = 'bloch-hover-popover hidden fixed z-40 pointer-events-none bg-gray-900/95 border border-emerald-800/60 rounded-lg shadow-xl p-1';
        el.innerHTML = '<canvas class="block rounded"></canvas>';
        document.body.appendChild(el);
        const canvas = el.querySelector('canvas');
        const view = new BlochSphereView(canvas, { size: 168, interactive: false });
        return { el, view };
    }

    function clampPopoverPosition(el, left, top) {
        const pad = 8;
        const rect = el.getBoundingClientRect();
        const w = rect.width || el.offsetWidth || 200;
        const h = rect.height || el.offsetHeight || 200;
        let x = left;
        let y = top;
        if (x + w + pad > window.innerWidth) x = window.innerWidth - w - pad;
        if (y + h + pad > window.innerHeight) y = window.innerHeight - h - pad;
        if (x < pad) x = pad;
        if (y < pad) y = pad;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
    }

    function setupPanelDrag(panel) {
        if (!panel.header) return;
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        panel.header.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || e.target.closest('.bloch-close')) return;
            dragging = true;
            const rect = panel.el.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            clampPopoverPosition(panel.el, e.clientX - offsetX, e.clientY - offsetY);
        });

        window.addEventListener('mouseup', () => {
            dragging = false;
        });
    }

    function applyBlockToView(view, block) {
        view.setState(block.x, block.y, block.z, block.theta, block.phi);
    }

    function formatAngleLabel(block) {
        const parts = [];
        if (Math.abs(block.theta) > ANGLE_EPS) parts.push(`θ=${Math.round(block.theta)}°`);
        if (Math.abs(block.phi) > ANGLE_EPS) parts.push(`φ=${Math.round(block.phi)}°`);
        return parts.length ? parts.join('  ') : '';
    }

    const SYM_TOL = 1e-3;
    const ISQRT2 = 1 / Math.sqrt(2);

    function symNear(a, b, tol = SYM_TOL) {
        return Math.abs(a - b) < tol;
    }

    function formatCoeffMag(mag) {
        if (symNear(mag, 1)) return '1';
        if (symNear(mag, ISQRT2)) return '1/√2';
        if (symNear(mag, 0.5)) return '1/2';
        if (symNear(mag, 0.25)) return '1/4';
        return mag.toFixed(4).replace(/\.?0+$/, '');
    }

    function formatPhaseFactor(phiRad) {
        if (symNear(phiRad, 0)) return { sign: '+', prefix: '' };
        if (symNear(Math.abs(phiRad), Math.PI)) return { sign: '-', prefix: '' };
        if (symNear(phiRad, Math.PI / 2)) return { sign: '+', prefix: 'i' };
        if (symNear(phiRad, -Math.PI / 2)) return { sign: '-', prefix: 'i' };
        const deg = Math.round((phiRad * 180) / Math.PI);
        return { sign: '+', prefix: `e^(i${deg}°)` };
    }

    function formatSuperpositionInner(phiRad) {
        const { sign, prefix } = formatPhaseFactor(phiRad);
        if (!prefix) {
            return sign === '-' ? '|0⟩ - |1⟩' : '|0⟩ + |1⟩';
        }
        if (prefix === 'i') {
            return sign === '-' ? '|0⟩ - i|1⟩' : '|0⟩ + i|1⟩';
        }
        return sign === '-'
            ? `|0⟩ - ${prefix}|1⟩`
            : `|0⟩ + ${prefix}|1⟩`;
    }

    function formatKet0(amp0) {
        if (symNear(amp0, 1)) return '|0⟩';
        if (symNear(amp0, -1)) return '-|0⟩';
        if (amp0 < 0) return `-${formatCoeffMag(Math.abs(amp0))}|0⟩`;
        return `${formatCoeffMag(amp0)}|0⟩`;
    }

    function formatKet1Term(amp1, phiRad) {
        const c = formatCoeffMag(amp1);
        const { sign, prefix } = formatPhaseFactor(phiRad);
        let body;
        if (!prefix) {
            body = c === '1' ? '|1⟩' : `${c}|1⟩`;
        } else if (prefix === 'i') {
            body = c === '1' ? 'i|1⟩' : `${c}·i|1⟩`;
        } else {
            body = c === '1' ? `${prefix}|1⟩` : `${c}·${prefix}|1⟩`;
        }
        if (sign === '-' && !body.startsWith('-')) {
            body = `- ${body}`;
        }
        return body;
    }

    /**
     * Pure-state ket from Bloch angles (quanta convention):
     * |ψ⟩ = cos(θ/2)|0⟩ + e^(iφ) sin(θ/2)|1⟩
     */
    function blochToSymbolic(thetaDeg, phiDeg, x, y, z) {
        const r = Math.hypot(x, y, z);
        if (r < 0.99) {
            return 'mixed state — not a pure |ψ⟩';
        }

        const thetaRad = (thetaDeg * Math.PI) / 180;
        const phiRad = (phiDeg * Math.PI) / 180;
        const half = thetaRad / 2;
        const amp0 = Math.cos(half);
        const amp1 = Math.sin(half);

        if (amp1 < SYM_TOL) {
            return amp0 >= 0 ? '|0⟩' : '-|0⟩';
        }
        if (amp0 < SYM_TOL) {
            return formatKet1Term(1, phiRad).replace(/^-\s*/, '-').replace(/^\s*/, '');
        }

        if (symNear(Math.abs(amp0), Math.abs(amp1))) {
            const shared = formatCoeffMag(Math.abs(amp0));
            return `${shared} (${formatSuperpositionInner(phiRad)})`;
        }

        const t0 = formatKet0(amp0);
        const t1 = formatKet1Term(amp1, phiRad);
        if (t1.startsWith('-')) {
            return `${t0} ${t1}`;
        }
        return `${t0} + ${t1}`;
    }

    window.setupBlochDebugVisualization = function setupBlochDebugVisualization(debugOutputEl) {
        if (!debugOutputEl) return;

        const hoverPopover = createHoverPopover();
        const pinnedPanels = [];
        const pinnedByBlockIndex = new Map();
        let pinCounter = 0;
        let hintEl = null;

        function hideHover() {
            hoverPopover.el.classList.add('hidden');
        }

        function blockFromDataset(el) {
            return {
                x: parseFloat(el.dataset.x),
                y: parseFloat(el.dataset.y),
                z: parseFloat(el.dataset.z),
                theta: parseFloat(el.dataset.theta),
                phi: parseFloat(el.dataset.phi),
                index: el.dataset.blochIndex,
                title: el.dataset.title || 'BLOCH SPHERE'
            };
        }

        function bringPanelToFront(panel) {
            const maxZ = pinnedPanels.reduce((z, p) => Math.max(z, parseInt(p.el.style.zIndex, 10) || 50), 50);
            panel.el.style.zIndex = String(maxZ + 1);
        }

        function showHover(block, anchorRect) {
            applyBlockToView(hoverPopover.view, block);
            hoverPopover.el.classList.remove('hidden');
            clampPopoverPosition(
                hoverPopover.el,
                anchorRect.right + 10,
                anchorRect.top
            );
        }

        function populatePinnedPanel(panel, block) {
            applyBlockToView(panel.view, block);
            if (panel.titleEl) {
                panel.titleEl.textContent = block.title || 'BLOCH SPHERE';
                panel.titleEl.title = block.title || 'BLOCH SPHERE';
            }
            if (panel.stateLabel) {
                panel.stateLabel.textContent = blochToSymbolic(
                    block.theta, block.phi, block.x, block.y, block.z
                );
            }
            if (panel.angleLabel) {
                const angleText = formatAngleLabel(block);
                panel.angleLabel.textContent = angleText;
                panel.angleLabel.classList.toggle('hidden', !angleText);
            }
        }

        function removePinnedPanel(panel) {
            const idx = pinnedPanels.indexOf(panel);
            if (idx >= 0) pinnedPanels.splice(idx, 1);
            if (panel.blockIndex != null) {
                pinnedByBlockIndex.delete(panel.blockIndex);
            }
            panel.el.remove();
        }

        function pinBlock(block) {
            hideHover();
            const key = String(block.index);
            if (pinnedByBlockIndex.has(key)) {
                const existing = pinnedByBlockIndex.get(key);
                bringPanelToFront(existing);
                return;
            }
            const panel = createPinnedPanel(pinCounter++, removePinnedPanel);
            panel.blockIndex = key;
            pinnedPanels.push(panel);
            pinnedByBlockIndex.set(key, panel);
            populatePinnedPanel(panel, block);
            panel.el.style.zIndex = String(50 + pinnedPanels.length);
        }

        function closeAllPinnedPanels() {
            while (pinnedPanels.length) {
                removePinnedPanel(pinnedPanels[pinnedPanels.length - 1]);
            }
            pinnedByBlockIndex.clear();
            pinCounter = 0;
        }

        debugOutputEl.addEventListener('mouseover', (e) => {
            const block = e.target.closest('.bloch-block');
            if (!block) return;
            showHover(blockFromDataset(block), block.getBoundingClientRect());
        });

        debugOutputEl.addEventListener('mouseout', (e) => {
            const block = e.target.closest('.bloch-block');
            if (!block) return;
            const related = e.relatedTarget;
            if (related && block.contains(related)) return;
            hideHover();
        });

        debugOutputEl.addEventListener('click', (e) => {
            const block = e.target.closest('.bloch-block');
            if (!block) return;
            e.preventDefault();
            e.stopPropagation();
            pinBlock(blockFromDataset(block));
        });

        const scrollParent = debugOutputEl.closest('.overflow-auto') || debugOutputEl;
        scrollParent.addEventListener('scroll', hideHover, { passive: true });

        window.updateDebugOutputWithBloch = function updateDebugOutputWithBloch(text) {
            closeAllPinnedPanels();
            hideHover();

            const blocks = parseBlochBlocks(text);
            debugOutputEl.textContent = '';

            if (blocks.length === 0) {
                debugOutputEl.textContent = text;
                if (hintEl) hintEl.classList.add('hidden');
                return;
            }

            let lastIndex = 0;
            blocks.forEach((block, index) => {
                if (block.start > lastIndex) {
                    debugOutputEl.appendChild(
                        document.createTextNode(text.slice(lastIndex, block.start))
                    );
                }
                const span = document.createElement('span');
                span.className = 'bloch-block underline decoration-emerald-700/50 decoration-dotted underline-offset-2 cursor-pointer hover:bg-emerald-950/50 rounded-sm';
                span.dataset.blochIndex = String(index);
                span.dataset.x = String(block.x);
                span.dataset.y = String(block.y);
                span.dataset.z = String(block.z);
                span.dataset.theta = String(block.theta);
                span.dataset.phi = String(block.phi);
                span.dataset.title = block.title;
                span.title = `${block.title} — hover to preview, click to pin (× to close)`;
                span.textContent = text.slice(block.start, block.end);
                debugOutputEl.appendChild(span);
                lastIndex = block.end;
            });

            if (lastIndex < text.length) {
                debugOutputEl.appendChild(document.createTextNode(text.slice(lastIndex)));
            }

            if (!hintEl) {
                hintEl = document.createElement('p');
                hintEl.id = 'blochHint';
                hintEl.className = 'text-[11px] text-emerald-700/80 mt-1 shrink-0 hidden';
                debugOutputEl.parentElement.parentElement.insertBefore(
                    hintEl,
                    debugOutputEl.parentElement
                );
            }
            hintEl.textContent = `${blocks.length} Bloch link${blocks.length > 1 ? 's' : ''} — hover to preview, click to pin one window per link`;
            hintEl.classList.remove('hidden');
        };
    };
})();
