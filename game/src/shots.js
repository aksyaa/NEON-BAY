// The screenshot scenes behind ?shot=start|drive|chase|mission v2.
// Each one plays the real rules forward from a fresh state for a fixed
// number of steps, steered by the autopilot, so the frame is what a
// short stretch of real play looks like — and the same seed always
// gives the same frame. The four scenes together show the title,
// driving downtown, a police chase with the wanted HUD, and a mission
// in progress.
//
// Staging rule that matters: the chase camera follows state.player, so
// every driving step must keep the player glued to the car — otherwise
// the camera stays at the start point while the car drives away. After
// the autopilot run, the car is snapped to a composed pose in the
// middle of an open stretch of road, with the player glued to it.
//
// Corridor rule: the blocks are 60 units apart and their buildings
// fill the block centres, so the painted road lines (x = k*60) run
// straight into a facade ~10 units ahead. The real clear corridors
// are the gaps BETWEEN blocks, centred on x = 30 + 60k (and z = 30 +
// 60k): 21 units wide, no buildings, no lamps, no containers in
// Downtown. Every driving pose below sits on one of those corridors,
// facing along it, so the camera — 13 units behind the car — looks
// down a long open street with the towers flanking left and right.
import { STEP } from './config.js';

function gluePlayerToCar(game) {
  const s = game.state;
  if (!s.car) return;
  s.player.x = s.car.x;
  s.player.z = s.car.z;
  s.player.angle = s.car.angle;
}

function driveFor(game, seconds, tx, tz) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const car = game.state.car;
    if (car) game.vehicles.autopilot(car, tx, tz, STEP);
    game.vehicles.stepTraffic(STEP);
    game.police.step(STEP, game.state.player, true, game.state);
    game.world.update(STEP);
    gluePlayerToCar(game);
  }
}

function walkFor(game, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.vehicles.stepTraffic(STEP);
    game.pedestrians.step(STEP, game.state.player, false, 0);
    game.world.update(STEP);
  }
}

// Put the player car on an open stretch of road, facing along it, and
// glue the player to it so the chase camera frames it.
function poseCar(game, x, z, angle) {
  const s = game.state;
  s.car.x = x;
  s.car.z = z;
  s.car.angle = angle;
  s.car.speed = 12;
  s.carSpeed = 12;
  game.vehicles.syncCarMesh(s.car);
  gluePlayerToCar(game);
}

function posePatrolCar(game, index, x, z, tx, tz) {
  const car = game.police.cars[index];
  if (!car) return;
  car.x = x;
  car.z = z;
  car.angle = Math.atan2(tx - x, tz - z);
  car.speed = 20;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = car.angle;
}

function putPlayerInCar(game, x, z, angle) {
  const s = game.state;
  s.inCar = true;
  s.car = game.vehicles.playerCar;
  s.car.x = x;
  s.car.z = z;
  s.car.angle = angle;
  s.car.speed = 0;
  game.vehicles.syncCarMesh(s.car);
  gluePlayerToCar(game);
}

export function stageShot(name, game) {
  const s = game.state;
  // No roadblock while staging: it would spawn ahead of the player
  // during the autopilot run and land wherever it pleases in frame.
  s.noRoadblock = true;
  if (name === 'drive') {
    putPlayerInCar(game, 30, -110, 0);
    s.missions.index = 0;
    s.missions.start(s);
    s.money = 1250;
    s.health = 100;
    s.armor = 50;
    driveFor(game, 2, 30, 0);
    // Downtown Neon, mid-corridor on the x=30 gap, facing +z down
    // 200+ units of open street, towers flanking.
    poseCar(game, 30, -84, 0);
    return { screen: 'play', camera: 'chase' };
  }
  if (name === 'chase') {
    putPlayerInCar(game, 90, -110, 0);
    s.police.wanted = 3;
    s.missions.index = 2;
    s.missions.start(s);
    s.money = 2400;
    s.health = 68;
    s.armor = 20;
    driveFor(game, 2, 90, 0);
    // Downtown Neon, mid-corridor on the x=90 gap, facing +z; the whole
    // patrol pack ahead in the same corridor, turning toward the player
    // with light bars flashing — nothing but open street behind them.
    // All four must be posed: wanted 3 spawns four cars, and any
    // unposed one keeps chasing and ends up overlapping the player's car.
    poseCar(game, 90, -84, 0);
    posePatrolCar(game, 0, 84, -62, 90, -84);
    posePatrolCar(game, 1, 97, -56, 90, -84);
    posePatrolCar(game, 2, 82, -58, 90, -84);
    posePatrolCar(game, 3, 98, -52, 90, -84);
    return { screen: 'play', camera: 'chase' };
  }
  if (name === 'mission') {
    putPlayerInCar(game, 90, 170, Math.PI);
    s.missions.index = 0;
    s.missions.start(s);
    s.money = 850;
    s.health = 100;
    s.armor = 50;
    driveFor(game, 2, 90, 60);
    // Portside, mid-corridor on the x=90 gap, facing -z back toward
    // Downtown and the Marina Pier job: 90+ units of open street ahead.
    // The x=30 gap looks identical but a container (seed 7: x 29.7-39.7,
    // z 156.1-159.3) sits exactly between the camera and the car there,
    // so this shot uses the x=90 gap, verified clear by the collider map.
    poseCar(game, 90, 150, Math.PI);
    return { screen: 'play', camera: 'chase' };
  }
  // start: Mara on the Marina promenade at sunset, title screen over it.
  s.inCar = false;
  s.car = null;
  s.player.x = -205;
  s.player.z = 20;
  s.player.angle = Math.PI / 2;
  s.missions.index = 0;
  s.missions.start(s);
  s.money = 250;
  s.health = 100;
  s.armor = 50;
  walkFor(game, 4);
  return { screen: 'title', camera: 'title' };
}
