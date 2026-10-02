# Changelog

## 1.6 — 2026-10-02 · Scenario analysis, published as EC135 Flight Dynamics

- New `test/scenarios.js`: signs and magnitudes of yaw, pitch and roll in normal and limit manoeuvres (pedal turns, full pedal, engine-failure yaw, crosswind pedal margins, speed and angle-of-attack stability, retreating blade stall, low g, Vne, quick stop, autorotation landings) and of the aids in those manoeuvres.
- Yaw damping: fuselage side area spread along cabin and tail boom; fin keeps a flat-plate normal force beyond its stall.
- Fenestron reverse thrust without the shroud's lip augmentation.
- Longitudinal cyclic: linear gearing over the published 21.8°, range centred 3.1° forward (control margin at Vne).
- Above 45 kt the yaw axis coordinates turns and the heading is held through a small bank; the hover heading hold no longer fights turns.
- Attitude command with cubic shaping: fine near the centre, 28° pitch and 40° bank at the stops.
- Collective-roll mixing faded out above 20 kt; pedal anticipation follows the real torque after an engine failure; the collective key throws the lever when the rotor droops.
- Autopilot takes over bumplessly (demonstration, tutor); every reset hands over on the spot; tutor test runs on the complete real code.

## 1.5 — Gamepad panel
- Per-function mapping across devices, scaled stick dead zone, learn button per function, slider/throttle detection, stored in the browser; blocked Gamepad API handled.

## 1.4 — Handling audit
- New `test/handling.js` for the human control path. Fixes: bumpless law changes, trim keys (T trims to the present attitude, Shift + arrows beep trim, Y back to the hover trim), measured hover trim for pad starts and lift-off on the skids, torque anticipation 1.29, collective-roll mixing, locked tutor axes keep the stick centred, anti-wind-up.

## 1.3 — Pedals
- Rate command with heading hold: the heading is captured when the aircraft has stopped turning; no swing-back after release.

## 1.2 — Trimmed hand-over
- Attitude command around a measured trim with integrators; every airborne reset hands over a trimmed aircraft; new tutor lesson "Calm hover".

## 1.1 — Coach with voice
- Off / cues / cues + voice; sentences with cause and remedy; green = move this way, red = rotor limit.

## 1.0 — Coach
- Shadow autopilot shows the correction on screen; drift indicator always visible.

## 0.9 — Calibration
- Rotor, controls, stabiliser and Fenestron calibrated to the ERF 1997 EC135 design paper.

## 0.8 — Pointer lock and control audit
- Mouse captured as a virtual stick; `test/controls.js`; pitch sensitivity corrected.

## 0.7 — Stick lessons
- Five-stage stick block in the tutor (tether, one axis at a time, hover assist faded out, raw stick); look-around.

## 0.6 — Flight recorder
- Replay of the last 20 s, autopilot demonstration, debrief card, key list.

## 0.5 — Realism and UX
- Overpitch, autorotation rotor speed and rotor run-down corrected; welcome card; German interface.

## 0.4 — Tutor
- Step-by-step lessons that hand the controls over one axis at a time.

## 0.3 — Scene
- Terrain from noise, lake, airfield markings, forests, village, hospital rooftop pad, sky with clouds; shader precision fix.

## 0.2 — Envelope
- Vne and crosswind behaviour, cold start and shutdown, fuel burn, strip chart, scoring, sound.

## 0.1 — 2026-09-28 · First flight
- Blade-element rotor with per-blade flapping and dynamic inflow, Fenestron, engines with FADEC, airframe, skids, environment; physics harness; WebGL renderer, HUD, input models, exercises.
