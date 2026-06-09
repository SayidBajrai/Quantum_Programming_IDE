// Quantum teleportation — transfer |ψ⟩ from q[0] to q[2]
OPENQASM 3;
include "stdgates.inc";

qubit[3] q;
bit[3] c;

// Prepare |ψ⟩ on q[0]
ry(pi / 3) q[0];

// Bell pair on q[1], q[2]
h q[1];
cx q[1], q[2];

// Bell measurement on q[0], q[1]
cx q[0], q[1];
h q[0];

measure q[0] -> c[0];
measure q[1] -> c[1];

// Corrections on q[2] based on classical bits
if (c[1] == 1) x q[2];
if (c[0] == 1) z q[2];

measure q[2] -> c[2];
