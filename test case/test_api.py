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
    suite.addTests(loader.loadTestsFromTestCase(HttpApiTests))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
