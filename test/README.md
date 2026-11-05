# Tests

`node test/consistency.js` flies the model through reference conditions
(hover trim, free response, governor step, ground effect, power curve,
climb, autorotation, vortex ring state and recovery, control response, OEI,
ground handling incl. dynamic rollover, determinism, invariants) and
compares with flight-manual / textbook ranges. Exit code 1 on any ERROR.
`V=1` prints the power-curve points.

`test/load.js` loads `src/00..70` into a Node vm with DOM stubs; the same
files go into `index.html`, so the harness runs the browser's physics.

Scratch scripts: `hover.js` (trimmed hover trace), `gov.js` (governor step),
`scratch.js <free|lat|lon|ped|cruise|climb|auto|oei|ge|vrs|ground>`,
`disc.js` (isolated rotor: disc tilt per cyclic), `osc.js` (loop isolation).

`python3 test/browser.py` opens the built page in headless Chromium
(playwright, SwiftShader WebGL), takes off with the keyboard and writes
screenshots to `docs/`.

`node test/tutor.js` runs every tutor lesson with an ideal student (simple
controllers on the axes the lesson hands over) and fails if a step cannot
be passed within its time limit.

`node test/controls.js` prints the open-loop control response audit (per
10 % of control from a trimmed hover, SAS off), the gearing, the lag and
the trims at 60 and 100 kt.

`node test/acah.js` hands over a trimmed hover and lets go: how fast the
attitude-command hover drifts, hands off, after a nudge, and in wind.

`node test/yaw.js <seconds>` holds the right pedal key for that long from a
trimmed hover and reports peak rate, run-on and swing-back.

`node test/handling.js` is the audit of the human control path. It loads
every module including the browser input code (`test/loadfull.js`, DOM
stubs) and drives it like a person: cyclic and pedal keys held and tapped,
collective keys, a lift-off from the pad, the trim keys, every aid switched
off and on in flight, the autopilot demonstration handed back, a tutor axis
handed over while the mouse was moved, full stick held for 8 s, a gamepad
pedal and cyclic, forward flight trimmed with T, keys on the ground, the
autopilot on single controls (U I O: what it holds, what stays the
pilot's, bumpless hand-back) and its menu (presets, nudged targets,
refused during a lesson).
Exit 1 on any ERROR.

`node test/scenarios.js A|B|C|D|E` is the scenario analysis: A yaw and pedal
physics, B cyclic and limit manoeuvres (blade stall, low g, Vne, quick
stop, autorotation landings), C the control laws in those manoeuvres, D
main and tail rotor at the power limit, E hover and cruise modes and the
vortex-ring recoveries. Winds are given at the aircraft's height. It
prints OK/CHECK per row with the expectation beside the value.
`test/tutor.js` now runs on the complete real code (`loadfull.js`), so
the reset hand-over it uses is the browser's.

`python3 test/uishot.py [name …]` renders the README screenshots into
`docs/screenshots/` (Playwright with Chromium; `pip install playwright` and
`playwright install chromium`). Without arguments it renders all of them.

`node test/qualities.js` (since 1.8) separates what the other suites mix:

| Tag | Meaning |
|---|---|
| VAL | compared with a published figure the model was **not** tuned to |
| CAL | a published figure a parameter was fitted to (agreement is by construction) |
| PHY | a law of physics or an internal consistency (sign, symmetry, energy) |
| REG | a golden value from `test/golden.json`, to catch unintended change |
| KNOWN | an open deviation from a published figure, with the bound it must stay in |

Sections: the rotor in isolation (thrust follows the tip-path plane, inflow
gradients point to the lifting side, roll/pitch damping symmetric),
linear modes in the hover and at 100 kt (quasi-static linearisation and
eigenvalues, `test/lib/linear.js`), ADS-33 attitude bandwidth and phase
delay at 75 kt by sine dwells against the published EC135 values, hover
ceilings, climb and cruise against published figures, physical laws
(mass exponent, autorotation energy balance), the findings of the 1.8
flight test (Fenestron share of the anti-torque in balanced cruise, the
autorotation pedal, rotor speed after a double engine failure at 40 kt,
retreating-blade stall onset, vortex-ring roughness), the training aids'
mixing against the physics, and the limits of the type certificate. `--fast`
skips the frequency sweeps; `--update` rewrites the golden values.

`node test/mutation.js` breaks the model on purpose (a sign, a missing
term, a doubled inertia; 33 mutants) through the `EC135_PATCH` hook of the
loaders (`test/lib/patch.js`) and runs `qualities --fast` and
`consistency` against each. A mutant that no suite catches marks a blind
spot. `--quick` runs qualities only, `--only=3,7` selected mutants.

`node flighttest/pilot.js [ids]` flies the frozen cards of the simulated
flight test (`flighttest/plan.json`, `flighttest/cards.json`) and writes the
recordings to `flighttest/results/` (thrust and engine power as
one-revolution averages, since 1.9); `node flighttest/report.js` rebuilds
`flighttest/report.html` from them and the evaluator's `verdicts.json`.

`test/dev/` holds the development scratch scripts (traces, not suites).

`node test/stress.js [S1 … S21]` (2.16.6) flies what the scenario suite
does not: sharp-edged gusts, sideward and rearward flight at the edge, the
collective snapped up and dumped at Vne, overpitching on one engine, both
engines failing in the high hover, a 60° turn, a zoom into a tail slide,
an aileron roll, a loop (pitch through ±90°), negative g, touchdowns with
drift (dynamic rollover), hard landings, a run-on landing, random inputs,
the energy balance in autorotation and the airspeed in a vertical descent.
Each row: the measurement, what physics or the limits lead one to expect,
OK / CHECK / INFO. About 5 minutes.
