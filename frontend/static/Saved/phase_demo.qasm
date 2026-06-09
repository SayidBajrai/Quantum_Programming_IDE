// Parameterized rotations — download circuit diagram as PNG
OPENQASM 3;
include "stdgates.inc";

qubit[2] q;
bit[2] c;

rx(pi / 4) q[0];
ry(pi / 3) q[0];
rz(pi / 6) q[1];
cx q[0], q[1];
measure q -> c;
