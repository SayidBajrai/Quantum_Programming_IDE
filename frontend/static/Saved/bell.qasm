// Bell state — entangled |00⟩ + |11⟩
// Run with Ctrl+Enter · Circuit Diagram tab shows live preview
OPENQASM 3;
include "stdgates.inc";

qubit[2] q;
bit[2] c;

h q[0];
cx q[0], q[1];
measure q -> c;
