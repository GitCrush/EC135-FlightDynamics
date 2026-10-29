/* ═══════════════ AIRCRAFT: EC135 P2+ ═══════════════
   Every number is either from the type certificate / flight manual
   (masses, rotor speed, dimensions, engine ratings, limits) or an
   engineering estimate marked as such. Estimates are the first thing to
   revisit when the harness disagrees with the flight manual. */
const H={
  name:'EC135 P2+',
  /* Sources: Kampa/Enenkl/Polz/Roth, Aeromechanic Aspects in the Design of
     the EC135, 23rd ERF 1997 (rotor, controls, stabiliser, 1997 ratings);
     Seher-Weiß, ACT/FHS System Identification, JAHS 2019 (model form). */
  mEmpty:1520, mMax:2910, m:2500,          // kg; 2500 = two crew, half fuel, some kit
  /* Inertia: scaled from the Bo-105 (Padfield) by mass and length; the
     EC135 fuselage is longer and the tail boom heavier. Estimate. */
  /* Inertia: Ixx set so that the roll control sensitivity with the
     published hub moment and cyclic gearing lands inside the recommended
     band of the ERF 1997 controllability chart (~2.5 1/(s² inch)); Iyy
     from the pitch bandwidth of 1.84 rad/s at 75 kt (same paper). Estimates. */
  I:[2400,0,-650, 0,7000,0, -650,0,4900],  // Ixx Iyy Izz, Ixz product (nose-down bias), kg m²
  /* Servo valve and linkage lag at small amplitude. With 20 ms the roll
     response at 75 kt matches the published EC135 values (ERF 1997,
     Table 4: bandwidth 3.7 rad/s, phase delay 55 ms; the model gives 3.74
     and 55 with Ixx 2400). Pitch does not match: the model's bandwidth is
     2.9 rad/s against 1.84 published, phase delay 67 ms against 92. Closing
     that with inertia alone would take an implausible Iyy of ~13 000 kg m²,
     so Iyy stays an estimate and the difference is an open deviation
     (test/qualities.js reports it). */
  ctlTau:0.02,
  /* (2.16) Pitch: an equivalent delay of 25 ms in the longitudinal channel only. DLR's identified models of
     the EC135 need, beyond flapping and inflow, the lead-lag dynamics (the regressive lag mode near
     11.7 rad/s appears as a dipole in the pitch response, Seher-Weiss and von Gruenhagen, CEAS 2007); this
     model has rigid lag. With it the pitch phase delay at 75 kt is 93 ms (published 92, ERF 1997 Table 4;
     70 without). The bandwidth stays quicker than published (2.85 against 1.84 rad/s): an open deviation. */
  lonDelay:0.025,
  /* Couplings the training aids take out, measured from this model in
     vertical climbs and descents at zero ground speed (test/qualities.js
     re-measures them and fails if they drift): roll attitude and pedal
     needed per unit of collective in the hover; in forward flight the
     pedal per unit of mast torque, which at 100 kt is a straight line from
     a 2,000 fpm descent to an 8 m/s climb (the pedal per unit of
     collective is not: its slope doubles from descent to climb, so the
     2.0 law, pedFwd = -3.0 per unit collective, pushed the pedal twice too
     far when the lever was dumped at speed). */
  mix:{roll:-6.78, ped:-1.13, pedQ:-0.096e-3},   // from equilibria (hover climbs -1.5..10 m/s; 100 kt descents and climbs -8..8 m/s); negative: more collective or torque, more left skid low, more left pedal; pedQ per Nm of mast torque
  rotor:{
    N:4, R:5.10, c:0.29,                   // bearingless main rotor, 10.2 m diameter
    Om0:41.36,                             // 395 rpm = 100 % NR; tip speed 211 m/s
    /* Sense of rotation: counterclockwise seen from above (s = -1), like
       the BO105 and BK117 it descends from, and like US helicopters: the
       torque yaws the nose right, left pedal goes with power, the hover
       hangs left skid low. Airbus Helicopters IN 3540-I-00 lists the EC135
       P2+ among the types 'with a main rotor rotating counterclockwise
       when seen from above'. (Until 1.8 the model turned clockwise, as the
       Aérospatiale designs do; found by the flight-test author.) */
    s:-1,
    /* Hub moment capacity: Kampa et al. (Eurocopter, ERF 1997) give
       ~2000 Nm per degree of cyclic flapping, equivalent to an 8.7 %
       hinge offset without spring. With a 32 kg blade the offset alone
       reproduces that (113 kNm/rad for the rotor), so the spring is
       zero and nu_beta follows from the offset: 1.07. */
    e:0.087, mb:32, nu:1.07,
    twist:-10*DEG,                         // 10° root to tip (ERF 1997), linear; pitch referenced at 0.75 R
    d3:Math.tan(7.5*DEG),                  // positive flap/pitch coupling of 7.5° (ERF 1997): flap up, pitch down
    a:5.73, cd0:0.0095, cd2:0.38, aStall:15*DEG, Mdd:0.80,   // DM-H3/H4 class section: clmax ~1.5 at low Mach
    vrsN:0.22,                             // vortex-ring roughness: inflow fluctuation amplitude in units of the hover inflow (see rotorStep)
    dsT:10, dsMax:6*DEG, dsTs:4, dsTr:12,  // dynamic stall: delay to separation (semi-chords), largest excursion, separation and reattachment lags (see airfoilDyn)
    cmSep:0.20, Kth:9000,                  // separated-flow moment arm (share of chord the centre of pressure moves aft) and torsional stiffness of blade + control path at 100 % NR (Nm/rad; first torsion mode ~4.4/rev with ~0.3 kg m² pitch inertia, estimate)
    B:0.97,                                // tip loss: no lift outboard of 0.97 R (the outer element spans 0.95-1.0 R)
    Ne:8,                                  // blade elements
    hub:[0.0,0,-1.62],                     // hub relative to CG, body axes (1.62 m above)
    tilt:4*DEG,                            // shaft tilted forward: cruise attitude near level
    /* Cyclic ranges (ERF 1997, Table 3): lateral 15°, longitudinal 21.8°
       total; stick travel 160 / 215 mm. The gearing is linear; the
       longitudinal range is centred 3.1° forward (+14.0° / -7.8°) because
       high speed needs ~12.5° forward while the hover needs -1.1° and a
       hard deceleration ~6° aft. The split is an estimate. The hover stick
       therefore sits aft of centre, as in most helicopters. */
    col0:1.5*DEG, col1:16*DEG, lonC:3.1*DEG, lonH:10.9*DEG, lat:7.5*DEG,
    stickLat:0.160, stickLon:0.215,        // m, full travel
    /* Control phase: the swashplate is timed so that at 100 % NR a pure
       longitudinal stick input tilts the disc longitudinally. With
       nu_beta > 1 the flap response lags the pitch input by less than
       90°; the value is derived from nu and the Lock number at init and
       then held fixed, so off-nominal rotor speed produces the real
       cross-coupling. */
    phase:0,                               // filled in by rotorInit
    Ir:2000, Ihub:60,                      // rotor + gearbox inertia at the shaft; hub/gearbox share rigid to the body (estimates)
  },
  fen:{                                    // Fenestron
    R:0.50, N:10, c:0.05, ratio:8.91,      // 1.0 m duct, 10 blades of 0.05 m chord, tip speed 188 m/s (ERF 1997)
    pos:[-6.10,0,-0.85],                   // relative to CG; thrust along +y (to the right) against the counterclockwise rotor's torque, more with left pedal
    sd:1.1,                                // exit/disc area ratio of the shroud (slight diffuser)
    /* Cambered blades in a dense cascade: stall at 16°, not the 14° of an
       isolated symmetric section. With 14° the fan stalled at full pedal in
       calm air and had 8 % moment margin at the published hover ceiling, too
       little for a type certified with yaw control up to that ceiling in
       wind. Estimate; it changes nothing below the stall. */
    a:5.5, cd0:0.012, aStall:16*DEG,
    /* Pedal gearing: centre pedal 12°, full anti-torque pedal (left on the
       EC135) 40°, full pedal the other way -11° (estimate). No published
       yaw response data was found to check this against; the flight-test
       storyboard (flighttest/) compares it with textbook expectations.
       The right stop is set with Airbus IN 3540: in a steady autorotation
       the cambered fin pushes the tail sideways and the fan must push back
       with reverse thrust near the right stop (~600 N at 65 kt; the shroud
       does not augment it). 1.9 put the stop at -25° for this, with a
       reverse-thrust relation that took a quarter of the disc as the
       momentum area; with the fan's own disc (2.1) the same reverse thrust
       needs less pitch, and -25° left the autorotation pedal at mid-travel
       and gave a full right pedal in the hover 2.1 kN of reverse thrust. */
    th0:12*DEG, thMin:-11*DEG, thMax:40*DEG,  // fan pitch at centre pedal, full pedal with and against the torque; hover at ~38 % left pedal
    Ne:3, tau:0.06,                        // inflow lag
  },
  eng:{
    n:2, tau:0.55, rate:350e3,             // turbine power lag (s) and acceleration limit (W/s)
    /* Ratings from the EASA type certificate (TCDS EASA.R.009, EC135
       P2+), which gives them as torque in percent of a reference: AEO
       take-off 2 x 78 % (5 min), AEO maximum continuous 2 x 69 %; OEI 30 s
       128 %, OEI 2 min 125 %, OEI continuous 89.5 %. Each rating is
       pRef · ratio · min(k, NR/100): the transmission torque limit at the
       present rotor speed, or the turbines' own limit k = thk · δ · θ^-thb
       when the air is thin or hot (one lapse for all ratings: no engine
       data says otherwise). So the certificate's ratios hold everywhere,
       and only the scale, pRef, is an estimate (700 kW twin take-off). The
       time limits are the pilot's to observe; the incident detector
       reports an exceedance. (Until the 1.8 re-check the turbine ratings
       were separate estimates that set the OEI ratings 20 % off the
       certificate's ratios.) */
    tcds:{top:78, mcp:69, oei30:128, oei2:125, oeiMcp:89.5},   // % torque; AEO values per engine
    pRef:700e3/156,                        // W per % at 100 % NR (estimate: 700 kW twin take-off)
    top:350e3,                             // nominal take-off power per engine, for the N1 gauge and the sound
    tTop:300, tOei30:30, tOei2:150,        // time limits, s (OEI 30 s, then 2 min: 150 s above OEI MCP in all)
    /* Load on the rotor drive besides rotor and Fenestron: the accessories on
       the main gearbox (hydraulic pumps, oil cooler fan; they stay on the
       rotor when both engines quit, the generators do not: they sit on the
       engines' gas generators), bearing friction, and the gear mesh losses,
       2.5 % of the torque the gearbox passes (engine to mast and tail drive,
       or with the engines out, rotor to tail drive and accessories). Until
       2.0: 9 kW of accessories on the rotor in every case, no mesh losses;
       the hover power came out 1 % under the flight-test author's band and
       the rotor carried the generators down after a double engine failure. */
    idle:15e3, acc:4e3, mesh:0.025,        // flight-idle power, gearbox accessories (W at 100 % NR), mesh loss share
    qMax:700, qFric:120,                  // drive torque cap at low rotor speed (Nm), rotor bearing/gearbox friction
    sfc:0.36,                              // kg per kWh, both engines together at cruise power
    /* Turbine lapse k = thk · δ · θ^-thb (δ pressure ratio, θ temperature
       ratio to ISA sea level), fitted to the published EC135 P2 hover
       ceilings out of ground effect at 2835 kg (2685 m ISA, 1785 m ISA+20):
       there the engines' whole load (rotor, Fenestron, accessories,
       friction) equals take-off power; test/qualities.js flies both. */
    thk:1.016, thb:1.513,
    /* FADEC NR governor, W per % and W per %·s. With the 0.55 s turbine lag
       and the rotor's 23 kJ per % NR, 30e3/40e3 (until 1.8) left the loop at
       zeta ~0.1: a collective dump swung NR 97..103 % for 10 s and the
       torque swings yawed the aircraft. 45e3/20e3: zeta ~0.4. */
    kp:45e3, ki:20e3,
  },
  fus:{
    /* Drag areas by axis (m²): frontal, side, vertical. The frontal value
       is a calibration: at 2910 kg near sea level ISA, maximum continuous
       power (611 kW of engine load there) gives the published 137 kt
       cruise. Side and vertical are estimates from the outline. */
    f:[1.67,6.7,7.0],                     // side: cabin 4.2 + tail boom 2.5 m² drag area, spread along the body (frontal until 1.8: 1.50, when the Fenestron still carried 50-60 kW of anti-torque power at this speed)
    Vm:1.0, Vn:-9.5,                       // fuselage pitch (unstable) and yaw (unstable) moment volumes, m³/rad
    Sy:6.7, xy:0.8, Sz:3.5,                // cabin side force as a lifting body (m² per rad of sideslip) and where it acts; cabin lift (m² per rad of angle of attack: planform 6.75 m², aspect ratio 0.33, CLa = pi AR/2)
    down:0.025,                            // rotor download on the fuselage in hover, share of thrust
    /* Stabiliser: 2.6 m span, 0.52 m chord, inverted GA(W)-1 with Gurney
       flaps and end plates 0.36 m², fin 0.9 m² (ERF 1997). */
    stab:{x:-4.90,z:0.15,S:1.35,i0:-1.5*DEG,a:4.5,aStall:15*DEG},
    /* Fin camber and incidence as one zero-sideslip lift coefficient. Airbus
       (IN 3540): the Fenestron's large fin carries the anti-torque in
       cruise and the pedal goes back to the zero-thrust position; in
       autorotation the Fenestron needs negative thrust against the fin.
       0.83 puts the Fenestron at zero thrust in ball-centred cruise at
       120 kt (2.1; 1.9: 0.90 with ~36 % left to the fan, when the fuselage
       still had a stabilising weathercock moment and needed ~5.5° of
       sideslip to centre the ball; until 1.8: 0.30). Lift slope 3.2 (low
       aspect ratio), stall at 24° effective angle. Height: the centre of
       pressure of the fin above the shroud, 1.45 m above the CG (2.1; was
       0.55): Kampa et al. 1997, Fig. 18 give fin + Fenestron a dihedral
       effect of -0.12 m³/°, which needs the side force well above the CG.
       Calibrated against the statement, not a measurement. */
    fin:{x:-6.05,z:-1.45,S:1.0,a:3.2,cl0:0.83,aStall:24*DEG},
    endpl:{x:-4.90,S:0.36,a:2.8},          // stabiliser end plates
  },
  gear:{
    /* Skid tubes as four contact points; the CG sits 1.30 m above the
       ground with the skids level. Forward friction is low (the tube
       slides), lateral friction is high (it digs in) – that difference is
       what makes a sideways touchdown and dynamic rollover a real risk. */
    pts:[[0.95,-1.02,1.30],[0.95,1.02,1.30],[-1.05,-1.02,1.30],[-1.05,1.02,1.30]],
    tail:[-6.35,0,0.35],                   // tail bumper / Fenestron shroud bottom
    k:1.6e5, c:1.1e4, muX:0.30, muY:0.65,
    hardVs:2.4,                            // m/s: sink at touchdown that counts as a hard landing
  },
  pilot:{eye:[1.45,0.42,-0.35]},           // right seat (2.6: 0.42 m from the centre line, was 0.55, nearly against the door)
  nr:{minPowerOn:97,maxPowerOn:104,minAuto:85,maxAuto:106,stall:80},   // TCDS: power on 97-104 %, power off 85-106 % above 1900 kg
  vne:155,                                 // kt
};
