# TODO

The flight-test iteration (releases 1.8 to 2.2, four flights of the frozen cards) is closed.
What it left open needs either flight data that was not found or a larger model change; each
item has its measured reading in docs/TECHNICAL.md ("Fourth flight and the end of this iteration").

For a next iteration (a larger model change)
- Pitch bandwidth 3.01 against 1.84 rad/s and phase delay 70 against 92 ms (KNOWN, sweeps with the
  collective fixed since 2.3). Traced in 2.3 to the short period; the stabiliser is ruled out (the
  source says it was sized for good M_alpha and M_q). Missing: ~25 ms or more of delay in pitch
  (published equivalent delay 125 ms). Needs a source: DLR's identified derivatives (Seher-Weiss,
  JAHS 2019) as numbers, or the inflow / wake-to-tail lag modelled and checked against them.
- Retreating blade stall: the limit matches (VAL since 2.3, peak C_T/sigma 0.175 against 0.176);
  the roll-off in the stall is about 1.7 times the expected bank. The retreating tip sits at 16° in
  the 1 g trim at 140 kt: radial inflow variation and tip relief are not modelled.

Needs data (kept as they are, physics consistent with the published derivatives)
- Hover yaw decay with the governed rotor's inertia in the yaw axis (H4.2); yaw from a sideways
  drift through the Fenestron (H2.5); rotor speed after a hover power loss with the pedals fixed
  (H7.3); collective at 135 kt (F1.5); first yaw in a roll pulse (F3.3, I_xz and N_p unpublished);
  ball-centred sideslip 3.4–3.6° (F9.4); rolls with the controls fixed from the cambered fin's N_u.

Calibration (rotor, controls, stabiliser now from ERF 1997; still open)
- P2+ gearbox and engine ratings (1997 values are for the Arrius 2B / PW206B
  version at 2630 kg): climb rate at TOP, hover ceiling.
- Forward/aft split of the 21.8° longitudinal range; forward margin at
  MTOW and 140 kt is 13 %.
- Ixx (from the roll-sensitivity band) and Iyy (from the pitch bandwidth); side and
  vertical drag areas; the blades' torsional stiffness. (Izz and the rotor polar inertia are
  fitted since 1.9, the fuselage's yaw moment since 2.1.)
- Precone 2.5° and the tip twist relief are not modelled.
- Transition hump (stabiliser downwash): power at 40 kt.

Physics
- Blade pitch-flap coupling and swashplate phase as measured values.
- Fenestron: interference with the fin in left sideward flight.
- Start-up (2.16 has the switches, N1/TOT and the rotor brake): the type's own idle speeds and TOT limits from the flight manual; a hot or hung start.
- Turbulence intensity scaled with the wind profile near the ground.

Trainer
- Touch controls (virtual stick, collective slider).
- Autopilot: a ground track (NAV) mode at speed, altitude acquire (ALT.A) after a V/S climb, and
  a beep on the collective that moves the ALT target instead of releasing it.
- Predictor: an option to show the path with the controls returned to the trim, beside the held one.
- Predictor: a spread around the path (the same prediction with the stick a few per cent either way)
  to show how much the far end depends on corrections still to come; the wind turbines along the
  path are not checked (the ground, the roofs, the canopy and the wires are: the model's own crash
  checks, since 2.9).
- Cockpit panel: the copilot's side (left) is not drawn; the P2+ panel's lower row (clock, standby
  instruments, switches) is left out for room.
- Phantom for more exercises (quick stop, pedal turns), scoring against it.
- Slope-landing critical angle displayed.

Scene
- Tree and building shadows (the aircraft's own silhouette shadow is in since 2.0).
- Cockpit: the instrument panel is a flat texture; bezels, knobs and the overhead console
  in 3D; a canopy reflection at low sun.
- Downwash: snow and sand surfaces; rotor-tip vortices in humid air.
- Runway numbers, night lighting (a HAPI at the field pad since 2.15).
- The world (2.9): the wind does not follow the terrain (no lee turbulence or downdraught behind the
  Kuppe, no gusts round the town's towers); no rain, no cloud to fly into; traffic on the roads does
  not stop for anything.
- Approach view (2.12): the chin windows' outline is an estimate from photographs; on integrated
  GPUs it dropped frames in 2.12.2; 2.12.4 draws the chin windows at half resolution, and the
  setup's performance test measures it: numbers from an integrated GPU are still missing.
  After a departure from the hover that stays low and slow, the next stop has no hint until the
  aircraft has been away.

- Tail drive failure as a guided exercise (the failure and its panel button exist).
- Head tracking (2.13): the turn and nod from six key points; a face mesh would give the head's pose
  directly (MediaPipe's landmarker, 3.7 MB) and the lean too. Tested only with a fake camera playing
  a face, not with a live one.
