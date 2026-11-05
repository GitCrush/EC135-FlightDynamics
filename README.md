# EC135 Flight Dynamics

**Learn to hover and fly a helicopter, one step at a time, right in your browser.**

![Hovering over the hospital's rooftop pad](docs/screenshots/hospital-rooftop.png)

The hover is the first thing a helicopter pilot learns, and the hardest. Four controls act on each other, and the aircraft answers every input a little late. If you watch your position, you react four seconds behind and start to oscillate.

EC135 Flight Dynamics teaches that chain one piece at a time. A tutor hands you the controls one by one, a coach shows the correction you owe right now, and a motion predictor draws where the aircraft will be next. Underneath runs a blade-element rotor model of the twin-engine EC135, with its measured figures labelled by how far they can be trusted.

It is a trainer, not a game, and not a certified flight training device.

**[▶ Fly it here](https://gitcrush.github.io/EC135-FlightDynamics/)**: desktop browser recommended, nothing to install.

## Getting started

1. Open the [live page](https://gitcrush.github.io/EC135-FlightDynamics/) and click *Start the tutor – lesson 1* or *Fly free*.
2. Click into the view. The mouse is now the cyclic stick. `Esc` releases it, and `Esc` again opens the menu.
3. `W`/`S` or the wheel is the collective, `A`/`D` are the pedals, a left click trims. `?` lists every key.
4. If something feels hard, press `V`: the autopilot flies and you watch how small its inputs are. `V` again hands it back.

You start as a *Beginner* in calm air, with every aid and the coach. The menu changes all of that. Switch your system's pointer acceleration off if you can: with it, the mouse stick does not come back to the same place.

## What you get

**To learn with**

- **13 lessons** from a hands-off hover to the raw stick. Each step names one thing to do and checks itself.
- **A coach** that shows the input it would add now, as arrows on the controls, with one sentence of cause and remedy.
- **An autopilot made to be watched.** It takes only the controls a mode needs and hands one back the moment you move it.
- **A motion predictor:** the real model flown ahead, drawn as a band where the skids will go.
- **Click to fly:** pick a spot on the ground or in the air, and the coach's gold arrows lead you there while you fly.

**To fly in**

- **17 exercises:** cold start, autorotation, vortex ring, a rooftop pad, a confined area, a mountain top and more.
- **Failures on demand:** one or both engines, the tail drive, hot and hung starts.
- **A world some 14 km across:** mountains, a river, a town, forests whose trees are obstacles, wind that follows the terrain.
- **The EC135 P2+ panel,** a cockpit frame as attitude reference, glances out of the doors, a look down through the chin windows.
- **Sound synthesised from the model,** nothing recorded: rotor, Fenestron, turbines and gearbox.
- **Mouse, keyboard, gamepad or joystick.** The menu learns your controller from one movement per axis or button.

**To learn from**

- **An incident detector** that names what went wrong, such as vortex ring or dynamic rollover, with the standard recovery.
- **A flight recorder:** a 20-second strip chart, a replay through the same instruments, a debrief after every landing, CSV export.

| The coach shows the correction you owe | Click to fly: the coach's gold arrows lead you to the target |
|---|---|
| ![](docs/screenshots/coach-cue.png) | ![](docs/screenshots/click-to-fly.png) |

The simulator is the single file [`index.html`](index.html): no libraries, no assets. You can also download it and open it locally. Only one thing is ever loaded from elsewhere: the face detector from jsDelivr, if you switch on head tracking.

## Controls

| | Mouse (captured) | Keyboard | Gamepad |
|---|---|---|---|
| Cyclic (stick) | movement | arrow keys | right stick |
| Collective | wheel | `W` / `S` | left stick vertical, triggers |
| Pedals | | `A` / `D` | left stick horizontal |
| Trim | left click | `T` | `RB` |
| Look around | hold right button | hold `C` | hold `LB` |

`V` autopilot demonstration · `J` autopilot menu · `K` coach · `P` predicted path · `M` click to fly · `L` replay · `1` `2` `3` `4` views · `Space` pause · `R` repeat · `?` all keys

The best upgrade is analog: a joystick with a throttle lever (from about 40 €) is closer to the aircraft than any key or mouse model. Everything else about flying it is in the **[flying manual](docs/MANUAL.md)**.

## What it cannot do

- **Little of the model is validated against flight data.** The published data for the type is thin, and most of it went into calibration.
- **Do not trust these in absolute terms:** yaw rates, vortex-ring height losses, one-engine margins, hover ceilings away from the two calibrated points, engine start figures.
- **Known deviations:** in pitch the model responds faster than published (bandwidth 2.85 against 1.84 rad/s at 75 kt), and the roll-off in retreating blade stall is about 1.7 times the expected bank. The yaw response has no published reference at all.
- **Not modelled:** structural modes, blade lag, icing, rain, cloud to fly into. The wind over the terrain is an engineering model, not a flow solution.
- **One aircraft, one world,** about 14 × 14 km, daylight only. Cars, birds and boulders are drawn only, not obstacles.
- **Head tracking** follows the head's turn and nod only. It needs a webcam and loads about 10 MB from jsDelivr when first started.
- **The keyboard is a compromise:** every key goes through a pilot model. There are no touch controls.
- **In an embedded frame** some browsers block the gamepad and the camera. Open the page directly.

The complete list is in [MODEL.md](docs/MODEL.md#known-limitations).

---

## Under the hood

The aircraft is an EC135 P2+: 2.5 t, a bearingless four-blade rotor turning counterclockwise seen from above, a Fenestron tail and two turbines with FADEC. It is a textbook rotorcraft model rather than a game-tuned flight model, running at 360 Hz, with every mechanism written down in the code with what it models and why.

| Part | Model |
|---|---|
| Main rotor | blade elements, time-marching per blade; flap dynamics, dynamic stall, blade torsion, tip loss |
| Inflow | Pitt-Peters dynamic inflow; Leishman's curve in the vortex ring; ground effect after Cheeseman and Bennett |
| Fenestron | ducted-fan momentum theory with blade elements and stall, fed by the main rotor's power |
| Engines | two turbines with a FADEC governor, ratings from the EASA type certificate, a freewheel, starts by hand |
| Airframe | crossflow fuselage, stabiliser, cambered fin; skids and tail bumper with friction, so rollover is a consequence, not a script |
| Environment | ISA, wind that follows the terrain, low-altitude turbulence after MIL-HDBK-1797 |

### How far to trust the numbers

The measured figures are tagged by how far they can be trusted: **VAL** compared with a published figure the model was *not* tuned to, **CAL** a published figure a parameter was fitted to (agreement by construction, proves nothing about realism), **RULE** a published limit implemented as written, **KNOWN** an open deviation. Untagged rows are plausibility checks. A sample:

| Quantity | Model | Reference |
|---|---|---|
| Abrupt pull-up from 140 kt, peak blade loading C_T/σ | 0.175 | **VAL** limit 0.176 (Kampa 1997) |
| Climb, 2910 kg, sea level, 65 kt | 1490 fpm at MCP | **VAL, weak** ~1500 fpm, power setting not stated |
| Roll bandwidth and phase delay, 75 kt | 3.66 rad/s, 58 ms | **CAL** 3.7 rad/s, 55 ms (servo lag fitted to it) |
| Engine ratings | ratios as in the type certificate | **RULE** TCDS EASA.R.009 |
| Pitch bandwidth, 75 kt | 2.85 rad/s | **KNOWN** 1.84 rad/s published |

No test pilot was available, so the project simulates a flight test with three roles that never see each other's work: an author writes 87 expectations from published sources and freezes them, a test pilot flies them, and an evaluator judges the recordings. The last flight, on release 2.2, scored **75 PASS, 7 NEAR, 5 FAIL**, with no high-confidence expectation failing. See the [report](https://gitcrush.github.io/EC135-FlightDynamics/flighttest/report.html).

### Read on

| | |
|---|---|
| [Flying manual](docs/MANUAL.md) | every control, the aids, the autopilot, the predictor, the views, the world |
| [Model and validation](docs/MODEL.md) | the physics, all measured figures, the flight test, sources and calibration |
| [Technical notes](docs/TECHNICAL.md) | tables and reasoning, release by release |
| [Changelog](CHANGELOG.md) · [TODO](TODO.md) | what changed, what is open |

## Development

```
python3 build.py     # concatenates src/*.js into html/template.html → index.html
npm test             # physics reference, qualities (fast), tutor, handling
```

Edit `src/`, run the build, commit both. CI checks that `index.html` matches the sources and runs the physics, qualities, tutor, handling and scenario suites on every push, the mutation test weekly. All suites are described in [`test/README.md`](test/README.md).

GitHub Pages serves `index.html` from the repository root. Any static host works the same way.

Physics changes are welcome when they come with a check in the harness and a rationale in the code: every mechanism states what it models, why it is there and what breaks without it. Open work is in [TODO.md](TODO.md); blade lag and touch controls are good first topics.

This project transfers the approach of [Grenzbereich](https://github.com/GitCrush/grenzbereich), a rally vehicle-dynamics trainer, to a helicopter.

## Licence and disclaimer

Apache License 2.0: see [LICENSE](LICENSE) and [NOTICE](NOTICE).

This is an independent training and educational project. It is not affiliated with, endorsed by or derived from data of Airbus Helicopters; "EC135" refers to the helicopter type it models. It is not a certified flight training device and not a substitute for instruction or for the aircraft's flight manual.
