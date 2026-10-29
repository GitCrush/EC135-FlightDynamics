# Changelog

## 2.16.3 — 2026-10-29 · A vertical speed scale you can read

- **The vertical speed bar becomes a scale**, under the altitude box, as on a glass cockpit's VSI: labelled in fpm (0, 500, 1000, 2000 up and down; the first 500 fpm take half of it, so a hover's small changes are readable and a descent is still on it), a white pointer with the value in a box, and the 6-s mark as a cyan bug with its value ("in 6 s +330") and an arrow from the pointer to it, which shows which way the vertical speed is going and how far with the controls held. A legend under it: white now, cyan in 6 s. Within ±20 fpm it reads 0 in grey; a sink beyond 800 fpm below 100 ft turns it amber. The bar of 2.13.2 to 2.16.2 had no numbers and filled green or amber from the middle.
- The altitude box shows the barometric altitude under the radar altitude again; the vertical speed has moved to the scale.

## 2.16.2 — 2026-10-29 · Calmer green displays

- **The vertical speed bar at the right edge** (green up = climbing, amber down = sinking) is linear up to 100 fpm and only above that on the square-root scale of 2.13.2, smoothed over a quarter second, and grey within ±20 fpm. The pure square root made 10 fpm 5.5 px, so the small ups and downs of a hover flipped it between green and amber all the time.
- **The coach's green arrow at the collective** ("collective in" up, "collective out" down) now judges the lever by where the vertical speed is going (the 6-s mark), not by where it is: it asked for more lever while the aircraft was already about to stop sinking, and turned round with every swing. It comes at 0.06 and goes below 0.035 of lever, and turns round only after 0.6 s.

## 2.16.1 — 2026-10-29 · No wind unless chosen, no drift behind the welcome card

- **The welcome card no longer asks for a level**: the first start is *Beginner*, as before 2.14; the setup's *Level* changes it.
- **The levels no longer set a wind.** The air is calm unless a wind is chosen in the setup's wind block; settings saved by 2.14 to 2.16 lose the wind a level had set.
- **Nothing moves behind the welcome card.** A level picked there used to switch the wind at once into the trimmed hover waiting behind the card (14 kt into an aircraft trimmed for calm air: 7 m/s of drift within 5 s), and *Fly free* handed over a drifting aircraft. Now the simulation holds while the card is shown and *Fly free* trims anew.
- **Trimmed in the mean wind**: turbulence and gusts are held off while the autopilot trims and start from nothing at the hand-over, so an aircraft is not handed over in a gust (14 kt gusty, aids on: 0.2 m/s after 2 s hands off).
- A weather chosen in flight eases in at 2 kt a second instead of switching.

## 2.16.0 — 2026-10-29 · The start as flown, and the pitch channel's delay

- **Engine start by hand.** Each engine has its main switch, OFF – IDLE – FLIGHT (`Shift`+`1`, `Shift`+`2` move it a step, and back down from FLIGHT), and the rotor has its brake (`Shift`+`B`; on after a cold reset, no start with it on, applied only with the engines off and below 50 % NR). IDLE from OFF starts the engine: the starter turns it, it lights at about 12 % N1, the TOT peaks during the acceleration and settles at ground idle after 25 s; with no engine in FLIGHT the rotor turns at a ground-idle 70 %; FLIGHT runs it up to 100 %. One after the other, as flown. `Shift`+`E` does the whole sequence (brake off, engine 1, engine 2 once the first is at idle, both FLIGHT; running: both IDLE, again: OFF). The VEMD shows each engine's switch (START, IDLE, FLT), N1 and TOT, and BRAKE. The idle speeds and the TOT curve are a small turboshaft's typical shape, not the type's flight-manual figures.
- **Pitch: an equivalent delay of 25 ms in the longitudinal channel.** DLR's identified EC135 models need the lead-lag dynamics in pitch (the regressive lag mode near 11.7 rad/s, CEAS 2007), which this model does not have. With it the pitch phase delay at 75 kt is 93 ms (published 92; 70 before) and the row is calibrated; the pitch bandwidth stays quicker than published (2.85 against 1.84 rad/s), an open deviation.
- Browser test: the start by hand.

## 2.15.0 — 2026-10-29 · The seat and the glide slope

- **Motion cues: the head moves with the accelerations.** A pilot feels the lever before any instrument shows it: 0.025 g in the seat per 1 % in the hover. The view now does what a head does in the seat, smoothly and briefly (washed out over 0.8 s, so a steady turn or climb leaves it centred): a little lower and a nod down when the lever comes up (6 % of lever: 1.6 cm and 0.23°), forward in a deceleration, sideways in a skid. No shaking of the picture: a rotor vibration in the view was tried and left out. Setup › View: *Motion cues* off / subtle (default) / full; the *Realistic* level uses full.
- **HAPI at the field pad**: the helicopter approach path indicator of the ICAO Annex 14 heliports, a light 14 m west of the H, seen within 15° of the approach course from the south: flashing green above the 6° slope, steady green on it (45 minutes of arc), red slightly below (15 minutes), flashing red below. From the approach exercises' start (900 m south, 500 ft) it flashes green.

## 2.14.0 — 2026-10-29 · Settings that stay, levels, a stick fitted to the pad

- **The settings stay in the browser.** Until now only the graphics and the gamepad's mapping survived a reload; the mouse travel, the aids, the view, the wind, the coach and the displays started over every time. Saved once a second when something changed (and when the page is left), never during a lesson or the performance test. *Reset all settings* in the setup starts over.
- **Levels (profiles)** on the welcome card and at the top of the setup: *Beginner* (every aid, the coach's cues, the predicted path, calm air), *Intermediate* (the aids without the coach, a light breeze), *Realistic* (rate damping only: no attitude command, no heading hold, no coach, no predictor or rotor map, a gusty 14 kt). A setting changed by hand makes it *Custom*.
- **Weather presets** in the wind block: calm, breeze 8 kt, gusty 14 kt, strong 22 kt (turbulence and gusts with them; the direction stays).
- **The stick fitted to the mouse pad.** On the first capture of the mouse the aircraft waits while the hand sweeps the mouse once from the pad's left edge to its right edge; full stick is then 45 % of that width, just inside the edges. The fixed 1600 px were 2 cm of mouse at 2000 dpi and 5 cm at 800. The card also names where the system's pointer acceleration is switched off. Enter skips; the setup has it again.
- **A lesson keeps your settings**: it sets its own aids, key models and calm air, and gives yours back when the tutor stops (until now the lesson's settings stayed).
- **Narrow windows** (chase and tower view below 1000 px): the bottom group (rotor speed and FLI, the controls, plan view and profile, the rotor map) is scaled down instead of overlapping, the hints' line sits above it, and the autopilot's key hint gives way to the heading tape.
- README: the joystick with a throttle lever as the best upgrade.

## 2.13.3 — 2026-10-29 · Boards that do not overlap

- **The boards stack instead of lying on one another.** At the top centre, downwards from under the heading tape: the tutor, the keys' hint at the start, the incident banner, the coach's word and sentence, click to fly. On the hints' line, upwards from the panel: sound, head tracking, the mouse, looking around or the demonstration, the approach view, the coach's legend. In the middle around the centre: paused, crash, debrief. Before, the incident banner lay on the coach's box at the top (both at a fixed height), the coach's legend in the cockpit on the panel, the debrief on the crash box.
- **At the start, for 12 s:** a pulsing hint "? or F1 – all keys and shortcuts" (gone once the list was opened). `?` now works on every keyboard layout (German: Shift+ß); F1 as before.
- **The mouse and the pointer acceleration:** with the system's acceleration a quick move out and a slow one back do not meet, and the stick creeps. On the first capture of the mouse a hint says where to switch it off on this system (GNOME, KDE, Windows, macOS, ChromeOS). Chrome on Windows, macOS and ChromeOS gets the raw movement itself (Pointer Lock's unadjustedMovement) and the hint confirms it instead.
- The paused screen named P to continue; it is Space (P is the predictor).

## 2.13.2 — 2026-10-28 · The collective: set it, then wait

The question: holding a height or a steady descent took the lever back and forth all the time. Measured in the model: left alone, the lever holds (the hover at 3 m within 0.2 m over 2 min, at 100 kt within ±15 fpm after half a minute); it sets a vertical speed that settles with a time constant of about 4 s (1 % ≈ 130 fpm in the hover). The aircraft needs small corrections and patience; the pilot feels the vertical acceleration in the seat at once, the screen shows only a vertical speed that is 22 % there after 1 s. That is the loop that chases.

- **A mark where the vertical speed will be in 6 s**, controls held, from the motion predictor: a blue triangle on the VSI's rim and beside the HUD's vertical speed bar, and "→ +240" in the ALT box (before a predicted touchdown, the sink just before it). It moves with the lever at once: set the lever by the mark, then leave it. Within 2 fpm of the flown result after a lever step.
- **The HUD's vertical speed bar on a square-root scale** (100 fpm is 17 px instead of 4), below the ALT box.
- **`W` / `S` dose evenly**: for 0.6 s the lever moves at 2.5 %/s (about 320 fpm a second in the hover), then faster up to the full rate by 2 s. 0.5 s of `W` is 1.3 % (was 2 %), 1 s 3.2 % (was 12 %).
- The tutor's hover lesson points at the mark.

## 2.13.1 — 2026-10-28 · The cyclic at speed

The question: a turn, a reversal or a flare took far more mouse than it should. Measured in the model at 100 kt (a pilot model, the same manoeuvres flown smoothly, gains searched per law): with the attitude command a 30° turn held 1,340 px of mouse (85 % of the stick) for the whole turn, a reversal went 2,700 px from one side to the other, a 10° flare held 950 px aft. The bare aircraft needs 140 to 340 px held: it is a rate device, the stick goes out and comes back. The attitude command is right for the hover, not for manoeuvring at speed.

- **Rate command, attitude hold above 45 kt** (back below 35 kt): the stick rolls or pitches the aircraft at about the bare aircraft's rates (linear beyond a 3 % dead centre; 20 % of stick about 16°/s of roll, 90°/s at the stop; 40°/s of pitch at the stop), the centred stick holds the attitude it has. A turn is a push and back to the centre, a reversal one push the other way, a flare a pull. Measured: the hand stays within 380 px in the turn (1,350 before), 630 in the reversal (1,400), 310 in the flare (1,030); the travel halves and matches the bare aircraft. In the hover the attitude command stays.
- Bumpless both ways: accelerating through 45 kt with the stick still forward, the nose stays where it is and the stick's position is the new centre until the hand brings it back; slowing through 35 kt, the attitude command takes over the attitude you have and eases to the hover trim.
- With the wings within 4° of the trim bank and the stick centred, the wings level and the heading hold takes over. `Shift` + arrows move the held attitude, `Y` eases it to the hover trim. The coach's stick arrow at speed shows the push, not a held offset. The mouse box shows "rate command · centre holds" with a ring at the centre.
- Setup: *Cyclic in forward flight* (rate command, or the attitude command as until 2.13).

## 2.13 — 2026-10-28 · Seeing out

How pilots hover: eyes out, a point some 15 m ahead; the attitude from the horizon against the frame; the drift from the ground in the corner of the eye; a glance out of the door window, hands on the controls. A flat screen takes the frame, the corner of the eye and the free head away; the large simulators give the head back with TrackIR or a webcam (opentrack, AITrack), VR or several monitors, and without them with glance views on a hat switch.

- **The cockpit frame as the attitude reference**: thin lines of the windscreen's centre post, the pillars, the roof bow and the doors, projected from the airframe; the horizon against them shows bank and pitch as in the aircraft. Setup: *Cockpit frame*.
- **Glances**: `Q` and `E` held look out of the left and right door window at the ground beside the skid (70° to the side, 25° down); the mouse keeps flying (unlike `C`). The engines move to `Shift`+`E`, the tutor's quit to `Shift`+`Q`.
- **Head tracking by webcam** (`Shift`+`Z`, setup: start, centre, gains): MediaPipe's face detector finds six points of the face 20 times a second on the processor; the nose between the ears gives the turn, between the eyes and the mouth the nod; One Euro filtered, 2° dead zone, gains 3.5 (turn) and 2.5 (nod). The camera picture stays in the browser; the library (about 10 MB) comes from jsDelivr on the first start, the model (230 kB) is in the file. It needs the HTML file opened directly in the browser: an embedded page gets no camera.
- **The approach view without chin windows** by default: the gaze 15° lower, the panel where it is, nothing more to draw. The chin windows are a setup option.

## 2.12.8 — 2026-10-27 · The approach view on weaker graphics

- **The floor round the chin windows without a special compositing mode.** It was drawn and then cut open with 'destination-out' on the overlay canvas; a canvas drawn by the GPU may do that one mode on the processor and read the whole overlay back every frame for it. Now the floor is one path with the two openings as holes (even-odd fill).
- **The windows' picture every other frame when frames come late**: if the approach view runs under 50 frames per second for 2 s, the chin windows are redrawn every second frame and the last picture is shown in between.
- Windsocks and wind turbines out of view are no longer drawn (also in the normal view).
- **Frames per second in the side panel's GL line**, and when the approach view is switched, the rate before and 3 s after ("approach view on: 58 → 52 fps") in the key line and the GL line.

## 2.12.7 — 2026-10-27 · A finer collective

- **The collective no longer jumps.** Checked against the physics first: from the hover out of ground effect (2500 kg) 1 % of lever (0.145° of blade pitch) gives 135 fpm of steady climb (momentum theory: 140 fpm, about 1000 fpm per degree), reached with a time constant of 3.5 s (ADS-33 Level 1: at most 5 s), and 0.025 g at once. The rotor's response was right; the inputs were coarse: one wheel notch moved the lever 4 % in Chrome on Windows (about 500 fpm and a 0.1 g jolt), 2 % in Chrome on Linux, 0.1 % in Firefox; a tap on W or S 3 to 4 %. A hover held to ±50 fpm needs about 0.3 %.
- **Wheel**: one notch is 0.4 % of the lever (about 55 fpm) in every browser (the delta normalised to notches); spun fast the steps grow up to four-fold.
- **W / S**: a tap moves the lever 0.3 to 0.4 % (about 40 fpm); held, the rate rises to the full one within a second (full lever still in about 4 s). The throw down with the engines out or the rotor drooping stays immediate.

## 2.12.6 — 2026-10-25 · Chin windows before the view

- The chin windows are drawn before the view now, into their own picture, and laid in at the end. 2.12.4 drew them after the view, which switched away from the view's framebuffer and back in the middle of the frame: on many GPUs (Vulkan drivers, integrated graphics) that writes the whole multisampled picture out to memory and reads it back in, a cost that a software renderer does not show.
- The version is shown in the setup's header and in the performance test's result, together with the browser and the system.

## 2.12.5 — 2026-10-25 · A linear mouse

- **The mouse stick is linear now.** Two curves were stacked: expo 1.5 on the mouse's virtual stick and the attitude command's own shaping (20° + 20° x stick³ of bank). Together the bank per 100 px of mouse movement grew from 0.2° around the centre to 7.4° at the stop, 35-fold: around the centre little happened, the hand went further, then it bit and overshot; a reversal from 10° of bank to 10° the other way took 1,800 px of mouse. Linear leaves the shaping to the attitude command alone: 1.25° to 5° per 100 px, the same reversal 1,360 px.
- Setup, Input models: **Mouse curve** linear (default), mild (expo 1.25) or strong (the old expo 1.5), next to the mouse travel for full stick.

## 2.12.4 — 2026-10-25 · Approach view by key, chin windows through glass

- **No more automatic approach view.** It comes and goes only with `4`. The situation now gives a hint above the panel instead: on an approach, low and slow after the aircraft has been away, "4 Approach view: look down through the chin windows"; on a departure (after a landing, from the hover) with the view still on, "4 Back to the normal view for the take-off". Each hint shows for 8 s; pressing the key settles it. The setting is on/off.
- **The chin windows through glass, at a quarter of the cost.** They are drawn at half the resolution with the light ground shader into a picture of their own and laid into the view through a glass: faintly tinted, a little less contrast, darker towards the frame, a sheen of the sky at the front edge. Through a real chin window the picture differs from the windscreen too. Under *full* graphics at full resolution and in the full shader.
- The performance test's variant "approach, chin full" measures the windows at full quality.

## 2.12.3 — 2026-10-24 · Lighter approach view, and a performance test

- The approach view does less again, aimed at integrated graphics: the windscreen's pass now uses a projection that ends at the panel's top (nothing under the panel is even sent, in the normal cockpit view too); both chin windows are drawn in one pass, and only their own pixels are shaded (the floor round them is masked in the depth buffer); under *auto* graphics the windows' ground switches to the light shader when the approach view's frames come late.
- **Performance test** in the setup (View): at the present place it draws the view eight ways for 2.5 s each (normal and approach view, the approach view without its windows and with light windows, light graphics, half the pixels) and gives frame interval, JavaScript time, GPU-finished time and overlay time as text to copy.

## 2.12.2 — 2026-10-24 · The approach view without the frame-rate drop

- **Massive frame-rate drops as soon as the approach view came in.** 2.12 drew the scene over the whole view, also behind the panel, and relied on the depth test to skip what the panel hides. The downwash's particles (dust, spray) slip past that test (their shader discards the sprites' corners), and in the hover, right under the eye, they are sprites of up to 256 pixels, hundreds of them, all shaded behind the panel. Now the view stops under the panel as the normal cockpit view does, and each chin window is drawn as a small pass of its own, only as large as the window, with only what is in it (ground, shadows, trees, nearby cars, the path; no sky, no particles). The pixels drawn are about those of the normal cockpit view.
- Under the software renderer the approach view now costs +5 % in a dusty hover (2.12.1: +19 %), −8 % in spray (+17 %), +5 % over the pad (+25 %) against the normal cockpit view.
- Tighter culling everywhere: the forest's tiles are tested as boxes (not only spheres), cars out of view are not drawn, trees throw shadows into the view only from its sun side. A fifth to a quarter fewer draw calls in the normal views too.

## 2.12.1 — 2026-10-24 · Approach view on the approach only

- The approach view now comes only on the approach, never on the take-off: there the lowered gaze took the horizon's picture away while the attitude is being set. It is armed once the aircraft has been above ~90 m or faster than ~55 kt (or a flight starts in the air, as the approach exercises do), and it goes back 2 s after touchdown, on a departure from the hover and on a go-around (climbing while speeding up). A flare or a correction climb in the hover keeps it. Hover exercises and the pad start in the normal view; `4` still holds it on or off.

## 2.12 — 2026-10-24 · Approach view

- **The approach view.** Low and slow (below ~60 m above the ground and ~40 kt) the gaze lowers by itself, as a pilot's does on short final and in the hover: the line of sight goes down to 25°, the view grows taller (75° instead of 62°), the instrument panel rises to where it hangs in the airframe, and under it the two **chin windows** in the floor of the nose come into view: the ground right in front of and under the skids, the pad's markings, the aircraft's shadow. The horizon stays at the top of the view. One picture with one projection, no head movement and no hand off the controls (looking around, `C`, needs one). It slides in and out over 1.5 s, once per approach. Key `4` and the setup: automatic, held, off. Click to fly picks through the chin windows too; the IAS and radar altitude boxes sit above the lifted panel.
- A picture-in-picture view of the ground below (a small second camera in a corner) was tried first and dropped: a second pass of the scene to pay for, and a second picture to read instead of a view out of the aircraft.
- **Cheaper scenery.** The static scene is cut into chunks by place (village, hospital, bridge, town, pylons, factory, each farm, the hamlet), each with a bounding sphere; those out of view are not drawn, nor their shadows. Within the noise to 7 % less a frame in the normal views. The approach view costs 20-25 % more than the normal cockpit view under the software renderer while it is on (more ground in view, less sky); behind the panel and the floor the depth is cleared to the near plane, so a GPU shades nothing there.

## 2.11.1 — 2026-10-22 · Trees that fade, not sprout

- Trees coming into range no longer grow out of the ground, and a tree's shape no longer switches at once at 160 and 750 m: both fade through the multisample coverage (alpha to coverage: no blending, no sorting, the depth test as for anything opaque), the thinning over some 45 m of approach near and 400 m far, the shapes cross-faded over 30 m. Since 2.9.3 the trees had been scaled about their feet, which from a cockpit at speed looked like a forest sprouting.
- Cost: a few per cent of a frame under the software renderer (the cross-fade bands draw both shapes).

## 2.11 — 2026-10-22 · Shadows and settlements

- **Everything casts its shadow**: buildings, the village and the hamlet, the farms, pylons, the churchyard's wall, the turbines' turning rotors, the cars, and the trees, bushes and boulders within 220 m, all along the sun as the aircraft's shadow is, on the stencil so overlapping shadows darken once. Long in the morning and the evening, short at noon. The trees' shadows lie on the slope at each foot (the ground's gradient travels with every tree).
- **The village** has a churchyard (wall, gate, gravestones), gardens with fences and sheds behind the houses, cars at the doors. **A hamlet** with eleven houses, a chapel and a barn stands on the north-south road 700 m north of the field. The hospital has a car park, each farm a car in the yard.
- Cost: 0 to 5 % of a frame under the software renderer, 50 draw calls more.

## 2.10 — 2026-10-22 · More to see, no more to pay

- **Fields of many sizes and crops.** The 45 m checkerboard is gone: 90 m cells left whole, halved or quartered, each piece with a crop of its own (meadow, a green crop, ripe grain, stubble, maize, ploughed land, fallow) and its row direction; hedgerows and farm tracks along some of the edges.
- **Eight farms** in the fields: house, barn, shed, some a silo, trees round them.
- **Trees of their own**: each tree its own height to width and shade of green (yellow-green to blue-green, by the stand), stands of birches with white trunks on the low ground.
- **Cirrus** above the cumulus, streaked along the wind.
- **No more to pay** (the same views under the software renderer, 2.9.3 to 2.10: within the noise of the measurement): the ground beyond ~900 m, where a pixel covers over a metre, is drawn with the light shader (10 x 10 blocks, consecutive ones in one call), which pays for the fields' extra hashes and the cirrus' fetch.

## 2.9.3 — 2026-10-22 · No popping

- **Nothing pops in any more.** 2.9.2 chose the trees' shape and how many to draw per tile of 120 m, and beyond 750 m whole 720 m blocks switched to a fifth of their trees: flying, groups of trees changed or appeared at once. Now every tree decides for itself in the vertex shader, by its own distance: which shape is its own (near to 160 m, middle to 750 m, far beyond) and whether it is kept (all to 350 m, 55 % at 600 m, 20 % at 1.2 km, none at 2.2 km). A tree about to be dropped shrinks away over some 30 m of approach near and 250 m far, the kept ones grow a little to fill the gaps; bushes, boulders (the largest kept furthest) and reeds fade the same way. The broadleaves keep their trunk at middle distance, so the change of shape at 160 m is a small one.
- The cost stays as in 2.9.2.

## 2.9.2 — 2026-10-22 · Real trees, less work

- **The forests are trees.** 2.9 and 2.9.1 drew the inside of a forest as one canopy mesh with trees round its edges: from the cockpit a strange green mass ringed by trees. Now every tree is drawn: some 104,000 of them, 9 m apart within 1.5 km of the field and 12 m further out to 2.7 km, as tall as the crowns the physics sees (11 to 17 m), conifers or broadleaves by the stand and the height, bushes and smaller trees at the edges. They are instances of a few shapes (a conifer, a broadleaf, a bush, a boulder, a clump of reeds) drawn with instanced rendering in three levels of detail, near to far, thinned with distance; beyond ~2 km the ground's shader colours the forest. The forest floor under them now comes from the same density as the trees (the ground's shader had its own noise, which did not match).
- **The hospital stands in a clearing** of its own (lawn and car park round it) instead of in the forest; the wind turbines' feet are clear too.
- **Less to draw.** Against 2.9.1, measured under the software renderer at the same views: a frame 13 to 35 % cheaper (light mode 7 to 26 %), the triangles a frame down from 0.29–0.60 to 0.16–0.33 million, the vegetation's buffers about 7 MB instead of 82, the page ready sooner (the trees' meshes took 2 s to build). The canopy's shader with its crowns is gone. In the cockpit nothing is drawn under the instrument panel any more (a fifth of the view), the ground is drawn in 25 blocks of which only those in view, and the flowers' dots are only computed within reach of a pixel.

## 2.9.1 — 2026-10-22 · Crowns

- **The canopy shows its crowns.** 2.9 shaded the forests' roof with a mottle of noise that from close looked like camouflage cloth. Now each crown is drawn while it is more than a few pixels across: broadleaves as domes of leafy clumps with a ragged outline, conifers as cones with whorls of branches, each its own green, in stands of mostly one or the other; lit on their sun side, and every point looks 1.6 m towards the sun for a higher crown, so the gaps and the far sides lie in their neighbours' shade. Further off it fades into the crowns' average. The light mode draws them too, more simply (four crowns looked at instead of nine, no shadows, no clumps).
- **Forest edges**: the canopy rises from a low mantle to its full height over some 10 m instead of standing up as a wall (the physics' canopy too); where a road, a river or the wires cut the forest, the canopy's edge comes down to under half its height, and the row of trees in front of it is as tall as the canopy (pines 12 to 17 m, broadleaves 11 to 15 m) with bushes at their feet: no more green cliff behind short trees. Where the wall still shows it is a curtain of leafy clumps, not streaks.
- **Half the forest's memory**: the trees' normals, colours and sway are stored as bytes, 22 bytes a vertex instead of 44: 82 MB of vertex buffers for the full forest instead of 144 (light mode 16 instead of 28; 2.8.1: 53 and 14).
- What the world costs to draw is measured and written down in the technical notes (draw calls, triangles, the time per frame against 2.8.1, memory).

## 2.9 — 2026-10-21 · A world to fly in

The world (some 14 km across instead of 3):

- **Mountains to the north**: foothills from 1.6 km, ridges of 700 to 900 m beyond 4 km with rock on the steep flanks and snow where it can lie; hazy hills all round out to 7 km.
- **The Kuppe**, a rounded summit 2.5 km north-north-east, 260 m high, with a pad and a windsock on its flat top.
- **A river** from the mountains down its valley into the lake and out of it to the south-east, on a flood plain cut into the land, with a bridge where the road crosses it. Setting down in it is a ditching.
- **A town** 2.7 km south-west: blocks between streets, glass towers in the centre, a high-rise with a pad on its roof 66 m up and a crane beside it, a factory with its stack. Every roof is ground to the physics (skids, ground effect, blade tips).
- **A hill** in the north-west with a slope landing site marked by cones (9°), a **clearing** in the western forest.
- **Wires**: the power line along the road and a second one across the river valley (lattice pylons, marker balls), the crane's jib and hoist cable. A wire through the disc or the cabin is a wire strike.
- **Four exercises out there**, each with its own trimmed start (`R` repeats it): *Mountain top*, *Forest clearing*, *Slope landing on the hill*, *High-rise pad in the town*.

The forest and the land:

- **A closed canopy**, 11 to 17 m high, over the forests (groups of crowns, conifers and broadleaves, more conifers up the mountains to the tree line at 480 m), instead of trees scattered over a dark floor; its edge abrupt, as a forest's is, with a row of tall trees and bushes in front; where a road, a river, the wires or the summit cut through it, a row of trees stands at the cut; the clearing ringed by two rows. Some 11,600 trees and 1,600 bushes out to 2.7 km (2.8.1: 6,700 trees within 1.3 km).
- **The trees are obstacles**: blades in the crowns end the flight ("Blade strike: trees"); the click-to-fly way climbs over them, and the motion predictor's red cross marks a strike in the trees or the wires ahead, as it does the ground.
- **Trees sway** in the wind and bend away from the rotor's downwash.
- **Flowers** in the meadows (white, yellow, pink; blue-violet on the alpine meadows), **boulders** in groups on the steep flanks, **stones** along the rivers' banks and in their shallows, **reeds** round the lake's shore and on the rivers' lowland banks.

Light and weather (setup):

- **Time of day**, 6:30 to 19:30: the sun's position and colour (warm and low morning and evening), the sky, the haze and the light follow it.
- **Visibility**, 1.5 to 20 km: the haze; in mist the sky greys.
- **Cloud shadows** drift over the land with the wind (the cloud layer's own field, met along the sun's ray).

Life, drawn (not in the physics):

- Cars and trucks on the roads, over the bridge and through the town's streets, keeping right; three flocks of large birds that scatter when the helicopter comes close; smoke from the village's chimneys and the factory's stack, drifting with the wind; a sailing boat on the lake.

Also: from the cockpit the rotor's blur is fainter and has no hard edge. The terrain the physics asks some thirty times a step stays cheap (each river piece looked up only where its valley reaches; the land near the airfield computed without the far terrain): a hover step costs as much as in 2.8.1 (some 175 μs here), a cruise step some 10 % more.

Tests: the world's terrain, the high-rise's roof, the canopy and the clearing's ring, a blade strike in the trees, a wire strike, the ditching in the river and a landing on the roof pad (consistency); in the browser the four exercises' starts, `R`, the time of day and the visibility, the traffic, the birds and the smoke.

## 2.8.1 — 2026-10-21 · No more metal

- **2.8 rang like metal.** The Fenestron and the gearbox were pure tones, steady to the hertz, the gearbox's rung by every blade passage, and the whole mix was 6 to 12 dB(A) louder than 2.7. Now the Fenestron's whine is mostly noise in narrow bands at its blade passage and the double (the blades' wakes smear the tones), its pure tone quieter and darker; the gearbox is a quiet whine of narrow noise bands, in the cabin only; the turbines have four partials instead of eight; the rotor's thump is softer, with a whoosh under it; nothing is quite steady (the rotor's and the Fenestron's level and the Fenestron's pitch wander a little); the mix is back at the loudness of 2.7.
- Measured on the rendered sound: spectral flatness 250 Hz to 4 kHz −11 to −13 dB in flight (2.7: −12 to −14; 2.8: −16 to −20, the ringing), −40 dB(A) in the cockpit hover (2.7: −39; 2.8: −33).
- `test/soundshot.py --solo` renders one source alone.

## 2.8 — 2026-10-21 · The sound, from the blades up

- **Main rotor**: a pressure pulse at every blade passage instead of noise with a sine on it: the thump (its harmonics peaking at 79 Hz, so small speakers play it), unevenly, as four blades never quite alike; descending at 30 to 90 kt, in vortex ring and at high speed the pulses turn sharp (the slap); the blades' swish pulsing with them.
- **Fenestron**: ten unevenly spaced blades, as in the EC135: the tone spread over sidebands, a buzz rather than a whistle; brighter and louder with its thrust, over the rush of the duct.
- **Turbines**: the whine on N1 (the start sweeps it up from nothing), the exhaust roar on power, a slow beat between the two engines. **Main gearbox**: its mesh tones, loudest in the cabin.
- **Where you listen**: the cockpit through a headset (muffled highs, thump and gearbox); outside the Fenestron and the engines; from the tower the distance and the Doppler shift of a passing aircraft.
- **The ground**: a thump at touchdown (with the sink rate), the skids sliding, the crash.
- **Volume** in the setup (70 % by default), a soft limiter before it.

Tests: `test/soundshot.py` renders the sound offline for eight situations (WAV files and spectrograms) and checks level, clipping, the headset and the Doppler shift; the browser test builds the live graph in every view.

## 2.7 — 2026-10-21 · Click to fly leads, you fly

- **Click to fly is guidance now, not the autopilot.** Hold `M`, point, click: the tutor's column stands at the target, and the coach's arrows turn gold and lead you there on the direct way: the speed to fly (up to 80 kt far away, so that you can stop at 0.6 m/s²), the nose into the way, the bank in cruise, the straight line down or up to the target (lifted over a hill on the way, 500 fpm down at most at low speed), then stop over it. Over it and still for 2 s, the column fades and the arrows are green again. You fly; nothing is driven, and an engaged autopilot lets go when a target is set. The arrows show with the coach off too.
- **A point in the air**: while aiming, the wheel lifts the target from the ground (a hover at 10 ft, as in the lessons) up to 2000 ft above the ground; the column reaches up to it, with a ring at the height.
- **Where it is**: a gold bug on the heading tape with the distance, height to go and time beside it, the target in the plan view (a pointer at the edge beyond its scale), and a gold diamond with the distance when the column is too far to see.
- A right click while holding `M` clears the target; a reset and a tutor lesson do too. It is no longer refused above 40 kt, on the ground (the arrow says lift off) or beyond 2 km.
- The coach learns the trim attitude on the way only while the speed is steady.
- Removed: the autopilot's click-to-fly trip (`AFCS.go`, `afcsGoStep`, `afcsFlyTo`) and the higher override threshold it needed.

Tests: a pilot who only follows the arrows reaches a ground target 150 m away (32 s), a point 300 m ahead at 100 ft (46 s), a ground target 2 km off from cruise at 1500 ft (127 s, at most 6.3 m/s of sink with 1000 fpm asked) and the ground straight below the high hover (126 s, at most 2.9 m/s of sink with 500 fpm asked); the first arrows point the right way; setting, clearing, the wheel, the autopilot letting go, refused in a lesson; in the browser: M, wheel, click, right click.

## 2.6.1 — 2026-10-20 · A real panel, click to fly that holds

- **Click to fly works with the mouse as the stick.** A mode that takes the cyclic counted the deflection the mouse stick had at that moment as the pilot moving it, and the mouse stick is never quite centred: HOV, IAS and click to fly let go again at once ("HOV off: you have the cyclic"). Now the mouse stick is centred on that axis when a mode takes it; on a click-to-fly trip it takes a deliberate movement (~130 px) to take the stick back. The cursor names the reason when a spot cannot be flown to (on the ground, too fast, in a lesson, too far).
- **The cockpit is the EC135 P2+ panel**, flat across the bottom of the view: the flight instruments straight ahead (airspeed, attitude, altitude; radar altitude, HSI with the HDG bug, vertical speed) in housings with screws, bezel and glass, master warning and caution, the CPDS with its warning unit (the trainer's limit lamps among the captions) and the VEMD, and the trainer's displays as screens in the panel (control positions, navigation with the predictor's scope and profile, rotor state). Drawn once per window size and animated per frame.
- **No frame**: the posts are gone, the view over the glareshield is free; looking around with `C` shows no cockpit at all; from the seat a turning rotor is its blur, not single blades.
- The vortex-ring exercise brief gives the Vuichard technique for this counterclockwise rotor (right cyclic, left pedal), as the incident text already did; it still had the clockwise directions from before 1.8.
- The flight-test report uses the system's fonts and loads nothing from other sites.

## 2.6 — 2026-10-20 · A flat panel, click to fly

Cockpit:

- **The instrument panel is flat**: a band across the bottom of the cockpit view, its top edge the glareshield, and on it, upright and undistorted, the pilot's flight display and the engine display (live) and the trainer's instruments. Until 2.5 it was a 3D panel 0.7 m from the eye with displays twice the real size, skewed and cut off at the bottom of the view and covered by the HUD, under a glareshield whose top read as a black table.
- **A slimmer frame**: the posts are about half as thick and lighter, run down behind the panel, and the chin-window posts that stood up from it are gone; the eye sits 0.42 m right of the centre line instead of 0.55 (nearly at the door), so the centre post and the right A-pillar frame the view symmetrically.

Click to fly:

- **Hold `M`, point, click**: on the ground in the view or in the plan view. The autopilot flies there as a hover taxi (up to 10 m/s, stopping smoothly), keeps the height above the ground, turns the nose into the way when the spot is more than 25 m off, and hovers over the spot. Its lanes, its hand on the control indicator and the predicted path show what it does with every control. Moving a control takes it back. Below 40 kt, in the air, up to 2 km. With the mouse captured as the stick, the mouse moves the cursor while `M` is held and the stick stays put.

Predictor:

- The see-through ghost of the aircraft in the view is gone (with its ring on the ground and its label), and its line in the height profile; the plan view keeps a small outline at 6 s.

Tests: click to fly reaches a spot 128 m away (within 2 m in 22 s, 0.15 m and still at 60 s, height within 0.1 m, nose into the way), keeps the heading on a short hop, hands back on the stick, is refused at speed; in the browser `M`, a click on the ground and the modes it engages.

## 2.5.4 — 2026-10-20 · A quieter ping

- The plan view's ping is far less obvious: the ring is a faint 1 px line (at most 22 % opaque, fading as it runs out) with hardly any glow, the profile's front likewise; the picture beyond the front dims only to 85-75 % instead of 60-35 %, and between pings it glows down only from 100 to 85 %. What changes as the front passes is the picture itself, not a flash.

## 2.5.3 — 2026-10-20 · The plan view pings

- **The plan view works like a radar scope**: it is no longer redrawn continuously. Every 1.5 s a ping runs from the centre to the edge in 0.6 s, a thin ice-blue ring; where it passes, the picture is replaced by the prediction of that moment, beyond it the last one stays, and between pings the picture stands and glows down slowly. It is kept in the world, so it moves and turns smoothly with the aircraft flying over it: you see the aircraft follow the path predicted at the last ping, or leave it. The scale changes only at a ping.
- **The height profile** is renewed by the same ping, its front running from now to the end.
- Live as before: the range rings, the aircraft, the track flown, the hover spot. The view (band, arrows, gates, ghost) stays continuous and eased as in 2.5.2.

## 2.5.2 — 2026-10-20 · Marks that stay where they are

- **The arrows and gates on the predicted path belong to moments now, not to "so many seconds from now"**: they stay where they are in the world while the aircraft flies towards them, as markings on a road do, and fade out just before it reaches them. In 2.5.1 they hung at fixed times ahead, travelled with the aircraft and jumped at every new prediction, 10-20 times a second.
- **Eased**: a new prediction moves the band, the arrows, the gates, the ghost, the touchdown, the plan view and the profile over about a sixth of a second instead of at once. Measured with the stick moving (frames at 60 Hz, a prediction every 100 ms delivered 50 ms later): from frame to frame a mark 4 s ahead jumped 28 cm in 2.5.1, a mark now moves 0.5-2 cm (95th percentile).
- The glow running along the band is gone; the gates are every 3 s of the clock.
- The plan view's marks are the same moments: they come towards the aircraft.

## 2.5.1 — 2026-10-20 · The band ahead, redrawn

- **The band runs where the skids will run**: 1.2 m below the centre of gravity, its two bright edges the skids' tracks (2.2 m apart), so where it meets the ground the skids meet it. One soft band (glow, rail, light fill) that keeps its width when seen edge-on, instead of 2.5's rails plus a line along the middle, which read as three lines. White now, cooler and fainter towards the end; in the last 1.5 s before a touchdown it takes the touchdown's colour.
- **An arrow on it every second**, larger every five: the way it goes, and by their spacing how fast. A soft glow runs along it from the aircraft to the end.
- **Its shadow on the ground** while low, with a line down at every second, instead of 2.5's translucent curtain, which read as a fence. On the ground it is also drawn from the cockpit.
- **Gates at speed**: corner marks of a frame to fly through, 12 m wide, square to the path and banked with the aircraft, every 2 s (every 5 s beyond 10 s). From the cockpit, where the band runs straight ahead into a point, they make a tunnel; there the band now starts out at the flight path marker instead of hanging down across the view.
- The ghost's rotor is its tip circle; the filled disc, seen edge-on, read as more band.
- The build checks the script's syntax before writing `index.html` (a syntax error in one module stops the whole page).

## 2.5 — 2026-10-20 · A predictor you can read at a glance

2.4's predictor drew a dashed line on the ground, hidden under the aircraft in the hover and too short to show anything at speed. The flight model is unchanged.

How far ahead:

- **The horizon grows with the ground speed**: 6 s in the hover, 30 s from about 70 kt (or 4, 8, 15 or 30 s as set in the setup). The prediction is exact for controls held still, and nobody holds them still: in the hover 1 % of stick moves the spot predicted for 6 s ahead by 0.5 m, for 10 s by 1.2 m and for 20 s by 4-5 m (measured on the model), so a longer hover path would mostly show corrections not yet made; in cruise the same 1 % makes 2.5-4 m after 20 s on a kilometre of track, and 6 s were only 320 m.

In the view (drawn in WebGL now, so the path goes behind buildings and hills):

- **A band along the path** at the aircraft's height, tilted as the aircraft will be (it banks into a turn), bright rails at its edges, a bar every second and a wider one every five, fading with time; near the ground a curtain hangs from it with the track on the ground. From the cockpit it starts some way ahead of the nose.
- **A ghost of the aircraft 6 s ahead**: see-through, in the attitude it will have, with a ring on the ground below it; it fades out while it would sit inside the aircraft.
- **The touchdown**: where the skids will touch, their footprint in the colour of the sink rate (green, amber, red from the hard-landing limit), with the time and the rate; a red cross and the cause where the model crashes.

In the HUD:

- **The plan view** shows the track flown in the last 12 s, the track to come fading with time, the ghost's outline and heading at 6 s, the touchdown, and reaches ±2 km.
- **A height profile** next to it over the same seconds: the skid height with the ground as the bottom line near the ground, the change of height higher up, the ALT target, the touchdown and its rate.

Fixes:

- The first prediction after a reset started from the controls of the flight before (95 m off after 30 s in cruise); predictions from before a reset are dropped.
- The input source under COL/PED on the control indicator ("mouse: click", "keys") was lost in 2.4; back.
- The key list and the setup still named `P` as pause; it switches the predicted path, pause is on the space bar.

Tests: the horizon in the hover, in cruise and as set; a 30 s cruise prediction against the flown path (0.9 m on 1.6 km); a predicted touchdown against the flown one (time and sink rate); in the browser a 30 s prediction from the worker drawn without a GL error.

## 2.4 — 2026-10-20 · An autopilot to watch, a predictor, an undistorted cockpit

After 2.3 the cockpit was still stretched in narrow and wide windows, the autopilot's interventions could not be followed, and there was no way to see where everything done so far was taking the aircraft. The flight model is unchanged.

Autopilot, rebuilt as an AFCS:

- **Modes, not controls**: ALT (height) and V/S (vertical speed) on the collective, HDG (heading) on the pedals in the hover and on the bank plus pedals at speed, HOV (position over the ground, below 40 kt) and IAS (airspeed, above 40 kt) on the cyclic. Keys `U` ALT, `I` HOV/IAS, `O` HDG, V/S and the targets in the menu (`J`); the side panel has ALT, HDG and HOV/IAS buttons. It picks the controls; every control no mode needs is yours.
- **You can always take a control**: moving one a mode drives (stick, arrow keys, `W`/`S`, wheel, `A`/`D`, mouse buttons, gamepad) releases the modes on it without a bump, and the view says so ("HOV off: you have the cyclic"). Until 2.3 a control the autopilot held ignored the pilot.
- **Made to be watched**: each mode has a colour (ALT and V/S cyan, HDG magenta, HOV and IAS green). A strip at the top left shows the modes and their targets; per engaged mode a lane shows, left to right, the deviation it works against (target, aircraft, the gap, where the predictor puts it in 5 s) and the correction on its control (trim, present position, the trail of the last two seconds), lighting up while it corrects; its target sits on its instrument (heading bug and arc, V/S mark, the hover spot on the ground and in the plan view) and its hand on the control indicator (position, trail, motion). The text panel and the arrow in the middle of the view of 2.3 are gone, as are the practice presets.
- V/S captures a new rate faster than the height loop (−500 fpm at 100 kt within 5 % after 15 s).

Motion predictor (new):

- The real model flown six seconds ahead from the present state, with your controls held, the stability augmentation and the engaged modes working: drawn in the view as a ground track with a mark every second (and the height above it in the chase view) and as a plan view next to the control indicator (track, seconds, ground speed now, the hover spot, the predicted height change), replacing the drift circle. `P` switches it; pause is on the space bar.
- It runs in a Web Worker on a second copy of the physics modules at 120 Hz (a third of the cost, within centimetres of the 360 Hz flight over five seconds); measured against the flown path: 0.08-0.12 m off after 3 s, 0.03 m after 6 s with HOV. Where a page may not start a worker it runs on the main thread in slices.

Cockpit:

- **Field of view bounded in both directions**: the setting is now the angle across (default 72°), the vertical angle stays between 46° and 62°, at most 85° across, and the line of sight is lowered so the flight displays stay at the bottom of the view. 2.3 allowed up to 100° either way, which still stretched the frame in narrow and wide windows. Checked at 1280×800, 1920×1080, 1100×1000, 1024×768, 1700×650 and 2560×1080.

Tests: the handling suite checks every mode, the pilot taking each control back, refusals outside the speed range and during a lesson, the targets, and the predictor against the flown path; the browser test the menu, the `U` key and the worker.

## 2.3 — 2026-10-15 · Smooth frames, a sharp picture, an autopilot that explains itself

After 2.2 the trainer stuttered, the picture was soft and shimmered, the cockpit looked stretched or cramped depending on the window, and the autopilot's corrections could not be followed. This release works through those four, and the two physics items 2.2 left open.

Frame rate:

- **The ground and the sky take their noise from one mipmapped, anisotropically filtered texture** (four scales from 260 m down to 4 cm cells) instead of computing some fifty hash values per pixel. Stripes, lines and markings are drawn analytically and filtered by the pixel's footprint on the ground. The airfield, the roads and the lake are only evaluated inside their bounds.
- **Nearest first**: the cockpit is drawn before the scene (into the front 1 % of the depth range), then the aircraft, buildings and trees, the ground, and the sky only into what is left. The ground and the sky behind the panel and the frame are no longer shaded.
- The instrument panel is redrawn at 30 Hz (15 in light mode) and uploaded into the texture's existing storage; the side panel's numbers are written at 15 Hz and only when they change.
- Trees in two levels of detail (near tiles within ~700 m in full, far tiles as a plain crown).
- **Auto** no longer switches to light mode after a slow start (and no longer remembers it): it lowers the drawing resolution in steps while frames come late, down to 60 %, and raises it again when there is room. A software renderer (the browser not using the GPU) is recognised and named in the side panel.
- Measured under SwiftShader, a software renderer, at 978 × 800 (it shades hidden pixels and skips no work a GPU would skip, so a GPU gains more): a cockpit frame 433 ms against 912 ms in 2.2, a chase frame 437 against 633 ms.

Picture:

- **Drawn at the screen's own pixel density** (at most 2, within a 2.6-megapixel budget) and **always multisampled**. 2.2 drew at the page's CSS pixels and, after auto had switched to light, at 0.75 of them without multisampling: on a high-density screen under 40 % of the screen's resolution. The HUD and the instrument panel follow the density too, so their text is sharp.
- **No more shimmer**: crop rows, furrows, hedgerows, runway and road markings, slab joints and the grass grain fade to their average where they get finer than a pixel; the cloud deck near the horizon no longer crawls.
- **The cockpit's field of view** keeps the angle across between 74° (1.16 × the setting) and 100°: a wide window no longer stretches the frame (107° across at 2.15:1 before), a narrow one no longer cuts off the panel (53° across at 0.8:1 before).
- **The stick and the collective lever are no longer drawn**; from the eye they stood in the middle of the view and hid the chin window.
- **The "mini trees"** that popped up on the grass near the ground (2.0's grass tufts and stones in a patch following the aircraft) are gone.
- New tree crowns with their own light and shade and an irregular outline, conifers in three tiers; the dark discs under the trees are gone, and the conifers' tiers, which had pointed down since at least 1.7, point up.
- In the cockpit the HUD's NR and FLI dials (which the panel already shows) give way to one strip with the limit lamps and the power line.

Autopilot display:

- **A panel at the top left of the view with one row per control axis it holds**: what it holds (height, the spot over the ground, airspeed, heading, the ball), where the aircraft is now and how far off (green on target, amber off it), and what it does with the control and why ("stick left 1.6 %, banking left against the drift to the right"; "right stick 1.2 %, holding the left bank (8°) that stops the drift"). Each axis's text is held at least 1.2 s unless the direction reverses. Below, **the last corrections with the time they started**: when it stepped in.
- The menu's display choice is now *Everything*, *Values* (without the reasons and the log) or *One line*. The large arrow in the middle of the view is gone; the autopilot's control positions still show in ice blue on the control indicator.

The two physics items 2.2 left open (no change to the flight model):

- **Retreating blade stall is now a validation (VAL).** Kampa's Fig. 22 is the limit blade loading against the advance ratio; 2.2 compared it with the load factor at which 10 % of the disc first stalls, which on the model as on the aircraft lies well below the limit load. The suite now flies an abrupt pull-up from 140 kt at 2910 kg and compares the peak blade loading with the limit at the advance ratio where the peak occurs: C_T/σ 0.175 at μ 0.311 against 0.176 (ratio 0.99), at 1.87 g. Nothing was fitted to the figure.
- **Pitch bandwidth: still KNOWN, now traced.** The sweeps keep the collective fixed, as in a flight-test sweep (the autopilot used to hold the height with it, which added phase lead below 1.5 rad/s): 3.01 rad/s and 70 ms against 1.84 rad/s and 92 ms published. The bandwidth comes from the short-period mode (M_w −0.063, M_q −3.0, 2.15 rad/s at ζ 0.87). The rotor wake on the stabiliser through cruise brings it only to 2.8; halving the stabiliser's lift to 2.4, and only removing most of its effectiveness would reach 1.84, which the source contradicts (the stabiliser was sized for good M_α and M_q). The published 125 ms equivalent time delay points to missing delay in pitch, for which there is no source yet; `docs/TECHNICAL.md` has the measurements.
- Golden values: the pitch bandwidth with the new sweep method, the pull-up's peak blade loading, the stall onset under its new name.
- Mutation run for the five mutants these rows touch: all caught, so the suite catches 33 of 33 (dynamic stall off, missed before, by the pull-up's golden value; the stabiliser removed by the new validation instead of a golden value).

## 2.2 — 2026-10-15 · Fourth flight: the flight-test iteration closed

The last round of the flight-test iteration that began with 1.8. No flight physics changed: the test pilot now flies three cards exactly as the plan says, every item still open gets a final reading from measurements on the model, and the frozen cards are flown a fourth time and judged by a new evaluator.

Test pilot (`flighttest/pilot.js`):

- Vortex ring (H8a, H8b): the recovery starts at the plan's 1,800 fpm of vertical descent (it started at ~1,530 fpm, the first of 1,750 fpm or a ring depth of 0.8); the classical recovery pitches 10° nose down from the entry attitude (it went to −10°, ~13° below it). The thrust fluctuation is also recorded detrended over 4 s (15 % peak to peak in H8a), as the qualities suite measures the ring's roughness.
- Autorotation (F6): the collective stays full down, as the plan says; it settles at 110.8 % NR and 2,210 fpm at 65 kt (inside the card's bands, above the 106 % power-off limit a pilot would hold with the lever).
- Hover with the controls fixed (H6): a doubling time from the growth of successive extrema (4.8 s); the old measure, the time at which an extremum first reached twice the first one (14.2 s), read like a doubling time but is not one.

Final readings of the open items (report, `flighttest/notes.json`, `docs/TECHNICAL.md`), each measured on the model:

- Hover yaw decay (H4.2): the yaw moment budget shows the governor's torque (+0.7 kNm at the mast as the rotor speed dips at the release) holding the yaw; the governed rotor's polar inertia joins the yaw axis. The aerodynamic yaw damping matches DLR.
- Yaw from a sideways drift (H2.5): the drift's sideways flow into the Fenestron lowers its thrust by 4 %; with the drift held at zero the lateral pulse does not yaw at all. The hover N_v is a third to a half of the BO 105's.
- Rotor speed after a hover power loss (H7.3): with the lever down the rotor still needs 20–28 kW and the fixed-pedal Fenestron 16 kW until the descent passes ~3,300 fpm, where the empirical curve puts windmilling.
- Rolls with the controls fixed (F5, F6; flagged in the third flight): the spiral mode is stable; at speed the cambered fin's moment grows with the dynamic pressure while the rotor's torque hardly changes, so a speed increase yaws the nose left (N_u −0.065 to −0.075), and the sideslip rolls the aircraft through the dihedral that matches Kampa's.
- Retreating blade stall onset (KNOWN): at 140 kt and 2910 kg the rotor carries 11 % more than the weight (stabiliser downforce against the hub's nose-down moment, fuselage), so the model stalls at C_T/σ ≈ 0.127, ~80 % of the published limit; radial inflow and tip relief are left for a next iteration.

Fourth flight of the frozen cards (same SHA-256), new evaluator: **75 PASS, 7 NEAR, 5 FAIL; cards 14 pass, 4 mixed, 1 fail** (third flight 74 / 8 / 5). No high-confidence expectation fails. Still FAIL: H7.3 (red flag), H4.2, H2.5, F1.5, F3.3, each with its measured reading in the report.

## 2.1 — 2026-10-15 · Third flight test, autopilot on single controls, graphics modes

The second flight test (1.9) left five FAILs and thirteen NEARs. This release works through them, mostly in the lateral-directional physics, flies the frozen cards a third time and has them judged by a new evaluator. It also adds an autopilot that takes single controls in free flight and shows its corrections, with a simple menu, and a light graphics mode.

Autopilot on single controls:

- **`U` `I` `O`**: the autopilot takes the collective, the cyclic or the pedals (any combination) while you fly the rest. The collective holds the height; the cyclic the position in the hover, airspeed and heading at speed; the pedals the heading in the hover and the ball at speed. What you fly sets the rest. Engaging and handing back are bumpless.
- **Its corrections in ice blue**: on each control it holds, a ring at the trim it has settled to and an arrow to where it holds the control now (six times the travel, so a 1 % correction still shows its direction); for the stick a large arrow from the centre of the view; a line naming what it holds with the targets, and its largest correction with the reason ("stick right 2 %: against the drift to the left 0.6 m/s").
- **Autopilot menu** (`J`, the *Autopilot* tab at the top left of the view, or *Menu* in the side panel): three tiles that say what each control holds and switch it; presets to practise one control while it flies the other two, to watch it fly all three, or all off; the targets with − and + (height, airspeed, heading, the hover point 5 m ahead, back, left or right); and how much it shows (arrows and the reason, arrows only, or only the line).
- The heading capture at speed banks 1° per degree of error with its trim integrator held during the capture: a 10° change at 100 kt settles in ~12 s without overshoot (0.4° per degree and a 3° overshoot before).
- The mouse wheel no longer moves the collective while it scrolls the setup panel or the menu.

Training aids:

- **Pedal anticipation in forward flight follows the mast torque** (0.096 of the pedal travel per kNm at 100 kt, measured from the model: a straight line from a 2,000 fpm descent to an 8 m/s climb) instead of the lever. The trim pedal is not linear in the collective at speed, and the yaw follows the torque a few tenths of a second behind the lever: with the old law a collective dumped at 100 kt pushed the pedal ahead of the torque and about twice too far, and the nose swung 8° the wrong way (now 4°, once the pedal is at the right stop). The autopilot on single controls uses the same law.

Physics (the flight-test findings):

- **Fuselage side force by the crossflow principle**, after the EC135 derivative breakdown of Kampa et al. 1997, Fig. 18: each strip of cabin and tail boom feels only the flow across the body (the whole airspeed before, which made the fuselage weathercock-stable and damped yaw by itself), the cabin adds a low-aspect-ratio side force near the CG, and the fuselage's destabilising yaw moment volume is set to the published −0.26 m³/° (**CAL**). Fin and Fenestron now give +0.58 m³/° and −1.09 1/s, the total weathercock +0.33 and the dihedral −0.28 m³/° (Kampa: +0.51, −1.35, +0.25, −0.30; **VAL**). Yaw inertia 4900 kg m² (6300), fitted again to the DLR Dutch roll at 60 kt, whose damping the model now matches (0.23 against 0.24–0.28, VAL).
- **Fin**: camber 0.83 (0.90), set with Airbus IN 3540 to zero Fenestron thrust in ball-centred cruise at 120 kt; centre of pressure 1.45 m above the CG (0.55), from the fin-and-Fenestron dihedral in Kampa's breakdown.
- **Fenestron**: reverse thrust from the fan's own disc area (a quarter of it before, which in cruise cancelled most of the fan's response to sideslip); the duct's augmentation fades faster with flight speed across the duct; right-stop fan pitch −11° (−25°), set again with IN 3540 so that the steady autorotation needs reverse thrust near the right stop (pedal 0.89). The full right pedal in the hover now gives 109 °/s after 1 s (174 with the old stop and the new relation).
- **Fuselage vertical force** by the same principle plus the cabin's lift: at 140 kt the fuselage no longer presses down with 1.6 kN that the rotor had to carry. Frontal drag area 1.67 m², fitted again to 137 kt at MCP.
- **Blade torsion under stall**: the separated-flow pitching moment twists the stalled blades nose down through the torsional stiffness of blade and control path (first torsion mode ~4.4/rev). A deep stall now limits itself: the 140 kt pull-up rolls 56° to the left in 3 s and comes back, against 112° and still rolling in 1.9.
- **Drive train**: gear mesh losses 2.5 %, 4 kW of gearbox accessories (the generators sit on the engines and no longer brake the rotor after a double engine failure), the FADEC sees the load through a 0.15 s filter; turbine lapse fitted again to the hover ceilings. Hover power 442 kW at the engines (436).
- The rotor's advancing-tip Mach number was computed but, since 1.9, never stored (the assignment sat behind a comment): the *Mdd* lamp never lit. Fixed.

Test pilot and report:

- Heading changes are summed along the record (they were taken modulo 360°: the H7 spin of −592° read as a small change).
- The report shows all three flights (counts per flight, the second flight dashed under the third, each expectation's earlier verdicts), what changed before each flight with the calibrations disclosed, and, marked *Developer*, the developer's reading of each discrepancy that remains.

Tests:

- `test/qualities.js`: a section for Kampa's derivative breakdown at 90 kt (fuselage weathercock and the fin + Fenestron dihedral CAL; fin + Fenestron weathercock and damping, rotor and total dihedral, total weathercock VAL; fuselage yaw damping PHY), the aids' torque anticipation against the model's equilibria, the Dutch-roll damping at 60 kt as VAL, hover yaw damping against DLR (CAL), blade torsion (PHY), the autorotation pedal near the right stop (CAL, IN 3540).
- `test/handling.js`: the autopilot on single controls (what it holds, what stays the pilot's, bumpless hand-back) and its menu (presets, nudged height, heading, airspeed and hover point, refused during a lesson).
- `test/scenarios.js`: the scripted feet in the quick stop act in fan pitch, so the gearing estimate no longer changes the pilot; the Vne tip-Mach row works again; the cruise collective check is split into going to take-off power and dumping the lever (where the pedal reaches the right stop and the ball cannot stay). The tip-Mach row had failed since 1.9 and the lever-dump row at least since 2.0; the CI jobs for scenario groups B and C fail on such rows.
- `test/browser.py`: the autopilot menu in the real page (J, a preset, a height nudge, close).
- `test/mutation.js`: 33 mutants (new: the 2.0 fuselage strips, the 2.0 yaw moment volume, the quarter-disc reverse thrust, blade torsion off, mesh losses off, the fin at the CG, the −25° right stop). 32 caught, 29 of them by a physics, calibration, rule or scenario check; tip loss, δ3 and the stabiliser are caught by golden values only, dynamic stall off is still missed. The hub stiffness halved is now caught by Kampa's dihedral (golden only before).

Third flight of the frozen cards (same SHA-256), judged by a new evaluator: **74 PASS, 8 NEAR, 5 FAIL; cards 14 pass, 4 mixed, 1 fail** (second flight 69 / 13 / 5, first 66 / 13 / 8). Now passing: the Dutch roll at 100 kt (period 2.55 s, F4.3) and its roll coupling (F4.4), the pedal doublet (F4.1), the sideslip in the roll pulse (F3.4), the rotor-speed droop (H5.4) and the power curve (F1.2); from FAIL to NEAR: the stall roll-off (F7.3) and the ball-centred sideslip (F9.4, 3.55° against ≤ 3°). Still FAIL: rotor speed after a power loss in the hover (H7.3, red flag), the hover yaw decay (H4.2) and the yaw from a lateral drift (H2.5), the collective at 135 kt (F1.5, rated NEAR on similar data in the second flight) and the sign of a 1 °/s yaw in the roll-in at 100 kt (F3.3). The report gives the developer's reading of each.

Graphics:

- **Graphics modes** *full*, *light* and *auto* (setup → View). Light, for weak GPUs: the 3D view at 0.75 of the page's resolution without multisampling, ground and sky shaders with fewer noise octaves, a little over half the forest with fewer faces, sparser grass tufts, fewer downwash particles, the panel at 15 Hz; physics, shadow, cockpit and the near-ground texture unchanged. Auto starts full and switches once to light below 40 fps (remembered). In both modes the trees are drawn in tiles culled against the view (the cockpit view drew the whole forest before). Under SwiftShader a light frame costs about a quarter of a full one.

## 2.0 — 2026-10-14 · Cockpit, aircraft and the ground under it

- **Cockpit**: the EC135's right seat in 3D, drawn in its own pass (2 cm near plane, so the frame half a metre from the eye is sharp without costing the scenery depth precision): windshield centre post and door posts, roof with the green-tinted overhead windows, glareshield, a live instrument panel (two flight displays with attitude, speed and height tapes, heading and vertical speed; the engine display with FLI and rotor-speed dials and their bands, power, engine state, OAT, weight, fuel; warning lights for engine failure, rotor speed, FLI limit, tail rotor, vortex ring), the centre pedestal, the empty left seat, the lower windshield beside the panel and the chin windows in the floor. Cyclic, collective and pedals move with the controls. The painted coaming is gone; the default line of sight is 9° down; the vertical field of view is a setting (46–90°).
- **Aircraft**: a new EC135 loft (superelliptic sections on a spline, crisp windows and seams), engine cowling, tail boom rising to the Fenestron's shroud with stators, swept fin, ventral fin, stabiliser with end plates, skids on arched cross tubes, blades with swept tips, lights, a generic white and blue scheme; paint and glass catch the sun.
- **Shadow**: the real silhouette, every aircraft mesh and the blades projected along the sun onto the ground, each pixel darkened once (stencil), plus a faint dimming under the spinning disc.
- **Near the ground**: texture down to a few centimetres within ~40 m of the eye; grass tufts, crop stalks and stones in a patch that follows the aircraft, exactly where the ground shader paints vegetation (its hash replicated in single precision).
- **Downwash**: the grass flattens in rings that travel outward and the tufts bend away from the rotor; dust off ploughed and cropped fields, a little grit off the pad, spray rings off the lake; where the wake lands follows the wind.
- Smoother grass clumps (the square speckle looked like tiles from a low hover). The screenshots in the README are rendered again, three new ones.

Tests:

- `test/qualities.js`: the Dutch roll at 60 kt against the DLR identification (CAL, the frequency the yaw inertia was fitted to; damping as KNOWN), and the governed rotor in the yaw axis: in the first 0.3 s of a pedal step the relative rotor speed changes by the yaw-rate change, as conservation of angular momentum about the shaft requires (PHY). The ring-roughness band starts at 10 %, as its source does.
- Mutation run on 1.9: 25 of 26 mutants caught, 21 of them by a physics, calibration, rule or scenario check; the doubled yaw inertia and the rotor speed that ignores yaw acceleration, golden-only or missed before, are now caught by the two new checks. Dynamic stall switched off is still missed (it moves the onset by a few hundredths of a g). Table in `docs/TECHNICAL.md`.

## 1.9 — 2026-10-14 · Flight-test findings worked off

The first simulated flight test (1.8) left eight FAILs. This release works through all of them, then flies the frozen cards again and has them judged by a fresh evaluator that saw neither the model nor the first verdicts.

Found in the test pilot, not the aircraft:

- The autopilot's balance loop, which trims every reset and flies the flight-test cards, turned the ball toward the centre so slowly that it never got there within a minute, and its integrator stopped at 0.4 of pedal: the 1.8 pedal positions at high speed were partly this limit. Now the bank holds the heading and the pedals hold the balance as a pilot does: the nose on the flight path at low speed, the ball centred from 80 kt, blended from 40 kt (centring the ball at 40 kt would take ~25° of sideslip, because the fuselage's side force must balance the whole tail force). The pilot aids use the same blend, so the hand-over after a reset no longer starts a transient.

Physics:

- Fin: camber and incidence as a zero-sideslip lift coefficient of 0.9 (0.30), stall on the effective angle at 24°. In balanced cruise the fin now carries about two thirds of the anti-torque (Fenestron 36 % at 120 kt, against nearly all of it before) and the pedal sits right of the hover position at every speed, as Airbus IN 3540 describes. Calibrated against that statement.
- Fenestron: ducted-fan momentum with the axial flow through the duct (the duct's ram drag, most of the hover yaw damping); pedal gearing 12° at centre, −25° at the right stop (14°, −10°), so the reverse thrust a steady autorotation needs against the fin is there with the ball centred (pedal ~0.9 right).
- Rotor polar inertia 2000 kg m² (1350), fitted to the Airbus simulation quoted by the AAIB (AAR 3/2015): after a double engine failure at 40 kt with full collective, NR 69.5 % at 2 s, 60 % at 3 s. Yaw inertia 6300 kg m² (5000), fitted to the DLR Dutch roll at 60 kt.
- Dynamic stall of the rotor blades: separation ~10 semi-chords after the static stall angle is passed, attached lift above the static maximum until then, reattachment below it. The stall indicator counts only sections that have lost lift. Onset at 140 kt moved from 1.2 to ~1.35 g; still below the ~1.7 g Kampa gives (open).
- Vortex-ring roughness: slower (periods of 1.5–6 s, after the measured ~0.6 vh/R) and no longer cancelled by the recirculation feedback, which took four fifths of every fluctuation back: 15–30 % of thrust peak to peak instead of 3–4 %.
- Fuselage side strips under the disc see the rotor downwash as crossflow: sideways and yawing motions in the hover meet drag linear in their speed.
- Recalibrated: frontal drag area 1.58 m² (1.50; the Fenestron no longer burns 50–60 kW at 137 kt), the aids' mixing (roll 7.05° and pedal 1.12 per unit collective in the hover; 3.0 at 100 kt, where the balanced sideslip grows with the torque and takes lift off the fin).

Recordings: thrust and engine power are one-revolution averages (the four-per-rev of the rotor aliased at 20 Hz into ±12 kN jumps); the lateral specific force (the ball) is recorded; side-force and roll-moment budgets for diagnostics.

Tests:

- `test/qualities.js`: a section for the flight-test findings (Fenestron share in cruise, autorotation pedal, NR after a power loss at 40 kt, stall onset as KNOWN, ring roughness); the collective-in-the-ring check compares each pull with the same flight without it, since the seeded roughness is now large enough to hide a 2-s pull.
- `test/mutation.js`: 26 mutants (fin camber back to 1.8, dynamic stall off, the roughness cancelled again, the 1.8 rotor inertia added).
- Consistency: level-flight power bands from the flight-test author's power build-up; the autorotating rotor may give up to 60 kW to the Fenestron.

Second flight of the frozen cards (same SHA-256), judged by a new evaluator: 69 PASS, 13 NEAR, 5 FAIL (first flight 66 / 13 / 8); cards 14 pass, 4 mixed, 1 fail (11 / 6 / 2). Now passing: the pedal against speed (F1.6) and the hover pedal against the cruise pedals (H1.4), the vortex-ring roughness (H8a.3), the rotor speed after the 100 kt power loss (F6.2). Still open: in the hover power loss the rotor speed bottoms out at 74 % but only at 4 s, after the descent has passed 3,400 fpm (H7, flagged red: on the empirical vortex-ring curve a flat-pitch rotor windmills only beyond ~1.8 vh of its present thrust); the retreating-blade-stall roll-off (F7.3, about three times the expected bank); hover yaw decay (H4.2, time constant ~4.9 s against 1.4–3 s) and the yaw from lateral drift (H2.5); the sideslip with the ball centred (F9.4: ~6° at 100 kt against ≤3°, an author's estimate; in the model it follows from the fuselage side force that balances the tail's ~1.2 kN, see TODO). Which parameters were fitted to sources the cards also use is stated in the report.

## 1.8 — 2026-10-14 · Independent review: rotor fixes, validation, mutation test

**The rotor now turns counterclockwise seen from above, as the real EC135's does** (Airbus Helicopters IN 3540-I-00; the BO105/BK117 lineage). Since version 1 it had turned clockwise, which mirrored every sense-dependent effect: left pedal now goes with power, the hover hangs left skid low, a power loss yaws the nose left, the retreating side and the blade-stall roll are on the left, transverse flow rolls right, Vuichard is right cyclic with left pedal. Found by the author of the flight-test cards, who wrote the expected behaviour from sources without seeing the model. The Fenestron side, its pedal sense, the fin camber, the pilot aids, texts and tests follow `H.rotor.s`; a mirror test checks the two senses against each other.

Found by an independent review (a reviewer who had not written the model, reading it against textbooks, the EASA type certificate and the ERF 1997 paper):

- Rotor: blade lift now acts along the normal of the flapped blade (it acted along the shaft, so the thrust did not tilt with the tip-path plane); the inflow roll gradient had the wrong sign and halved the pitch damping; coning and flap velocity along the blade normal; blade elements denser towards the tip, so the tip-loss factor acts.
- Yaw: the airframe reacts the main-rotor mast torque, not the whole engine torque (the Fenestron's drive torque does not act about the yaw axis); the rotor speed couples with yaw acceleration.
- Engines: every rating is the TCDS EASA.R.009 torque ratio (take-off 5 min, MCP; OEI 30 s, 2 min, continuous) times one scale times the smaller of turbine lapse and rotor speed, so the certificate's ratios hold everywhere; time limits as incidents; FLI scale per rating; NR limits 97–104 % power on, 85–106 % power off.
- Controls: 20 ms servo lag; roll bandwidth and phase delay now match the published 3.7 rad/s and 55 ms.
- Recalibrated: turbine lapse on the engines' whole load including accessories and friction (the hover ceilings are now flown and held), frontal drag area (137 kt at MCP).

Found while re-testing:

- Vortex ring: the empirical inflow curve double-counted the hover factor 1.15 and took the heave damping away at a quarter of the hover induced velocity; it now joins the model's inflow, and its roughness peaks in the ring. The steady state no longer depends on the path (power settling refers to the collective of the last seconds, not the value at entry; the pull term acts both ways).
- Rotor download fades as the wake skews back with speed (it acted in cruise too).
- Fin and stabiliser use only the flow across their span (in a steep vertical descent the fin's camber yawed the aircraft); fuselage moments go as u·w and u·v and vanish in pure crossflow.
- FADEC gains: the loop was at ζ ≈ 0.1 (NR swung 97–103 % after a collective dump); now ζ ≈ 0.4.
- Metered collective key: judges the power the rotor asks for, referred to 100 % NR, and stops just short of the limit (it overshot into it and drooped NR to 96 %).
- Training-aid mixing re-measured: a vortex-ring point in the regression had skewed it by 45 %. Roll 7.55° per unit collective; pedal 1.19 in the hover, 0.90 at 100 kt.

Simulated flight test (new, `flighttest/`): an author writes expected behaviour from sources without seeing the model (19 cards, 87 expectations, frozen by hash), a scripted pilot flies them, an evaluator judges without seeing the model; `report.html` shows it. First result 66 PASS, 13 NEAR, 8 FAIL; the open items are listed in the report and in the README's limitations.

Re-check of the fixes by the same reviewer:

- Labels made honest: roll bandwidth and phase delay are CAL (the servo lag was fitted to them), the type-certificate rows are RULE, the climb is a weak comparison (no power setting published; the model climbs 1640 fpm at MCP, 1960 at take-off power, against ~1500).
- Mutation test: the hinge-offset mutant changed nothing (the flap frequency is held, the spring compensates) and is replaced by a halved hub stiffness; the vortex-ring mutant now also runs scenario group E; catches by golden values alone are reported separately.

Tests:

- New `test/qualities.js`: checks labelled VAL / CAL / PHY / RULE / REG / KNOWN; the rotor in isolation, eigenvalues of the linearised model in the hover and at 100 kt, ADS-33 bandwidth by sine dwells, flown hover ceilings, climb and cruise, physical laws, vortex-ring steady states and path independence, aids against physics, TCDS rules, golden values.
- New `test/mutation.js`: 22 deliberate model errors; 21 caught (18 by physics, rule or scenario checks, 3 by golden values only), tip loss missed.
- Consistency: governor checks for collective dump and pull; free response with a defined kick.
- Scenarios: winds given at the aircraft's height; a defined disturbance for the weathercock check (an unstable equilibrium without one just sits there); autorotation flare at 80 ft with the rotor speed kept inside 106 %; sideslip measured as the change from trim.
- ADS-33 sine dwells fly every frequency with the input and its negative and average: one sign carried the trim's nonlinearity (6 ms of roll phase delay).
- Known deviation, documented: pitch bandwidth 2.9 rad/s against 1.84 published.
- The Dutch roll, now taken from the eigenvalues, is 2.0 s at ζ 0.23; the 1.7 limitation "about 1 s" is withdrawn.

## 1.7 — 2026-10-04 · Limits of main and tail rotor

- English only; the coach's speech is off by default (cues stay on).
- Turbine power lapses with altitude and temperature, fitted to the published EC135 P2 hover ceilings; the FLI shows the closer of gearbox and turbine limit.
- Fenestron blade stall at 16° (yaw-control margin at the hover ceiling); tail drive failure as a failure mode with its incident text.
- Vortex ring: power settling in the developed ring, collective alone no longer recovers; recovery texts follow Airbus SIN 3463-S-00. (The Vuichard direction given here was for the clockwise rotor the model wrongly had; corrected in 1.8.)
- Resets hand over bumplessly from the trim autopilot (a zero-integrator start could sink a heavy, hot hover into the ring).
- Scenario groups D (main and tail rotor at the limit, tail drive failure, weathercock, loss of yaw authority) and E (hover and cruise modes, transverse flow, vortex-ring recoveries).

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
