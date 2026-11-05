# Flying manual

How to fly EC135 Flight Dynamics, control by control. The [README](../README.md) has the short version. How the model works and how far to trust it is in [MODEL.md](MODEL.md).

**Contents:** [Menu and side panel](#menu-and-side-panel) · [Levels](#levels) · [Controls](#controls) · [Mouse](#mouse) · [Keyboard](#keyboard) · [Gamepad and joystick](#gamepad-and-joystick) · [Training aids](#training-aids) · [Tutor and coach](#tutor-and-coach) · [Autopilot](#autopilot) · [Click to fly](#click-to-fly) · [Motion predictor](#motion-predictor) · [Views](#views) · [Exercises and failures](#exercises-and-failures) · [Incidents and the flight recorder](#incidents-and-the-flight-recorder) · [The world](#the-world) · [Graphics](#graphics) · [Sound](#sound)

## Menu and side panel

**The menu** opens with `Esc`, or with *Menu* in the side panel or at the bottom right of the view. With the mouse captured, the first `Esc` releases it and the next opens the menu. The flight pauses while it is open.

| Tab | What is in it |
|---|---|
| *Fly* | exercises, lessons, start positions |
| *Aids* | level, stability aids, coach, training displays |
| *Controls* | mouse, keyboard, gamepad and joystick with their buttons, every key |
| *Weather & aircraft* | mass, centre of gravity, temperature, wind, clouds, time of day, visibility |
| *Display* | view, HUD, sound, graphics, head tracking |
| *Failures & data* | failures, start faults, the 20-second chart, replay, CSV |

The settings stay in the browser. *Reset all settings* starts over.

**The side panel** keeps only what flying needs: the large numbers, what you fly now (the exercise with its brief and score, or the lesson's step), the coach, the autopilot and the last incident. After every landing a debrief card shows the touchdown rate, the power and rotor-speed band and the incidents.

## Levels

| Level | Aids | Coach | Displays |
|---|---|---|---|
| *Beginner* | all | cues | all |
| *Intermediate* | all | off | all |
| *Realistic* | rate damping only | off | no predicted path, flight path marker or rotor map |

Set it in the menu's *Aids* tab. The air is calm unless you choose a wind under *Weather & aircraft*.

## Controls

| | Mouse (captured) | Keyboard | Gamepad |
|---|---|---|---|
| Cyclic (stick) | movement, starts at neutral | arrow keys | right stick |
| Collective | wheel | `W` / `S` | left stick vertical, triggers |
| Pedals | (menu: left / right button) | `A` / `D` | left stick horizontal |
| Trim (the attitude flown becomes the centre) | left click | `T` | `RB` |
| Look around | hold right or middle button | hold `C` (the mouse turns the head) | hold `LB` (the right stick turns the head) |
| Glance out of a door window | | hold `Q` / `E` (the mouse keeps flying) | |
| Head tracking by webcam | | `Shift`+`Z` on / off, `Z` centres | |

| Key | Action |
|---|---|
| `Shift` + arrows | beep trim |
| `Y` | back to the hover trim |
| `H` | hover assist (stick = velocity) |
| `V` | autopilot demonstration |
| `U` `I` `O` | autopilot ALT, HOV or IAS, HDG |
| `J` | autopilot menu |
| `M` (hold) | click to fly (wheel: height, right-click: clear) |
| `K` | coach: off, cues, cues + voice |
| `F` | flight path marker |
| `P` | predicted path |
| `1` `2` `3` | cockpit, chase, tower view |
| `4` | approach view on / off |
| `L` | replay of the last 20 s |
| `X` | CSV export |
| `Shift`+`E` | engine start sequence; running: IDLE, then OFF |
| `Shift`+`1` / `Shift`+`2` | one engine's main switch a step: OFF, IDLE, FLIGHT and back |
| `Shift`+`B` | rotor brake (engines off, below 50 % NR) |
| `G` | engine failure |
| `R` | repeat the reset |
| `Space` | pause |
| `N` `B` `Shift`+`Q` | tutor next, back, quit |
| `?` or `F1` | key list |

## Mouse

- **Stick travel.** Full stick is 1600 px of mouse movement. The menu sets the travel and the curve (linear by default, mild and strong progressions).
- **Pointer acceleration.** Switch it off in your system if you can: with it, a quick move out and a slow one back do not return the stick to the same place. Chrome on Windows, macOS and ChromeOS bypasses it by itself.
- **Buttons.** By default a left click trims and the right button held looks around. The menu can make the buttons pedals instead.
- **Collective.** One wheel notch moves the lever 0.4 % (about 50 fpm after 10 s in the hover), a tap on `W`/`S` about half that. Held, the lever moves evenly at 2.5 % a second for 0.6 s and then speeds up.
- **Set the lever by the mark.** The vertical speed answers the lever over 3 to 4 seconds. A blue mark on the VSI and beside the HUD's vertical speed shows where it will be in 6 s, so you can set the lever by the mark and leave it.

## Keyboard

A key is on or off, a hand is not, so each keyboard control has a pilot model:

- The collective is metered against the power and the rotor speed, and thrown down when the rotor droops or the engines quit.
- The pedal keys command a yaw rate with heading hold.
- The arrow keys move the stick in two stages, so that a tap stays fine.

## Gamepad and joystick

Real controls are analog, so a gamepad or joystick is the bigger step. The menu's gamepad panel (*Controls*) shows every axis and button live, learns each function from a single movement or press, and stores the mapping in the browser. Every axis has an *Invert* button.

- **Buttons in the gamepad preset:** `RB` trims, `LB` held looks around, the D-pad beeps the trim, Start pauses, Back resets, Y the autopilot demonstration, X the hover assist, B the next view. In the joystick preset the trigger trims and the thumb button looks around.
- **Stick curve.** Mild by default on the cyclic and pedals (half the stick gives 39 %), also linear and strong. The collective stays linear.

**The best upgrade is analog.** A joystick with a throttle lever (a HOTAS, from about 40 €) is closer to the aircraft than any key or mouse model: the throttle as the collective (a lever that stays where the hand leaves it, like the real one with its friction), the stick as the cyclic, the twist or rudder pedals as the pedals.

## Training aids

On by default. Each can be switched off in the menu's *Aids* tab.

| Aid | What it does |
|---|---|
| **SAS** | rate damping with the trim fed forward |
| **Attitude command** | in the hover a centred stick holds the trim attitude, fine around the centre, 28° pitch and 40° bank at the stops |
| **Heading hold** | rate command and heading hold in the hover, turn coordination with a roll-axis heading hold above 45 kt |
| **Hover assist** | the stick commands a ground velocity (`H`, off by default) |

Two couplings a pilot's hands and feet take out are mixed in with the aids on: pedal with collective, and in the hover the roll attitude with collective.

**Cyclic in forward flight.** Above 45 kt the attitude aid works by the device that flies the cyclic (menu: *Cyclic in forward flight*, `auto`):

- **The mouse** has no centre to feel, so it flies the attitude command with the trim. Stick moved means the attitude moves away from the trim, back to the centre means back to the trim attitude, and a left click or `T` makes the attitude flown the new centre, as the force trim release on a real cyclic does.
- **A gamepad, a joystick or the arrow keys** spring back to the centre by themselves, so they fly the rate command. Deflected, the aircraft rolls or pitches at about the bare aircraft's rates. Centred, it holds the attitude it has, so a turn is a push and back to the centre.

Either law can be set for every device.

## Tutor and coach

**The tutor** has 13 lessons: first the collective, then the pedals, then the stick in five stages.

1. a calm hover, hands-off
2. a tether that lets the aircraft tilt but not drift
3. one axis at a time
4. the stick as a velocity command, with the help faded out
5. the raw stick

Every airborne start begins in a hover trimmed to stand still hands-off, so you first learn what calm looks like.

**The coach** (`K`: off, cues, cues + voice) flies a shadow autopilot alongside you and shows the input it would add now, as arrows on the stick, collective and pedals. One sentence names the cause and the remedy, rotor limits first. Cues are on by default. Speech is opt-in, because it uses the browser's built-in voices, whose quality varies.

## Autopilot

Like the automatic flight control system of the type, you engage what it should hold and it picks the control. Every control no engaged mode needs is yours, and moving a control a mode drives gives it back to you without a bump ("HOV off: you have the cyclic"). It works in free flight.

| Mode | Key | Holds | With | Colour |
|---|---|---|---|---|
| ALT | `U` | height | collective | cyan |
| V/S | menu | climb or descent rate | collective | cyan |
| HDG | `O` | heading | pedals in the hover, bank at speed (and pedals for the ball) | magenta |
| HOV | `I` below 40 kt | position over the ground | cyclic | green |
| IAS | `I` above 40 kt | airspeed | cyclic | green |

`J` or the *Autopilot* tab at the top left opens the menu; the side panel has the same buttons. The menu nudges the targets: height in 10 ft steps in the hover and 100 ft at speed, V/S in 100 fpm, heading in 10°, airspeed in 5 kt, the hover spot 5 m ahead, back, left or right.

It is there to be watched:

- Per engaged mode, a lane at the left of the view shows the deviation it works against and the correction it makes on its control, lighting up while it corrects.
- Its target sits on its instrument: the heading bug, the hover spot on the ground and in the plan view.
- Its hand shows on the control indicator.

`V` is the simplest way in: the autopilot flies everything and you watch how small its inputs are.

## Click to fly

Hold `M`. A cursor appears, and under it the spot on the ground along the line of sight or in the plan view, with its distance. With the mouse captured as the stick, the mouse moves the cursor while the stick stays where it is.

- **Set a target.** A click sets it. The wheel lifts it into the air: the ground means a hover at 10 ft, and it goes up to 2000 ft above the ground there. A right click while holding `M` clears it; so do a reset and a tutor lesson.
- **What you see.** A column stands at the target, a gold bug on the heading tape points at it with distance, height and time left, the plan view marks it, and far away a gold diamond shows where it is.
- **How it leads you.** The coach's arrows turn gold: its shadow autopilot flies the direct way to the target, and its corrections are the arrows on the stick, collective and pedals. The arrows show even with the coach switched off.
- **The way.** A ground speed that grows with the distance (up to 80 kt) and lets you stop at 0.6 m/s², the nose into the way, the straight line down or up to the target, lifted over a hill on the way, at no more than 500 fpm down at low speed (vortex ring) and 1000 fpm from 40 kt.
- **Arrival.** Over the target and still for 2 s it is reached: the column fades and the arrows are green again.

Nothing is driven for you. An engaged autopilot lets go when a target is set.

## Motion predictor

`P` switches it on and off; the menu sets the horizon. It flies the real model ahead from the present state with your controls held where they are, the stability augmentation and the engaged autopilot modes working: 6 s in the hover, growing with the ground speed to 30 s from about 70 kt.

- **The band** runs where the skids will run, tilted as the aircraft will be, with an arrow at every whole second, so their spacing shows the speed. Near the ground its shadow lies on the ground with a line down at every second.
- **Gates.** At speed, corner marks of a gate to fly through every 3 s, square to the path and banked. From the cockpit they form a tunnel.
- **Fixed in the world.** Arrows and gates belong to moments, not to "so many seconds from now": they stay where they are while the aircraft flies towards them, as markings on a road do.
- **Touchdown.** Where the skids will touch, their footprint lies in the colour of the sink rate (green, amber, red from the hard-landing limit) with the time and the rate. A red cross marks a crash.
- **Plan view.** Next to the control indicator, nose up: the track flown, the track to come, an outline of the aircraft where it will be in 6 s, the hover spot, the ground speed. It works like a radar scope: every 1.5 s a faint ping runs from the centre to the edge and renews the picture, so you can see whether the aircraft follows the path predicted at the last ping.
- **Height profile.** Over the same seconds: the skid height near the ground, the change of height higher up, the ALT target.

**Why it does not look further ahead in the hover.** The path is exact for controls held still, and nobody holds them still. In the hover 1 % of stick moves the spot predicted for 6 s ahead by 0.5 m, for 10 s by 1.2 m and for 20 s by 4-5 m, so beyond about 8 s the path mostly shows corrections not yet made. In cruise the same 1 % makes 2.5-4 m after 20 s on a kilometre of track.

## Views

`1` `2` `3` are cockpit, chase and tower. In the cockpit `4` adds the approach view.

**Cockpit.** The view from the right seat over the glareshield, and across the bottom the instrument panel of the P2+, flat and undistorted:

- straight ahead the flight instruments (airspeed, attitude, altitude; radar altitude, HSI, vertical speed) with master warning and caution
- left of them the CPDS: the warning unit with the trainer's limit lamps, and the VEMD with FLI, rotor speed and the engine figures
- the trainer's displays as screens in the panel: control positions, the predictor's navigation display, the rotor state

Looking around shows the view without the panel.

**HUD.**

- Heading tape, airspeed and radar altitude, a horizon and pitch ladder, the flight path marker.
- Under the altitude box the vertical speed scale in fpm: a white pointer with the value now, a cyan bug with the value in 6 s.
- Bottom left the lamps for vortex ring, stall, Fenestron limit, ground effect and drag divergence, with the power line. In the chase and tower views also the rotor speed (NR) and the first limit indicator (FLI: 10 = maximum continuous, 11 = take-off power) as dials.
- Bottom centre the stick, collective and pedal positions, the skid loads on the ground, the plan view and the height profile. Bottom right the rotor-state map, the angle of attack over the whole disc.

**Seeing out.**

- **The cockpit frame:** thin lines of the windscreen's centre post, the pillars, the roof bow and the doors stand in the view as the attitude reference, the horizon against them.
- **Glances** out of the left and right door window at the ground beside the skid (`Q`, `E` held), while the mouse keeps flying.
- **Head tracking by webcam** (`Shift`+`Z`, menu: *Display*): the head turns, the view turns with it, both hands stay on the controls. The camera picture never leaves the browser. MediaPipe's face detector (about 10 MB from jsDelivr on the first start) finds the face 20 times a second on the processor. It works on the live page and in the downloaded file opened directly; a page embedded in another site's frame gets no camera.

**Approach view** (`4`). The gaze lowers 15° towards the landing spot, the panel rises to where it hangs in the airframe, and under it the two chin windows show the ground right in front of and under the skids. The horizon stays at the top of the view. The menu's *chin windows* (*Display*) can switch the windows off.

It comes only by key. On the approach, low and slow after the aircraft has been away (above about 90 m or faster than about 55 kt, or a flight that starts in the air), a hint above the panel offers it. On a departure with the view still on, a hint offers the normal view back. It never comes on the take-off by itself, where the horizon's picture sets the attitude.

**Glide slope.** At the field pad a HAPI light shows the 6° approach slope from the south: flashing green above, green on it, red slightly below, flashing red below.

## Exercises and failures

**Exercises** (menu: *Fly*): free flight, lift-off, cold start, hover over the pad, pedal turns, quick stop, slope landing, a hospital rooftop pad, a confined area, autorotation, vortex ring recovery, an approach behind a phantom aircraft, an engine failure in the hover, and out in the world a mountain top, a forest clearing, a slope on a hill and a high-rise pad in the town.

**Failures** (menu: *Failures & data*): one engine, both engines, the tail drive (no anti-torque).

**Start faults.** A hot or hung start can be armed for an engine's next start. The TOT is watched against the start's limits (760 °C, 875 °C for 2 s) with a warning. The abort is the main switch to OFF, and a turbine left too long is damaged.

**Starting by hand.** `Shift`+`E` runs the sequence. By hand: `Shift`+`B` for the rotor brake, then `Shift`+`1` and `Shift`+`2` for each engine's switch.

## Incidents and the flight recorder

The incident detector names what went wrong, together with the standard recovery: vortex ring, retreating blade stall, low rotor speed, the Fenestron at its limit, dynamic rollover, the load factor beyond +3.5 / −1.0 g.

The flight recorder keeps the last 20 seconds as a strip chart of NR, FLI, vertical speed, vortex ring and stall that freezes after an incident (menu: *Failures & data*), and as a replay through the same instruments (`L`). `X` exports them as CSV.

## The world

Some 14 km across around an airfield, drawn with WebGL and no libraries. Detail goes down to a few centimetres close to the ground.

- **The field:** runway, taxiway, apron and pad markings, a control tower, wind turbines that turn with the wind.
- **Land:** fields of many sizes and crops with hedgerows and farm tracks, eight farms, flowers in the meadows, boulders on the slopes.
- **Mountains** to the north with a pad on a rounded summit (the Kuppe, 260 m), hazy hills on the horizon.
- **Water:** a river from the mountains through its valley into the lake and out of it, a bridge, reeds, a boat on the lake.
- **Settlements:** a village with a churchyard, a hamlet with a chapel, a hospital with a rooftop pad, a town with streets, glass towers, a high-rise pad 66 m up, a crane and a factory.
- **Forests:** some 104,000 trees, 11 to 17 m high, swaying in the wind and bending away from the downwash. Blades in the crowns are a crash, as is a wire through the disc.
- **Life:** cars and trucks on the roads, three flocks of birds that scatter from the aircraft, smoke from chimneys and the factory's stack.
- **Downwash:** it flattens the grass in moving rings, raises dust off ploughed fields and spray off the lake.

The menu sets the time of day (the sun's position and colour, the sky and the light follow), the visibility and the cloud cover, whose shadows drift over the land. Everything casts its shadow along the sun, long in the morning and the evening.

More screenshots, the world's among them, are in [`screenshots/`](screenshots).

## Graphics

The view is drawn at the screen's own pixel density and always antialiased, and every pattern on the ground is filtered so that it does not shimmer.

| Setting | What it does |
|---|---|
| **Auto** (default) | lowers the drawing resolution while frames come late and raises it again when there is room |
| **Full** | keeps the resolution |
| **Light** | for weak graphics hardware: simpler shaders, a thinner forest, the same physics and cues |

If the browser is not using the GPU at all, the side panel says so. The menu's **performance test** measures, where the aircraft is, the view in eight variants and gives the times as text to copy.

## Sound

Synthesised from the model, nothing recorded:

- the main rotor's pulse at every blade passage, a thump that turns into the slap when descending into its own wake or at high speed
- the Fenestron's whine
- the turbines' whine on N1 (the start sweeps it up) and their roar on power, with the slow beat of two engines
- the main gearbox's quiet whine in the cabin, the air, the skids

In the cockpit you hear it through a headset, outside with distance and the Doppler shift of a passing aircraft. The volume is in the menu.
