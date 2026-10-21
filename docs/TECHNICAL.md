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
Fenestron, two turbines with FADEC, counterclockwise rotor seen from above (left pedal
with power, left skid low in the hover, the torque yaws the nose right), as on
the BO105 and BK117 it descends from. (Until 1.8 the model turned clockwise;
the flight-test author found it, see [Rotor sense](#rotor-sense-18).)


## What the model does

| Part | Model |
|---|---|
| Main rotor | Blade element per blade, time-marching at 360 Hz (55 steps per revolution). Each blade is a rigid beam on an offset flap hinge (8.7 %, which alone gives the published hub stiffness, so no spring), flap frequency ratio 1.07. The flap equation is derived from the Euler equation of the blade with the hub rotating at body rates (Coriolis terms), so rotor damping, the control phase (~79°; the flap/pitch coupling is not in this figure) and the cross-coupling off nominal rotor speed all follow from the same loop. Lift acts along the normal of the flapped blade, so the thrust tilts with the tip-path plane. Eight elements per blade, denser towards the tip, so the tip-loss factor (B = 0.97) acts. Section model with Mach-dependent stall and drag divergence, and dynamic stall per element (separation delayed by ~10 semi-chords of travel, attached lift above the static maximum until then, reattachment 2° below the static stall angle). Rotor and gearbox polar inertia 2000 kg m². |
| Inflow | Pitt-Peters dynamic inflow: uniform state with apparent mass, Glauert skew gradient, moment-driven gradient states (more downwash on the lifting side). Vortex-ring region from the Leishman empirical curve, scaled to join the model's own hover inflow, with seeded low-frequency roughness (periods of ~1.5–6 s, 15–30 % of thrust peak to peak) that peaks in the ring and power settling in the developed ring; Cheeseman-Bennett ground effect. |
| Fenestron | Ducted-fan momentum theory with the axial flow through the duct (fan carries about half the static thrust, the shroud the rest; the duct's ram drag gives most of the hover yaw damping; augmentation fades in forward flight), three blade elements with stall, inflow lag, reverse thrust without the lip share. Pedal gearing −25° (right stop) to +40° (left stop), 12° at centre. |
| Engines | Two turbines as power lags with acceleration limits, FADEC PI governor (ζ ≈ 0.4) with load feedforward referred to nominal NR, ratings from the torque ratios of the EASA type certificate (AEO take-off 5 min, MCP; OEI 30 s, 2 min, MCP) with their time limits, turbine lapse with altitude and temperature, freewheel, FLI. The airframe reacts the main-rotor mast torque only; the rotor speed couples with yaw acceleration. Start sequence and shutdown; fuel burn comes off the mass. |
| Controls | Servo and linkage lag 20 ms (fitted to the published roll phase delay), actuator rate limits. |
| Airframe | Drag areas by axis, unstable fuselage (Munk) pitch and yaw moments going as u·w and u·v, rotor download, side area in strips that also see the rotor downwash as crossflow, stabiliser with the rotor-wake hump through transition, cambered fin (zero-sideslip lift coefficient 0.9, stall at 24° effective angle) and end plates; fin and stabiliser see only the flow across their span. In balanced cruise the fin carries about two thirds of the anti-torque. |
| Ground | Four skid contact points plus tail bumper, spring-damper on the terrain normal, anisotropic friction (skids slide forward, dig in sideways). Dynamic rollover, blade strike and tail strike are consequences, not scripts. |
| Environment | ISA with temperature offset (density altitude), wind with boundary layer, Dryden-like turbulence, gusts. Terrain from a deterministic value noise with a lake, a ridge on the horizon, a slope mound, a confined area in a tree ring and a hospital rooftop pad 22 m up; the physics and the renderer read the same height function, so a skid on a roof edge falls off it. |

Aircraft data (`src/20_heli.js`) comes from the sources listed below where
public; the remaining estimates are marked as such in the code and are the
first things to revisit when the harness disagrees with the flight manual.

## Measured (harness, 2500 kg, ISA)

Release 2.1. The tag says how far a number can be trusted (see
[Validation](#validation-18) below): **VAL** compared with a published
figure the model was not tuned to, **CAL** a published figure a parameter
was fitted to, **RULE** a published limit implemented as written, **KNOWN**
an open deviation; untagged rows are plausibility checks against textbook
ranges.

| Quantity | Model | Reference / expectation |
|---|---|---|
| Hover power OGE, 1000 ft | 422 kW (442 kW at the engines), FLI 7.2 | ~55–65 % torque at this weight |
| Hover blade pitch (0.75 R) | 9.5° | 8–10° from C_T/σ = 0.076 |
| Hover pedal / attitude | 38 % left; 3.1° nose up, 3.5° left skid low | left pedal, left skid low (counterclockwise rotor) |
| Hover in 25 kt crosswind (at the aircraft) from the right | 47 % left pedal, no fan stall | the wind on the Fenestron's wake side needs the most pedal |
| Power IGE at skid height | −12 % | Cheeseman-Bennett, 10–18 % |
| Level flight 60 / 100 / 120 / 135 kt | 236 / 324 / 436 / 559 kW (balanced) | bucket 55–70 kt |
| Anti-torque in balanced cruise, 120 kt | fin and fuselage carry it, the Fenestron runs at zero thrust; pedal 0.83 right of the hover pedal | **CAL** Airbus IN 3540: the fin takes the anti-torque in cruise, the pedal goes back toward the Fenestron's zero-thrust position (fin camber set with it) |
| Directional derivatives, 90 kt, by component | fuselage weathercock −0.248 m³/°, yaw damping −0.07 1/s; fin + Fenestron +0.579 m³/°, −1.09 1/s; total weathercock +0.327, dihedral −0.275 m³/° | Kampa et al. 1997, Fig. 18: fuselage −0.26 (**CAL**, yaw moment volume set to it), ~0; fin + Fenestron +0.51, −1.35; total +0.25, −0.30 (**VAL**) |
| Steady autorotation, 65 kt | pedal 0.89 right (ball centred), Fenestron −620 N | **CAL** Airbus IN 3540: negative Fenestron thrust near the right stop against the fin (right-stop pitch set with it) |
| 137 kt at MTOW 2910 kg near sea level | maximum continuous power (engine load / MCP 1.00) | **CAL** 137 kt cruise (frontal drag area fitted) |
| Climb at 65 kt, MTOW, sea level | 1490 fpm at MCP, 1790 at take-off power | **VAL, weak** ~1500 fpm published, power setting not stated |
| Climb at Vy, take-off power, 2500 kg | 2120 fpm | ~2000 fpm (estimate) |
| Hover ceilings OGE, 2835 kg, flown 30 s | hold at 2685 m ISA and 1785 m ISA+20 at take-off power, NR 100 % | **CAL** EC135 P2 data (turbine lapse fitted) |
| Autorotation 65 kt, collective full down | 1990 fpm, NR 100 %; energy balance 1.05 | 1700–2200 fpm |
| Double engine failure at 40 kt, collective raised to the top | NR 69.9 % at 2 s, 60.8 % at 3 s | **CAL** Airbus simulation in AAIB AAR 3/2015, 1.16.4: 69–71 % at 2 s, ~61 % at 3 s (rotor inertia fitted) |
| Roll bandwidth / phase delay, 75 kt | 3.66 rad/s / 58 ms | **CAL** 3.7 rad/s / 55 ms (ERF 1997, Table 4): the servo lag is fitted to the phase delay, Ixx comes from the same paper |
| Pitch bandwidth / phase delay, 75 kt | 3.01 rad/s / 70 ms (collective fixed during the sweeps; 2.94 / 67 with the height held, as until 2.2) | **KNOWN** 1.84 rad/s / 92 ms published: the model's short period is quicker and has less delay (see *The two open physics items*) |
| Hover oscillation (linearised, controls fixed) | period 12.4 s, doubles in 5.3 s | slowly unstable, as every helicopter in the hover |
| Hover yaw damping N_r | −0.557 1/s | **CAL** DLR identification, about −0.5 1/s |
| Dutch roll, 60 kt | 1.61 rad/s, ζ 0.23 | DLR identification 1.80–1.86 rad/s (**CAL**, Izz chosen with it), ζ 0.24–0.28 (**VAL**) |
| Dutch roll, 100 kt | period 2.7 s, ζ 0.24 (linearised; flown 2.55 s) | flight-test author: 2.5–4.5 s |
| Retreating blade stall, 140 kt, 2910 kg, 2.7° aft cyclic | onset at 1.23 g, nz peak 2.0 g, nose up 25°, roll left 56° at 3 s, back to 21° at 5 s | local stall well below the limit load, as on the aircraft |
| Abrupt pull-up from 140 kt, 2910 kg | peak C_T/σ 0.175 at μ 0.311, 1.87 g | **VAL** Kampa 1997, Fig. 22: limit 0.176 at that advance ratio (ratio 0.99) |
| Vortex ring, collective held | thrust fluctuation 19 % peak to peak (detrended), periods 2–6 s | **CAL** 10–40 % (Johnson; amplitude set to it) |
| Collective dump / pull in the hover | NR 99–102 %, settled within 6 s | FADEC holds 97–104 % (TCDS power-on range) |
| Cold start to 100 % NR / rotor stop | 62 s / 141 s | about a minute to start |
| Vortex ring | detected at 1600 fpm vertical, cleared with forward speed | |
| Engine ratings | ratios as in the type certificate at every altitude and temperature | **RULE** TCDS EASA.R.009 |
| OEI in hover, 2500 kg, 1000 ft | held, NR min 98 %, FLI 10.7 (between OEI continuous and the 2-min rating), 2.5-min warning on time | **RULE** TCDS time limits |
| Steady vertical descent, 0.35–0.5 vh | induced velocity within 2 % of the empirical curve, independent of the path | Leishman (2006) |
| Roll / pitch rate, +20 % cyclic, 1 s | 17 / 20 °/s | crisp hingeless response |
| Yaw rate, +50 % pedal | 131 °/s after 2 s | agile in yaw (no published data found) |

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
| Pitch / roll bandwidth and phase delay (75 kt) | 1.84 rad/s, 92 ms / 3.7 rad/s, 55 ms | roll 3.66 rad/s, 58 ms (calibrated: 20 ms servo lag); pitch 2.94 rad/s, 67 ms (open deviation) |
| Stabiliser | 2.6 m × 0.52 m, inverted GA(W)-1 with Gurney flaps, end plates 0.36 m², fin 0.9 m² | 1.35 m², a = 4.5, end plates 0.36 m², fin 1.0 m², centre of pressure 1.45 m above the CG (camber and incidence as a zero-sideslip lift coefficient of 0.83, set with Airbus IN 3540) |
| Fenestron | 1.0 m, 10 blades, chord 0.05 m, tip speed 188 m/s | as given; pedal gearing −11°..+40° (right stop set with Airbus IN 3540) |
| Main rotor | R 5.1 m, chord 0.288 m, tip speed 211 m/s | as given |
| Ratings (1997 version) | MCP 2×283 kW, TOP 2×308 kW, OEI 2.5 min 410 kW | P2+ ratings from the EASA type certificate's torque ratios (below) |
| Performance (1997, 2630 kg) | 141 kt cruise, Vne 155 kt, HIGE/HOGE 4300/3700 m | see the measured table |
| Directional derivatives, 90 kt (Fig. 18, Eurocopter model checked in flight) | fuselage, fin + Fenestron, rotor: weathercock, dihedral, yaw damping | fuselage yaw moment volume set to its weathercock; the rest compared (measured table) |

The engine limits follow the EASA type certificate (TCDS EASA.R.009, EC135
P2+), given there as torque in percent of a reference: AEO take-off 2 × 78 %
for 5 minutes, AEO maximum continuous 2 × 69 %, OEI 30 s 128 %, OEI 2 min
125 %, OEI continuous 89.5 %; rotor speed power on 97–104 %, power off
85–106 % (above 1900 kg). Each rating is pRef · ratio · min(k, NR/100):
the gearbox torque limit at the present rotor speed, or the turbines' lapse
k = 1.016 · δ · θ^−1.513 when the air is thin or hot, one lapse for all
ratings, so the certificate's ratios hold everywhere. The lapse is fitted to
the two published hover ceilings, where the engines' whole load (rotor,
Fenestron, gearbox accessories, friction and gear-mesh losses, in a steady,
non-turning hover) equals take-off power; it comes out flat-rated to about sea level
ISA. The absolute scale pRef (700 kW twin take-off) is an estimate.

Still estimates: Ixx and Iyy, the absolute gearbox power, the forward/aft
split of the longitudinal range, the Fenestron duct factor, the left half of
the pedal gearing and the fan's blade stall angle, the strength of the
power-settling term, the dynamic-stall delay, the blades' torsional
stiffness and separated-flow moment arm, the gear-mesh losses.
Fitted (CAL): the turbine lapse (hover ceilings), the frontal drag area
(1.67 m², 137 kt at MCP) and the servo lag (roll phase delay); since 1.9 also
the rotor polar inertia (2000 kg m², the Airbus simulation of a double engine
failure at 40 kt quoted by the AAIB), the yaw inertia (4900 kg m² since 2.1,
the DLR Dutch roll at 60 kt), the fin camber (0.83, Airbus IN 3540: the fin
takes the anti-torque in cruise), the Fenestron's right-stop pitch (−11°
since 2.1, IN 3540: reverse thrust near the right stop in autorotation) and
the vortex-ring roughness amplitude (10–40 % of thrust); since 2.1 the
fuselage's yaw moment volume (Kampa et al. 1997, Fig. 18). Four of these
sources are also sources of the flight-test cards (F4, F6/H7, F1, and Kampa
for several); those cards are no longer independent checks of these
parameters.

## Scenario analysis

`node test/scenarios.js A|B|C|D|E` checks signs and magnitudes in normal and
limit manoeuvres, and what the aids do there. Winds are given at the
aircraft's height. Figures from release 2.1.

A — yaw and pedals: Fenestron power rises in a left pedal turn (against the
torque) and falls in a right one (45 / 37 / 31 kW: the yaw changes the fan
inflow); full left pedal from a trimmed hover with the SAS off gives
107 °/s after 1 s and 173 °/s after 3 s and stalls a third of the fan; full
right pedal takes the fan to reverse thrust, so the rotor torque and the fan
yaw the aircraft together (109 °/s after 1 s), damped by the fin and the
tail boom dragged sideways; +10 % collective yaws the nose right (26 °/s), a
total engine failure yaws it left at about 105 °/s with the pedals still
(the flight manual: "yawing motion nose left"); at 65 kt autorotation needs
more right pedal than powered flight (0.86 against 0.30); the smallest
pedal margin in a hover is with the wind from the right (56 % at 17 kt);
in cruise, right pedal gives sideslip from the left, a small roll to the
right (dihedral effect) and a weathercock return. No published yaw
response was found to check the yaw rates against.

B — cyclic and limit manoeuvres: positive speed stability (+2.8° pitch 2 s
after a 5 m/s speed increase); pitch–roll coupling 40 % (forward stick) and
21 % (right stick); retreating blade stall at 140 kt and 2.0 g pitches the
nose up 28° and rolls the aircraft to the left, the retreating side of a
counterclockwise rotor; at 0.10 g the hingeless rotor keeps full roll
control; Vne reached in a shallow descent with 10 % forward stick left and
an advancing tip Mach of 0.84 (from 1.9 to 2.0 this row read 0.00: the
tip Mach number was computed but not stored); a quick stop with the pedals
held still yaws right at up to 147 °/s as the fin unloads and the power
comes in, with the feet working 13 °/s (the scripted feet act in fan
pitch, so the gearing estimate does not change the pilot); an
autorotation flared at 80 ft lands at 238 fpm with NR peaking at 105.5 %;
total power loss in a 3 m hover cushions to 191 fpm.

C — the aids in those manoeuvres: the attitude command reaches 30° pitch
and 34° bank (cubic shaping: fine near the centre); at 100 kt the yaw axis
coordinates the turn (bank 41°, ball 0.3 m/s²) and the roll axis holds the
heading when the stick is centred; going to take-off power changes the
sideslip by 2.0°; dumping the lever into an autorotation entry changes it by
4.0°, where the pedal reaches the right stop (at 100 kt the fin needs more
reverse thrust than the stop gives). The pedal anticipation in forward
flight follows the mast torque (0.096 of the pedal travel per kNm at
100 kt): until 2.0 it followed the lever with the cruise slope, pushed the
pedal ahead of the torque and twice too far in a dump, and the nose swung
8° the wrong way. The keys reach the 30-second OEI rating; with the
engines out the collective key throws the lever (0.4 s) and NR stays at
91 %; the coach names the rotor limit first.

D — main and tail rotor at the limit (2910 kg, ISA+20): see
[the section below](#limits-of-main-and-tail-rotor-17-18). A tail drive
failure in the hover spins the aircraft right at 134 °/s after 2 s; at
100 kt the fin holds the nose at 2° of sideslip down to ~56 kt.

E — modes and recoveries: the linearised hover has a slowly unstable
oscillation (period 12.4 s, doubles in 5.3 s); at 100 kt the Dutch roll
has a period of 2.7 s and a damping ratio of 0.24, the phugoid 28 s; the
transverse-flow effect rolls the aircraft by 5–7° through 12–25 kt with
the lateral stick frozen; vortex-ring recoveries: below.

## Control response (audit)

`node test/controls.js` measures open-loop responses from a trimmed hover
with the SAS off, per 10 % of full control (rates in °/s, attitude change
in ° after 1 s):

| Control, +10 % | rate @0.5 s | @1 s | @2 s | cross-coupling @1 s |
|---|---|---|---|---|
| lateral cyclic (0.75° blade) | 8.2 | 6.6 | 4.2 | −1.5 °/s pitch rate |
| longitudinal cyclic (1.09° blade) | −7.4 | −9.9 | −7.9 | −2.3 °/s roll rate |
| pedal (2.6° fan pitch) | 10.9 | 17.5 | 27.2 | |
| collective, pedals fixed (yaw) | −6.1 | −18.1 | −35.0 | +510 fpm after 2 s, NR 100.5 % |

Roll subsides by itself as the aircraft picks up sideways speed (the rotor's
flapback with velocity), pitch and yaw keep going: rate-like axes. Hub
moment stiffness 115 kNm/rad from the paper, roll/pitch/yaw inertia
2400/7000/5000 kg m², control lag to 50 % of the rate 0.11 s (20 ms servo
lag, actuator rate limit, flap and inflow dynamics). The mouse's
travel for full stick (setup) is the hand-to-stick gearing; the real stick
moves 80 mm sideways and 108 mm fore/aft per side. Collective changes yaw
the nose hard without pedal (−35 °/s after 2 s for +10 %): that coupling
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
road, a windsock that droops when it is calm.

The aircraft (2.0) is lofted from superelliptic sections interpolated by a
spline, each quad coloured from its centre so that the windshield with its
centre post, the door and cabin windows, the chin windows and the door seams
stay crisp; the engine cowling with intakes and exhausts on the roof, a tail
boom that rises to the Fenestron's shroud (a thick ring with stators), the
swept fin and ventral fin, the stabiliser with its end plates, skids on
arched cross tubes with the boarding steps, rotor blades with the swept,
tapered tip, a generic white and blue scheme. Painted surfaces and glass
catch the sun (specular term). Its shadow is the real silhouette: every
aircraft mesh, blades included, projected along the sun onto the ground
plane under it, each pixel darkened once (stencil), the spinning disc as a
faint dimming.

**The panel (2.6, 2.6.1).** The cockpit view has no 3D frame: the cockpit is
the EC135 P2+ instrument panel, drawn flat across the bottom of the view
(89_panel.js; nominal 1330 × 236 px, scaled down to narrower windows). Under
the glareshield (a padded coaming with a lit lip, stitching and its shade):
straight ahead the pilot's flight instruments as the classic T in black
housings with screws, bezel and glass, airspeed (green 20-140 kt, amber to
155, red line at 155), attitude (sky and ground ball with pitch ladder and
bank pointer), altitude (hundreds and thousands hands), radar altitude
(0-500 ft over 223°, to 2500 ft over 108° more, a flag above), HSI (the card
turns with the heading, the autopilot's HDG bug on it) and vertical speed
(±2000 fpm), with master WARN and CAUT lamps and BARO and HDG knobs; left
of them the CPDS, its warning unit with ten captions (ENG, RPM, FLI, T/R,
XMSN and the trainer's VRS, STALL, FEN, GE, Mdd) and the VEMD (FLI dial and
value, rotor speed with its band, power, engines, OAT and weight, fuel and
the engine mode); further left the trainer's control-position display,
right of the flight instruments the navigation display (the predictor's
scope and height profile) and the rotor-state display, screens in bezels
with soft keys. The surface, the coaming, housings, faces and placards are
drawn once into a cached canvas per window size; needles, the ball, the
card, the lamps and the screens every frame. With the HUD off the trainer's
screens stay dark. While the pilot looks around (`C`) the panel is not
drawn, and from the seat a turning rotor shows only as its blur, not as
blades caught at random. 2.6 had a plain band with the old panel's flight
display cut in, under a 3D frame of posts; `cfg.panel3d` brings the 3D
cockpit of 2.0-2.5 back (without its glareshield).

The cockpit (2.0) is drawn in its own pass with the depth buffer cleared and
a 2 cm near plane, so the frame half a metre from the eye stays sharp while
the scenery keeps its depth precision. Right seat of the EC135: the
windshield's centre post and door posts, the roof with the green-tinted
overhead windows, the glareshield, the instrument panel with two primary
flight displays (attitude, speed and height tapes, heading, vertical speed),
the engine display between them (FLI and rotor speed dials with their
bands, power, engine state, OAT, weight, fuel) and a row of warning lights,
all drawn into a canvas each frame and used as the panel's texture; the
centre pedestal, the empty left seat, the lower windshield beside the
panel and the chin windows in the floor, through which the ground under
the skids shows; the pedals move with the controls. (The stick and the
collective lever were drawn until 2.2; from the eye they stood in the
middle of the view and hid the chin window.) The panel is redrawn at 30 Hz
(15 in light mode) at the screen's pixel density and uploaded into the
texture's existing storage. The field of view (2.4): a flat screen looked at from an arm's length
spans 40-60°; the wider the projection beyond that, the more the frame and
the panel, a metre from the eye, stretch towards the edges. So both angles
are bounded: the setting (50-90°, default 72°) is the angle across; the
vertical angle stays between 46° and 62° (a narrow window sees less across
instead of more up and down, a wide one up to 85° across); and the line of
sight is lowered so that the bottom of the view sits ~36° below the
horizontal, where the flight displays are. Until 2.2 the vertical angle was
fixed at 64° (107° across in a 2.15:1 window, 53° in a 0.8:1 one); 2.3
allowed up to 100° in either direction, which still stretched the frame in
narrow and wide windows.

The cockpit has its own near plane of 2 cm. With a 24-bit depth buffer it
is drawn first, into the front 1 % of the depth range (the scene gets the
rest), so the ground and the sky behind the panel and the frame are never
shaded; with 16 bits it is drawn last over a cleared depth buffer. The
whole frame is drawn nearest first (cockpit, aircraft, buildings and
trees, ground, then the sky into whatever is left), then the shadow, the
downwash particles and the transparent parts.

The ground (2.3). Its noise comes from one 256 x 256 texture (R, G and B
smooth value noise with 16, 32 and 64 cells across, A one value per texel),
mipmapped and filtered anisotropically (up to 8x), fetched at four scales
(cells from 260 m down to 4 cm): the GPU's filtering averages whatever is
finer than a pixel. Stripes, lines and markings (crop rows and furrows,
hedgerows, runway, taxiway and road markings, slab joints, the pad) are
drawn analytically and filtered by the pixel's footprint on the ground
(screen-space derivatives): thinner than a pixel they fade to their
average, and a threshold of the noise (the grass clumps) fades to its mean
cover. The airfield, the roads and the lake are only evaluated inside
their bounds. 2.0-2.2 computed some fifty hash values per pixel and
point-sampled every pattern at every distance: the most expensive part of
a frame, and the shimmer of crop rows and markings when the view moved.
The field types still come from the shader's hash on 45 m cells, which the
downwash particles replicate in single precision (the hash amplifies
rounding near its wrap) to know what the rotor blows up. Close to the eye
the texture goes down to a few centimetres, the cue a hovering pilot reads
drift from. The rotor downwash (where the wake lands, carried by the wind;
thrust over weight, fading by ~2.5 rotor diameters) flattens the grass in
bands that travel outward, raises dust off the ploughed and cropped
fields, a little grit off the pad and spray rings off the lake. (2.0-2.1
also grew grass tufts and stones in a patch that followed the aircraft;
from the cockpit they popped up as little cones near the ground and were
removed.)

Trees (2.3): two levels of detail per 400 m tile; near tiles (within
~700 m) have lumpy crowns that carry their own light and shade and
conifers in three tiers (the tiers pointed down until 2.2), far tiles a
plain ellipsoid or cone. The dark discs under the crowns are gone.

Graphics modes (2.1, reworked in 2.3). The trees are meshed in 400 m
tiles with a bounding sphere each; a tile outside the view frustum is not
drawn (in the cockpit about three quarters of the forest are behind or
beside the camera). The 3D view is drawn at the screen's pixel density (at
most 2) within a pixel budget, always multisampled. The setup offers
*auto*, *full* and *light*:

| | auto (default) | full | light |
|---|---|---|---|
| shaders | full | full | ground without the finest octave and the water's ripples, clouds from one fetch |
| pixel budget | 2.6 MP | 2.6 MP | 1.2 MP |
| dynamic resolution | yes, down to 60 % | no | yes |
| forest | ~6,700 trees | ~6,700 trees | ~55 %, 15 % larger, fewer faces |
| downwash particles | 500 | 500 | 200 |
| instrument panel | 30 Hz | 30 Hz | 15 Hz |

Dynamic resolution looks at the frame intervals in windows of 45 frames
against 60 per second: a late window steps the scale down by 0.1; if the
next window is not faster the pixels were not the bottleneck (the CPU or
the screen is), so the step is undone and taken as the floor. Four windows
with room step it back up; a step up that has to be taken back caps the
scale there for a minute. Nothing is remembered between starts. A
software renderer (the browser not using the GPU) is recognised by its
name: *auto* then uses the light shaders and a 0.5 MP budget, and the side
panel says so in amber. Since no mode changes the multisampling any more,
switching never builds a new WebGL context. (2.1 and 2.2 switched *auto*
to light after a slow start and remembered it: no multisampling and 0.75
of the page's pixels, on a high-density screen under 40 % of the screen's
resolution.)

Measured under SwiftShader at 978 x 800 (a software renderer; it shades
every pixel, hidden or not, so a GPU gains more): a cockpit frame takes
433 ms against 912 ms in 2.2, a chase frame 437 against 633 ms; in the
page's own loop the median frame interval falls from 621 to 477 ms
(cockpit) and from 497 to 336 ms (chase). The side panel's numbers are
written at 15 Hz and only when they change.

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
where it belongs with a white ring and a word at the tip ("back"), as
a green ring in the controls box, as labelled arrows on the collective
and the pedals, and at the top as a headline with a sentence that names
the cause and the remedy ("You are drifting left. Stick right, a little,
until the drift arrow shrinks, then back to centre."). With
the voice on (off by default), the sentence is spoken (Web Speech API);
rotor-limit hints interrupt, others wait three seconds after the last
utterance and are not repeated within eight. Priorities: NR, overtorque,
vortex ring, Fenestron, sink rate near the ground, then drift, heading,
height; in cruise speed, vertical speed, ball. Axes the tutor has locked
get no cue. A legend line shows for 20 s after switching on.

## Autopilot modes (AFCS, 2.4)

`src/70_pilot.js` (AFCS) and `src/91_assist.js` (the display). Like the
type's automatic flight control system, the pilot engages functions and
the system picks the control each one needs, by speed (cruise laws above
40 kt, back below 35):

| mode | holds | control | key |
|---|---|---|---|
| ALT | the height (barometric, set at engagement, ~1 s ahead) | collective | `U` |
| V/S | a vertical speed (100 fpm steps, −2000 to +1500) | collective | menu |
| HDG | the heading | pedals in the hover; bank (cyclic left/right) and pedals for the ball at speed | `O` |
| HOV | the position over the ground, below 40 kt (engaged below 20 kt; the spot is where it can stop, 1 s ahead) | cyclic | `I` |
| IAS | the airspeed, above 40 kt (45-140 kt) | cyclic fore/aft | `I` |

ALT and V/S exclude each other; HOV and IAS go with the speed and let go
outside it. A control no engaged mode needs stays with the pilot, through
the stability augmentation. The laws are those of `apStep` (the same
controller flies the tutor's locked axes and the `V` demonstration); the
AFCS layer only sets its targets and decides which of its outputs reach
the controls. Channels it does not drive keep the autopilot's integrators
on the present controls, so a mode engages without a bump; a channel it
gives back hands its last output to the stability augmentation as the
trim for that axis only. With the pedals held and the collective free, the
pedal anticipates the torque change (the aids' mixing, washed out over
3 s). V/S trims its collective three and a half times faster than the
height loop (a new rate of −500 fpm at 100 kt is within 5 % after 15 s).

**The pilot can always take a control.** Moving one that a mode drives
(the stick by more than ~25 px within a moment, an arrow key, `W`/`S`, the
wheel, `A`/`D`, the mouse buttons as pedals, a gamepad axis beyond 15 %)
releases the modes on that control before the stability augmentation reads
the devices, and the strip says so ("HOV off: you have the cyclic"). Until
2.3 the autopilot ignored a control it held; with the mouse as a stick
that looked like a frozen aircraft.

**What it shows: learning by watching.** Every mode has a colour (ALT and
V/S cyan, HDG magenta, HOV and IAS green), and the same colour marks:

- the **mode strip** at the top left: which modes exist at this speed,
  which are on and with what target, and the last change;
- the **lanes**, one per engaged mode, read left to right as cause and
  correction: the deviation it works against (the target is the coloured
  centre line, the aircraft the white mark, the gap filled in colour, the
  predictor's position in 5 s a hollow mark), an arrow, and the correction
  on the control it moves (the trim it has settled to, a 4 s average, is
  the centre line; the control now the white mark; its trail of the last
  2 s; the offset filled in colour). Vertical gauges for height, speed,
  collective and stick fore/aft, horizontal ones for heading, pedals and
  stick left/right, squares for the hover spot and the stick. While the
  correction is above a threshold (1.2 % of travel for the collective and
  the cyclic in the hover, 1.5 % for the cyclic at speed, 2 % for the
  pedals; letting go below 60 % of it) the lane lights up;
- the **targets on their instruments**: the heading bug on the heading
  tape with the arc from the nose to it, the V/S target on the vertical
  speed bar, the hover spot on the ground in the view and in the plan
  view, with a line from below the aircraft to it;
- the **hands on the control indicator**: the control's position, its
  trail and an arrow for where it is moving now, tagged with the mode.

The motion predictor runs the engaged modes too, so its path shows where
the corrections take the aircraft. (2.1-2.3 had the autopilot take single
controls, with a text panel explaining its largest correction: hard to
follow what it did, when and why.)

The **menu** (`J`, the *Autopilot* tab at the top left of the view, or
*Menu* in the side panel; `Esc` closes it; flying goes on): a tile per
mode with its control and target (switches it), the targets with − and +
(height 10 ft in the hover and 100 ft at speed, not below 5 ft and 200 ft;
V/S 100 fpm; heading 10°, snapped to tens; airspeed 5 kt; the hover spot
5 m ahead, back, left or right of the nose), and *All off*. During a tutor
lesson, the `V` demonstration or a replay the modes are off and the menu
says why.

The heading capture at speed is a bank command of 1° per degree of
heading error (up to 20°) with the trim-bank integrator held while the
error is above 3°: a 10° change at 100 kt settles in about 12 s without
overshoot (until 2.0: 0.4° per degree and an integrator that wound up
into a 3° overshoot; the hover and the flight-test trims, which hold a
heading they already have, do not see the difference).
`test/handling.js` checks the presets, a height nudge (+30 ft, climbed
31 ft), a hover-point move (4.4 m along the nose), heading changes in the
hover and at speed, an airspeed change, and that a tutor lesson refuses
the presets.

## Motion predictor (2.4, drawn anew in 2.5 to 2.6)

`src/87_predict.js`. A helicopter answers late: a stick input tilts the
rotor, the tilt rotates the fuselage, the attitude accelerates the
aircraft, and the speed it has keeps carrying it. The predictor shows the
result of everything done so far before it happens: from the present state
it flies the real model ahead, with the pilot's controls held where they
are, the stability augmentation and the engaged autopilot modes (or the
tutor's locks, or the `V` demonstration) working as they would, in steady
wind without turbulence.

**How far ahead.** The prediction is exact for controls held still, and a
pilot does not hold them still. Measured on the model (two predictions
whose stick differs by 1 %): in the hover the predicted spot moves by
0.5 m at 6 s, 1.2 m at 10 s and 4-5 m at 20 s; a hover needs metres, so
beyond ~8 s the path mostly shows corrections not yet made, and a long path
would shrink the plan view's scale past the first metres. Without the
stability augmentation the hover with the controls held diverges outright
(40° nose down after 30 s). In cruise the same 1 % makes 0.3-0.4 m at 6 s,
2.5-4 m at 20 s on a kilometre of track, and 6 s are only 320 m at 100 kt.
So the horizon follows the ground speed: 6 s below 15 kt, 30 s from ~70 kt
(6 + 24·smoothstep(15, 70 kt), whole seconds, changed by 2 s or more), or
4, 8, 15 or 30 s as set in the setup.

**In the view** (WebGL, in the transparent pass, depth-tested, so the path
goes behind buildings, trees and hills):

- a band where the skids will run (2.5.1): 1.2 m below the CG along the
  aircraft's own vertical, its two bright rails 1.1 m either side (the
  skid track), so where it meets the ground the skids meet it. It lies in
  the aircraft's lateral plane (body z × path direction, so it banks into
  a turn); seen edge-on it turns towards the eye, so it keeps its width
  (2.5 drew a line along the middle instead, which read as three lines).
  At least 1.1 m or 6 px either side; across it a soft outer glow, the
  rail, a light fill and a slightly brighter middle; white now, cooler and
  fainter towards the end, the touchdown's colour in the last 1.5 s before
  a touchdown. An arrow on it at every whole second of the clock (larger
  every five; their spacing shows the speed, left out where they would
  overlap). From the cockpit it starts 30-90 m ahead, out at the flight
  path marker (nearer it hangs down across the view);
- while the aircraft is below ~25-60 m: the band's shadow on the ground
  (dark and soft, with a light thread along its middle, readable on the
  dark pad and on grass; it is also drawn from the cockpit, like paint on
  the ground) and a line from the band to the ground at every second.
  2.5 hung a translucent curtain there, which read as a fence;
- at speed, gates: corner marks of a frame 12 m wide from just under the
  skids to above the rotor, square to the path, in the aircraft's lateral
  axis (banked), at every third second of the clock, fading out where they
  would be closer than 8-14 m to each other (so none in the hover). From
  the seat, where the band runs straight ahead into a point, they make a
  tunnel;
- (2.5 to 2.5.4: a see-through ghost of the aircraft 6 s ahead with a ring
  on the ground below it; left out in 2.6, it was hard to read);
- the first touchdown: the skids' footprint and a ring, coloured by the
  sink rate (green below 1.2 m/s, amber, red from the hard-landing limit
  of 2.4 m/s), with the time and the rate; a red cross and the cause where
  the model crashes (the prediction stops there).

**Anchored in the world, eased (2.5.2).** Everything above is drawn from
samples that belong to moments of the clock (every 0.1 s, 0.2 s beyond an
8 s horizon, 0.3 s beyond 12 s), not to "so many seconds from now": a
sample stays where it is in the world while the aircraft flies towards
it, and a new prediction moves it with a time constant of 0.15 s instead
of at once; samples appear over 0.5 s at the far end and are used up at
the aircraft, arrows and gates fade out just before it reaches them. Until
2.5.1 the arrows and gates hung at fixed times from now, travelled with the
aircraft and jumped at every new prediction (10-20 a second). Measured
(`test/handling.js`: frames at 60 Hz, a prediction every 100 ms delivered
50 ms later, the stick moving): a mark 4 s ahead jumped 28 cm from frame to
frame (95th percentile), a mark now moves 0.5-2 cm. 2.5.1's glow running along
the band is gone.

**In the HUD**, next to the control indicator: the plan view (nose up, the
aircraft at the centre: the last 12 s flown as a dotted grey line, the
predicted track from thick and bright to thin and faint with a dot every
second, every five on long paths, an outline of the aircraft and its heading at 6 s
with the rotor circle when it fits, the end, the touchdown, the hover spot
when HOV holds one, the ground speed now; ±5 m to ±2 km) and the height
profile over the same seconds (below ~150 ft the skid height with the
ground as the bottom line, higher up the altitude around the present one;
the ALT target dashed in its colour, the touchdown and
its rate). In windows too narrow for the profile the predicted height
change is a bar at the plan view's edge.

**The plan view as a radar scope (2.5.3).** The plan view and the profile
are not redrawn continuously. Every 1.5 s a ping leaves the centre and
runs out to the edge in 0.6 s (a faint ice-blue ring, at most 22 %
opaque, 1 px, fading as it runs out); where its front passes, the picture
is replaced by the prediction of that moment, beyond it the last ping's
picture stays at 0.85-0.75 of its brightness; between pings the picture
stands and glows down from full to 0.85. (2.5.3 drew the ring at 70 % with
a broad glow and dimmed the old picture to 0.6-0.35; that drew the eye.) The picture is kept in the world (north, east), so
it moves and turns smoothly with the aircraft flying over it and changes
only at a ping: the aircraft can be seen following the path predicted at
the last ping, or leaving it. The scale changes only at a ping. The ground
speed arrow is part of the picture. Live are the range rings, the
aircraft, the track flown and the hover spot. The height profile is
renewed by the same ping, its front a line from now to the end; between
pings its trace moves to the left with time. After a reset the picture is
there at once. `SCOPE.fix` holds the front at a fraction (screenshots).

It runs in a Web Worker on its own copy of the physics modules (the page
carries modules 00-70 a second time as text, `id="engineSrc"`) at 120 Hz
with the control laws at 60 Hz, recording every 0.1 s the position, the
attitude and the skid height, and the first touchdown and a crash.
Measured against the 360 Hz flight from the same start (`test/handling.js`):
0.12 m off after 3 s following a 1.5 m/s push in the hover; with HOV on
after a 2 m/s push 0.08 m at 3 s, and the distance to the spot at 6 s within
0.03 m; in cruise 0.9 m after 30 s on 1.6 km; a lowered collective in the
hover touches down within 0.01 s of the predicted time at the predicted
rate. 30 s take 60-120 ms in the worker (headless Chromium, two cores), 6 s
20-35 ms; a new prediction starts when the last is back, at most 20 a
second, and a result from before a reset is dropped. Drawing costs ~1 ms a
frame for a 30 s path. Where a page may not start a worker, the prediction
runs on the main thread, in slices of 20 physics steps per frame, over at
most four seconds. `P` (or the setup) switches it off; pause is on the
space bar only.

## Click to fly (2.7: the coach leads the way; 2.6: the autopilot flew)

Hold `M`: a cursor appears. With the mouse captured as the stick, the
mouse moves the cursor and the stick stays where it is; otherwise the
cursor is the mouse pointer. Under it the spot: in the plan view (through
the scope's own scale and the aircraft's heading), elsewhere where the
line of sight from the camera meets the ground (marched out to 3 km in
steps of 3 %, then bisected; buildings' roofs count as ground), shown with
its distance and the tutor's column standing there faintly. The wheel
steps the target's height above the ground there through 10 (the ground:
a hover at 3 m, the height of the tutor's targets), 25, 50, 100, 150, 200,
300, 500, 750, 1000, 1500 and 2000 ft; it starts on the ground each time
`M` is pressed. A click (not a pedal, not a capture) sets the target
(`guideSet`, 92_coach.js); a right click clears it, as do a reset and a
tutor lesson. An engaged autopilot lets go of every control without a
bump: the pilot flies.

The target is the goal of the coach's shadow autopilot (`guideGoals`), which
otherwise holds "stand still". Its proportional corrections are the arrows,
as for the hover coach, in gold (`GUIDE_COL`, the column's colour); they
show with the coach switched off too. The goals:

- **Along the way** the ground speed toward the target is 4 m/s plus 1 m/s
  per 30 m, at most 41 m/s (80 kt), limited so that it stops at
  0.6 m/s² (√(1.2·(d − 1.5))) and to 0.4 m/s per metre near the target.
  Below 30 kt IAS (the coach's hover regime) it is a velocity over the
  ground in the hover law, so the wind does not matter, each step asked
  for at most 2 m/s from the present velocity (about 7° of attitude);
  with the target more than 25 m off the nose is turned into the way,
  and while it is more than 45° off the speed is held at 4 m/s. Above
  30 kt the coach's cruise law: an airspeed that makes good that ground
  speed (the present IAS plus the ground-speed error, at most ±3 m/s) and
  a heading that keeps the track on the bearing (the bearing plus the
  present drift angle, at most ±29°), which the cruise law turns into
  bank. Within 3 m the tutor's position hold takes over.
- **Up and down**: the straight line from here to the target, lifted
  over a hill on it: sixteen points along the line, from 10 m out to 20 m
  short of the target, must clear the ground by the height there would
  be over flat ground (the present and the target height above the
  ground, interpolated, 3 to 15 m). The vertical speed asked for is the
  ground speed along the way times the slope of that line, within 15 m
  of the target 0.3 /s of the height still to go; descents at most
  2.5 m/s (500 fpm) at low speed against vortex ring, 5 m/s from 40 kt,
  climbs 2.5 and 4 m/s. Where the line is steeper than that allows, the
  speed along is held back so that the height can follow (at least
  3 m/s).
- **Reached**: within 3 m, 1.5 m of the height, slower than 0.8 m/s and
  0.5 m/s vertically for 2 s, or landed within 6 m of a ground target
  with the collective down. The target is then cleared, the column fades
  over 2.5 s, and the coach is the green "stand still" again.
- **On the ground** the only arrow is the collective's: lift off.
- The coach learns the trim attitude only while the speed is steady
  (less than 0.3 m/s² of acceleration, smoothed over 0.5 s) on the way:
  a flare held for half a minute would otherwise be learned as the trim
  and ask for ever more nose-up.

Shown: the tutor's column at the target (`guideGL` in the 3D pass; for a
point in the air from the ground to 6 m above it, with a ring of 4.5 m at
the height), fading for 2.5 s when reached or cleared; a gold diamond with
the distance where the target is when the column is too far to see (more
than 40 m off, or 15 m above or below); a gold bug on the heading tape at
the target's bearing (a pointer at the tape's end beyond ±57°) and left
of the tape the distance, the height to go and the time at the present
speed; the target in the plan view, with a pointer at the edge beyond its
scale, which takes the target into its range up to 1.7 km.

Measured (`test/handling.js`, a pilot who only follows the arrows: the
mouse stick moved at 3 /s of the stick arrow, the collective at twice the
arrow plus its integral, a pedal key while the pedal arrow is out): a
ground target 150 m away from a 3 m hover is reached after 32 s, 0.4 m
off and 0.2 m off the height, 8 m/s at most; a point 300 m ahead at
100 ft after 46 s, 0.4 m off the height; from cruise (100 kt, about
1500 ft) a ground target 2 km off 60° to the right after 127 s, 28° of
bank and 6.3 m/s of sink at most (1000 fpm asked); straight down from the
high hover after 126 s with 2.9 m/s of sink at most (500 fpm asked). The
first arrows point the right way: stick forward for a target ahead,
pedal for one behind, collective in for one above, bank right in cruise
for one to the right, collective in on the pad.

## Sound (2.8, 2.8.1)

Web Audio (`src/97_sound.js`), started on the first click; every source is
synthesised from the model's state and updated every frame
(`setTargetAtTime`, 50 ms).

- **Main rotor**: an oscillator at the rotor speed (6.6 Hz at 100 % NR)
  with a custom waveform: a negative pressure pulse per blade passage
  (thickness noise), so the energy lies at the harmonics of the blade
  passage (26.3 Hz), with a little once-per-rev between them (blades
  never quite alike) that makes the beat uneven. The thump's harmonics
  follow n^1.5·e^(−n/2) (n the harmonic of the blade passage: the most at
  the 2nd and 3rd, 53 and 79 Hz; 2.8.1: n^1.5·e^(−n/1.7)); the slap's
  n·e^(−n/9) (out to 1 kHz), crossfaded by a slap factor: descending
  200 to 700 fpm at μ 0.04 to 0.22 (30 to 90 kt, blade-vortex
  interaction), vortex ring, μ above 0.30 (the advancing tip). Level
  ∝ (Ω/Ω₀)²·(0.3 + 0.7·T/W). Under it band-passed noise at 480 Hz
  pulsing with each blade passage (the swish), and since 2.8.1 the
  body: noise at 180 Hz pulsing with it, a soft whoosh.
- **Fenestron**: mostly noise in two narrow bands (Q 6) at the blade
  passage (587 Hz at 100 % NR) and its double, as the blades' turbulent
  wakes smear the tones; under it, quieter, an oscillator at its rotor
  speed (8.91 × Ω, 58.7 Hz) whose waveform is the pulse train of ten
  blades at uneven angles (2πj/10 + 0.15·sin(2πj/10)): the 10th harmonic
  gives way to the 9th to 12th, as the published reason for the uneven
  spacing says, low-passed at 0.7 to 2 kHz. Louder and brighter with its
  thrust; the duct's broadband rush at 1.8 kHz.
- **Turbines**: per engine four partials (1, 0.25, 0.07, 0.02) of 920 Hz × N1 (570 Hz at
  idle, the start sweeping up from nothing), a narrow hiss an octave up;
  engine 2 runs 0.16 % faster, a beat of about 1 Hz; the exhaust roar
  (noise below 240 Hz) on power.
- **Main gearbox**: narrow bands of noise (Q 25) at 705, 1062 and
  1868 Hz × NR (typical of the class; the type's own numbers are not
  published), louder with FLI, quiet, in the cabin only.
- **Nothing steady**: three slow random wanderings (τ 0.4 s) move the
  rotor's level (±12 %), the Fenestron's level (±20 %) and its pitch
  (±0.3 %).
- **Air**: noise low-passed at 400 Hz + 12 Hz per m/s, ∝ V²; a canopy
  hiss in the cockpit. **Ground**: skids sliding (noise at 1.1 kHz with
  the ground speed), a touchdown (a falling 70 → 38 Hz thump and a burst
  of noise, scaled by the sink rate above 0.25 m/s), the crash. The
  low-NR horn as before.
- **Where you listen**: the cockpit mixes for a headset (low-pass at
  3.4 kHz; rotor and gearbox full, Fenestron 0.32, engines 0.45), the
  outside views the other way (Fenestron and rotor full, gearbox 0.1); the
  tower adds the distance (1/r beyond 25 m, air absorbing the highs:
  16 kHz/(1 + r/150 m)) and the Doppler factor 343/(343 + ṙ). Then a
  soft limiter and the volume (setup, 70 %).

2.8 rang like metal: its Fenestron and gearbox were pure tones, steady to
the hertz, the gearbox's rung by the blade passage, and the whole mix
6 to 12 dB(A) louder than 2.7 at the same setting. 2.8.1 makes them
narrow bands of noise and lets everything wander a little; measured on
the rendered sound, the spectral flatness between 250 Hz and 4 kHz
(0 dB noise, very negative pure tones) is −11 to −13 dB in flight
(2.7: −12 to −14, 2.8: −16 to −20) at the loudness of 2.7 (−40 dB(A)
in the cockpit hover; 2.8: −33).

`test/soundshot.py` renders the graph offline (an OfflineAudioContext,
the model stepped in fast time, the parameters updated every 23 ms) for
hover in the cockpit and outside, cruise, a descent with slap, a flyby
of the tower, an engine start and a landing; it writes WAV files and
spectrograms and checks the level (−40 to −6 dBFS RMS, no clipping, no
NaN), the headset (6 dB less above 4 kHz in the cockpit than outside),
the touchdown and the Doppler shift (a flyby at 51 m/s, 62 m from the
tower: the pitch going away 0.767 × the pitch coming, 0.77 expected).
`--before OTHER.html` renders another build alongside for listening,
`--solo rot|fen|eng|gbx|air|gnd` one source alone.

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
attitude while still pivoting on its left skid and comes free without a
sideways step (0.16 m/s after a gentle lift-off). Two couplings a pilot's
hands and feet take out are mixed in: pedal with collective (1.15 units of
left pedal per unit of collective in the hover, 0.89 at 100 kt, measured from
the model's equilibria and checked by `test/qualities.js`; after an engine
failure the pedal follows the torque that is really left) and, in the hover
only, roll attitude with collective (7.66° per unit: more power, more
Fenestron thrust, the aircraft has to hang further left). The metered
collective key slows down near the limit and stops just short of it,
judged by the power the rotor asks for (referred to 100 % NR), not by the
lagging gauge. Above 45 kt the yaw axis turns
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
plan view and height profile of the motion predictor (see Motion predictor), or with the predictor off the drift vector for the hover (the arrow saturates at the ring above 3 m/s and turns amber, with the ground speed beside it), and an incident banner that names the mechanism
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
test/qualities.js               validation by class (VAL/CAL/PHY/REG/KNOWN), modes, bandwidths
test/mutation.js                breaks the model on purpose: does a suite notice?
test/scenarios.js               signs and magnitudes in limit manoeuvres, groups A-E
test/lib/linear.js              trim, quasi-static linearisation, eigenvalues, sine dwells
test/lib/patch.js               EC135_PATCH hook used by the mutation test
test/golden.json                golden values for the REG checks
test/loadfull.js                loads every module (browser code included) with DOM stubs
test/browser.py                 headless Chromium smoke test (playwright)
test/uishot.py                  the README screenshots
test/soundshot.py               the sound rendered offline: WAV files, spectrograms, checks
```

`python3 build.py` after every change to `src/`. The harness reads the
source files directly, so the browser and the tests cannot diverge.

## Licence

Apache-2.0, like Grenzbereich.

## Limits of main and tail rotor (1.7, 1.8)

The turbine lapse k = 1.016 · δ · θ^−1.513 caps every rating; it was
fitted to the published EC135 P2 hover ceilings out of ground effect at
2835 kg (2685 m ISA, 1785 m ISA+20) using the engines' whole load there in
a steady, non-turning hover, and `test/qualities.js` flies
both ceilings for 30 s (no height lost, NR 100 %). An earlier fit was taken in a
hover that was turning: near the ceiling a fast left yaw stalls the
Fenestron in its own inflow and the rotation sustains itself, which is the
unanticipated-yaw trap and has to be excluded from calibration. The fan's
blade stall angle (16°) is set so that it keeps yaw-moment margin at the
hover ceiling; with 14° it stalled at full pedal in calm air.

Pedal turns at 30 °/s near the limit (2910 kg, ISA+20, scenario D1): with
a little margin the rotor-airspeed effect dominates (a yaw in the rotor
direction adds blade airspeed: the left turn climbs, the right sinks, both
mildly); at the limit the left turn is the costly one, the Fenestron's
extra power (55 → 117 kW) droops NR to 98.1 %. A +10 % collective surge
there yaws the nose right at 27 °/s with the pedals still; with the feet
working, 65 % left pedal holds the heading without stalling the fan. A
tail drive failure in the hover spins the aircraft right (134 °/s after 2 s,
less with the collective lowered); at 100 kt the fin holds the nose at about
2° of sideslip, down to about 56 kt: a run-on landing above that speed
(figures from 2.1).

In the developed vortex ring (depth above 0.55) collective beyond the entry
value raises the inflow nearly one for one at 0.75 R, so thrust barely moves
while the induced power grows. Scenario E4, from 1800 fpm vertical at
2500 kg (2.1): collective alone loses 248 m, the sink grows to 3400 fpm and
the aircraft gets out only after 18 s; forward cyclic with collective
(classical) 34 m, Vuichard (right cyclic, left pedal: toward the side the
Fenestron pushes) 31 m. At 2910 kg ISA+20 near the ceiling collective alone
does not get out (293 m lost); classical 31 m, Vuichard 31 m.

What in this is data and what is construct: outside the ring's core the
steady induced velocity follows Leishman's empirical curve (checked at 0.35
and 0.5 vh: within 2 %). The core is Johnson's (NASA TP-2005-213477)
picture: there the heave damping vanishes and a collective pull keeps about
a third of its normal effect (`test/qualities.js` measures 0.33); the
strengths of those terms are set by hand, and the height losses above
inherit them. Until 1.8 the curve carried Leishman's hover factor 1.15 on
top of the blade-element rotor's own losses, which took the heave damping
away at a quarter of vh; the power-settling term remembered the collective
at ring entry, so a held descent settled to a flow that depended on the
path (33 % more power at 0.6 vh after a pull than without one); and the
pull term was one-sided, which turned the thrust fluctuations into a steady
extra inflow. All three are fixed: the curve joins the momentum inflow at
zero descent, the settling term refers to the collective of the last few
seconds, the pull term acts both ways.

## Rotor sense (1.8)

The EC135's main rotor turns counterclockwise seen from above, as the BO105
and BK117 it descends from and as most US helicopters: Airbus Helicopters
Information Notice IN 3540-I-00 lists the EC135 P2+ among the types "with a
main rotor rotating counterclockwise when seen from above", and the flight
manual quoted in AAIB report AAR 3/2015 describes the double engine failure
as a "yawing motion nose left". Until 1.8 the model turned clockwise, as the
Aérospatiale designs do, and every sign that depends on it was mirrored: the
pedal with power, the low skid in the hover, the yaw at a power loss, the
retreating side, the transverse-flow roll, the Vuichard direction. Neither
the author of the model nor the first reviewer caught it; the author of the
flight-test cards did, writing expectations from sources without seeing the
model.

The rotor code was written for either sense (`H.rotor.s`); 1.8 makes the
Fenestron side, its pedal sense, the fin camber and the pilot aids follow it
too, and `test/qualities.js` checks that the clockwise model, mirrored, is
the exact mirror image of the counterclockwise one. The scenario checks were
mirrored with it.

## Simulated flight test (1.8)

`flighttest/` holds a flight test without a test pilot, split into three
roles that do not see each other's work. `plan.json` is the test plan: 19
manoeuvres from the hover to 140 kt, with conditions and scripted inputs.
`cards.json` holds the author's expectations: 87 of them, written from
sources (Padfield, Johnson, Leishman, Prouty, the FAA handbook, ADS-33, the
EASA type certificate, Airbus notices, the AAIB report on G-SPAO with its
flight-manual extracts, DLR identification of the EC135, NASA BO105 data),
each with a range, a source and a confidence. The cards were frozen before
the flight (`cards.sha256`). `pilot.js` flies the plan and writes
`results/<id>.json` (metrics and 20 Hz time histories). `verdicts.json` holds
the evaluator's judgement, made without access to the model, and
`report.js` builds `report.html`.

First flight (after the rotor-sense correction): 66 PASS, 13 NEAR, 8 FAIL;
11 cards pass, 6 are mixed, 2 fail. Correct in sign and size: the hover trim,
cyclic responses in both axes, the unstable hover oscillation (period
13 s, doubling 5 s), heave and yaw with collective, translational lift, the
power bucket, the 100 kt doublet, speed stability, roll control at low g, the
turn, the 65 kt autorotation and the vortex-ring recoveries. Open, most
severe first: rotor speed keeps falling after the lever is down in a hover
power loss (minimum 68.6 % against 72–90 %); retreating blade stall rolls the
aircraft past 100° of bank (−5 to −35° expected) and starts at 1.2 g (1.4–1.9 g
expected); above 80 kt the trim pedal moves back toward the anti-torque side
and the Fenestron takes more power at 140 kt than in the hover; hover yaw
damping after a pedal release about a third of the identified −0.5 1/s; the
vortex ring's thrust fluctuations 3–4 % against 10–40 %; the Dutch roll 1.9 s
against 2.5–4.5 s. These were the work list of release 1.9.

## Second flight and what changed (1.9)

The cards stayed frozen. Before the second flight:

- **The test pilot's balance.** The autopilot that trims each condition (and
  every reset in the trainer) turned the ball toward the centre so slowly
  that it never got there within its minute, and its pedal integrator
  stopped at 0.4: the high-speed pedal of the first flight was partly that
  limit. It now holds the heading with the bank and balances with the
  pedals as a pilot does: nose on the flight path at 40 kt, ball centred
  from 80 kt, blended. Centring the ball at low speed would take a large
  sideslip, because in balanced flight the fuselage's side force must
  balance the whole tail force, Y_tail ≈ Q/l (torque over tail arm), and the
  fuselage gives only q·6.7 m² per radian: ~25° at 40 kt, ~5.5° at 100 kt.
  Zero sideslip instead needs a bank of Y_tail/W, ~5° at 135 kt, which no
  pilot flies in cruise. The pilot aids use the same blend.
- **Fin and Fenestron.** The fin's camber and incidence, as a zero-sideslip
  lift coefficient, went from 0.30 to 0.90 (stall now on the effective
  angle, at 24°): in balanced cruise the fin takes about two thirds of the
  anti-torque, the Fenestron 36 % at 120 kt (it had nearly all of it, and
  60 kW at 140 kt). The lift slope stays where the DLR Dutch roll put it, so
  only the camber was free. The steady autorotation then needs ~0.7 kN of
  reverse fan thrust against the fin; the right pedal stop went from −10°
  to −25° of fan pitch so that the ball can be centred short of the stop.
  The duct's momentum now includes the axial flow (ram drag), the main
  source of the fan's yaw damping.
- **Inertias.** Rotor polar inertia 2000 kg m² from the Airbus simulation in
  AAIB AAR 3/2015 (double engine failure at 40 kt, full collective: 69–71 %
  at 2 s); yaw inertia 6300 kg m² from the DLR Dutch roll at 60 kt.
- **Dynamic stall** (rotor blades), **vortex-ring roughness** (slower, and no
  longer cancelled by the recirculation feedback), **downwash across the
  fuselage strips**, the frontal drag area re-fitted (1.58 m²), the aids'
  mixing re-measured.

Second flight, new evaluator: 69 PASS, 13 NEAR, 5 FAIL; 14 cards pass, 4 are
mixed, 1 fails. Fixed: F1.6, H1.4, H8a.3, F6.2 (and F7.4 from NEAR). Still
open:

- **H7, hover power loss (red flag).** NR bottoms out at 74 % (inside
  72–90 %), but at 4.15 s, after the descent has passed 3,400 fpm. With the
  lever down the rotor still makes ~40 % of the weight in thrust, so its
  own vh is ~7 m/s, and on Leishman's curve a rotor windmills only beyond
  ~1.8 vh of descent; until then the net flow through the disc is downward
  and the flat-pitch rotor needs torque. The card expects windmilling from
  ~2,000 fpm. Whether the ring forms that fast in a transient (it needs
  seconds to build) is the open question.
- **F7.3, retreating blade stall.** Onset moved from 1.2 to ~1.35 g; the
  roll-off is unchanged (past 90° of bank). The 1 g trim at 140 kt already
  has the retreating tip at ~15°; tip twist relief, the swept tip and
  blade torsion are not modelled.
- **H4.2 / H2.5, hover yaw.** The decay after a pedal release has a time
  constant of ~4.9 s against 1.4–3 s. The linearised Nr is −0.43 1/s, inside
  the identified range; in the time history the governed rotor adds its
  polar inertia to the yaw axis and the governor's torque lags.
- **F9.4, sideslip in balanced flight**: ~6° at 100 kt against the author's
  estimate of ≤ 3° (medium confidence). In the model it follows from the
  balance above; ≤ 3° would need about twice the fuselage side-force
  derivative. No flight data was found to settle it.

## Third flight and what changed (2.1)

The cards stayed frozen. Before the third flight:

- **Fuselage side force by the crossflow principle.** Until 2.0 each strip
  of cabin and tail boom took the whole airspeed into its crossflow, which
  made the fuselage a lifting surface: weathercock-stable (+0.06 m³/°) with
  a yaw damping of −0.25 1/s at 90 kt. Kampa et al. 1997, Fig. 18 break the
  EC135's directional derivatives down by component (Eurocopter's model,
  checked in flight): the fuselage −0.26 m³/° (destabilising) and about no
  yaw damping, fin and Fenestron +0.51 m³/° and −1.35 1/s, the whole
  aircraft +0.25 m³/° and a dihedral of −0.30 m³/°. Now each strip feels
  only the flow across the body (its own sideways velocity, the yaw rate
  times its arm, and under the disc the downwash), the cabin adds a
  low-aspect-ratio side force near the CG (q·6.7 m² per radian, |u|·v),
  and the destabilising Munk moment volume is set to Kampa's fuselage value
  (**CAL**). The rest then matches without fitting (**VAL**): fin and
  Fenestron +0.58 m³/° and −1.09 1/s, total +0.33 and −0.28 m³/°. The
  vertical force follows the same principle plus the cabin's lift, so at
  140 kt the fuselage no longer presses the rotor down with 1.6 kN.
- **Yaw inertia** 4900 kg m², chosen again with the DLR Dutch roll at 60 kt
  (1.61 rad/s against 1.80–1.86, inside the band; its damping, 0.23 against
  0.24–0.28, is not fitted). The 1.9 value, 6300 kg m², had been fitted to
  a fuselage that damped yaw by itself.
- **Fin**: camber 0.83, set with IN 3540 to zero Fenestron thrust in
  ball-centred cruise at 120 kt; centre of pressure 1.45 m above the CG,
  for Kampa's fin-and-Fenestron dihedral (−0.12 m³/°).
- **Fenestron.** Reverse thrust now comes from the fan's own disc: the
  shroud adds nothing in reverse, so the fan works as an open fan of its
  disc area. Until 2.0 the relation took a quarter of the disc; in cruise,
  where the fan runs near zero thrust, its induced flow then cancelled most
  of a sideslip's effect and the fan's weathercock and damping came out at
  ~40 %. The duct's augmentation fades with the crossflow relative to the
  fan's through-flow, four times faster for the flight speed across the
  duct than for the rotor downwash, which only grazes the upper lip. With the corrected relation the 1.9 right stop
  (−25°) gave 2.1 kN of reverse thrust in the hover and left the steady
  autorotation at mid-pedal; set again with IN 3540, the stop is −11°:
  autorotation at 65 kt needs 0.89 of right pedal and −620 N.
- **Blade torsion under stall.** A stalled section's centre of pressure
  moves aft (here 0.20 of the chord times its separated share of the
  normal force); the moment twists the blade nose down through the
  torsional stiffness of blade and control path (9 kNm/rad at 100 % NR,
  first torsion mode ~4.4/rev, both estimates), with a 6 ms lag. In the
  140 kt trim the blades twist 0.5°; in the stalled pull-up 2°, enough to
  unload the retreating tip: the roll-off at 3 s fell from −112° to −56°
  and the aircraft rolls back.
- **Drive train.** Gear mesh losses of 2.5 % of the torque passed, 4 kW of
  gearbox accessories (9 kW before; the generators sit on the engines and
  stop loading the rotor when both engines quit), the FADEC's load
  feed-forward through a 0.15 s filter (instant before: a collective step
  drooped NR by only 0.27 %, against 0.3–3 % expected). The hover power at
  the engines rose from 436 to 442 kW; turbine lapse and drag area fitted
  again.
- **Test pilot.** Heading changes summed along the record; until 1.9 they
  were taken modulo 360°.

Third flight, new evaluator: **74 PASS, 8 NEAR, 5 FAIL; 14 cards pass, 4
are mixed, 1 fails** (second flight 69 / 13 / 5). Passing now: the Dutch
roll at 100 kt (2.55 s, ζ 0.32; F4.3) with its roll coupling (F4.4) and
the pedal doublet (F4.1), the sideslip in the roll pulse (F3.4), the
rotor-speed droop of a collective step (H5.4), the power curve (F1.2).
From FAIL to NEAR: the stall roll-off (F7.3, ~1.7 times the expected
bank) and the ball-centred sideslip (F9.4, 3.55° against ≤ 3°). Two
expectations went from PASS to NEAR on the same or nearly the same data
(H3.1, F6.2) and one from NEAR to FAIL (F1.5, +4.0° against +3.8°):
evaluators differ at the margins. Still FAIL, with the developer's reading (also in the report):

- **H7.3, rotor speed after a power loss in the hover (red flag).** The
  minimum, 74 %, is inside the band but comes at 4 s and 3,300 fpm. With
  the lever down the rotor windmills only beyond ~1.8–1.9 vh of the thrust
  it carries (Leishman's curve); in addition the cabin spins left at
  ~150 °/s, which lowers the rotor speed relative to the cabin (the gauge)
  by ~6 %. A steady vertical autorotation needs ~4,000 fpm in the model.
- **H4.2 and H2.5, hover yaw.** The model's N_r is −0.56 1/s against about
  −0.5 identified by DLR. The decay after a pedal release is not first
  order: part of the damping is quadratic (the boom's crossflow drag), and
  the sideways drift the step leaves turns the nose into the wind (with
  the drift held at zero, 19.6 instead of 25.1 °/s at 6 s). The yaw from a
  lateral drift (H2.5, 8.9 °/s at ~2 m/s) is what hover derivatives of the
  BO 105's size give (Heffley 1979, 10 kt: N_v 0.047, N_r −0.47 → ~12 °/s
  at 2 m/s).
- **F1.5, collective at 135 kt**, 4.0° above the hover value against
  −1.5…+2.5°: the hover power is at the bottom of the author's band (442 kW)
  while the cruise power is calibrated; for the BO 105 the trim collective
  at 135 kt is ~3.4° above the hover value.
- **F3.3**, a +1.2 °/s yaw for 0.4 s at the start of a roll pulse at
  100 kt where a small nose-left yaw was expected (low confidence); the
  sign depends on the roll–yaw product of inertia and the rotor's torque
  change in a roll, neither published for the type.

Not covered by a card, flagged by the evaluator: with the controls fixed,
a +5 m/s speed disturbance at 80 kt rolls the aircraft 20° left within
10 s (1.9: 14°), and a double engine failure at 100 kt with the controls
fixed for a second rolls it 35° (1.9: 12°). Both follow from the larger
sideslip the new yaw axis allows (the yaw rate at the failure is 28 °/s,
inside the card's 10–50 °/s) acting through the dihedral effect that now
matches Kampa; 2.2 traces them to the cambered fin's N_u (below).

## Fourth flight and the end of this iteration (2.2)

The fourth flight changes no flight physics. It closes the iteration that
began with the first flight test (1.8): the test pilot now flies three
cards the way the plan says, and every item still open gets a final
reading from measurements on the model rather than a guess.

Test pilot, as the plan says:

- **H8a/H8b**: the recovery starts at the plan's 1,800 fpm of vertical
  descent (until 2.1 at ~1,530 fpm, the first of 1,750 fpm or a ring depth
  of 0.8). In H8b the attitude pilot pitches 10° nose down from the entry
  attitude (until 2.1 to −10°, ~13° below it). The thrust fluctuation is
  also recorded detrended (thrust minus its 4-s running mean): 15 % peak
  to peak in H8a, against 48 % for the raw extremes, which include the
  collective step and the deepening descent.
- **F6**: the collective stays full down after the failure (until 2.1 the
  autopilot's autorotation mode raised it slightly to hold NR near
  100 %). The steady autorotation at 65 kt then turns at 110.8 % with
  2,210 fpm: inside the card's 95–112 % and 1,400–2,300 fpm, above the
  106 % power-off limit a pilot would hold with the collective.
- **H6**: a doubling time from the growth of successive extrema (4.8 s)
  replaces as the headline the time at which an extremum first reached
  twice the first one (14.2 s), which read like a doubling time.

Final readings of the items left open after the third flight:

- **H4.2, hover yaw decay after a pedal release.** The yaw moment budget
  of the recording: at the release the Fenestron returns to its trim
  thrust plus its damping, but the rotor speed dips to 99.4 % as the
  cabin's yaw slows, and the governor's extra torque (+0.7 kNm at the
  mast) reacts on the cabin in the sense it was turning. With the rotor
  speed governed, the rotor's polar inertia (2000 kg m², fitted to the
  AAIB's Airbus simulation) joins the yaw axis for a few seconds. The
  aerodynamic yaw damping, −0.56 1/s, matches the DLR identification
  (about −0.5), whose model carries the rotor speed as a state of its own.
  A fifth of the rate left at 6 s is the drift (held at zero: 19.6 instead
  of 25.1 °/s). Kept: it is physics, and no EC135 hover yaw record was found
  to say the coupling is weaker.
- **H2.5, yaw from a sideways drift.** The budget of the recording: the
  sideways flow into the Fenestron at up to 2.4 m/s of drift lowers its
  thrust by 4 %, the rotor's torque wins by 0.25 kNm, and the nose follows
  the drift; with the drift held at zero the pulse yaws the aircraft not
  at all. The hover N_v (0.016 1/(m·s) linearised, ~0.023 at 2 m/s) is a
  third to a half of the BO 105's near the hover (Heffley 1979, 10 kt:
  0.047), so the effect is not overstated. Kept.
- **H7.3, rotor speed after a power loss in the hover.** Power budget of
  the recording: after the lever is down at 2 s the flat-pitch rotor still
  needs 20–28 kW until ~3.5 s, and the Fenestron, its pedal fixed by the
  card, takes another 16 kW; NR falls ~2 %/s until the rotor starts to
  drive itself at ~3.8 s and 3,300 fpm, where the empirical descent curve
  puts windmilling (beyond ~1.8–1.9 vh of the thrust carried). The cabin's
  left spin (~150 °/s) lowers the gauge reading by ~6 %. Kept: it is the
  card's fixed pedal and the measured descent curve.
- **F1.5, collective at 135 kt** (+4.0° above the hover value). The
  cruise power is calibrated; the hover power (442 kW) sits at the bottom
  of the author's band; the BO 105 needs ~3.4° more at 135 kt than in the
  hover. Kept.
- **F3.3, first yaw in a roll pulse at 100 kt.** The product of inertia
  (650 kg m², an estimate) turns the roll acceleration into a nose-right
  yaw acceleration for the first 0.4 s; the aerodynamic N_p at 100 kt is
  adverse (−0.79 1/s) and takes over when the roll rate steadies. Neither
  is published for the type. Kept.
- **F5 and F6, the large rolls with the controls fixed** (not on a card,
  flagged in the third flight). The spiral mode is stable at 60–100 kt
  (time constant ~11 s). The roll comes from N_u: at speed the cambered fin
  carries the anti-torque, and its moment grows with the dynamic pressure
  while the rotor's torque hardly changes near the bucket, so a speed
  increase yaws the nose left (N_u −0.065 to −0.075 rad/s² per m/s at
  60–100 kt). With the controls fixed the sideslip that follows rolls the
  aircraft through the dihedral effect, which matches Kampa's. After the
  double engine failure at 100 kt the yaw rate (28 °/s) and the sideslip
  (+21°) are inside the F6 card's bands; the 35° roll follows from them.
  Kept.
- **Retreating blade stall onset (KNOWN, 1.23 g against ~1.7 g).** Part of
  the gap is a definition: at 140 kt and 2910 kg the rotor carries 11 %
  more than the weight in level flight (the stabiliser holds the hub's
  10 kNm nose-down moment with 2.1 kN of downforce, the fuselage adds
  0.7 kN), so the thrust coefficient at 1 g is C_T/σ 0.103, and the model
  stalls at about 0.127, 80 % of the published limit. The rest is the
  retreating tip at 16° in the 1 g trim (no radial inflow variation, no
  tip relief). Changing it would move every calibration; it is left for a
  next iteration with the pitch bandwidth. (2.3 found that the comparison
  itself was wrong: see the next section.)

## The two open physics items (2.3)

**Retreating blade stall: now a validation, not a deviation.** Kampa's
Fig. 22 is a limit: the highest blade loading the EC135 reached against
the advance ratio (C_T/σ from load factor times weight: 0.20 at μ 0.2-0.23,
0.18 at 0.30, 0.155 at 0.36, 0.12 at 0.40, with flight points along it).
Until 2.2 the suite compared it with the load factor at which 10 % of the
model's disc first stalls (1.2-1.3 g), but local stall begins well below
the limit load, on the model as on the aircraft. The suite now flies an
abrupt pull-up from 140 kt at 2910 kg (aft cyclic 25 % of the travel in
0.5 s, wings held level with the lateral cyclic) and compares the peak
blade loading with the limit at the advance ratio where the peak occurs
(the aircraft slows as it pulls up): C_T/σ 0.175 at μ 0.311 against 0.176,
ratio 0.992, at 1.87 g. Nothing in the model was fitted to the figure (the
airfoils' stall comes from their published polars), so the row is VAL
(band ±10 %). A slower pull (3 s ramp, 35 %) peaks at 0.208 at μ 0.17
against 0.200 (+4 %). The onset (1.29 g) stays as a golden value.

**Pitch bandwidth: still open, but traced.** First the measurement: the
sweeps now keep the collective at its trim value, as in a flight-test
sweep; until 2.2 the autopilot held the height with it during the pitch
sweeps, which added up to 50° of phase lead below 1.5 rad/s (the roll
result does not change). Measured that way: 3.01 rad/s and 70 ms against
1.84 rad/s and 92 ms (2.2's method: 2.94 rad/s, 67 ms).

The bandwidth comes from the short-period mode. Linearised at 75 kt:
M_w −0.063 rad/(m·s) (the stabiliser −0.10, rotor and fuselage +0.037),
M_q −3.0 1/s, Z_w −0.75 1/s, short period 2.15 rad/s at ζ 0.87; the pitch
attitude response has the Z_w zero near 0.75 rad/s, so between 1 and
3 rad/s it lags less than a rate system would. What it would take to
reach 1.84 rad/s, measured on the model:

| change | pitch bandwidth | phase delay |
|---|---|---|
| none (2.3) | 3.01 rad/s | 70 ms |
| rotor wake on the stabiliser through cruise, its downwash 1.3 or 1.8 times the induced velocity and following the thrust | 2.85 / 2.79 | 68 ms |
| stabiliser lift halved | 2.38 | 74 ms |
| no stabiliser | unstable below 0.5 rad/s | |

So only taking most of the stabiliser's angle-of-attack effectiveness
away would get there, and Kampa et al. write the opposite: the stabiliser
(inverted GA(W)-1 with Gurney flaps and end plates) was sized together with
the fuselage and the rotor for good to acceptable values of M_α and M_q.
The published figures point elsewhere: an equivalent time delay of 125 ms
in pitch (the paper's Table 4) where the model's phase delay is 70 ms, so
the model lacks delay in pitch that it does not lack in roll (where the
servo lag was fitted to the phase delay). Candidates without a source are
the longitudinal inflow's lag behind a pitch rate, the time the rotor wake
takes to reach the tail, and the pitch inertia (an estimate). DLR has
identified the type's derivatives against speed (Seher-Weiss, JAHS 2019,
Fig. 13) but publishes them only as plots. Fitting a pitch lag or the
stabiliser to the bandwidth without such a source would make a CAL row out
of a guess, so the row stays KNOWN (bound 3.3 rad/s).

## Validation (1.8)

Release 1.8 came out of an independent review: a reviewer who had
not written the model read the code against textbooks (Padfield, Johnson,
Leishman), the EASA type certificate and the 1997 ERF paper, ran its own
experiments and reported. It found three defects in the rotor (lift along
the shaft instead of the blade normal; the inflow roll gradient with the
wrong sign, which halved the pitch damping; the tip-loss factor that never
acted because the outer element sat inside it), one in the yaw axis (the
airframe reacted the whole engine torque, including what drives the
Fenestron), engine ratings that did not follow the type certificate, and a
test suite that mostly checked ranges the model had been tuned into. All
are fixed. While re-testing, five more turned up: the vortex-ring inflow
curve above, the fin and stabiliser taking the dynamic pressure of flow
along their span (in a steep vertical descent the fin's camber yawed the
aircraft at 7 °/s), fuselage moments that stayed on in pure crossflow, a
FADEC loop at ζ ≈ 0.1, and training-aid mixing that a vortex-ring point in
its regression had skewed by 45 %.

The new suite `test/qualities.js` labels every check:

| Tag | Meaning | Examples |
|---|---|---|
| VAL | published figure, not tuned to | climb at MTOW: published ~1500 fpm without a power setting; the model gives 1560 at MCP and 1870 at take-off power (weak) |
| CAL | published figure a parameter was fitted to | hover ceilings, flown (turbine lapse); 137 kt at MCP (drag area); roll bandwidth 3.69 rad/s and phase delay 58 ms (servo lag; Ixx from the same paper); since 1.9: Fenestron share of the anti-torque in cruise and the autorotation pedal (fin camber, Airbus IN 3540), NR after a double engine failure at 40 kt (rotor inertia, AAIB AAR 3/2015), vortex-ring roughness (its amplitude) |
| PHY | physics or internal consistency | thrust follows the tip-path plane (1.10); inflow gradients on the lifting side; roll and pitch damping of the isolated rotor symmetric (0.996); Xu < 0, Mu > 0, Lv < 0, Nv > 0; hover power ∝ mass^1.28; autorotation energy balance 1.04; steady descents on the empirical vortex-ring curve and path-independent; collective weak in the ring; aids' mixing within 4 % of the physics |
| RULE | published limit, implemented as written | rating ratios equal the certificate's at sea level and at 3000 m ISA+20; the OEI time-limit clocks fire on time; NR limits |
| REG | golden value | derivatives, modes, bandwidths (`test/golden.json`) |
| KNOWN | open deviation | pitch bandwidth 3.01 against 1.84 rad/s, phase delay 70 against 92 ms (until 2.2 also the retreating-blade stall onset, 1.3 against ~1.7 g, which compared two different things; now a VAL row on the peak blade loading) |

The re-check of the fixes by the same reviewer moved rows from VAL to CAL
and RULE: the roll phase delay had been labelled VAL although the servo lag
was chosen to match it, the climb comparison had silently assumed maximum
continuous power, and two "validations" compared a typed-in constant with
itself. It also found the ceilings missed when flown (the engines carry
14 kW of accessories and friction that the fit had left out), the OEI
ratings 20 % off the certificate's ratios (separate turbine estimates set
them), and the vortex-ring steady state depending on the path. All of that
is fixed. What remains open is listed under the KNOWN rows and in the
README's limitations: very little of the model is independently validated,
because the published data for the type is thin and most of it went into
calibration.

The pitch deviation is left open on purpose: the obvious knobs (pitch
inertia, servo lag) would move the roll axis or need a value without a
source. Candidates are the fuselage pitch damping, the stabiliser in the
rotor wake at 75 kt, and the pitch inertia (an estimate).

`test/mutation.js` asks the reverse question: does the suite notice a wrong
model? It breaks the model 33 ways (each of the defects above put back, the
rotor turning the wrong way, an inertia doubled, the hub stiffness halved,
δ3, lift slope, drag, tip loss, stabiliser, fin, ground effect, power
settling, governor gains, the lapse's temperature term, a TCDS limit, the
aids' mixing, and what 1.9 and 2.1 changed put back) and runs `qualities
--fast` and `consistency` against each (scenario group E as well for the
vortex-ring mutant). A catch counts as "physics" when a VAL, CAL, PHY, RULE,
consistency or scenario row fails, and as "golden only" when only REG rows
did: a golden value notices a change, not an error.

Result for the 2.1 model and tests (`node test/mutation.js`, 33 mutants; the
seven new ones put back what 2.1 changed):

| # | Mutant | Caught by |
|---|---|---|
| 1 | inflow roll gradient sign reverted (1.7 defect) | PHY inflow gradient on the lifting side |
| 2 | blade lift along the shaft (1.7 defect) | PHY thrust follows the tip-path plane; consistency |
| 3 | pitch inertia doubled | PHY roll/pitch damping ratio |
| 4 | roll inertia doubled | PHY roll/pitch damping ratio |
| 5 | yaw inertia doubled | CAL Dutch roll at 60 kt; consistency |
| 6 | hub stiffness halved (offset 4.35 % with its own flap frequency) | VAL total dihedral against Kampa (golden only until 2.0) |
| 7 | flap/pitch coupling removed | golden only (rotor damping) |
| 8 | vortex-ring power settling removed | PHY collective in the ring; scenario E |
| 9 | Fenestron blade stall at 10° | CAL hover ceiling held; consistency |
| 10 | fuselage drag area +30 % | CAL 137 kt; consistency |
| 11 | turbine lapse without its temperature term | CAL hover ceiling ISA+20 |
| 12 | tip loss off | golden only: the effect (about 2 % of hover power) sits inside the calibration tolerances |
| 13 | yaw reaction from the whole engine torque (1.7 defect) | CAL hover ceiling held; consistency |
| 14 | rotor speed ignores yaw acceleration | PHY angular momentum about the shaft |
| 15 | horizontal stabiliser removed | VAL pull-up peak blade loading against Kampa (since 2.3; golden only before) |
| 16 | vertical fin removed | PHY weathercock N_v > 0; consistency |
| 17 | blade lift slope −20 % | CAL hover ceiling; consistency |
| 18 | training-aid mixing out of step | PHY aids vs physics |
| 19 | rotor turning clockwise again | RULE rotor sense; consistency |
| 20 | power-off rotor speed limit 110 % | RULE NR limits |
| 21 | governor gains / 5 | consistency (NR settling) |
| 22 | ground effect removed | consistency (power in ground effect) |
| 23 | fin camber back to 0.30 | CAL Dutch roll at 60 kt; consistency |
| 24 | dynamic stall off | golden only since 2.3 (pull-up peak blade loading, −3 %; missed before) |
| 25 | vortex-ring roughness cancelled by its feedback again (1.8 defect) | CAL roughness 10–40 % |
| 26 | rotor polar inertia back to 1350 kg m² | CAL NR after a double engine failure at 40 kt |
| 27 | fuselage crossflow with the whole airspeed again (2.0 strips) | CAL fuselage weathercock (Kampa) |
| 28 | fuselage yaw moment volume back to 2.0 | CAL fuselage weathercock (Kampa) |
| 29 | Fenestron reverse thrust on a quarter of the disc again (2.0) | CAL autorotation pedal near the right stop |
| 30 | blade torsion off | PHY elastic twist of the stalled blades; VAL pull-up peak blade loading (+11 %) |
| 31 | gear mesh losses off | CAL hover ceiling ISA |
| 32 | fin at the height of the CG again (2.0) | CAL fin + Fenestron dihedral (Kampa; the check was added after this run found the mutant golden only) |
| 33 | Fenestron right stop back to −25° (1.9) | CAL autorotation pedal near the right stop |

32 of 33 caught, 29 of them by a physics, calibration, rule or scenario
check, three only by golden values (which notice a change but cannot say it
is wrong), one missed. 2.3 re-ran the five mutants the new stall rows touch
(12, 15, 17, 24, 30): all five are caught now, #15 by a validation instead
of a golden value and #24 by the pull-up's golden value, so the run stands
at 33 of 33 caught, 30 by a physics, calibration, rule or scenario check. Several of the new catches are calibration rows: they
say the parameter moved away from the source it was fitted to, which is what
they can say. The fast suites need about eight minutes per mutant on two
cores; the full run with the frequency sweeps is left to the weekly CI job.


