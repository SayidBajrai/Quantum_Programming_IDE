"""
Executor module - glue logic that orchestrates the compilation pipeline
"""
from compiler.parser import parse_qasm
from compiler.simulator import simulate_from_qasm_string, simulate
from utils.errors import CompilationError, SimulationError

def compile_and_simulate(code: str, shots: int = 1024):
    """
    Complete compilation and simulation pipeline
    
    Pipeline:
    1. Parse OpenQASM 3 code to QuantumCircuit (if parser available)
    2. Simulate and return results
    
    Args:
        code: OpenQASM 3 source code
        shots: Number of simulation shots
        
    Returns:
        Dictionary with:
        - counts: Measurement results
        - qubits: Number of qubits
        - shots: Number of shots used
    """
    # Step 1: Parse using qiskit-qasm3-import
    # According to https://pypi.org/project/qiskit-qasm3-import/, this package
    # supports the full OpenQASM 3.0 specification including:
    # - input parameters
    # - while loops
    # - if statements with classical control
    # - custom gates
    # - gate modifiers
    try:
        circuit = parse_qasm(code)
        
        # If parser is not available, parse_qasm returns None
        if circuit is None:
            raise CompilationError(
                "OpenQASM 3 parser not available. Please install qiskit-qasm3-import: "
                "pip install qiskit-qasm3-import"
            )
        
        # Simulate the parsed circuit
        try:
            counts = simulate(circuit, shots)
            return {
                "counts": counts,
                "qubits": circuit.num_qubits,
                "shots": shots
            }
        except SimulationError:
            raise
        except Exception as e:
            raise SimulationError(f"Simulation failed: {str(e)}")
            
    except CompilationError:
        # Re-raise compilation errors (parse errors, etc.)
        raise
    except Exception as e:
        # Wrap any other errors as CompilationError
        raise CompilationError(f"Failed to parse OpenQASM 3 code: {str(e)}")
