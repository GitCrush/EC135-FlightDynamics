# EC135 Flight Dynamics — technical notes

The detailed companion to the [README](../README.md): model tables, the
calibration against the published data, the control-response audit, the
scenario analysis, the scene, the tutor and the coach. Figures are from the
test suites in [`test/`](../test).

Built on the same idea as
[Grenzbereich](https://github.com/GitCrush/grenzbereich): textbook physics with
every mechanism justified in the code, measured against published numbers,
and instruments that make the limit legible while you are inside it.
Aircraft: Airbus/Eurocopter EC135 P2+ — bearingless four-blade main rotor,
Fenestron, two turbines with FADEC, clockwise rotor (right pedal with power).


## What the model does

| Part | Model |
|---|---|
| Main rotor | Blade element per blade, time-marching at 360 Hz (55 steps per revolution). Each blade is a rigid beam on an offset flap hinge with a spring, flap frequency ratio 1.10 as for a bearingless rotor. The flap equation is derived from the Euler equation of the blade with the hub rotating at body rates (Coriolis terms), so rotor damping, the control phase (~74°) and the cross-coupling off nominal rotor speed all follow from the same loop. Section model with Mach-dependent stall and drag divergence; tip loss. |
| Inflow | Pitt-Peters dynamic inflow: uniform state with apparent mass, Glauert skew gradient, moment-driven gradient states. Vortex-ring region from the Leishman empirical curve with seeded unsteadiness; Cheeseman-Bennett ground effect. |
| Fenestron | Ducted-fan momentum theory (fan carries about half the static thrust, the shroud the rest, augmentation fades in forward flight), three blade elements with stall, inflow lag. |
| Engines | Two turbines as power lags with acceleration limits, FADEC PI governor with load feedforward referred to nominal NR, engine and gearbox ratings (MCP / TOP / OEI 30 s), freewheel, FLI. Start sequence (starter, run-up torque schedule) and shutdown; fuel burn comes off the mass. |
| Airframe | Drag areas by axis, unstable fuselage pitch/yaw moments, rotor download, stabiliser with the rotor-wake hump through transition, cambered fin and end plates. |
| Ground | Four skid contact points plus tail bumper, spring-damper on the terrain normal, anisotropic friction (skids slide forward, dig in sideways). Dynamic rollover, blade strike and tail strike are consequences, not scripts. |
| Environment | ISA with temperature offset (density altitude), wind with boundary layer, Dryden-like turbulence, gusts. Terrain from a deterministic value noise with a lake, a ridge on the horizon, a slope mound, a confined area in a tree ring and a hospital rooftop pad 22 m up; the physics and the renderer read the same height function, so a skid on a roof edge falls off it. |

Aircraft data (`src/20_heli.js`) comes from the sources listed below where
public; the remaining estimates are marked as such in the code and are the
first things to revisit when the harness disagrees with the flight manual.

## Measured (harness, 2500 kg, ISA)

| Quantity | Model | Reference / expectation |
|---|---|---|
| Hover power OGE, 1000 ft | 433 kW, FLI 6.8 | ~55–65 % torque at this weight |
| Hover blade pitch (0.75 R) | 8.8° | 8–10° from C_T/σ = 0.076 |
| Hover pedal / attitude | 40 % right, +4° right skid low | right pedal, right-skid-low (clockwise rotor) |
| Hover in 25 kt crosswind from the left | 44 % right pedal, Fenestron 33 % stalled | left crosswind is the critical side for a Fenestron behind a clockwise rotor |
| Power IGE at skid height | −10 % | Cheeseman-Bennett, 10–18 % |
| Minimum power speed | 60 kt, 263 kW | bucket 55–70 kt |
| 135 kt | 595 kW | max cruise near MCP (640 kW gearbox) |
| 140 kt at MTOW 2910 kg | 671 kW, 74 % forward cyclic | 137 kt at MCP, Vne 155 kt |
| Climb at Vy, TOP | 2300 fpm | 1500 fpm at MTOW → ~2000 at 2500 kg (estimate) |
| Autorotation 65 kt, collective full down | 2200 fpm, NR 104 % | 1700–2200 fpm, NR near the top of the band |
| Cold start to 100 % NR / rotor stop | 70 s / 70 s | about a minute each |
| Overpitch (full collective in 1 s) | FLI 10.9 held, NR bleeds to 88 % | engines at the limit while NR droops |
| Vortex ring | detected at 1600 fpm vertical, cleared with 20 kt forward | |
| OEI in hover | held, NR min 98 % | Cat A performance class |
| Roll rate, +20 % lateral | 20 °/s | crisp hingeless response |
| Yaw rate, +50 % pedal | 128 °/s after 2 s | agile in yaw |
| Hover free response | 5° pitch excursion after ~15 s | slowly unstable |

Run `npm test` (`node test/consistency.js && node test/tutor.js && node
test/handling.js`) for the full list; it exits 1 on any ERROR. The first two
suites check the physics and the lessons through the autopilot and an ideal
student who sets the controls directly; `test/handling.js` checks what a
human uses: keys, mouse and gamepad through the input models and control
laws, looking for jumps, swing-back, overshoot, asymmetry, wind-up and bad
hand-overs (it was added after a pedal swing-back the first two could not
see).

## Sources and calibration

Aircraft data that is public comes from Kampa, Enenkl, Polz, Roth
(Eurocopter Deutschland), *Aeromechanic Aspects in the Design of the
EC135*, 23rd European Rotorcraft Forum, Dresden 1997 (ERF archive), and
the model form follows Seher-Weiß, *ACT/FHS System Identification
Including Rotor and Engine Dynamics*, J. AHS 64, 2019 (DLR elib). From the
1997 paper the model takes:

| Quantity | Paper | Model |
|---|---|---|
| Rotor moment capacity | ~2000 Nm per degree of cyclic flapping (8.7 % equivalent hinge offset, no spring) | hinge offset 8.7 %, 32 kg blade, no spring → 115 kNm/rad |
| Blade twist | 10° root to tip | −10° linear |
| Flap/pitch coupling δ3 | +7.5° | +7.5° |
| Cyclic ranges | lateral 15°, longitudinal 21.8° total | ±7.5°, +12.6°/−9.2° |
| Stick travel | 160 mm lateral, 215 mm longitudinal | mouse default 1600 px for full stick |
| Pitch / roll bandwidth (75 kt) | 1.84 / 3.7 rad/s | pitch damping −1.7 /s gives 1.8 rad/s; roll sensitivity ~2.7 1/(s² inch) with Ixx 2400 |
| Stabiliser | 2.6 m × 0.52 m, inverted GA(W)-1 with Gurney flaps, end plates 0.36 m², fin 0.9 m² | 1.35 m², a = 4.5, end plates 0.36 m², fin 1.0 m² |
| Fenestron | 1.0 m, 10 blades, chord 0.05 m, tip speed 188 m/s | as given; pedal gearing −10°..+40° |
| Main rotor | R 5.1 m, chord 0.288 m, tip speed 211 m/s | as given |
| Ratings (1997 version) | MCP 2×283 kW, TOP 2×308 kW, OEI 2.5 min 410 kW | P2+ ratings kept higher (estimate) |
| Performance (1997, 2630 kg) | 141 kt cruise, Vne 155 kt, HIGE/HOGE 4300/3700 m | see the measured table |

Still estimates: inertias, fuselage drag areas, the forward/aft split of
the longitudinal range, the P2+ gearbox limits, the Fenestron duct factor.

## Scenario analysis

`node test/scenarios.js A|B|C` checks signs and magnitudes in normal and
limit manoeuvres, and what the aids do there.

A — yaw and pedals: Fenestron power rises in a right pedal turn and falls in
a left one (the yaw changes the fan inflow); full right pedal gives 66 °/s
after 1 s and stalls a third of the fan; full left pedal drives the
Fenestron thrust to nearly zero, so the whole rotor torque (8.5 kNm) yaws
the aircraft, damped only by the fin and the tail boom dragged sideways
(108 °/s after 1 s); +10 % collective yaws the nose left, a total engine
failure yaws it right at about 100 °/s with the pedals still; autorotation
needs less right pedal than powered flight at the same speed; the
smallest pedal margin in a hover is with the wind from the left (56 % at
17 kt, 15 % at 30 kt); in cruise, right pedal gives sideslip from the left,
a roll to the right (dihedral effect) and a weathercock return.

B — cyclic and limit manoeuvres: positive speed stability; pitch–roll
coupling 30–40 %; retreating blade stall at 140 kt and 1.8 g pitches the
nose up and rolls the aircraft to the right, the retreating side of a
clockwise rotor; at 0.16 g the hingeless rotor keeps full roll control;
Vne reached in a shallow descent with 10 % forward stick left and an
advancing tip Mach of 0.82; a quick stop with the pedals held still yaws
left at 63 °/s as the fin unloads and the power comes in (with the feet
working the heading holds, the deceleration follows g·tan of the pitch);
an autorotation flared at 120 ft lands at 282 fpm with NR peaking at 109 %;
total power loss in a 3 m hover cushions to 339 fpm.

C — the aids in those manoeuvres: the attitude command reaches 34° pitch
and 43° bank (cubic shaping: 1.5° per 10 % near the centre); at 100 kt
the yaw axis coordinates the turn (bank 41°, ball near the centre) and the
roll axis holds the heading when the stick is centred; a change from
cruise to take-off power gives under 3° sideslip; the keys reach the
30-second OEI rating; with the engines out the collective key throws the
lever (0.3 s) and NR stays at 87 %; the coach names the rotor limit first.

## Control response (audit)

`node test/controls.js` measures open-loop responses from a trimmed hover
with the SAS off, per 10 % of full control (rates in °/s, attitude change
in ° after 1 s):

| Control, +10 % | rate @0.5 s | @1 s | @2 s | attitude change @1 s | cross-coupling @1 s |
|---|---|---|---|---|---|
| lateral cyclic (0.75° blade) | 8.7 | 7.0 | 3.9 | +7° roll | −2°/s pitch rate |
| longitudinal cyclic (1.26° blade) | −7.0 | −12.0 | −15.0 | −7° pitch | −5°/s roll rate |
| pedal (5° fan pitch) | 11 | 19 | 30 | | |
| collective, pedals fixed | −6.7 | −21 | −46 | | +510 fpm after 2 s, NR 100.7 % |

Roll subsides by itself as the aircraft picks up sideways speed (the rotor's
flapback with velocity), pitch and yaw keep going: rate-like axes. Hub
moment stiffness 115 kNm/rad from the paper, roll/pitch/yaw inertia
2400/7000/5000 kg m², control lag to 50 % of the rate 0.10 s. The mouse's
travel for full stick (setup) is the hand-to-stick gearing; the real stick
moves 80 mm sideways and 108 mm fore/aft per side. Collective changes yaw
the nose hard without pedal (−46 °/s after 2 s for +10 %): that coupling
is real and is what the heading-hold pedal model absorbs for keyboard
pilots.

## The scene

Own WebGL, one ground mesh with a procedural shader in world metres:
fields with crop rows and hedgerows, forest floor, rock on the slopes, the
airfield (runway 18/36 with markings and edge lights, taxiway, apron with
TLOF marking, pad with ring and H), two roads, the lake with sun glint. A
sky dome with a cloud layer projected on a plane at 1500 m that drifts
with the wind. About 6,700 trees in forests placed from the same density
function that darkens the ground, a control tower (the tower camera sits
in its cab), hangars, a fuel station, a village with a church, three wind
turbines that face the wind and turn with it, a power line along the
road, a windsock that droops when it is calm. The aircraft is a lofted
EC135 with glass tint, exhausts, intakes, skids with cross tubes, the
Fenestron shroud, live blades and a blur disc at the fitted tip-path
plane, and a sun shadow on the ground.

## Tutor

Thirteen lessons hand the controls over one axis at a time. The autopilot
flies every axis the student does not have yet; each step names one thing
to do, the simulation checks whether it happened, and the instrument that
matters is highlighted. The stick gets the most room, because it does not
control position but acceleration through a chain of lags:

1. Orientation · 2. Collective · 3. Pedals
4. Calm hover: a trimmed aircraft, hands off; one nudge leaves a drift,
   one counter-nudge removes it; the whole technique in four steps.
5. Why the stick is hard: the chain stick → attitude → acceleration →
   velocity → position explained, a hover flown by the autopilot with the
   stick movements and the trim cross on show, then the student on a
   tether (a spring on the CG: the aircraft can tilt but not drift) holding
   pitch attitudes against the ladder with the mouse as attitude command.
6. One axis: fore and aft (autopilot holds the lateral axis)
7. One axis: sideways · 8. Both axes as attitude, with a square
9. The stick as velocity: hover assist at 100 %, then 50 %, then 25 %
10. The raw stick (attitude command off, damping only): hold, stop an
    injected drift forward and sideways, column and back, hold within 3 m
11. All together · 12. Transition to forward flight · 13. Approach and landing

A cyan cross in the controls box marks the hover trim (learned from the
autopilot while it has the cyclic), a dashed cyan line on the ladder the
hover attitude. `node test/tutor.js` proves
every step passable with an ideal student.

## Coach

An instructor in the left seat: off / cues / cues + voice, from the side
panel or with `K`. A shadow copy of the autopilot, proportional-only and
seeded with the trim attitude it learns from the aircraft, computes every
frame the correction it would add now to stop the drift and hold height,
heading and speed (or to reach the tutor's target). The colour language
is fixed: green = move the control this way, red = rotor limit, white =
where you are. The correction appears as a green arrow from your stick to
where it belongs with a white ring and a word at the tip ("zurück"), as
a green ring in the controls box, as labelled arrows on the collective
and the pedals, and at the top as a headline with a sentence that names
the cause and the remedy ("Du driftest nach links. Knüppel rechts, ein
wenig, bis der Driftpfeil kleiner wird, dann zurück zur Mitte."). With
the voice on (off by default), the sentence is spoken (Web Speech API);
rotor-limit hints interrupt, others wait three seconds after the last
utterance and are not repeated within eight. Priorities: NR, overtorque,
vortex ring, Fenestron, sink rate near the ground, then drift, heading,
height; in cruise speed, vertical speed, ball. Axes the tutor has locked
get no cue. A legend line shows for 20 s after switching on.

## Flying it

A click into the view captures the mouse (Pointer Lock); from then on it
is a virtual stick driven by its movement, starting at neutral, full
deflection after 1200 px of travel (setup) with expo 1.5. A small cross in
the view shows the stick, Esc releases the mouse. Mouse buttons are the
pedals. Holding C or the middle button steers the head instead (smoothed;
orbits the camera in the chase view) while the stick is frozen. The mouse wheel or W/S is the
collective, A/D the pedals, arrow keys the cyclic by attitude, E starts and
stops the engines. A welcome card offers the tutor first; the interface
A gamepad works out of the box (right stick cyclic, left x
pedals, left y / triggers collective). The setup has a gamepad panel: every
axis of every connected device as a live bar, the buttons, a scaled stick
dead zone, presets (gamepad, joystick with twist and throttle) and a learn
button per function: press it, move the control, done; a collective axis
that rests at one end (throttle, slider) is taken as a position, a spring
stick as a rate. Rudder pedals on a second device work the same way. The
mapping is stored in the browser. If the page runs in an embedded frame
that forbids the Gamepad API, the panel says so instead of failing.

Keys are on/off, a hand is not, so each keyboard control has a pilot model
you can switch off: the collective is metered against the FLI and the rotor
speed, the arrow keys move the stick and centre it again, and the pedal
keys are a rate command with heading hold. A pedal key commands a yaw
rate (25 °/s, setup) that builds up over about a third of a second; on
release the loop stops the turn firmly with a short counter-pedal, and
only when the aircraft has nearly stopped is the heading captured. It
runs on 7° after a turn at 23 °/s and never swings back; a 0.15 s tap
moves the nose 1°, 0.4 s about 5° (`node test/yaw.js <seconds>`). Real
pedals are analog; a gamepad axis or rudder pedals pass straight through.

Trim is the first thing a hover needs and the thing a novice cannot find.
Every airborne reset therefore hands over a trimmed aircraft: the autopilot
flies it for eight seconds of fast time, then stick, pedal and collective
are set to the values that make it stand still. The attitude hold is an
attitude *command* around that trim with integrators: centred stick means
the trim attitude, which means no acceleration (a proportional hold could
only keep the trim attitude with a standing error of 3°, i.e. 0.5 m/s² of
drift, which is why the first hovers used to feel impossible). Hands off,
the trimmed hover drifts 0.2 m/s after 10 s and 1 m/s after 40 s
(`node test/acah.js`).

The control laws are written to be bumpless: every change of law (lift-off,
switching an aid, the SAS back on, the autopilot handing back, the tutor
handing over an axis) starts from the stick the previous one left. Pad
starts measure the hover trim for the current mass, CG and wind in fast
time first. Light on the skids (rotor carries 85 % of the weight) the
attitude command is already active, so the aircraft rolls into the hover
attitude while still pivoting on its right skid and comes free without a
sideways step (0.16 m/s after a gentle lift-off). Two couplings a pilot's
hands and feet take out are mixed in: pedal with collective (1.29 units of
pedal per unit of collective, measured; after an engine failure the pedal
follows the torque that is really left) and, in the hover only, roll
attitude with collective (9.3° per unit: more power, more Fenestron thrust,
the aircraft has to hang further right). Above 45 kt the yaw axis turns
from heading hold into turn coordination, and the heading is held through
a small bank instead. The attitude command is cubic: fine around the
centre, 28° pitch and 40° bank at the stops. Trim: `T` makes the attitude the stick commands now
the new centre, `Shift` + arrows move the trim at 3 °/s like the four-way
switch on a cyclic, `Y` returns to the hover trim. SAS, attitude command,
heading hold and hover assist (stick = velocity) are training aids;
switch them off one by one.

The HUD shows NR and FLI arcs, the rotor-state map (angle of attack over the
disc, binned by azimuth as the blades sweep past: retreating stall, the
reversed-flow region and a VRS breakdown show up where they happen), the
drift vector for the hover (always shown; the arrow saturates at the ring above 3 m/s and turns amber, with the ground speed beside it), and an incident banner that names the mechanism
and the standard recovery. The side panel keeps a strip chart of the last
20 s (NR, FLI, V/S, VRS, stall) that freezes after an incident for review;
`L` replays those 20 s through the same renderer and HUD (scrub with the
arrow keys, Space plays), `X` exports them as CSV. `V` hands the aircraft
to the autopilot for a demonstration and back. Exercises with a target
score the position hold, and three seconds after a landing a debrief card
shows what mattered: touchdown rate, distance to the target, max FLI, NR
band, incidents. `?` lists the keys. A pale ring on the ground under the
rotor widens and fades with height: the eye's own ground-effect gauge.

Exercises: cold start, hover with a phantom reference, the rooftop pad, pedal turns, quick stop, slope
landing, confined area, autorotation (engines quit after 10 s), vortex ring
recovery, an approach flown by the phantom, engine failure in the hover.

## Project layout

```
src/00_util.js .. 70_pilot.js   physics, pilot models (loaded by the harness)
src/80_input.js .. 97_sound.js  browser only
html/template.html              layout and CSS
build.py                        concatenates src/*.js into index.html
test/consistency.js             reference scenarios, exit 1 on ERROR
test/tutor.js                   every tutor step passable by an ideal student
test/handling.js                the human control path: keys, mouse, gamepad → input models → SAS → physics
test/loadfull.js                loads every module (browser code included) with DOM stubs
test/browser.py                 headless Chromium smoke test (playwright)
```

`python3 build.py` after every change to `src/`. The harness reads the
source files directly, so the browser and the tests cannot diverge.

## Licence

Apache-2.0, like Grenzbereich.

## Limits of main and tail rotor (1.7)

The turbine lapse k = 0.789 · δ · θ^-1.55 caps every rating; it was fitted to
the published EC135 P2 hover ceilings out of ground effect at 2835 kg (2685 m
ISA, 1785 m ISA+20) using the power this model needs there in a steady,
non-turning hover (551 / 543 kW). An earlier fit was taken in a hover that was
turning: near the ceiling a fast left yaw stalls the Fenestron in its own
inflow and the rotation sustains itself, which is the unanticipated-yaw trap
and has to be excluded from calibration. The fan's blade stall angle (16°) is
set so that it keeps about a quarter of yaw-moment margin at the hover
ceiling; with 14° it had 8 % and stalled at full pedal in calm air.

In the developed vortex ring (depth above 0.55) collective beyond the entry
value raises the inflow nearly one for one at 0.75 R, so thrust barely moves
while the induced power grows. Scenario E4: from a developed ring at 2500 kg,
collective alone loses 266 m and the sink grows to 4000 fpm, forward cyclic
with collective 46 m, Vuichard (left cyclic, right pedal) 40 m; at 2910 kg
ISA+20 near the ceiling collective alone does not get out within 20 s.
