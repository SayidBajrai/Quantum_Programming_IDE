"""
Parse quanta get_prints() text output into structured blocks for IDE visualizers.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

BLOCH_CORE_RE = re.compile(
    r"BLOCH SPHERE\r?\n"
    r"- θ \(theta\): ([\d.]+)°\r?\n"
    r"- φ \(phi\): ([\d.]+)°\r?\n"
    r"- vector: \(([-\d.]+), ([-\d.]+), ([-\d.]+)\)"
    r"(?:\r?\n\r?\nSTATE\r?\n[^\n]*)?",
    re.MULTILINE,
)
KET_PROB_RE = re.compile(r"^(\|[^|]+⟩)\s*:\s*([\d.]+)%\s*$")
KET_AMP_RE = re.compile(r"^(\|[^|]+⟩)\s*:\s*([\d.]+)\s*$")
CIRCUIT_HEADER = "CIRCUIT EXECUTION TRACE"
SUMMARY_HEADER = "QUBIT INFO"
FIDELITY_RE = re.compile(r"^([\d.]+)\s*$")
MATRIX_ROW_RE = re.compile(r"^\[([^\]]+)\]")


def _line_start(text: str, index: int) -> int:
    prev = text.rfind("\n", 0, index)
    return 0 if prev == -1 else prev + 1


def _title_through_marker(text: str, marker_index: int, marker: str) -> str:
    start = _line_start(text, marker_index)
    end = marker_index + len(marker)
    return text[start:end]


def _parse_bloch_blocks(text: str) -> List[Dict[str, Any]]:
    blocks: List[Dict[str, Any]] = []
    for match in BLOCH_CORE_RE.finditer(text):
        start = _line_start(text, match.start())
        end = match.end()
        blocks.append({
            "kind": "bloch",
            "start": start,
            "end": end,
            "title": _title_through_marker(text, match.start(), "BLOCH SPHERE"),
            "data": {
                "theta": float(match.group(1)),
                "phi": float(match.group(2)),
                "x": float(match.group(3)),
                "y": float(match.group(4)),
                "z": float(match.group(5)),
            },
        })
    return blocks


def _parse_prob_blocks(text: str) -> List[Dict[str, Any]]:
    blocks: List[Dict[str, Any]] = []
    lines = text.split("\n")
    offset = 0
    run_start: Optional[int] = None
    run_entries: List[Dict[str, Any]] = []
    run_title = ""

    def flush(end_offset: int) -> None:
        nonlocal run_start, run_entries, run_title
        if run_start is not None and len(run_entries) >= 1:
            blocks.append({
                "kind": "prob",
                "start": run_start,
                "end": end_offset,
                "title": run_title or "probabilities",
                "data": {"entries": run_entries},
            })
        run_start = None
        run_entries = []
        run_title = ""

    for line in lines:
        line_start = offset
        stripped = line.strip()
        m = KET_PROB_RE.match(stripped)
        if m:
            if run_start is None:
                run_start = line_start
                run_title = _title_through_marker(text, line_start, stripped.split(":")[0].strip())
                prev_line_start = text.rfind("\n", 0, line_start - 1)
                if prev_line_start >= 0:
                    prev = text[prev_line_start + 1:line_start].strip()
                    if prev and "BLOCH" not in prev and "CIRCUIT" not in prev:
                        run_start = prev_line_start + 1
                        run_title = prev[:80]
            run_entries.append({"ket": m.group(1), "pct": float(m.group(2))})
        else:
            if run_start is not None:
                flush(line_start)
        offset += len(line) + 1
    flush(len(text))
    return blocks


def _parse_amplitude_blocks(text: str) -> List[Dict[str, Any]]:
    blocks: List[Dict[str, Any]] = []
    lines = text.split("\n")
    offset = 0
    run_start: Optional[int] = None
    run_entries: List[Dict[str, Any]] = []

    def flush(end_offset: int) -> None:
        nonlocal run_start, run_entries
        if run_start is not None and len(run_entries) >= 1:
            blocks.append({
                "kind": "amplitudes",
                "start": run_start,
                "end": end_offset,
                "title": "amplitudes",
                "data": {"entries": run_entries},
            })
        run_start = None
        run_entries = []

    for line in lines:
        line_start = offset
        stripped = line.strip()
        if KET_PROB_RE.match(stripped):
            offset += len(line) + 1
            continue
        m = KET_AMP_RE.match(stripped)
        if m:
            if run_start is None:
                run_start = line_start
            run_entries.append({"ket": m.group(1), "mag": float(m.group(2))})
        else:
            if run_start is not None:
                flush(line_start)
        offset += len(line) + 1
    flush(len(text))
    return blocks


def _parse_summary_blocks(text: str) -> List[Dict[str, Any]]:
    blocks: List[Dict[str, Any]] = []
    idx = 0
    while True:
        pos = text.find(SUMMARY_HEADER, idx)
        if pos < 0:
            break
        start = _line_start(text, pos)
        next_markers = [
            text.find(h, pos + len(SUMMARY_HEADER))
            for h in ("BLOCH SPHERE", CIRCUIT_HEADER, "QUBIT INFO")
        ]
        candidates = [p for p in next_markers if p > pos]
        end = min(candidates) if candidates else len(text)
        section = text[pos:end].rstrip()
        if section:
            end = pos + len(section)
            blocks.append({
                "kind": "summary",
                "start": start,
                "end": end,
                "title": _title_through_marker(text, pos, SUMMARY_HEADER),
                "data": {"text": section},
            })
        idx = pos + len(SUMMARY_HEADER)
    return blocks


def _parse_circuit_blocks(text: str) -> List[Dict[str, Any]]:
    blocks: List[Dict[str, Any]] = []
    idx = 0
    while True:
        pos = text.find(CIRCUIT_HEADER, idx)
        if pos < 0:
            break
        start = _line_start(text, pos)
        next_pos = text.find("BLOCH SPHERE", pos + 1)
        next_pos2 = text.find("QUBIT INFO", pos + 1)
        ends = [p for p in (next_pos, next_pos2) if p > pos]
        end = min(ends) if ends else len(text)
        section = text[pos:end].rstrip()
        end = pos + len(section)
        lines = section.split("\n")
        trace = [ln for ln in lines if re.match(r"^\d+\.", ln.strip()) or ln.strip().startswith(("├─", "└─"))]
        stats = {}
        for ln in lines:
            if ln.startswith("TOTAL GATES:"):
                stats["total_gates"] = int(ln.split(":")[1].strip())
            elif ln.startswith("DEPTH:"):
                stats["depth"] = int(ln.split(":")[1].strip())
            elif ln.startswith("QUBITS:"):
                stats["qubits"] = int(ln.split(":")[1].strip())
        blocks.append({
            "kind": "circuit",
            "start": start,
            "end": end,
            "title": _title_through_marker(text, pos, CIRCUIT_HEADER),
            "data": {"trace": trace, **stats},
        })
        idx = pos + len(CIRCUIT_HEADER)
    return blocks


def _parse_density_blocks(text: str) -> List[Dict[str, Any]]:
    blocks: List[Dict[str, Any]] = []
    lines = text.split("\n")
    offset = 0
    i = 0
    while i < len(lines):
        if lines[i].strip() == "[":
            block_start = offset
            rows: List[List[str]] = []
            j = i + 1
            row_offset = offset + len(lines[i]) + 1
            while j < len(lines):
                row_line = lines[j].strip()
                if row_line in ("]", "),"):
                    break
                m = MATRIX_ROW_RE.match(row_line)
                if m:
                    cells = [c.strip() for c in m.group(1).split(",")]
                    rows.append(cells)
                j += 1
            if rows:
                end_line = j + 1 if j < len(lines) else j
                end = sum(len(lines[k]) + 1 for k in range(end_line))
                blocks.append({
                    "kind": "density",
                    "start": block_start,
                    "end": end,
                    "title": "density matrix",
                    "data": {"rows": rows},
                })
            i = j + 1
            offset = sum(len(lines[k]) + 1 for k in range(i))
            continue
        offset += len(lines[i]) + 1
        i += 1
    return blocks


def _parse_fidelity_blocks(text: str) -> List[Dict[str, Any]]:
    blocks: List[Dict[str, Any]] = []
    for m in re.finditer(r"(?i)fidelity[:\s]+([\d.]+)", text):
        val = m.group(1)
        start = m.start()
        end = m.end()
        blocks.append({
            "kind": "fidelity",
            "start": start,
            "end": end,
            "title": f"Fidelity: {val}",
            "data": {"value": val},
        })
    return blocks


def _parse_symbolic_blocks(text: str) -> List[Dict[str, Any]]:
    """Link lines containing ket notation that are not other block types."""
    blocks: List[Dict[str, Any]] = []
    if "BLOCH SPHERE" in text or "QUBIT INFO" in text:
        return blocks
    for m in re.finditer(r"^.*\|[^\n]+⟩.*$", text, re.MULTILINE):
        line = m.group(0).strip()
        if KET_PROB_RE.match(line) or KET_AMP_RE.match(line):
            continue
        if "BLOCH" in line or "CIRCUIT" in line or line.startswith("-"):
            continue
        blocks.append({
            "kind": "symbolic",
            "start": m.start(),
            "end": m.end(),
            "title": line[:60],
            "data": {"expression": line},
        })
    return blocks


def _dedupe_overlaps(blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Prefer more specific kinds when spans overlap."""
    priority = {
        "bloch": 10, "summary": 9, "circuit": 8, "density": 7,
        "prob": 6, "amplitudes": 5, "symbolic": 4, "fidelity": 3,
    }
    blocks = sorted(blocks, key=lambda b: (b["start"], -priority.get(b["kind"], 0)))
    kept: List[Dict[str, Any]] = []
    for block in blocks:
        if any(
            not (block["end"] <= k["start"] or block["start"] >= k["end"])
            for k in kept
        ):
            continue
        kept.append(block)
    return sorted(kept, key=lambda b: b["start"])


def parse_debug_output(text: str) -> List[Dict[str, Any]]:
    """Parse full debug text into non-overlapping structured blocks."""
    if not text:
        return []
    all_blocks: List[Dict[str, Any]] = []
    all_blocks.extend(_parse_bloch_blocks(text))
    all_blocks.extend(_parse_summary_blocks(text))
    all_blocks.extend(_parse_circuit_blocks(text))
    all_blocks.extend(_parse_density_blocks(text))
    all_blocks.extend(_parse_prob_blocks(text))
    all_blocks.extend(_parse_amplitude_blocks(text))
    all_blocks.extend(_parse_symbolic_blocks(text))
    all_blocks.extend(_parse_fidelity_blocks(text))
    return _dedupe_overlaps(all_blocks)


def estimate_qubit_count(code: str) -> int:
    """Rough qubit register count from source (for simulator limit warning)."""
    total = 0
    for m in re.finditer(r"qbit(?:\[(\d+)\])?\s+(\w+)", code):
        total += int(m.group(1)) if m.group(1) else 1
    return total


def compile_stats_from_qasm(qasm: str) -> Dict[str, Any]:
    """Basic gate/line stats from generated QASM."""
    lines = [ln.strip() for ln in qasm.splitlines() if ln.strip() and not ln.strip().startswith("//")]
    gate_lines = [
        ln for ln in lines
        if not ln.endswith(";") is False
        and not ln.startswith(("OPENQASM", "include", "qubit", "bit", "def", "gate"))
        and "measure" not in ln
        and "barrier" not in ln
        and "=" not in ln
    ]
    gate_ops = [ln for ln in lines if ln.endswith(";") and not ln.startswith(("qubit", "bit", "OPENQASM", "include"))]
    measure_count = sum(1 for ln in lines if ln.startswith("measure"))
    return {
        "qasm_lines": len(lines),
        "gate_ops": len(gate_ops),
        "measure_ops": measure_count,
    }
