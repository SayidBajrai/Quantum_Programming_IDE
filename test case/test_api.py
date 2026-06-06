"""
Backend and HTTP API tests for Quantum Programming IDE.
Run directly: python test_api.py
Or via testcase.bat from the project root.
"""
from __future__ import annotations

import json
import os
import sys
import unittest
import urllib.error
import urllib.request
from pathlib import Path

TEST_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TEST_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from compiler.executor import compile_and_simulate  # noqa: E402

BASE_URL = os.environ.get("TEST_BASE_URL", "http://127.0.0.1:5010")


def read_sample(name: str) -> str:
    return (TEST_DIR / name).read_text(encoding="utf-8")


def http_json(method: str, path: str, payload: dict | None = None) -> tuple[int, dict]:
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            parsed = json.loads(body) if body else {}
        except json.JSONDecodeError:
            parsed = {"error": body}
        return exc.code, parsed


class CompilerUnitTests(unittest.TestCase):
    def test_bell_state_simulation(self):
        code = read_sample("bell.qasm")
        result = compile_and_simulate(code, shots=256, language="openqasm3")
        self.assertIn("counts", result)
        self.assertEqual(result["qubits"], 2)
        self.assertEqual(sum(result["counts"].values()), 256)

    def test_superposition_simulation(self):
        code = read_sample("superposition.qasm")
        result = compile_and_simulate(code, shots=128, language="openqasm3")
        self.assertIn("counts", result)
        self.assertEqual(result["qubits"], 1)
        self.assertEqual(sum(result["counts"].values()), 128)

    def test_missing_measurement_fails(self):
        code = """OPENQASM 3;
include "stdgates.inc";
qubit[2] q;
h q[0];
cx q[0], q[1];
"""
        with self.assertRaises(Exception):
            compile_and_simulate(code, shots=64, language="openqasm3")

    def test_quanta_bell_state_simulation(self):
        code = read_sample("bell.qta")
        result = compile_and_simulate(code, shots=256, language="quanta")
        self.assertIn("counts", result)
        self.assertEqual(result["qubits"], 2)
        self.assertEqual(sum(result["counts"].values()), 256)


class QuantaHelperTests(unittest.TestCase):
    def test_compile_quanta_to_qasm(self):
        from compiler.quanta_helpers import compile_quanta_to_qasm

        code = read_sample("bell.qta")
        qasm = compile_quanta_to_qasm(code)
        self.assertIn("OPENQASM 3", qasm)
        self.assertIn("qubit", qasm)

    def test_check_quanta_valid(self):
        from compiler.quanta_helpers import check_quanta

        code = read_sample("bell.qta")
        result = check_quanta(code)
        self.assertTrue(result["valid"])

    def test_check_quanta_invalid(self):
        from compiler.quanta_helpers import check_quanta

        result = check_quanta("qbit q\nH(unknown)")
        self.assertFalse(result["valid"])
        self.assertIn("error", result)

    def test_debug_prints_superposition(self):
        from compiler.quanta_helpers import get_debug_prints

        code = read_sample("superposition.qta")
        output = get_debug_prints(code)
        self.assertTrue("|0" in output and "|1" in output)
        self.assertIn("1/", output)

    def test_run_quanta_bell(self):
        from compiler.quanta_helpers import run_quanta

        code = read_sample("bell.qta")
        result = run_quanta(code, shots=128)
        self.assertIn("counts", result)
        self.assertEqual(sum(result["counts"].values()), 128)

    def test_get_all_function_docs(self):
        from compiler.quanta_helpers import get_all_function_docs

        docs = get_all_function_docs()
        self.assertTrue(len(docs) > 0)
        names = {d["name"] for d in docs}
        self.assertIn("Print", names)
        self.assertIn("QAdd", names)


class HttpApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            with urllib.request.urlopen(f"{BASE_URL}/home", timeout=5):
                cls.server_available = True
        except (urllib.error.URLError, TimeoutError):
            cls.server_available = False

    def setUp(self):
        if not self.server_available:
            self.skipTest(f"Server not reachable at {BASE_URL}")

    def test_home_page(self):
        with urllib.request.urlopen(f"{BASE_URL}/home", timeout=10) as response:
            html = response.read().decode("utf-8")
        self.assertEqual(response.status, 200)
        self.assertIn("Quantum Programming IDE", html)

    def test_compiler_page_has_tabbed_right_section(self):
        with urllib.request.urlopen(f"{BASE_URL}/compiler", timeout=10) as response:
            html = response.read().decode("utf-8")
        self.assertIn('id="rightSection"', html)
        self.assertIn('data-tab="output"', html)
        self.assertIn("Simulation Results", html)
        self.assertIn('data-tab="qasm"', html)
        self.assertIn('data-tab="debug"', html)
        self.assertIn("Generated QASM", html)
        self.assertIn("Debug Output", html)

    def test_circuit_page_has_tabbed_right_section(self):
        with urllib.request.urlopen(f"{BASE_URL}/circuit", timeout=10) as response:
            html = response.read().decode("utf-8")
        self.assertIn('id="rightSection"', html)
        self.assertIn('data-tab="code"', html)
        self.assertIn('id="runBtn"', html)

    def test_compile_endpoint_bell(self):
        code = read_sample("bell.qasm")
        status, data = http_json("POST", "/compile", {"code": code, "shots": 256})
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("qubits"), 2)
        self.assertEqual(sum(data.get("counts", {}).values()), 256)

    def test_circuit_diagram_endpoint(self):
        code = read_sample("superposition.qasm")
        status, data = http_json("POST", "/circuit-diagram", {"code": code})
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success"))
        self.assertTrue(data.get("svg") or data.get("text"))

    def test_compile_quanta_bell(self):
        code = read_sample("bell.qta")
        status, data = http_json(
            "POST", "/compile", {"code": code, "shots": 256, "language": "quanta"}
        )
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("qubits"), 2)
        self.assertEqual(sum(data.get("counts", {}).values()), 256)

    def test_compile_to_qasm_endpoint(self):
        code = read_sample("bell.qta")
        status, data = http_json("POST", "/compile-to-qasm", {"code": code})
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success"))
        self.assertIn("OPENQASM 3", data.get("qasm", ""))

    def test_check_quanta_endpoint_valid(self):
        code = read_sample("bell.qta")
        status, data = http_json("POST", "/check-quanta", {"code": code})
        self.assertEqual(status, 200)
        self.assertTrue(data.get("valid"))

    def test_check_quanta_endpoint_invalid(self):
        status, data = http_json("POST", "/check-quanta", {"code": "qbit q\nH(missing)"})
        self.assertEqual(status, 400)
        self.assertFalse(data.get("valid"))
        self.assertIn("error", data)

    def test_debug_prints_endpoint(self):
        code = read_sample("superposition.qta")
        status, data = http_json("POST", "/debug-prints", {"code": code})
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success"))
        output = data.get("output", "")
        self.assertTrue("|0" in output and "|1" in output)

    def test_list_functions_endpoint(self):
        status, data = http_json("GET", "/list-functions", None)
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success"))
        self.assertTrue(len(data.get("functions", [])) > 0)

    def test_function_docs_endpoint(self):
        status, data = http_json("POST", "/function-docs", {"name": "Print"})
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success"))
        self.assertEqual(data["doc"]["name"], "Print")

    def test_compile_to_qasm_both_modes(self):
        code = read_sample("bell.qta")
        status, data = http_json("POST", "/compile-to-qasm", {"code": code, "include_both": True})
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success"))
        self.assertIn("OPENQASM 3", data.get("qasm_flat", ""))
        self.assertIn("OPENQASM 3", data.get("qasm_structured", ""))

    def test_save_file_normalizes_windows_line_endings(self):
        code = "line1\r\nline2\r\n"
        status, data = http_json(
            "POST",
            "/save-file",
            {"filename": "_test_crlf", "code": code, "language": "openqasm3"},
        )
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success"))

        saved_path = PROJECT_ROOT / "frontend" / "static" / "Saved" / "_test_crlf.qasm"
        try:
            raw = saved_path.read_bytes()
            self.assertNotIn(b"\r\r\n", raw)
            self.assertEqual(raw.decode("utf-8"), "line1\nline2\n")
        finally:
            if saved_path.exists():
                saved_path.unlink()


if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    suite.addTests(loader.loadTestsFromTestCase(CompilerUnitTests))
    suite.addTests(loader.loadTestsFromTestCase(QuantaHelperTests))
    suite.addTests(loader.loadTestsFromTestCase(HttpApiTests))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
