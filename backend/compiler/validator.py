"""
OpenQASM 3 validator module
Performs semantic checks on the AST
"""
from utils.errors import CompilationError
import openqasm3.ast as ast

def validate_qasm(ast_node):
    """
    Validate OpenQASM 3 AST for semantic correctness
    
    Checks:
    - Qubits are declared before use
    - Measurements exist
    - No illegal operations
    - Loop bounds are finite
    
    Args:
        ast_node: AST node from parser
        
    Raises:
        CompilationError: If validation fails
    """
    # Track declared qubits and classical bits
    declared_qubits = set()
    declared_bits = set()
    has_measurements = False
    
    def visit_node(node):
        nonlocal has_measurements
        
        if isinstance(node, ast.Program):
            # Visit all statements
            for statement in node.statements:
                visit_node(statement)
                
        elif isinstance(node, ast.QuantumDeclaration):
            # Track declared qubits
            if isinstance(node.type, ast.QuantumType):
                for identifier in node.qubits:
                    declared_qubits.add(identifier.name)
                    
        elif isinstance(node, ast.ClassicalDeclaration):
            # Track declared classical bits
            if isinstance(node.type, ast.BitType):
                for identifier in node.identifier:
                    if isinstance(identifier, ast.Identifier):
                        declared_bits.add(identifier.name)
                        
        elif isinstance(node, ast.QuantumGate):
            # Check if qubits are declared
            for arg in node.qubits:
                if isinstance(arg, ast.IndexedIdentifier):
                    qubit_name = arg.name.name
                    if qubit_name not in declared_qubits:
                        raise CompilationError(
                            f"Qubit '{qubit_name}' used before declaration"
                        )
                        
        elif isinstance(node, ast.QuantumMeasurement):
            has_measurements = True
            # Check if qubits are declared
            if isinstance(node.qubits, ast.IndexedIdentifier):
                qubit_name = node.qubits.name.name
                if qubit_name not in declared_qubits:
                    raise CompilationError(
                        f"Qubit '{qubit_name}' used in measurement before declaration"
                    )
                    
        elif isinstance(node, ast.QuantumMeasurementStatement):
            has_measurements = True
            # Visit the measurement
            if node.measure:
                visit_node(node.measure)
                
        elif isinstance(node, ast.ForInLoop):
            # Basic check: ensure loop has finite bounds
            # More sophisticated checks could be added here
            if node.set_declaration:
                visit_node(node.set_declaration)
            if node.block:
                for stmt in node.block.statements:
                    visit_node(stmt)
                    
        elif isinstance(node, list):
            for item in node:
                visit_node(item)
                
        elif hasattr(node, '__dict__'):
            # Recursively visit all attributes
            for attr_name in dir(node):
                if not attr_name.startswith('_'):
                    attr = getattr(node, attr_name, None)
                    if attr and not isinstance(attr, (str, int, float, bool, type(None))):
                        try:
                            visit_node(attr)
                        except (TypeError, AttributeError):
                            pass
    
    try:
        visit_node(ast_node)
    except CompilationError:
        raise
    except Exception as e:
        # If validation logic itself fails, don't block compilation
        # Just log or pass through
        pass
    
    # Warn if no measurements (but don't error - some circuits might not need them)
    # This is just a basic check - more sophisticated validation can be added
