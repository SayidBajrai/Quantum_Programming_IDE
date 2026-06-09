// OpenQASM 3 showcase — parameters, aliases, gate modifiers, control flow
OPENQASM 3.0;
include "stdgates.inc";

input float[64] angle;

qubit[3] q;
bit[2] mid;
bit[3] out;

let aliased = q[0:1];

gate my_gate(a) ctrl, tgt {
  gphase(a / 2);
  ry(a) ctrl;
  cx ctrl, tgt;
}

gate my_phase(a) target {
  inv @ gphase(a) target;
}

my_gate(angle * 2) aliased[0], q[{1, 2}][0];
measure q[0] -> mid[0];
measure q[1] -> mid[1];

while (mid == "00") {
  reset q[0];
  reset q[1];
  my_gate(angle) q[0], q[1];
  my_phase(angle - pi / 2) q[1];
  mid[0] = measure q[0];
  mid[1] = measure q[1];
}

if (mid[0]) {
  let inner_alias = q[{0, 1}];
  reset inner_alias;
}

out = measure q;
