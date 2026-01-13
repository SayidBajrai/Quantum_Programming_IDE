"""
OpenQASM 3 parser module
Converts OpenQASM 3 code to AST using the qiskit-qasm3-import parser library.

The qiskit-qasm3-import package provides the official OpenQASM 3 parser
for Qiskit. The parser is imported from qiskit.qasm3.loads.
"""
from utils.errors import CompilationError

# Import the loads function from qiskit.qasm3
# This is the standard way to import when qiskit-qasm3-import is installed
try:
    import qiskit.qasm3
    PARSER_AVAILABLE = True
except ImportError:
    # Parser not available - this should not happen if qiskit-qasm3-import is installed
    PARSER_AVAILABLE = False

def parse_qasm(code: str):
    """
    Parse OpenQASM 3 code into a Qiskit QuantumCircuit using qiskit.qasm3.loads.
    
    Args:
        code: OpenQASM 3 source code as string
        
    Returns:
        QuantumCircuit object (or None if parser not available)
        
    Raises:
        CompilationError: If parsing fails with a syntax error
        
    Note:
        Returns None if the parser module is not available, allowing the
        executor to proceed with direct circuit building (regex-based parsing).
        This is a graceful degradation strategy.
    """
    if not PARSER_AVAILABLE:
        # Parser not installed - return None to allow fallback to regex parsing
        return None
    
    try:
        # Use qiskit.qasm3.loads to parse OpenQASM 3 and get a QuantumCircuit
        circuit = qiskit.qasm3.loads(code)
        return circuit
    except Exception as e:
        # Raise CompilationError for parse failures so users get clear error messages
        raise CompilationError(f"Parse error: {str(e)}")
