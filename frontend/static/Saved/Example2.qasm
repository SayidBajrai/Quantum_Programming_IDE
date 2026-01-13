OPENQASM 3;
include "stdgates.inc";

qubit[3] q;
bit[3] c;

for int i in [0:3] {
    h q[i];                    // put all qubits in superposition
}

if (c[0] == 0) {
    cx q[0], q[1];
} else {
    x q[2];
}

for int j in [0:3] {
    measure q[j] -> c[j];
}