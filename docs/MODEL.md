# Model and validation

What the flight model does, what it was measured against and how far each number can be trusted. For flying it, see the [flying manual](MANUAL.md). The full tables and the reasoning behind them are in [`TECHNICAL.md`](TECHNICAL.md).

**Contents:** [Flight model](#flight-model) · [Measured behaviour](#measured-behaviour) · [Simulated flight test](#simulated-flight-test) · [Stress tests](#stress-tests) · [Sources and calibration](#sources-and-calibration) · [Known limitations](#known-limitations)

## Flight model

The model is a textbook rotorcraft model rather than a game-tuned flight model. It runs at 360 Hz (55 steps per rotor revolution) with a semi-implicit Euler integrator, and every mechanism is written down in the code with what it models and why.

### Main rotor

Blade-element model, time-marching per blade: four blades, eight elements each (denser towards the tip), every blade a rigid beam on an offset flap hinge. The flap equation comes from the Euler equation of the blade with the hub rotating at body rates, so rotor damping, the control phase, flapback with speed, the cross-coupling off nominal rotor speed and the hub moment that makes a hingeless rotor crisp all fall out of the same loop. Lift acts along the normal of the flapped blade, so the thrust tilts with the disc. Section aerodynamics with Mach-dependent stall and drag divergence, dynamic stall (a section pushed past its stall angle keeps its flow for a few chord lengths of travel and reattaches only below it), blade torsion under stall (the separated flow's pitching moment twists a stalled blade nose down, so a deep stall limits itself), tip loss, linear twist and flap/pitch coupling.

### Inflow

Pitt-Peters dynamic inflow: a uniform state with apparent mass, the Glauert skew gradient and moment-driven gradient states. The vortex-ring region uses Leishman's empirical curve, joined to the model's own hover inflow, with seeded low-frequency roughness (periods of seconds, tens of percent of thrust) that peaks in the ring, and in the developed ring collective added beyond the entry value goes into recirculation instead of thrust (power settling); ground effect after Cheeseman and Bennett.

### Fenestron

Ducted-fan momentum theory with the axial flow through the duct: the fan carries about half the static thrust and the shroud the rest, the duct's ram drag damps yaw in the hover, the shroud's share fades with in-plane flow and does not work for reverse thrust, which the fan makes on its own disc; three blade elements with stall; the main-rotor wake at the tail. It takes its power from the main rotor, so at the power limit a pedal turn in the rotor's direction droops the rotor; in a fast left yaw the fan's own inflow can stall it, the unanticipated-yaw trap. A tail drive failure leaves the fin and the collective.

### Engines and rotor speed

Two turbines as power lags with acceleration limits, a FADEC governor with load feed-forward, ratings from the torque ratios of the EASA type certificate (take-off 5 min, maximum continuous; one engine inoperative 30 s, 2 min, continuous; only the absolute scale, 700 kW for twin take-off, is an estimate) with their time limits reported as incidents, rotor-speed limits from the same certificate (97–104 % power on, 85–106 % power off), a freewheel that lets the rotor autorotate, a start sequence with a run-up torque schedule (automatic or by hand, with hot and hung starts on demand), shutdown, fuel burn. Every rating scales with the smaller of the rotor speed and the turbine lapse k = 1.02 · δ · θ^−1.51, fitted to the published hover ceilings: the engines come out flat-rated to about sea level ISA, so there the gearbox limits and higher or hotter the turbines do. The airframe reacts the main-rotor mast torque, and a yaw acceleration speeds up or slows down the rotor until the governor catches it. The drive train loses 2.5 % in the gear meshes and drives the gearbox accessories; the generators sit on the engines and leave the rotor with them.

### Airframe and ground

Fuselage forces by the crossflow principle: each strip of cabin and tail boom feels only the flow across the body, so the boom drags sideways in a spin and through the rotor's downwash in the hover but not in straight flight; the cabin adds the side force and lift of a low-aspect-ratio body; destabilising fuselage moments that go as u·w and u·v (the yaw moment set to the EC135's measured derivative breakdown), rotor download, a stabiliser with the rotor-wake hump through transition, a cambered fin that carries most of the anti-torque in cruise (the Fenestron goes back toward zero thrust, as Airbus describes it) and keeps resisting beyond its stall. Four skid contact points and a tail bumper with anisotropic friction, so dynamic rollover, blade strike and tail strike are consequences, not scripts.

### Environment

ISA with a temperature offset, wind with a boundary layer that follows the terrain (updraught on a windward slope, downdraught and a turbulent wake in the lee), turbulence after MIL-HDBK-1797 for low altitude (stronger and quicker near the ground) and gusts; terrain from a deterministic noise that the renderer and the physics share, so a skid over a roof edge falls off it.

### Controls

A 20 ms servo and linkage lag (it reproduces the published roll phase delay), a 25 ms equivalent delay in pitch for the lead-lag dynamics the model leaves out, and actuator rate limits.

### Control laws

The aids are written to be bumpless: every change of law (lift-off, switching an aid, the autopilot handing back, the tutor handing over an axis) starts from the stick the previous one left. The trim is measured for the current mass, CG and wind at every reset. In cruise the aids and the autopilot balance as a pilot does: the nose on the flight path at low speed, the ball centred from 80 kt. Light on the skids, the attitude command finds the hover attitude while the aircraft still pivots on its left skid, so it comes free without a sideways step.

## Measured behaviour

The tag says how far a number can be trusted:

| Tag | Meaning |
|---|---|
| **VAL** | compared with a published figure the model was *not* tuned to |
| **CAL** | a published figure a parameter was fitted to: agreement by construction, proves nothing about realism |
| **RULE** | a published limit implemented as written |
| **KNOWN** | an open deviation |
| untagged | a plausibility check against textbook ranges or estimates |

Little of the model is validated against flight data: the published data for the type is thin, and most of it went into calibration. The broadest independent comparison is the [simulated flight test](#simulated-flight-test): 87 expectations written from sources by someone who never saw the model.

Measured with the test suites at 2500 kg, ISA, calm air, on release 2.3 (the pitch row on 2.16). The table as a whole has not been measured again since. `test/qualities.js` compares model properties with stored values on every push.

| Quantity | Model | Reference / expectation |
|---|---|---|
| Hover out of ground effect, 1000 ft | 422 kW (442 kW at the engines), FLI 7.2, blade pitch 9.5°, left pedal 38 % | ~55–65 % torque at this weight |
| Hover attitude | 3.1° nose up, 3.5° left skid low | left skid low for a counterclockwise rotor |
| Power in ground effect (skids at 0.3 m) | −12 % | Cheeseman–Bennett, 10–18 % |
| Level flight power: 60 / 100 / 120 / 135 kt | 236 / 324 / 436 / 559 kW | bucket at 55–70 kt |
| Anti-torque in balanced cruise, 120 kt | the fin and fuselage carry it, the Fenestron runs at zero thrust; pedal 0.83 right of the hover position | **CAL** Airbus IN 3540: the large fin takes the anti-torque in cruise, the pedal goes back to the zero-thrust position (fin camber set with it) |
| Directional derivatives at 90 kt by component | fuselage weathercock −0.25 m³/°; fin + Fenestron +0.58 m³/° and −1.09 1/s of yaw damping; total weathercock +0.33, dihedral −0.28 m³/° | **CAL** fuselage −0.26 (yaw moment volume set to it); **VAL** the rest against +0.51, −1.35, +0.25, −0.30 (Kampa et al. 1997, Fig. 18) |
| 137 kt at 2910 kg near sea level | needs maximum continuous power | **CAL** 137 kt cruise (frontal drag area fitted) |
| Climb, 2910 kg, sea level, 65 kt | 1490 fpm at MCP, 1790 at take-off power | **VAL, weak** ~1500 fpm published, power setting not stated |
| Hover ceiling out of ground effect, 2835 kg, flown | holds at 2685 m ISA and 1785 m ISA+20 at take-off power, NR 100 % | **CAL** EC135 P2 data (turbine lapse fitted) |
| Roll bandwidth and phase delay, 75 kt | 3.66 rad/s, 58 ms | **CAL** 3.7 rad/s, 55 ms (ERF 1997): servo lag fitted to it |
| Pitch bandwidth and phase delay, 75 kt | 2.85 rad/s, 93 ms | **KNOWN** bandwidth 1.84 rad/s published: the model's short period is quicker; **CAL** phase delay 92 ms published, a 25 ms equivalent delay in pitch for the lead-lag dynamics the model leaves out (2.16) |
| Engine ratings | ratios exactly as in the type certificate, at every altitude and temperature | **RULE** TCDS EASA.R.009 |
| One engine inoperative, 2500 kg hover | held between OEI continuous and the 2-min rating (FLI 10.7); 2.5-min warning on time | **RULE** TCDS time limits |
| Steady vertical descent, 0.35–0.5 vh | induced velocity within 2 % of the empirical curve; same flow whatever the path | Leishman's curve (the ring's core itself is a model construct) |
| Hover with the controls fixed | slow oscillation, period 12 s, doubles in 5 s | slowly unstable, like every helicopter |
| Hover yaw damping | −0.56 1/s | **CAL** DLR identification, about −0.5 1/s |
| Dutch roll at 60 / 100 kt | 60 kt: 1.61 rad/s, damping ratio 0.23; 100 kt: period 2.7 s, damping ratio 0.24 (flown: 2.55 s) | **CAL** DLR identification at 60 kt, 1.80–1.86 rad/s (yaw inertia chosen with it); **VAL** its damping ratio 0.24–0.28 |
| Autorotation, 65 kt | 1990 fpm, NR 100 %, pedal 0.89 right with the ball centred, Fenestron −620 N | 1700–2200 fpm; **CAL** Airbus IN 3540: reverse Fenestron thrust near the right stop against the fin (right-stop pitch set with it) |
| Double engine failure at 40 kt, collective raised to the top | NR 69.9 % at 2 s, 60.8 % at 3 s | **CAL** Airbus simulation in AAIB AAR 3/2015: 69–71 %, ~61 % (rotor inertia fitted) |
| Autorotation flared at 80–110 ft | best touchdown 238 fpm (flare at 80 ft), NR peak 105.5 % | below the hard-landing limit, NR ≤ 106 % |
| Collective dump and pull in the hover | NR 99–102 %, settled in 6 s | FADEC holds 97–104 % |
| Vne 155 kt in a shallow descent | 10 % forward stick left, advancing tip Mach 0.84 | control margin at Vne |
| Retreating blade stall, 140 kt, aft cyclic held 2 s | stalls from ~1.23 g, peaks at 2.0 g, nose up 25–28°, rolls left 56° in 3 s and comes back | roll to the retreating side (left for this rotor) |
| Abrupt pull-up from 140 kt, 2910 kg | peak blade loading C_T/σ 0.175 at μ 0.31 (1.87 g) | **VAL** limit 0.176 at that advance ratio (Kampa 1997, Fig. 22) |
| Low g (0.10 g) | full roll control | hingeless rotor, no mast bumping |
| Vortex ring, developed (2500 kg) | collective only: 248 m lost, out after 18 s; classical 34 m; Vuichard 31 m; at the power limit collective alone does not get out; thrust fluctuates by ~19 % with periods of 2–6 s | collective alone deepens it; Vuichard least height; roughness 10–40 % (Johnson; amplitude set to it) |
| Tail drive failure | hover: 134 °/s nose right after 2 s; 100 kt: the fin holds the nose at 2° of sideslip; yaw lost below ~56 kt | run-on landing with speed (ERF 1997: fin designed for safe flight without tail thrust) |
| Engine failure in the hover, pedals still | nose yaws left at ~105 °/s | torque reaction gone (flight manual: "yawing motion nose left") |
| Full pedal from the hover, SAS off | left: 107 °/s after 1 s, 173 °/s after 3 s; right: 109 / 195 °/s | no published data found |
| Cold start to 100 % NR / rotor stop | 62 s / 141 s | about a minute to start; no published run-down time found |

Release 1.8 came out of an independent review of the model: a reviewer who had not written it checked the code against textbooks, the type certificate and the published data, then re-checked the fixes. It found and 1.8 fixes defects in the rotor (lift direction, the sign of an inflow gradient, tip loss), the yaw reaction, the engine ratings and the vortex ring; the re-check also caught the test labels overstating the validation, which the table above now states honestly. A mutation test checks that the suites notice a broken model. Details in [`TECHNICAL.md`](TECHNICAL.md#validation-18).

## Simulated flight test

No test pilot was available to judge the model, so release 1.8 simulates a flight test with three roles that never see each other's work ([`flighttest/`](../flighttest)):

1. **Author.** Writes down from published sources only (textbooks, the FAA handbook, Airbus notices, the EASA type certificate, DLR system-identification papers) what a real EC135 does in 19 manoeuvres. The result is 87 expectations, each with a range, a source and a confidence. The cards are frozen (SHA-256 in `flighttest/cards.sha256`) before anything is flown.
2. **Test pilot.** `node flighttest/pilot.js` flies exactly those manoeuvres in the simulator and records them.
3. **Evaluator.** Sees the cards and the recordings but not the model, and judges each expectation PASS, NEAR or FAIL.

`node flighttest/report.js` turns the result into the [report](https://gitcrush.github.io/EC135-FlightDynamics/flighttest/report.html): plots, expectations and verdicts per card.

Four flights, each judged by a new evaluator who had seen neither the model nor the earlier verdicts:

| Flight | Release | PASS | NEAR | FAIL | Cards pass / mixed / fail |
|---|---|---|---|---|---|
| 1st | 1.8 | 66 | 13 | 8 | 11 / 6 / 2 |
| 2nd | 1.9 | 69 | 13 | 5 | 14 / 4 / 1 |
| 3rd | 2.1 | 74 | 8 | 5 | 14 / 4 / 1 |
| 4th | 2.2 | **75** | **7** | **5** | **14 / 4 / 1** |

The flights end at release 2.2. The cards stay frozen, so the same test can be flown again after any change.

Before anything was flown, the author found that the model's rotor turned the wrong way (fixed in 1.8). Between the flights the model changed, and some parameters were fitted to sources the cards also rely on, so those cards are no longer independent checks of them:

- fin camber and the Fenestron's right stop: Airbus IN 3540
- rotor inertia: the AAIB's quote of an Airbus simulation
- yaw inertia: the DLR Dutch roll
- the fuselage's yaw moment: Kampa's derivative breakdown
- the vortex-ring roughness amplitude

The third flight passed the Dutch roll at 100 kt, the pedal doublet and the power curve and brought the stall roll-off and the ball-centred sideslip to NEAR. The fourth flight changed no flight physics: the test pilot now flies the vortex-ring entry, the classical recovery and the autorotation exactly as the plan says, and it closes this iteration.

Five expectations remain FAIL, none of them high-confidence:

- rotor-speed recovery after a power loss in the hover (red flag): with the pedals fixed the Fenestron keeps taking 16 kW, and the flat-pitch rotor only drives itself beyond ~1.9 vh of descent;
- the hover yaw decay after a pedal release (the governed rotor's inertia joins the yaw axis) and the yaw a sideways drift starts (through the Fenestron's inflow; the model's N_v is a third to a half of the BO 105's);
- the collective at 135 kt, 4° above the hover value (BO 105: ~3.4°);
- the sign of a 1 °/s yaw in the first half-second of a roll pulse at 100 kt (product of inertia).

Each has its measured reading in the report (marked as the developer's, in `flighttest/notes.json`) and in [`TECHNICAL.md`](TECHNICAL.md#fourth-flight-and-the-end-of-this-iteration-22).

## Stress tests

`test/stress.js` flies what the scenario suite does not: sharp-edged gusts, sideward and rearward flight at the edge, the collective snapped up and dumped at Vne, overpitching on one engine, both engines failing in the high hover, a 60° turn, a tail slide, a roll, a loop, negative g, drift touchdowns, hard and run-on landings, random inputs and the energy balance in autorotation. It found and fixed three defects. The table of results is in [`TECHNICAL.md`](TECHNICAL.md#stress-tests-and-unconventional-manoeuvres-2166).

## Sources and calibration

**Sources**

- **Rotor, controls, stabiliser and Fenestron:** Kampa, Enenkl, Polz, Roth (Eurocopter Deutschland), *Aeromechanic Aspects in the Design of the EC135*, 23rd European Rotorcraft Forum, Dresden 1997 (ERF archive): rotor moment capacity of about 2000 Nm per degree of flapping, 10° twist, 7.5° flap/pitch coupling, cyclic ranges and stick travel, pitch and roll bandwidth, stabiliser and fin geometry, Fenestron geometry.
- **Engine and rotor-speed limits:** the EASA type certificate (TCDS EASA.R.009, EC135 P2+), whose torque ratios set the ratings.
- **Vortex-ring recovery advice:** Airbus Helicopters Safety Information Notice 3463-S-00 (classical technique first; Vuichard, for this counterclockwise rotor right cyclic with left pedal, where there is no room ahead).
- **Model form:** Seher-Weiß, *ACT/FHS System Identification Including Rotor and Engine Dynamics*, Journal of the American Helicopter Society 64, 2019 (DLR).

**Fitted to published figures (CAL)**

| Parameter | Fitted to |
|---|---|
| Turbine lapse | hover ceilings, EC135 P2 at 2835 kg: 2685 m ISA, 1785 m ISA+20, out of ground effect (a public type datasheet) |
| Frontal drag area | 137 kt cruise at maximum continuous power |
| Servo lag | roll phase delay, 55 ms at 75 kt (ERF 1997) |
| Rotor polar inertia | the Airbus simulation of a double engine failure at 40 kt quoted by the AAIB (AAR 3/2015) |
| Yaw inertia | the DLR Dutch roll at 60 kt |
| Fin camber, the Fenestron's right-stop pitch | Airbus IN 3540: the fin carries the anti-torque in cruise, the Fenestron needs negative thrust near the right stop in autorotation |
| Fuselage's destabilising yaw moment | the derivative breakdown in Kampa et al. 1997, Fig. 18, whose fin, Fenestron and total derivatives the model then matches without further fitting |

The published climb rate (~1500 fpm at MTOW, power setting not stated) is the only performance figure left over for an independent comparison.

**Still estimates:** roll and pitch inertia, the side and vertical drag areas, the blades' torsional stiffness and the separated-flow moment arm, the split of the longitudinal cyclic range, the absolute gearbox power, the Fenestron duct factor, pedal gearing and blade stall angle (16°, set so that the fan keeps a yaw-control margin at the hover ceiling), the dynamic-stall delay, and the strength of the power-settling term.

The calibration table is in [`TECHNICAL.md`](TECHNICAL.md#sources-and-calibration).

## Known limitations

- The aircraft data is partly estimated (see above). Calibrated to published figures: the hover ceilings, the 137 kt cruise, the roll bandwidth and phase delay, since 1.9 the rotor and yaw inertias, the fin camber and the vortex-ring roughness, and since 2.1 the fuselage's yaw moment and the Fenestron's right stop. Independently compared: since 2.1 the directional derivatives of fin and Fenestron and the Dutch-roll damping at 60 kt (they match), and the climb rate, weakly. Not certified against flight-test data.
- Open deviation: in pitch the model responds faster than published (bandwidth 2.85 against 1.84 rad/s at 75 kt). The yaw response has no published reference at all.
- Not to be trusted in absolute terms: yaw rates, vortex-ring height losses (the ring's core is a model construct after Johnson), one-engine margins (they hang on the estimated 700 kW scale), hover ceilings away from the two calibrated points, the engine start (its idle speeds and TOT curve are a small turboshaft's typical shape, and the start limits come from a training deck, not from the type's flight manual).
- Open after the flight-test iteration (1.8–2.3): the pitch bandwidth (the model's short period is quicker than the aircraft's; the stabiliser is ruled out; since 2.16 a 25 ms equivalent delay stands in for the lead-lag dynamics the model leaves out, which brings the phase delay to the published value but not the bandwidth), and the roll-off in retreating blade stall is about 1.7 times the expected bank. The stall limit itself matches the published one (VAL since 2.3; until 2.2 the onset of local stall was compared with the limit load, two different things). Kept as physics, with no data to say otherwise: the hover yaw decay with the governed rotor, rotor speed after a hover power loss with the pedals fixed, the collective at 135 kt, and the rolls with the controls fixed that the cambered fin's yaw with speed starts.
- No flight model of the airframe's structural modes, no blade lag, no rotor icing, no weather beyond wind, turbulence, haze and a cloud layer (no rain, no cloud to fly into). Since 2.17.1 the wind follows the terrain in an engineering model (up a windward slope, down a lee slope, a wake behind steep ridges), not a flow solution; the town's towers have no wake.
- One aircraft, one world of about 14 × 14 km, its detail within 2.7 km. Daylight only (6:30 to 19:30). Shadows fall on the ground only, not on roofs, walls or the aircraft; trees cast theirs within 220 m. The boulders, the reeds, the cars, the birds and the boat are drawn only, not obstacles; the trees are, through the canopy's height (and the ring round the clearing), not one by one.
- Head tracking follows the head's turn and nod only, not a lean to the side or forward, and needs a webcam. It is the one thing the page loads from elsewhere: the face detector's library, about 10 MB from jsDelivr, when head tracking is first started.
- The keyboard is a compromise: every key goes through a pilot model. A gamepad or joystick is recommended.
- Speech for the coach is off by default; it uses the browser's built-in voices, whose quality varies.
- In an embedded frame some browsers block the Gamepad API; the gamepad panel says so. Download the file and open it locally.
