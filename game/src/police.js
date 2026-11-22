// The wanted system and the police AI v2. Stars rise when Mara steals
// a car, crashes into traffic, shoots, or wrecks a patrol car, and they
// decay slowly while she stays out of trouble. Patrol cars spawn up to
// the wanted level, chase by steering toward her, ram on contact, and
// flash their light bars. On foot, a nearby patrol car runs her down
// and busts her; in a car, rams damage the car and shake the camera.
// New in v2: at three stars or more the Bay PD throws up a roadblock —
// two patrol cars parked across the road ahead of her, with a striped
// barrier between them. It clears when the heat drops below three.
import * as THREE from 'three';
import { MAX_POLICE_CARS, WANTED_DECAY_SECONDS } from './config.js';
import { clamp, distSq } from './random.js';
import { makeCarMesh } from './vehicles.js';

const BUST_RADIUS_SQ = 36; // 6 units
const BUST_SECONDS = 3;
const RAM_RADIUS = 4.2;
const BLOCK_AHEAD = 42;
const BLOCK_GAP = 3.4;

export function createPolice(scene, world, vehicles, rng) {
  const cars = [];
  let wanted = 0;
  let decayTimer = 0;
  let bustTimer = 0;
  let flashTime = 0;
  let block = null;
  let blockCooldown = 0;

  function addWanted(n) {
    wanted = clamp(wanted + n, 0, 5);
    decayTimer = 0;
  }

  function spawnChaser(player) {
    const angle = rng() * Math.PI * 2;
    const dist = 55 + rng() * 25;
    const mesh = makeCarMesh(0x1a1a22, true);
    scene.add(mesh);
    const car = {
      x: clamp(player.x + Math.sin(angle) * dist, -290, 290),
      z: clamp(player.z + Math.cos(angle) * dist, -290, 290),
      angle: 0,
      speed: 0,
      mesh,
      isPolice: true,
      health: 100,
      roadblock: false,
    };
    cars.push(car);
    return car;
  }

  // Two patrol cars parked across the road ahead of the player, plus a
  // striped barrier. They do not chase; they are a wall to smash through
  // or swerve around.
  function buildRoadblock(player) {
    const heading = player.angle;
    const aheadX = player.x + Math.sin(heading) * BLOCK_AHEAD;
    const aheadZ = player.z + Math.cos(heading) * BLOCK_AHEAD;
    const perpX = Math.cos(heading);
    const perpZ = -Math.sin(heading);
    const blockCars = [-1, 1].map((side) => {
      const mesh = makeCarMesh(0x1a1a22, true);
      scene.add(mesh);
      const car = {
        x: aheadX + perpX * BLOCK_GAP * side,
        z: aheadZ + perpZ * BLOCK_GAP * side,
        angle: heading + Math.PI / 2,
        speed: 0,
        mesh,
        isPolice: true,
        health: 100,
        roadblock: true,
      };
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.angle;
      cars.push(car);
      return car;
    });
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(BLOCK_GAP * 2 + 2, 1, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff9f1c }),
    );
    barrier.position.set(aheadX, 0.6, aheadZ);
    barrier.rotation.y = heading + Math.PI / 2;
    scene.add(barrier);
    block = { cars: blockCars, barrier };
  }

  function clearRoadblock() {
    if (!block) return;
    block.cars.forEach((car) => {
      scene.remove(car.mesh);
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
    });
    scene.remove(block.barrier);
    block = null;
    blockCooldown = 8;
  }

  function chaseCar(car, dt, player, inCar, state) {
    const targetAngle = Math.atan2(player.x - car.x, player.z - car.z);
    let d = targetAngle - car.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    car.angle += clamp(d, -1.9 * dt, 1.9 * dt);
    const dist = Math.sqrt(distSq(car.x, car.z, player.x, player.z));
    const targetSpeed = dist > 6 ? 26 + wanted * 2 : 10;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    car.x = clamp(car.x, -298, 298);
    car.z = clamp(car.z, -298, 298);
    world.collideCircle(car, 2.1);
    if (dist < RAM_RADIUS) {
      // Ram: shove the player — or her car — and hurt them.
      const push = 6 * dt;
      if (inCar && state.car) {
        state.car.x += Math.sin(car.angle) * push;
        state.car.z += Math.cos(car.angle) * push;
        player.x = state.car.x;
        player.z = state.car.z;
        state.carHealth = Math.max(0, (state.carHealth ?? 100) - 8 * dt);
      } else {
        player.x += Math.sin(car.angle) * push;
        player.z += Math.cos(car.angle) * push;
        state.health -= 14 * dt;
      }
      state.damageFlash = 0.5;
      car.speed *= 0.5;
    }
  }

  function blockCar(car, dt, player, inCar, state) {
    // A parked roadblock car is a wall: push the player (or her car)
    // out of its circle and chip the car's health on impact.
    const focus = inCar && state.car ? state.car : player;
    const d2 = distSq(car.x, car.z, focus.x, focus.z);
    if (d2 >= 20.25 || d2 < 0.01) return;
    const d = Math.sqrt(d2);
    const nx = (focus.x - car.x) / d;
    const nz = (focus.z - car.z) / d;
    const overlap = 4.5 - d;
    if (inCar && state.car) {
      state.car.x += nx * overlap;
      state.car.z += nz * overlap;
      state.car.speed *= 0.5;
      state.carHealth = Math.max(0, (state.carHealth ?? 100) - 10 * dt);
      if (state.audio) state.audio.crash();
    } else {
      player.x += nx * overlap;
      player.z += nz * overlap;
      state.health -= 10 * dt;
    }
    state.damageFlash = 0.5;
    player.x = state.car ? state.car.x : player.x;
    player.z = state.car ? state.car.z : player.z;
  }

  function flashLights(car) {
    const on = Math.floor(flashTime * 4) % 2 === 0;
    const red = car.mesh.userData.red;
    const blue = car.mesh.userData.blue;
    if (!red || !blue) return;
    red.material.color.setHex(on ? 0xff2222 : 0x550000);
    blue.material.color.setHex(on ? 0x000055 : 0x2255ff);
  }

  function step(dt, player, inCar, state) {
    flashTime += dt;
    blockCooldown = Math.max(0, blockCooldown - dt);

    // The pack matches the heat: one chaser per star, plus one extra.
    const want = wanted === 0 ? 0 : Math.min(MAX_POLICE_CARS, wanted + 1);
    const chasers = cars.filter((c) => !c.roadblock);
    while (chasers.length < want) chasers.push(spawnChaser(player));
    while (chasers.length > want) {
      const car = chasers.pop();
      scene.remove(car.mesh);
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
    }

    if (wanted > 0) {
      decayTimer += dt;
      if (decayTimer > WANTED_DECAY_SECONDS) {
        wanted -= 1;
        decayTimer = 0;
      }
    }

    // Roadblock: up at three stars, down when the heat drops.
    if (wanted >= 3 && !block && blockCooldown <= 0 && !state.noRoadblock) {
      buildRoadblock(player);
    } else if (wanted < 3 && block) {
      clearRoadblock();
    }

    const policeNear = cars.some((c) => distSq(c.x, c.z, player.x, player.z) < BUST_RADIUS_SQ);
    if (!inCar && wanted > 0 && policeNear) {
      bustTimer += dt;
      if (bustTimer > BUST_SECONDS) {
        state.busted = true;
        bustTimer = 0;
      }
    } else {
      bustTimer = Math.max(0, bustTimer - dt * 2);
    }

    cars.forEach((car) => {
      if (car.roadblock) blockCar(car, dt, player, inCar, state);
      else chaseCar(car, dt, player, inCar, state);
      flashLights(car);
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.angle;
    });
    return { bustProgress: bustTimer / BUST_SECONDS };
  }

  return {
    cars,
    get wanted() {
      return wanted;
    },
    set wanted(v) {
      wanted = clamp(v, 0, 5);
    },
    addWanted,
    step,
  };
}
