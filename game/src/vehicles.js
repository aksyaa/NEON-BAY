// Vehicles v2: the player's car, civilian traffic and parked cars to
// steal. Every car is boxes, cylinders and emissive lights — no models
// anywhere. Traffic drives the road grid: it runs along one axis, turns
// at intersections, and never leaves the roads. The player's car uses
// simple arcade physics with a handbrake drift.
import * as THREE from 'three';
import { CAR, TRAFFIC_COUNT } from './config.js';
import { clamp, distSq, pick, range } from './random.js';

const PAINT = [0xd94f3d, 0x3d7dd9, 0xf2c94c, 0x4fd97a, 0xe8e8f0, 0x2b2b33, 0xd97ab8, 0x7ab8d9];
const WHEEL_SPOTS = [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]];

export function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14141c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), paint);
  body.position.y = 0.65;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2), dark);
  cabin.position.set(0, 1.3, -0.3);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0c10 });
  const wheels = WHEEL_SPOTS.map(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.42, z);
    group.add(wheel);
    return wheel;
  });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  [-0.7, 0.7].forEach((x) => {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), headMat);
    head.position.set(x, 0.7, 2.25);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tailMat);
    tail.position.set(x, 0.7, -2.25);
    group.add(tail);
  });
  if (isPolice) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.45;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    blue.position.x = 0.45;
    bar.add(red);
    bar.add(blue);
    bar.position.set(0, 1.75, -0.3);
    group.add(bar);
    group.userData.red = red;
    group.userData.blue = blue;
  }
  group.userData.wheels = wheels;
  return group;
}

function placeCarMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  const spin = (car.speed * 0.016) / 0.42;
  car.mesh.userData.wheels.forEach((wheel) => {
    wheel.rotation.x += spin;
  });
}

export function createVehicles(scene, world, rng) {
  const traffic = [];
  const parked = [];

  function addCar(x, z, angle, color, isPolice) {
    const mesh = makeCarMesh(color, isPolice);
    scene.add(mesh);
    const car = { x, z, angle, speed: 0, mesh, isPolice: !!isPolice, health: 100, color };
    placeCarMesh(car);
    return car;
  }

  // Civilian traffic, one car per road line, cruising at its own pace.
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const horizontal = rng() < 0.5;
    const line = Math.round(range(rng, -4, 4)) * 60;
    const along = range(rng, -270, 270);
    const heading = horizontal
      ? (rng() < 0.5 ? 0 : Math.PI)
      : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = addCar(
      horizontal ? along : line,
      horizontal ? line : along,
      heading,
      pick(rng, PAINT),
      false,
    );
    car.speed = range(rng, 7, 13);
    car.cruise = car.speed;
    traffic.push(car);
  }

  // Parked cars Mara can steal, lined up on downtown roads. The yellow
  // sports car is the target of mission 2.
  const parkedSpots = [
    { x: 8, z: 60, angle: 0, color: 0xf2c94c, sport: true },
    { x: -52, z: 0, angle: Math.PI / 2, color: 0xd94f3d },
    { x: 68, z: -60, angle: Math.PI, color: 0x3d7dd9 },
    { x: -8, z: -120, angle: -Math.PI / 2, color: 0x4fd97a },
    { x: 128, z: 60, angle: 0, color: 0xe8e8f0 },
  ];
  parkedSpots.forEach((spot) => {
    const car = addCar(spot.x, spot.z, spot.angle, spot.color, false);
    car.parked = true;
    car.sport = !!spot.sport;
    parked.push(car);
  });

  // Mara's own car, parked near the Marina promenade.
  const playerCar = addCar(-196, 8, Math.PI / 2, 0xff4fd8, false);
  playerCar.parked = true;

  function stepTraffic(dt) {
    traffic.forEach((car) => {
      car.x += Math.sin(car.angle) * car.speed * dt;
      car.z += Math.cos(car.angle) * car.speed * dt;
      const nearX = Math.round(car.x / 60) * 60;
      const nearZ = Math.round(car.z / 60) * 60;
      const onIntersection = Math.abs(car.x - nearX) < 1.2 && Math.abs(car.z - nearZ) < 1.2;
      if (onIntersection && rng() < 0.02) {
        car.angle += pick(rng, [-Math.PI / 2, Math.PI / 2]);
        car.x = nearX;
        car.z = nearZ;
      }
      if (car.x > 295 || car.x < -295 || car.z > 295 || car.z < -295) {
        car.angle += Math.PI;
        car.x = clamp(car.x, -290, 290);
        car.z = clamp(car.z, -290, 290);
      }
      // Ease back toward cruising speed.
      car.speed += (car.cruise - car.speed) * Math.min(1, dt * 2);
      placeCarMesh(car);
    });
  }

  function stepPlayerCar(dt, input, state, car) {
    car = car || playerCar;
    const forward = input.forward();
    const back = input.back();
    const drifting = input.drift();
    if (forward) car.speed += CAR.accel * dt;
    else if (back) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    const steerAmount = input.steer() * CAR.steerMax * clamp(Math.abs(car.speed) / 10, 0, 1);
    car.angle += steerAmount * (car.speed >= 0 ? 1 : -1) * dt * (drifting ? 1.7 : 1);
    // Drifting bleeds speed and swings the tail out — the slide is the
    // extra yaw above plus the speed loss below.
    if (drifting && Math.abs(car.speed) > 12) car.speed -= Math.sign(car.speed) * 6 * dt;
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    car.x = clamp(car.x, -298, 298);
    car.z = clamp(car.z, -298, 298);
    const hitBuilding = world.collideCircle(car, CAR.radius);
    if (hitBuilding && Math.abs(car.speed) > 14) {
      car.speed *= 0.4;
      state.damageFlash = 0.4;
      if (state.audio) state.audio.crash();
    }
    // Bump into other cars: a simple circle push both ways.
    [...traffic, ...parked].forEach((other) => {
      if (other === car || other.stolen) return;
      const d2 = distSq(car.x, car.z, other.x, other.z);
      if (d2 >= 16 || d2 < 0.01) return;
      const d = Math.sqrt(d2);
      const push = (4 - d) / 2;
      const nx = (car.x - other.x) / d;
      const nz = (car.z - other.z) / d;
      car.x += nx * push;
      car.z += nz * push;
      other.x -= nx * push * 0.4;
      other.z -= nz * push * 0.4;
      car.speed *= 0.6;
      placeCarMesh(other);
    });
    placeCarMesh(car);
    return { drifting: drifting && Math.abs(car.speed) > 12, speed: car.speed };
  }

  function nearestStealable(x, z, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    [...parked, playerCar, ...traffic].forEach((car) => {
      if (car.stolen) return;
      const d2 = distSq(car.x, car.z, x, z);
      if (d2 < bestD) {
        bestD = d2;
        best = car;
      }
    });
    return best;
  }

  // A simple autopilot for the screenshot scenes: full throttle,
  // steering toward a target point.
  function autopilot(car, tx, tz, dt) {
    const targetAngle = Math.atan2(tx - car.x, tz - car.z);
    let d = targetAngle - car.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    car.angle += clamp(d, -1.4 * dt, 1.4 * dt);
    car.speed = Math.min(car.speed + CAR.accel * 0.5 * dt, 20);
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    world.collideCircle(car, CAR.radius);
    placeCarMesh(car);
  }

  return {
    traffic,
    parked,
    playerCar,
    stepTraffic,
    stepPlayerCar,
    nearestStealable,
    autopilot,
    syncCarMesh: placeCarMesh,
  };
}
