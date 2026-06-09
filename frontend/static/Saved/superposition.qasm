// Single-qubit superposition — expect ~50/50 on |0⟩ and |1⟩
OPENQASM 3;
include "stdgates.inc";

qubit[1] q;
bit[1] c;

h q[0];
measure q -> c;
