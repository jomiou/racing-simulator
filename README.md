# Hollowmere GT — browser racing simulator

A single-car sim-racing game that runs in the browser: a 500 hp front-engined, rear-drive GT3-style car on a recreation of **Spa-Francorchamps**. No AI opponents; the focus is on how the car behaves.

![Controls: keyboard, gamepad or wheel](https://img.shields.io/badge/input-keyboard%20%7C%20gamepad%20%7C%20wheel-2b4a2c) ![three.js](https://img.shields.io/badge/renderer-three.js%20r160-16463a)

## Play

Open `index.html` in a desktop browser (Chrome, Edge, Firefox or Safari). It needs an internet connection the first time, because three.js and the fonts load from public CDNs. If your browser blocks the page when it's opened as a file, serve the folder instead:

```bash
python3 -m http.server 8000
```

Then go to <http://localhost:8000>.

### Controls

| Keyboard | Action |
|---|---|
| `W` `S` / `↑` `↓` | Throttle / brake |
| `A` `D` / `←` `→` | Steer |
| `S` / `↓` held at a standstill | Reverse (then `↓` drives backwards, `↑` brakes; `↑` at a standstill selects 1st) |
| `E` `Q` | Shift up / down (the automatic gearbox is on by default) |
| `C` `V`, `1`–`7` | Cameras: cockpit, roof, nose, side pod, chase, far chase, trackside TV |
| `Z` `X` | Look left / right |
| `[` `]` | Brake bias |
| `T` `B` | Traction control level, ABS on/off |
| `R` | Reset onto the track (invalidates the lap) |
| `M` `H` | Virtual mirror, minimal HUD |
| `Esc` | Pause menu: setup, assists, controls, display |

Gamepads work out of the box (left stick, triggers, bumpers to shift). Wheels and pedals can be bound and calibrated in **Controls**.

**Easy mode for keyboard driving** is on by default. While you steer with the keyboard it adds stability control (braking single wheels to stop a slide), automatic countersteer, strong traction control, ABS and a gentler throttle ramp. It switches itself off when you drive with a gamepad or wheel, and can be turned off under **Assists**.

## What is simulated

All physics runs at 1000 Hz in `src/sim.js`, independent of the frame rate.

- **Tyres:** Magic Formula curves with combined slip (braking or accelerating uses up cornering grip), carcass relaxation, load sensitivity, slip-at-peak that grows with load, a two-node surface/core temperature model, wear, and grip loss from dirt picked up off track.
- **Suspension:** a sprung body with heave, pitch and roll on four spring/damper corners (separate bump and rebound), anti-roll bars, bump stops, roll centres and pitch axis, and four unsprung wheel masses on tyre springs. Tyres can leave the ground. Kerbs and road bumps are physical inputs under each wheel.
- **Elevation:** gravity along the slope, plus vertical load from road curvature. The car goes light over the crest at the top of Raidillon and is compressed at the bottom of Eau Rouge (about 1.8 g at 250 km/h).
- **Aero:** drag and downforce that scale with speed and wing setting, and a downforce balance that shifts with front and rear ride height.
- **Drivetrain:** engine torque curve with friction and rev limiter, launch/anti-stall clutch, six-speed sequential gearbox with ignition cut and throttle blip, and a limited-slip differential with preload and ramp.
- **Brakes:** adjustable torque bias, ABS that holds slip just under the peak with select-low on the rear axle, disc temperature with cold bite and fade, and fuel burn that lightens the car.
- **Aids:** slip-based traction control that allows less wheelspin the harder you corner, and stability control for easy mode.

Reference numbers from the test suite: 0–100 km/h in about 3.8 s, a top speed of about 286 km/h, 200–0 km/h in about 84 m, and 1.5 g of lateral grip at 80 km/h rising to 2.0 g at 220 km/h.

## Project layout

```
index.html          built, self-contained game (open this)
src/shell.html      page markup and styles
src/sim.js          track model and vehicle dynamics (no rendering; also runs in Node)
src/spa-data.js     Spa-Francorchamps centre line and track widths
src/game.js         three.js scene, car model, cameras, input, audio, HUD, timing
tools/build.py      inlines src/ into index.html
tests/              physics regression tests (Node's built-in test runner)
```

## Develop

```bash
python3 tools/build.py   # rebuild index.html after editing src/
node --test              # run the physics tests (Node 18 or newer)
```

## Credits

- Spa-Francorchamps centre line and track widths come from the [TUMFTM racetrack-database](https://github.com/TUMFTM/racetrack-database) (LGPL-3.0), derived from [OpenStreetMap](https://www.openstreetmap.org/copyright) data © OpenStreetMap contributors. The elevation profile, scenery and buildings are this project's own approximation, not survey data.
- Rendering by [three.js](https://threejs.org) (MIT). Fonts: Barlow, Barlow Condensed and IBM Plex Mono from Google Fonts (SIL Open Font License).
- The car, the "Hollowmere" name and the liveries are fictional.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for licence details.
