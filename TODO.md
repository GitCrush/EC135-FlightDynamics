# TODO

Calibration (rotor, controls, stabiliser now from ERF 1997; still open)
- P2+ gearbox and engine ratings (1997 values are for the Arrius 2B / PW206B
  version at 2630 kg): climb rate at TOP, hover ceiling.
- Forward/aft split of the 21.8° longitudinal range; forward margin at
  MTOW and 140 kt is 13 %.
- Inertias (Ixx set from the roll-sensitivity band, Iyy from the pitch
  bandwidth); fuselage drag areas.
- Precone 2.5° and the tip twist relief are not modelled.
- Transition hump (stabiliser downwash): power at 40 kt.

Physics
- Blade pitch-flap coupling and swashplate phase as measured values.
- Fenestron: interference with the fin in left sideward flight.
- Retreating-blade stall onset vs g and weight against the Vne chart.
- Start-up: N1/TOT indication, rotor brake, one engine at a time.
- Turbulence intensity scaled with the wind profile near the ground.

Trainer
- Touch controls (virtual stick, collective slider).
- Phantom for more exercises (quick stop, pedal turns), scoring against it.
- Slope-landing critical angle displayed.

Scene
- Tree and building shadows; downwash on water.
- Runway numbers, PAPI for the approach exercise, night lighting.
- Wires as a collision hazard (the power line is visual only).
- Instancing for the forests (ANGLE_instanced_arrays) to allow denser
  woods on weak GPUs.
