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
    try:
        if language == 'quanta':
            from compiler.quanta_helpers import run_quanta, QUANTA_AVAILABLE
            if not QUANTA_AVAILABLE:
                raise CompilationError(
                    "Quanta parser not available. Please install quanta-lang: "
                    "pip install quanta-lang"
                )
            try:
                result = run_quanta(code, shots=shots)
                counts = result.get("counts", {})
                num_qubits = 0
                if "num_qubits" in result:
                    num_qubits = result["num_qubits"]
                elif counts:
                    num_qubits = len(max(counts.keys(), key=len))
                return {
                    "counts": counts,
                    "qubits": num_qubits,
                    "shots": result.get("shots", shots),
                }
            except (RuntimeError, SimulationError):
                pass
            except Exception as e:
                from compiler.parser import QuantaError
                from compiler.quanta_helpers import quanta_error_to_dict
                if QuantaError is not None and isinstance(e, QuantaError):
                    info = quanta_error_to_dict(e)
                    raise CompilationError(info["error"]) from e
                if not isinstance(e, (ImportError, RuntimeError)):
                    raise

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
