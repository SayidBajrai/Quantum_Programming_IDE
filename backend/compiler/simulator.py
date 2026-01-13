"""
Quantum simulator module
Converts AST to Qiskit QuantumCircuit and runs simulation
"""
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
from qiskit import transpile
from utils.errors import SimulationError
import openqasm3
import re

def convert_qasm3_to_qasm2(qasm3_code: str) -> str:
    """
    Convert OpenQASM 3 code to OpenQASM 2.0 compatible format
    This is a simplified converter for basic operations
    
    Args:
        qasm3_code: OpenQASM 3 source code
        
    Returns:
        OpenQASM 2.0 compatible code
    """
    # Basic conversions:
    # - OPENQASM 3; -> OPENQASM 2.0;
    # - qubit[2] q; -> qreg q[2];
    # - bit[2] c; -> creg c[2];
    # - measure q -> c; -> expanded to individual measurements
    # - Remove include "stdgates.inc"; (Qiskit has built-in gates)
    
    qasm2_code = qasm3_code
    
    # Track register sizes for measurement expansion
    register_sizes = {}
    
    # Extract register sizes from declarations
    qubit_matches = re.finditer(r'qubit\[(\d+)\]\s+(\w+)\s*;', qasm2_code)
    for match in qubit_matches:
        size = int(match.group(1))
        name = match.group(2)
        register_sizes[name] = size
    
    bit_matches = re.finditer(r'\bbit\[(\d+)\]\s+(\w+)\s*;', qasm2_code)
    for match in bit_matches:
        size = int(match.group(1))
        name = match.group(2)
        register_sizes[name] = size
    
    # Remove include statements (Qiskit has built-in standard gates)
    # This handles both include "stdgates.inc"; and include 'stdgates.inc';
    qasm2_code = re.sub(r'include\s+["\']stdgates\.inc["\']\s*;', '', qasm2_code, flags=re.IGNORECASE)
    
    # Replace OPENQASM 3 header
    qasm2_code = re.sub(r'OPENQASM\s+3\s*;', 'OPENQASM 2.0;', qasm2_code, flags=re.IGNORECASE)
    
    # Convert qubit declarations: qubit[2] q; -> qreg q[2];
    def replace_qubit_decl(match):
        size = match.group(1)
        name = match.group(2)
        return f'qreg {name}[{size}];'
    qasm2_code = re.sub(r'qubit\[(\d+)\]\s+(\w+)\s*;', replace_qubit_decl, qasm2_code)
    
    # Convert bit declarations: bit[2] c; -> creg c[2];
    # Use word boundary to avoid matching "bit" in "qubit"
    def replace_bit_decl(match):
        size = match.group(1)
        name = match.group(2)
        return f'creg {name}[{size}];'
    qasm2_code = re.sub(r'\bbit\[(\d+)\]\s+(\w+)\s*;', replace_bit_decl, qasm2_code)
    
    # Convert measurement syntax
    # OpenQASM 3: measure q -> c; (can measure entire register)
    # OpenQASM 2.0: measure q[i] -> c[i]; (must specify indices)
    def expand_measurement(match):
        qreg = match.group(1)
        creg = match.group(2)
        
        # Check if this is a register-to-register measurement
        # (no indices specified)
        if qreg in register_sizes:
            size = register_sizes[qreg]
            # Expand to individual measurements
            measurements = []
            for i in range(size):
                measurements.append(f'measure {qreg}[{i}] -> {creg}[{i}];')
            return '\n'.join(measurements)
        else:
            # Already has indices, keep as-is
            return f'measure {qreg} -> {creg};'
    
    # Handle register-to-register measurements (measure q -> c;)
    # Pattern: measure <register_name> -> <register_name>;
    qasm2_code = re.sub(r'measure\s+(\w+)\s*->\s*(\w+)\s*;', expand_measurement, qasm2_code)
    
    # Clean up extra blank lines
    qasm2_code = re.sub(r'\n\s*\n\s*\n', '\n\n', qasm2_code)
    
    return qasm2_code

def simulate(circuit: QuantumCircuit, shots: int = 1024):
    """
    Simulate quantum circuit and return measurement results
    
    Args:
        circuit: Qiskit QuantumCircuit
        shots: Number of simulation shots
        
    Returns:
        Dictionary of measurement counts
    """
    try:
        # Check if circuit has measurements
        if not circuit.num_clbits > 0 or len(circuit.data) == 0:
            raise SimulationError("Circuit has no measurements. Add measurement operations before simulating.")
        
        # Check if there are any measurement operations
        has_measurements = any(instruction.operation.name == 'measure' for instruction in circuit.data)
        if not has_measurements:
            raise SimulationError("Circuit has no measurement operations. Add 'measure' statements before simulating.")
        
        sim = AerSimulator()
        
        # Check if circuit has parameters that need to be bound
        if circuit.parameters:
            # Bind default values for parameters before transpilation
            # Use pi/2 as default (common in quantum gates like ry, rz)
            import math
            from qiskit.circuit import Parameter
            parameter_binds = {}
            for param in circuit.parameters:
                # Use pi/2 as a reasonable default for quantum gate parameters
                parameter_binds[param] = math.pi / 2.0
            # Bind parameters to the circuit
            circuit = circuit.assign_parameters(parameter_binds)
        
        # Transpile for the simulator
        transpiled_circuit = transpile(circuit, sim)
        # Run simulation
        job = sim.run(transpiled_circuit, shots=shots)
        
        result = job.result()
        counts = result.get_counts()
        
        if not counts:
            raise SimulationError("Simulation completed but returned no counts. Check that measurements are properly configured.")
        
        return counts
    except SimulationError:
        raise
    except Exception as e:
        raise SimulationError(f"Simulation failed: {str(e)}")

def build_circuit_from_qasm3(qasm_code: str) -> QuantumCircuit:
    """
    Build a Qiskit QuantumCircuit directly from OpenQASM 3 code
    This avoids QASM parsing issues by building the circuit programmatically
    
    Args:
        qasm_code: OpenQASM 3 source code
        
    Returns:
        QuantumCircuit object
    """
    from qiskit import QuantumCircuit
    import re
    
    # Parse register declarations
    qubit_registers = {}
    bit_registers = {}
    
    # Extract qubit registers: qubit[2] q;
    # Use word boundary to ensure we match "qubit" not just "bit"
    qubit_matches = re.finditer(r'\bqubit\[(\d+)\]\s+(\w+)\s*;', qasm_code)
    total_qubits = 0
    for match in qubit_matches:
        size = int(match.group(1))
        name = match.group(2)
        qubit_registers[name] = (total_qubits, size)
        total_qubits += size
    
    # Extract bit registers: bit[2] c;
    # Use word boundary to avoid matching "bit" in "qubit"
    bit_matches = re.finditer(r'\bbit\[(\d+)\]\s+(\w+)\s*;', qasm_code)
    total_bits = 0
    for match in bit_matches:
        size = int(match.group(1))
        name = match.group(2)
        bit_registers[name] = (total_bits, size)
        total_bits += size
    
    # Create circuit
    circuit = QuantumCircuit(total_qubits, total_bits)
    
    # Map of standard gates to Qiskit methods
    gate_map = {
        'h': circuit.h,
        'x': circuit.x,
        'y': circuit.y,
        'z': circuit.z,
        's': circuit.s,
        'sdg': circuit.sdg,
        't': circuit.t,
        'tdg': circuit.tdg,
        'cx': circuit.cx,
        'cy': circuit.cy,
        'cz': circuit.cz,
        'ch': circuit.ch,
        'swap': circuit.swap,
        'ccx': circuit.ccx,  # Toffoli
        'cswap': circuit.cswap,  # Fredkin
    }
    
    # Parse gate operations
    # Handle multi-line constructs (loops, conditionals) by processing the entire code
    # For now, we'll expand simple loops and skip complex conditionals
    
    # First, expand simple for loops: for int i in [0:3] { ... }
    expanded_code = qasm_code
    
    # Helper function to find matching brace
    def find_matching_brace(text, start_pos):
        depth = 0
        pos = start_pos
        while pos < len(text):
            if text[pos] == '{':
                depth += 1
            elif text[pos] == '}':
                depth -= 1
                if depth == 0:
                    return pos
            pos += 1
        return -1
    
    # Expand for loops iteratively
    max_iterations = 10  # Prevent infinite loops
    iteration = 0
    while iteration < max_iterations:
        loop_match = re.search(r'for\s+int\s+(\w+)\s+in\s+\[(\d+):(\d+)\]\s*\{', expanded_code)
        if not loop_match:
            break
        
        var_name = loop_match.group(1)
        start = int(loop_match.group(2))
        end = int(loop_match.group(3))
        brace_start = loop_match.end() - 1  # Position of opening brace
        brace_end = find_matching_brace(expanded_code, brace_start)
        
        if brace_end == -1:
            break  # No matching brace found
        
        loop_body = expanded_code[brace_start + 1:brace_end]
        loop_full = expanded_code[loop_match.start():brace_end + 1]
        
        # Expand the loop
        expanded_lines = []
        for i in range(start, end):
            # Replace loop variable with actual index in the body
            expanded_body = re.sub(r'\b' + var_name + r'\b', str(i), loop_body)
            expanded_lines.append(expanded_body)
        
        # Replace the loop with expanded code
        expanded_code = expanded_code[:loop_match.start()] + '\n'.join(expanded_lines) + expanded_code[brace_end + 1:]
        iteration += 1
    
    # Remove conditionals for now (they require classical register values which we don't have at build time)
    # Replace if-else blocks with a comment explaining why
    iteration = 0
    while iteration < max_iterations:
        if_match = re.search(r'if\s*\([^)]+\)\s*\{', expanded_code)
        if not if_match:
            break
        
        brace_start = if_match.end() - 1
        brace_end = find_matching_brace(expanded_code, brace_start)
        if brace_end == -1:
            break
        
        # Check for else clause
        after_if = expanded_code[brace_end + 1:].strip()
        else_match = re.match(r'else\s*\{', after_if)
        if else_match:
            else_brace_start = brace_end + 1 + else_match.end() - 1
            else_brace_end = find_matching_brace(expanded_code, else_brace_start)
            if else_brace_end != -1:
                # Replace entire if-else block
                expanded_code = (expanded_code[:if_match.start()] + 
                                '// Conditional statement skipped (requires runtime classical values)\n' +
                                expanded_code[else_brace_end + 1:])
            else:
                break
        else:
            # Just if, no else
            expanded_code = (expanded_code[:if_match.start()] + 
                            '// Conditional statement skipped (requires runtime classical values)\n' +
                            expanded_code[brace_end + 1:])
        iteration += 1
    
    # Now parse the expanded code
    lines = expanded_code.split('\n')
    for line in lines:
        line = line.strip()
        # Skip comments and empty lines
        if not line or line.startswith('//') or line.startswith('OPENQASM') or line.startswith('include'):
            continue
        
        # Skip declarations (already handled)
        if 'qubit[' in line or 'bit[' in line:
            continue
        
        # Skip conditional comments
        if 'Conditional statements' in line:
            continue
        
        # Parse measurements FIRST (before gate calls)
        # This prevents "measure" from being treated as a gate name
        # Handle both formats:
        # 1. measure q -> c; (register-to-register)
        # 2. measure q[0] -> c[0]; (individual qubit measurements after loop expansion)
        
        # Try register-to-register format first
        measure_match = re.match(r'measure\s+(\w+)\s*->\s*(\w+)\s*;', line)
        if measure_match:
            qreg_name = measure_match.group(1)
            creg_name = measure_match.group(2)
            
            if qreg_name in qubit_registers and creg_name in bit_registers:
                q_start, q_size = qubit_registers[qreg_name]
                c_start, c_size = bit_registers[creg_name]
                
                if q_size != c_size:
                    raise SimulationError(f"Register size mismatch: {qreg_name}[{q_size}] -> {creg_name}[{c_size}]")
                
                # Add measurements for each qubit
                for i in range(q_size):
                    circuit.measure(q_start + i, c_start + i)
            else:
                raise SimulationError(f"Unknown registers in measurement: {qreg_name} -> {creg_name}")
            continue  # Skip to next line after handling measurement
        
        # Try individual qubit measurement format (after loop expansion)
        measure_individual_match = re.match(r'measure\s+(\w+)\[(\d+)\]\s*->\s*(\w+)\[(\d+)\]\s*;', line)
        if measure_individual_match:
            qreg_name = measure_individual_match.group(1)
            q_index = int(measure_individual_match.group(2))
            creg_name = measure_individual_match.group(3)
            c_index = int(measure_individual_match.group(4))
            
            if qreg_name in qubit_registers and creg_name in bit_registers:
                q_start, q_size = qubit_registers[qreg_name]
                c_start, c_size = bit_registers[creg_name]
                
                if q_index >= q_size:
                    raise SimulationError(f"Qubit index {q_index} out of range for register {qreg_name}[{q_size}]")
                if c_index >= c_size:
                    raise SimulationError(f"Bit index {c_index} out of range for register {creg_name}[{c_size}]")
                
                # Add single measurement
                circuit.measure(q_start + q_index, c_start + c_index)
            else:
                raise SimulationError(f"Unknown registers in measurement: {qreg_name}[{q_index}] -> {creg_name}[{c_index}]")
            continue  # Skip to next line after handling measurement
        
        # Parse gate calls: h q[0]; or cx q[0], q[1];
        # Only match if it's not a measurement statement
        gate_match = re.match(r'(\w+)\s+(.+?)\s*;', line)
        if gate_match:
            gate_name = gate_match.group(1)
            args_str = gate_match.group(2)
            
            # Skip if this is a measurement (shouldn't happen due to check above, but safety check)
            if gate_name == 'measure':
                continue
            
            # Parse arguments
            args = [arg.strip() for arg in args_str.split(',')]
            qubit_indices = []
            
            for arg in args:
                # Parse q[0] or q[1] format (now with numeric indices after loop expansion)
                reg_match = re.match(r'(\w+)\[(\d+)\]', arg)
                if reg_match:
                    reg_name = reg_match.group(1)
                    index = int(reg_match.group(2))
                    
                    if reg_name in qubit_registers:
                        start_idx, size = qubit_registers[reg_name]
                        if index >= size:
                            raise SimulationError(f"Qubit index {index} out of range for register {reg_name}[{size}]")
                        qubit_indices.append(start_idx + index)
                    else:
                        raise SimulationError(f"Unknown register: {reg_name}")
                else:
                    # If we can't parse the argument, it might be a variable that wasn't expanded
                    raise SimulationError(f"Unable to parse gate argument: {arg}. Loops and conditionals may not be fully supported.")
            
            # Apply gate
            if gate_name in gate_map:
                gate_func = gate_map[gate_name]
                try:
                    gate_func(*qubit_indices)
                except Exception as e:
                    raise SimulationError(f"Error applying gate {gate_name}: {str(e)}")
            else:
                raise SimulationError(f"Unsupported gate: {gate_name}")
    
    return circuit

def simulate_from_qasm_string(qasm_code: str, shots: int = 1024):
    """
    Simulate directly from OpenQASM 3 string
    
    Args:
        qasm_code: OpenQASM 3 source code
        shots: Number of simulation shots
        
    Returns:
        Dictionary of measurement counts and circuit info
    """
    try:
        # Try building circuit directly from OpenQASM 3
        # This is more robust than converting to QASM 2.0
        circuit = build_circuit_from_qasm3(qasm_code)
        
        # Run simulation
        counts = simulate(circuit, shots)
        
        # Get number of qubits
        num_qubits = circuit.num_qubits
        
        return {
            "counts": counts,
            "qubits": num_qubits,
            "shots": shots
        }
    except SimulationError:
        raise
    except Exception as e:
        # Fallback: try QASM 2.0 conversion
        try:
            qasm2_code = convert_qasm3_to_qasm2(qasm_code)
            circuit = QuantumCircuit.from_qasm_str(qasm2_code)
            counts = simulate(circuit, shots)
            return {
                "counts": counts,
                "qubits": circuit.num_qubits,
                "shots": shots
            }
        except Exception as e2:
            raise SimulationError(f"Failed to simulate from QASM: {str(e2)}")
