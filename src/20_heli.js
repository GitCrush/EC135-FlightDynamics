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
  I:[2400,0,-650, 0,7000,0, -650,0,5000],  // Ixx Iyy Izz, Ixz product (nose-down bias), kg m²
  rotor:{
    N:4, R:5.10, c:0.29,                   // bearingless main rotor, 10.2 m diameter
    Om0:41.36,                             // 395 rpm = 100 % NR; tip speed 211 m/s
    s:+1,                                  // clockwise from above (Eurocopter); +z_h sense
    /* Hub moment capacity: Kampa et al. (Eurocopter, ERF 1997) give
       ~2000 Nm per degree of cyclic flapping, equivalent to an 8.7 %
       hinge offset without spring. With a 32 kg blade the offset alone
       reproduces that (113 kNm/rad for the rotor), so the spring is
       zero and nu_beta follows from the offset: 1.07. */
    e:0.087, mb:32, nu:1.07,
    twist:-10*DEG,                         // 10° root to tip (ERF 1997), linear; pitch referenced at 0.75 R
    d3:Math.tan(7.5*DEG),                  // positive flap/pitch coupling of 7.5° (ERF 1997): flap up, pitch down
    a:5.73, cd0:0.0095, cd2:0.38, aStall:15*DEG, Mdd:0.80,   // DM-H3/H4 class section: clmax ~1.5 at low Mach
    B:0.97,                                // tip loss: no lift outboard of 0.97 R
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
    Ir:1350, Ihub:60,                      // rotor + gearbox inertia at the shaft; hub/gearbox share rigid to the body (estimates)
  },
  fen:{                                    // Fenestron
    R:0.50, N:10, c:0.05, ratio:8.91,      // 1.0 m duct, 10 blades of 0.05 m chord, tip speed 188 m/s (ERF 1997)
    pos:[-6.10,0,-0.85],                   // relative to CG; thrust along -y (right pedal)
    sd:1.1,                                // exit/disc area ratio of the shroud (slight diffuser)
    a:5.5, cd0:0.012, aStall:14*DEG,
    /* Pedal gearing: centre pedal 15°, full right 31°, full left -5°.
       The fan's thrust per degree is high (it runs at 40+ m/s inflow),
       so the linkage is geared short: full right pedal from the hover
       gives about 70-90 °/s, which is what the type is known for. */
    th0:14*DEG, thMin:-10*DEG, thMax:40*DEG,  // pedal gearing: hover at ~40 % right pedal
    Ne:3, tau:0.06,                        // inflow lag
  },
  eng:{
    n:2, tau:0.55, rate:350e3,             // turbine power lag (s) and acceleration limit (W/s)
    /* PW206B2 ratings and the transmission limits that actually cap the
       FLI. Per-engine values; twin totals capped by the gearbox. */
    mcp:380e3, top:440e3, oei30:560e3, oei2:500e3, oeiCont:460e3,
    xmsnMcp:640e3, xmsnTop:700e3,          // main gearbox limits, twin; FLI 10 = MCP, 11 = TOP
    idle:15e3, acc:9e3,                    // flight-idle power, accessory load
    qMax:700, qFric:120,                  // drive torque cap at low rotor speed (Nm), rotor bearing/gearbox friction
    sfc:0.36,                              // kg per kWh, both engines together at cruise power
    kp:30e3, ki:40e3,                      // FADEC NR governor, W per % and W per %·s
  },
  fus:{
    /* Drag areas by axis (m²): frontal, side, vertical. The frontal value
       is calibrated so that max continuous power gives the published
       137 kt cruise; side and vertical are estimates from the outline. */
    f:[1.50,6.7,7.0],                     // side: cabin 4.2 + tail boom 2.5 m² drag area, spread along the body
    Vm:1.0, Vn:-0.45,                      // fuselage pitch (unstable) and yaw (unstable) moment volumes, m³/rad
    down:0.025,                            // rotor download on the fuselage in hover, share of thrust
    /* Stabiliser: 2.6 m span, 0.52 m chord, inverted GA(W)-1 with Gurney
       flaps and end plates 0.36 m², fin 0.9 m² (ERF 1997). */
    stab:{x:-4.90,z:0.15,S:1.35,i0:-1.5*DEG,a:4.5,aStall:15*DEG},
    fin:{x:-6.05,z:-0.55,S:1.0,a:3.2,cl0:0.30,aStall:18*DEG},  // cambered fin unloads the Fenestron in cruise
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
  pilot:{eye:[1.45,0.55,-0.35]},           // right seat
  nr:{minPowerOn:97,maxPowerOn:104,minAuto:85,maxAuto:110,stall:80},
  vne:155,                                 // kt
};
