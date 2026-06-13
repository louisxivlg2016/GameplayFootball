# Gameplay Football — web port

An arcade rewrite of the C++ GameplayFootball engine as a Bun + React Three Fiber +
koota ECS + Rapier + zustand TypeScript app. Gameplay constants (pitch dimensions,
ball aerodynamics, player speeds, broadcast camera) are taken from the original
sources in `../src`.

## Run

```sh
bun install
bun run dev             # dev server with HMR + local TTS routes on :3000
```

Production bundle: `bun build ./index.html --outdir ./dist --minify`
Type-check: `bunx tsc --noEmit`

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | move (auto-switches to the player nearest the ball) |
| Shift | sprint |
| Space | shoot (vertical input aims at the corners) |
| X | ground pass |
| C | lofted pass |
| E | slide tackle (mistimed = foul, card, maybe penalty) |
| Enter | start match / resume |
| Esc | pause |

## Match rules

Ported from referee.cpp: offside (second-last defender, snapshot at the pass,
indirect free kick), fouls from mistimed slides with the original severity
model (from-behind + lateness → free kick / yellow / red, two yellows = red,
advantage played up to 3s), penalties for box fouls, staged set-piece
ceremonies (2s prepare, whistle, 9.15m retreat, walls on close free kicks),
45-minute halves at the original 7.7× clock with halftime side swap. A
normal match level after 90' ends in a draw; toggle "important match"
with M on the title screen for two halves of extra time and a best-of-5
penalty shootout when still tied. Players carry individual
ratings (speed, control, passing, shooting, tackling, stamina) that drive
movement and technique noise, and possession is touch-based — the ball is
genuinely loose between dribble touches. Crowd, kicks, and whistles are
synthesized with WebAudio.

## Architecture

```
src/main.tsx            input bootstrap + React root
src/game/world.ts       koota world
src/game/traits.ts      ECS traits (ball state, possession, formation anchors…)
src/game/levels.ts      pitch constants, 4-4-2 formation, kickoff placement
src/game/store.ts       zustand: UI state only (mode, score, clock, radar)
src/game/systems/       pure per-frame systems: possession, human control, AI,
                        movement, ball aerodynamics, match rules, camera, radar
src/components/         R3F views: Pitch, Ball (Rapier rigid body), Players,
                        Systems (single useFrame), Hud (DOM overlay)
```

Rapier owns ball collisions (ground bounce restitution 0.62, woodwork, net cage);
a ball system layers the original's quadratic air drag, rolling friction, and
net absorption on top. Players are ECS-scripted kinematic actors; goals,
corners, goal kicks, and throw-ins follow the original referee's last-touch rules.

## Player models

Players use the original game's real assets, converted by
`tools/convert-player-assets.ts` (run it with bun after changing it):

- `fullbody.ase` mesh with bone weights decoded from vertex colors
  (channel value v → joint ⌊v/10⌋, weight (v mod 10)/9, normalized)
- `player.object` skeleton hierarchy + `base.anim.util` bind pose,
  rendered as a `THREE.SkinnedMesh` per player (GPU skinning)
- original mocap `.anim` locomotion cycles (idle/dribble/walk/sprint, 10ms
  per frame, local-to-parent quaternions) played through `AnimationMixer`,
  selected by the original velocity bands and time-scaled to ground speed;
  cycles loop via an appended left/right-mirrored copy
- hairstyles attached to the neck bone; per-player skin tones and heights;
  flat-color team kits generated in the original kit-texture UV layout
  (goalkeepers wear the original `goalie_kit.png`)
