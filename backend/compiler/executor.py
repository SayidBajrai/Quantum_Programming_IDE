"""
Executor module - glue logic that orchestrates the compilation pipeline
"""
from compiler.parser import parse_qasm
from compiler.simulator import simulate_from_qasm_string, simulate
from utils.errors import CompilationError, SimulationError

def compile_and_simulate(code: str, shots: int = 1024, language: str = 'openqasm3'):
    """
    Complete compilation and simulation pipeline
    
    Pipeline:
    1. Parse quantum code (OpenQASM 3 or Quanta) to QuantumCircuit (if parser available)
    2. Simulate and return results
    
    Args:
        code: Quantum source code (OpenQASM 3 or Quanta)
        shots: Number of simulation shots
        language: Language format ('openqasm3' or 'quanta')
        
    Returns:
        Dictionary with:
        - counts: Measurement results
        - qubits: Number of qubits
        - shots: Number of shots used
    """
    # Step 1: Parse using appropriate parser
    # For OpenQASM 3: uses qiskit-qasm3-import
    # For Quanta: uses quanta-lang
    try:
        circuit = parse_qasm(code, language=language)
        
        # If parser is not available, parse_qasm returns None
        if circuit is None:
            if language == 'quanta':
                raise CompilationError(
                    "Quanta parser not available. Please install quanta-lang: "
                    "pip install quanta-lang"
                )
            else:
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
        lang_name = 'Quanta' if language == 'quanta' else 'OpenQASM 3'
        raise CompilationError(f"Failed to parse {lang_name} code: {str(e)}")
