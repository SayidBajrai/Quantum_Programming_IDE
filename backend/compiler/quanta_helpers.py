"""
Quanta-lang integration helpers for compile, check, and debug endpoints.
"""
from __future__ import annotations

from typing import Any, Dict, Optional, List

try:
    import quanta
    from quanta.errors import (
        QuantaError,
        QuantaSyntaxError,
        QuantaSemanticError,
        QuantaTypeError,
    )
    QUANTA_AVAILABLE = True
except ImportError:
    QUANTA_AVAILABLE = False


def normalize_quanta_code(code: str) -> str:
    return code.replace("\r\n", "\n").replace("\r", "\n")


def _require_quanta() -> None:
    if not QUANTA_AVAILABLE:
        raise ImportError(
            "Quanta parser not available. Please install quanta-lang: pip install quanta-lang"
        )


def quanta_error_to_dict(exc: Exception) -> Dict[str, Any]:
    """Convert a Quanta exception into a structured error dict."""
    result: Dict[str, Any] = {
        "error": str(exc),
        "error_type": type(exc).__name__,
    }
    if isinstance(exc, QuantaError):
        if exc.line is not None:
            result["line"] = exc.line
        if exc.column is not None:
            result["column"] = exc.column
        if isinstance(exc, QuantaSyntaxError):
            result["category"] = "syntax"
        elif isinstance(exc, QuantaSemanticError):
            result["category"] = "semantic"
        elif isinstance(exc, QuantaTypeError):
            result["category"] = "type"
        else:
            result["category"] = "compilation"
    return result


def compile_quanta_to_qasm(code: str, keep_structure: bool = False) -> str:
    """Compile Quanta source to OpenQASM 3."""
    _require_quanta()
    normalized = normalize_quanta_code(code)
    return quanta.compile(normalized, keep_structure=keep_structure)


def check_quanta(code: str) -> Dict[str, Any]:
    """
    Check Quanta source for compile errors.

    Returns:
        {"valid": True} on success, or
        {"valid": False, "error": ..., "line": ..., "column": ..., ...} on failure.
    """
    _require_quanta()
    normalized = normalize_quanta_code(code)
    try:
        quanta.compile(normalized)
        return {"valid": True}
    except QuantaError as exc:
        result = quanta_error_to_dict(exc)
        result["valid"] = False
        return result
    except Exception as exc:
        return {
            "valid": False,
            "error": str(exc),
            "error_type": type(exc).__name__,
            "category": "unknown",
        }


def get_debug_prints(code: str) -> str:
    """Run Quanta in statevector simulator and return Print() output."""
    _require_quanta()
    normalized = normalize_quanta_code(code)
    return quanta.get_prints(normalized)


def run_quanta(code: str, shots: int = 1024) -> Dict[str, Any]:
    """Compile and run Quanta via quanta.run()."""
    _require_quanta()
    normalized = normalize_quanta_code(code)
    result = quanta.run(normalized, shots=shots)
    if isinstance(result, dict) and result.get("error"):
        raise RuntimeError(result["error"])
    return result


def compile_quanta_both(code: str) -> Dict[str, str]:
    """Compile Quanta to flattened and structured OpenQASM 3."""
    return {
        "qasm_flat": compile_quanta_to_qasm(code, keep_structure=False),
        "qasm_structured": compile_quanta_to_qasm(code, keep_structure=True),
    }


def get_all_function_docs(category: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return all built-in function docs as a list of dicts."""
    _require_quanta()
    summaries = quanta.list_functions(category)
    return [s.to_dict() for s in summaries]


def get_function_documentation(
    name: Optional[str] = None,
    source: Optional[str] = None,
    category: Optional[str] = None,
) -> Any:
    """Return built-in and/or user function documentation for IDE tooling."""
    _require_quanta()
    if name is None:
        return get_all_function_docs(category)
    doc = quanta.get_function_docs(name, source=source)
    if doc is None:
        return None
    if hasattr(doc, "to_dict"):
        return doc.to_dict()
    return doc


def get_user_function_docs_list(source: str) -> List[Dict[str, Any]]:
    """Return user-defined gate/func docs from /// comments in source."""
    _require_quanta()
    from quanta import get_user_function_docs

    docs = get_user_function_docs(normalize_quanta_code(source))
    if not isinstance(docs, dict):
        return []
    return [
        {**entry, "name": name, "category": entry.get("category", "user")}
        for name, entry in docs.items()
    ]


def get_debug_prints_structured(code: str) -> Dict[str, Any]:
    """Run debug prints and return text plus parsed visualizer blocks."""
    from .debug_parser import estimate_qubit_count, parse_debug_output

    normalized = normalize_quanta_code(code)
    output = get_debug_prints(code)
    qubits = estimate_qubit_count(normalized)
    warnings: List[str] = []
    if qubits > 20:
        warnings.append(
            f"Estimated {qubits} qubits exceeds statevector debug limit (20). "
            "Debug simulation may fail."
        )
    return {
        "output": output,
        "blocks": parse_debug_output(output),
        "qubit_count": qubits,
        "warnings": warnings,
    }


def get_quanta_version_info() -> Dict[str, Any]:
    """Return installed quanta-lang version and minimum IDE requirement."""
    _require_quanta()
    try:
        from importlib.metadata import version

        installed = version("quanta-lang")
    except Exception:
        installed = "unknown"
    return {
        "installed": installed,
        "required_min": "0.1.16",
        "features_ok": installed != "unknown",
    }


def get_compile_stats(code: str) -> Dict[str, Any]:
    """Compile Quanta and return flat/structured QASM stats."""
    from .debug_parser import compile_stats_from_qasm

    flat = compile_quanta_to_qasm(code, keep_structure=False)
    structured = compile_quanta_to_qasm(code, keep_structure=True)
    return {
        "flat": compile_stats_from_qasm(flat),
        "structured": compile_stats_from_qasm(structured),
    }
