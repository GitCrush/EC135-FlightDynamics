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
pedal and cyclic, forward flight trimmed with T, keys on the ground.
Exit 1 on any ERROR.

`node test/scenarios.js A|B|C` is the scenario analysis: A yaw and pedal
physics, B cyclic and limit manoeuvres (blade stall, low g, Vne, quick
stop, autorotation landings), C the control laws in those manoeuvres. It
prints OK/CHECK per row with the expectation beside the value.
`test/tutor.js` now runs on the complete real code (`loadfull.js`), so
the reset hand-over it uses is the browser's.

`python3 test/uishot.py [name …]` renders the README screenshots into
`docs/screenshots/` (Playwright with Chromium; `pip install playwright` and
`playwright install chromium`). Without arguments it renders all of them.

`test/dev/` holds the development scratch scripts (traces, not suites).
