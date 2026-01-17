"""
Parser module for OpenQASM 3 and Quanta languages
Converts quantum code to Qiskit QuantumCircuit objects.
"""
from utils.errors import CompilationError

# Import OpenQASM 3 parser
try:
    import qiskit.qasm3
    QASM3_PARSER_AVAILABLE = True
except ImportError:
    QASM3_PARSER_AVAILABLE = False

# Import Quanta language parser
try:
    import quanta
    QUANTA_PARSER_AVAILABLE = True
except ImportError:
    QUANTA_PARSER_AVAILABLE = False

def parse_qasm(code: str, language: str = 'openqasm3'):
    """
    Parse quantum code into a Qiskit QuantumCircuit.
    
    Args:
        code: Quantum source code as string
        language: Language format ('openqasm3' or 'quanta')
        
    Returns:
        QuantumCircuit object (or None if parser not available)
        
    Raises:
        CompilationError: If parsing fails with a syntax error
        
    Note:
        Returns None if the parser module is not available, allowing the
        executor to proceed with direct circuit building (regex-based parsing).
        This is a graceful degradation strategy.
    """
    if language == 'quanta':
        return parse_quanta(code)
    else:
        return parse_openqasm3(code)

def parse_openqasm3(code: str):
    """
    Parse OpenQASM 3 code into a Qiskit QuantumCircuit using qiskit.qasm3.loads.
    
    Args:
        code: OpenQASM 3 source code as string
        
    Returns:
        QuantumCircuit object (or None if parser not available)
        
    Raises:
        CompilationError: If parsing fails with a syntax error
    """
    if not QASM3_PARSER_AVAILABLE:
        # Parser not installed - return None to allow fallback to regex parsing
        return None
    
    try:
        # Use qiskit.qasm3.loads to parse OpenQASM 3 and get a QuantumCircuit
        circuit = qiskit.qasm3.loads(code)
        return circuit
    except Exception as e:
        # Raise CompilationError for parse failures so users get clear error messages
        raise CompilationError(f"Parse error: {str(e)}")

def parse_quanta(code: str):
    """
    Parse Quanta language code into a Qiskit QuantumCircuit.
    
    This function converts Quanta code to OpenQASM 3 using quanta.compile(),
    then parses the resulting QASM code to create a QuantumCircuit.
    
    Args:
        code: Quanta source code as string
        
    Returns:
        QuantumCircuit object (or None if parser not available)
        
    Raises:
        CompilationError: If parsing fails with a syntax error
    """
    if not QUANTA_PARSER_AVAILABLE:
        raise CompilationError(
            "Quanta parser not available. Please install quanta-lang: "
            "pip install quanta-lang"
        )
    
    if not QASM3_PARSER_AVAILABLE:
        raise CompilationError(
            "OpenQASM 3 parser not available. Quanta requires qiskit-qasm3-import "
            "to convert Quanta code to QASM. Please install qiskit-qasm3-import."
        )
    
    try:
        # Step 1: Preprocess code - normalize line endings and ensure proper formatting
        # Quanta might be sensitive to certain formatting issues
        normalized_code = code.replace('\r\n', '\n').replace('\r', '\n')
        
        # Step 2: Convert Quanta code to OpenQASM 3
        # The quanta.compile() function should accept a string and return OpenQASM 3 code
        qasm_code = quanta.compile(normalized_code)
        
        # Step 2: Parse the resulting OpenQASM 3 code to get QuantumCircuit
        circuit = parse_openqasm3(qasm_code)
        
        if circuit is None:
            raise CompilationError("Failed to parse Quanta-generated OpenQASM 3 code")
        
        return circuit
    except CompilationError:
        # Re-raise compilation errors as-is
        raise
    except AttributeError as e:
        # Handle case where quanta module doesn't have compile function
        raise CompilationError(
            f"Quanta module API error: {str(e)}. "
            "Please ensure quanta-lang is properly installed (pip install quanta-lang>=0.1.5)."
        )
    except Exception as e:
        # Get more detailed error information
        error_msg = str(e)
        error_type = type(e).__name__
        
        # Check if this is a parsing error from quanta.compile()
        # The error format "line,col: message" suggests it's from quanta's parser
        if "Undefined symbol" in error_msg or "undefined" in error_msg.lower():
            # Provide helpful guidance for gate definition issues
            raise CompilationError(
                f"Quanta parse error: {error_msg}\n\n"
                "Common causes:\n"
                "1. Gate parameter syntax: In Quanta, gate definitions use parameters as qubit arguments.\n"
                "   Example: gate Bell(a, b) { H(a); CNOT(a, b); }\n"
                "2. Ensure all variables are declared before use.\n"
                "3. Check that gate names match (case-sensitive: CNOT vs CNot).\n"
                "If the error persists, this may be a bug in quanta-lang. "
                "Try updating: pip install --upgrade quanta-lang"
            )
        
        # For other errors, provide the full error message
        raise CompilationError(f"Quanta compilation error ({error_type}): {error_msg}")
